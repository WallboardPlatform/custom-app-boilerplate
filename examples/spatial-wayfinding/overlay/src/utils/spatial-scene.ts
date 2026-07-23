import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import type { WayfindingPoint } from '@utils/wayfinding';
import { routeLength, routePositionAt } from '@utils/wayfinding-route-presentation';
import type {
	RuntimeElement,
	RuntimeFloor,
	RuntimeLabel,
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
	const canvas: HTMLCanvasElement = document.createElement('canvas');
	const context: CanvasRenderingContext2D = canvas.getContext('2d')!;
	context.font = `${label.fontWeight ?? 700} ${fontSize}px Arial, sans-serif`;
	canvas.width = Math.ceil(context.measureText(label.text).width + padding * 2);
	canvas.height = Math.ceil(fontSize * 1.5 + padding * 2);
	const drawingContext: CanvasRenderingContext2D = canvas.getContext('2d')!;
	drawingContext.font = `${label.fontWeight ?? 700} ${fontSize}px Arial, sans-serif`;
	drawingContext.textAlign = 'center';
	drawingContext.textBaseline = 'middle';
	drawingContext.lineJoin = 'round';
	drawingContext.strokeStyle = 'rgba(255,255,255,0.92)';
	drawingContext.lineWidth = Math.max(3, fontSize * 0.16);
	drawingContext.strokeText(label.text, canvas.width / 2, canvas.height / 2);
	drawingContext.fillStyle = label.color ?? '#15302b';
	drawingContext.fillText(label.text, canvas.width / 2, canvas.height / 2);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;

	return { height: canvas.height, texture, width: canvas.width };
};

export interface SpatialSceneOptions {
	accentColor: () => string;
	motionEnabled: () => boolean;
	onSelectDestination: (destinationId: string) => void;
}

export class SpatialScene {
	private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20_000);
	private readonly controls: OrbitControls;
	private readonly destinationMeshes = new Map<string, THREE.Mesh>();
	private frameId?: number;
	private readonly originPulse = new THREE.Group();
	private pointerStart?: { x: number; y: number };
	private readonly raycaster = new THREE.Raycaster();
	private readonly renderer: THREE.WebGLRenderer;
	private readonly resizeObserver: ResizeObserver;
	private routeObject?: THREE.Object3D;
	private readonly routeFlowMarkers: THREE.Mesh[] = [];
	private routeFlowPoints: WayfindingPoint[] = [];
	private routeFlowStartedAt = 0;
	private readonly scene = new THREE.Scene();
	private readonly selectable: THREE.Object3D[] = [];
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
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

		for (const [id, mesh] of this.destinationMeshes) {
			const materials: THREE.Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

			for (const material of materials) {
				if (!(material instanceof THREE.MeshStandardMaterial)) continue;
				material.emissive.set(id === destinationId ? this.options.accentColor() : '#000000');
				material.emissiveIntensity = id === destinationId ? 0.28 : 0;
			}
		}
	}

	public setRoute(points: WayfindingPoint[]): void {
		if (this.routeObject) this.disposeObject(this.routeObject);
		this.routeObject = undefined;
		this.routeFlowMarkers.length = 0;
		this.routeFlowPoints = [];

		if (points.length < 2) return;
		this.routeFlowPoints = points.map((point: WayfindingPoint): WayfindingPoint => ({ ...point }));
		this.routeFlowStartedAt = performance.now();
		const routePoints: THREE.Vector3[] = points.map((point: WayfindingPoint): THREE.Vector3 => centeredPoint(this.floor, point, 10));
		const material = new THREE.MeshStandardMaterial({ color: this.options.accentColor(), emissive: this.options.accentColor(), emissiveIntensity: 0.3, roughness: 0.45 });
		const route = new THREE.Group();
		const up = new THREE.Vector3(0, 1, 0);

		for (let index = 1; index < routePoints.length; index += 1) {
			const start: THREE.Vector3 = routePoints[index - 1];
			const end: THREE.Vector3 = routePoints[index];
			const direction = new THREE.Vector3().subVectors(end, start);
			const length: number = direction.length();

			if (length === 0) continue;
			const segment = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, length, 10), material);
			segment.position.copy(start).add(end).multiplyScalar(0.5);
			segment.quaternion.setFromUnitVectors(up, direction.normalize());
			segment.castShadow = true;
			segment.renderOrder = 12;
			route.add(segment);
		}

		for (const point of routePoints) {
			const joint = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 8), material);
			joint.position.copy(point);
			joint.castShadow = true;
			joint.renderOrder = 12;
			route.add(joint);
		}
		const flowMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false });
		for (let index = 0; index < 4; index += 1) {
			const marker = new THREE.Mesh(new THREE.SphereGeometry(8, 14, 10), flowMaterial);
			marker.renderOrder = 18;
			this.routeFlowMarkers.push(marker);
			route.add(marker);
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
		const base = new THREE.Mesh(
			new THREE.PlaneGeometry(this.floor.width + 80, this.floor.height + 80),
			new THREE.MeshStandardMaterial({ color: '#f3f0e7', roughness: 0.96 })
		);
		base.rotation.x = -Math.PI / 2;
		base.position.y = -1;
		base.receiveShadow = true;
		this.scene.add(base);

		for (const element of this.floor.elements) this.addElement(element);
	}

	private addElement(element: RuntimeElement): void {
		if ('geometry' in element) {
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
				this.destinationMeshes.set(element.destinationId, mesh);
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
			sprite.scale.set(worldHeight * width / height, worldHeight, 1);
			sprite.position.copy(centeredPoint(this.floor, element.point, labelElevation(this.floor, element.point)));
			sprite.renderOrder = 20;
			this.scene.add(sprite);

			return;
		}
		const marker = new THREE.Mesh(
			new THREE.CylinderGeometry(13, 13, 8, 24),
			new THREE.MeshStandardMaterial({ color: '#0f8f78', emissive: '#0f8f78', emissiveIntensity: 0.35 })
		);
		marker.position.copy(centeredPoint(this.floor, element.point, 8));
		this.originPulse.position.copy(centeredPoint(this.floor, element.point, 3));
		const ring = new THREE.Mesh(
			new THREE.RingGeometry(18, 24, 32),
			new THREE.MeshBasicMaterial({ color: '#0f8f78', side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
		);
		ring.rotation.x = -Math.PI / 2;
		this.originPulse.add(ring);
		this.scene.add(marker, this.originPulse);
	}

	private animate(): void {
		const frame = (time: number): void => {
			this.controls.update();
			const motionEnabled: boolean = this.options.motionEnabled();
			const pulse: number = motionEnabled ? 1 + Math.sin(time / 360) * 0.18 : 1;
			this.originPulse.scale.set(pulse, pulse, pulse);
			const flowLength: number = routeLength(this.routeFlowPoints);
			for (const [index, marker] of this.routeFlowMarkers.entries()) {
				const rawDistance: number = (time - this.routeFlowStartedAt) * 0.09 - index * 52;
				const distance: number = flowLength > 0 ? ((rawDistance % flowLength) + flowLength) % flowLength : 0;
				const position = routePositionAt(this.routeFlowPoints, distance);
				marker.visible = motionEnabled && Boolean(position);
				if (position) marker.position.copy(centeredPoint(this.floor, position.point, 17));
			}
			this.renderer.render(this.scene, this.camera);
			this.frameId = requestAnimationFrame(frame);
		};
		this.frameId = requestAnimationFrame(frame);
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
