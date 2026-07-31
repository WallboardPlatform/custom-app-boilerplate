import * as THREE from 'three';

import type { WayfindingPoint } from '../../../src/utils/wayfinding';
import type {
	WayfindingStudioCamera3d,
	WayfindingStudioElement,
	WayfindingStudioFloor,
	WayfindingStudioLabelElement,
	WayfindingStudioPolygonElement,
	WayfindingStudioProjectDefaults
} from '../studio-project.mts';

export type WayfindingScene3dMode = 'editor' | 'visitor';

const pointInPolygon = (point: WayfindingPoint, polygon: WayfindingPoint[]): boolean => {
	let inside = false;

	for (let left = 0, right = polygon.length - 1; left < polygon.length; right = left, left += 1) {
		const a: WayfindingPoint = polygon[left];
		const b: WayfindingPoint = polygon[right];

		if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
	}

	return inside;
};

export const polygonHeight = (
	floor: WayfindingStudioFloor,
	polygon: WayfindingStudioPolygonElement,
	defaults: WayfindingStudioProjectDefaults
): number => {
	const visualHeight: number = polygon.presentation?.extrusionHeight ?? defaults[polygon.type].extrusionHeight;

	return Math.min(floor.width, floor.height) * visualHeight / 500;
};

export const polygonColor = (polygon: WayfindingStudioPolygonElement, defaults: WayfindingStudioProjectDefaults): string =>
	polygon.presentation?.fillColor ?? defaults[polygon.type].fillColor;
export const polygonOpacity = (polygon: WayfindingStudioPolygonElement, defaults: WayfindingStudioProjectDefaults): number =>
	polygon.presentation?.fillOpacity ?? defaults[polygon.type].fillOpacity;
export const POLYGON_LAYER_ORDER: Record<WayfindingStudioPolygonElement['type'], number> = {
	walkable: 1,
	location: 2,
	obstacle: 3
};

export const centeredPoint = (floor: WayfindingStudioFloor, point: WayfindingPoint, elevation = 0): THREE.Vector3 => new THREE.Vector3(
	point.x - floor.width / 2,
	elevation,
	point.y - floor.height / 2
);

export const labelElevation = (
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

export const groundClearance = (floor: WayfindingStudioFloor): number => Math.min(floor.width, floor.height) * 0.018;

export interface Scene3dPresentation {
	background: string;
	camera: Pick<WayfindingStudioCamera3d, 'azimuthDegrees' | 'distance' | 'pitchDegrees'>;
	floorBaseColor: string;
	floorBaseDepthRatio: number;
	floorRoughness: number;
	locationOpacityFloor: number;
	showFloorBase: boolean;
}

export const scenePresentation = (
	floor: WayfindingStudioFloor,
	mode: WayfindingScene3dMode
): Scene3dPresentation => {
	const maximumDimension: number = Math.max(floor.width, floor.height);

	return mode === 'visitor'
		? {
			background: '#172321',
			camera: {
				azimuthDegrees: 24,
				distance: maximumDimension * 1.48,
				pitchDegrees: 60
			},
			floorBaseColor: '#20332f',
			floorBaseDepthRatio: 0.004,
			floorRoughness: 0.96,
			locationOpacityFloor: 0.92,
			showFloorBase: true
		}
		: {
			background: '#26302e',
			camera: {
				azimuthDegrees: 36,
				distance: maximumDimension * 1.75,
				pitchDegrees: 48
			},
			floorBaseColor: '#d8dfdc',
			floorBaseDepthRatio: 0.012,
			floorRoughness: 0.94,
			locationOpacityFloor: 0,
			showFloorBase: false
		};
};

export const createTextTexture = (
	label: WayfindingStudioLabelElement,
	defaults: WayfindingStudioProjectDefaults
): { height: number; texture: THREE.CanvasTexture; width: number } => {
	const destinationLabel = label.id.startsWith('presentation-destination-label:');
	const fontFamily: Record<NonNullable<WayfindingStudioLabelElement['fontFamily']>, string> = {
		monospace: '"Courier New", monospace',
		'sans-serif': 'Arial, sans-serif',
		serif: 'Georgia, serif'
	};
	const fontSize: number = destinationLabel
		? defaults.label.fontSize3d
		: Math.max(12, label.fontSize ?? defaults.label.fontSize);
	const horizontalPadding: number = Math.ceil(
		fontSize * (destinationLabel ? 0.66 : 0.42)
		+ (label.outlineWidth ?? defaults.label.outlineWidth) * 2
	);
	const verticalPadding: number = Math.ceil(
		fontSize * (destinationLabel ? 0.34 : 0.42)
		+ (label.outlineWidth ?? defaults.label.outlineWidth) * 2
	);
	const pixelRatio: number = Math.min(
		2,
		Math.max(1, typeof window === 'undefined' ? 1 : window.devicePixelRatio)
	);
	const canvas: HTMLCanvasElement = document.createElement('canvas');
	const context: CanvasRenderingContext2D = canvas.getContext('2d')!;
	context.font = `${label.fontWeight ?? defaults.label.fontWeight} ${fontSize}px ${fontFamily[label.fontFamily ?? defaults.label.fontFamily]}`;
	const displayWidth: number = Math.max(8, Math.ceil(
		context.measureText(label.text || ' ').width
		+ horizontalPadding * 2
	));
	const displayHeight: number = Math.max(8, Math.ceil(fontSize * 1.35 + verticalPadding * 2));
	canvas.width = Math.ceil(displayWidth * pixelRatio);
	canvas.height = Math.ceil(displayHeight * pixelRatio);
	const drawingContext: CanvasRenderingContext2D = canvas.getContext('2d')!;
	drawingContext.scale(pixelRatio, pixelRatio);
	drawingContext.font = `${label.fontWeight ?? defaults.label.fontWeight} ${fontSize}px ${fontFamily[label.fontFamily ?? defaults.label.fontFamily]}`;
	drawingContext.textAlign = 'center';
	drawingContext.textBaseline = 'middle';
	drawingContext.lineJoin = 'round';

	if (destinationLabel) {
		const radius = Math.min(12, displayHeight * 0.28);

		drawingContext.fillStyle = 'rgba(255, 255, 255, 0.96)';
		drawingContext.strokeStyle = 'rgba(93, 161, 145, 0.9)';
		drawingContext.lineWidth = 2;
		drawingContext.beginPath();
		drawingContext.moveTo(1 + radius, 1);
		drawingContext.lineTo(displayWidth - 1 - radius, 1);
		drawingContext.quadraticCurveTo(displayWidth - 1, 1, displayWidth - 1, 1 + radius);
		drawingContext.lineTo(displayWidth - 1, displayHeight - 1 - radius);
		drawingContext.quadraticCurveTo(
			displayWidth - 1,
			displayHeight - 1,
			displayWidth - 1 - radius,
			displayHeight - 1
		);
		drawingContext.lineTo(1 + radius, displayHeight - 1);
		drawingContext.quadraticCurveTo(1, displayHeight - 1, 1, displayHeight - 1 - radius);
		drawingContext.lineTo(1, 1 + radius);
		drawingContext.quadraticCurveTo(1, 1, 1 + radius, 1);
		drawingContext.closePath();
		drawingContext.fill();
		drawingContext.stroke();
	}
	const outlineWidth: number = label.outlineWidth ?? defaults.label.outlineWidth;

	if (outlineWidth > 0 && !destinationLabel) {
		drawingContext.strokeStyle = label.outlineColor ?? defaults.label.outlineColor;
		drawingContext.lineWidth = outlineWidth * 2;
		drawingContext.strokeText(label.text, displayWidth / 2, displayHeight / 2);
	}

	drawingContext.fillStyle = destinationLabel
		? '#102824'
		: label.color ?? defaults.label.color;
	drawingContext.fillText(label.text, displayWidth / 2, displayHeight / 2);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.needsUpdate = true;

	return { height: displayHeight, texture, width: displayWidth };
};
