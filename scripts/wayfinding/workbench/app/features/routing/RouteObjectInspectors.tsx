import {
	AlertTriangle,
	Network,
	Route
} from 'lucide-solid';
import {
	createMemo,
	Show,
	type JSX
} from 'solid-js';
import type {
	WayfindingEdge,
	WayfindingNode,
	WayfindingTraversal
} from '../../../../../../src/utils/wayfinding.js';
import type { EditorStore } from '../../../../editor-core/types';
import {
	Field,
	InspectorGroup,
	InspectorHero,
	PanelSection
} from '../../ui';
import { DraftInput } from '../../components/draft-fields';
import {
	inspectRouteGeometry,
	repairRouteGeometry,
	straightenRouteGeometry
} from './route-geometry';
import { routeGeometryIssueMessage } from './route-labels';

export const GraphNodeInspector = (props: {
	node: WayfindingNode;
	store: EditorStore;
}): JSX.Element => {
	const patch = (value: Partial<WayfindingNode>): void => props.store.dispatch({
		type: 'graph/node-patch',
		nodeId: props.node.id,
		patch: value
	});

	return (
		<PanelSection title="Route point" eyebrow="Selection" defaultOpen>
			<InspectorHero
				body="Shapes the authored network. Move it on the canvas to correct a route without rebuilding the floor."
				eyebrow="Network geometry"
				icon={Network}
				title={props.node.kind === 'route' ? 'Path control point' : props.node.kind === 'location' ? 'Destination endpoint' : 'Floor transition'}
			/>
			<Field label="Point role" hint="Route points shape paths; destination and transition points connect semantic map objects.">
				<select
					value={props.node.kind}
					onChange={(event) => patch({ kind: event.currentTarget.value as WayfindingNode['kind'] })}
				>
					<option value="route">Route point</option>
					<option value="location">Destination endpoint</option>
					<option value="transition">Floor transition</option>
				</select>
			</Field>
			<Show when={props.node.kind !== 'route'}>
				<Field label="Linked map object ID">
					<DraftInput
						value={props.node.semanticElementId ?? ''}
						onCommit={(semanticElementId) => patch({ semanticElementId: semanticElementId || undefined })}
					/>
				</Field>
			</Show>
			<PanelSection title="Advanced" eyebrow="Technical">
				<Field label="Stable ID" hint="Used by route segments. It remains stable when the point moves.">
					<input value={props.node.id} disabled />
				</Field>
				<div class="field-grid">
					<Field label="X position">
						<DraftInput
							value={String(Math.round(props.node.x))}
							onCommit={(value) => {
								const x = Number(value);

								if (Number.isFinite(x)) patch({ x });
							}}
						/>
					</Field>
					<Field label="Y position">
						<DraftInput
							value={String(Math.round(props.node.y))}
							onCommit={(value) => {
								const y = Number(value);

								if (Number.isFinite(y)) patch({ y });
							}}
						/>
					</Field>
				</div>
			</PanelSection>
			<button
				type="button"
				class="wb-studio-action danger block"
				onClick={() => props.store.dispatch({ type: 'graph/node-remove', nodeId: props.node.id })}
			>
				Delete route point
			</button>
		</PanelSection>
	);
};

export const GraphEdgeInspector = (props: {
	edge: WayfindingEdge;
	geometryIndex?: number;
	store: EditorStore;
}): JSX.Element => {
	const patch = (value: Partial<WayfindingEdge>): void => props.store.dispatch({
		type: 'graph/edge-patch',
		edgeId: props.edge.id,
		patch: value
	});
	const removeGeometryPoint = (): void => {
		if (props.geometryIndex === undefined || !props.edge.geometry || props.edge.geometry.length <= 2) return;
		patch({ geometry: props.edge.geometry.filter((_, index) => index !== props.geometryIndex) });
		props.store.dispatch({
			type: 'selection/set',
			selection: { id: props.edge.id, kind: 'graph-edge' }
		});
	};
	const nodes = (): WayfindingNode[] => props.store.getSnapshot().state.project.graph.nodes;
	const diagnostics = createMemo(() => inspectRouteGeometry(props.edge, nodes()));
	const diagnosticMessage = createMemo(() => {
		const issue = diagnostics()[0];

		return issue
			? routeGeometryIssueMessage(
				props.store.getSnapshot().state.project,
				issue,
				props.edge,
				nodes()
			)
			: undefined;
	});
	const repairGeometry = (): void => {
		const geometry = repairRouteGeometry(props.edge, nodes());

		if (geometry) patch({ geometry });
	};
	const straightenGeometry = (): void => {
		const geometry = straightenRouteGeometry(props.edge, nodes());

		if (geometry) patch({ geometry });
	};

	return (
		<PanelSection title="Route segment" eyebrow="Selection" defaultOpen>
			<InspectorHero
				badge={props.edge.reviewStatus === 'confirmed' ? 'Reviewed' : 'Needs review'}
				body="Controls how visitors may travel between two route points."
				eyebrow="Network geometry"
				icon={Route}
				title={props.edge.kind === 'walk' ? 'Walking segment' : `${props.edge.kind[0]?.toUpperCase()}${props.edge.kind.slice(1)} segment`}
			/>
			<Show when={diagnostics().length > 0}>
				<div class="property-warning">
					<AlertTriangle size={15} />
					<span>{diagnosticMessage()}</span>
				</div>
			</Show>
			<InspectorGroup
				title="Movement rules"
				body="Define the physical space and the journeys that may use this segment."
			>
				<div class="field-grid">
					<Field label="Route type">
						<select
							value={props.edge.kind}
							onChange={(event) => patch({ kind: event.currentTarget.value as WayfindingEdge['kind'] })}
						>
							<option value="walk">Walking</option>
							<option value="outdoor">Outdoor</option>
							<option value="stairs">Stairs</option>
							<option value="elevator">Elevator</option>
							<option value="escalator">Escalator</option>
							<option value="shuttle">Shuttle</option>
						</select>
					</Field>
					<Field label="Space">
						<select
							value={props.edge.traversal ?? 'indoor-corridor'}
							onChange={(event) => patch({ traversal: event.currentTarget.value as WayfindingTraversal })}
						>
							<option value="indoor-corridor">Indoor corridor</option>
							<option value="open-area">Open area</option>
							<option value="portal">Door or entrance</option>
							<option value="outdoor-path">Outdoor path</option>
							<option value="crossing">Crossing</option>
							<option value="transition">Floor transition</option>
						</select>
					</Field>
				</div>
				<div class="field-grid">
					<Field label="Corridor width" hint="Optional real-world width used by accessibility rules.">
						<DraftInput
							value={props.edge.corridorWidth ? String(props.edge.corridorWidth) : ''}
							onCommit={(value) => {
								const corridorWidth = Number(value);

								patch({ corridorWidth: Number.isFinite(corridorWidth) && corridorWidth > 0 ? corridorWidth : undefined });
							}}
						/>
					</Field>
					<Field
						label="Route review"
						hint="Marks whether this segment has been checked against the real walking path."
					>
						<select
							value={props.edge.reviewStatus ?? 'proposed'}
							onChange={(event) => patch({ reviewStatus: event.currentTarget.value as WayfindingEdge['reviewStatus'] })}
						>
							<option value="proposed">Needs review</option>
							<option value="confirmed">Reviewed</option>
						</select>
					</Field>
				</div>
				<label class="inline-toggle inspector-toggle">
					<input
						type="checkbox"
						checked={props.edge.bidirectional}
						onChange={(event) => patch({ bidirectional: event.currentTarget.checked })}
					/>
					Travel in both directions
				</label>
				<label class="inline-toggle inspector-toggle">
					<input
						type="checkbox"
						checked={props.edge.accessible}
						onChange={(event) => patch({ accessible: event.currentTarget.checked })}
					/>
					Include in step-free routes
				</label>
			</InspectorGroup>
			<InspectorGroup
				title="Geometry"
				body="Use these tools when a generated segment bends unnecessarily or leaves the pedestrian area."
			>
				<div class="inspector-action-grid">
					<button type="button" class="wb-studio-action" onClick={repairGeometry}>
						Clean geometry
					</button>
					<button
						type="button"
						class="wb-studio-action"
						title="Replace all bends with a direct segment. Confirm that it stays inside walkable space."
						onClick={straightenGeometry}
					>
						Use direct line
					</button>
				</div>
				<Show when={props.geometryIndex !== undefined}>
					<button
						type="button"
						class="wb-studio-action block"
						disabled={!props.edge.geometry || props.edge.geometry.length <= 2}
						onClick={removeGeometryPoint}
					>
						Delete selected bend
					</button>
				</Show>
			</InspectorGroup>
			<PanelSection title="Advanced" eyebrow="Technical">
				<Field label="Stable ID">
					<input value={props.edge.id} disabled />
				</Field>
			</PanelSection>
			<button
				type="button"
				class="wb-studio-action danger block"
				onClick={() => props.store.dispatch({ type: 'graph/edge-remove', edgeId: props.edge.id })}
			>
				Delete route segment
			</button>
		</PanelSection>
	);
};
