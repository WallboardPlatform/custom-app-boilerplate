import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Locator } from '@playwright/test';
import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	type WayfindingStudioDoorElement,
	type WayfindingStudioElement,
	type WayfindingStudioPolygonElement,
	type WayfindingStudioProject
} from '../studio-project.mts';

const createRouteTestProject = (): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject('route-clear-test');
	const floor = project.floors[0];
	floor.pedestrianSpaceSource = 'polygons';
	floor.elements = [
		{ floorId: floor.id, geometry: [{ x: 40, y: 40 }, { x: 840, y: 40 }, { x: 840, y: 480 }, { x: 40, y: 480 }], id: 'main-walkable', provenance: 'reviewer-authored', status: 'confirmed', type: 'walkable' },
		{ floorId: floor.id, geometry: [{ x: 260, y: 235 }, { x: 340, y: 235 }, { x: 340, y: 320 }, { x: 260, y: 320 }], id: 'blocked-island', provenance: 'reviewer-authored', status: 'confirmed', type: 'obstacle' },
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
		geometry: [{ x: 120, y: 200 }, { x: 300, y: 140 }, { x: 500, y: 240 }],
		id: 'lobby-to-meeting',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'semantic:meeting-room-shape',
		traversal: 'indoor-corridor'
	}];

	return project;
};

const createAutomaticRouteTestProject = (): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject('automatic-route-test');
	const floor = project.floors[0];
	floor.pedestrianSpaceSource = 'polygons';
	floor.width = 900;
	floor.height = 600;
	floor.walkableMask = {
		cellSize: 20,
		columns: 45,
		contractVersion: 1,
		height: 600,
		mapId: 'automatic-route-test:stale-painted-mask',
		reviewStatus: 'proposed',
		rows: 30,
		walkableRuns: [[0, 0, 0]],
		width: 900
	};
	floor.elements = [
		{
			floorId: floor.id,
			geometry: [{ x: 50, y: 80 }, { x: 850, y: 80 }, { x: 850, y: 520 }, { x: 50, y: 520 }],
			id: 'main-walkable',
			provenance: 'reviewer-authored',
			status: 'proposed',
			type: 'walkable'
		},
		{
			destinationId: 'meeting-room',
			floorId: floor.id,
			geometry: [{ x: 650, y: 180 }, { x: 840, y: 180 }, { x: 840, y: 420 }, { x: 650, y: 420 }],
			id: 'meeting-room-shape',
			label: 'Meeting room',
			provenance: 'reviewer-authored',
			status: 'proposed',
			type: 'location'
		},
		{
			destinationId: 'storage-room',
			floorId: floor.id,
			geometry: [{ x: 360, y: 180 }, { x: 540, y: 180 }, { x: 540, y: 420 }, { x: 360, y: 420 }],
			id: 'storage-room-shape',
			label: 'Storage room',
			provenance: 'reviewer-authored',
			status: 'proposed',
			type: 'location'
		},
		{ angle: 90, floorId: floor.id, id: 'meeting-room-door', length: 36, point: { x: 650, y: 300 }, provenance: 'reviewer-authored', status: 'proposed', type: 'door' },
		{ facingDegrees: 0, floorId: floor.id, id: 'lobby-screen', label: 'Lobby screen', point: { x: 100, y: 300 }, provenance: 'reviewer-authored', screenId: 'screen-1', status: 'proposed', type: 'origin' }
	];
	project.destinations = [
		{ floor: floor.id, id: 'meeting-room', name: 'Meeting room', routeable: true },
		{ floor: floor.id, id: 'storage-room', name: 'Storage room', routeable: true }
	];
	synchronizeWayfindingStudioGraph(project);

	return project;
};

const create3dTestProject = (): WayfindingStudioProject => {
	const project: WayfindingStudioProject = createWayfindingStudioProject('three-dimensional-preview');
	const floor = project.floors[0];
	project.defaults!.route.animation = 'flow';
	project.defaults!.route.animationSpeed = 120;
	project.defaults!.route.lineWidth = 13;
	project.assets.push({
		dataUrl: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Ccircle cx="32" cy="32" r="24" fill="%2318826f"/%3E%3Cpath d="M19 34h26v6H19zM29 18h6v26h-6z" fill="white"/%3E%3C/svg%3E',
		id: 'builtin:test-information',
		kind: 'icon',
		mimeType: 'image/svg+xml',
		name: 'Test information',
		naturalHeight: 64,
		naturalWidth: 64
	});
	floor.width = 900;
	floor.height = 600;
	floor.elements = [
		{ facingDegrees: 0, floorId: floor.id, id: 'gallery-screen', label: 'Gallery screen', point: { x: 100, y: 300 }, provenance: 'reviewer-authored', screenId: 'screen-1', status: 'confirmed', type: 'origin' },
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
		},
		{ assetId: 'builtin:test-information', floorId: floor.id, height: 64, id: 'information-icon', point: { x: 418, y: 226 }, provenance: 'reviewer-authored', status: 'confirmed', type: 'icon', width: 64 }
	];
	project.destinations = [{ floor: floor.id, id: 'exhibition-hall', name: 'Exhibition hall', routeable: true }];
	synchronizeWayfindingStudioGraph(project);
	project.graph.edges = [{
		accessible: true,
		bidirectional: true,
		from: 'semantic:gallery-screen',
		geometry: [{ x: 100, y: 300 }, { x: 220, y: 310 }, { x: 450, y: 310 }],
		id: 'gallery-to-exhibition',
		kind: 'walk',
		reviewStatus: 'confirmed',
		to: 'semantic:exhibition-hall-shape',
		traversal: 'indoor-corridor'
	}];

	return project;
};

test.beforeEach(async ({ page }) => {
	await page.addInitScript((): void => {
		Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
		Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
	});
});

const mapPointAtCanvasPosition = async (canvas: Locator, position: { x: number; y: number }): Promise<{ x: number; y: number }> => canvas.evaluate(
	(element, canvasPosition): { x: number; y: number } => ({
		x: (canvasPosition.x - Number(element.dataset.viewOffsetX)) / Number(element.dataset.viewScale),
		y: (canvasPosition.y - Number(element.dataset.viewOffsetY)) / Number(element.dataset.viewScale)
	}),
	position
);

const clickMapPoint = async (canvas: Locator, point: { x: number; y: number }): Promise<void> => {
	const position = await canvas.evaluate(
		(element, mapPoint): { x: number; y: number } => ({
			x: Number(element.dataset.viewOffsetX) + mapPoint.x * Number(element.dataset.viewScale),
			y: Number(element.dataset.viewOffsetY) + mapPoint.y * Number(element.dataset.viewScale)
		}),
		point
	);
	await canvas.click({ position });
};

test('authors, refines, and exports a portable semantic project', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Wayfinding Studio' })).toBeVisible();
	await expect(page.locator('#studio-version')).toHaveText('Editor v0.16');
	await expect(page.locator('.workspace-switcher button')).toHaveText(['Map', 'Route edit', 'Route preview', 'Visitor preview']);
	await expect(page.locator('#studio-floor')).toHaveValue('level-0');

	const canvas = page.locator('#stage');
	const authoredRoomCenter = await mapPointAtCanvasPosition(canvas, { x: 330, y: 405 });
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
	await clickMapPoint(canvas, authoredRoomCenter);
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');

	const screenshotPath: string = testInfo.outputPath('authored-studio.png');
	await page.screenshot({ fullPage: true, path: screenshotPath });
	await testInfo.attach('authored-studio', { contentType: 'image/png', path: screenshotPath });

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-project-name').fill('Visitor Center / Ground Floor');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('Visitor Center - Ground Floor.wbwayfinding');
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as { floors: Array<{ elements: Array<{ geometry?: unknown[]; type: string }> }> };
	expect(project.floors[0].elements.map((element): string => element.type)).toEqual(['location', 'origin']);
	expect(project.floors[0].elements[0].geometry).toHaveLength(5);
	expect(errors).toEqual([]);
});

test('keeps first-time guidance and authoring controls cohesive at the sidebar width', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('#project-onboarding')).toBeVisible();
	await expect(page.locator('.layer-panel')).not.toHaveAttribute('open', '');

	await page.locator('.project-defaults > summary').click();
	await page.locator('.builtin-icon-picker > summary').click();
	await page.locator('.layer-panel > summary').click();

	const overflowingControls = await page.locator(
		'.project-defaults button, .project-defaults input, .project-defaults select, .builtin-icon span, .layer-actions button, #autosave-status, #mask-status'
	).evaluateAll((elements): string[] => elements
		.filter((element): boolean => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1)
		.map((element): string => `${element.tagName.toLowerCase()}#${element.id}.${element.className}:${element.textContent?.trim() ?? ''}`));
	expect(overflowingControls).toEqual([]);
	await expect(page.locator('.builtin-icon[title="Place Restroom"] span')).toHaveText('Restroom');
	await expect(page.locator('.layer-actions button')).toHaveText(['Show all', 'Hide all']);

	const canvas = page.locator('#stage');
	await page.locator('[data-tool="location"]').click();
	await canvas.click({ position: { x: 220, y: 280 } });
	await canvas.click({ position: { x: 420, y: 280 } });
	await canvas.click({ position: { x: 420, y: 440 } });
	await canvas.click({ position: { x: 220, y: 440 } });
	await page.locator('#semantic-finish').click();
	await expect(page.locator('#project-onboarding')).toBeHidden();

	await page.locator('#workspace-route-edit').click();
	await expect(page.locator('.authoring-tools button')).toHaveText(['Edit network', 'Draw segment', 'Place endpoint']);
	await expect(page.locator('.route-editor-step h3')).toHaveText([
		'1. Confirm pedestrian space',
		'2. Build routes',
		'3. Manual adjustments'
	]);
});

test('expands the map workspace and provides a focused visitor preview', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => {
		if (message.type() === 'error') errors.push(message.text());
	});
	page.on('pageerror', (error): void => { errors.push(error.message); });
	const project: WayfindingStudioProject = createRouteTestProject();
	project.destinations[0] = {
		...project.destinations[0],
		category: 'Meeting rooms',
		description: 'Weekly team briefings and visitor presentations.',
		hours: '08:00 - 18:00',
		mapNumber: 'G-12',
		status: 'Open'
	};
	const projectPath: string = testInfo.outputPath('visitor-preview-project.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(project));

	await page.goto('/');
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await expect(page.locator('#shortcut-help')).toHaveCount(1);

	const stage = page.locator('.stage-shell');
	const canvas = page.locator('#stage');
	const initialBounds = await stage.boundingBox();
	const readViewport = async (): Promise<{ centerX: number; centerY: number; scale: number }> => canvas.evaluate((element): { centerX: number; centerY: number; scale: number } => {
		const bounds = element.getBoundingClientRect();
		const scale = Number(element.dataset.viewScale);
		const offsetX = Number(element.dataset.viewOffsetX);
		const offsetY = Number(element.dataset.viewOffsetY);
		return {
			centerX: (bounds.width / 2 - offsetX) / scale,
			centerY: (bounds.height / 2 - offsetY) / scale,
			scale
		};
	});
	const initialViewport = await readViewport();
	await page.locator('#toggle-left-panel').click();
	await expect(page.locator('body')).toHaveAttribute('data-left-panel', 'closed');
	await expect(page.locator('.controls')).toBeHidden();
	await page.locator('#toggle-right-panel').click();
	await expect(page.locator('body')).toHaveAttribute('data-right-panel', 'closed');
	await expect(page.locator('.review')).toBeHidden();
	await page.waitForTimeout(220);
	const expandedBounds = await stage.boundingBox();
	expect((expandedBounds?.width ?? 0)).toBeGreaterThan(initialBounds?.width ?? 0);
	const expandedViewport = await readViewport();
	expect(expandedViewport.scale).toBeCloseTo(initialViewport.scale, 6);
	expect(expandedViewport.centerX).toBeCloseTo(initialViewport.centerX, 6);
	expect(expandedViewport.centerY).toBeCloseTo(initialViewport.centerY, 6);
	await page.locator('#toggle-left-panel').click();
	await page.locator('#toggle-right-panel').click();

	await page.locator('#workspace-runtime-preview').click();
	await expect(page.locator('body')).toHaveAttribute('data-workspace', 'runtime-preview');
	await expect(page.locator('#runtime-preview')).toBeVisible();
	await expect(page.locator('.controls')).toBeHidden();
	await expect(page.locator('.review')).toBeHidden();
	await page.locator('#runtime-preview-search').fill('weekly');
	await expect(page.locator('.runtime-preview-result')).toHaveCount(1);
	await expect(page.locator('.runtime-preview-result')).toContainText('Meeting room');
	await page.locator('.runtime-preview-result').click();
	await expect(page.locator('#runtime-preview-details')).toBeVisible();
	await expect(page.locator('#runtime-preview-name')).toHaveText('Meeting room');
	await expect(page.locator('#runtime-preview-description')).toContainText('Weekly team briefings');
	await expect(page.locator('#runtime-preview-facts')).toContainText('G-12');

	await page.locator('#runtime-preview-icons').uncheck();
	await page.locator('#runtime-preview-labels').uncheck();
	await expect(canvas).toHaveAttribute('data-runtime-icons-visible', 'false');
	await expect(canvas).toHaveAttribute('data-runtime-labels-visible', 'false');
	const closeHitTarget = await page.locator('#runtime-preview-details-close').evaluate((element: HTMLElement): string | undefined => {
		const bounds = element.getBoundingClientRect();
		return document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2)?.id;
	});
	expect(closeHitTarget).toBe('runtime-preview-details-close');
	await page.locator('#runtime-preview-details-close').click();
	await expect(page.locator('#runtime-preview-details')).toBeHidden();
	expect(errors).toEqual([]);
});

test('persists configurable visitor-position animation and exposes the extended symbol set', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	const projectPath: string = testInfo.outputPath('origin-animation-project.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(createRouteTestProject()));

	await page.goto('/');
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await page.locator('.project-defaults > summary').click();
	await page.locator('#default-origin-color').fill('#8f3db4');
	await page.locator('#default-origin-color').dispatchEvent('change');
	await page.locator('#default-origin-speed').fill('92');
	await page.locator('#default-origin-speed').blur();
	await page.locator('#default-origin-animation-2d').selectOption('pulse');
	await page.locator('#default-origin-animation-3d').selectOption('pulse');
	await expect(page.locator('#stage')).toHaveAttribute('data-origin-animation-2d', 'pulse');
	await page.locator('#view-3d').click();
	await expect(page.locator('#stage-3d')).toHaveAttribute('data-origin-animation-3d', 'pulse');

	await page.locator('#view-2d').click();
	await page.locator('.builtin-icon-picker > summary').click();
	for (const label of ['Payment terminal', 'Entrance', 'Wi-Fi', 'Pets allowed', 'Luggage storage']) {
		await expect(page.locator(`.builtin-icon[title="Place ${label}"]`)).toBeVisible();
	}

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const saved = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	expect(saved.defaults?.origin).toEqual({
		animation2d: 'pulse',
		animation3d: 'pulse',
		animationSpeed: 92,
		color: '#8f3db4'
	});
	expect(errors).toEqual([]);
});

test('saves back to an opened project file handle and keeps Save as separate', async ({ page }) => {
	const projectText: string = JSON.stringify(createRouteTestProject());
	await page.addInitScript((value: string): void => {
		const createHandle = (name: string, storageKey: string) => ({
			createWritable: async () => ({
				close: async (): Promise<void> => undefined,
				write: async (data: Blob | string): Promise<void> => {
					localStorage.setItem(storageKey, typeof data === 'string' ? data : await data.text());
				}
			}),
			getFile: async (): Promise<File> => new File([value], name, { type: 'application/json' }),
			name,
			queryPermission: async (): Promise<PermissionState> => 'granted',
			requestPermission: async (): Promise<PermissionState> => 'granted'
		});
		Object.defineProperty(window, 'showOpenFilePicker', {
			configurable: true,
			value: async () => [createHandle('opened-map.wbwayfinding', 'opened-map-write')]
		});
		Object.defineProperty(window, 'showSaveFilePicker', {
			configurable: true,
			value: async () => createHandle('copied-map.wbwayfinding', 'copied-map-write')
		});
	}, projectText);
	await page.goto('/');
	await page.locator('#studio-open-project').click();
	await expect(page.locator('#project-context-source')).toHaveText('Project file: opened-map.wbwayfinding');
	await page.locator('#studio-project-name').fill('Updated opened project');
	await page.locator('#studio-export-project').click();
	await expect.poll(async (): Promise<string | null> => page.evaluate(() => localStorage.getItem('opened-map-write'))).not.toBeNull();
	const savedName: string = await page.evaluate((): string => JSON.parse(localStorage.getItem('opened-map-write') as string).name as string);
	expect(savedName).toBe('Updated opened project');
	await expect(page.locator('#project-context-portable')).toHaveText('Saved to opened-map.wbwayfinding');

	await page.locator('#studio-save-as').click();
	await expect.poll(async (): Promise<string | null> => page.evaluate(() => localStorage.getItem('copied-map-write'))).not.toBeNull();
	await expect(page.locator('#project-context-portable')).toHaveText('Saved to copied-map.wbwayfinding');
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

	await page.locator('#workspace-route-edit').click();
	await page.locator('#polygon-pedestrian-tools [data-tool="walkable"]').click();
	for (const position of [{ x: 220, y: 280 }, { x: 350, y: 280 }, { x: 350, y: 380 }, { x: 220, y: 380 }]) await canvas.click({ position });
	await page.keyboard.press('Enter');

	await page.locator('#workspace-map').click();
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
	await expect(page.locator('#project-context-portable')).toHaveText('Not saved to file');
	await page.locator('#drawing-mode-lasso').click();
	await page.locator('#workspace-route-edit').click();
	await page.locator('#polygon-pedestrian-tools [data-tool="walkable"]').click();
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
	await page.locator('#polygon-pedestrian-tools [data-tool="obstacle"]').click();
	await trace([{ x: 290, y: 335 }, { x: 365, y: 335 }, { x: 365, y: 415 }, { x: 290, y: 415 }, { x: 290, y: 335 }]);
	await expect(page.locator('#semantic-editor h2')).toHaveText('Blocked area');

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	expect(project.floors[0].elements.filter((element): boolean => element.type === 'walkable')).toHaveLength(1);
	expect(project.floors[0].elements.filter((element): boolean => element.type === 'obstacle')).toHaveLength(1);
	await expect(page.locator('#project-context-portable')).toHaveText('Saved to Wayfinding project.wbwayfinding');
	await page.locator('#studio-project-name').fill('Edited after download');
	await expect(page.locator('#project-context-portable')).toHaveText('Unsaved file changes');
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
				<path d="M150 120H650V480H430V450H370V480H150Z" fill="#9ed7cd" stroke="#173b35" stroke-width="10"/>
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
	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const detectedProject = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	const detectedRoom = detectedProject.floors[0].elements.find((element: WayfindingStudioElement): element is WayfindingStudioPolygonElement => element.type === 'location');
	expect(detectedRoom?.geometry).toHaveLength(8);
	expect(detectedRoom?.presentation?.fillColor).toBe('#9ed7cd');

	const layerToggles = page.locator('[data-layer]');
	await expect(layerToggles).toHaveCount(10);
	const layerPanel = page.locator('.layer-panel');
	await expect(layerPanel).not.toHaveAttribute('open', '');
	await layerPanel.locator('> summary').click();
	await expect(layerPanel).toHaveAttribute('open', '');
	await page.locator('#hide-all-layers').click();
	for (let index = 0; index < await layerToggles.count(); index += 1) await expect(layerToggles.nth(index)).not.toBeChecked();
	await page.locator('#show-all-layers').click();
	for (let index = 0; index < await layerToggles.count(); index += 1) await expect(layerToggles.nth(index)).toBeChecked();
	await expect(page.locator('#object-explorer-panel')).toHaveAttribute('open', '');
	await page.locator('#object-explorer-panel > summary').click();
	await expect(page.locator('#object-explorer-panel')).not.toHaveAttribute('open', '');
	await page.locator('#object-explorer-panel > summary').click();
	await expect(page.locator('#object-explorer-panel')).toHaveAttribute('open', '');
	expect(await page.locator('#cursor-position').evaluate((element): boolean => element.parentElement?.classList.contains('stage-shell') ?? false)).toBe(true);

	await page.locator('#studio-new-project').click();
	await expect(page.locator('#confirm-dialog')).toBeVisible();
	await page.locator('#confirm-accept').click();
	await expect(page.locator('#project-context-source')).toHaveText('New browser draft');
	await expect(page.locator('#project-context-portable')).toHaveText('Not saved to file');
	await expect(page.locator('#studio-project-name')).toHaveValue('Wayfinding project');
	await expect(page.locator('#semantic-editor')).toContainText('Select an authored');
	await expect(page.locator('#coverage-status')).toContainText('New project ready');
	expect(errors).toEqual([]);
});

test('detect area does not escape through an opening narrower than its configured minimum', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	await page.locator('#image-file').setInputFiles({
		name: 'narrow-opening.svg',
		mimeType: 'image/svg+xml',
		buffer: Buffer.from(`
			<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
				<rect width="800" height="600" fill="#f8f6ef"/>
				<rect x="100" y="120" width="250" height="360" fill="#9ed7cd"/>
				<rect x="354" y="120" width="346" height="360" fill="#9ed7cd"/>
				<rect x="350" y="298" width="4" height="4" fill="#9ed7cd"/>
			</svg>
		`)
	});
	await page.locator('#drawing-mode-smart').click();
	await page.locator('[data-tool="location"]').click();
	await expect(page.locator('#detect-opening')).toBeVisible();
	await expect(page.locator('#detect-opening')).toHaveValue('5');
	const canvas = page.locator('#stage');
	const view = await canvas.evaluate((element: HTMLCanvasElement): { offsetX: number; offsetY: number; scale: number } => ({
		offsetX: Number(element.dataset.viewOffsetX),
		offsetY: Number(element.dataset.viewOffsetY),
		scale: Number(element.dataset.viewScale)
	}));
	await canvas.click({ position: { x: view.offsetX + 220 * view.scale, y: view.offsetY + 300 * view.scale } });
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	const room = project.floors[0].elements.find((element): element is WayfindingStudioPolygonElement => element.type === 'location');
	expect(Math.max(...(room?.geometry ?? []).map((point): number => point.x))).toBeLessThan(400);
	expect(errors).toEqual([]);
});

test('builds routes from authored walkable areas and auto-links a nearby door', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	const projectPath: string = testInfo.outputPath('automatic-route-test.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(createAutomaticRouteTestProject()));
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await page.locator('#workspace-route-edit').click();
	await expect(page.locator('[data-pedestrian-source="polygons"]')).toHaveClass(/active/u);
	await expect(page.locator('#polygon-pedestrian-tools')).toBeVisible();
	await expect(page.locator('#mask-pedestrian-tools')).toBeHidden();
	await expect(page.locator('#route-setup-checklist li[data-ready="false"]')).toHaveCount(2);
	await expect(page.locator('#route-destination option')).toHaveCount(2);
	await expect(page.locator('#route-destination option', { hasText: 'Storage room' })).toHaveAttribute('disabled', '');
	await expect(page.locator('#route-destination option', { hasText: 'Storage room' })).toContainText('needs linked door');
	await page.locator('#route-build').click();
	await expect(page.locator('#route-setup-checklist li[data-ready="false"]')).toHaveCount(0);
	await expect(page.locator('#edge-summary')).not.toHaveText('0 route segments');
	await expect(page.locator('#route-result')).toContainText('ready to simulate');
	await expect(page.locator('#route-result')).toContainText('1/2 routeable rooms');
	await expect(page.locator('#route-result')).toContainText('1 room still needs a linked door');
	await page.locator('#workspace-route-preview').click();
	await expect(page.locator('[data-tool="select"]').first()).toHaveClass(/active/u);
	await page.locator('#route-simulate').click();
	await expect(page.locator('#route-result')).toContainText('min');
	const screenshotPath: string = testInfo.outputPath('automatic-route-studio.png');
	await page.screenshot({ fullPage: true, path: screenshotPath });
	await testInfo.attach('automatic-route-studio', { contentType: 'image/png', path: screenshotPath });

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const builtProject = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	const door = builtProject.floors[0].elements.find((element: WayfindingStudioElement): element is WayfindingStudioDoorElement => element.type === 'door');
	expect(door?.locationId).toBe('meeting-room-shape');
	expect(builtProject.floors[0].pedestrianSpaceSource).toBe('polygons');
	expect(builtProject.floors[0].walkableMask?.mapId).toBe('automatic-route-test:stale-painted-mask');
	expect(builtProject.floors[0].walkableMask?.walkableRuns).toEqual([[0, 0, 0]]);
	expect(builtProject.graph.edges.length).toBeGreaterThan(0);
	const roomNode = builtProject.graph.nodes.find((node): boolean => node.semanticElementId === 'meeting-room-shape');
	expect(roomNode).toMatchObject({ x: door?.point.x, y: door?.point.y });
	const roomApproach = builtProject.graph.edges.find((edge): boolean => edge.id.startsWith('approach:') && edge.from === roomNode?.id);
	expect(roomApproach).toBeDefined();
	const approachGeometry = roomApproach?.geometry ?? [];
	expect(approachGeometry[0]).toEqual(door?.point);
	expect(approachGeometry.length).toBeGreaterThan(1);
	expect(approachGeometry[1].x).toBeLessThan(door?.point.x ?? Number.NEGATIVE_INFINITY);
	expect(Math.abs(approachGeometry[1].y - (door?.point.y ?? 0))).toBeLessThanOrEqual(10);
	expect(approachGeometry.every((point): boolean => point.x >= 50 && point.x <= 850 && point.y >= 80 && point.y <= 520)).toBe(true);
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
	await expect(page.locator('#media-asset-summary')).toContainText('marker.png stays selected');
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

test('opens recoverable projects with a visible repair report and allows selecting the same file again', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	const project: WayfindingStudioProject = createWayfindingStudioProject('recoverable-browser-project');
	project.name = 'Recovered field project';
	project.floors[0].width = 100;
	project.floors[0].height = 80;
	project.floors[0].elements.push({
		floorId: 'level-0',
		geometry: [{ x: 10, y: 10 }, { x: 125, y: 10 }, { x: 125, y: 70 }, { x: 10, y: 70 }],
		id: 'walkable-7',
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'walkable'
	});
	const projectPath: string = testInfo.outputPath('recoverable-project.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(project));

	await page.goto('/');
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await expect(page.locator('#project-context-name')).toContainText('Recovered field project');
	await expect(page.locator('#studio-notice')).toContainText('automatic repair');
	await expect(page.locator('#studio-notice')).toContainText('walkable-7');
	await expect(page.locator('#project-context-portable')).toHaveText('Not saved to file');

	await page.locator('#studio-open-project').click();
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await expect(page.locator('#studio-notice')).toContainText('automatic repair');
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
	await page.locator('#workspace-route-edit').click();
	await expect(page.locator('#edge-summary')).toHaveText('1 route segment');
	await expect(page.locator('#edge-list button')).toContainText('Lobby screen to Meeting room');
	await page.locator('#edge-list button').click();
	await expect(page.locator('#selected-edge h2')).toHaveText('Route segment');
	await expect(page.locator('#selected-edge').getByLabel('Segment type')).toHaveValue('indoor');
	await expect(page.locator('#selected-edge')).toContainText('Advanced segment settings');

	await page.locator('#workspace-route-preview').click();
	const clearRoute = page.locator('#route-clear');
	const inspectRoute = page.locator('#route-inspect');
	await expect(clearRoute).toBeDisabled();
	await expect(inspectRoute).toBeDisabled();
	const canvas = page.locator('#stage');
	await expect(canvas).toHaveAttribute('data-route-network-visible', 'false');
	await page.locator('#route-preview-network').check();
	await expect(canvas).toHaveAttribute('data-route-network-visible', 'true');
	const canvasSize = await canvas.evaluate((element: HTMLCanvasElement): { height: number; width: number } => {
		const bounds: DOMRect = element.getBoundingClientRect();
		return { height: bounds.height, width: bounds.width };
	});
	const routeScale: number = Math.min(canvasSize.width / 1920, canvasSize.height / 1080) * 0.96;
	const routeOffsetX: number = (canvasSize.width - 1920 * routeScale) / 2;
	const routeOffsetY: number = (canvasSize.height - 1080 * routeScale) / 2;
	await canvas.click({ position: { x: routeOffsetX + 630 * routeScale, y: routeOffsetY + 240 * routeScale } });
	await expect(page.locator('#route-result')).toContainText('min');
	await expect(page.locator('#route-result')).toContainText('1 network segment');
	await expect(canvas).toHaveAttribute('data-preview-route-point-count', '3');
	await expect(clearRoute).toBeEnabled();
	await expect(inspectRoute).toBeEnabled();
	await inspectRoute.click();
	await expect(page.locator('#workspace-route-edit')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('#selected-edge')).toContainText('Lobby screen to Meeting room');
	await expect(canvas).toHaveAttribute('data-preview-route-point-count', '3');
	await page.locator('#workspace-route-preview').click();
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
	await expect(preview).toHaveAttribute('data-media-count', '1');
	await expect(preview).toHaveAttribute('data-rendered-media-count', '1');
	await expect(preview).toHaveAttribute('data-ready-media-count', '1');
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
	const fillColor = page.locator('#semantic-editor').getByLabel('Fill color');
	await fillColor.fill('#d17a45');
	await fillColor.blur();
	await expect(page.locator('#undo')).toBeEnabled();
	await page.locator('#workspace-route-preview').click();
	await page.mouse.click((bounds?.x ?? 0) + (bounds?.width ?? 0) / 2, (bounds?.y ?? 0) + (bounds?.height ?? 0) / 2);
	await expect(page.locator('#route-result')).toContainText('min');
	await expect(preview).toHaveAttribute('data-route-animation', 'flow');
	await expect(preview).toHaveAttribute('data-route-width', '13');
	const firstProgress: string | null = await preview.getAttribute('data-route-progress');
	await expect.poll(async (): Promise<string | null> => preview.getAttribute('data-route-progress')).not.toBe(firstProgress);
	const routeScreenshotPath: string = testInfo.outputPath('three-dimensional-route-preview.png');
	await preview.screenshot({ path: routeScreenshotPath });
	await testInfo.attach('three-dimensional-route-preview', { contentType: 'image/png', path: routeScreenshotPath });
	await page.locator('#view-2d').click();
	await expect(page.locator('#stage')).toBeVisible();
	await page.locator('#undo').click();
	await page.locator('#view-3d').click();
	await expect(webglCanvas).toBeVisible();
	await page.locator('#workspace-map').click();

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
	await expect(page.locator('#autosave-status')).toHaveText('AUTOSAVE');
	const stageBoundsBeforeSave = await page.locator('.stage-shell').boundingBox();

	const canvas = page.locator('#stage');
	const authoredRoomCenter = await mapPointAtCanvasPosition(canvas, { x: 320, y: 360 });
	await page.locator('[data-tool="location"]').click();
	for (const position of [{ x: 220, y: 280 }, { x: 420, y: 280 }, { x: 420, y: 440 }, { x: 220, y: 440 }]) await canvas.click({ position });
	await page.locator('#semantic-finish').click();
	await page.locator('#semantic-editor').getByLabel('Name', { exact: true }).fill('Recovered room');
	await expect(page.locator('#autosave-status')).toHaveText('SAVED', { timeout: 5000 });
	await expect(page.locator('#autosave-status')).toHaveAttribute('data-detail', /^SAVED /u);
	expect(await page.locator('.stage-shell').boundingBox()).toEqual(stageBoundsBeforeSave);

	await page.reload();
	await expect(page.locator('#local-recovery')).toBeVisible();
	await expect(page.locator('#local-recovery-summary')).toContainText('Wayfinding project');
	await page.locator('#restore-autosave').click();
	await expect(page.locator('#local-recovery')).toBeHidden();
	await expect(page.locator('#coverage-status')).toContainText('Restored local work');
	await page.locator('[data-tool="select"]').click();
	await clickMapPoint(canvas, authoredRoomCenter);
	await expect(page.locator('#semantic-editor').getByRole('heading', { name: 'Room / area' })).toBeVisible();
	await expect(page.locator('#semantic-editor').getByLabel('Name', { exact: true })).toHaveValue('Recovered room');
	expect(errors).toEqual([]);
});

test('keeps specialist delivery controls out of the authoring path and supports reversible deletion', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');

	await expect(page.locator('[data-tool="select"]')).toHaveClass(/active/u);
	await expect(page.locator('#tool-title')).toHaveText('Select & move');
	await expect(page.locator('#reviewer-id')).not.toBeVisible();
	await expect(page.getByText('Destination details', { exact: true })).not.toBeVisible();
	await expect(page.getByText('Delivery checks', { exact: true })).not.toBeVisible();
	await expect(page.locator('#studio-export-project')).toBeVisible();
	await expect(page.locator('#workspace-map')).toHaveAttribute('aria-pressed', 'true');

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
	await expect(page.locator('#shortcut-dialog')).toContainText('Save to the opened file');
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

test('keeps polygon drafts reversible and exposes authored objects with project defaults', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');

	await page.locator('.project-defaults > summary').click();
	await page.locator('#default-location-opacity').fill('58');
	await page.locator('#default-location-opacity').blur();
	await page.locator('#default-location-height').fill('31');
	await page.locator('#default-location-height').blur();
	await page.locator('[data-location-color-mode="random"]').click();

	const canvas = page.locator('#stage');
	await page.locator('#drawing-mode-points').click();
	await expect(page.locator('#trace-assist')).toBeHidden();
	await page.locator('[data-tool="location"]').click();
	await canvas.click({ position: { x: 220, y: 280 } });
	await canvas.click({ position: { x: 430, y: 280 } });
	await expect(canvas).toHaveAttribute('data-semantic-draft-point-count', '2');
	await page.locator('#undo').click();
	await expect(canvas).toHaveAttribute('data-semantic-draft-point-count', '1');
	await page.locator('#redo').click();
	await expect(canvas).toHaveAttribute('data-semantic-draft-point-count', '2');
	await canvas.click({ position: { x: 430, y: 450 } });
	await canvas.click({ position: { x: 220, y: 450 } });
	await page.locator('#semantic-finish').click();

	await expect(page.locator('#object-count')).toHaveText('1 item');
	await expect(page.locator('.object-group-heading')).toContainText('Rooms and areas (1)');
	await expect(page.locator('.object-item')).toHaveClass(/active/u);
	await page.locator('.object-item').click();
	await expect(page.locator('#semantic-editor h2')).toHaveText('Room / area');

	await page.locator('#project-language-code').fill('hu');
	await page.locator('#project-language-label').fill('Hungarian');
	await page.locator('#project-language-add').click();
	await expect(page.locator('#project-language-list')).toContainText('Hungarian');
	const translations = page.locator('.translation-editor');
	await translations.locator('summary').click();
	await translations.getByLabel('Name', { exact: true }).fill('Latogatoi szolgaltatasok');
	await translations.getByLabel('Description', { exact: true }).fill('Terkep, jegyek es helyi segitseg.');
	await page.locator('#project-category-name').fill('Visitor services');
	await page.locator('#project-category-add').click();
	await expect(page.locator('#project-category-list input').last()).toHaveValue('Visitor services');
	await page.locator('.builtin-icon-picker > summary').click();
	await page.locator('.builtin-icon[title="Place Information"]').click();
	await expect(page.locator('#media-asset-state')).toContainText('Information stays selected');
	await canvas.click({ position: { x: 610, y: 360 } });

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	const location = project.floors[0].elements.find((element): element is WayfindingStudioPolygonElement => element.type === 'location');
	const icon = project.floors[0].elements.find((element): boolean => element.type === 'icon');
	expect(project.defaults?.location.fillOpacity).toBe(0.58);
	expect(project.defaults?.location.extrusionHeight).toBe(31);
	expect(project.defaults?.locationColor.mode).toBe('random');
	expect(project.languages).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'hu', label: 'Hungarian' })]));
	expect(project.destinations).toEqual(expect.arrayContaining([
		expect.objectContaining({
			translations: expect.objectContaining({
				hu: expect.objectContaining({ description: 'Terkep, jegyek es helyi segitseg.', name: 'Latogatoi szolgaltatasok' })
			})
		})
	]));
	expect(project.categories).toContain('Visitor services');
	expect(location?.presentation?.fillOpacity).toBe(0.58);
	expect(location?.presentation?.extrusionHeight).toBe(31);
	expect(location?.presentation?.fillColor).toMatch(/^#[0-9a-f]{6}$/u);
	expect(icon).toEqual(expect.objectContaining({ assetId: 'builtin:information', type: 'icon' }));
	expect(project.assets).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'builtin:information', mimeType: 'image/svg+xml' })]));
	expect(errors).toEqual([]);
});

test('preserves the viewport through undo and supports temporary preview panning', async ({ page }) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	const canvas = page.locator('#stage');

	await canvas.hover({ position: { x: 500, y: 320 } });
	await page.mouse.wheel(0, -480);
	const before = await canvas.evaluate((element: HTMLCanvasElement): Record<string, string | undefined> => ({
		offsetX: element.dataset.viewOffsetX,
		offsetY: element.dataset.viewOffsetY,
		scale: element.dataset.viewScale
	}));
	await page.locator('[data-tool="label"]').click();
	await canvas.click({ position: { x: 520, y: 340 } });
	await page.locator('#undo').click();
	await expect.poll(async (): Promise<Record<string, string | undefined>> => canvas.evaluate((element: HTMLCanvasElement): Record<string, string | undefined> => ({
		offsetX: element.dataset.viewOffsetX,
		offsetY: element.dataset.viewOffsetY,
		scale: element.dataset.viewScale
	}))).toEqual(before);

	await page.locator('#workspace-route-preview').click();
	const panBefore: string | null = await canvas.getAttribute('data-view-offset-x');
	const bounds = await canvas.boundingBox();
	expect(bounds).not.toBeNull();
	await page.keyboard.down('Space');
	await page.mouse.move((bounds?.x ?? 0) + 20, (bounds?.y ?? 0) + 20);
	await page.mouse.down();
	await page.mouse.move((bounds?.x ?? 0) + 90, (bounds?.y ?? 0) + 55, { steps: 4 });
	await page.mouse.up();
	await page.keyboard.up('Space');
	await expect(canvas).not.toHaveAttribute('data-view-offset-x', panBefore ?? '');
	expect(errors).toEqual([]);
});

test('inserts, drags, and deletes individual route bends without replacing the segment', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	const projectPath: string = testInfo.outputPath('route-point-editing.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(createRouteTestProject()));
	await page.goto('/');
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await page.locator('#workspace-route-edit').click();

	const canvas = page.locator('#stage');
	const canvasPosition = async (point: { x: number; y: number }): Promise<{ x: number; y: number }> => canvas.evaluate(
		(element: HTMLCanvasElement, imagePoint): { x: number; y: number } => ({
			x: Number(element.dataset.viewOffsetX) + imagePoint.x * Number(element.dataset.viewScale),
			y: Number(element.dataset.viewOffsetY) + imagePoint.y * Number(element.dataset.viewScale)
		}),
		point
	);
	const insertionPosition = await canvasPosition({ x: 400, y: 190 });
	await canvas.dblclick({ position: insertionPosition });
	await expect(canvas).toHaveAttribute('data-selected-edge-vertex-index', '2');
	await expect(page.locator('[data-selected-point]')).toHaveText('Bend 3 of 4');

	const canvasBounds = await canvas.boundingBox();
	expect(canvasBounds).not.toBeNull();
	const dragTarget = await canvasPosition({ x: 420, y: 230 });
	await page.mouse.move((canvasBounds?.x ?? 0) + insertionPosition.x, (canvasBounds?.y ?? 0) + insertionPosition.y);
	await page.mouse.down();
	await page.mouse.move((canvasBounds?.x ?? 0) + dragTarget.x, (canvasBounds?.y ?? 0) + dragTarget.y, { steps: 4 });
	await page.mouse.up();

	const editedDownloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const editedDownload = await editedDownloadPromise;
	const editedPath: string = await editedDownload.path() as string;
	const editedProject = JSON.parse(fs.readFileSync(editedPath, 'utf8')) as WayfindingStudioProject;
	const editedEdge = editedProject.graph.edges.find((edge): boolean => edge.id === 'lobby-to-meeting');
	expect(editedEdge?.geometry).toHaveLength(4);
	expect(editedEdge?.geometry?.[2]).toEqual(expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }));
	expect(Math.abs((editedEdge?.geometry?.[2].y ?? 0) - 230)).toBeLessThan(3);

	await page.keyboard.press('Delete');
	await expect(page.locator('[data-selected-point]')).toHaveText('No route point selected');
	const cleanedDownloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const cleanedDownload = await cleanedDownloadPromise;
	const cleanedPath: string = await cleanedDownload.path() as string;
	const cleanedProject = JSON.parse(fs.readFileSync(cleanedPath, 'utf8')) as WayfindingStudioProject;
	expect(cleanedProject.graph.edges.find((edge): boolean => edge.id === 'lobby-to-meeting')?.geometry).toHaveLength(3);
	expect(cleanedProject.graph.edges).toHaveLength(1);
	expect(errors).toEqual([]);
});

test('rotates a door while placing it and persists animated route appearance', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('console', (message): void => { if (message.type() === 'error') errors.push(message.text()); });
	page.on('pageerror', (error): void => { errors.push(error.message); });
	await page.goto('/');
	const canvas = page.locator('#stage');
	const bounds = await canvas.boundingBox();
	expect(bounds).not.toBeNull();

	await page.locator('[data-tool="door"]').click();
	await page.mouse.move((bounds?.x ?? 0) + 360, (bounds?.y ?? 0) + 320);
	await page.mouse.down();
	await page.mouse.move((bounds?.x ?? 0) + 410, (bounds?.y ?? 0) + 385, { steps: 5 });
	await page.mouse.up();
	await expect(page.locator('#semantic-editor h2')).toHaveText('Door');

	const doorDownloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const doorDownload = await doorDownloadPromise;
	const doorDownloadPath: string = await doorDownload.path() as string;
	const doorProject = JSON.parse(fs.readFileSync(doorDownloadPath, 'utf8')) as WayfindingStudioProject;
	const placedDoor = doorProject.floors[0].elements.find((element): element is WayfindingStudioDoorElement => element.type === 'door');
	expect(Math.abs(placedDoor?.angle ?? 0)).toBeGreaterThan(20);

	const projectPath: string = testInfo.outputPath('animated-route-project.wbwayfinding');
	fs.writeFileSync(projectPath, JSON.stringify(createRouteTestProject()));
	await page.locator('#studio-open-project').click();
	await page.locator('#studio-project-file').setInputFiles(projectPath);
	await page.locator('.project-defaults > summary').click();
	await page.locator('#default-route-animation').selectOption('flow');
	await page.locator('#default-route-speed').fill('120');
	await page.locator('#default-route-speed').dispatchEvent('input');
	await page.locator('#default-route-color').fill('#1a73e8');
	await page.locator('#default-route-color').dispatchEvent('input');
	await page.locator('#default-route-width').fill('11');
	await page.locator('#default-route-width').blur();
	await page.locator('#workspace-route-preview').click();
	await expect(page.locator('.route-preview-style')).toHaveCount(0);

	const canvasSize = await canvas.evaluate((element: HTMLCanvasElement): { height: number; width: number } => {
		const rect: DOMRect = element.getBoundingClientRect();
		return { height: rect.height, width: rect.width };
	});
	const routeScale: number = Math.min(canvasSize.width / 1920, canvasSize.height / 1080) * 0.96;
	const routeOffsetX: number = (canvasSize.width - 1920 * routeScale) / 2;
	const routeOffsetY: number = (canvasSize.height - 1080 * routeScale) / 2;
	await canvas.click({ position: { x: routeOffsetX + 630 * routeScale, y: routeOffsetY + 240 * routeScale } });
	await expect(canvas).toHaveAttribute('data-route-animation', 'flow');
	await expect(page.locator('#route-result')).toContainText('min');

	const downloadPromise = page.waitForEvent('download');
	await page.locator('#studio-export-project').click();
	const download = await downloadPromise;
	const downloadPath: string = await download.path() as string;
	const project = JSON.parse(fs.readFileSync(downloadPath, 'utf8')) as WayfindingStudioProject;
	expect(project.defaults?.route).toEqual(expect.objectContaining({
		animation: 'flow',
		animationSpeed: 120,
		color: '#1a73e8',
		lineWidth: 11
	}));
	expect(errors).toEqual([]);
});
