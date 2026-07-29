import {
	AlertTriangle,
	CheckCircle2,
	CircleDot,
	Focus,
	GitBranch,
	Search,
	WandSparkles
} from 'lucide-solid';
import {
	createMemo,
	createSignal,
	For,
	Show,
	untrack,
	type Accessor,
	type JSX
} from 'solid-js';

import { selectedFloor } from '../../../editor-core/selectors';
import type { EditorSnapshot, EditorStore } from '../../../editor-core/types';
import type { CanvasSelectionActions } from '../Canvas2d';
import {
	inspectRouteGeometry,
	repairRouteGeometry,
	type RouteGeometryIssue
} from '../route-geometry';

interface RouteGraphNavigatorProps {
	selectionActions: Accessor<CanvasSelectionActions | undefined>;
	snapshot: Accessor<EditorSnapshot>;
	store: EditorStore;
}

interface GraphIssue extends RouteGeometryIssue {
	id: string;
	kind: 'graph-edge' | 'graph-node';
}

export const RouteGraphNavigator = (props: RouteGraphNavigatorProps): JSX.Element => {
	const [query, setQuery] = createSignal('');
	const state = createMemo(() => props.snapshot().state);
	const floor = createMemo(() => selectedFloor(state()));
	const nodes = createMemo(() => state().project.graph.nodes.filter((node) => node.levelId === floor().id));
	const nodeIds = createMemo(() => new Set(nodes().map((node) => node.id)));
	const edges = createMemo(() => state().project.graph.edges.filter((edge) =>
		nodeIds().has(edge.from) || nodeIds().has(edge.to)
	));
	const degree = createMemo(() => {
		const result = new Map<string, number>();

		edges().forEach((edge) => {
			result.set(edge.from, (result.get(edge.from) ?? 0) + 1);
			result.set(edge.to, (result.get(edge.to) ?? 0) + 1);
		});

		return result;
	});
	const issues = createMemo<GraphIssue[]>(() => [
		...nodes()
			.filter((node) => (degree().get(node.id) ?? 0) === 0)
			.map((node) => ({
				code: 'missing-endpoint' as const,
				id: node.id,
				kind: 'graph-node' as const,
				message: `${node.id} is not connected to the route network.`,
				severity: 'error' as const
			})),
		...edges().flatMap((edge) => inspectRouteGeometry(edge, state().project.graph.nodes).map((issue) => ({
			...issue,
			id: edge.id,
			kind: 'graph-edge' as const
		})))
	]);
	const normalizedQuery = createMemo(() => query().trim().toLocaleLowerCase());
	const filteredNodes = createMemo(() => nodes().filter((node) =>
		!normalizedQuery() || `${node.id} ${node.kind}`.toLocaleLowerCase().includes(normalizedQuery())
	));
	const filteredEdges = createMemo(() => edges().filter((edge) =>
		!normalizedQuery() || `${edge.id} ${edge.from} ${edge.to}`.toLocaleLowerCase().includes(normalizedQuery())
	));
	const select = (kind: 'graph-edge' | 'graph-node', id: string): void => {
		props.store.dispatch({ type: 'selection/set', selection: { id, kind } });
		props.store.dispatch({ type: 'tool/set', tool: 'select' });
	};
	const focus = (kind: 'graph-edge' | 'graph-node', id: string): void => {
		select(kind, id);
		queueMicrotask(() => untrack(() => props.selectionActions())?.fit());
	};
	const repair = (edgeId: string): void => {
		const edge = state().project.graph.edges.find((candidate) => candidate.id === edgeId);

		if (!edge) return;
		const geometry = repairRouteGeometry(edge, state().project.graph.nodes);

		if (!geometry) return;
		props.store.dispatch({ type: 'graph/edge-patch', edgeId, patch: { geometry } });
		select('graph-edge', edgeId);
	};

	return (
		<div class="route-graph-browser">
			<div class="route-graph-heading">
				<span>
					<strong>Route network health</strong>
					<small>{edges().length} segments connect {nodes().length} junctions</small>
				</span>
				<Show
					when={issues().length > 0}
					fallback={<span class="diagnostic-count healthy"><CheckCircle2 size={14} />Ready</span>}
				>
					<span class="diagnostic-count"><AlertTriangle size={14} />{issues().length} to review</span>
				</Show>
			</div>
			<label class="search-field">
				<Search size={15} />
				<input
					type="search"
					value={query()}
					placeholder="Find a junction or segment"
					onInput={(event) => setQuery(event.currentTarget.value)}
				/>
			</label>
			<Show when={issues().length > 0}>
				<div class="route-diagnostics">
					<div class="route-diagnostics__intro">
						<strong>Repair suggestions</strong>
						<span>Focus a problem on the map, then apply the suggested geometry repair.</span>
					</div>
					<For each={issues()}>{(issue) => (
						<div class="route-diagnostic" classList={{ error: issue.severity === 'error' }}>
							<button
								type="button"
								class="route-diagnostic-main"
								onClick={() => focus(issue.kind, issue.id)}
							>
								<AlertTriangle size={14} /><span>{issue.message}</span>
							</button>
							<Show when={issue.kind === 'graph-edge' && issue.code !== 'missing-endpoint'}>
								<button
									type="button"
									class="route-diagnostic-action"
									aria-label={`Repair ${issue.id}`}
									title="Repair this segment"
									onClick={() => repair(issue.id)}
								><WandSparkles size={14} /></button>
							</Show>
						</div>
					)}</For>
				</div>
			</Show>
			<details class="route-advanced-list">
				<summary>
					<span><strong>Advanced network objects</strong><small>Inspect IDs and individual geometry</small></span>
					<span>{nodes().length + edges().length}</span>
				</summary>
				<div class="route-object-list">
					<For each={filteredNodes()}>{(node) => (
						<div
							class="route-object"
							classList={{ active: state().selection?.kind === 'graph-node' && state().selection?.id === node.id }}
						>
							<button type="button" class="route-object-main" onClick={() => select('graph-node', node.id)}>
								<CircleDot size={14} /><span>{node.id}</span><small>{node.kind}</small>
							</button>
							<button
								type="button"
								class="route-object-action"
								aria-label={`Focus ${node.id}`}
								onClick={() => focus('graph-node', node.id)}
							><Focus size={14} /></button>
						</div>
					)}</For>
					<For each={filteredEdges()}>{(edge) => (
						<div
							class="route-object"
							classList={{ active: state().selection?.kind === 'graph-edge' && state().selection?.id === edge.id }}
						>
							<button type="button" class="route-object-main" onClick={() => select('graph-edge', edge.id)}>
								<GitBranch size={14} /><span>{edge.id}</span><small>{Math.max(0, (edge.geometry?.length ?? 2) - 2)} bends</small>
							</button>
							<button
								type="button"
								class="route-object-action"
								aria-label={`Focus ${edge.id}`}
								onClick={() => focus('graph-edge', edge.id)}
							><Focus size={14} /></button>
						</div>
					)}</For>
				</div>
			</details>
		</div>
	);
};
