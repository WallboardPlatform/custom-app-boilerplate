import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';
import {
	wayfindingStudioProjectDefaults,
	type WayfindingStudioElement,
	type WayfindingStudioFloor,
	type WayfindingStudioOriginElement
} from '../../../studio-project.mts';
import type {
	EditorCamera2d,
	EditorSelection,
	EditorSnapshot
} from '../../../editor-core/types';
import {
	visitorMarkerIds,
	type VisitorMapItem,
	type VisitorMapLabelPlacement
} from '../features/preview';
import { pointsAttribute } from './model';

interface VisitorMapOverlayProps {
	activateDestination: (destinationId: string) => void;
	camera: Accessor<EditorCamera2d>;
	elements: Accessor<WayfindingStudioElement[]>;
	floor: Accessor<WayfindingStudioFloor>;
	labelPlacements: Accessor<VisitorMapLabelPlacement[]>;
	mapItems: Accessor<VisitorMapItem[]>;
	snapshot: Accessor<EditorSnapshot>;
}

export const VisitorMapOverlay = (props: VisitorMapOverlayProps): JSX.Element => {
	const selection = (): EditorSelection | undefined => props.snapshot().state.selection;
	const originDefaults = (): ReturnType<typeof wayfindingStudioProjectDefaults>['origin'] =>
		wayfindingStudioProjectDefaults(props.snapshot().state.project).origin;
	const visitorMarkers = (): Set<string> => visitorMarkerIds(
		props.mapItems(),
		props.camera().scale,
		selection()?.kind === 'destination' ? selection()?.id : undefined
	);
	const visitorOrigins = (): WayfindingStudioOriginElement[] => props.elements().filter(
		(element): element is WayfindingStudioOriginElement => element.type === 'origin'
	);

	return (
		<svg
			class="visitor-map-overlay"
			preserveAspectRatio="none"
			viewBox={`0 0 ${props.floor().width} ${props.floor().height}`}
		>
			<For each={props.mapItems()}>
				{(item): JSX.Element => {
					const selected = (): boolean => selection()?.kind === 'destination'
						&& selection()?.id === item.destinationId;
					const markerRadius = (): number => Math.max(7, 12 / props.camera().scale);

					return (
						<g
							aria-label={`Open ${item.name} on the map`}
							class="visitor-map-destination"
							classList={{
								draft: item.presentation === 'draft',
								selected: selected()
							}}
							data-visitor-destination-id={item.destinationId}
							onClick={(event) => {
								event.preventDefault();
								event.stopPropagation();
								props.activateDestination(item.destinationId);
							}}
							onPointerDown={(event) => {
								event.preventDefault();
								event.stopPropagation();
								props.activateDestination(item.destinationId);
							}}
							onKeyDown={(event) => {
								if (event.key !== 'Enter' && event.key !== ' ') return;
								event.preventDefault();
								props.activateDestination(item.destinationId);
							}}
							role="button"
							tabindex="0"
						>
							<Show
								fallback={(
									<circle
										class="visitor-location-hit"
										cx={item.anchor.x}
										cy={item.anchor.y}
										r={markerRadius() * 2.2}
									/>
								)}
								when={item.geometry}
							>
								<polygon
									class="visitor-location-hit"
									points={pointsAttribute(item.geometry ?? [])}
								/>
							</Show>
							<Show when={props.snapshot().state.layerVisibility.icon && visitorMarkers().has(item.destinationId)}>
								<circle
									class="visitor-marker-halo"
									cx={item.anchor.x}
									cy={item.anchor.y}
									r={markerRadius() * 1.45}
								/>
								<Show
									fallback={(
										<circle
											class="visitor-marker"
											cx={item.anchor.x}
											cy={item.anchor.y}
											r={markerRadius() * 0.72}
										/>
									)}
									when={item.symbolDataUrl ?? item.logoDataUrl}
								>
									<image
										class="visitor-marker-logo"
										height={markerRadius() * 1.7}
										href={item.symbolDataUrl ?? item.logoDataUrl}
										preserveAspectRatio="xMidYMid meet"
										width={markerRadius() * 1.7}
										x={item.anchor.x - markerRadius() * 0.85}
										y={item.anchor.y - markerRadius() * 0.85}
									/>
								</Show>
							</Show>
						</g>
					);
				}}
			</For>
			<Show when={props.snapshot().state.layerVisibility.icon}>
				<For each={visitorOrigins()}>
					{(origin): JSX.Element => {
						const radius = (): number => Math.max(8, 13 / props.camera().scale);

						return (
							<g
								aria-label={origin.label}
								class="visitor-origin-marker"
								classList={{
									'animation-pulse': originDefaults().animation2d === 'pulse',
									'animation-radar': originDefaults().animation2d === 'radar'
								}}
								data-animation-speed={originDefaults().animationSpeed}
								data-origin-animation-2d={originDefaults().animation2d}
								data-visitor-origin-id={origin.id}
								style={`--origin-color: ${originDefaults().color}; --origin-duration: ${Math.max(0.45, 72 / Math.max(1, originDefaults().animationSpeed))}s`}
							>
								<Show when={originDefaults().animation2d !== 'none'}>
									<circle
										class="visitor-origin-marker__pulse"
										cx={origin.point.x}
										cy={origin.point.y}
										r={radius() * 1.9}
									/>
								</Show>
								<circle
									class="visitor-origin-marker__core"
									cx={origin.point.x}
									cy={origin.point.y}
									r={radius() * 0.68}
								/>
								<path
									class="visitor-origin-marker__direction"
									d={`M ${origin.point.x} ${origin.point.y - radius() * 1.1} L ${origin.point.x - radius() * 0.42} ${origin.point.y - radius() * 0.35} L ${origin.point.x + radius() * 0.42} ${origin.point.y - radius() * 0.35} Z`}
									transform={`rotate(${origin.facingDegrees} ${origin.point.x} ${origin.point.y})`}
								/>
							</g>
						);
					}}
				</For>
			</Show>
			<Show when={props.snapshot().state.layerVisibility.label}>
				<For each={props.labelPlacements()}>
					{(placement): JSX.Element => {
						const selected = (): boolean => selection()?.kind === 'destination'
							&& selection()?.id === placement.item.destinationId;
						const connectionPoint = (): { x: number; y: number } => ({
							x: Math.max(
								placement.x,
								Math.min(placement.x + placement.width, placement.item.anchor.x)
							),
							y: Math.max(
								placement.y,
								Math.min(placement.y + placement.height, placement.item.anchor.y)
							)
						});

						return (
							<g
								aria-hidden="true"
								class="visitor-map-label"
								classList={{ selected: selected() }}
								data-visitor-destination-id={placement.item.destinationId}
								onPointerDown={(event) => {
									event.preventDefault();
									event.stopPropagation();
									props.activateDestination(placement.item.destinationId);
								}}
							>
								<title>{placement.item.name}</title>
								<line
									class="visitor-map-label__leader"
									x1={placement.item.anchor.x}
									x2={connectionPoint().x}
									y1={placement.item.anchor.y}
									y2={connectionPoint().y}
								/>
								<rect
									height={placement.height}
									rx={Math.min(8, placement.height / 4)}
									width={placement.width}
									x={placement.x}
									y={placement.y}
								/>
								<text
									dominant-baseline="middle"
									style={{ 'font-size': `${placement.fontSize}px` }}
									x={placement.x + 10 / props.camera().scale}
									y={placement.y + placement.height / 2}
								>
									{placement.displayText}
								</text>
							</g>
						);
					}}
				</For>
			</Show>
		</svg>
	);
};
