import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	type WayfindingStudioProject
} from '../studio-project.mts';

const createRouteTestProject = (): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject('route-clear-test');
	const floor = project.floors[0];
	floor.elements = [
		{ facingDegrees: 0, floorId: floor.id, id: 'lobby-screen', label: 'Lobby screen', point: { x: 120, y: 200 }, provenance: 'reviewer-authored', screenId: 'screen-1', status: 'confirmed', type: 'origin' },
		{ destinationId: 'meeting-room', floorId: floor.id, geometry: [{ x: 500, y: 120 }, { x: 760, y: 120 }, { x: 760, y: 360 }, { x: 500, y: 360 }], id: 'meeting-room-shape', label: 'Meeting room', provenance: 'reviewer-authored', status: 'confirmed', type: 'location' },
		{ angle: 0, floorId: floor.id, id: 'meeting-room-door', length: 36, locationId: 'meeting-room-shape', point: { x: 500, y: 240 }, provenance: 'reviewer-authored', status: 'confirmed', type: 'door' }
	];
	project.destinations = [{ floor: floor.id, id: 'meeting-room', name: 'Meeting room', routeable: true }];
	synchronizeWayfindingStudioGraph(project);
	project.graph.edges = [{
		accessible: true,
		bidirectional: true,
		from: 'semantic:lobby-screen',
		geometry: [{ x: 120, y: 200 }, { x: 300, y: 200 }, { x: 500, y: 240 }],
		id: 'lobby-to-meeting',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'semantic:meeting-room-shape',
		traversal: 'indoor-corridor'
	}];

	return project;
};

const create3dTestProject = (): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject('three-dimensional-preview');
	const floor = project.floors[0];
	floor.width = 900;
	floor.height = 600;
	floor.elements = [
		{
			destinationId: 'exhibition-hall',
			floorId: floor.id,
			geometry: [{ x: 220, y: 150 }, { x: 680, y: 150 }, { x: 680, y: 470 }, { x: 220, y: 470 }],
			id: 'exhibition-hall-shape',
			label: 'Exhibition hall',
			presentation: { extrusionHeight: 52, fillColor: '#e18b4f', fillOpacity: 0.9 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		}
	];
	project.destinations = [{ floor: floor.id, id: 'exhibition-hall', name: 'Exhibition hall', routeable: false }];

	return project;
};

test('authors, refines, and exports a portable semantic project', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Wayfinding Studio' })).toBeVisible();
	await expect(page.locator('#studio-floor')).toHaveValue('level-0');

	const canvas = page.locator('#stage');
	await page.locator('[data-tool="location"]').click();
	await canvas.click({ position: { x: 230, y: 320 } });
	await canvas.click({ position: { x: 430, y: 320 } });
	await canvas.click({ position: { x: 430, y: 490 } });
	await canvas.click({ position: { x: 230, y: 490 } });
	await page.locator('#semantic-finish').click();
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');
	await page.locator('[data-tool="select"]').click();
	await canvas.dblclick({ position: { x: 330, y: 320 } });

	await canvas.hover({ position: { x: 330, y: 400 } });
	await page.mouse.wheel(0, -120);

	await page.locator('[data-tool="origin"]').click();
	await canvas.click({ position: { x: 160, y: 520 } });
	await expect(page.locator('#route-start option')).toHaveCount(1);
	await expect(page.locator('#route-destination option')).toHaveCount(1);

	await page.locator('#studio-add-floor').click();
	await expect(page.locator('#studio-floor option')).toHaveCount(2);
	await page.locator('#studio-delete-floor').click();
	await expect(page.locator('#studio-floor option')).toHaveCount(1);
	await page.locator('[data-tool="select"]').click();
	await canvas.click({ position: { x: 330, y: 400 } });
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');

	const screenshotPath: string = testInfo.outputPath('authored-studio.png');
	await page.screenshot({ fullPage: true, path: screenshotPath });
	await testInfo.attach('authored-studio', { contentType: 'image/png', path: screenshotPath });

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as { floors: Array<{ elements: Array<{ geometry?: unknown[]; type: string }> }> };
	expect(project.floors[0].elements.map((element): string => element.type)).toEqual(['location', 'origin']);
	expect(project.floors[0].elements[0].geometry).toHaveLength(5);
	expect(errors).toEqual([]);
});

test('moves, inserts, and deletes polygon points above overlapping semantic layers', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');

	const canvas = page.locator('#stage');
	await page.locator('[data-tool="location"]').click();
	for (const position of [{ x: 220, y: 280 }, { x: 440, y: 280 }, { x: 440, y: 460 }, { x: 220, y: 460 }]) await canvas.click({ position });
	await page.locator('#semantic-finish').click();

	await page.locator('[data-tool="walkable"]').click();
	for (const position of [{ x: 220, y: 280 }, { x: 350, y: 280 }, { x: 350, y: 380 }, { x: 220, y: 380 }]) await canvas.click({ position });
	await page.locator('#semantic-finish').click();

	await page.locator('[data-tool="select"]').click();
	await canvas.click({ position: { x: 420, y: 430 } });
	const selection = page.locator('#semantic-editor');
	await expect(selection.getByRole('heading', { name: 'Room / area' })).toBeVisible();
	await expect(selection).toContainText('4 points');

	const bounds = await canvas.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move((bounds?.x ?? 0) + 220, (bounds?.y ?? 0) + 280);
	await page.mouse.down();
	await page.mouse.move((bounds?.x ?? 0) + 195, (bounds?.y ?? 0) + 250, { steps: 4 });
	await page.mouse.up();
	await expect(selection).toContainText('Point 1 of 4 selected');

	await selection.getByRole('button', { name: 'Add point on edge' }).click();
	await canvas.click({ position: { x: 330, y: 460 } });
	await expect(selection).toContainText('Point 4 of 5 selected');
	await selection.getByRole('button', { name: 'Delete selected point' }).click();
	await expect(selection).toContainText('4 points');

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as {
		floors: Array<{ elements: Array<{ geometry?: Array<{ x: number; y: number }>; type: string }> }>;
	};
	const location = project.floors[0].elements.find((element): boolean => element.type === 'location');
	const walkable = project.floors[0].elements.find((element): boolean => element.type === 'walkable');
	expect(location?.geometry).toHaveLength(4);
	expect(walkable?.geometry).toHaveLength(4);
	expect(location?.geometry?.[0]).not.toEqual(walkable?.geometry?.[0]);
	expect(errors).toEqual([]);
});

test('draws freehand areas, authors exclusions, and explains portable save state', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await expect(page.locator('#project-context-source')).toHaveText('New browser draft');
	await expect(page.locator('#project-context-portable')).toHaveText('Not downloaded');
	await page.locator('#drawing-mode-lasso').click();
	await page.locator('[data-tool="walkable"]').click();
	const canvas = page.locator('#stage');
	const bounds = await canvas.boundingBox();
	expect(bounds).not.toBeNull();
	const trace = async (positions: Array<{ x: number; y: number }>): Promise<void> => {
		await page.mouse.move((bounds?.x ?? 0) + positions[0].x, (bounds?.y ?? 0) + positions[0].y);
		await page.mouse.down();
		for (const position of positions.slice(1)) await page.mouse.move((bounds?.x ?? 0) + position.x, (bounds?.y ?? 0) + position.y, { steps: 3 });
		await page.mouse.up();
	};
	await trace([{ x: 180, y: 250 }, { x: 470, y: 250 }, { x: 470, y: 500 }, { x: 180, y: 500 }, { x: 180, y: 250 }]);
	await expect(page.locator('#semantic-editor h2')).toHaveText('Walkable area');
	await page.locator('#semantic-editor').getByRole('button', { name: 'Draw blocked island inside' }).click();
	await trace([{ x: 290, y: 335 }, { x: 365, y: 335 }, { x: 365, y: 415 }, { x: 290, y: 415 }, { x: 290, y: 335 }]);
	await expect(page.locator('#semantic-editor h2')).toHaveText('Blocked area');

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	expect(project.floors[0].elements.filter((element): boolean => element.type === 'walkable')).toHaveLength(1);
	expect(project.floors[0].elements.filter((element): boolean => element.type === 'obstacle')).toHaveLength(1);
	await expect(page.locator('#project-context-portable')).toHaveText('Downloaded and current');
	await page.locator('#studio-project-name').fill('Edited after download');
	await expect(page.locator('#project-context-portable')).toHaveText('Changes not downloaded');
	expect(errors).toEqual([]);
});

test('detects a flat room, controls all layer visibility, and starts a clean project', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await page.locator('#image-file').setInputFiles({
		name: 'flat-room.svg',
		mimeType: 'image/svg+xml',
		buffer: Buffer.from(`
			<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
				<rect width="800" height="600" fill="#f8f6ef"/>
				<rect x="150" y="120" width="500" height="360" fill="#9ed7cd" stroke="#173b35" stroke-width="10"/>
			</svg>
		`)
	});
	await page.locator('#drawing-mode-smart').click();
	await expect(page.locator('#drawing-mode-help')).toContainText('click inside a flat-color region');
	await page.locator('[data-tool="location"]').click();
	const canvas = page.locator('#stage');
	const bounds = await canvas.boundingBox();
	expect(bounds).not.toBeNull();
	await canvas.click({ position: { x: (bounds?.width ?? 0) / 2, y: (bounds?.height ?? 0) / 2 } });
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');
	await expect(page.locator('#semantic-editor')).toContainText(/\d+ points/u);

	const layerToggles = page.locator('[data-layer]');
	await expect(layerToggles).toHaveCount(10);
	await page.locator('#hide-all-layers').click();
	for (let index = 0; index < await layerToggles.count(); index += 1) await expect(layerToggles.nth(index)).not.toBeChecked();
	await page.locator('#show-all-layers').click();
	for (let index = 0; index < await layerToggles.count(); index += 1) await expect(layerToggles.nth(index)).toBeChecked();

	page.once('dialog', async (dialog): Promise<void> => {
		expect(dialog.type()).toBe('confirm');
		await dialog.accept();
	});
	await page.locator('#studio-new-project').click();
	await expect(page.locator('#project-context-source')).toHaveText('New browser draft');
	await expect(page.locator('#project-context-portable')).toHaveText('Not downloaded');
	await expect(page.locator('#studio-project-name')).toHaveValue('Wayfinding project');
	await expect(page.locator('#semantic-editor')).toContainText('Select an authored');
	await expect(page.locator('#coverage-status')).toContainText('New project ready');
	expect(errors).toEqual([]);
});

test('prompts for an icon or logo image before placement', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	const iconPath: string = testInfo.outputPath('marker.png');
	fs.writeFileSync(iconPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2n1EAAAAASUVORK5CYII=', 'base64'));
	const chooserPromise = page.waitForEvent('filechooser');
	await page.locator('[data-tool="logo"]').click();
	const chooser = await chooserPromise;
	await chooser.setFiles(iconPath);
	await expect(page.locator('#media-asset-state')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('#media-asset-summary')).toContainText('marker.png is ready');
	await page.locator('#stage').click({ position: { x: 330, y: 380 } });
	await expect(page.locator('#semantic-editor h2')).toHaveText('Logo');
	expect(errors).toEqual([]);
});

test('opens the maintained Veszprem highlight project with embedded artwork', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await page.locator('#studio-project-file').setInputFiles(path.resolve('examples', 'veszprem-wayfinding', 'veszprem-downtown.wbwayfinding'));
	await expect(page.locator('#studio-floor')).toHaveValue('downtown');
	await expect(page.locator('#route-destination option')).toHaveCount(36);
	await expect(page.locator('#studio-validation')).toContainText('RUNTIME EXPORT READY');
	const centerPixel = await page.locator('#stage').evaluate((canvas: HTMLCanvasElement): number[] => {
		const context = canvas.getContext('2d');
		return context ? [...context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data] : [];
	});
	expect(centerPixel).toHaveLength(4);
	expect(centerPixel.slice(0, 3)).not.toEqual([247, 245, 239]);
	const screenshotPath: string = testInfo.outputPath('veszprem-studio.png');
	await page.screenshot({ fullPage: true, path: screenshotPath });
	await testInfo.attach('veszprem-studio', { contentType: 'image/png', path: screenshotPath });
	expect(errors).toEqual([]);
});

test('clears a simulated route without changing the authored project', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	const projectPath: string = testInfo.outputPath('route-clear-test.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(createRouteTestProject()));
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await expect(page.locator('#edge-summary')).toHaveText('1 route segment');
	await expect(page.locator('#edge-list button')).toContainText('Lobby screen to Meeting room');
	await page.locator('#edge-list button').click();
	await expect(page.locator('#selected-edge h2')).toHaveText('Route segment');
	await expect(page.locator('#selected-edge').getByLabel('Segment type')).toHaveValue('indoor');
	await expect(page.locator('#selected-edge')).toContainText('Advanced segment settings');

	const clearRoute = page.locator('#route-clear');
	await expect(clearRoute).toBeDisabled();
	await page.locator('#route-simulate').click();
	await expect(page.locator('#route-result')).toContainText('min');
	await expect(clearRoute).toBeEnabled();
	await clearRoute.click();
	await expect(clearRoute).toBeDisabled();
	await expect(page.locator('#route-result')).toContainText('Route preview cleared');
	expect(errors).toEqual([]);
});

test('renders, rotates, selects, and saves a nonblank 3D floor preview', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	const projectPath: string = testInfo.outputPath('three-dimensional-preview.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(create3dTestProject()));
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await page.locator('#view-3d').click();
	const preview = page.locator('#stage-3d');
	const webglCanvas = preview.locator('canvas');
	await expect(preview).toBeVisible();
	await expect(webglCanvas).toBeVisible();
	await expect(page.locator('#view-3d')).toHaveAttribute('aria-pressed', 'true');
	await page.waitForTimeout(250);

	const pixelEvidence = await webglCanvas.evaluate((canvas: HTMLCanvasElement): { colors: number; opaqueSamples: number } => {
		const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true }) ?? canvas.getContext('webgl', { preserveDrawingBuffer: true });
		if (!gl) return { colors: 0, opaqueSamples: 0 };
		gl.finish();
		const colors = new Set<string>();
		let opaqueSamples = 0;
		const pixel = new Uint8Array(4);
		for (let row = 1; row <= 12; row += 1) {
			for (let column = 1; column <= 12; column += 1) {
				gl.readPixels(Math.floor(canvas.width * column / 13), Math.floor(canvas.height * row / 13), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
				colors.add(`${pixel[0]},${pixel[1]},${pixel[2]}`);
				if (pixel[3] > 0) opaqueSamples += 1;
			}
		}
		return { colors: colors.size, opaqueSamples };
	});
	expect(pixelEvidence.opaqueSamples).toBeGreaterThan(100);
	expect(pixelEvidence.colors).toBeGreaterThan(3);

	const bounds = await webglCanvas.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.click((bounds?.x ?? 0) + (bounds?.width ?? 0) / 2, (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2);
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');
	await expect(page.locator('#semantic-editor').getByLabel('Fill color')).toHaveValue('#e18b4f');
	await expect(page.locator('#semantic-editor').getByLabel('3D visual height')).toHaveValue('52');

	await page.mouse.move((bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.58, (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.5);
	await page.mouse.down();
	await page.mouse.move((bounds?.x ?? 0) + (bounds?.width ?? 0) * 0.72, (bounds?.y ?? 0) + (bounds?.height ?? 0) * 0.4, { steps: 6 });
	await page.mouse.up();
	await page.locator('#save-3d-view').click();
	const screenshotPath: string = testInfo.outputPath('three-dimensional-preview.png');
	await preview.screenshot({ path: screenshotPath });
	await testInfo.attach('three-dimensional-preview', { contentType: 'image/png', path: screenshotPath });

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const saved = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	expect(saved.floors[0].camera3d?.distance).toBeGreaterThan(0);
	expect(saved.floors[0].camera3d?.pitchDegrees).toBeGreaterThanOrEqual(5);
	expect(errors).toEqual([]);
});

test('autosaves authored geometry and restores it after a reload', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await expect(page.locator('#autosave-status')).toHaveText('AUTOSAVE READY');

	const canvas = page.locator('#stage');
	await page.locator('[data-tool="location"]').click();
	for (const position of [{ x: 220, y: 280 }, { x: 420, y: 280 }, { x: 420, y: 440 }, { x: 220, y: 440 }]) await canvas.click({ position });
	await page.locator('#semantic-finish').click();
	await page.locator('#semantic-editor').getByLabel('Name', { exact: true }).fill('Recovered room');
	await expect(page.locator('#autosave-status')).toHaveText(/^SAVED /u, { timeout: 5000 });

	await page.reload();
	await expect(page.locator('#local-recovery')).toBeVisible();
	await expect(page.locator('#local-recovery-summary')).toContainText('Wayfinding project');
	await page.locator('#restore-autosave').click();
	await expect(page.locator('#local-recovery')).toBeHidden();
	await expect(page.locator('#coverage-status')).toContainText('Restored local work');
	await page.locator('[data-tool="select"]').click();
	await canvas.click({ position: { x: 320, y: 360 } });
	await expect(page.locator('#semantic-editor').getByRole('heading', { name: 'Room / area' })).toBeVisible();
	await expect(page.locator('#semantic-editor').getByLabel('Name', { exact: true })).toHaveValue('Recovered room');
	expect(errors).toEqual([]);
});

test('keeps specialist controls out of the authoring path and supports reversible deletion', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');

	await expect(page.locator('[data-tool="select"]')).toHaveClass(/active/u);
	await expect(page.locator('#tool-title')).toHaveText('Select & move');
	await expect(page.locator('#reviewer-id')).not.toBeVisible();
	await expect(page.getByText('Destination details', { exact: true })).not.toBeVisible();
	await page.getByText('Review & delivery', { exact: true }).click();
	await expect(page.getByText('What is this?', { exact: true })).toBeVisible();
	await expect(page.getByText('Destination details', { exact: true })).toBeVisible();
	await expect(page.getByText('The connected route network used for directions.', { exact: true })).toBeVisible();
	const reviewScreenshotPath: string = testInfo.outputPath('review-delivery-panel.png');
	await page.screenshot({ fullPage: true, path: reviewScreenshotPath });
	await testInfo.attach('review-delivery-panel', { contentType: 'image/png', path: reviewScreenshotPath });
	await page.getByText('Review & delivery', { exact: true }).click();

	const canvas = page.locator('#stage');
	await page.locator('[data-tool="location"]').click();
	await canvas.click({ position: { x: 220, y: 280 } });
	await canvas.click({ position: { x: 420, y: 280 } });
	await canvas.click({ position: { x: 420, y: 440 } });
	await canvas.click({ position: { x: 220, y: 440 } });
	await page.locator('#semantic-finish').click();
	await expect(page.locator('#delete-selection')).toBeEnabled();

	await page.locator('[data-tool="select"]').click();
	await page.locator('#delete-selection').click();
	await expect(page.locator('#undo')).toBeEnabled();
	await expect(page.locator('#semantic-editor')).toContainText('Select an authored');

	await page.locator('#undo').click();
	await canvas.click({ position: { x: 320, y: 360 } });
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');
	await expect(page.locator('#redo')).toBeEnabled();

	await page.locator('#redo').click();
	await canvas.click({ position: { x: 320, y: 360 } });
	await expect(page.locator('#semantic-editor')).toContainText('Select an authored');
	expect(errors).toEqual([]);
});

test('edits room and POI descriptions with discoverable keyboard authoring', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');

	await page.keyboard.press('?');
	await expect(page.locator('#shortcut-dialog')).toBeVisible();
	await expect(page.locator('#shortcut-dialog')).toContainText('Hold to pan');
	await expect(page.locator('#shortcut-dialog')).toContainText('Save project');
	await page.locator('#shortcut-close').click();

	const canvas = page.locator('#stage');
	await page.keyboard.press('r');
	await expect(page.locator('[data-tool="location"]')).toHaveClass(/active/u);
	await canvas.click({ position: { x: 220, y: 280 } });
	await canvas.click({ position: { x: 420, y: 280 } });
	await canvas.click({ position: { x: 420, y: 440 } });
	await canvas.click({ position: { x: 220, y: 440 } });
	await page.keyboard.press('Enter');
	const selection = page.locator('#semantic-editor');
	await expect(selection.getByRole('heading', { name: 'Room / area' })).toBeVisible();
	await selection.getByLabel('Name', { exact: true }).fill('Visitor services');
	await selection.getByLabel('Description').fill('Maps, tickets, and local assistance for visitors.');
	await selection.getByLabel('Category').fill('Services');

	await selection.getByRole('heading', { name: 'Room / area' }).click();
	await page.keyboard.press('p');
	await canvas.click({ position: { x: 520, y: 360 } });
	await expect(selection.getByRole('heading', { name: 'Point of interest' })).toBeVisible();
	await selection.getByLabel('Name', { exact: true }).fill('Information desk');
	await selection.getByLabel('Description').fill('Staffed help desk near the main entrance.');
	await selection.getByLabel('Category').fill('Information');
	await selection.getByRole('heading', { name: 'Point of interest' }).click();
	await page.keyboard.press('l');
	await canvas.click({ position: { x: 600, y: 300 } });
	await expect(selection.getByRole('heading', { name: 'Text label' })).toBeVisible();
	await selection.getByLabel('Text', { exact: true }).fill('Main entrance');
	await selection.getByLabel('Font family').selectOption('serif');
	await selection.getByLabel('Font size').fill('36');
	await selection.getByLabel('Weight').selectOption('700');
	await selection.getByLabel('Text color').fill('#264653');
	await selection.getByLabel('Alignment').selectOption('middle');
	await selection.getByLabel('Outline color').fill('#ffffff');
	await selection.getByLabel('Outline width').fill('2');

	const downloadPromise = page.waitForEvent('download');
	await page.keyboard.press('Control+s');
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as { destinations: Array<{ category?: string; description?: string; name: string }>; floors: Array<{ elements: Array<Record<string, unknown>> }> };
	expect(project.destinations).toEqual(expect.arrayContaining([
		expect.objectContaining({ category: 'Services', description: 'Maps, tickets, and local assistance for visitors.', name: 'Visitor services' }),
		expect.objectContaining({ category: 'Information', description: 'Staffed help desk near the main entrance.', name: 'Information desk' })
	]));
	expect(project.floors[0].elements).toEqual(expect.arrayContaining([
		expect.objectContaining({ color: '#264653', fontFamily: 'serif', fontSize: 36, fontWeight: 700, outlineColor: '#ffffff', outlineWidth: 2, text: 'Main entrance', textAnchor: 'middle', type: 'label' })
	]));
	expect(errors).toEqual([]);
});
