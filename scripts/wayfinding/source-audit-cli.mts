import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { migrateWayfindingSource } from './source-audit.mts';

interface Arguments {
	reportDirectory: string;
	svgPath: string;
}

const parseArguments = (values: string[]): Arguments => {
	let svgPath = '';
	let reportDirectory = 'wayfinding-source-audit';

	for (let index = 0; index < values.length; index += 1) {
		if (values[index] === '--svg') svgPath = values[index + 1] ?? '';

		if (values[index] === '--report-dir') reportDirectory = values[index + 1] ?? reportDirectory;
	}

	if (!svgPath) throw new Error('Usage: npm run wayfinding:audit-source -- --svg <map.svg> [--report-dir <directory>]');

	return { reportDirectory, svgPath };
};

const main = async (): Promise<void> => {
	const argumentsValue: Arguments = parseArguments(process.argv.slice(2));
	const source: string = await readFile(argumentsValue.svgPath, 'utf8');
	const migration = migrateWayfindingSource(source);
	const reportDirectory: string = path.resolve(argumentsValue.reportDirectory);

	await mkdir(reportDirectory, { recursive: true });
	await Promise.all([
		writeFile(path.join(reportDirectory, 'source-audit.json'), `${JSON.stringify(migration.audit, null, 2)}\n`),
		writeFile(path.join(reportDirectory, 'annotated-map.svg'), migration.annotatedSvg),
		writeFile(path.join(reportDirectory, 'anchor-proposal.json'), `${JSON.stringify({
			anchors: migration.audit.anchors,
			contractVersion: 1,
			message: 'Proposed anchors only. No graph edges were inferred.',
			proposalType: 'wayfinding-location-anchors',
			reviewStatus: 'proposed'
		}, null, 2)}\n`)
	]);

	const errorCount: number = migration.audit.issues.filter((issue): boolean => issue.severity === 'error').length;

	process.stdout.write(`Wayfinding source audit: ${errorCount} error(s), ${migration.audit.issues.length - errorCount} review item(s).\nArtifacts: ${reportDirectory}\n`);

	if (errorCount > 0) process.exitCode = 1;
};

await main();
