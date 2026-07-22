import fs from 'node:fs';
import path from 'node:path';

import type { WayfindingStudioDestination, WayfindingStudioElementStatus } from './studio-project.mjs';
import { importAnnotatedWayfindingSvg, migrateWayfindingArtifacts, touchWayfindingStudioProject } from './studio-project.mjs';
import { parseWayfindingProject } from './schema.mjs';

const argument = (name: string): string | undefined => {
	const index: number = process.argv.indexOf(`--${name}`);

return index >= 0 ? process.argv[index + 1] : undefined;
};
const required = (name: string): string => {
	const value: string | undefined = argument(name);

	if (!value) throw new Error(`Missing --${name}.`);

return path.resolve(value);
};
const deliveryPath: string = required('delivery');
const svgPath: string = required('svg');
const destinationPath: string = required('destinations');
const outputPath: string = required('output');
const backgroundPath: string | undefined = argument('background');
const floorId: string = argument('floor-id') ?? 'level-0';
const floorName: string = argument('floor-name') ?? 'Level 0';
const status: WayfindingStudioElementStatus = argument('status') === 'confirmed' ? 'confirmed' : 'proposed';
const delivery = parseWayfindingProject(fs.readFileSync(deliveryPath, 'utf8'));
const destinationValue: unknown = JSON.parse(fs.readFileSync(destinationPath, 'utf8')) as unknown;
const destinationRecord = destinationValue as { Destinations?: { rows?: WayfindingStudioDestination[] } };
const destinations: WayfindingStudioDestination[] = Array.isArray(destinationValue) ? destinationValue as WayfindingStudioDestination[] : destinationRecord.Destinations?.rows ?? [];
const project = migrateWayfindingArtifacts(delivery, undefined, destinations);
project.floors = [{ elements: [], height: 1080, id: floorId, name: floorName, order: 0, width: 1920 }];
const imported: number = importAnnotatedWayfindingSvg(project, floorId, fs.readFileSync(svgPath, 'utf8'), status);

if (backgroundPath) {
	const resolved: string = path.resolve(backgroundPath);
	const extension: string = path.extname(resolved).toLowerCase();
	const mimeType: string = extension === '.webp'
		? 'image/webp'
		: extension === '.jpg' || extension === '.jpeg'
			? 'image/jpeg'
			: extension === '.svg'
				? 'image/svg+xml'
				: 'image/png';
	const assetId = `background:${floorId}`;
	project.assets.push({ dataUrl: `data:${mimeType};base64,${fs.readFileSync(resolved).toString('base64')}`, id: assetId, kind: 'background', mimeType, name: path.basename(resolved) });
	project.floors[0].backgroundAssetId = assetId;
}
project.name = argument('name') ?? delivery.projectId;
touchWayfindingStudioProject(project);
fs.writeFileSync(outputPath, `${JSON.stringify(project, null, 2)}\n`);
process.stdout.write(`Imported ${imported} ${status} semantic target(s) into ${outputPath}\n`);
