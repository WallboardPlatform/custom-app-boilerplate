import {
	parseWayfindingStudioProject,
	repairWayfindingStudioProject,
	type WayfindingStudioProject
} from '../studio-project.mts';
import type { PersistenceAdapter } from './types';

const RECOVERY_KEY = 'wallboard-wayfinding-studio-v2-recovery';

interface FilePickerAcceptType {
	accept: Record<string, string[]>;
	description?: string;
}

interface FilePickerOptions {
	excludeAcceptAllOption?: boolean;
	suggestedName?: string;
	types?: FilePickerAcceptType[];
}

interface WritableFileStream {
	close(): Promise<void>;
	write(data: string): Promise<void>;
}

interface WritableProjectFileHandle {
	createWritable(): Promise<WritableFileStream>;
	getFile(): Promise<File>;
	name: string;
}

interface FileSystemWindow extends Window {
	showOpenFilePicker?: (options?: FilePickerOptions) => Promise<WritableProjectFileHandle[]>;
	showSaveFilePicker?: (options?: FilePickerOptions) => Promise<WritableProjectFileHandle>;
}

const fileTypes: FilePickerAcceptType[] = [{
	accept: { 'application/json': ['.wbwayfinding', '.json'] },
	description: 'Wallboard Wayfinding project'
}];

const safeFileName = (name: string): string => {
	const base: string = name.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'wayfinding-project';

	return base.endsWith('.wbwayfinding') ? base : `${base}.wbwayfinding`;
};

const parseText = (text: string): WayfindingStudioProject => {
	const raw: unknown = JSON.parse(text);
	const repaired = repairWayfindingStudioProject(raw);

	return parseWayfindingStudioProject(repaired.project);
};

const downloadText = (text: string, fileName: string): void => {
	const url: string = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
	const anchor: HTMLAnchorElement = document.createElement('a');
	anchor.href = url;
	anchor.download = fileName;
	anchor.click();
	URL.revokeObjectURL(url);
};

export class BrowserPersistenceAdapter implements PersistenceAdapter {
	private fileHandle?: WritableProjectFileHandle;

	public clearRecovery(): Promise<void> {
		localStorage.removeItem(RECOVERY_KEY);

		return Promise.resolve();
	}

	public loadRecovery(): Promise<WayfindingStudioProject | undefined> {
		const stored: string | null = localStorage.getItem(RECOVERY_KEY);

		if (!stored) return Promise.resolve(undefined);

		try {
			return Promise.resolve(parseText(stored));
		} catch {
			return Promise.resolve(undefined);
		}
	}

	public async openProject(): Promise<{ fileName: string; project: WayfindingStudioProject } | undefined> {
		const browser: FileSystemWindow = window;

		if (browser.showOpenFilePicker) {
			const [handle] = await browser.showOpenFilePicker({ excludeAcceptAllOption: false, types: fileTypes });

			if (!handle) return undefined;
			this.fileHandle = handle;
			const file: File = await handle.getFile();

			return { fileName: file.name, project: parseText(await file.text()) };
		}

		return await new Promise((resolve, reject): void => {
			const input: HTMLInputElement = document.createElement('input');
			input.type = 'file';
			input.accept = '.wbwayfinding,.json,application/json';
			input.addEventListener('change', (): void => {
				const file: File | undefined = input.files?.[0];

				if (!file) {
					resolve(undefined);

					return;
				}
				file.text()
					.then((text): void => resolve({ fileName: file.name, project: parseText(text) }))
					.catch(reject);
			}, { once: true });
			input.click();
		});
	}

	public async saveProject(
		project: WayfindingStudioProject,
		options: { forceSaveAs?: boolean; suggestedName?: string } = {}
	): Promise<{ fileName: string }> {
		const browser: FileSystemWindow = window;
		const suggestedName: string = safeFileName(options.suggestedName ?? project.name);

		if (browser.showSaveFilePicker && (options.forceSaveAs || !this.fileHandle)) {
			this.fileHandle = await browser.showSaveFilePicker({ suggestedName, types: fileTypes });
		}

		const serialized: string = `${JSON.stringify(project, undefined, 2)}\n`;

		if (this.fileHandle) {
			const writable: WritableFileStream = await this.fileHandle.createWritable();
			await writable.write(serialized);
			await writable.close();

			return { fileName: this.fileHandle.name };
		}

		downloadText(serialized, suggestedName);

		return { fileName: suggestedName };
	}

	public saveRecovery(project: WayfindingStudioProject): Promise<void> {
		localStorage.setItem(RECOVERY_KEY, JSON.stringify(project));

		return Promise.resolve();
	}
}

export const projectFileName = safeFileName;
