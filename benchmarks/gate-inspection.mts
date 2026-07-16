import fs from 'node:fs';
import path from 'node:path';

import { normalizeDatasourceBindings } from '../scripts/datasource-provisioning.mjs';
import { validateSyntheticSample } from '../scripts/example-data-privacy.mjs';

export interface DatasourceGateResult {
	contractValid: boolean;
	fictionalOnly: boolean;
}

export const validateDatasourceGate = (workspace: string, projectValid: boolean): DatasourceGateResult => {
	try {
		const briefPath: string = path.join(workspace, 'generation-brief.json');

		if (!fs.existsSync(briefPath)) {
			return { contractValid: false, fictionalOnly: false };
		}

		const brief = JSON.parse(fs.readFileSync(briefPath, 'utf8')) as { data?: { mode?: string } };
		const contractPath: string = path.join(workspace, 'datasource-contract.json');

		if (brief.data?.mode === 'static') {
			return { contractValid: projectValid && !fs.existsSync(contractPath), fictionalOnly: true };
		}

		if (!fs.existsSync(contractPath)) {
			return { contractValid: false, fictionalOnly: false };
		}

		const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
		const bindings = normalizeDatasourceBindings(contract) as Array<{ source: { sampleData: string } }>;
		const samplePaths = new Set(
			bindings.map((binding: { source: { sampleData: string } }): string => binding.source.sampleData)
		);

		if (samplePaths.size === 0) {
			return { contractValid: false, fictionalOnly: false };
		}

		for (const declaredPath of samplePaths) {
			const samplePath: string = path.resolve(workspace, declaredPath);
			const relativePath: string = path.relative(workspace, samplePath);

			if (relativePath.startsWith('..') || path.isAbsolute(relativePath) || !fs.existsSync(samplePath)) {
				return { contractValid: false, fictionalOnly: false };
			}

			const sample = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
			validateSyntheticSample(path.basename(workspace), contract, sample);
		}

		return { contractValid: projectValid, fictionalOnly: true };
	} catch {
		return { contractValid: false, fictionalOnly: false };
	}
};

export const validateVersionOnePolicy = (workspace: string): boolean => {
	try {
		const propertiesPath: string = path.join(workspace, 'src', 'editor-assets', 'properties.json');

		if (!fs.existsSync(propertiesPath)) {
			return false;
		}

		const properties = JSON.parse(fs.readFileSync(propertiesPath, 'utf8')) as { version?: string };

		return properties.version === '1';
	} catch {
		return false;
	}
};
