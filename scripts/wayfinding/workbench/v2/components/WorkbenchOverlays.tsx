import {
	AlertTriangle,
	ChevronRight,
	CircleHelp,
	Clock3,
	ShieldAlert,
	X
} from 'lucide-solid';
import {
	For,
	Show,
	type Accessor,
	type JSX
} from 'solid-js';

import type {
	WayfindingStudioIssue,
	WayfindingStudioProject,
	WayfindingStudioRepair
} from '../../../studio-project.mts';
import { friendlyIssue } from '../issues';
import {
	CommandPalette,
	type StudioCommand
} from './CommandPalette';
import { ShortcutsDialog } from './ShortcutsDialog';

export interface ConfirmState {
	body: string;
	confirmLabel: string;
	details?: Array<{ label: string; value: string }>;
	title: string;
}

export interface RepairReportState {
	fileName: string;
	repairs: WayfindingStudioRepair[];
}

export interface ToastState {
	message: string;
	tone: 'danger' | 'info' | 'success' | 'warning';
}

interface WorkbenchOverlaysProps {
	commandPaletteOpen: Accessor<boolean>;
	commands: Accessor<StudioCommand[]>;
	confirmState: Accessor<ConfirmState | undefined>;
	exportIssues: Accessor<WayfindingStudioIssue[]>;
	onCloseCommandPalette: () => void;
	onCloseExportIssues: () => void;
	onCloseRepairReport: () => void;
	onCloseShortcuts: () => void;
	onDiscardRecovery: () => void;
	onDismissToast: () => void;
	onResolveConfirm: (value: boolean) => void;
	onRestoreRecovery: () => void;
	onRevealIssue: (issue: WayfindingStudioIssue) => void;
	recoveryProject: Accessor<WayfindingStudioProject | undefined>;
	repairReport: Accessor<RepairReportState | undefined>;
	shortcutsOpen: Accessor<boolean>;
	toast: Accessor<ToastState | undefined>;
}

export const WorkbenchOverlays = (props: WorkbenchOverlaysProps): JSX.Element => (
	<>
		<Show when={props.toast()} keyed>
			{(toast) => (
				<div class="toast" role="status" aria-live="polite" classList={{ [toast.tone]: true }}>
					<span>{toast.message}</span>
					<button type="button" aria-label="Dismiss message" onClick={props.onDismissToast}>
						<X size={16} />
					</button>
				</div>
			)}
		</Show>

		<Show when={props.confirmState()} keyed>
			{(confirmation) => (
				<div class="modal-backdrop" role="presentation">
					<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
						<div class="dialog-icon"><CircleHelp size={20} /></div>
						<h2 id="confirm-title">{confirmation.title}</h2>
						<p>{confirmation.body}</p>
						<Show when={confirmation.details?.length}>
							<dl class="dialog-diff">
								<For each={confirmation.details}>
									{(detail) => (
										<div>
											<dt>{detail.label}</dt>
											<dd>{detail.value}</dd>
										</div>
									)}
								</For>
							</dl>
						</Show>
						<div class="dialog-actions">
							<button type="button" class="wb-studio-action" onClick={() => props.onResolveConfirm(false)}>
								Cancel
							</button>
							<button type="button" class="wb-studio-action primary" onClick={() => props.onResolveConfirm(true)}>
								{confirmation.confirmLabel}
							</button>
						</div>
					</div>
				</div>
			)}
		</Show>

		<Show when={props.repairReport()} keyed>
			{(report) => (
				<div class="modal-backdrop" role="presentation">
					<div
						class="dialog repair-report-dialog"
						role="dialog"
						aria-modal="true"
						aria-labelledby="repair-report-title"
					>
						<div class="dialog-icon"><AlertTriangle size={20} /></div>
						<h2 id="repair-report-title">Project opened with repairs</h2>
						<p>
							<strong>{report.fileName}</strong> contained geometry outside its floor boundary.
							The editor recovered it and marked affected items for review.
						</p>
						<ul class="repair-report-list">
							<For each={report.repairs}>{(repair) => <li>{repair.message}</li>}</For>
						</ul>
						<div class="dialog-actions">
				<button type="button" class="wb-studio-action primary" onClick={props.onCloseRepairReport}>
								Continue reviewing
							</button>
						</div>
					</div>
				</div>
			)}
		</Show>

		<Show when={props.recoveryProject()} keyed>
			{(project) => (
				<div class="modal-backdrop" role="presentation">
					<div class="dialog recovery-dialog" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
						<div class="dialog-icon"><Clock3 size={20} /></div>
						<h2 id="recovery-title">Restore unsaved local work?</h2>
						<p>
							The browser has a recovery copy of <strong>{project.name}</strong>.
							Restore it before starting a new project, or discard it permanently.
						</p>
						<div class="dialog-actions">
					<button type="button" class="wb-studio-action danger-ghost" onClick={props.onDiscardRecovery}>
								Discard recovery
							</button>
					<button type="button" class="wb-studio-action primary" onClick={props.onRestoreRecovery}>
								Restore work
							</button>
						</div>
					</div>
				</div>
			)}
		</Show>

		<Show when={props.exportIssues().length > 0}>
			<div class="modal-backdrop" role="presentation">
				<div class="dialog export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
					<div class="dialog-icon danger"><ShieldAlert size={20} /></div>
					<h2 id="export-title">Map is not ready to publish</h2>
					<p>Correct these project issues, then export again. Select an issue to open the relevant map object.</p>
					<div class="export-issue-list">
						<For each={props.exportIssues()}>{(issue) => (
							<button type="button" onClick={() => props.onRevealIssue(issue)}>
								<AlertTriangle size={16} />
								<span>
									<strong>{friendlyIssue(issue)}</strong>
									<small>{issue.elementIds.length ? 'Open affected item' : 'Open project settings'}</small>
								</span>
								<ChevronRight size={16} />
							</button>
						)}</For>
					</div>
					<div class="dialog-actions">
					<button type="button" class="wb-studio-action" onClick={() => props.onCloseExportIssues()}>Close</button>
					</div>
				</div>
			</div>
		</Show>

		<Show when={props.shortcutsOpen()}>
			<ShortcutsDialog onClose={props.onCloseShortcuts} />
		</Show>
		<Show when={props.commandPaletteOpen()}>
			<CommandPalette commands={props.commands()} onClose={props.onCloseCommandPalette} />
		</Show>
	</>
);
