import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import type { WayfindingGraphDocument, WayfindingNode } from '../../src/utils/wayfinding.js';

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const findElementById = (node: Node, id: string): Element | undefined => {
	if (node.nodeType === node.ELEMENT_NODE && (node as Element).getAttribute('id') === id) return node as Element;

	for (let child: ChildNode | null = node.firstChild; child; child = child.nextSibling) {
		const match: Element | undefined = findElementById(child, id);

		if (match) return match;
	}

	return undefined;
};

const pointGroupSuffix = (node: WayfindingNode): string => {
	if (node.kind === 'location') return 'LocationPoints';

	if (node.kind === 'transition') return 'TransitionPoints';

	return 'RoutePoints';
};

const clearChildren = (element: Element): void => {
	while (element.firstChild) element.removeChild(element.firstChild);
};

export const synchronizeSvgPoints = (sourceSvg: string, graph: WayfindingGraphDocument): string => {
	const errors: string[] = [];
	const document = new DOMParser({
		errorHandler: {
			error: (message: string): void => { errors.push(message); },
			fatalError: (message: string): void => { errors.push(message); },
			warning: (): void => undefined
		}
	}).parseFromString(sourceSvg, 'image/svg+xml');

	if (errors.length > 0) throw new Error(`Cannot synchronize invalid SVG: ${errors.join('; ')}`);

	const levelIds: string[] = [...new Set(graph.nodes.map((node: WayfindingNode): string => node.levelId))];

	for (const levelId of levelIds) {
		for (const suffix of ['TransitionPoints', 'LocationPoints', 'RoutePoints']) {
			const groupId: string = `${levelId}-${suffix}`;
			const group: Element | undefined = findElementById(document, groupId);

			if (!group) throw new Error(`Cannot synchronize missing SVG group '${groupId}'.`);
			clearChildren(group);
		}
	}

	for (const node of graph.nodes) {
		const groupId: string = `${node.levelId}-${pointGroupSuffix(node)}`;
		const group: Element | undefined = findElementById(document, groupId);

		if (!group) throw new Error(`Cannot synchronize graph node '${node.id}': group '${groupId}' is missing.`);

		const circle: Element = document.createElementNS(SVG_NAMESPACE, 'circle');
		circle.setAttribute('id', node.id);
		circle.setAttribute('cx', String(node.x));
		circle.setAttribute('cy', String(node.y));
		circle.setAttribute('r', node.kind === 'route' ? '4' : '5');
		circle.setAttribute('fill', '#000000');
		circle.setAttribute('fill-opacity', '0');
		circle.setAttribute('stroke', 'none');
		circle.setAttribute('stroke-width', '0');

		if (node.locationId) circle.setAttribute('data-location-id', node.locationId);
		group.appendChild(circle);
	}

	return new XMLSerializer().serializeToString(document);
};
