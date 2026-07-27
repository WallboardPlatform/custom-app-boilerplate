import fs from 'node:fs';
import path from 'node:path';

/**
 * `tsconfig.json` is the single declaration of the project's path aliases. The production Vite
 * config, the preview Vite config and the visual-review fingerprint all derive from it here
 * rather than restating it.
 *
 * They used to hold four independent copies. Three of them failing to notice a new alias would
 * be a build error, but the fingerprint failing to notice one fails *open*: the imported file
 * silently drops out of the review hash, and changing it stops staling the accepted review.
 */

interface TsconfigShape {
	compilerOptions?: {
		paths?: Record<string, string[]>;
	};
}

/**
 * Scans character by character rather than stripping comments with a regex. Alias patterns such
 * as `"@contexts/*"` contain the same slash-star sequence a block-comment pattern looks for, so
 * a regex stripper silently eats from inside one string to the next comment terminator it finds.
 */
const stripJsonComments = (text: string): string => {
	let output = '';
	let inString = false;
	let inLineComment = false;
	let inBlockComment = false;

	for (let index = 0; index < text.length; index += 1) {
		const character: string = text.charAt(index);
		const next: string = text.charAt(index + 1);

		if (inLineComment) {
			if (character === '\n') {
				inLineComment = false;
				output += character;
			}

			continue;
		}

		if (inBlockComment) {
			if (character === '*' && next === '/') {
				inBlockComment = false;
				index += 1;
			}

			continue;
		}

		if (inString) {
			output += character;

			if (character === '\\') {
				output += next;
				index += 1;
			} else if (character === '"') {
				inString = false;
			}

			continue;
		}

		if (character === '"') {
			inString = true;
		} else if (character === '/' && next === '/') {
			inLineComment = true;
			index += 1;

			continue;
		} else if (character === '/' && next === '*') {
			inBlockComment = true;
			index += 1;

			continue;
		}

		output += character;
	}

	return output;
};

const parseTsconfig = (text: string): TsconfigShape => {
	return JSON.parse(stripJsonComments(text).replace(/,(\s*[}\]])/g, '$1')) as TsconfigShape;
};

/**
 * Maps `@utils` to `src/utils`, relative to the project root. Wildcards are stripped: consumers
 * join the remainder of the specifier themselves.
 */
export const readPathAliases = (projectDirectory: string): Record<string, string> => {
	const configPath: string = path.join(projectDirectory, 'tsconfig.json');

	if (!fs.existsSync(configPath)) {
		throw new Error(`Path aliases are declared in tsconfig.json; none found at ${configPath}.`);
	}

	const config: TsconfigShape = parseTsconfig(fs.readFileSync(configPath, 'utf8'));
	const declared: Record<string, string[]> = config.compilerOptions?.paths ?? {};
	const aliases: Record<string, string> = {};

	for (const [pattern, targets] of Object.entries(declared)) {
		const target: string | undefined = targets[0];

		if (target !== undefined) {
			aliases[pattern.replace(/\/\*$/, '')] = target.replace(/\/\*$/, '');
		}
	}

	if (Object.keys(aliases).length === 0) {
		throw new Error(`tsconfig.json at ${configPath} declares no compilerOptions.paths.`);
	}

	return aliases;
};

/** The same mapping with absolute targets, which is the shape a bundler's `resolve.alias` wants. */
export const resolvedPathAliases = (projectDirectory: string): Record<string, string> => {
	const entries: Array<[string, string]> = Object.entries(readPathAliases(projectDirectory))
		.map(([alias, target]: [string, string]): [string, string] => {
			return [alias, path.resolve(projectDirectory, target)];
		});

	return Object.fromEntries(entries);
};
