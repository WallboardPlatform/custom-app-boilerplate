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
	WayfindingStudioPointElement,
	WayfindingStudioPolygonElement,
	WayfindingStudioProject,
	WayfindingStudioProjectDefaults,
	WayfindingStudioTransitionElement
} from '../studio-project.mts';
import {
	centeredPoint,
	createTextTexture,
	groundClearance,
	labelElevation,
	POLYGON_LAYER_ORDER,
	polygonColor,
	polygonHeight,
	polygonOpacity,
	scenePresentation,
	type Scene3dPresentation,
	type WayfindingScene3dMode
} from './scene3d-presentation';
import {
	createOriginMarker3d,
	type OriginMarker3d,
	updateOriginMarker3d
} from './scene3d-markers.mts';
import {
	createRoundedRouteCurve,
	positionRouteFlowMarker
} from './scene3d-route.mts';

export interface WayfindingScene3dOptions {
	loadCameraState?: (
		mode: WayfindingScene3dMode,
		projectId: string,
		floorId: string
	) => WayfindingStudioCamera3d | undefined;
	onCameraStateChange?: (
		mode: WayfindingScene3dMode,
		projectId: string,
		floorId: string,
		state: WayfindingStudioCamera3d
	) => void;
	onSelectElement: (elementId: string) => void;
}

export type { WayfindingScene3dMode } from './scene3d-presentation';

export class WayfindingScene3d {
	private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100_000);
	private currentFloor?: WayfindingStudioFloor;
	private currentProject?: WayfindingStudioProject;
	private readonly controls: OrbitControls;
	private readonly destinationLabelSprites: THREE.Sprite[] = [];
	private readonly disposableObjects: THREE.Object3D[] = [];
	private cameraResetFrame?: number;
	private frameId?: number;
	private lastBuildKey?: string;
	private presentationMode: WayfindingScene3dMode = 'editor';
	private readonly originAnimations: Array<{
		baseY: number;
		kind: WayfindingStudioProjectDefaults['origin']['animation3d'];
		marker: OriginMarker3d;
		phase: number;
		speed: number;
	}> = [];
	private pointerStart?: { x: number; y: number };
	private readonly raycaster = new THREE.Raycaster();
	private readonly renderer: THREE.WebGLRenderer;
	private readonly resizeObserver: ResizeObserver;
	private readonly routeObjects: THREE.Object3D[] = [];
	private readonly transientCameraStates = new Map<string, WayfindingStudioCamera3d>();
	private screenOverlayBounds: Array<{
		bottom: number;
		left: number;
		right: number;
		top: number;
	}> = [];
	private routeAnimation?: {
		curve: THREE.Curve<THREE.Vector3>;
		kind: WayfindingStudioProjectDefaults['route']['animation'];
		markers: THREE.Mesh[];
		speed: number;
		startedAt: number;
	};
	private readonly scene = new THREE.Scene();
	private readonly selectableObjects: THREE.Object3D[] = [];
	private selectedPulse?: {
		baseScale: THREE.Vector3;
		object: THREE.Object3D;
	};
	private selectedElementId?: string;
	private readonly reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
	private visible = false;

	public constructor(private readonly host: HTMLElement, private readonly options: WayfindingScene3dOptions) {
		this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
		this.renderer.outputColorSpace = THREE.SRGBColorSpace;
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 0.86;
		this.renderer.setClearColor('#26302e');
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.domElement.setAttribute('aria-label', 'Rotatable 3D map preview');
		this.renderer.domElement.className = 'scene-3d-canvas';
		this.host.append(this.renderer.domElement);
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.08;
		this.controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
		this.controls.minPolarAngle = THREE.MathUtils.degToRad(12);
		this.controls.screenSpacePanning = false;
		this.scene.add(new THREE.HemisphereLight('#f8fbf9', '#253431', 1.18));
		const keyLight = new THREE.DirectionalLight('#fffaf0', 1.55);
		keyLight.castShadow = true;
		keyLight.position.set(-600, 1_200, 500);
		this.scene.add(keyLight);
		const fillLight = new THREE.DirectionalLight('#d7f0eb', 0.58);
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
		const dampingEnabled: boolean = this.controls.enableDamping;

		// Flush any pending OrbitControls drag inertia before applying an exact saved or fitted view.
		this.controls.enableDamping = false;
		this.controls.update();
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
		this.controls.enableDamping = dampingEnabled;
	}

	public dispose(): void {
		if (this.cameraResetFrame !== undefined) window.cancelAnimationFrame(this.cameraResetFrame);

		if (this.frameId !== undefined) window.cancelAnimationFrame(this.frameId);
		this.rememberCurrentCamera();
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

	public rebuild(
		project: WayfindingStudioProject,
		floorId: string,
		route?: WayfindingPoint[],
		presentationMode: WayfindingScene3dMode = 'editor'
	): void {
		const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === floorId);

		if (!floor) return;
		const buildKey: string = JSON.stringify({
			assets: project.assets.map((asset): [string, string] => [asset.id, asset.dataUrl]),
			defaults: wayfindingStudioProjectDefaults(project),
			elements: floor.elements,
			floorId,
			presentationMode
		});

		if (buildKey === this.lastBuildKey) {
			this.currentProject = project;
			this.currentFloor = floor;
			this.presentationMode = presentationMode;
			this.selectElement(this.selectedElementId);

			if (route) this.updateRoute(project, floorId, route);
			this.render();

			return;
		}
		this.rememberCurrentCamera();
		const transientCameraKey = `${project.projectId}:${presentationMode}:${floor.id}`;
		const transientCamera = this.transientCameraStates.get(transientCameraKey)
			?? this.options.loadCameraState?.(presentationMode, project.projectId, floor.id);
		this.currentProject = project;
		this.currentFloor = floor;
		this.presentationMode = presentationMode;
		this.renderer.setClearColor(scenePresentation(floor, presentationMode).background);
		this.renderer.toneMappingExposure = presentationMode === 'visitor' ? 0.98 : 0.86;
		this.disposeSceneContent();
		this.host.dataset.renderedMediaCount = '0';
		this.host.dataset.readyMediaCount = '0';
		this.host.dataset.cameraFacingMediaCount = '0';
		this.host.dataset.labelCount = '0';
		this.host.dataset.destinationLabelCount = '0';
		this.host.dataset.destinationLabelTexts = '[]';
		this.host.dataset.poiCount = '0';
		this.host.dataset.transitionCount = '0';
		this.addFloorPlane(project, floor);

		for (const element of floor.elements) this.addElement(project, floor, element);
		const maximumDimension: number = Math.max(floor.width, floor.height);
		// Keep the depth range tight enough for stable coplanar map rendering on large floor plans.
		this.camera.near = Math.max(0.5, maximumDimension / 1_000);
		this.camera.far = Math.max(10_000, maximumDimension * 8);
		this.controls.minDistance = maximumDimension * 0.18;
		this.controls.maxDistance = maximumDimension * 4;
		this.camera.updateProjectionMatrix();
		this.applyCameraState(transientCamera ?? floor.camera3d ?? this.defaultCameraState(floor));
		this.lastBuildKey = buildKey;
		this.host.dataset.sceneBuilds = String(Number(this.host.dataset.sceneBuilds ?? 0) + 1);
		this.host.dataset.mediaCount = String(floor.elements.filter((element): boolean => element.type === 'icon' || element.type === 'logo').length);
		this.selectElement(this.selectedElementId);
		this.updateRoute(project, floorId, route ?? []);
		this.render();
	}

	private rememberCurrentCamera(): void {
		const cameraState = this.getCameraState();

		if (!cameraState || !this.currentFloor || !this.currentProject) return;
		const key = `${this.currentProject.projectId}:${this.presentationMode}:${this.currentFloor.id}`;

		this.transientCameraStates.set(key, cameraState);
		this.options.onCameraStateChange?.(
			this.presentationMode,
			this.currentProject.projectId,
			this.currentFloor.id,
			cameraState
		);
	}

	public updateRoute(project: WayfindingStudioProject, floorId: string, points: WayfindingPoint[]): void {
		const floor: WayfindingStudioFloor | undefined = project.floors.find((candidate): boolean => candidate.id === floorId);

		if (!floor || this.currentFloor?.id !== floor.id) return;
		this.disposeRoute();
		this.addRoute(project, floor, points);
		this.render();
	}

	public resetCamera(): void {
		if (!this.currentFloor) return;
		const floorId = this.currentFloor.id;
		const state = structuredClone(
			this.currentFloor.camera3d ?? this.defaultCameraState(this.currentFloor)
		);

		if (this.cameraResetFrame !== undefined) window.cancelAnimationFrame(this.cameraResetFrame);
		this.applyCameraState(state);
		// OrbitControls can receive the final drag event in the same frame as a
		// toolbar click. Reapply once after that frame so Reset is exact instead
		// of stopping a fraction of a degree away from the saved view.
		this.cameraResetFrame = window.requestAnimationFrame((): void => {
			this.cameraResetFrame = undefined;

			if (this.currentFloor?.id !== floorId) return;
			this.applyCameraState(state);
			this.render();
		});
	}

	public refreshScreenOverlays(): void {
		this.collectScreenOverlayBounds();
		this.render();
	}

	public selectElement(elementId?: string): void {
		this.selectedElementId = elementId;
		this.selectedPulse = undefined;

		for (const object of this.selectableObjects) {
			const mesh: THREE.Mesh | undefined = object instanceof THREE.Mesh ? object : undefined;
			const material: THREE.Material | THREE.Material[] | undefined = mesh?.material;
			const selected: boolean = object.userData.elementId === elementId;
			const baseScale: THREE.Vector3 = object.userData.baseSelectionScale instanceof THREE.Vector3
				? object.userData.baseSelectionScale
				: object.scale.clone();
			object.userData.baseSelectionScale = baseScale;
			object.scale.copy(baseScale);

			for (const candidate of Array.isArray(material) ? material : material ? [material] : []) {
				if (candidate instanceof THREE.MeshStandardMaterial) {
					const baseEmissive: THREE.Color = candidate.userData.baseSelectionEmissive instanceof THREE.Color
						? candidate.userData.baseSelectionEmissive
						: candidate.emissive.clone();
					const baseEmissiveIntensity: number = typeof candidate.userData.baseSelectionEmissiveIntensity === 'number'
						? candidate.userData.baseSelectionEmissiveIntensity
						: candidate.emissiveIntensity;
					candidate.userData.baseSelectionEmissive = baseEmissive;
					candidate.userData.baseSelectionEmissiveIntensity = baseEmissiveIntensity;
					candidate.emissive.copy(selected ? new THREE.Color('#d8aa3b') : baseEmissive);
					candidate.emissiveIntensity = selected ? Math.max(baseEmissiveIntensity, 0.85) : baseEmissiveIntensity;
				} else if (candidate instanceof THREE.MeshBasicMaterial || candidate instanceof THREE.SpriteMaterial) {
					const baseColor: THREE.Color = candidate.userData.baseSelectionColor instanceof THREE.Color
						? candidate.userData.baseSelectionColor
						: candidate.color.clone();
					candidate.userData.baseSelectionColor = baseColor;
					candidate.color.copy(selected ? new THREE.Color('#fff1b8') : baseColor);
				}
			}

			if (selected && object.userData.selectionPulse === true) {
				this.selectedPulse = { baseScale: baseScale.clone(), object };
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
		else if (element.type === 'poi') this.addPoi(project, floor, element);
		else if (element.type === 'transition') this.addTransition(project, floor, element);
	}

	private defaultCameraState(floor: WayfindingStudioFloor): WayfindingStudioCamera3d {
		const presentation: Scene3dPresentation = scenePresentation(floor, this.presentationMode);
		const viewportAspect: number = Math.max(
			0.5,
			this.host.clientWidth / Math.max(1, this.host.clientHeight)
		);
		const horizontalFitScale: number = Math.max(1, 1.35 / viewportAspect);
		const contentBounds = this.presentationMode === 'visitor' && !floor.backgroundAssetId
			? this.visitorContentBounds(floor)
			: { height: floor.height, width: floor.width, x: floor.width / 2, y: floor.height / 2 };
		const contentScale = Math.max(
			contentBounds.width / floor.width,
			contentBounds.height / floor.height,
			0.34
		);

		return {
			...presentation.camera,
			distance: presentation.camera.distance * contentScale * horizontalFitScale,
			targetX: contentBounds.x,
			targetY: contentBounds.y
		};
	}

	private visitorContentBounds(floor: WayfindingStudioFloor): {
		height: number;
		width: number;
		x: number;
		y: number;
	} {
		const points: WayfindingPoint[] = floor.elements.flatMap((element): WayfindingPoint[] => {
			if ('geometry' in element) return element.geometry;

			if ('point' in element) {
				if (element.type === 'icon' || element.type === 'logo') {
					return [
						{ x: element.point.x - element.width / 2, y: element.point.y - element.height / 2 },
						{ x: element.point.x + element.width / 2, y: element.point.y + element.height / 2 }
					];
				}

				return [element.point];
			}

			return [];
		});

		if (points.length === 0) {
			return { height: floor.height, width: floor.width, x: floor.width / 2, y: floor.height / 2 };
		}
		const minimumX = Math.min(...points.map((point) => point.x));
		const maximumX = Math.max(...points.map((point) => point.x));
		const minimumY = Math.min(...points.map((point) => point.y));
		const maximumY = Math.max(...points.map((point) => point.y));
		const padding = Math.max(28, Math.max(maximumX - minimumX, maximumY - minimumY) * 0.14);
		const width = Math.min(floor.width, Math.max(floor.width * 0.28, maximumX - minimumX + padding * 2));
		const height = Math.min(floor.height, Math.max(floor.height * 0.28, maximumY - minimumY + padding * 2));

		return {
			height,
			width,
			x: Math.max(width / 2, Math.min(floor.width - width / 2, (minimumX + maximumX) / 2)),
			y: Math.max(height / 2, Math.min(floor.height - height / 2, (minimumY + maximumY) / 2))
		};
	}

	private addFloorPlane(project: WayfindingStudioProject, floor: WayfindingStudioFloor): void {
		const presentation: Scene3dPresentation = scenePresentation(floor, this.presentationMode);
		const background: WayfindingStudioAsset | undefined = project.assets.find((asset): boolean => asset.id === floor.backgroundAssetId);
		const geometry = new THREE.PlaneGeometry(floor.width, floor.height);
		const material = new THREE.MeshStandardMaterial({
			color: background
				? '#ffffff'
				: this.presentationMode === 'visitor' ? '#edf3f0' : '#e7ece9',
			map: background ? new THREE.TextureLoader().load(background.dataUrl, (texture): void => {
				texture.colorSpace = THREE.SRGBColorSpace;
				this.render();
			}) : undefined,
			roughness: presentation.floorRoughness,
			side: THREE.DoubleSide
		});
		const plane = new THREE.Mesh(geometry, material);
		plane.receiveShadow = true;
		plane.rotation.x = -Math.PI / 2;
		plane.position.y = 0;
		this.addDisposable(plane);
		this.scene.add(plane);

		if (presentation.showFloorBase) {
			const depth: number = Math.max(2, Math.min(floor.width, floor.height) * presentation.floorBaseDepthRatio);
			const base = new THREE.Mesh(
				new THREE.BoxGeometry(floor.width * 1.006, depth, floor.height * 1.006),
				new THREE.MeshStandardMaterial({
					color: presentation.floorBaseColor,
					metalness: 0.02,
					roughness: 0.94
				})
			);
			base.position.y = -depth / 2 - Math.max(2, depth * 0.12);
			base.castShadow = this.presentationMode !== 'visitor';
			base.receiveShadow = this.presentationMode !== 'visitor';
			this.addDisposable(base);
			this.scene.add(base);
		}

		if (this.presentationMode === 'visitor') {
			const outlineGeometry = new THREE.BufferGeometry().setFromPoints([
				new THREE.Vector3(-floor.width / 2, 0.7, -floor.height / 2),
				new THREE.Vector3(floor.width / 2, 0.7, -floor.height / 2),
				new THREE.Vector3(floor.width / 2, 0.7, floor.height / 2),
				new THREE.Vector3(-floor.width / 2, 0.7, floor.height / 2)
			]);
			const outline = new THREE.LineLoop(
				outlineGeometry,
				new THREE.LineBasicMaterial({
					color: '#6c8c84',
					transparent: true,
					opacity: 0.72
				})
			);
			outline.renderOrder = 3;
			this.addDisposable(outline);
			this.scene.add(outline);
		}
	}

	private addLabel(project: WayfindingStudioProject, floor: WayfindingStudioFloor, label: WayfindingStudioLabelElement): void {
		const defaults: WayfindingStudioProjectDefaults = wayfindingStudioProjectDefaults(project);
		const { height, texture, width } = createTextTexture(label, defaults);
		const destinationLabel = label.id.startsWith('presentation-destination-label:');
		const material = new THREE.SpriteMaterial({
			depthTest: false,
			map: texture,
			sizeAttenuation: !destinationLabel,
			transparent: true
		});
		const sprite = new THREE.Sprite(material);

		if (destinationLabel) {
			sprite.userData.screenPixelWidth = width;
			sprite.userData.screenPixelHeight = height;
			sprite.userData.destinationId = label.id.slice('presentation-destination-label:'.length);
			// Keep the callout entirely above its marker. A centered sprite lets
			// destination geometry show through the label and looks visually broken.
			sprite.center.set(0.5, -0.2);
			this.destinationLabelSprites.push(sprite);
			this.updateScreenSpaceSprite(sprite);
			this.host.setAttribute(
				'data-destination-label-font-size-3d',
				String(defaults.label.fontSize3d)
			);
		} else {
			const worldHeight: number = Math.max(
				12,
				label.fontSize ?? defaults.label.fontSize
			) * 1.45;
			sprite.scale.set(worldHeight * width / height, worldHeight, 1);
		}
		sprite.position.copy(centeredPoint(floor, label.point, labelElevation(floor, floor.elements, label.point, defaults)));
		sprite.userData.elementId = label.id;
		sprite.userData.selectionPulse = true;
		sprite.renderOrder = 20;
		this.selectableObjects.push(sprite);
		this.addDisposable(sprite);
		this.scene.add(sprite);
		this.host.dataset.labelCount = String(Number(this.host.dataset.labelCount ?? 0) + 1);

		if (label.id.startsWith('presentation-destination-label:')) {
			this.host.dataset.destinationLabelCount = String(
				Number(this.host.dataset.destinationLabelCount ?? 0) + 1
			);
			const destinationLabelTexts: string[] = JSON.parse(
				this.host.dataset.destinationLabelTexts ?? '[]'
			) as string[];
			this.host.dataset.destinationLabelTexts = JSON.stringify([
				...destinationLabelTexts,
				label.text
			]);
		}
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
		const materialOptions = {
			depthTest: false,
			map: texture,
			transparent: true
		};
		const center = media.point;
		const position = centeredPoint(
			floor,
			center,
			labelElevation(floor, floor.elements, center, wayfindingStudioProjectDefaults(project))
		);

		if (media.destinationId) {
			const sprite = new THREE.Sprite(new THREE.SpriteMaterial(materialOptions));
			sprite.position.copy(position);
			sprite.scale.set(media.width, media.height, 1);
			sprite.userData.elementId = media.id;
			sprite.userData.selectionPulse = true;
			sprite.userData.cameraFacing = true;
			sprite.renderOrder = 19;
			this.selectableObjects.push(sprite);
			this.addDisposable(sprite);
			this.scene.add(sprite);
			this.host.dataset.renderedMediaCount = String(Number(this.host.dataset.renderedMediaCount ?? 0) + 1);
			this.host.dataset.cameraFacingMediaCount = String(
				Number(this.host.dataset.cameraFacingMediaCount ?? 0) + 1
			);

			return;
		}
		const material = new THREE.MeshBasicMaterial({
			...materialOptions,
			side: THREE.DoubleSide
		});
		const geometry = new THREE.PlaneGeometry(media.width, media.height);
		const plane = new THREE.Mesh(geometry, material);
		plane.position.copy(position);
		plane.rotation.x = -Math.PI / 2;
		plane.rotation.z = THREE.MathUtils.degToRad(-(media.rotationDegrees ?? 0));
		plane.userData.elementId = media.id;
		plane.userData.selectionPulse = true;
		plane.renderOrder = 19;
		this.selectableObjects.push(plane);
		this.addDisposable(plane);
		this.scene.add(plane);
		this.host.dataset.renderedMediaCount = String(Number(this.host.dataset.renderedMediaCount ?? 0) + 1);
	}

	private addOrigin(project: WayfindingStudioProject, floor: WayfindingStudioFloor, origin: WayfindingStudioOriginElement): void {
		const defaults: WayfindingStudioProjectDefaults = wayfindingStudioProjectDefaults(project);
		const size: number = Math.max(14, Math.min(floor.width, floor.height) * 0.025);
		const baseY: number = labelElevation(floor, floor.elements, origin.point, defaults);
		const marker = createOriginMarker3d(defaults.origin.color, origin.id, size);

		marker.root.position.copy(centeredPoint(floor, origin.point, baseY));
		this.selectableObjects.push(marker.body);
		this.addDisposable(marker.root);
		this.scene.add(marker.root);
		this.originAnimations.push({
			baseY,
			kind: defaults.origin.animation3d,
			marker,
			phase: Math.random() * Math.PI * 2,
			speed: Math.max(1, defaults.origin.animationSpeed)
		});
		this.host.setAttribute('data-origin-animation-3d', defaults.origin.animation3d);
		this.host.setAttribute('data-origin-animation-speed', String(defaults.origin.animationSpeed));
		this.host.setAttribute('data-origin-camera-facing', 'true');
		this.host.setAttribute('data-origin-color', defaults.origin.color);
		this.host.setAttribute('data-origin-ground-beacon', 'true');
		this.host.setAttribute('data-origin-marker-3d', 'upright-pin');
		this.host.setAttribute('data-origin-screen-height', '46');
	}

	private addPoi(project: WayfindingStudioProject, floor: WayfindingStudioFloor, poi: WayfindingStudioPointElement): void {
		const defaults = wayfindingStudioProjectDefaults(project);
		const destinationMarker = poi.id.startsWith('presentation-destination-marker:');
		const size = Math.max(
			destinationMarker ? 8 : 14,
			Math.min(floor.width, floor.height) * (destinationMarker ? 0.01 : 0.022)
		);
		const elevation = labelElevation(floor, floor.elements, poi.point, defaults) + size * 0.62;
		const group = new THREE.Group();
		const marker = new THREE.Mesh(
			new THREE.SphereGeometry(size * 0.42, 24, 18),
			new THREE.MeshStandardMaterial({
				color: destinationMarker ? '#ffffff' : '#0f8f83',
				emissive: destinationMarker ? '#0f8f83' : '#063f3a',
				emissiveIntensity: destinationMarker ? 0.62 : 0.42,
				roughness: 0.42
			})
		);
		const stem = new THREE.Mesh(
			new THREE.ConeGeometry(size * 0.2, size * 0.52, 18),
			new THREE.MeshStandardMaterial({ color: destinationMarker ? '#0f8f83' : '#0b6f67', roughness: 0.56 })
		);
		const halo = destinationMarker
			? new THREE.Mesh(
				new THREE.TorusGeometry(size * 0.58, Math.max(1, size * 0.07), 8, 28),
				new THREE.MeshBasicMaterial({
					color: '#65c8b4',
					depthTest: false,
					opacity: 0.82,
					transparent: true
				})
			)
			: undefined;

		stem.position.y = -size * 0.42;
		stem.rotation.z = Math.PI;

		if (halo) {
			halo.rotation.x = Math.PI / 2;
			halo.position.y = -size * 0.08;
			group.add(marker, stem, halo);
		} else {
			group.add(marker, stem);
		}
		group.position.copy(centeredPoint(floor, poi.point, elevation));
		group.userData.elementId = poi.id;
		group.renderOrder = 28;
		marker.userData.elementId = poi.id;
		marker.userData.selectionPulse = true;
		this.selectableObjects.push(marker);
		this.addDisposable(group);
		this.scene.add(group);

		if (destinationMarker) {
			this.host.dataset.destinationMarkerCount = String(
				Number(this.host.dataset.destinationMarkerCount ?? 0) + 1
			);
			this.host.dataset.destinationMarkerStyle = 'compact-3d';
		} else {
			this.host.dataset.poiCount = String(Number(this.host.dataset.poiCount ?? 0) + 1);
		}
	}

	private addTransition(
		project: WayfindingStudioProject,
		floor: WayfindingStudioFloor,
		transition: WayfindingStudioTransitionElement
	): void {
		const defaults = wayfindingStudioProjectDefaults(project);
		const size = Math.max(16, Math.min(floor.width, floor.height) * 0.026);
		const elevation = labelElevation(floor, floor.elements, transition.point, defaults) + size * 0.22;
		const color = transition.accessible ? '#2563eb' : '#7c3aed';
		const group = new THREE.Group();
		const base = new THREE.Mesh(
			new THREE.CylinderGeometry(size * 0.52, size * 0.58, size * 0.24, 28),
			new THREE.MeshStandardMaterial({
				color,
				emissive: new THREE.Color(color).multiplyScalar(0.24),
				emissiveIntensity: 0.48,
				roughness: 0.48
			})
		);
		const ring = new THREE.Mesh(
			new THREE.TorusGeometry(size * 0.72, Math.max(1.5, size * 0.08), 10, 36),
			new THREE.MeshBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.72 })
		);

		ring.rotation.x = Math.PI / 2;
		ring.position.y = -size * 0.12;
		group.add(base, ring);
		group.position.copy(centeredPoint(floor, transition.point, elevation));
		group.userData.elementId = transition.id;
		group.renderOrder = 27;
		base.userData.elementId = transition.id;
		base.userData.selectionPulse = true;
		this.selectableObjects.push(base);
		this.addDisposable(group);
		this.scene.add(group);
		this.host.dataset.transitionCount = String(Number(this.host.dataset.transitionCount ?? 0) + 1);
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
		const presentation: Scene3dPresentation = scenePresentation(floor, this.presentationMode);
		const height: number = polygonHeight(floor, polygon, defaults);
		const opacity: number = this.presentationMode === 'visitor' && polygon.type === 'location'
			? Math.max(presentation.locationOpacityFloor, polygonOpacity(polygon, defaults))
			: polygonOpacity(polygon, defaults);
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
			? new THREE.ExtrudeGeometry(shape, {
				bevelEnabled: this.presentationMode === 'visitor',
				bevelSegments: 1,
				bevelSize: this.presentationMode === 'visitor' ? Math.min(floor.width, floor.height) * 0.0016 : 0,
				bevelThickness: this.presentationMode === 'visitor' ? Math.min(floor.width, floor.height) * 0.0012 : 0,
				depth: height,
				steps: 1
			})
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

		if (this.presentationMode === 'visitor' && polygon.type === 'location' && height > 0.01) {
			const outline = new THREE.LineSegments(
				new THREE.EdgesGeometry(geometry, 24),
				new THREE.LineBasicMaterial({
					color: topColor.clone().multiplyScalar(0.42),
					transparent: true,
					opacity: 0.68
				})
			);
			outline.rotation.copy(mesh.rotation);
			outline.position.copy(mesh.position);
			outline.renderOrder = layerOrder + 1;
			this.addDisposable(outline);
			this.scene.add(outline);
		}
	}

	private addRoute(project: WayfindingStudioProject, floor: WayfindingStudioFloor, points: WayfindingPoint[]): void {
		if (points.length < 2) {
			delete this.host.dataset.routePoints;
			delete this.host.dataset.routeAnimation;
			delete this.host.dataset.routeProgress;
			delete this.host.dataset.routeWidth;
			delete this.host.dataset.routeElevation;
			delete this.host.dataset.routeEndpointCount;
			delete this.host.dataset.floorPeak;
			this.host.removeAttribute('data-route-presentation-3d');
			this.host.removeAttribute('data-route-flow-marker-3d');

			return;
		}
		this.host.dataset.routePoints = String(points.length);
		const defaults: WayfindingStudioProjectDefaults = wayfindingStudioProjectDefaults(project);
		// A walking route stays on the pedestrian plane. Using label elevation would lift it onto
		// the extruded top face of any room polygon it crosses, which is not a walkable surface.
		const vectors: THREE.Vector3[] = points.map((point): THREE.Vector3 => centeredPoint(
			floor,
			point,
			groundClearance(floor)
		));
		const radius: number = Math.max(1.6, defaults.route.lineWidth * 0.46);
		const curve = createRoundedRouteCurve(
			vectors,
			Math.max(radius * 2.4, Math.min(24, defaults.route.cornerRadius))
		);
		const tubularSegments = Math.min(480, Math.max(64, Math.ceil(curve.getLength() / 10)));
		const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, 12, false);
		const underlay = new THREE.Mesh(
			new THREE.TubeGeometry(curve, tubularSegments, radius * 1.64, 12, false),
			new THREE.MeshBasicMaterial({
				color: '#071b1b',
				depthTest: false,
				depthWrite: false,
				opacity: 0.42,
				transparent: true
			})
		);
		const material = new THREE.MeshBasicMaterial({
			color: defaults.route.color,
			depthTest: false,
			depthWrite: false,
			toneMapped: false
		});
		const route = new THREE.Mesh(geometry, material);
		const highlight = new THREE.Mesh(
			new THREE.TubeGeometry(curve, tubularSegments, Math.max(0.46, radius * 0.23), 8, false),
			new THREE.MeshBasicMaterial({
				color: '#e8fff9',
				depthTest: false,
				depthWrite: false,
				opacity: 0.56,
				transparent: true
			})
		);
		underlay.renderOrder = 29;
		route.renderOrder = 30;
		highlight.renderOrder = 31;
		this.addRouteObject(underlay);
		this.addRouteObject(route);
		this.addRouteObject(highlight);
		this.scene.add(underlay);
		this.scene.add(route);
		this.scene.add(highlight);
		this.addRouteEndpoints(floor, vectors, radius, defaults.route.color);
		this.host.dataset.routeEndpointCount = '2';
		this.host.dataset.routeAnimation = defaults.route.animation;
		this.host.setAttribute('data-route-presentation-3d', 'rounded-ribbon');
		this.host.dataset.routeWidth = String(defaults.route.lineWidth);
		this.host.dataset.routeElevation = groundClearance(floor).toFixed(3);
		this.host.dataset.floorPeak = floor.elements
			.filter((element): element is WayfindingStudioPolygonElement => 'geometry' in element)
			.reduce((peak: number, polygon): number => Math.max(peak, polygonHeight(floor, polygon, defaults)), 0)
			.toFixed(3);
		const markers: THREE.Mesh[] = [];

		if (defaults.route.animation !== 'none') {
			const markerGeometry = new THREE.CapsuleGeometry(
				Math.max(0.55, radius * 0.34),
				Math.max(1.5, radius * 1.42),
				5,
				12
			);
			const markerMaterial = new THREE.MeshBasicMaterial({
				color: '#f2fff9',
				depthTest: false,
				depthWrite: false
			});
			const markerCount: number = defaults.route.animation === 'flow' ? 6 : 1;

			for (let index = 0; index < markerCount; index += 1) {
				const marker = new THREE.Mesh(markerGeometry, markerMaterial);
				marker.renderOrder = 32;
				markers.push(marker);
				this.addRouteObject(marker);
				this.scene.add(marker);
			}
			this.host.setAttribute('data-route-flow-marker-3d', 'capsule');
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

	private addRouteEndpoints(
		floor: WayfindingStudioFloor,
		vectors: THREE.Vector3[],
		radius: number,
		color: string
	): void {
		const clearance = groundClearance(floor);
		const start = vectors[0];
		const arrival = vectors[vectors.length - 1];
		const startRing = new THREE.Mesh(
			new THREE.TorusGeometry(radius * 2.15, Math.max(1.25, radius * 0.34), 12, 36),
			new THREE.MeshBasicMaterial({
				color,
				depthTest: false,
				transparent: true,
				opacity: 0.96
			})
		);

		startRing.position.copy(start);
		startRing.position.y = clearance + radius * 0.38;
		startRing.rotation.x = Math.PI / 2;
		startRing.renderOrder = 33;
		this.addRouteObject(startRing);
		this.scene.add(startRing);

		const arrivalGroup = new THREE.Group();
		const arrivalRing = new THREE.Mesh(
			new THREE.TorusGeometry(radius * 2.7, Math.max(1.4, radius * 0.38), 12, 40),
			new THREE.MeshBasicMaterial({
				color,
				depthTest: false,
				transparent: true,
				opacity: 0.96
			})
		);
		const arrivalStem = new THREE.Mesh(
			new THREE.CylinderGeometry(
				Math.max(0.8, radius * 0.18),
				Math.max(0.8, radius * 0.18),
				radius * 1.5,
				12
			),
			new THREE.MeshBasicMaterial({ color, depthTest: false })
		);
		const arrivalCore = new THREE.Mesh(
			new THREE.SphereGeometry(radius * 1.05, 20, 14),
			new THREE.MeshBasicMaterial({ color: '#fffdf2', depthTest: false })
		);

		arrivalRing.rotation.x = Math.PI / 2;
		arrivalStem.position.y = radius * 0.55;
		arrivalCore.position.y = radius * 1.35;
		arrivalGroup.add(arrivalRing, arrivalStem, arrivalCore);
		arrivalGroup.position.copy(arrival);
		arrivalGroup.position.y = clearance + radius * 0.42;
		arrivalGroup.renderOrder = 34;
		this.addRouteObject(arrivalGroup);
		this.scene.add(arrivalGroup);
	}

	private addDisposable(object: THREE.Object3D): void {
		this.disposableObjects.push(object);
	}

	private addRouteObject(object: THREE.Object3D): void {
		this.routeObjects.push(object);
	}

	private disposeObject(object: THREE.Object3D): void {
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

	private disposeRoute(): void {
		this.routeAnimation = undefined;

		for (const object of this.routeObjects) this.disposeObject(object);
		this.routeObjects.length = 0;
		delete this.host.dataset.routeAnimation;
		delete this.host.dataset.routePoints;
		delete this.host.dataset.routeProgress;
		delete this.host.dataset.routeWidth;
		delete this.host.dataset.routeElevation;
		delete this.host.dataset.routeEndpointCount;
		delete this.host.dataset.floorPeak;
		this.host.removeAttribute('data-route-presentation-3d');
		this.host.removeAttribute('data-route-flow-marker-3d');
	}

	private disposeSceneContent(): void {
		this.disposeRoute();
		this.originAnimations.length = 0;
		this.destinationLabelSprites.length = 0;
		delete this.host.dataset.originAnimation3d;
		delete this.host.dataset.originAnimationSpeed;
		delete this.host.dataset.originCameraFacing;
		delete this.host.dataset.originColor;
		delete this.host.dataset.originGroundBeacon;
		delete this.host.dataset.originMarker3d;
		delete this.host.dataset.originScreenHeight;
		delete this.host.dataset.destinationMarkerCount;
		delete this.host.dataset.destinationMarkerStyle;
		this.host.removeAttribute('data-destination-label-font-size-3d');
		delete this.host.dataset.destinationLabelsHiddenByOverlay;
		delete this.host.dataset.visibleDestinationLabelCount;
		this.selectedPulse = undefined;

		for (const object of this.disposableObjects) this.disposeObject(object);

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
		const cameraState = this.getCameraState();

		if (cameraState) {
			this.host.dataset.cameraState = [
				cameraState.azimuthDegrees,
				cameraState.pitchDegrees,
				cameraState.distance,
				cameraState.targetX,
				cameraState.targetY
			].map((value) => value.toFixed(3)).join(',');
		}
		this.updateDestinationLabelVisibility();
		this.renderer.render(this.scene, this.camera);
	}

	private resize(): void {
		const width: number = Math.max(1, this.host.clientWidth);
		const height: number = Math.max(1, this.host.clientHeight);
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		this.collectScreenOverlayBounds();

		for (const object of this.disposableObjects) {
			if (object instanceof THREE.Sprite && typeof object.userData.screenPixelHeight === 'number') {
				this.updateScreenSpaceSprite(object);
			}
		}

		if (this.currentFloor && this.presentationMode === 'visitor') {
			this.applyCameraState(
				this.currentFloor.camera3d ?? this.defaultCameraState(this.currentFloor)
			);
		}
		this.render();
	}

	private collectScreenOverlayBounds(): void {
		const stage = this.host.closest('.stage');
		const hostBounds = this.host.getBoundingClientRect();

		if (!stage || hostBounds.width <= 0 || hostBounds.height <= 0) {
			this.screenOverlayBounds = [];

			return;
		}
		const padding = 6;

		this.screenOverlayBounds = [
			...stage.querySelectorAll<HTMLElement>(
				'.stage-toolbar, .visitor-panel, .visitor-detail-card, .scene3d-camera-actions, .floor-navigator'
			)
		].flatMap((element) => {
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			const visible = style.display !== 'none'
				&& style.visibility !== 'hidden'
				&& Number(style.opacity) > 0;
			const intersects = bounds.right > hostBounds.left
				&& bounds.left < hostBounds.right
				&& bounds.bottom > hostBounds.top
				&& bounds.top < hostBounds.bottom;

			if (!visible || !intersects || bounds.width <= 1 || bounds.height <= 1) return [];

			return [{
				bottom: Math.min(hostBounds.height, bounds.bottom - hostBounds.top + padding),
				left: Math.max(0, bounds.left - hostBounds.left - padding),
				right: Math.min(hostBounds.width, bounds.right - hostBounds.left + padding),
				top: Math.max(0, bounds.top - hostBounds.top - padding)
			}];
		});
	}

	private updateScreenSpaceSprite(sprite: THREE.Sprite): void {
		const pixelWidth = Number(sprite.userData.screenPixelWidth);
		const pixelHeight = Number(sprite.userData.screenPixelHeight);
		const viewportHeight = Math.max(1, this.host.clientHeight);
		const projectionScale = Math.max(0.001, this.camera.projectionMatrix.elements[5] ?? 1);
		const pixelToWorldScale = 2 / (viewportHeight * projectionScale);

		sprite.scale.set(
			Math.max(1, pixelWidth) * pixelToWorldScale,
			Math.max(1, pixelHeight) * pixelToWorldScale,
			1
		);
		sprite.userData.baseSelectionScale = sprite.scale.clone();

		if (this.selectedPulse?.object === sprite) {
			this.selectedPulse.baseScale.copy(sprite.scale);
		}
	}

	private updateDestinationLabelVisibility(): void {
		if (this.destinationLabelSprites.length === 0) {
			this.host.dataset.visibleDestinationLabelCount = '0';

			return;
		}
		const width = Math.max(1, this.host.clientWidth);
		const height = Math.max(1, this.host.clientHeight);
		const selectedElement = this.currentFloor?.elements.find((element) =>
			element.id === this.selectedElementId
		);
		const selectedDestinationId = selectedElement && 'destinationId' in selectedElement
			? selectedElement.destinationId
			: undefined;
		const candidates = this.destinationLabelSprites.map((sprite, index) => {
			const projected = sprite.position.clone().project(this.camera);
			const pixelWidth = Math.max(1, Number(sprite.userData.screenPixelWidth));
			const pixelHeight = Math.max(1, Number(sprite.userData.screenPixelHeight));

			return {
				destinationId: String(sprite.userData.destinationId ?? ''),
				height: pixelHeight,
				index,
				sprite,
				width: pixelWidth,
				x: (projected.x + 1) * width / 2,
				y: (1 - projected.y) * height / 2,
				z: projected.z
			};
		}).sort((left, right) => {
			const leftSelected = left.destinationId === selectedDestinationId ? 1 : 0;
			const rightSelected = right.destinationId === selectedDestinationId ? 1 : 0;

			return rightSelected - leftSelected || left.index - right.index;
		});
		const occupied: Array<{ bottom: number; left: number; right: number; top: number }> = [
			...this.screenOverlayBounds
		];
		let hiddenByOverlayCount = 0;
		let visibleCount = 0;

		for (const candidate of candidates) {
			const padding = candidate.destinationId === selectedDestinationId ? 5 : 7;
			const bounds = {
				bottom: candidate.y + candidate.sprite.center.y * candidate.height + padding,
				left: candidate.x - candidate.sprite.center.x * candidate.width - padding,
				right: candidate.x + (1 - candidate.sprite.center.x) * candidate.width + padding,
				top: candidate.y - (1 - candidate.sprite.center.y) * candidate.height - padding
			};
			const onScreen = candidate.z >= -1
				&& candidate.z <= 1
				&& bounds.right >= 0
				&& bounds.left <= width
				&& bounds.bottom >= 0
				&& bounds.top <= height;
			const overlapsOverlay = this.screenOverlayBounds.some((other) =>
				bounds.left < other.right
					&& bounds.right > other.left
					&& bounds.top < other.bottom
					&& bounds.bottom > other.top
			);
			const overlaps = overlapsOverlay || occupied.some((other) =>
				bounds.left < other.right
					&& bounds.right > other.left
					&& bounds.top < other.bottom
					&& bounds.bottom > other.top
			);
			candidate.sprite.visible = onScreen && !overlaps;

			if (candidate.sprite.visible) {
				occupied.push(bounds);
				visibleCount += 1;
			} else if (onScreen && overlapsOverlay) {
				hiddenByOverlayCount += 1;
			}
		}
		this.host.dataset.destinationLabelsHiddenByOverlay = String(hiddenByOverlayCount);
		this.host.dataset.visibleDestinationLabelCount = String(visibleCount);
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
			this.updateSelectionAnimation(performance.now());
			this.render();
			this.frameId = window.requestAnimationFrame(frame);
		};
		this.frameId = window.requestAnimationFrame(frame);
	}

	private updateOriginAnimations(now: number): void {
		for (const animation of this.originAnimations) {
			const phase: number = now * animation.speed / 24_000 + animation.phase;
			animation.marker.root.position.y = animation.baseY;
			updateOriginMarker3d(
				animation.marker,
				this.camera,
				animation.kind,
				phase,
				this.reducedMotion,
				this.host.clientHeight
			);
		}
	}

	private updateRouteAnimation(now: number): void {
		const animation = this.routeAnimation;

		if (!animation) return;
		const elapsed: number = Math.max(0, now - animation.startedAt) / 1_000;

		if (animation.kind === 'pulse') {
			const scale: number = 0.82 + (Math.sin(elapsed * animation.speed / 8) + 1) * 0.28;
			animation.markers[0].scale.setScalar(scale);
			positionRouteFlowMarker(animation.markers[0], animation.curve, 0.98);
			this.host.dataset.routeProgress = scale.toFixed(3);

			return;
		}
		const progress: number = elapsed * animation.speed / 1_200;
		this.host.dataset.routeProgress = (progress % 1).toFixed(3);

		for (const [index, marker] of animation.markers.entries()) {
			const position: number = (progress - index / animation.markers.length + 10) % 1;
			positionRouteFlowMarker(marker, animation.curve, position);
		}
	}

	private updateSelectionAnimation(now: number): void {
		if (!this.selectedPulse) return;
		const scale: number = 1.04 + (Math.sin(now / 260) + 1) * 0.025;
		this.selectedPulse.object.scale.copy(this.selectedPulse.baseScale).multiplyScalar(scale);
	}
}
