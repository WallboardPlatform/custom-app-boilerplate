export interface RuntimeEnvironment {
	isDisplayer: () => boolean;
}

export interface DatasourceMutations {
	insertToArray: (
		binding: string,
		selector: string,
		data: unknown,
		options?: { index?: number; maxElementCount?: number; rotateEnabled?: boolean; useBoundedPath?: boolean }
	) => string | void;
	merge: (binding: string, data: unknown) => string | void;
	set: (binding: string, data: unknown) => string | void;
}

export type DatasourceWriteResult =
	| { status: 'written' }
	| { status: 'editor-blocked' }
	| { status: 'failed'; message: string };

export interface InternalDatasourceWriter {
	append: (
		binding: string,
		selector: string,
		data: unknown,
		options?: { maxElementCount?: number; rotateEnabled?: boolean; useBoundedPath?: boolean }
	) => DatasourceWriteResult;
	merge: (binding: string, data: unknown) => DatasourceWriteResult;
	set: (binding: string, data: unknown) => DatasourceWriteResult;
}

export const createInternalDatasourceWriter = (
	environment: RuntimeEnvironment,
	datasource: DatasourceMutations
): InternalDatasourceWriter => {
	const mutate = (operation: () => string | void): DatasourceWriteResult => {
		if (!environment.isDisplayer()) {
			return { status: 'editor-blocked' };
		}

		try {
			const result: string | void = operation();

			return typeof result === 'string' && result !== ''
				? { status: 'failed', message: result }
				: { status: 'written' };
		} catch (error) {
			return {
				status: 'failed',
				message: error instanceof Error ? error.message : String(error)
			};
		}
	};

	return {
		append: (binding, selector, data, options): DatasourceWriteResult => mutate(() => datasource.insertToArray(
			binding,
			selector,
			data,
			options
		)),
		merge: (binding, data): DatasourceWriteResult => mutate(() => datasource.merge(binding, data)),
		set: (binding, data): DatasourceWriteResult => mutate(() => datasource.set(binding, data))
	};
};
