import * as THREE from 'three';

import type { WayfindingStudioProjectDefaults } from '../studio-project.mts';

export interface OriginMarker3d {
	billboard: THREE.Group;
	body: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshStandardMaterial>;
	halo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
	root: THREE.Group;
	size: number;
}

const originPinShape = (size: number): THREE.Shape => {
	const shape = new THREE.Shape();

	shape.moveTo(0, 0);
	shape.bezierCurveTo(-size * 0.16, size * 0.25, -size * 0.54, size * 0.58, -size * 0.54, size * 0.98);
	shape.bezierCurveTo(-size * 0.54, size * 1.7, size * 0.54, size * 1.7, size * 0.54, size * 0.98);
	shape.bezierCurveTo(size * 0.54, size * 0.58, size * 0.16, size * 0.25, 0, 0);

	return shape;
};

export const createOriginMarker3d = (
	color: string,
	elementId: string,
	size: number
): OriginMarker3d => {
	const root = new THREE.Group();
	const billboard = new THREE.Group();
	const depth = Math.max(1.6, size * 0.11);
	const geometryOptions: THREE.ExtrudeGeometryOptions = {
		bevelEnabled: true,
		bevelSegments: 3,
		bevelSize: size * 0.035,
		bevelThickness: size * 0.035,
		curveSegments: 24,
		depth,
		steps: 1
	};
	const rim = new THREE.Mesh(
		new THREE.ExtrudeGeometry(originPinShape(size), geometryOptions),
		new THREE.MeshStandardMaterial({
			color: '#f7fffd',
			emissive: '#d8f4ee',
			emissiveIntensity: 0.2,
			metalness: 0.02,
			roughness: 0.34
		})
	);
	const markerColor = new THREE.Color(color);
	const body = new THREE.Mesh(
		new THREE.ExtrudeGeometry(originPinShape(size), geometryOptions),
		new THREE.MeshStandardMaterial({
			color,
			emissive: markerColor.clone().multiplyScalar(0.35),
			emissiveIntensity: 0.72,
			metalness: 0.04,
			roughness: 0.28
		})
	);
	const center = new THREE.Mesh(
		new THREE.CircleGeometry(size * 0.28, 40),
		new THREE.MeshBasicMaterial({ color: '#f9fffd', toneMapped: false })
	);
	const centerCore = new THREE.Mesh(
		new THREE.CircleGeometry(size * 0.105, 32),
		new THREE.MeshBasicMaterial({ color: markerColor.clone().multiplyScalar(0.62), toneMapped: false })
	);
	const highlight = new THREE.Mesh(
		new THREE.CircleGeometry(size * 0.045, 20),
		new THREE.MeshBasicMaterial({ color: '#ffffff', opacity: 0.88, toneMapped: false, transparent: true })
	);

	rim.scale.set(1.13, 1.09, 1);
	rim.position.z = -depth * 0.52;
	rim.castShadow = true;
	rim.renderOrder = 32;
	body.position.z = -depth * 0.14;
	body.castShadow = true;
	body.renderOrder = 33;
	body.userData.elementId = elementId;
	body.userData.selectionPulse = true;
	center.position.set(0, size * 1.04, depth * 1.04);
	center.renderOrder = 34;
	centerCore.position.set(0, size * 1.04, depth * 1.1);
	centerCore.renderOrder = 35;
	highlight.position.set(-size * 0.105, size * 1.15, depth * 1.14);
	highlight.renderOrder = 36;
	billboard.add(rim, body, center, centerCore, highlight);

	const anchorPlate = new THREE.Mesh(
		new THREE.CircleGeometry(size * 0.38, 48),
		new THREE.MeshBasicMaterial({
			color: '#ffffff',
			depthTest: false,
			opacity: 0.18,
			toneMapped: false,
			transparent: true
		})
	);
	const anchorDot = new THREE.Mesh(
		new THREE.CylinderGeometry(size * 0.12, size * 0.16, Math.max(1.4, size * 0.08), 28),
		new THREE.MeshStandardMaterial({
			color,
			emissive: markerColor.clone().multiplyScalar(0.24),
			emissiveIntensity: 0.42,
			roughness: 0.36
		})
	);
	const haloMaterial = new THREE.MeshBasicMaterial({
		blending: THREE.AdditiveBlending,
		color,
		depthTest: false,
		opacity: 0.52,
		toneMapped: false,
		transparent: true
	});
	const halo = new THREE.Mesh(
		new THREE.RingGeometry(size * 0.52, size * 0.68, 64),
		haloMaterial
	);

	anchorPlate.rotation.x = -Math.PI / 2;
	anchorPlate.position.y = 0.45;
	anchorPlate.renderOrder = 30;
	anchorDot.position.y = Math.max(1.4, size * 0.08) / 2;
	anchorDot.renderOrder = 31;
	halo.rotation.x = -Math.PI / 2;
	halo.position.y = 0.7;
	halo.renderOrder = 31;
	root.add(anchorPlate, anchorDot, halo, billboard);
	root.userData.elementId = elementId;

	return { billboard, body, halo, root, size };
};

export const updateOriginMarker3d = (
	marker: OriginMarker3d,
	camera: THREE.PerspectiveCamera,
	kind: WayfindingStudioProjectDefaults['origin']['animation3d'],
	phase: number,
	reducedMotion: boolean,
	viewportHeight: number
): void => {
	const dx = camera.position.x - marker.root.position.x;
	const dy = camera.position.y - marker.root.position.y;
	const dz = camera.position.z - marker.root.position.z;
	const distance = camera.position.distanceTo(marker.root.position);
	const visibleWorldHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
	const desiredWorldHeight = visibleWorldHeight * 46 / Math.max(1, viewportHeight);
	const screenScale = THREE.MathUtils.clamp(
		desiredWorldHeight / (marker.size * 1.55),
		0.82,
		3.2
	);
	const horizontalDistance = Math.max(0.001, Math.hypot(dx, dz));
	const cameraPitch = Math.atan2(Math.abs(dy), horizontalDistance);
	const verticalProjection = Math.max(0.38, Math.cos(cameraPitch));
	const verticalScreenScale = screenScale / verticalProjection;
	marker.billboard.rotation.y = Math.atan2(dx, dz);

	if (reducedMotion || kind === 'none') {
		marker.billboard.position.y = 0;
		marker.billboard.scale.set(screenScale, verticalScreenScale, screenScale);
		marker.halo.scale.setScalar(1);
		marker.halo.material.opacity = 0.48;

		return;
	}

	const wave = (Math.sin(phase) + 1) / 2;

	if (kind === 'bounce') {
		const lift = Math.pow(Math.max(0, Math.sin(phase)), 1.7);
		marker.billboard.position.y = lift * marker.size * 0.32;
		const animationScale = 1 + lift * 0.025;
		marker.billboard.scale.set(
			screenScale * animationScale,
			verticalScreenScale * animationScale,
			screenScale * animationScale
		);
		marker.halo.scale.setScalar(0.9 + (1 - lift) * 0.34);
		marker.halo.material.opacity = 0.34 + (1 - lift) * 0.26;

		return;
	}

	marker.billboard.position.y = wave * marker.size * 0.035;
	const animationScale = 0.98 + wave * 0.055;
	marker.billboard.scale.set(
		screenScale * animationScale,
		verticalScreenScale * animationScale,
		screenScale * animationScale
	);
	marker.halo.scale.setScalar(0.82 + wave * 0.62);
	marker.halo.material.opacity = 0.55 - wave * 0.37;
};
