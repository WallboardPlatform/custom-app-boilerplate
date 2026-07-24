import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { WayfindingPoint } from '../../../src/utils/wayfinding';
import type {
	WayfindingStudioAsset,
	WayfindingStudioCamera3d,
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioLabelElement,
	WayfindingStudioMediaElement,
	WayfindingStudioPolygonElement,
	WayfindingStudioProject
} from '../studio-project.mts';

const POLYGON_DEFAULTS: Record<WayfindingStudioPolygonElement['type'], { color: string; height: number; opacity: number }> = {
	location: { color: '#f4c95d', height: 18, opacity: 0.72 },
	obstacle: { color: '#31403d', height: 24, opacity: 0.76 },
	walkable: { color: '#55bfa7', height: 0, opacity: 0.28 }
};

export const wayfindingPolygonPresentationDefaults = (
	type: WayfindingStudioPolygonElement['type']
): { color: string; height: number; opacity: number } => ({ ...POLYGON_DEFAULTS[type] });

const pointInPolygon = (point: WayfindingPoint, polygon: WayfindingPoint[]): boolean => {
	let inside = false;

	for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left++) {
		const a: WayfindingPoint = polygon[left];
		const b: WayfindingPoint = polygon[right];

		if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
	}

	return inside;
};

const polygonHeight = (floor: WayfindingStudioFloor, polygon: WayfindingStudioPolygonElement): number => {
	const visualHeight: number = polygon.presentation?.extrusionHeight ?? POLYGON_DEFAULTS[polygon.type].height;

	return Math.min(floor.width, floor.height) * visualHeight / 500;
};

const polygonColor = (polygon: WayfindingStudioPolygonElement): string => polygon.presentation?.fillColor ?? POLYGON_DEFAULTS[polygon.type].color;
const polygonOpacity = (polygon: WayfindingStudioPolygonElement): number => polygon.presentation?.fillOpacity ?? POLYGON_DEFAULTS[polygon.type].opacity;
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

const labelElevation = (floor: WayfindingStudioFloor, elements: WayfindingStudioElement[], point: WayfindingPoint): number => {
	const polygon: WayfindingStudioPolygonElement | undefined = elements
		.filter((element): element is WayfindingStudioPolygonElement => 'geometry' in element)
		.reverse()
		.find((element): boolean => pointInPolygon(point, element.geometry));

	return (polygon ? polygonHeight(floor, polygon) : 0) + Math.min(floor.width, floor.height) * 0.018;
};

const createTextTexture = (label: WayfindingStudioLabelElement): { height: number; texture: THREE.CanvasTexture; width: number } => {
	const fontFamily: Record<NonNullable<WayfindingStudioLabelElement['fontFamily']>, string> = {
		monospace: '"Courier New", monospace',
		'sans-serif': 'Arial, sans-serif',
		serif: 'Georgia, serif'
	};
	const fontSize: number = Math.max(12, label.fontSize ?? 24);
	const padding: number = Math.ceil(fontSize * 0.42 + (label.outlineWidth ?? 0) * 2);
	const canvas: HTMLCanvasElement = document.createElement('canvas');
	const context: CanvasRenderingContext2D = canvas.getContext('2d')!;
	context.font = `${label.fontWeight ?? 600} ${fontSize}px ${fontFamily[label.fontFamily ?? 'sans-serif']}`;
	canvas.width = Math.max(8, Math.ceil(context.measureText(label.text || ' ').width + padding * 2));
	canvas.height = Math.max(8, Math.ceil(fontSize * 1.45 + padding * 2));
	const drawingContext: CanvasRenderingContext2D = canvas.getContext('2d')!;
	drawingContext.font = `${label.fontWeight ?? 600} ${fontSize}px ${fontFamily[label.fontFamily ?? 'sans-serif']}`;
	drawingContext.textAlign = 'center';
	drawingContext.textBaseline = 'middle';
	drawingContext.lineJoin = 'round';
	const outlineWidth: number = label.outlineWidth ?? 0;

	if (outlineWidth > 0) {
		drawingContext.strokeStyle = label.outlineColor ?? '#ffffff';
		drawingContext.lineWidth = outlineWidth * 2;
		drawingContext.strokeText(label.text, canvas.width / 2, canvas.height / 2);
	}

	drawingContext.fillStyle = label.color ?? '#17201f';
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
	private pointerStart?: { x: number; y: number };
	private readonly raycaster = new THREE.Raycaster();
	private readonly renderer: THREE.WebGLRenderer;
	private readonly resizeObserver: ResizeObserver;
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
		this.currentProject = project;
		this.currentFloor = floor;
		this.disposeSceneContent();
		this.addFloorPlane(project, floor);
		for (const element of floor.elements) this.addElement(project, floor, element);
		this.addRoute(floor, route);
		const maximumDimension: number = Math.max(floor.width, floor.height);
		this.camera.near = Math.max(0.1, maximumDimension / 5_000);
		this.camera.far = maximumDimension * 12;
		this.controls.minDistance = maximumDimension * 0.18;
		this.controls.maxDistance = maximumDimension * 4;
		this.camera.updateProjectionMatrix();
		this.applyCameraState(floor.camera3d ?? {
			azimuthDegrees: 36,
			distance: maximumDimension * 1.75,
			pitchDegrees: 48,
			targetX: floor.width / 2,
			targetY: floor.height / 2
		});
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
		if ('geometry' in element) this.addPolygon(floor, element);
		else if (element.type === 'label') this.addLabel(floor, element);
		else if (element.type === 'icon' || element.type === 'logo') this.addMedia(project, floor, element);
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

	private addLabel(floor: WayfindingStudioFloor, label: WayfindingStudioLabelElement): void {
		const { height, texture, width } = createTextTexture(label);
		const material = new THREE.SpriteMaterial({ depthTest: false, map: texture, transparent: true });
		const sprite = new THREE.Sprite(material);
		const worldHeight: number = Math.max(12, label.fontSize ?? 24) * 1.45;
		sprite.scale.set(worldHeight * width / height, worldHeight, 1);
		sprite.position.copy(centeredPoint(floor, label.point, labelElevation(floor, floor.elements, label.point)));
		sprite.userData.elementId = label.id;
		sprite.renderOrder = 20;
		this.selectableObjects.push(sprite);
		this.addDisposable(sprite);
		this.scene.add(sprite);
	}

	private addMedia(project: WayfindingStudioProject, floor: WayfindingStudioFloor, media: WayfindingStudioMediaElement): void {
		const asset: WayfindingStudioAsset | undefined = project.assets.find((candidate): boolean => candidate.id === media.assetId);

		if (!asset) return;
		const texture = new THREE.TextureLoader().load(asset.dataUrl, (): void => this.render());
		texture.colorSpace = THREE.SRGBColorSpace;
		const material = new THREE.SpriteMaterial({ depthTest: false, map: texture, transparent: true });
		const sprite = new THREE.Sprite(material);
		const center = { x: media.point.x + media.width / 2, y: media.point.y + media.height / 2 };
		sprite.position.copy(centeredPoint(floor, center, labelElevation(floor, floor.elements, center)));
		sprite.scale.set(media.width, media.height, 1);
		sprite.userData.elementId = media.id;
		sprite.renderOrder = 19;
		this.selectableObjects.push(sprite);
		this.addDisposable(sprite);
		this.scene.add(sprite);
	}

	private addPolygon(floor: WayfindingStudioFloor, polygon: WayfindingStudioPolygonElement): void {
		const shape = new THREE.Shape();

		for (const [index, point] of polygon.geometry.entries()) {
			const x: number = point.x - floor.width / 2;
			const y: number = floor.height / 2 - point.y;

			if (index === 0) shape.moveTo(x, y);
			else shape.lineTo(x, y);
		}

		shape.closePath();
		const height: number = polygonHeight(floor, polygon);
		const opacity: number = polygonOpacity(polygon);
		const topColor = new THREE.Color(polygonColor(polygon));
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

	private addRoute(floor: WayfindingStudioFloor, points: WayfindingPoint[]): void {
		if (points.length < 2) return;
		const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point): THREE.Vector3 => centeredPoint(floor, point, Math.min(floor.width, floor.height) * 0.014)));
		const material = new THREE.LineBasicMaterial({ color: '#f04438', depthTest: false, linewidth: 4 });
		const route = new THREE.Line(geometry, material);
		route.renderOrder = 30;
		this.addDisposable(route);
		this.scene.add(route);
	}

	private addDisposable(object: THREE.Object3D): void {
		this.disposableObjects.push(object);
	}

	private disposeSceneContent(): void {
		for (const object of this.disposableObjects) {
			object.removeFromParent();
			object.traverse((child): void => {
				const mesh = child as THREE.Mesh;

				if (mesh.geometry) mesh.geometry.dispose();
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
			this.render();
			this.frameId = window.requestAnimationFrame(frame);
		};
		this.frameId = window.requestAnimationFrame(frame);
	}
}
