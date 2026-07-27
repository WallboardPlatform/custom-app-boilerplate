import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { WayfindingPoint } from '../../../src/utils/wayfinding';
import { wayfindingStudioProjectDefaults } from '../studio-project.mts';
import type {
	WayfindingStudioAsset,
	WayfindingStudioCamera3d,
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioLabelElement,
	WayfindingStudioMediaElement,
	WayfindingStudioOriginElement,
	WayfindingStudioPolygonElement,
	WayfindingStudioProject,
	WayfindingStudioProjectDefaults
} from '../studio-project.mts';

const pointInPolygon = (point: WayfindingPoint, polygon: WayfindingPoint[]): boolean => {
	let inside = false;

	for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left++) {
		const a: WayfindingPoint = polygon[left];
		const b: WayfindingPoint = polygon[right];

		if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
	}

	return inside;
};

const polygonHeight = (
	floor: WayfindingStudioFloor,
	polygon: WayfindingStudioPolygonElement,
	defaults: WayfindingStudioProjectDefaults
): number => {
	const visualHeight: number = polygon.presentation?.extrusionHeight ?? defaults[polygon.type].extrusionHeight;

	return Math.min(floor.width, floor.height) * visualHeight / 500;
};

const polygonColor = (polygon: WayfindingStudioPolygonElement, defaults: WayfindingStudioProjectDefaults): string =>
	polygon.presentation?.fillColor ?? defaults[polygon.type].fillColor;
const polygonOpacity = (polygon: WayfindingStudioPolygonElement, defaults: WayfindingStudioProjectDefaults): number =>
	polygon.presentation?.fillOpacity ?? defaults[polygon.type].fillOpacity;
const POLYGON_LAYER_ORDER: Record<WayfindingStudioPolygonElement['type'], number> = {
	walkable: 1,
	location: 2,
	obstacle: 3
};

const centeredPoint = (floor: WayfindingStudioFloor, point: WayfindingPoint, elevation = 0): THREE.Vector3 => new THREE.Vector3(
	point.x - floor.width / 2,
	elevation,
	point.y - floor.height / 2
);

const labelElevation = (
	floor: WayfindingStudioFloor,
	elements: WayfindingStudioElement[],
	point: WayfindingPoint,
	defaults: WayfindingStudioProjectDefaults
): number => {
	const polygon: WayfindingStudioPolygonElement | undefined = elements
		.filter((element): element is WayfindingStudioPolygonElement => 'geometry' in element)
		.reverse()
		.find((element): boolean => pointInPolygon(point, element.geometry));

	return (polygon ? polygonHeight(floor, polygon, defaults) : 0) + groundClearance(floor);
};

const groundClearance = (floor: WayfindingStudioFloor): number => Math.min(floor.width, floor.height) * 0.018;

const createTextTexture = (
	label: WayfindingStudioLabelElement,
	defaults: WayfindingStudioProjectDefaults
): { height: number; texture: THREE.CanvasTexture; width: number } => {
	const fontFamily: Record<NonNullable<WayfindingStudioLabelElement['fontFamily']>, string> = {
		monospace: '"Courier New", monospace',
		'sans-serif': 'Arial, sans-serif',
		serif: 'Georgia, serif'
	};
	const fontSize: number = Math.max(12, label.fontSize ?? defaults.label.fontSize);
	const padding: number = Math.ceil(fontSize * 0.42 + (label.outlineWidth ?? defaults.label.outlineWidth) * 2);
	const canvas: HTMLCanvasElement = document.createElement('canvas');
	const context: CanvasRenderingContext2D = canvas.getContext('2d')!;
	context.font = `${label.fontWeight ?? defaults.label.fontWeight} ${fontSize}px ${fontFamily[label.fontFamily ?? defaults.label.fontFamily]}`;
	canvas.width = Math.max(8, Math.ceil(context.measureText(label.text || ' ').width + padding * 2));
	canvas.height = Math.max(8, Math.ceil(fontSize * 1.45 + padding * 2));
	const drawingContext: CanvasRenderingContext2D = canvas.getContext('2d')!;
	drawingContext.font = `${label.fontWeight ?? defaults.label.fontWeight} ${fontSize}px ${fontFamily[label.fontFamily ?? defaults.label.fontFamily]}`;
	drawingContext.textAlign = 'center';
	drawingContext.textBaseline = 'middle';
	drawingContext.lineJoin = 'round';
	const outlineWidth: number = label.outlineWidth ?? defaults.label.outlineWidth;

	if (outlineWidth > 0) {
		drawingContext.strokeStyle = label.outlineColor ?? defaults.label.outlineColor;
		drawingContext.lineWidth = outlineWidth * 2;
		drawingContext.strokeText(label.text, canvas.width / 2, canvas.height / 2);
	}

	drawingContext.fillStyle = label.color ?? defaults.label.color;
	drawingContext.fillText(label.text, canvas.width / 2, canvas.height / 2);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;

	return { height: canvas.height, texture, width: canvas.width };
};

export interface WayfindingScene3dOptions {
	onSelectElement: (elementId: string) => void;
}

export class WayfindingScene3d {
	private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100_000);
	private currentFloor?: WayfindingStudioFloor;
	private currentProject?: WayfindingStudioProject;
	private readonly controls: OrbitControls;
	private readonly disposableObjects: THREE.Object3D[] = [];
	private frameId?: number;
	private lastBuildKey?: string;
	private readonly originAnimations: Array<{
		baseY: number;
		group: THREE.Group;
		kind: WayfindingStudioProjectDefaults['origin']['animation3d'];
		phase: number;
		speed: number;
	}> = [];
	private pointerStart?: { x: number; y: number };
	private readonly raycaster = new THREE.Raycaster();
	private readonly renderer: THREE.WebGLRenderer;
	private readonly resizeObserver: ResizeObserver;
	private routeAnimation?: {
		curve: THREE.Curve<THREE.Vector3>;
		kind: WayfindingStudioProjectDefaults['route']['animation'];
		markers: THREE.Mesh[];
		speed: number;
		startedAt: number;
	};
	private readonly scene = new THREE.Scene();
	private readonly selectableObjects: THREE.Object3D[] = [];
	private selectedElementId?: string;
	private visible = false;

	public constructor(private readonly host: HTMLElement, private readonly options: WayfindingScene3dOptions) {
		this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.setClearColor('#26302e');
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		this.renderer.domElement.setAttribute('aria-label', 'Rotatable 3D map preview');
		this.renderer.domElement.className = 'scene-3d-canvas';
		this.host.append(this.renderer.domElement);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
		this.controls.minPolarAngle = THREE.MathUtils.degToRad(12);
		this.controls.screenSpacePanning = false;
		this.scene.add(new THREE.HemisphereLight('#fff9e8', '#394440', 2.1));
		const keyLight = new THREE.DirectionalLight('#ffffff', 2.4);
		keyLight.castShadow = true;
		keyLight.position.set(-600, 1_200, 500);
		this.scene.add(keyLight);
		const fillLight = new THREE.DirectionalLight('#d7f0eb', 1.1);
		fillLight.position.set(700, 500, -600);
		this.scene.add(fillLight);
		this.renderer.domElement.addEventListener('pointerdown', (event: PointerEvent): void => {
			this.pointerStart = { x: event.clientX, y: event.clientY };
		});
		this.renderer.domElement.addEventListener('pointerup', (event: PointerEvent): void => {
			if (!this.pointerStart || Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 5) return;
			this.pick(event);
		});
		this.resizeObserver = new ResizeObserver((): void => this.resize());
		this.resizeObserver.observe(this.host);
		this.resize();
	}

	public applyCameraState(state: WayfindingStudioCamera3d): void {
		if (!this.currentFloor) return;
		const pitch: number = THREE.MathUtils.degToRad(state.pitchDegrees);
		const azimuth: number = THREE.MathUtils.degToRad(state.azimuthDegrees);
		const horizontal: number = Math.cos(pitch) * state.distance;
		const target: THREE.Vector3 = centeredPoint(this.currentFloor, { x: state.targetX, y: state.targetY });
		this.controls.target.copy(target);
		this.camera.position.set(
			target.x + Math.sin(azimuth) * horizontal,
			Math.sin(pitch) * state.distance,
			target.z + Math.cos(azimuth) * horizontal
		);
		this.camera.lookAt(target);
		this.controls.update();
	}

	public dispose(): void {
		if (this.frameId !== undefined) window.cancelAnimationFrame(this.frameId);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		this.disposeSceneContent();
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	public getCameraState(): WayfindingStudioCamera3d | undefined {
		if (!this.currentFloor) return undefined;
		const offset: THREE.Vector3 = this.camera.position.clone().sub(this.controls.target);
		const distance: number = offset.length();
		const horizontal: number = Math.hypot(offset.x, offset.z);

		return {
			azimuthDegrees: THREE.MathUtils.radToDeg(Math.atan2(offset.x, offset.z)),
			distance,
			pitchDegrees: THREE.MathUtils.radToDeg(Math.atan2(offset.y, horizontal)),
			targetX: this.controls.target.x + this.currentFloor.width / 2,
			targetY: this.controls.target.z + this.currentFloor.height / 2
		};
	}

	public rebuild(project: WayfindingStudioProject, floorId: string, route: WayfindingPoint[] = []): void {
		const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === floorId);

		if (!floor) return;
		const buildKey: string = JSON.stringify({
			assets: project.assets.map((asset): [string, string] => [asset.id, asset.dataUrl]),
			defaults: wayfindingStudioProjectDefaults(project),
			elements: floor.elements,
			floorId,
			route
		});
		if (buildKey === this.lastBuildKey) {
			this.selectElement(this.selectedElementId);
			this.render();
			return;
		}
		const sameFloorCamera: WayfindingStudioCamera3d | undefined = this.currentFloor?.id === floor.id
			? this.getCameraState()
			: undefined;
		this.currentProject = project;
		this.currentFloor = floor;
		this.disposeSceneContent();
		this.host.dataset.renderedMediaCount = '0';
		this.host.dataset.readyMediaCount = '0';
		this.addFloorPlane(project, floor);
		for (const element of floor.elements) this.addElement(project, floor, element);
		this.addRoute(project, floor, route);
		const maximumDimension: number = Math.max(floor.width, floor.height);
		this.camera.near = Math.max(0.1, maximumDimension / 5_000);
		this.camera.far = maximumDimension * 12;
		this.controls.minDistance = maximumDimension * 0.18;
		this.controls.maxDistance = maximumDimension * 4;
		this.camera.updateProjectionMatrix();
		this.applyCameraState(sameFloorCamera ?? floor.camera3d ?? {
			azimuthDegrees: 36,
			distance: maximumDimension * 1.75,
			pitchDegrees: 48,
			targetX: floor.width / 2,
			targetY: floor.height / 2
		});
		this.lastBuildKey = buildKey;
		this.host.dataset.sceneBuilds = String(Number(this.host.dataset.sceneBuilds ?? 0) + 1);
		this.host.dataset.mediaCount = String(floor.elements.filter((element): boolean => element.type === 'icon' || element.type === 'logo').length);
		this.selectElement(this.selectedElementId);
		this.render();
	}

	public resetCamera(): void {
		if (!this.currentFloor) return;
		const maximumDimension: number = Math.max(this.currentFloor.width, this.currentFloor.height);
		this.applyCameraState(this.currentFloor.camera3d ?? {
			azimuthDegrees: 36,
			distance: maximumDimension * 1.75,
			pitchDegrees: 48,
			targetX: this.currentFloor.width / 2,
			targetY: this.currentFloor.height / 2
		});
	}

	public selectElement(elementId?: string): void {
		this.selectedElementId = elementId;
		for (const object of this.selectableObjects) {
			const mesh: THREE.Mesh | undefined = object instanceof THREE.Mesh ? object : undefined;
			const material: THREE.Material | THREE.Material[] | undefined = mesh?.material;

			for (const candidate of Array.isArray(material) ? material : material ? [material] : []) {
				if (candidate instanceof THREE.MeshStandardMaterial) {
					candidate.emissive.setHex(object.userData.elementId === elementId ? 0x4f3b00 : 0x000000);
					candidate.emissiveIntensity = object.userData.elementId === elementId ? 0.85 : 0;
				}
			}
		}
	}

	public setVisible(visible: boolean): void {
		this.visible = visible;
		this.host.hidden = !visible;

		if (visible) {
			this.resize();
			this.startRendering();
		} else if (this.frameId !== undefined) {
			window.cancelAnimationFrame(this.frameId);
			this.frameId = undefined;
		}
	}

	private addElement(project: WayfindingStudioProject, floor: WayfindingStudioFloor, element: WayfindingStudioElement): void {
		if ('geometry' in element) this.addPolygon(project, floor, element);
		else if (element.type === 'label') this.addLabel(project, floor, element);
		else if (element.type === 'icon' || element.type === 'logo') this.addMedia(project, floor, element);
		else if (element.type === 'origin') this.addOrigin(project, floor, element);
	}

	private addFloorPlane(project: WayfindingStudioProject, floor: WayfindingStudioFloor): void {
		const background: WayfindingStudioAsset | undefined = project.assets.find((asset): boolean => asset.id === floor.backgroundAssetId);
		const geometry = new THREE.PlaneGeometry(floor.width, floor.height);
		const material = new THREE.MeshStandardMaterial({
			color: background ? '#ffffff' : '#e7ece9',
			map: background ? new THREE.TextureLoader().load(background.dataUrl, (texture): void => {
				texture.colorSpace = THREE.SRGBColorSpace;
				this.render();
			}) : undefined,
			roughness: 0.94,
			side: THREE.DoubleSide
		});
		const plane = new THREE.Mesh(geometry, material);
		plane.receiveShadow = true;
		plane.rotation.x = -Math.PI / 2;
		plane.position.y = -0.8;
		this.addDisposable(plane);
		this.scene.add(plane);
	}

	private addLabel(project: WayfindingStudioProject, floor: WayfindingStudioFloor, label: WayfindingStudioLabelElement): void {
		const defaults: WayfindingStudioProjectDefaults = wayfindingStudioProjectDefaults(project);
		const { height, texture, width } = createTextTexture(label, defaults);
		const material = new THREE.SpriteMaterial({ depthTest: false, map: texture, transparent: true });
		const sprite = new THREE.Sprite(material);
		const worldHeight: number = Math.max(12, label.fontSize ?? defaults.label.fontSize) * 1.45;
		sprite.scale.set(worldHeight * width / height, worldHeight, 1);
		sprite.position.copy(centeredPoint(floor, label.point, labelElevation(floor, floor.elements, label.point, defaults)));
		sprite.userData.elementId = label.id;
		sprite.renderOrder = 20;
		this.selectableObjects.push(sprite);
		this.addDisposable(sprite);
		this.scene.add(sprite);
	}

	private addMedia(project: WayfindingStudioProject, floor: WayfindingStudioFloor, media: WayfindingStudioMediaElement): void {
		const asset: WayfindingStudioAsset | undefined = project.assets.find((candidate): boolean => candidate.id === media.assetId);

		if (!asset) return;
		const textureCanvas: HTMLCanvasElement = document.createElement('canvas');
		textureCanvas.width = Math.max(1, asset.naturalWidth ?? Math.round(media.width));
		textureCanvas.height = Math.max(1, asset.naturalHeight ?? Math.round(media.height));
		const texture = new THREE.CanvasTexture(textureCanvas);
		const image = new Image();
		image.addEventListener('load', (): void => {
			const context: CanvasRenderingContext2D | null = textureCanvas.getContext('2d');
			context?.clearRect(0, 0, textureCanvas.width, textureCanvas.height);
			context?.drawImage(image, 0, 0, textureCanvas.width, textureCanvas.height);
			texture.needsUpdate = true;
			this.host.dataset.readyMediaCount = String(Number(this.host.dataset.readyMediaCount ?? 0) + 1);
			this.render();
		});
		image.src = asset.dataUrl;
		texture.colorSpace = THREE.SRGBColorSpace;
		const material = new THREE.MeshBasicMaterial({
			depthTest: false,
			map: texture,
			side: THREE.DoubleSide,
			transparent: true
		});
		const geometry = new THREE.PlaneGeometry(media.width, media.height);
		const plane = new THREE.Mesh(geometry, material);
		const center = { x: media.point.x + media.width / 2, y: media.point.y + media.height / 2 };
		plane.position.copy(centeredPoint(floor, center, labelElevation(floor, floor.elements, center, wayfindingStudioProjectDefaults(project))));
		plane.rotation.x = -Math.PI / 2;
		plane.userData.elementId = media.id;
		plane.renderOrder = 19;
		this.selectableObjects.push(plane);
		this.addDisposable(plane);
		this.scene.add(plane);
		this.host.dataset.renderedMediaCount = String(Number(this.host.dataset.renderedMediaCount ?? 0) + 1);
	}

	private addOrigin(project: WayfindingStudioProject, floor: WayfindingStudioFloor, origin: WayfindingStudioOriginElement): void {
		const defaults: WayfindingStudioProjectDefaults = wayfindingStudioProjectDefaults(project);
		const size: number = Math.max(12, Math.min(floor.width, floor.height) * 0.024);
		const baseY: number = labelElevation(floor, floor.elements, origin.point, defaults) + size * 0.28;
		const group = new THREE.Group();
		const baseMaterial = new THREE.MeshStandardMaterial({
			color: defaults.origin.color,
			emissive: new THREE.Color(defaults.origin.color).multiplyScalar(0.32),
			emissiveIntensity: 0.7,
			roughness: 0.5
		});
		const base = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.34, size * 0.42, size * 0.28, 28), baseMaterial);
		base.castShadow = true;
		const halo = new THREE.Mesh(
			new THREE.TorusGeometry(size * 0.62, Math.max(1.4, size * 0.08), 10, 36),
			new THREE.MeshBasicMaterial({ color: defaults.origin.color, depthTest: false, transparent: true, opacity: 0.82 })
		);
		halo.rotation.x = Math.PI / 2;
		halo.position.y = -size * 0.12;
		group.add(base, halo);
		group.position.copy(centeredPoint(floor, origin.point, baseY));
		group.userData.elementId = origin.id;
		group.renderOrder = 32;
		this.selectableObjects.push(base);
		base.userData.elementId = origin.id;
		this.addDisposable(group);
		this.scene.add(group);
		this.originAnimations.push({
			baseY,
			group,
			kind: defaults.origin.animation3d,
			phase: Math.random() * Math.PI * 2,
			speed: Math.max(1, defaults.origin.animationSpeed)
		});
		this.host.setAttribute('data-origin-animation-3d', defaults.origin.animation3d);
	}

	private addPolygon(project: WayfindingStudioProject, floor: WayfindingStudioFloor, polygon: WayfindingStudioPolygonElement): void {
		const shape = new THREE.Shape();

		for (const [index, point] of polygon.geometry.entries()) {
			const x: number = point.x - floor.width / 2;
			const y: number = floor.height / 2 - point.y;

			if (index === 0) shape.moveTo(x, y);
			else shape.lineTo(x, y);
		}

		shape.closePath();
		const defaults: WayfindingStudioProjectDefaults = wayfindingStudioProjectDefaults(project);
		const height: number = polygonHeight(floor, polygon, defaults);
		const opacity: number = polygonOpacity(polygon, defaults);
		const topColor = new THREE.Color(polygonColor(polygon, defaults));
		const sideColor = topColor.clone().multiplyScalar(0.72);
		const layerOrder: number = POLYGON_LAYER_ORDER[polygon.type];
		const materialOptions = {
			depthWrite: opacity >= 0.999,
			opacity,
			polygonOffset: true,
			polygonOffsetFactor: -layerOrder,
			polygonOffsetUnits: -layerOrder,
			transparent: opacity < 1
		};
		const materials = [
			new THREE.MeshStandardMaterial({ ...materialOptions, color: sideColor, roughness: 0.82 }),
			new THREE.MeshStandardMaterial({ ...materialOptions, color: topColor, roughness: 0.76 })
		];
		const geometry: THREE.BufferGeometry = height > 0.01
			? new THREE.ExtrudeGeometry(shape, { bevelEnabled: false, depth: height, steps: 1 })
			: new THREE.ShapeGeometry(shape);
		const mesh = new THREE.Mesh(geometry, materials);
		mesh.castShadow = height > 0.01;
		mesh.receiveShadow = true;
		mesh.rotation.x = -Math.PI / 2;
		mesh.position.y = height > 0.01 ? layerOrder * 0.025 : layerOrder * 0.16;
		mesh.renderOrder = layerOrder;
		mesh.userData.elementId = polygon.id;
		this.selectableObjects.push(mesh);
		this.addDisposable(mesh);
		this.scene.add(mesh);
	}

	private addRoute(project: WayfindingStudioProject, floor: WayfindingStudioFloor, points: WayfindingPoint[]): void {
		if (points.length < 2) {
			delete this.host.dataset.routeAnimation;
			delete this.host.dataset.routeProgress;
			delete this.host.dataset.routeWidth;
			delete this.host.dataset.routeElevation;
			delete this.host.dataset.floorPeak;
			return;
		}
		const defaults: WayfindingStudioProjectDefaults = wayfindingStudioProjectDefaults(project);
		// A walking route stays on the pedestrian plane. Using label elevation would lift it onto
		// the extruded top face of any room polygon it crosses, which is not a walkable surface.
		const vectors: THREE.Vector3[] = points.map((point): THREE.Vector3 => centeredPoint(
			floor,
			point,
			groundClearance(floor)
		));
		const curve = new THREE.CurvePath<THREE.Vector3>();
		for (let index = 1; index < vectors.length; index += 1) {
			curve.add(new THREE.LineCurve3(vectors[index - 1], vectors[index]));
		}
		const radius: number = Math.max(1.5, defaults.route.lineWidth / 2);
		const geometry = new THREE.TubeGeometry(curve, Math.max(24, points.length * 8), radius, 8, false);
		const material = new THREE.MeshBasicMaterial({ color: defaults.route.color, depthTest: false });
		const route = new THREE.Mesh(geometry, material);
		route.renderOrder = 30;
		this.addDisposable(route);
		this.scene.add(route);
		this.host.dataset.routeAnimation = defaults.route.animation;
		this.host.dataset.routeWidth = String(defaults.route.lineWidth);
		this.host.dataset.routeElevation = groundClearance(floor).toFixed(3);
		this.host.dataset.floorPeak = floor.elements
			.filter((element): element is WayfindingStudioPolygonElement => 'geometry' in element)
			.reduce((peak: number, polygon): number => Math.max(peak, polygonHeight(floor, polygon, defaults)), 0)
			.toFixed(3);
		const markers: THREE.Mesh[] = [];
		if (defaults.route.animation !== 'none') {
			const markerGeometry = new THREE.SphereGeometry(radius * 1.32, 12, 8);
			const markerMaterial = new THREE.MeshBasicMaterial({ color: '#fff7d6', depthTest: false });
			const markerCount: number = defaults.route.animation === 'flow' ? 7 : 1;
			for (let index = 0; index < markerCount; index += 1) {
				const marker = new THREE.Mesh(markerGeometry, markerMaterial);
				marker.renderOrder = 31;
				markers.push(marker);
				this.addDisposable(marker);
				this.scene.add(marker);
			}
			this.routeAnimation = {
				curve,
				kind: defaults.route.animation,
				markers,
				speed: Math.max(1, defaults.route.animationSpeed),
				startedAt: performance.now()
			};
		}
		else delete this.host.dataset.routeProgress;
	}

	private addDisposable(object: THREE.Object3D): void {
		this.disposableObjects.push(object);
	}

	private disposeSceneContent(): void {
		this.routeAnimation = undefined;
		this.originAnimations.length = 0;
		for (const object of this.disposableObjects) {
			object.removeFromParent();
			object.traverse((child): void => {
				const mesh = child as THREE.Mesh;

				// Sprites share an internal geometry. Disposing it during a scene rebuild
				// makes subsequently recreated labels, icons, and logos disappear.
				if (child instanceof THREE.Mesh && mesh.geometry) mesh.geometry.dispose();
				const material: THREE.Material | THREE.Material[] | undefined = mesh.material;
				for (const candidate of Array.isArray(material) ? material : material ? [material] : []) {
					for (const value of Object.values(candidate)) if (value instanceof THREE.Texture) value.dispose();
					candidate.dispose();
				}
			});
		}

		this.disposableObjects.length = 0;
		this.selectableObjects.length = 0;
	}

	private pick(event: PointerEvent): void {
		const bounds: DOMRect = this.renderer.domElement.getBoundingClientRect();
		const pointer = new THREE.Vector2(
			(event.clientX - bounds.left) / bounds.width * 2 - 1,
			-(event.clientY - bounds.top) / bounds.height * 2 + 1
		);
		this.raycaster.setFromCamera(pointer, this.camera);
		const hit: THREE.Intersection | undefined = this.raycaster.intersectObjects(this.selectableObjects, false)[0];
		const elementId: string | undefined = hit?.object.userData.elementId as string | undefined;

		if (elementId) this.options.onSelectElement(elementId);
	}

	private render(): void {
		this.renderer.render(this.scene, this.camera);
	}

	private resize(): void {
		const width: number = Math.max(1, this.host.clientWidth);
		const height: number = Math.max(1, this.host.clientHeight);
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.render();
	}

	private startRendering(): void {
		if (this.frameId !== undefined) return;
		const frame = (): void => {
			if (!this.visible) {
				this.frameId = undefined;

				return;
			}

			this.controls.update();
			this.updateOriginAnimations(performance.now());
			this.updateRouteAnimation(performance.now());
			this.render();
			this.frameId = window.requestAnimationFrame(frame);
		};
		this.frameId = window.requestAnimationFrame(frame);
	}

	private updateOriginAnimations(now: number): void {
		for (const animation of this.originAnimations) {
			const phase: number = now * animation.speed / 24_000 + animation.phase;
			if (animation.kind === 'bounce') {
				animation.group.position.y = animation.baseY + Math.abs(Math.sin(phase)) * 18;
				animation.group.scale.setScalar(1);
			} else if (animation.kind === 'pulse') {
				animation.group.position.y = animation.baseY;
				animation.group.scale.setScalar(0.9 + (Math.sin(phase) + 1) * 0.16);
			} else {
				animation.group.position.y = animation.baseY;
				animation.group.scale.setScalar(1);
			}
		}
	}

	private updateRouteAnimation(now: number): void {
		const animation = this.routeAnimation;
		if (!animation) return;
		const elapsed: number = Math.max(0, now - animation.startedAt) / 1_000;
		if (animation.kind === 'pulse') {
			const scale: number = 0.82 + (Math.sin(elapsed * animation.speed / 8) + 1) * 0.28;
			animation.markers[0].scale.setScalar(scale);
			animation.markers[0].position.copy(animation.curve.getPointAt(0.98));
			this.host.dataset.routeProgress = scale.toFixed(3);
			return;
		}
		const progress: number = elapsed * animation.speed / 1_200;
		this.host.dataset.routeProgress = (progress % 1).toFixed(3);
		for (const [index, marker] of animation.markers.entries()) {
			const position: number = (progress - index / animation.markers.length + 10) % 1;
			marker.position.copy(animation.curve.getPointAt(position));
		}
	}
}
