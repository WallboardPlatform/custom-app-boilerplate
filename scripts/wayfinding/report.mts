import fs from 'node:fs';
import path from 'node:path';

import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

import type { WayfindingEdge, WayfindingGraphDocument, WayfindingNode } from '../../src/utils/wayfinding.js';
import type { WayfindingValidationReport } from './validation.mjs';

const escapeHtml = (value: string): string => value
	.replaceAll('&', '&amp;')
	.replaceAll('<', '&lt;')
	.replaceAll('>', '&gt;')
	.replaceAll('"', '&quot;');

const edgeColor = (edge: WayfindingEdge): string => {
	if (!edge.accessible) return '#ef4444';

	if (edge.kind === 'elevator') return '#22c55e';

	if (edge.kind === 'stairs' || edge.kind === 'escalator') return '#f59e0b';

	if (edge.kind === 'outdoor') return '#0ea5e9';

	return '#ec4899';
};

const sanitizeSvgForReport = (sourceSvg: string): string => {
	const document = new DOMParser().parseFromString(sourceSvg, 'image/svg+xml');
	const forbiddenTags = new Set(['script', 'foreignobject', 'iframe', 'object']);
	const visit = (node: Node): void => {
		for (let child: ChildNode | null = node.firstChild; child;) {
			const next: ChildNode | null = child.nextSibling;

			if (child.nodeType === child.ELEMENT_NODE) {
				const element = child as Element;

				if (forbiddenTags.has(element.tagName.toLowerCase())) {
					node.removeChild(child);
					child = next;

					continue;
				}

				for (let index = element.attributes.length - 1; index >= 0; index -= 1) {
					const attribute: Attr = element.attributes.item(index)!;
					const unsafeUrl: boolean = /^(?:href|xlink:href)$/i.test(attribute.name) && /^\s*javascript:/i.test(attribute.value);

					if (/^on/i.test(attribute.name) || unsafeUrl) element.removeAttribute(attribute.name);
				}
			}

			visit(child);
			child = next;
		}
	};

	visit(document);

	return new XMLSerializer().serializeToString(document);
};

export const createDebugSvg = (sourceSvg: string, graph: WayfindingGraphDocument, highlightedNodeIds: string[] = []): string => {
	const nodeById = new Map(graph.nodes.map((node: WayfindingNode): [string, WayfindingNode] => [node.id, node]));
	const lines: string[] = graph.edges.flatMap((edge: WayfindingEdge): string[] => {
		const from: WayfindingNode | undefined = nodeById.get(edge.from);
		const to: WayfindingNode | undefined = nodeById.get(edge.to);

		if (!from || !to || from.levelId !== to.levelId) return [];

		const legacy: boolean = graph.generation?.mode === 'legacy-proximity';

		return [`<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${legacy ? '#64748b' : edgeColor(edge)}" stroke-width="1.5" stroke-opacity="${legacy ? '0.42' : '0.68'}" vector-effect="non-scaling-stroke"><title>${escapeHtml(edge.id)}</title></line>`];
	});
	const nodes: string[] = graph.nodes.map((node: WayfindingNode): string => {
		const color: string = node.kind === 'location' ? '#facc15' : node.kind === 'transition' ? '#a855f7' : '#2563eb';
		const radius: number = node.kind === 'route' ? 2.5 : 5;

		return `<circle cx="${node.x}" cy="${node.y}" r="${radius}" fill="${color}" stroke="#ffffff" stroke-width="0.8" vector-effect="non-scaling-stroke"><title>${escapeHtml(node.id)}</title></circle>`;
	});
	const highlightedRoute: string[] = highlightedNodeIds.slice(1).flatMap((nodeId: string, index: number): string[] => {
		const from: WayfindingNode | undefined = nodeById.get(highlightedNodeIds[index]);
		const to: WayfindingNode | undefined = nodeById.get(nodeId);

		if (!from || !to || from.levelId !== to.levelId) return [];

		return [`<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#dc2626" stroke-width="5" stroke-opacity="0.95" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`];
	});
	const overlay = `<g id="wb-wayfinding-debug" pointer-events="none">${lines.join('')}<g id="wb-wayfinding-route-highlight">${highlightedRoute.join('')}</g>${nodes.join('')}</g>`;

	return sanitizeSvgForReport(sourceSvg).replace(/<\/svg>\s*$/i, `${overlay}</svg>`);
};

export const createReportHtml = (report: WayfindingValidationReport): string => {
	const issueRows: string = report.issues.map((issue): string => `<tr class="${issue.severity}"><td>${issue.severity}</td><td>${escapeHtml(issue.code)}</td><td>${escapeHtml(issue.message)}</td><td>${escapeHtml(issue.references.join(', '))}</td></tr>`).join('');
	const routeRows: string = report.routes.map((route): string => `<tr><td>${escapeHtml(route.destinationId)}</td><td>${route.reachable ? 'yes' : 'no'}</td><td>${route.stepFreeReachable === null ? 'unknown' : route.stepFreeReachable ? 'yes' : 'no'}</td><td>${route.nodeCount}</td><td>${route.walkingDistance ?? '-'}</td><td>${escapeHtml(route.nodeIds.join(' -> '))}</td></tr>`).join('');
	const highlightedRoute: string = report.highlightedRoute
		? `<p>Highlighted route: <strong>${escapeHtml(report.highlightedRoute.destinationId)}</strong> (${report.highlightedRoute.edgeIds.length} edges).</p>`
		: '<p>No representative route is highlighted.</p>';

	return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wallboard wayfinding validation</title><style>
body{font:14px/1.45 Arial,sans-serif;margin:0;background:#f3f4f6;color:#111827}main{max-width:1200px;margin:auto;padding:32px}h1{font-size:28px}.summary{display:flex;flex-wrap:wrap;gap:12px}.summary div{background:#fff;border:1px solid #d1d5db;padding:12px 18px;min-width:130px}.summary strong{display:block;font-size:24px}table{width:100%;border-collapse:collapse;background:#fff;margin:16px 0 32px}th,td{text-align:left;vertical-align:top;padding:9px;border:1px solid #d1d5db}th{background:#e5e7eb}.error td:first-child{color:#b91c1c;font-weight:bold}.warning td:first-child{color:#92400e;font-weight:bold}object{width:100%;height:70vh;background:#fff;border:1px solid #d1d5db}
</style></head><body><main><h1>Wayfinding validation</h1>
<section class="summary"><div><strong>${report.summary.errors}</strong>errors</div><div><strong>${report.summary.warnings}</strong>warnings</div><div><strong>${report.graph.nodes}</strong>nodes</div><div><strong>${report.graph.edges}</strong>edges</div><div><strong>${report.summary.routesReachable}/${report.summary.routeableDestinations}</strong>routes</div><div><strong>${report.graph.maxDegree}</strong>max degree</div></section>
<h2>Issues</h2><table><thead><tr><th>Severity</th><th>Code</th><th>Message</th><th>References</th></tr></thead><tbody>${issueRows || '<tr><td colspan="4">No issues.</td></tr>'}</tbody></table>
<h2>Route coverage</h2><table><thead><tr><th>Destination</th><th>Reachable</th><th>Step-free</th><th>Nodes</th><th>Distance</th><th>Node sequence</th></tr></thead><tbody>${routeRows || '<tr><td colspan="6">No route checks.</td></tr>'}</tbody></table>
<h2>Graph and route overlay</h2>${highlightedRoute}<object data="wayfinding-debug.svg" type="image/svg+xml"></object></main></body></html>`;
};

export const writeWayfindingReport = (
	directory: string,
	sourceSvg: string,
	graph: WayfindingGraphDocument,
	report: WayfindingValidationReport
): void => {
	fs.mkdirSync(directory, { recursive: true });
	fs.writeFileSync(path.join(directory, 'wayfinding-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
	fs.writeFileSync(path.join(directory, 'wayfinding-debug.svg'), createDebugSvg(sourceSvg, graph, report.highlightedRoute?.nodeIds), 'utf8');
	fs.writeFileSync(path.join(directory, 'index.html'), createReportHtml(report), 'utf8');
};
