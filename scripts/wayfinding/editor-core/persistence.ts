import {
	parseWayfindingStudioProject,
	repairWayfindingStudioProject,
	type WayfindingStudioProject,
	type WayfindingStudioRepair
} from '../studio-project.mts';
import type { PersistenceAdapter } from './types';

const RECOVERY_KEY = 'wallboard-wayfinding-studio-recovery';
const PROJECT_TARGET_DATABASE = 'wallboard-wayfinding-studio';
const PROJECT_TARGET_KEY = 'active-project-target';
const PROJECT_TARGET_STORE = 'file-targets';

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
	queryPermission?(descriptor: { mode: 'readwrite' }): Promise<'denied' | 'granted' | 'prompt'>;
	requestPermission?(descriptor: { mode: 'readwrite' }): Promise<'denied' | 'granted' | 'prompt'>;
}

interface FileSystemWindow extends Window {
	showOpenFilePicker?: (options?: FilePickerOptions) => Promise<WritableProjectFileHandle[]>;
	showSaveFilePicker?: (options?: FilePickerOptions) => Promise<WritableProjectFileHandle>;
}

const fileTypes: FilePickerAcceptType[] = [{
	accept: { 'application/json': ['.wbwayfinding', '.json'] },
	description: 'Wallboard Wayfinding project'
}];

interface PersistedProjectTarget {
	handle: WritableProjectFileHandle;
	projectId: string;
}

const openProjectTargetDatabase = (): Promise<IDBDatabase | undefined> => {
	if (typeof indexedDB === 'undefined') return Promise.resolve(undefined);

	return new Promise((resolve) => {
		const request = indexedDB.open(PROJECT_TARGET_DATABASE, 2);

		request.addEventListener('upgradeneeded', (): void => {
			const database = request.result;

			if (!database.objectStoreNames.contains(PROJECT_TARGET_STORE)) {
				database.createObjectStore(PROJECT_TARGET_STORE);
			}
		});
		request.addEventListener('success', (): void => resolve(request.result), { once: true });
		request.addEventListener('error', (): void => resolve(undefined), { once: true });
		request.addEventListener('blocked', (): void => resolve(undefined), { once: true });
	});
};

const loadProjectTarget = async (): Promise<PersistedProjectTarget | undefined> => {
	const database = await openProjectTargetDatabase();

	if (!database || !database.objectStoreNames.contains(PROJECT_TARGET_STORE)) {
		database?.close();

		return undefined;
	}

	return await new Promise((resolve) => {
		const transaction = database.transaction(PROJECT_TARGET_STORE, 'readonly');
		const request = transaction.objectStore(PROJECT_TARGET_STORE).get(PROJECT_TARGET_KEY);

		request.addEventListener('success', (): void => {
			resolve(request.result as PersistedProjectTarget | undefined);
		}, { once: true });
		request.addEventListener('error', (): void => resolve(undefined), { once: true });
		transaction.addEventListener('complete', (): void => database.close(), { once: true });
		transaction.addEventListener('abort', (): void => database.close(), { once: true });
	});
};

const saveProjectTarget = async (target: PersistedProjectTarget): Promise<void> => {
	const database = await openProjectTargetDatabase();

	if (!database || !database.objectStoreNames.contains(PROJECT_TARGET_STORE)) {
		database?.close();

		return;
	}

	await new Promise<void>((resolve) => {
		const transaction = database.transaction(PROJECT_TARGET_STORE, 'readwrite');

		try {
			transaction.objectStore(PROJECT_TARGET_STORE).put(target, PROJECT_TARGET_KEY);
		} catch {
			database.close();
			resolve();

			return;
		}
		transaction.addEventListener('complete', (): void => {
			database.close();
			resolve();
		}, { once: true });
		transaction.addEventListener('abort', (): void => {
			database.close();
			resolve();
		}, { once: true });
	});
};

const clearProjectTarget = async (): Promise<void> => {
	const database = await openProjectTargetDatabase();

	if (!database || !database.objectStoreNames.contains(PROJECT_TARGET_STORE)) {
		database?.close();

		return;
	}

	await new Promise<void>((resolve) => {
		const transaction = database.transaction(PROJECT_TARGET_STORE, 'readwrite');
		transaction.objectStore(PROJECT_TARGET_STORE).delete(PROJECT_TARGET_KEY);
		transaction.addEventListener('complete', (): void => {
			database.close();
			resolve();
		}, { once: true });
		transaction.addEventListener('abort', (): void => {
			database.close();
			resolve();
		}, { once: true });
	});
};

const safeFileName = (name: string): string => {
	const base: string = name.trim().replaceAll(/[^a-zA-Z0-9._-]+/g, '-').replaceAll(/^-+|-+$/g, '') || 'wayfinding-project';

	return base.endsWith('.wbwayfinding') ? base : `${base}.wbwayfinding`;
};

const parseText = (text: string): {
	project: WayfindingStudioProject;
	repairs: WayfindingStudioRepair[];
} => {
	const raw: unknown = JSON.parse(text);
	const repaired = repairWayfindingStudioProject(raw);

	return {
		project: parseWayfindingStudioProject(repaired.project),
		repairs: repaired.repairs
	};
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

	public resetProjectTarget(): void {
		this.fileHandle = undefined;
		void clearProjectTarget();
	}

	public async openProjectFile(file: File): Promise<{
		fileName: string;
		project: WayfindingStudioProject;
		repairs: WayfindingStudioRepair[];
	}> {
		this.resetProjectTarget();
		const parsed = parseText(await file.text());

		return { fileName: file.name, ...parsed };
	}

	public clearRecovery(): Promise<void> {
		localStorage.removeItem(RECOVERY_KEY);

		return Promise.resolve();
	}

	public async loadRecovery(): Promise<WayfindingStudioProject | undefined> {
		const stored: string | null = localStorage.getItem(RECOVERY_KEY);

		if (!stored) return undefined;

		try {
			const project = parseText(stored).project;
			const target = await loadProjectTarget();

			if (target?.projectId === project.projectId) {
				this.fileHandle = target.handle;
			}

			return project;
		} catch {
			return undefined;
		}
	}

	public async openProject(): Promise<{
		fileName: string;
		project: WayfindingStudioProject;
		repairs: WayfindingStudioRepair[];
	} | undefined> {
		const browser: FileSystemWindow = window;

		if (browser.showOpenFilePicker) {
			const [handle] = await browser.showOpenFilePicker({ excludeAcceptAllOption: false, types: fileTypes });

			if (!handle) return undefined;
			const file: File = await handle.getFile();
			const parsed = parseText(await file.text());

			this.fileHandle = handle;
			await saveProjectTarget({ handle, projectId: parsed.project.projectId });

			return { fileName: file.name, ...parsed };
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
				this.openProjectFile(file)
					.then(resolve)
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
			const permission = await this.fileHandle.queryPermission?.({ mode: 'readwrite' });

			if (permission === 'denied') {
				throw new Error(`Wallboard no longer has permission to update ${this.fileHandle.name}. Use Save as to choose a writable file.`);
			}

			if (permission === 'prompt') {
				const requested = await this.fileHandle.requestPermission?.({ mode: 'readwrite' });

				if (requested !== 'granted') {
					throw new Error(`Permission to update ${this.fileHandle.name} was not granted. Use Save as to choose another file.`);
				}
			}

			const writable: WritableFileStream = await this.fileHandle.createWritable();
			await writable.write(serialized);
			await writable.close();
			await saveProjectTarget({ handle: this.fileHandle, projectId: project.projectId });

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
