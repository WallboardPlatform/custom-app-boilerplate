import {
	Info,
	Network,
	RefreshCw
} from 'lucide-solid';
import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';

import type {
	RouteBuildDiagnostic,
	RouteBuildResult
} from '../../../../editor-core/route-builder.mts';
import type {
	RouteReadiness,
	RouteReadinessItem
} from './route-readiness';

export const RouteBuildView = (props: {
	edgeCount: Accessor<number>;
	onBuild: () => void;
	onOpenDiagnostic: (diagnostic: RouteBuildDiagnostic) => void;
	onOpenRequirement: (item: RouteReadinessItem) => void;
	readiness: Accessor<RouteReadiness>;
	report: Accessor<RouteBuildResult | undefined>;
	nodeCount: Accessor<number>;
}): JSX.Element => (
	<>
		<div class="workflow-intro">
			<small>Step 2</small>
			<strong>Generate the first network</strong>
			<p>The builder connects linked doors through reviewed pedestrian space. Reviewed and hand-authored corrections are preserved.</p>
		</div>
		<div class="route-summary route-summary--large">
			<span><strong>{props.nodeCount()}</strong> nodes</span>
			<span><strong>{props.edgeCount()}</strong> segments</span>
		</div>
		<Show when={props.readiness().buildBlockers.length > 0}>
			<div class="route-build-requirements" aria-label="Route build requirements">
				<div class="route-build-requirements__heading">
					<strong>Complete {props.readiness().buildBlockers.length} requirement{props.readiness().buildBlockers.length === 1 ? '' : 's'}</strong>
					<span>Each item opens the exact tool you need.</span>
				</div>
				<For each={props.readiness().buildBlockers}>
					{(item, index) => (
						<button
							type="button"
							class="route-build-requirement"
							onClick={() => props.onOpenRequirement(item)}
						>
							<span>{index() + 1}</span>
							<span>
								<strong>{item.title}</strong>
								<small>{item.body}</small>
							</span>
							<span aria-hidden="true">Fix</span>
						</button>
					)}
				</For>
			</div>
		</Show>
		<Show when={
			props.readiness().routeReadyDestinationsOnFloor > 0
			&& props.readiness().skippedDestinationsOnFloor > 0
		}>
			<div class="route-build-note">
				<Info size={17} />
				<span>
					<strong>{props.readiness().routeReadyDestinationsOnFloor} entrance-ready destination{props.readiness().routeReadyDestinationsOnFloor === 1 ? '' : 's'} will be connected.</strong>
					<Show when={props.readiness().unlinkedDestinationsOnFloor > 0}>
						{` ${props.readiness().unlinkedDestinationsOnFloor} mapped room ${props.readiness().unlinkedDestinationsOnFloor === 1 ? 'needs' : 'need'} a linked public entrance.`}
					</Show>
					<Show when={props.readiness().unpositionedDestinations > 0}>
						{` ${props.readiness().unpositionedDestinations} directory-only ${props.readiness().unpositionedDestinations === 1 ? 'entry will' : 'entries will'} be skipped until placed on the map.`}
					</Show>
				</span>
			</div>
		</Show>
		<div class="route-build-cta">
			<button
				type="button"
				class="wb-studio-action primary full"
				disabled={props.readiness().buildBlockers.length > 0}
				onClick={() => props.onBuild()}
			>
				<RefreshCw size={16} />
				{props.edgeCount() ? 'Rebuild route network' : 'Build route network'}
			</button>
		</div>
		<div class="route-tip">
			<Network size={17} />
			<span>Generation is a starting point. Review every destination route in Test before publishing.</span>
		</div>
		<Show when={props.report()}>
			{(report) => (
				<div
					class="route-build-report"
					classList={{
						warning: report().diagnostics.length > 0
							|| props.readiness().blockers.length > 0
							|| props.readiness().warnings.length > 0
					}}
				>
					<div class="route-build-report__summary">
						<strong>
							{props.readiness().connectedDestinations}/{props.readiness().routeableDestinations}
						</strong>
						<span>routeable destinations ready</span>
					</div>
					<dl class="route-build-report__diff">
						<div>
							<dt>Generated</dt>
							<dd>{report().diff.generatedEdgesAfter} segments</dd>
						</div>
						<div>
							<dt>Preserved</dt>
							<dd>{report().diff.manualEdgesPreserved} manual</dd>
						</div>
					</dl>
					<Show
						when={report().diagnostics.length > 0}
						fallback={
							<p>
								{props.readiness().warnings[0]?.body
									?? 'Every routeable destination can be reached from an installed screen.'}
							</p>
						}
					>
						<ul>
							<For each={report().diagnostics}>
								{(diagnostic) => (
									<li>
										<Show
											when={diagnostic.elementId}
											fallback={<span>{diagnostic.message}</span>}
										>
											<button
												type="button"
												onClick={() => props.onOpenDiagnostic(diagnostic)}
											>
												<span>{diagnostic.message}</span>
												<strong>Show on map</strong>
											</button>
										</Show>
									</li>
								)}
							</For>
						</ul>
					</Show>
				</div>
			)}
		</Show>
	</>
);
