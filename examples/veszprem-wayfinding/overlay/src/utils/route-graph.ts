import type { WayfindingNode } from '@utils/wayfinding';
import { createLegacyProximityGraph, WayfindingGraph } from '@utils/wayfinding';

const locationId = (element: Element): string | undefined => {
	const explicit: string | null = element.getAttribute('data-location-id');

	if (explicit) return explicit;

	if (element.id.startsWith('lp-')) return element.id.slice(3);

	if (element.id.endsWith('-lp')) return element.id.slice(0, -3);

	return undefined;
};

const extractPoints = (svg: SVGSVGElement, selector: string, kind: WayfindingNode['kind']): WayfindingNode[] => {
	return Array.from(svg.querySelectorAll(selector)).flatMap((element: Element): WayfindingNode[] => {
		const x: number = Number(element.getAttribute('cx'));
		const y: number = Number(element.getAttribute('cy'));

		if (!element.id || !Number.isFinite(x) || !Number.isFinite(y)) return [];

		return [{
			id: element.id,
			kind,
			levelId: element.closest('g[id$="-LocationPoints"], g[id$="-RoutePoints"], g[id$="-TransitionPoints"]')?.id
				.replace(/-(LocationPoints|RoutePoints|TransitionPoints)$/, '') ?? 'Level0',
			locationId: kind === 'location' ? locationId(element) : undefined,
			x,
			y
		}];
	});
};

export const createLegacyRouteGraph = (svg: SVGSVGElement, sensitivity: number): WayfindingGraph => {
	const nodes: WayfindingNode[] = [
		...extractPoints(svg, 'g[id$="-RoutePoints"] circle', 'route'),
		...extractPoints(svg, 'g[id$="-LocationPoints"] circle', 'location'),
		...extractPoints(svg, 'g[id$="-TransitionPoints"] circle', 'transition')
	];

	return new WayfindingGraph(createLegacyProximityGraph('veszprem-legacy', nodes, sensitivity));
};
