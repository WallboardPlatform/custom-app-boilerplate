import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { WayfindingPoint } from '@utils/wayfinding';
import type {
	RuntimeAsset,
	RuntimeElement,
	RuntimeFloor,
	RuntimeLabel,
	RuntimeMedia,
	RuntimeOrigin,
	RuntimePointOfInterest,
	RuntimeProjectDefaults,
	RuntimePolygon
} from '@interfaces/spatial-wayfinding.interface';

const pointInPolygon = (point: WayfindingPoint, polygon: WayfindingPoint[]): boolean => {
	let inside = false;

	for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left, left += 1) {
		const a: WayfindingPoint = polygon[left];
		const b: WayfindingPoint = polygon[right];

		if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
	}

	return inside;
};

const centeredPoint = (floor: RuntimeFloor, point: WayfindingPoint, elevation = 0): THREE.Vector3 => new THREE.Vector3(
	point.x - floor.width / 2,
	elevation,
	point.y - floor.height / 2
);

const polygonHeight = (floor: RuntimeFloor, polygon: RuntimePolygon): number => Math.min(floor.width, floor.height)
	* (polygon.presentation?.extrusionHeight ?? (polygon.type === 'location' ? 28 : 0))
	/ 500;

const labelElevation = (floor: RuntimeFloor, point: WayfindingPoint): number => {
	const polygon: RuntimePolygon | undefined = floor.elements
		.filter((element): element is RuntimePolygon => 'geometry' in element)
		.reverse()
		.find((element: RuntimePolygon): boolean => pointInPolygon(point, element.geometry));

	return (polygon ? polygonHeight(floor, polygon) : 0) + Math.min(floor.width, floor.height) * 0.025;
};

const createTextTexture = (label: RuntimeLabel): { height: number; texture: THREE.CanvasTexture; width: number } => {
	const fontSize: number = Math.max(18, label.fontSize ?? 28);
	const padding: number = Math.ceil(fontSize * 0.65);
	const fontFamily: string = label.fontFamily === 'serif'
		? 'Georgia, serif'
		: label.fontFamily === 'monospace'
			? '"Courier New", monospace'
			: 'Arial, sans-serif';
	const canvas: HTMLCanvasElement = document.createElement('canvas');
	const context: CanvasRenderingContext2D = canvas.getContext('2d')!;
	context.font = `${label.fontWeight ?? 700} ${fontSize}px ${fontFamily}`;
	canvas.width = Math.ceil(context.measureText(label.text).width + padding * 2);
	canvas.height = Math.ceil(fontSize * 1.5 + padding * 2);
	const drawingContext: CanvasRenderingContext2D = canvas.getContext('2d')!;
	drawingContext.font = `${label.fontWeight ?? 700} ${fontSize}px ${fontFamily}`;
	drawingContext.textAlign = 'center';
	drawingContext.textBaseline = 'middle';
	drawingContext.lineJoin = 'round';
	drawingContext.strokeStyle = label.outlineColor ?? 'rgba(255,255,255,0.92)';
	drawingContext.lineWidth = label.outlineWidth ?? Math.max(3, fontSize * 0.16);
	drawingContext.strokeText(label.text, canvas.width / 2, canvas.height / 2);
	drawingContext.fillStyle = label.color ?? '#15302b';
	drawingContext.fillText(label.text, canvas.width / 2, canvas.height / 2);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;

	return { height: canvas.height, texture, width: canvas.width };
};

const createImageTexture = (
	asset: RuntimeAsset,
	onReady?: () => void
): THREE.CanvasTexture => {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, asset.naturalWidth ?? 1);
	canvas.height = Math.max(1, asset.naturalHeight ?? 1);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	const image = new Image();
	image.addEventListener('load', (): void => {
		const context = canvas.getContext('2d');
		context?.clearRect(0, 0, canvas.width, canvas.height);
		context?.drawImage(image, 0, 0, canvas.width, canvas.height);
		texture.needsUpdate = true;
		onReady?.();
	}, { once: true });
	image.src = asset.dataUrl;

	return texture;
};

const markerDimensions = (asset: RuntimeAsset, maximumSide: number): { height: number; width: number } => {
	const ratio: number = Math.max(
		0.2,
		Math.min(5, (asset.naturalWidth ?? 1) / Math.max(1, asset.naturalHeight ?? 1))
	);

	return ratio >= 1
		? { height: maximumSide / ratio, width: maximumSide }
		: { height: maximumSide, width: maximumSide * ratio };
};

export interface SpatialSceneOptions {
	accentColor: () => string;
	assets: RuntimeAsset[];
	motionEnabled: () => boolean;
	onSelectDestination: (destinationId: string) => void;
	originDefaults: RuntimeProjectDefaults['origin'];
	routeAnimationSpeed: () => number;
	routeColor: () => string;
	routeWidth: () => number;
}

export class SpatialScene {
	private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20_000);
	private readonly controls: OrbitControls;
	private readonly destinationObjects = new Map<string, THREE.Object3D[]>();
	private frameId?: number;
	private readonly originMarkers: THREE.Object3D[] = [];
	private readonly originPulses: THREE.Group[] = [];
	private pointerStart?: { x: number; y: number };
	private readonly raycaster = new THREE.Raycaster();
	private readonly renderer: THREE.WebGLRenderer;
	private readonly resizeObserver: ResizeObserver;
	private readonly routeFlowMarkers: THREE.Mesh[] = [];
	private routeObject?: THREE.Object3D;
	private routePoints: THREE.Vector3[] = [];
	private readonly routeSegments: Array<{ end: THREE.Vector3; length: number; start: THREE.Vector3 }> = [];
	private routeTotalLength = 0;
	private readonly scene = new THREE.Scene();
	private readonly selectable: THREE.Object3D[] = [];
	private readonly selectedPulse = new THREE.Group();
	private selectedDestinationId?: string;

	public constructor(
		private readonly host: HTMLElement,
		private readonly floor: RuntimeFloor,
		private readonly options: SpatialSceneOptions
	) {
		this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.domElement.className = 'wb-spatial-wayfinding-canvas';
		this.renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional campus map');
		this.host.append(this.renderer.domElement);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
		this.controls.minPolarAngle = THREE.MathUtils.degToRad(18);
		this.controls.screenSpacePanning = false;
		this.scene.add(new THREE.HemisphereLight('#fff8e7', '#39423f', 2.4));
		const key = new THREE.DirectionalLight('#ffffff', 2.8);
		key.castShadow = true;
		key.position.set(-700, 1_100, 550);
		this.scene.add(key);
		const fill = new THREE.DirectionalLight('#d5f1e9', 1.2);
		fill.position.set(650, 500, -600);
		this.scene.add(fill);
		this.scene.add(this.selectedPulse);
		this.addFloor();
		this.resetCamera();
		this.renderer.domElement.addEventListener('pointerdown', (event: PointerEvent): void => {
			this.pointerStart = { x: event.clientX, y: event.clientY };
		});
		this.renderer.domElement.addEventListener('pointerup', (event: PointerEvent): void => {
			if (!this.pointerStart || Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y) > 6) return;
			this.pick(event);
		});
		this.resizeObserver = new ResizeObserver((): void => this.resize());
		this.resizeObserver.observe(this.host);
		this.resize();
		this.animate();
	}

	public dispose(): void {
		if (this.frameId !== undefined) cancelAnimationFrame(this.frameId);
		this.resizeObserver.disconnect();
		this.controls.dispose();
		this.scene.traverse((object: THREE.Object3D): void => {
			const mesh = object as THREE.Mesh;
			mesh.geometry?.dispose();
			const material: THREE.Material | THREE.Material[] | undefined = mesh.material;

			for (const candidate of Array.isArray(material) ? material : material ? [material] : []) {
				for (const value of Object.values(candidate)) if (value instanceof THREE.Texture) value.dispose();
				candidate.dispose();
			}
		});
		this.renderer.dispose();
		this.renderer.domElement.remove();
	}

	public resetCamera(): void {
		const state = this.floor.camera3d ?? {
			azimuthDegrees: 36,
			distance: Math.max(this.floor.width, this.floor.height) * 1.6,
			pitchDegrees: 48,
			targetX: this.floor.width / 2,
			targetY: this.floor.height / 2
		};
		const pitch: number = THREE.MathUtils.degToRad(state.pitchDegrees);
		const azimuth: number = THREE.MathUtils.degToRad(state.azimuthDegrees);
		const horizontal: number = Math.cos(pitch) * state.distance;
		const target: THREE.Vector3 = centeredPoint(this.floor, { x: state.targetX, y: state.targetY });
		this.controls.target.copy(target);
		this.camera.position.set(
			target.x + Math.sin(azimuth) * horizontal,
			Math.sin(pitch) * state.distance,
			target.z + Math.cos(azimuth) * horizontal
		);
		this.camera.lookAt(target);
		this.controls.update();
	}

	public selectDestination(destinationId?: string): void {
		this.selectedDestinationId = destinationId;

		for (const [id, objects] of this.destinationObjects) {
			for (const object of objects) {
				const mesh = object as THREE.Mesh;
				const materials: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];

				for (const material of materials) {
					if (material instanceof THREE.MeshStandardMaterial) {
						material.emissive.set(id === destinationId ? this.options.accentColor() : '#000000');
						material.emissiveIntensity = id === destinationId ? 0.34 : 0;
					}

					if (material instanceof THREE.SpriteMaterial) material.opacity = id === destinationId ? 1 : 0.9;
				}
				const baseY: number = typeof object.userData.baseY === 'number' ? object.userData.baseY : object.position.y;
				object.position.y = id === destinationId ? baseY + 7 : baseY;
				const baseScale: THREE.Vector3 | undefined = object.userData.baseScale as THREE.Vector3 | undefined;

				if (baseScale) object.scale.copy(baseScale).multiplyScalar(id === destinationId ? 1.12 : 1);
			}
		}
		this.selectedPulse.clear();
		const selectedObject: THREE.Object3D | undefined = destinationId ? this.destinationObjects.get(destinationId)?.[0] : undefined;

		if (selectedObject) {
			const ring = new THREE.Mesh(
				new THREE.RingGeometry(19, 25, 40),
				new THREE.MeshBasicMaterial({
					color: this.options.accentColor(),
					depthTest: false,
					opacity: 0.86,
					side: THREE.DoubleSide,
					transparent: true
				})
			);
			ring.rotation.x = -Math.PI / 2;
			this.selectedPulse.position.set(selectedObject.position.x, 5, selectedObject.position.z);
			this.selectedPulse.add(ring);
			this.selectedPulse.visible = true;
		} else {
			this.selectedPulse.visible = false;
		}
	}

	public setRoute(points: WayfindingPoint[]): void {
		if (this.routeObject) this.disposeObject(this.routeObject);
		this.routeObject = undefined;
		this.routeFlowMarkers.length = 0;
		this.routePoints = [];
		this.routeSegments.length = 0;
		this.routeTotalLength = 0;

		if (points.length < 2) return;
		const routePoints: THREE.Vector3[] = points.map((point: WayfindingPoint): THREE.Vector3 => centeredPoint(this.floor, point, 10));
		const routeColor: string = this.options.routeColor();
		const radius: number = Math.max(2, this.options.routeWidth() / 2);
		const material = new THREE.MeshStandardMaterial({ color: routeColor, emissive: routeColor, emissiveIntensity: 0.3, roughness: 0.45 });
		const route = new THREE.Group();
		const up = new THREE.Vector3(0, 1, 0);
		this.routePoints = routePoints;

		for (let index = 1; index < routePoints.length; index += 1) {
			const start: THREE.Vector3 = routePoints[index - 1];
			const end: THREE.Vector3 = routePoints[index];
			const direction = new THREE.Vector3().subVectors(end, start);
			const length: number = direction.length();

			if (length === 0) continue;
			this.routeSegments.push({ end, length, start });
			this.routeTotalLength += length;
			const segment = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
			segment.position.copy(start).add(end).multiplyScalar(0.5);
			segment.quaternion.setFromUnitVectors(up, direction.normalize());
			segment.castShadow = true;
			segment.renderOrder = 12;
			route.add(segment);
		}

		for (const point of routePoints) {
			const joint = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.16, 12, 8), material);
			joint.position.copy(point);
			joint.castShadow = true;
			joint.renderOrder = 12;
			route.add(joint);
		}
		const flowMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false });

		for (let index = 0; index < 4; index += 1) {
			const marker = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.72, 12, 8), flowMaterial);
			marker.renderOrder = 14;
			marker.userData.phase = index / 4;
			route.add(marker);
			this.routeFlowMarkers.push(marker);
		}
		this.routeObject = route;
		this.scene.add(route);
	}

	private disposeObject(object: THREE.Object3D): void {
		object.removeFromParent();
		const materials = new Set<THREE.Material>();
		object.traverse((candidate: THREE.Object3D): void => {
			const mesh = candidate as THREE.Mesh;
			mesh.geometry?.dispose();
			const material: THREE.Material | THREE.Material[] | undefined = mesh.material;

			for (const entry of Array.isArray(material) ? material : material ? [material] : []) materials.add(entry);
		});

		for (const material of materials) material.dispose();
	}

	private addFloor(): void {
		const backgroundAsset: RuntimeAsset | undefined = this.options.assets.find((asset): boolean => asset.id === this.floor.backgroundAssetId);
		const baseMaterial = new THREE.MeshStandardMaterial({ color: '#f3f0e7', roughness: 0.96 });

		if (backgroundAsset) {
			baseMaterial.color.set('#ffffff');
			baseMaterial.map = createImageTexture(backgroundAsset);
		}
		const base = new THREE.Mesh(
			new THREE.PlaneGeometry(this.floor.width + 80, this.floor.height + 80),
			baseMaterial
		);
		base.rotation.x = -Math.PI / 2;
		base.position.y = -1;
		base.receiveShadow = true;
		this.scene.add(base);

		for (const element of this.floor.elements) this.addElement(element);
	}

	private addElement(element: RuntimeElement): void {
		if (element.type === 'location' || element.type === 'obstacle' || element.type === 'walkable') {
			const shape = new THREE.Shape();

			for (const [index, point] of element.geometry.entries()) {
				const x: number = point.x - this.floor.width / 2;
				const y: number = this.floor.height / 2 - point.y;

				if (index === 0) shape.moveTo(x, y);
				else shape.lineTo(x, y);
			}
			shape.closePath();
			const height: number = polygonHeight(this.floor, element);
			const opacity: number = element.presentation?.fillOpacity ?? 0.75;
			const color = new THREE.Color(element.presentation?.fillColor ?? '#7ec8b5');
			const materials = [
				new THREE.MeshStandardMaterial({ color: color.clone().multiplyScalar(0.72), opacity, roughness: 0.86, transparent: opacity < 1 }),
				new THREE.MeshStandardMaterial({ color, opacity, roughness: 0.76, transparent: opacity < 1 })
			];
			const geometry: THREE.BufferGeometry = height > 0
				? new THREE.ExtrudeGeometry(shape, { bevelEnabled: true, bevelSize: 2.5, bevelThickness: 2.5, depth: height, steps: 1 })
				: new THREE.ShapeGeometry(shape);
			const mesh = new THREE.Mesh(geometry, materials);
			mesh.rotation.x = -Math.PI / 2;
			mesh.position.y = height > 0 ? 0 : 0.3;
			mesh.castShadow = height > 0;
			mesh.receiveShadow = true;

			if (element.destinationId) {
				mesh.userData.destinationId = element.destinationId;
				mesh.userData.baseY = mesh.position.y;
				this.registerDestinationObject(element.destinationId, mesh);
				this.selectable.push(mesh);
			}
			this.scene.add(mesh);

			return;
		}

		if (element.type === 'label') {
			const { height, texture, width } = createTextTexture(element);
			const material = new THREE.SpriteMaterial({ depthTest: false, map: texture, transparent: true });
			const sprite = new THREE.Sprite(material);
			const worldHeight: number = Math.max(18, element.fontSize ?? 28) * 1.9;
			sprite.scale.set(Math.min(worldHeight * width / height, element.maxWidth ?? Number.POSITIVE_INFINITY), worldHeight, 1);
			sprite.position.copy(centeredPoint(this.floor, element.point, labelElevation(this.floor, element.point)));
			sprite.renderOrder = 20;
			this.scene.add(sprite);

			return;
		}

		if (element.type === 'origin') {
			this.addOrigin(element);

			return;
		}

		if (element.type === 'poi') {
			this.addPointOfInterest(element);

			return;
		}

		if (element.type === 'icon' || element.type === 'logo') {
			this.addMedia(element);
		}
	}

	private addMedia(element: RuntimeMedia): void {
		const asset: RuntimeAsset | undefined = this.options.assets.find((candidate): boolean => candidate.id === element.assetId);

		if (!asset) return;
		const texture = createImageTexture(asset);
		const material = new THREE.SpriteMaterial({ depthTest: false, map: texture, transparent: true });
		const sprite = new THREE.Sprite(material);
		const assetRatio: number = asset.naturalWidth && asset.naturalHeight ? asset.naturalWidth / asset.naturalHeight : element.width / element.height;
		const width: number = element.height * assetRatio;
		sprite.scale.set(width, element.height, 1);
		sprite.position.copy(centeredPoint(this.floor, element.point, labelElevation(this.floor, element.point) + element.height * 0.45));
		sprite.renderOrder = element.type === 'logo' ? 24 : 23;
		sprite.userData.baseY = sprite.position.y;
		sprite.userData.baseScale = sprite.scale.clone();

		if (element.destinationId) {
			sprite.userData.destinationId = element.destinationId;
			this.registerDestinationObject(element.destinationId, sprite);
			this.selectable.push(sprite);
		}
		this.scene.add(sprite);
	}

	private addOrigin(element: RuntimeOrigin): void {
		const defaults = this.options.originDefaults;
		const color: string = defaults.color;
		const markerSize: number = defaults.markerSize3d ?? 46;
		const markerAsset: RuntimeAsset | undefined = defaults.markerAssetId
			? this.options.assets.find(
				(asset): boolean => asset.id === defaults.markerAssetId && asset.kind === 'symbol'
			)
			: undefined;
		let marker: THREE.Object3D;

		if (markerAsset) {
			const dimensions = markerDimensions(markerAsset, markerSize);
			const texture = createImageTexture(markerAsset, (): void => {
				this.renderer.domElement.dataset.originMarkerTexture = 'ready';
			});
			const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
				depthTest: false,
				map: texture,
				transparent: true
			}));
			sprite.scale.set(dimensions.width, dimensions.height, 1);
			sprite.position.copy(centeredPoint(this.floor, element.point, dimensions.height / 2 + 8));
			sprite.renderOrder = 30;
			marker = sprite;
			this.renderer.domElement.setAttribute('data-origin-marker-3d', 'custom-image-replacement');
			this.renderer.domElement.dataset.originMarkerSize3d = markerSize.toString();
		} else {
			const pin = new THREE.Mesh(
				new THREE.CylinderGeometry(13, 13, 8, 24),
				new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35 })
			);
			pin.position.copy(centeredPoint(this.floor, element.point, 8));
			marker = pin;
			this.renderer.domElement.setAttribute('data-origin-marker-3d', 'default');
		}

		marker.userData.baseY = marker.position.y;
		marker.userData.baseScale = marker.scale.clone();
		this.originMarkers.push(marker);
		const pulse = new THREE.Group();
		pulse.position.copy(centeredPoint(this.floor, element.point, 3));
		const ring = new THREE.Mesh(
			new THREE.RingGeometry(Math.max(18, markerSize * 0.42), Math.max(24, markerSize * 0.56), 32),
			new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
		);
		ring.rotation.x = -Math.PI / 2;
		pulse.add(ring);
		this.originPulses.push(pulse);
		this.scene.add(marker, pulse);
	}

	private addPointOfInterest(element: RuntimePointOfInterest): void {
		const color: string = this.options.accentColor();
		const marker = new THREE.Mesh(
			new THREE.CylinderGeometry(11, 11, 7, 24),
			new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.18, roughness: 0.6 })
		);
		marker.position.copy(centeredPoint(this.floor, element.point, 6));
		marker.userData.baseY = marker.position.y;

		if (element.destinationId) {
			marker.userData.destinationId = element.destinationId;
			this.registerDestinationObject(element.destinationId, marker);
			this.selectable.push(marker);
		}

		this.scene.add(marker);
	}

	private registerDestinationObject(destinationId: string, object: THREE.Object3D): void {
		const objects: THREE.Object3D[] = this.destinationObjects.get(destinationId) ?? [];
		objects.push(object);
		this.destinationObjects.set(destinationId, objects);
	}

	private animate(): void {
		const frame = (time: number): void => {
			this.controls.update();
			const animation = this.options.motionEnabled() ? this.options.originDefaults.animation3d : 'none';
			const phase: number = Math.sin(time / Math.max(240, this.options.originDefaults.animationSpeed * 10));
			const pulse: number = animation === 'none' ? 1 : 1 + phase * 0.18;

			for (const originPulse of this.originPulses) originPulse.scale.set(pulse, pulse, pulse);

			for (const originMarker of this.originMarkers) {
				const baseY: number = Number(originMarker.userData.baseY ?? originMarker.position.y);
				const baseScale = originMarker.userData.baseScale as THREE.Vector3;
				originMarker.position.y = baseY + (animation === 'bounce' ? phase * 5 : 0);
				originMarker.scale.copy(baseScale).multiplyScalar(animation === 'pulse' ? 1 + phase * 0.08 : 1);
			}

			this.selectedPulse.scale.set(pulse, pulse, pulse);

			if (this.options.motionEnabled() && this.routeTotalLength > 0) {
				const speed: number = Math.max(0.1, this.options.routeAnimationSpeed());

				for (const marker of this.routeFlowMarkers) {
					marker.visible = true;
					const progress: number = ((time / 1_000 * speed / this.routeTotalLength) + Number(marker.userData.phase ?? 0)) % 1;
					marker.position.copy(this.pointAlongRoute(progress * this.routeTotalLength));
				}
			} else {
				for (const marker of this.routeFlowMarkers) marker.visible = false;
			}
			this.renderer.render(this.scene, this.camera);
			this.frameId = requestAnimationFrame(frame);
		};
		this.frameId = requestAnimationFrame(frame);
	}

	private pointAlongRoute(distance: number): THREE.Vector3 {
		let cursor = Math.max(0, Math.min(this.routeTotalLength, distance));

		for (const segment of this.routeSegments) {
			if (cursor <= segment.length) return segment.start.clone().lerp(segment.end, cursor / segment.length);
			cursor -= segment.length;
		}

		return this.routePoints[this.routePoints.length - 1]?.clone() ?? new THREE.Vector3();
	}

	private pick(event: PointerEvent): void {
		const bounds: DOMRect = this.renderer.domElement.getBoundingClientRect();
		const pointer = new THREE.Vector2(
			(event.clientX - bounds.left) / bounds.width * 2 - 1,
			-(event.clientY - bounds.top) / bounds.height * 2 + 1
		);
		this.raycaster.setFromCamera(pointer, this.camera);
		const hit: THREE.Intersection | undefined = this.raycaster.intersectObjects(this.selectable, false)[0];
		const destinationId: string | undefined = hit?.object.userData.destinationId as string | undefined;

		if (destinationId) this.options.onSelectDestination(destinationId);
	}

	private resize(): void {
		const width: number = Math.max(1, this.host.clientWidth);
		const height: number = Math.max(1, this.host.clientHeight);
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
	}
}
