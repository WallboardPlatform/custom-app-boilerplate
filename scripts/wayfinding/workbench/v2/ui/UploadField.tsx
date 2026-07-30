import {
	LoaderCircle,
	type LucideProps
} from 'lucide-solid';
import {
	createSignal,
	createUniqueId,
	Show,
	type JSX
} from 'solid-js';
import { Dynamic } from 'solid-js/web';

import { Button } from './Button';

interface UploadFieldProps {
	accept: string;
	actionLabel?: string;
	description: string;
	fileName?: string;
	icon: (props: LucideProps) => JSX.Element;
	inputId?: string;
	metadata?: string;
	onRemove?: () => void;
	onSelect: (file: File) => Promise<void> | void;
	previewUrl?: string;
	title: string;
	variant?: 'compact' | 'default';
}

export const UploadField = (props: UploadFieldProps): JSX.Element => {
	const generatedId = createUniqueId();
	const inputId = (): string => props.inputId ?? `wb-studio-upload-${generatedId}`;
	const [dragging, setDragging] = createSignal(false);
	const [error, setError] = createSignal<string>();
	const [loading, setLoading] = createSignal(false);
	let input!: HTMLInputElement;
	const selectFile = async (file: File | undefined): Promise<void> => {
		if (!file || loading()) return;
		setError(undefined);
		setLoading(true);

		try {
			await props.onSelect(file);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : 'The selected file could not be loaded.');
		} finally {
			setLoading(false);
			input.value = '';
		}
	};
	const dropped = (event: DragEvent): void => {
		event.preventDefault();
		setDragging(false);
		void selectFile(event.dataTransfer?.files[0]);
	};

	return (
		<div
			class="wb-studio-upload"
			classList={{
				'wb-studio-upload--compact': props.variant === 'compact',
				'wb-studio-upload--dragging': dragging(),
				'wb-studio-upload--error': Boolean(error()),
				'wb-studio-upload--loading': loading(),
				'wb-studio-upload--populated': Boolean(props.fileName)
			}}
			aria-busy={loading()}
			onDragEnter={(event) => {
				event.preventDefault();
				setDragging(true);
			}}
			onDragOver={(event) => event.preventDefault()}
			onDragLeave={(event) => {
				if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
				setDragging(false);
			}}
			onDrop={dropped}
		>
			<input
				ref={input}
				id={inputId()}
				class="visually-hidden"
				type="file"
				accept={props.accept}
				aria-label={props.actionLabel ?? `Choose ${props.title.toLocaleLowerCase()} file`}
				onChange={(event) => void selectFile(event.currentTarget.files?.[0])}
			/>
			<div class="wb-studio-upload__preview" aria-hidden="true">
				<Show
					when={props.previewUrl}
					fallback={<Dynamic component={props.icon} size={props.variant === 'compact' ? 18 : 22} />}
				>
					<img src={props.previewUrl} alt="" />
				</Show>
			</div>
			<div class="wb-studio-upload__copy">
				<strong>{props.fileName ?? props.title}</strong>
				<span>{loading()
					? `Reading ${props.title.toLocaleLowerCase()}...`
					: props.fileName
						? props.metadata ?? props.description
						: props.description}</span>
			</div>
			<div class="wb-studio-upload__actions">
				<Button
					size="compact"
					tone={props.fileName ? 'default' : 'primary'}
					disabled={loading()}
					onClick={() => input.click()}
				>
					<Show when={loading()}><LoaderCircle class="wb-studio-spinner" size={14} /></Show>
					{loading() ? 'Reading...' : props.fileName ? 'Replace' : props.actionLabel ?? 'Choose file'}
				</Button>
				<Show when={props.fileName && props.onRemove}>
					<Button size="compact" tone="danger" disabled={loading()} onClick={() => props.onRemove?.()}>
						Remove
					</Button>
				</Show>
			</div>
			<Show when={error()}>
				<div class="wb-studio-upload__error" role="alert">{error()}</div>
			</Show>
		</div>
	);
};
