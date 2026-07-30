import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';

import {
	createWayfindingStudioProject,
	synchronizeWayfindingStudioGraph,
	type WayfindingStudioProject
} from '../studio-project.mts';
import { PANEL_WIDTH_STORAGE_KEY } from './v2/panel-preferences';

const RECOVERY_KEY = 'wallboard-wayfinding-studio-v2-recovery';
const LOGO_DATA_URL = 'data:image/svg+xml;base64,'
	+ Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" rx="12" fill="#0f766e"/><path d="M20 40h40M40 20v40" stroke="white" stroke-width="8"/></svg>').toString('base64');
const PHOTO_DATA_URL = 'data:image/svg+xml;base64,'
	+ Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="480" height="240"><rect width="480" height="240" fill="#d7eee9"/><circle cx="240" cy="120" r="72" fill="#0f766e"/></svg>').toString('base64');
const TRACE_DATA_URL = 'data:image/svg+xml;base64,'
	+ Buffer.from(
		'<svg xmlns="http://www.w3.org/2000/svg" width="192" height="108">'
		+ '<rect width="192" height="108" fill="#f8fafc"/>'
		+ '<rect x="30" y="20" width="60" height="55" fill="#f59e0b"/>'
		+ '<rect x="105" y="20" width="55" height="55" fill="#14b8a6"/>'
		+ '</svg>'
	).toString('base64');

const createTestProject = (): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('studio-v2-test');
	const floor = project.floors[0];
	project.name = 'Northline Test Center';
	project.languages = [
		{ code: 'en', label: 'English' },
		{ code: 'hu', label: 'Magyar' }
	];
	project.categories = ['Dining', 'Services'];
	project.assets = [
		{
			dataUrl: LOGO_DATA_URL,
			id: 'asset-information-logo',
			kind: 'logo',
			mimeType: 'image/svg+xml',
			name: 'Visitor information logo',
			naturalHeight: 80,
			naturalWidth: 80
		},
		{
			dataUrl: PHOTO_DATA_URL,
			id: 'asset-information-photo',
			kind: 'photo',
			mimeType: 'image/svg+xml',
			name: 'Visitor information interior',
			naturalHeight: 240,
			naturalWidth: 480
		}
	];
	project.destinations = [{
		accessible: true,
		category: 'Services',
		description: 'Visitor information and assistance.',
		floor: floor.id,
		hours: '09:00-18:00',
		id: 'destination-information',
		logoAssetId: 'asset-information-logo',
		mapNumber: 'A-12',
		name: 'Visitor information',
		phone: '+1 555 0100',
		photoAssetIds: ['asset-information-photo'],
		routeable: true,
		status: 'open',
		translations: {
			hu: {
				description: 'Informacio es segitseg latogatoknak.',
				name: 'Informacio'
			}
		},
		website: 'https://example.com/visitor-information'
	}];
	floor.elements = [
		{
			floorId: floor.id,
			geometry: [
				{ x: 150, y: 160 },
				{ x: 1770, y: 160 },
				{ x: 1770, y: 900 },
				{ x: 150, y: 900 }
			],
			id: 'walkable-main',
			label: 'Main concourse',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			destinationId: 'destination-information',
			floorId: floor.id,
			geometry: [
				{ x: 1300, y: 220 },
				{ x: 1680, y: 220 },
				{ x: 1680, y: 520 },
				{ x: 1300, y: 520 }
			],
			id: 'location-information',
			label: 'Visitor information',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			defaultLanguage: 'en',
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 320, y: 650 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		},
		{
			category: 'Services',
			destinationId: 'destination-information',
			floorId: floor.id,
			id: 'poi-information',
			label: 'Visitor information point',
			point: { x: 1180, y: 540 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'poi'
		},
		{
			angle: 90,
			floorId: floor.id,
			id: 'door-information',
			length: 42,
			locationId: 'location-information',
			point: { x: 1300, y: 430 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		},
		{
			assetId: 'asset-information-logo',
			floorId: floor.id,
			height: 120,
			id: 'logo-information',
			point: { x: 980, y: 260 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'logo',
			width: 120
		}
	];
	project.graph = {
		contractVersion: 2,
		edges: [{
			accessible: true,
			bidirectional: true,
			from: 'route-origin',
			geometry: [
				{ x: 320, y: 650 },
				{ x: 900, y: 650 },
				{ x: 1300, y: 430 }
			],
			id: 'route-main',
			kind: 'walk',
			to: 'route-destination'
		}],
		graphId: 'studio-v2-test-graph',
		nodes: [
			{
				id: 'route-origin',
				kind: 'route',
				levelId: floor.id,
				semanticElementId: 'origin-main',
				x: 320,
				y: 650
			},
			{
				id: 'route-destination',
				kind: 'route',
				levelId: floor.id,
				locationId: 'destination-information',
				semanticElementId: 'door-information',
				x: 1300,
				y: 430
			}
		]
	};

	return project;
};

const createLongContentTestProject = (): WayfindingStudioProject => {
	const project = createTestProject();
	const destination = project.destinations[0];
	project.name = 'Northline International Medical and Research Campus';
	project.floors[0].name = 'Ground floor - Main visitor services and outpatient reception';
	project.categories = ['Visitor services, accessibility, admissions, and campus assistance'];
	destination.category = project.categories[0];
	destination.name = 'International visitor information, accessibility, and admissions assistance';
	destination.description = 'A fully staffed visitor service point for international guests, step-free arrival support, admissions guidance, campus orientation, and accessible onward travel.';
	destination.translations = {
		hu: {
			description: 'Nemzetkozi vendegszolgalat, akadalymentes erkezesi segitseg, felveteli tajekoztatas es reszletes kampuszorientacio.',
			name: 'Nemzetkozi latogatoi informacio, akadalymentesseg es felveteli segitseg'
		}
	};

	return project;
};

const createMultiFloorTestProject = (): WayfindingStudioProject => {
	const project = createTestProject();
	const ground = project.floors[0];
	const groundId = ground.id;
	ground.name = 'Ground floor';
	project.floors.push({
		elements: [
			{
				accessible: true,
				connectionId: 'lift-main',
				floorId: 'first',
				id: 'lift-first',
				kind: 'elevator',
				label: 'Main elevator',
				point: { x: 360, y: 650 },
				provenance: 'reviewer-authored',
				status: 'confirmed',
				type: 'transition'
			},
			{
				destinationId: 'destination-gallery',
				floorId: 'first',
				geometry: [
					{ x: 1300, y: 220 },
					{ x: 1680, y: 220 },
					{ x: 1680, y: 520 },
					{ x: 1300, y: 520 }
				],
				id: 'location-gallery',
				label: 'Sky gallery',
				provenance: 'reviewer-authored',
				status: 'confirmed',
				type: 'location'
			}
		],
		height: 1080,
		id: 'first',
		name: 'First floor',
		order: 1,
		width: 1920
	});
	ground.elements.push({
		accessible: true,
		connectionId: 'lift-main',
		floorId: groundId,
		id: 'lift-ground',
		kind: 'elevator',
		label: 'Main elevator',
		point: { x: 1120, y: 650 },
		provenance: 'reviewer-authored',
		status: 'confirmed',
		type: 'transition'
	});
	project.destinations.push({
		accessible: true,
		category: 'Services',
		description: 'Exhibitions above the concourse.',
		floor: 'first',
		id: 'destination-gallery',
		name: 'Sky gallery',
		routeable: true,
		status: 'open'
	});
	project.delivery.source.levels = 2;
	project.graph.nodes = [];
	project.graph.edges = [];
	synchronizeWayfindingStudioGraph(project);
	project.graph.edges.push(
		{
			accessible: true,
			bidirectional: true,
			from: 'semantic:origin-main',
			geometry: [{ x: 320, y: 650 }, { x: 1120, y: 650 }],
			id: 'ground-to-lift',
			kind: 'walk',
			to: 'semantic:lift-ground'
		},
		{
			accessible: true,
			bidirectional: true,
			from: 'semantic:lift-first',
			geometry: [{ x: 360, y: 650 }, { x: 1300, y: 430 }],
			id: 'lift-to-gallery',
			kind: 'walk',
			to: 'semantic:location-gallery'
		}
	);

	return project;
};

const createTraceTestProject = (): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('studio-v2-trace');
	const floor = project.floors[0];
	project.name = 'Smart trace test';
	project.assets = [{
		dataUrl: TRACE_DATA_URL,
		id: 'trace-background',
		kind: 'background',
		mimeType: 'image/svg+xml',
		name: 'Trace floor plan',
		naturalHeight: 108,
		naturalWidth: 192
	}];
	floor.backgroundAssetId = 'trace-background';

	return project;
};

const createPaintedMaskTestProject = (): WayfindingStudioProject => {
	const project = createTestProject();
	const floor = project.floors[0];
	const cellSize = 20;

	project.name = 'Painted mask compatibility test';
	floor.elements = floor.elements.filter((element) => element.type !== 'walkable');
	floor.pedestrianSpaceSource = 'mask';
	floor.walkableMask = {
		cellSize,
		columns: Math.ceil(floor.width / cellSize),
		contractVersion: 1,
		height: floor.height,
		mapId: floor.id,
		reviewStatus: 'confirmed',
		rows: Math.ceil(floor.height / cellSize),
		walkableRuns: Array.from(
			{ length: 38 },
			(_, index): [number, number, number] => [index + 8, 7, 88]
		),
		width: floor.width
	};

	return project;
};

const createAutomaticRouteTestProject = (): WayfindingStudioProject => {
	const project = createWayfindingStudioProject('studio-v2-automatic-route');
	const floor = project.floors[0];
	project.name = 'Automatic route test';
	floor.unitsPerMeter = 20;
	floor.pedestrianSpaceSource = 'polygons';
	floor.width = 900;
	floor.height = 600;
	floor.walkableMask = {
		cellSize: 20,
		columns: 45,
		contractVersion: 1,
		height: 600,
		mapId: 'studio-v2-automatic-route:stale-mask',
		reviewStatus: 'proposed',
		rows: 30,
		walkableRuns: [[0, 0, 0]],
		width: 900
	};
	floor.elements = [
		{
			floorId: floor.id,
			geometry: [
				{ x: 50, y: 80 },
				{ x: 850, y: 80 },
				{ x: 850, y: 520 },
				{ x: 50, y: 520 }
			],
			id: 'walkable-main',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'walkable'
		},
		{
			destinationId: 'destination-meeting',
			floorId: floor.id,
			geometry: [
				{ x: 650, y: 180 },
				{ x: 840, y: 180 },
				{ x: 840, y: 420 },
				{ x: 650, y: 420 }
			],
			id: 'location-meeting',
			label: 'Meeting room',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			destinationId: 'destination-storage',
			floorId: floor.id,
			geometry: [
				{ x: 360, y: 180 },
				{ x: 540, y: 180 },
				{ x: 540, y: 420 },
				{ x: 360, y: 420 }
			],
			id: 'location-storage',
			label: 'Storage room',
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'location'
		},
		{
			angle: 90,
			floorId: floor.id,
			id: 'door-meeting',
			length: 36,
			locationId: 'location-meeting',
			point: { x: 650, y: 300 },
			provenance: 'reviewer-authored',
			status: 'confirmed',
			type: 'door'
		},
		{
			defaultLanguage: 'en',
			facingDegrees: 0,
			floorId: floor.id,
			id: 'origin-main',
			label: 'You are here',
			point: { x: 100, y: 300 },
			provenance: 'reviewer-authored',
			screenId: 'screen-main',
			status: 'confirmed',
			type: 'origin'
		}
	];
	project.destinations = [
		{
			floor: floor.id,
			id: 'destination-meeting',
			name: 'Meeting room',
			routeable: true
		},
		{
			floor: floor.id,
			id: 'destination-storage',
			name: 'Storage room',
			routeable: true
		}
	];
	synchronizeWayfindingStudioGraph(project);

	return project;
};

const createRouteProfileTestProject = (): WayfindingStudioProject => {
	const project = createTestProject();
	const floorId = project.floors[0].id;
	project.graph = {
		contractVersion: 2,
		edges: [
			{
				accessible: false,
				bidirectional: true,
				from: 'route-origin',
				geometry: [
					{ x: 320, y: 650 },
					{ x: 1300, y: 430 }
				],
				id: 'route-direct-stairs',
				kind: 'stairs',
				to: 'route-destination'
			},
			{
				accessible: true,
				bidirectional: true,
				from: 'route-origin',
				geometry: [
					{ x: 320, y: 650 },
					{ x: 560, y: 250 }
				],
				id: 'route-step-free-west',
				kind: 'walk',
				to: 'route-step-free-west'
			},
			{
				accessible: true,
				bidirectional: true,
				from: 'route-step-free-west',
				geometry: [
					{ x: 560, y: 250 },
					{ x: 1040, y: 250 }
				],
				id: 'route-step-free-north',
				kind: 'walk',
				to: 'route-step-free-east'
			},
			{
				accessible: true,
				bidirectional: true,
				from: 'route-step-free-east',
				geometry: [
					{ x: 1040, y: 250 },
					{ x: 1300, y: 430 }
				],
				id: 'route-step-free-east',
				kind: 'walk',
				to: 'route-destination'
			}
		],
		graphId: 'studio-v2-profile-graph',
		nodes: [
			{
				id: 'route-origin',
				kind: 'route',
				levelId: floorId,
				semanticElementId: 'origin-main',
				x: 320,
				y: 650
			},
			{
				id: 'route-step-free-west',
				kind: 'route',
				levelId: floorId,
				x: 560,
				y: 250
			},
			{
				id: 'route-step-free-east',
				kind: 'route',
				levelId: floorId,
				x: 1040,
				y: 250
			},
			{
				id: 'route-destination',
				kind: 'route',
				levelId: floorId,
				locationId: 'destination-information',
				semanticElementId: 'door-information',
				x: 1300,
				y: 430
			}
		]
	};

	return project;
};

const openEditor = async (page: Page, project: WayfindingStudioProject = createTestProject()): Promise<void> => {
	await page.addInitScript(({ key, serialized }) => {
		localStorage.setItem(key, serialized);
	}, { key: RECOVERY_KEY, serialized: JSON.stringify(project) });
	await page.goto('/v2/');
	await expect(page.getByRole('dialog', { name: 'Restore unsaved local work?' })).toBeVisible();
	await page.getByRole('button', { name: 'Restore work' }).click();
	await expect(page.getByText(project.name).first()).toBeVisible();
	await expect(page.locator('.map-transform')).toBeVisible();
	await page.waitForTimeout(220);
};

const mapTransform = (page: Page): Promise<string | null> =>
	page.locator('.map-transform').getAttribute('style');

const cameraView = (page: Page): Promise<{
	centerX: number;
	centerY: number;
	scale: number;
}> => page.locator('.canvas-viewport').evaluate((viewport) => {
	const map = viewport.querySelector<HTMLElement>('.map-transform');

	if (!map) throw new Error('Expected the 2D map transform.');
	const transform = new DOMMatrix(getComputedStyle(map).transform);

	return {
		centerX: (viewport.clientWidth / 2 - transform.e) / transform.a,
		centerY: (viewport.clientHeight / 2 - transform.f) / transform.d,
		scale: transform.a
	};
});

const openProjectSettings = async (page: Page): Promise<void> => {
	await page.locator('.document-context').click();
	await expect(page.getByLabel('Project name')).toBeVisible();
};

const openPreviewSimulation = async (page: Page): Promise<void> => {
	const drawer = page.locator('#preview-simulation-drawer');

	if (!await drawer.isVisible()) await page.getByRole('button', { name: 'Simulation' }).click();
	await expect(drawer).toBeVisible();
};

const panelLayoutProblems = (page: Page): Promise<string[]> => page.evaluate(() => {
	const visible = (element: Element): boolean => {
		const style = getComputedStyle(element);
		const bounds = element.getBoundingClientRect();

		return element.checkVisibility({
			checkOpacity: true,
			checkVisibilityCSS: true
		})
			&& !element.closest('details:not([open])')
			&& style.display !== 'none'
			&& style.visibility !== 'hidden'
			&& Number(style.opacity) > 0
			&& bounds.width > 1
			&& bounds.height > 1
			&& bounds.right > 0
			&& bounds.bottom > 0
			&& bounds.left < innerWidth
			&& bounds.top < innerHeight;
	};
	const label = (element: Element): string => {
		const html = element as HTMLElement;
		const name = html.getAttribute('aria-label')
			?? html.getAttribute('title')
			?? html.textContent?.trim().replace(/\s+/gu, ' ').slice(0, 44)
			?? '';

		return `${element.tagName.toLocaleLowerCase()}.${html.className || '-'}:${name}`;
	};
	const intersectionArea = (left: DOMRect, right: DOMRect): number =>
		Math.max(0, Math.min(left.right, right.right) - Math.max(left.left, right.left))
		* Math.max(0, Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top));
	const clippedBounds = (element: Element, root: Element): DOMRect => {
		const bounds = element.getBoundingClientRect();
		let left = bounds.left;
		let top = bounds.top;
		let right = bounds.right;
		let bottom = bounds.bottom;
		let ancestor = element.parentElement;

		while (ancestor) {
			if (ancestor === root || /(auto|clip|hidden|scroll)/u.test(
				`${getComputedStyle(ancestor).overflow} ${getComputedStyle(ancestor).overflowX} ${getComputedStyle(ancestor).overflowY}`
			)) {
				const clip = ancestor.getBoundingClientRect();
				left = Math.max(left, clip.left);
				top = Math.max(top, clip.top);
				right = Math.min(right, clip.right);
				bottom = Math.min(bottom, clip.bottom);
			}

			if (ancestor === root) break;
			ancestor = ancestor.parentElement;
		}

		return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
	};
	const problems: string[] = [];
	const roots = [...document.querySelectorAll('.panel-shell, .visitor-panel, .visitor-detail-card')].filter(visible);

	for (const root of roots) {
		const rootBounds = root.getBoundingClientRect();
		const controls = [...root.querySelectorAll('button, input, select, textarea, summary')]
			.filter(visible)
			.filter((element) => {
				const bounds = element.getBoundingClientRect();

				return bounds.bottom > rootBounds.top && bounds.top < rootBounds.bottom;
			});

		for (const control of controls) {
			const bounds = control.getBoundingClientRect();

			if (bounds.left < rootBounds.left - 1 || bounds.right > rootBounds.right + 1) {
				problems.push(`escapes ${label(root)} -> ${label(control)}`);
			}
		}

		for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
			for (let rightIndex = leftIndex + 1; rightIndex < controls.length; rightIndex += 1) {
				const left = controls[leftIndex];
				const right = controls[rightIndex];

				if (left.contains(right) || right.contains(left)) continue;

				if (intersectionArea(clippedBounds(left, root), clippedBounds(right, root)) <= 1) continue;
				problems.push(`overlap ${label(left)} <> ${label(right)}`);
			}
		}
	}

	for (const toast of [...document.querySelectorAll('.toast')].filter(visible)) {
		for (const root of roots) {
			if (intersectionArea(toast.getBoundingClientRect(), root.getBoundingClientRect()) > 1) {
				problems.push(`toast covers ${label(root)}`);
			}
		}
	}

	return problems;
});

const editorSurfaceProblems = async (page: Page): Promise<string[]> => [
	...await panelLayoutProblems(page),
	...await page.evaluate(() => {
		const visible = (element: Element): boolean => {
			const bounds = element.getBoundingClientRect();
			const style = getComputedStyle(element);

			return element.checkVisibility({
				checkOpacity: true,
				checkVisibilityCSS: true
			})
				&& style.display !== 'none'
				&& style.visibility !== 'hidden'
				&& Number(style.opacity) > 0
				&& bounds.width > 1
				&& bounds.height > 1
				&& bounds.right > 0
				&& bounds.bottom > 0
				&& bounds.left < innerWidth
				&& bounds.top < innerHeight;
		};
		const label = (element: Element): string => {
			const html = element as HTMLElement;
			const name = html.getAttribute('aria-label')
				?? html.getAttribute('title')
				?? html.textContent?.trim().replace(/\s+/gu, ' ').slice(0, 44)
				?? '';

			return `${element.tagName.toLocaleLowerCase()}.${html.className || '-'}:${name}`;
		};
		const accessibleName = (element: Element): string => {
			const html = element as HTMLElement;
			const labelledBy = html.getAttribute('aria-labelledby');
			const explicit = html.getAttribute('aria-label')?.trim()
				|| html.getAttribute('title')?.trim()
				|| (labelledBy
					? labelledBy.split(/\s+/gu)
						.map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
						.join(' ')
						.trim()
					: '');

			return explicit || html.textContent?.trim() || '';
		};
		const parseColor = (value: string): [number, number, number, number] | undefined => {
			const channels = value.match(/[\d.]+/gu)?.map(Number);

			if (!channels || channels.length < 3) return undefined;

			return [channels[0], channels[1], channels[2], channels[3] ?? 1];
		};
		const effectiveBackground = (element: Element): [number, number, number, number] | undefined => {
			let current: Element | null = element;

			while (current) {
				const color = parseColor(getComputedStyle(current).backgroundColor);

				if (color && color[3] > 0.96) return color;
				current = current.parentElement;
			}

			return [255, 255, 255, 1];
		};
		const luminance = (color: [number, number, number, number]): number => {
			const channels = color.slice(0, 3).map((value) => {
				const normalized = value / 255;

				return normalized <= 0.03928
					? normalized / 12.92
					: ((normalized + 0.055) / 1.055) ** 2.4;
			});

			return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
		};
		const contrast = (
			foreground: [number, number, number, number],
			background: [number, number, number, number]
		): number => {
			const foregroundLuminance = luminance(foreground);
			const backgroundLuminance = luminance(background);

			return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
				/ (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
		};
		const problems: string[] = [];

		for (const control of [...document.querySelectorAll('button, input, select, textarea, summary')].filter(visible)) {
			const bounds = control.getBoundingClientRect();
			const html = control as HTMLInputElement;
			const scrollContainer = Boolean(control.closest('.panel-scroll, .visitor-results, .visitor-panel'));

			if (
				!scrollContainer
				&& (
					bounds.left < -1
					|| bounds.top < -1
					|| bounds.right > innerWidth + 1
					|| bounds.bottom > innerHeight + 1
				)
			) problems.push(`viewport clipping ${label(control)}`);

			if (control.matches('button, summary') && !accessibleName(control)) {
				problems.push(`unnamed action ${label(control)}`);
			}

			if (
				control.matches('input:not([type="hidden"]), select, textarea')
				&& !html.labels?.length
				&& !html.getAttribute('aria-label')
				&& !html.getAttribute('aria-labelledby')
			) problems.push(`unlabelled field ${label(control)}`);

			if (
				control.matches('button, summary')
				&& !html.closest('.app-bar')
				&& (bounds.width < 28 || bounds.height < 28)
			) problems.push(`small target ${label(control)} ${Math.round(bounds.width)}x${Math.round(bounds.height)}`);
		}

		const contrastTargets = [
			...document.querySelectorAll(
				'.panel-shell button, .panel-shell summary, .panel-shell label > span,'
				+ '.visitor-panel button, .visitor-panel label > span, .visitor-results__summary,'
				+ '.app-bar button, .status-bar button'
			)
		].filter(visible).filter((element) => Boolean(element.textContent?.trim()));

		for (const element of contrastTargets) {
			if ((element as HTMLButtonElement).disabled) continue;
			const style = getComputedStyle(element);
			const foreground = parseColor(style.color);
			const background = effectiveBackground(element);

			if (!foreground || !background || foreground[3] < 0.96) continue;
			const fontSize = Number.parseFloat(style.fontSize);
			const fontWeight = Number.parseInt(style.fontWeight, 10);
			const threshold = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700) ? 3 : 4.5;
			const ratio = contrast(foreground, background);

			if (ratio + 0.05 < threshold) {
				problems.push(`contrast ${label(element)} ${ratio.toFixed(2)}:${threshold.toFixed(1)}`);
			}
		}

		return problems;
	})
];

test('project context and command palette switch workspaces without moving the map', async ({ page }) => {
	await openEditor(page);
	const before = await mapTransform(page);

	await expect(page.locator('.document-context')).toContainText('Northline Test Center');
	await page.getByRole('button', { name: 'Search commands' }).click();
	await expect(page.getByRole('dialog', { name: 'Commands' })).toBeVisible();
	await page.getByRole('searchbox', { name: 'Search commands' }).fill('route edit');
	await page.getByRole('option', { name: /Open route editor/ }).click();

	await expect(page.getByRole('button', { name: 'Route edit' })).toHaveAttribute('aria-pressed', 'true');
	expect(await mapTransform(page)).toBe(before);
});

test('guides a first-time author from an empty project into floor-plan setup', async ({ page }, testInfo) => {
	await page.goto('/v2/');
	await expect(page.getByText('Add a floor plan', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
	const emptyScreenshotPath = testInfo.outputPath('empty-project.png');
	await page.screenshot({ path: emptyScreenshotPath });
	await testInfo.attach('empty-project', {
		contentType: 'image/png',
		path: emptyScreenshotPath
	});

	const chooserPromise = page.waitForEvent('filechooser');
	await page.getByRole('button', { name: 'Choose image', exact: true }).click();
	const chooser = await chooserPromise;
	await expect(page.getByRole('button', { name: 'Project', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await chooser.setFiles({
		buffer: Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">'
			+ '<rect width="640" height="360" fill="#eef6f3"/>'
			+ '<path d="M80 80h480v200H80z" fill="none" stroke="#0f766e" stroke-width="12"/>'
			+ '</svg>'
		),
		mimeType: 'image/svg+xml',
		name: 'first-floor-plan.svg'
	});

	await expect(page.getByText('Loaded first-floor-plan.svg')).toBeVisible();
	await expect(page.getByText('Add a floor plan', { exact: true })).toHaveCount(0);
	await expect(page.locator('#Background image')).toHaveCount(1);
});

const clickMapPoint = async (
	page: Page,
	point: { x: number; y: number },
	options?: { clickCount?: number }
): Promise<void> => {
	const map = page.locator('.map-transform');
	const bounds = await map.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.click(
		bounds!.x + point.x / 1920 * bounds!.width,
		bounds!.y + point.y / 1080 * bounds!.height,
		{ clickCount: options?.clickCount ?? 1 }
	);
};

const moveMapPointer = async (
	page: Page,
	point: { x: number; y: number }
): Promise<void> => {
	const map = page.locator('.map-transform');
	const bounds = await map.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move(
		bounds!.x + point.x / 1920 * bounds!.width,
		bounds!.y + point.y / 1080 * bounds!.height
	);
};

const dragMapPath = async (
	page: Page,
	points: Array<{ x: number; y: number }>
): Promise<void> => {
	const map = page.locator('.map-transform');
	const bounds = await map.boundingBox();
	expect(bounds).not.toBeNull();
	expect(points.length).toBeGreaterThan(1);
	const viewportPoint = (point: { x: number; y: number }): { x: number; y: number } => ({
		x: bounds!.x + point.x / 1920 * bounds!.width,
		y: bounds!.y + point.y / 1080 * bounds!.height
	});
	const first = viewportPoint(points[0]);
	await page.mouse.move(first.x, first.y);
	await page.mouse.down();

	for (const point of points.slice(1)) {
		const next = viewportPoint(point);
		await page.mouse.move(next.x, next.y, { steps: 3 });
	}
	await page.mouse.up();
};

const dragLocatorBy = async (
	page: Page,
	locator: ReturnType<Page['locator']>,
	delta: { x: number; y: number }
): Promise<void> => {
	const bounds = await locator.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
	await page.mouse.down();
	await page.mouse.move(
		bounds!.x + bounds!.width / 2 + delta.x,
		bounds!.y + bounds!.height / 2 + delta.y,
		{ steps: 5 }
	);
	await page.mouse.up();
};

test('opens into a map-first object workspace with direct selection actions', async ({ page }) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');

	await expect(projectPanel.getByRole('button', { name: 'Objects', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(projectPanel.getByPlaceholder('Search objects')).toBeVisible();
	await expect(projectPanel.locator('.object-browser')).not.toContainText(/confirmed/iu);
	await projectPanel.getByRole('button', { name: 'Visitor information', exact: true }).click();
	await expect(page.getByLabel('Selection actions')).toBeVisible();
	await expect(page.getByLabel('Selection actions')).toContainText('Visitor information');

	const locationsBefore = await page.locator('#Locations polygon').count();
	await page.getByLabel('Selection actions').getByRole('button', { name: /Duplicate/ }).click();
	await expect(page.locator('#Locations polygon')).toHaveCount(locationsBefore + 1);
	await page.getByLabel('Selection actions').getByRole('button', { name: 'Deselect' }).click();
	await expect(page.getByLabel('Selection actions')).toHaveCount(0);
});

test('synchronizes layer visibility, selection, keyboard deletion, and undo', async ({ page }) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');
	await projectPanel.locator('details.panel-section')
		.filter({ hasText: 'Layer visibility' })
		.locator('summary')
		.click();
	await projectPanel.getByRole('button', { name: 'Hide all' }).click();
	await expect(page.locator('[data-editor-element-id="location-information"]')).toHaveCount(0);
	await expect(page.locator('[data-editor-element-id="origin-main"]')).toHaveCount(0);
	await expect(projectPanel.locator('.layer-list input:checked')).toHaveCount(0);

	await projectPanel.getByRole('button', { name: 'Show all' }).click();
	await expect(page.locator('[data-editor-element-id="location-information"]')).toBeVisible();
	await expect(page.locator('[data-editor-element-id="origin-main"]')).toBeVisible();
	await projectPanel.getByRole('button', { name: 'Show only You are here' }).click();
	await expect(page.locator('[data-editor-element-id="origin-main"]')).toBeVisible();
	await expect(page.locator('[data-editor-element-id="location-information"]')).toHaveCount(0);

	await projectPanel.getByRole('button', { name: 'Show all' }).click();
	await page.locator('[data-editor-element-id="location-information"]').click();
	await page.keyboard.press('Delete');
	await expect(page.locator('[data-editor-element-id="location-information"]')).toHaveCount(0);
	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(page.locator('[data-editor-element-id="location-information"]')).toBeVisible();
});

test('switches every project workspace to its owned workflow', async ({ page }) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');
	const expectations = [
		{ tab: 'Project', content: 'File and identity' },
		{ tab: 'Directory', content: 'Languages and categories' },
		{ tab: 'Assets', content: 'Reusable assets' },
		{ tab: 'Style', content: 'Map and visitor styling' },
		{ tab: 'Objects', content: 'Select and manage' }
	] as const;

	for (const expectation of expectations) {
		const tab = projectPanel.getByRole('button', { name: expectation.tab, exact: true });
		await tab.click();
		await expect(tab).toHaveAttribute('aria-pressed', 'true');
		await expect(projectPanel.getByText(expectation.content, { exact: true })).toBeVisible();
	}
});

test('edits project directory registries and localized destination content end to end', async ({ page }) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');

	await projectPanel.getByRole('button', { name: 'Directory', exact: true }).click();
	await expect(projectPanel.getByText('Languages and categories')).toBeVisible();
	await projectPanel.getByLabel('Code').fill('de');
	await projectPanel.getByLabel('Language').fill('Deutsch');
	await projectPanel.getByRole('button', { name: 'Add language', exact: true }).click();
	await expect(projectPanel.getByText('Deutsch', { exact: true })).toBeVisible();
	await projectPanel.getByLabel('New category').fill('Guest services');
	await projectPanel.getByRole('button', { name: 'Add category', exact: true }).click();
	await expect(projectPanel.getByRole('button', { name: 'Rename Guest services' })).toBeVisible();

	await projectPanel.getByRole('button', { name: 'Objects', exact: true }).click();
	await projectPanel.getByRole('button', { name: 'Visitor information', exact: true }).click();
	await expect(page.getByText('Destination details', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Deutsch', exact: true }).click();
	await page.getByLabel('Name in Deutsch').fill('Gasteinformation');
	await page.getByLabel('Name in Deutsch').press('Enter');
	await page.getByLabel('Description in Deutsch').fill('Information und Hilfe fur Gaste.');
	await page.getByLabel('Description in Deutsch').blur();
	await page.getByLabel('Category').selectOption('Guest services');

	await page.getByRole('button', { name: 'Preview' }).click();
	await openPreviewSimulation(page);
	await page.getByLabel('Preview language').selectOption('de');
	await page.getByRole('button', { name: 'Open Gasteinformation in the directory' }).click();
	await expect(page.locator('.visitor-detail').getByText('Gasteinformation', { exact: true })).toBeVisible();
	await expect(page.getByText('Information und Hilfe fur Gaste.', { exact: true })).toBeVisible();
});

test('presents destination marker and imagery as clear visual choices', async ({ page }) => {
	const project = createTestProject();
	project.assets.push({
		dataUrl: LOGO_DATA_URL,
		id: 'asset-information-icon',
		kind: 'icon',
		mimeType: 'image/svg+xml',
		name: 'Information desk icon',
		naturalHeight: 80,
		naturalWidth: 80
	});
	await openEditor(page, project);
	await page.locator('[data-editor-element-id="location-information"]').click({ force: true });

	const markerHeading = page.getByText('Map marker', { exact: true });
	const imageryHeading = page.getByText('Destination imagery', { exact: true });
	const visitorHeading = page.getByText('Visitor content', { exact: true });
	await expect(markerHeading).toBeVisible();
	await expect(imageryHeading).toBeVisible();
	await expect(visitorHeading).toBeVisible();

	const markerBounds = await markerHeading.boundingBox();
	const imageryBounds = await imageryHeading.boundingBox();
	const visitorBounds = await visitorHeading.boundingBox();
	expect(markerBounds!.y).toBeLessThan(imageryBounds!.y);
	expect(imageryBounds!.y).toBeLessThan(visitorBounds!.y);

	const symbolChoice = page.getByRole('button', {
		name: 'Use Information desk icon as the location symbol'
	});
	await symbolChoice.click();
	await expect(symbolChoice).toHaveAttribute('aria-pressed', 'true');

	const noLogo = page.getByRole('radio', { name: 'No logo' });
	await noLogo.click();
	await expect(noLogo).toHaveAttribute('aria-checked', 'true');

	const selectedPhoto = page.getByRole('button', {
		name: 'Remove Visitor information interior from visitor photos'
	});
	await selectedPhoto.click();
	await expect(page.getByText('Visitor photos · 0 selected', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', {
		name: 'Add Visitor information interior to visitor photos'
	})).toHaveAttribute('aria-pressed', 'false');
});

test('applies project appearance defaults to newly authored rooms', async ({ page }) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');

	await projectPanel.getByRole('button', { name: 'Style', exact: true }).click();
	await projectPanel.getByLabel('New room colors').selectOption('fixed');
	await projectPanel.locator('.project-defaults input[type="color"]').first().fill('#2563eb');
	await projectPanel.getByLabel('Room opacity').fill('64');
	await projectPanel.getByLabel('Room opacity').blur();
	await projectPanel.getByLabel('Room 3D height').fill('32');
	await projectPanel.getByLabel('Room 3D height').blur();

	await page.getByRole('button', { name: /Draw room or area/ }).click();
	await clickMapPoint(page, { x: 500, y: 300 });
	await clickMapPoint(page, { x: 760, y: 300 });
	await clickMapPoint(page, { x: 760, y: 520 });
	await clickMapPoint(page, { x: 500, y: 520 });
	await page.keyboard.press('Enter');

	await expect(page.getByText('Destination details', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Fill color')).toHaveValue('#2563eb');
	await expect(page.getByLabel('3D height', { exact: true })).toHaveValue('32');
});

test('persists configured origin and route appearance across 2D and 3D previews', async ({ page }) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');

	await projectPanel.getByRole('button', { name: 'Style', exact: true }).click();
	const markerColor = projectPanel.getByLabel('Marker color');
	await markerColor.fill('#8f3db4');
	await markerColor.dispatchEvent('change');
	await projectPanel.getByLabel('Animation speed').first().fill('92');
	await projectPanel.getByLabel('Animation speed').first().blur();
	await projectPanel.getByLabel('2D animation').selectOption('pulse');
	await projectPanel.getByLabel('3D animation').selectOption('pulse');
	const routeColor = projectPanel.getByLabel('Route color');
	await routeColor.fill('#e11d48');
	await routeColor.dispatchEvent('change');
	await projectPanel.getByLabel('Route width').fill('11');
	await projectPanel.getByLabel('Route width').blur();
	await projectPanel.getByLabel('Corner rounding').fill('24');
	await projectPanel.getByLabel('Corner rounding').blur();
	await projectPanel.getByRole('combobox', { name: 'Animation', exact: true }).selectOption('pulse');
	await projectPanel.getByRole('slider', { name: 'Animation speed' }).fill('88');

	await page.getByRole('button', { name: 'Preview' }).click();
	const origin = page.locator('.visitor-origin-marker');
	await expect(origin).toHaveAttribute('data-origin-animation-2d', 'pulse');
	await expect(origin).toHaveAttribute('data-animation-speed', '92');
	await expect(origin).toHaveAttribute('style', /#8f3db4/u);
	await page.getByRole('button', { name: 'Open Visitor information in the directory' }).click();
	const route = page.locator('.route-overlay .simulated-route');
	await expect(route).toHaveClass(/pulsing/u);
	await expect(route).toHaveAttribute('style', /stroke: (?:#e11d48|rgb\(225, 29, 72\))/u);
	await expect(route).toHaveAttribute('style', /stroke-width: 11px/u);

	await page.getByRole('button', { name: '3D' }).click();
	const host = page.locator('.scene3d-host');
	await expect(host).toHaveAttribute('data-ready', 'true');
	await expect(host).toHaveAttribute('data-origin-animation-3d', 'pulse');
	await expect(host).toHaveAttribute('data-origin-animation-speed', '92');
	await expect(host).toHaveAttribute('data-origin-color', '#8f3db4');
	await expect(host).toHaveAttribute('data-route-animation', 'pulse');
	await expect(host).toHaveAttribute('data-route-width', '11');
});

test('uploads, reuses, assigns, and previews project assets end to end', async ({ page }) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');

	await projectPanel.getByRole('button', { name: 'Assets', exact: true }).click();
	await expect(projectPanel.locator('.wb-studio-upload')).toHaveCount(1);
	await expect(projectPanel.getByRole('radiogroup', { name: 'Image purpose' }).getByRole('radio')).toHaveCount(3);
	await projectPanel.getByRole('radio', { name: /Gallery photo/u }).click();
	await projectPanel.getByLabel('Upload photo').setInputFiles({
		buffer: Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">'
			+ '<rect width="320" height="180" fill="#dbeafe"/>'
			+ '<path d="M40 140 120 55l55 60 35-35 70 60z" fill="#2563eb"/>'
			+ '</svg>'
		),
		mimeType: 'image/svg+xml',
		name: 'northline-atrium.svg'
	});
	await expect(projectPanel.getByText('northline-atrium.svg', { exact: true })).toBeVisible();

	const iconsBefore = await page.locator('#Icons image').count();
	await projectPanel.getByRole('button', { name: 'Wi-Fi', exact: true }).click();
	await clickMapPoint(page, { x: 1040, y: 500 });
	await expect(page.locator('#Icons image')).toHaveCount(iconsBefore + 1);
	const placedIcon = page.locator('#Icons image').last();
	const placedIconCenter = {
		x: Number(await placedIcon.getAttribute('x')) + Number(await placedIcon.getAttribute('width')) / 2,
		y: Number(await placedIcon.getAttribute('y')) + Number(await placedIcon.getAttribute('height')) / 2
	};
	expect(placedIconCenter.x).toBeCloseTo(1040, 1);
	expect(placedIconCenter.y).toBeCloseTo(500, 1);

	await projectPanel.getByRole('button', { name: 'Objects', exact: true }).click();
	await projectPanel.getByRole('button', { name: 'Visitor information', exact: true }).click();
	await page.getByRole('button', {
		name: 'Add northline-atrium.svg to visitor photos'
	}).click();

	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: 'Open Visitor information in the directory' }).click();
	await expect(page.locator('.visitor-detail__hero')).toBeVisible();
	await expect(page.locator('.visitor-detail__gallery img')).toHaveCount(1);
});

test('provides a searchable route graph navigator and direct diagnostics', async ({ page }, testInfo) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Route edit' }).click();
	const routePanel = page.locator('.left-panel');
	await routePanel.getByRole('button', { name: 'Edit', exact: true }).click();

	await expect(routePanel.getByText('Route network health')).toBeVisible();
	await routePanel.locator('.route-advanced-list > summary').click();
	await expect(routePanel.getByPlaceholder('Find a junction or segment')).toBeVisible();
	await routePanel.getByPlaceholder('Find a junction or segment').fill('route-main');
	await routePanel.locator('.route-object-main').filter({ hasText: 'route-main' }).click();
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-kind', 'graph-edge');
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'route-main');
	await expect(page.getByLabel('Selection actions')).toBeVisible();
	const screenshotPath = testInfo.outputPath('route-network-editor.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('route-network-editor', {
		contentType: 'image/png',
		path: screenshotPath
	});
});

test('keeps the map camera stable across panel, workspace, and undo interactions', async ({ page }) => {
	await openEditor(page);
	const viewport = page.locator('.canvas-viewport');
	const bounds = await viewport.boundingBox();
	expect(bounds).not.toBeNull();
	await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
	await page.mouse.wheel(0, -450);
	const zoomed = await mapTransform(page);
	const zoomedView = await cameraView(page);

	await page.getByRole('button', { name: 'Close project panel' }).click();
	await expect(page.locator('.left-panel')).toHaveCSS('transform', /matrix/);
	await page.waitForTimeout(220);
	const expandedView = await cameraView(page);
	expect(expandedView.scale).toBeCloseTo(zoomedView.scale, 5);
	expect(expandedView.centerX).toBeCloseTo(zoomedView.centerX, 2);
	expect(expandedView.centerY).toBeCloseTo(zoomedView.centerY, 2);
	const expandedTransform = await mapTransform(page);
	expect(expandedTransform).not.toBe(zoomed);

	await page.getByRole('button', { name: 'Route edit' }).click();
	expect(await mapTransform(page)).toBe(expandedTransform);
	await page.getByRole('button', { name: 'Map', exact: true }).click();
	expect(await mapTransform(page)).toBe(expandedTransform);

	await openProjectSettings(page);
	await page.waitForTimeout(220);
	const settingsView = await cameraView(page);
	expect(settingsView.scale).toBeCloseTo(expandedView.scale, 5);
	expect(settingsView.centerX).toBeCloseTo(expandedView.centerX, 2);
	expect(settingsView.centerY).toBeCloseTo(expandedView.centerY, 2);
	const settingsTransform = await mapTransform(page);
	await page.getByLabel('Project name').fill('Northline Edited');
	await page.getByLabel('Project name').blur();
	expect(await mapTransform(page)).toBe(settingsTransform);
	await page.getByRole('button', { name: /Undo/ }).click();
	expect(await mapTransform(page)).toBe(settingsTransform);
});

test('visitor preview provides a clean localized directory and route experience', async ({ page }, testInfo) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Preview' }).click();
	await expect(page.getByLabel('Visitor map directory')).toBeVisible();
	await expect(page.locator('.route-network-line')).toHaveCount(0);
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(0);

	await openPreviewSimulation(page);
	await page.getByLabel('Preview language').selectOption('hu');
	await expect(page.getByRole('button', { name: 'Open Informacio in the directory' })).toBeVisible();
	await page.getByRole('button', { name: 'Open Informacio in the directory' }).click();
	await expect(page.locator('.visitor-detail')).toContainText('Informacio es segitseg latogatoknak.');
	await expect(page.locator('.visitor-detail')).toContainText('09:00-18:00');
	await expect(page.locator('.visitor-detail')).toContainText('+1 555 0100');
	await expect(page.locator('.visitor-detail')).toContainText('Step-free');
	await expect(page.locator('.visitor-detail')).toContainText('A-12');
	await expect(page.locator('.visitor-detail__hero')).toBeVisible();
	await expect(page.locator('.visitor-detail__identity img')).toBeVisible();
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(1);
	await expect(page.locator('.simulated-route-casing')).toHaveCSS('fill', 'none');
	const detailBounds = await page.locator('.visitor-detail').boundingBox();
	expect(detailBounds).not.toBeNull();
	expect(detailBounds!.height).toBeGreaterThanOrEqual(220);
	await expect(page.locator('.visitor-results')).toBeVisible();
	const mapBounds = await page.locator('.canvas-viewport').boundingBox();
	const directoryBounds = await page.locator('.visitor-panel').boundingBox();
	const detailCardBounds = await page.locator('.visitor-detail-card').boundingBox();
	expect(mapBounds).not.toBeNull();
	expect(directoryBounds).not.toBeNull();
	expect(detailCardBounds).not.toBeNull();
	expect(mapBounds!.width).toBeGreaterThan((page.viewportSize()?.width ?? 0) * 0.65);
	expect(directoryBounds!.width).toBeLessThanOrEqual(420);
	expect(detailCardBounds!.x + detailCardBounds!.width).toBeLessThan(directoryBounds!.x);
	const screenshotPath = testInfo.outputPath('visitor-route-2d.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('visitor-route-2d', {
		contentType: 'image/png',
		path: screenshotPath
	});

	await page.getByPlaceholder('Search destinations').fill('not present');
	await expect(page.getByText('No matches')).toBeVisible();
});

test('assigns a destination symbol and opens the same destination directly from the map', async ({ page }) => {
	const project = createTestProject();
	project.assets.push({
		dataUrl: LOGO_DATA_URL,
		id: 'asset-information-symbol',
		kind: 'icon',
		mimeType: 'image/svg+xml',
		name: 'Information symbol',
		naturalHeight: 80,
		naturalWidth: 80
	});
	await openEditor(page, project);
	await page.locator('[data-editor-element-id="location-information"]').click({ force: true });
	await page.getByRole('button', { name: 'Use Information symbol as the location symbol' }).click();
	await page.getByRole('button', { name: 'Preview' }).click();

	const mapDestination = page.getByLabel('Open Visitor information on the map');
	await expect(mapDestination).toBeVisible();
	await expect(mapDestination.locator('.visitor-marker-logo')).toHaveAttribute('href', LOGO_DATA_URL);
	await mapDestination.click({ force: true });
	await expect(page.locator('.visitor-detail-card')).toContainText('Visitor information');
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(1);
	await page.getByRole('button', { name: '3D', exact: true }).click();
	await expect(page.locator('.scene3d-host')).toHaveAttribute('data-camera-facing-media-count', '1');
});

test('reports route metrics only after calibration and clears guidance without editing the project', async ({ page }) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: 'Open Visitor information in the directory' }).click();
	await expect(page.getByText(/Distance unavailable - calibrate the map scale/)).toBeVisible();
	await page.getByRole('button', { name: /Clear directions/ }).click();
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(0);
	await expect(page.locator('.visitor-detail')).toContainText('Visitor information');

	await page.getByRole('button', { name: 'Map', exact: true }).click();
	await openProjectSettings(page);
	const scale = page.getByLabel('Map scale');
	await scale.fill('20');
	await scale.blur();
	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: 'Open Visitor information in the directory' }).click();
	await expect(page.getByText('52 m', { exact: true })).toBeVisible();
	await expect(page.getByText('1 min', { exact: true })).toBeVisible();
	await page.getByRole('button', { name: /Clear directions/ }).click();

	await page.getByRole('button', { name: 'Map', exact: true }).click();
	await openProjectSettings(page);
	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(page.getByLabel('Map scale')).toHaveValue('');
});

test('visitor 3D preserves localized discovery, floor transitions, and route guidance', async ({ page }, testInfo) => {
	await openEditor(page, createMultiFloorTestProject());
	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: '3D' }).click();
	const host = page.locator('.scene3d-host');

	await expect(host).toHaveAttribute('data-ready', 'true');
	await expect(host).toHaveAttribute('data-poi-count', '1');
	await expect(host).toHaveAttribute('data-transition-count', '1');
	await expect(host).toHaveAttribute('data-destination-label-count', '1');

	await openPreviewSimulation(page);
	await page.getByLabel('Preview language').selectOption('hu');
	await expect(host).toHaveAttribute('data-destination-label-texts', /A-12 {2}Informacio/u);

	await page.getByRole('button', { name: /Sky gallery/ }).click();
	await expect.poll(async () =>
		Number(await host.getAttribute('data-route-points') ?? 0)
	).toBeGreaterThan(1);
	await expect(page.locator('.visitor-journey__floor')).toHaveCount(2);

	await page.locator('.visitor-journey__floor').filter({ hasText: 'First floor' }).click();
	await expect(host).toHaveAttribute('data-transition-count', '1');
	await expect(host).toHaveAttribute('data-destination-label-count', '1');
	await expect.poll(async () =>
		Number(await host.getAttribute('data-route-points') ?? 0)
	).toBeGreaterThan(1);
	const sceneBounds = await host.boundingBox();
	const directoryBounds = await page.locator('.visitor-panel').boundingBox();
	expect(sceneBounds).not.toBeNull();
	expect(directoryBounds).not.toBeNull();
	expect(sceneBounds!.width).toBeGreaterThan((page.viewportSize()?.width ?? 0) * 0.65);
	expect(directoryBounds!.width).toBeLessThanOrEqual(420);
	const screenshotPath = testInfo.outputPath('visitor-route-3d.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('visitor-route-3d', {
		contentType: 'image/png',
		path: screenshotPath
	});
});

test('supports keyboard-safe dialogs and mode semantics', async ({ page }) => {
	await openEditor(page);
	await expect(page.getByRole('button', { name: 'Map', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Shortcuts' }).click();
	await expect(page.getByRole('dialog', { name: 'Keyboard and map controls' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Close shortcuts' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Keyboard and map controls' })).toHaveCount(0);
});

test('keeps the workbench contained at a compact desktop viewport', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 1024, height: 720 });
	await openEditor(page);
	const workbench = page.locator('.workbench');
	const stage = page.locator('.stage');
	const appBar = page.locator('.app-bar');
	await expect(workbench).toHaveCSS('overflow', 'hidden');
	const stageBounds = await stage.boundingBox();
	const appBarBounds = await appBar.boundingBox();
	expect(stageBounds).not.toBeNull();
	expect(appBarBounds).not.toBeNull();
	expect(stageBounds!.width).toBeGreaterThan(450);
	expect(appBarBounds!.x + appBarBounds!.width).toBeLessThanOrEqual(1024);
	await expect(workbench).toHaveClass(/compact-layout/u);
	await expect(workbench).toHaveClass(/right-collapsed/u);
	const screenshotPath = testInfo.outputPath('compact-workbench.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('compact-workbench', {
		contentType: 'image/png',
		path: screenshotPath
	});
});

test('persists both desktop panel widths across reloads', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await openEditor(page);
	const leftPanel = page.locator('.left-panel');
	const rightPanel = page.locator('.right-panel');
	const leftBefore = await leftPanel.boundingBox();
	const rightBefore = await rightPanel.boundingBox();

	expect(leftBefore).not.toBeNull();
	expect(rightBefore).not.toBeNull();
	await page.getByRole('separator', { name: 'Resize left panel' }).focus();
	await page.keyboard.press('ArrowRight');
	await page.keyboard.press('ArrowRight');
	await page.getByRole('separator', { name: 'Resize right panel' }).focus();
	await page.keyboard.press('ArrowLeft');
	await page.keyboard.press('ArrowLeft');
	await expect.poll(async () => page.evaluate((key) => {
		const value = JSON.parse(localStorage.getItem(key) ?? 'null') as { left?: number } | null;

		return value?.left ?? 0;
	}, PANEL_WIDTH_STORAGE_KEY)).toBeGreaterThan(leftBefore!.width);
	const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null') as {
		left: number;
		right: number;
	}, PANEL_WIDTH_STORAGE_KEY);

	expect(stored.left).toBeGreaterThan(leftBefore!.width);
	expect(stored.right).toBeGreaterThan(rightBefore!.width);
	await page.reload();
	await expect(page.locator('.workbench')).toBeVisible();
	const restore = page.getByRole('dialog', { name: 'Restore unsaved local work?' });

	if (await restore.isVisible()) await restore.getByRole('button', { name: 'Restore work' }).click();
	await expect.poll(async () => (await leftPanel.boundingBox())?.width).toBeCloseTo(stored.left, 0);
	await expect.poll(async () => (await rightPanel.boundingBox())?.width).toBeCloseTo(stored.right, 0);
});

test('keeps dense editor and visitor panels collision-free', async ({ page }) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.locator('.left-panel').getByRole('button', { name: 'Edit', exact: true }).click();
	await page.locator('.route-advanced-list > summary').click();
	await page.locator('.route-object-main').filter({ hasText: 'route-main' }).click();
	expect(await panelLayoutProblems(page)).toEqual([]);

	await page.getByRole('button', { name: 'Map', exact: true }).click();
	await openProjectSettings(page);
	expect(await panelLayoutProblems(page)).toEqual([]);

	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: 'Open Visitor information in the directory' }).click();
	expect(await panelLayoutProblems(page)).toEqual([]);

	await page.setViewportSize({ width: 1024, height: 720 });
	await page.waitForTimeout(250);
	expect(await panelLayoutProblems(page)).toEqual([]);
});

test('keeps every core workflow first-class across the desktop viewport matrix', async ({ page }, testInfo) => {
	test.setTimeout(120_000);
	const consoleProblems: string[] = [];
	page.on('console', (message) => {
		if (message.type() === 'error' || message.type() === 'warning') {
			consoleProblems.push(`${message.type()}: ${message.text()}`);
		}
	});
	page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.stack ?? error.message}`));
	await page.setViewportSize({ width: 1024, height: 720 });
	await openEditor(page);
	const viewports = [
		{ width: 1024, height: 720 },
		{ width: 1280, height: 720 },
		{ width: 1440, height: 900 },
		{ width: 1920, height: 1080 }
	] as const;

	for (const viewport of viewports) {
		await page.setViewportSize(viewport);
		await page.waitForTimeout(180);
		await page.getByRole('button', { name: 'Map', exact: true }).click();
		const projectPanel = page.locator('.left-panel');

		for (const tabName of ['Project', 'Directory', 'Assets', 'Style', 'Objects'] as const) {
			await projectPanel.getByRole('button', { name: tabName, exact: true }).click();
			expect(await editorSurfaceProblems(page), `${viewport.width}x${viewport.height} ${tabName}`).toEqual([]);
			expect(consoleProblems, `${viewport.width}x${viewport.height} ${tabName} console`).toEqual([]);
		}

		await page.getByRole('button', { name: 'Route edit' }).click();
		await projectPanel.getByRole('button', { name: 'Edit', exact: true }).click();
		expect(await editorSurfaceProblems(page), `${viewport.width}x${viewport.height} Routing`).toEqual([]);
		expect(consoleProblems, `${viewport.width}x${viewport.height} Routing console`).toEqual([]);

		await page.getByRole('button', { name: 'Preview' }).click();
		await openPreviewSimulation(page);
		await page.getByLabel('Preview language').selectOption('hu');
		await page.getByRole('button', { name: 'Open Informacio in the directory' }).click();
		expect(await editorSurfaceProblems(page), `${viewport.width}x${viewport.height} Preview`).toEqual([]);
		expect(consoleProblems, `${viewport.width}x${viewport.height} Preview console`).toEqual([]);

		const screenshotPath = testInfo.outputPath(`quality-${viewport.width}x${viewport.height}.png`);
		await page.screenshot({ path: screenshotPath });
		await testInfo.attach(`quality-${viewport.width}x${viewport.height}`, {
			contentType: 'image/png',
			path: screenshotPath
		});
	}

	expect(consoleProblems).toEqual([]);
});

test('keeps long localized project and destination content collision-free', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 1024, height: 720 });
	await openEditor(page, createLongContentTestProject());
	const projectPanel = page.locator('.left-panel');
	await projectPanel.getByRole('button', { name: 'Directory', exact: true }).click();
	expect(await editorSurfaceProblems(page)).toEqual([]);
	await projectPanel.getByRole('button', { name: 'Objects', exact: true }).click();
	await projectPanel.getByRole('button', { name: 'Visitor information', exact: true }).click();
	await expect(page.getByLabel('Name', { exact: true })).toHaveValue(
		'International visitor information, accessibility, and admissions assistance'
	);
	expect(await editorSurfaceProblems(page)).toEqual([]);
	await page.getByRole('button', { name: 'Preview' }).click();
	await openPreviewSimulation(page);
	await page.getByLabel('Preview language').selectOption('hu');
	await page.getByRole('button', { name: /Open Nemzetkozi latogatoi informacio.*in the directory/u }).click();
	expect(await editorSurfaceProblems(page)).toEqual([]);
	const screenshotPath = testInfo.outputPath('long-localized-preview.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('long-localized-preview', {
		contentType: 'image/png',
		path: screenshotPath
	});
});

test('shows inline loading-safe validation for unsupported uploads', async ({ page }, testInfo) => {
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');
	await projectPanel.getByRole('button', { name: 'Assets', exact: true }).click();
	await projectPanel.getByRole('radio', { name: /Gallery photo/u }).click();
	const input = projectPanel.getByLabel('Upload photo');
	await input.setInputFiles({
		buffer: Buffer.from('not an image'),
		mimeType: 'text/plain',
		name: 'notes.txt'
	});

	await expect(projectPanel.getByRole('alert')).toContainText('Choose a PNG, JPEG, WebP, SVG');
	await expect(projectPanel.locator('.wb-studio-upload--error')).toBeVisible();
	await expect(projectPanel.locator('.wb-studio-button').filter({ hasText: /^Upload photo$/u })).toBeEnabled();
	const screenshotPath = testInfo.outputPath('upload-validation.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('upload-validation', {
		contentType: 'image/png',
		path: screenshotPath
	});
});

test('keeps upload controls coherent while an image is loading', async ({ page }, testInfo) => {
	await page.addInitScript(() => {
		HTMLImageElement.prototype.decode = async function decode(): Promise<void> {
			await new Promise((resolve) => setTimeout(resolve, 450));
		};
	});
	await openEditor(page);
	const projectPanel = page.locator('.left-panel');
	await projectPanel.getByRole('button', { name: 'Assets', exact: true }).click();
	await projectPanel.getByRole('radio', { name: /Gallery photo/u }).click();
	const upload = projectPanel.locator('.wb-studio-upload');
	await projectPanel.getByLabel('Upload photo').setInputFiles({
		buffer: Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">'
			+ '<rect width="320" height="180" fill="#dbeafe"/>'
			+ '</svg>'
		),
		mimeType: 'image/svg+xml',
		name: 'visitor-lounge.svg'
	});
	await expect(upload).toHaveAttribute('aria-busy', 'true');
	await expect(upload.getByRole('button', { name: 'Reading...' })).toBeDisabled();
	const screenshotPath = testInfo.outputPath('upload-loading.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('upload-loading', {
		contentType: 'image/png',
		path: screenshotPath
	});
	await expect(upload).toHaveAttribute('aria-busy', 'false');
	await expect(projectPanel.getByText('visitor-lounge.svg', { exact: true })).toBeVisible();
});

test('renders a non-empty 3D scene and saves and restores its floor camera', async ({ page }, testInfo) => {
	await openEditor(page);
	await page.getByRole('button', { name: '3D' }).click();
	const canvas = page.getByLabel('Rotatable 3D map preview');
	const host = page.locator('.scene3d-host');
	await expect(canvas).toBeVisible();
	await expect(host).toHaveAttribute('data-ready', 'true');
	const before = await canvas.screenshot();
	expect(new Set(before).size).toBeGreaterThan(20);
	await page.getByRole('button', { name: 'Fit', exact: true }).click();
	await page.waitForTimeout(250);
	const screenshotPath = testInfo.outputPath('authoring-3d.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('authoring-3d', {
		contentType: 'image/png',
		path: screenshotPath
	});
	const initialCamera = await host.getAttribute('data-camera-state');
	await dragLocatorBy(page, canvas, { x: 84, y: 24 });
	await expect(host).not.toHaveAttribute('data-camera-state', initialCamera ?? '');
	await page.getByRole('button', { name: 'Fit', exact: true }).click();
	const initialCameraValues = (initialCamera ?? '').split(',').map(Number);
	await expect.poll(async () => {
		const currentCameraValues = (await host.getAttribute('data-camera-state') ?? '').split(',').map(Number);

		return Math.max(...initialCameraValues.map((value, index) =>
			Math.abs(value - currentCameraValues[index])
		));
	}).toBeLessThan(0.25);
	await dragLocatorBy(page, canvas, { x: 84, y: 24 });
	await page.waitForTimeout(1_200);
	await page.getByRole('button', { name: 'Save view' }).click();
	await expect(page.getByRole('button', { name: /Undo/ })).toBeEnabled();
	await page.getByRole('button', { name: 'Reset view' }).click();
	await page.waitForTimeout(100);
	const savedCamera = await host.getAttribute('data-camera-state');
	await dragLocatorBy(page, canvas, { x: -62, y: 36 });
	await expect(host).not.toHaveAttribute('data-camera-state', savedCamera ?? '');
	await page.waitForTimeout(1_200);
	await page.getByRole('button', { name: 'Reset view' }).click();
	const savedCameraValues = (savedCamera ?? '').split(',').map(Number);
	await expect.poll(async () => {
		const currentCameraValues = (await host.getAttribute('data-camera-state') ?? '').split(',').map(Number);

		return Math.max(...savedCameraValues.map((value, index) =>
			Math.abs(value - currentCameraValues[index])
		));
	}).toBeLessThan(0.25);
	await page.getByRole('button', { name: 'Preview' }).click();
	await expect(canvas).toBeVisible();
	await page.getByRole('button', { name: /Visitor information/ }).click();
	await expect(canvas).toBeVisible();
});

test('keeps the 3D entry point discoverable while explaining an unmet quality gate', async ({ page }) => {
	const project = createWayfindingStudioProject('empty-3d-quality-gate');
	project.name = 'Empty 3D quality gate';
	await openEditor(page, project);

	const threeDimensional = page.getByRole('button', { name: '3D', exact: true });
	await expect(threeDimensional).toBeVisible();
	await expect(threeDimensional).toHaveAttribute('aria-disabled', 'true');
	await expect(threeDimensional).toHaveAttribute('title', /Add at least one room or destination area/u);
});

test('authors, reshapes, inserts, and removes room vertices without moving the camera', async ({ page }) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Close project panel' }).click();
	await page.waitForTimeout(220);
	const viewport = page.locator('.canvas-viewport');
	const viewportBounds = await viewport.boundingBox();
	expect(viewportBounds).not.toBeNull();
	await page.mouse.move(
		viewportBounds!.x + viewportBounds!.width / 2,
		viewportBounds!.y + viewportBounds!.height / 2
	);
	await page.mouse.wheel(0, -300);
	const cameraBefore = await mapTransform(page);

	await page.getByRole('button', { name: /Draw room or area/ }).click();
	await clickMapPoint(page, { x: 420, y: 260 });
	await clickMapPoint(page, { x: 720, y: 260 });
	await clickMapPoint(page, { x: 720, y: 500 });
	await clickMapPoint(page, { x: 420, y: 500 });
	await page.keyboard.press('Enter');

	await expect(page.locator('.polygon-vertex')).toHaveCount(4);
	await expect(page.locator('.selected-polygon')).toHaveCount(1);
	await expect(page.getByRole('button', { name: 'Add vertex' })).toBeVisible();
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.getByRole('button', { name: 'Add vertex' }).click();
	await expect(page.locator('.polygon-vertex')).toHaveCount(5);
	await expect(page.getByRole('button', { name: 'Remove point' })).toBeVisible();
	await page.getByRole('button', { name: 'Remove point' }).click();
	await expect(page.locator('.polygon-vertex')).toHaveCount(4);
	expect(await mapTransform(page)).toBe(cameraBefore);

	await expect(page.locator('.polygon-midpoint')).toHaveCount(4);
	await page.locator('.polygon-midpoint').first().click({ force: true });
	await expect(page.locator('.polygon-vertex')).toHaveCount(5);
	await page.getByRole('button', { name: 'Remove point' }).click();
	await expect(page.locator('.polygon-vertex')).toHaveCount(4);
	expect(await mapTransform(page)).toBe(cameraBefore);

	const firstVertex = page.locator('.polygon-vertex').first();
	const firstVertexX = await firstVertex.getAttribute('cx');
	await dragLocatorBy(page, firstVertex, { x: 34, y: 18 });
	await expect(firstVertex).not.toHaveAttribute('cx', firstVertexX ?? '');
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.locator('.polygon-edge-hit').first().dblclick({ force: true });
	await expect(page.locator('.polygon-vertex')).toHaveCount(5);
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.locator('.polygon-vertex.active').press('Delete');
	await expect(page.locator('.polygon-vertex')).toHaveCount(4);
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(page.locator('.polygon-vertex')).toHaveCount(5);
	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(page.locator('.polygon-vertex')).toHaveCount(4);
	expect(await mapTransform(page)).toBe(cameraBefore);
});

test('nudges and duplicates selected map objects without moving the camera', async ({ page }) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Close project panel' }).click();
	await page.waitForTimeout(220);
	const cameraBefore = await mapTransform(page);
	const origin = page.locator('#origin-main circle');
	const originX = Number(await origin.getAttribute('cx'));
	const originHit = page.locator('[data-editor-element-id="origin-main"]');

	await originHit.click();
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'origin-main');
	await page.keyboard.press('ArrowRight');
	await expect(origin).toHaveAttribute('cx', String(originX + 1));
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.locator('[data-editor-element-id="location-information"]').click({ force: true });
	await page.keyboard.press('Control+d');
	await expect(page.locator('#Locations polygon')).toHaveCount(2);
	await expect(page.locator('#Locations polygon[data-wayfinding-location-id]')).toHaveCount(2);
	expect(await mapTransform(page)).toBe(cameraBefore);
});

test('rotates doors and origins directly on the canvas', async ({ page }, testInfo) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Close project panel' }).click();
	await page.waitForTimeout(220);
	const cameraBefore = await mapTransform(page);

	await page.locator('[data-editor-element-id="door-information"]').click();
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'door-information');
	const connectedRoom = page.getByLabel('Connected room');
	await expect(connectedRoom).toHaveValue('location-information');
	await connectedRoom.selectOption('');
	await expect(page.getByText('This door will not be used for directions until a room is connected.')).toBeVisible();
	await connectedRoom.selectOption('location-information');
	await expect(page.getByText('Ready to terminate routes at this public entrance.')).toBeVisible();
	const doorInspectorScreenshot = testInfo.outputPath('door-inspector.png');
	await page.screenshot({ path: doorInspectorScreenshot });
	await testInfo.attach('door-inspector', {
		contentType: 'image/png',
		path: doorInspectorScreenshot
	});
	const doorHandle = page.locator('[data-transform-handle="direction"]');
	await expect(doorHandle).toBeVisible();
	const doorX2 = await page.locator('#door-information').getAttribute('x2');
	await dragLocatorBy(page, doorHandle, { x: 46, y: -38 });
	await expect(page.locator('#door-information')).not.toHaveAttribute('x2', doorX2 ?? '');
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.locator('[data-editor-element-id="origin-main"]').click();
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'origin-main');
	const originHandle = page.locator('[data-transform-handle="direction"]');
	await expect(originHandle).toBeVisible();
	const facingBefore = await page.locator('#origin-main').getAttribute('data-facing-degrees');
	await dragLocatorBy(page, originHandle, { x: 52, y: 18 });
	await expect(page.locator('#origin-main')).not.toHaveAttribute('data-facing-degrees', facingBefore ?? '');
	expect(await mapTransform(page)).toBe(cameraBefore);
});

test('places an entrance on a room boundary and links it for routing', async ({ page }) => {
	await openEditor(page, createAutomaticRouteTestProject());
	await page.getByRole('button', { name: 'Close project panel' }).click();
	await page.waitForTimeout(220);
	const room = page.locator('[data-editor-element-id="location-storage"]');
	const roomBounds = await room.boundingBox();

	expect(roomBounds).not.toBeNull();
	await room.click({ force: true });
	await page.keyboard.press('d');
	await page.mouse.click(
		roomBounds!.x + 2,
		roomBounds!.y + roomBounds!.height / 2
	);

	await expect(page.locator('#Doors > *')).toHaveCount(2);
	await expect(page.getByLabel('Connected room')).toHaveValue('location-storage');
	await expect(page.getByText('Entrance snapped to Storage room and linked for routing.')).toBeVisible();
	await expect(page.getByText('Ready to terminate routes at this public entrance.')).toBeVisible();
});

test('authors and edits POIs, floor connections, and labels with discoverable keyboard tools', async ({ page }) => {
	const reactiveWarnings: string[] = [];
	page.on('console', (message) => {
		if (
			message.type() === 'warning'
			&& message.text().includes('computations created outside a `createRoot`')
		) reactiveWarnings.push(message.text());
	});
	await openEditor(page);
	await page.getByRole('button', { name: 'Close project panel' }).click();
	await page.waitForTimeout(220);

	await page.keyboard.press('p');
	await clickMapPoint(page, { x: 860, y: 700 });
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-kind', 'element');
	await page.getByLabel('Name', { exact: true }).fill('Coffee kiosk');
	await page.getByLabel('Name', { exact: true }).blur();
	await page.getByLabel('Description', { exact: true }).fill('Fresh coffee beside the main concourse.');
	await page.getByLabel('Description', { exact: true }).blur();
	await expect(page.locator('#POIs > *')).toHaveCount(2);

	await page.keyboard.press('t');
	await clickMapPoint(page, { x: 1060, y: 700 });
	await page.getByLabel('Connection type').selectOption('elevator');
	await page.getByLabel('Map label').fill('Main lift');
	await page.getByLabel('Map label').blur();
	await expect(page.locator('#Transitions > *')).toHaveCount(1);

	await page.keyboard.press('l');
	await clickMapPoint(page, { x: 960, y: 820 });
	await page.getByLabel('Displayed text').fill('North concourse');
	await page.getByLabel('Displayed text').blur();
	await expect(page.locator('#Labels')).toContainText('North concourse');

	const preview = page.getByRole('button', { name: 'Preview' });
	await preview.click();
	await expect(preview).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Open Coffee kiosk in the directory' }).click();
	await expect(page.locator('.visitor-detail')).toContainText('Fresh coffee beside the main concourse.');
	expect(reactiveWarnings).toEqual([]);
});

test('resizes map media proportionally with a direct manipulation handle', async ({ page }) => {
	await openEditor(page);
	const cameraBefore = await mapTransform(page);
	const media = page.locator('#logo-information');
	const initialWidth = Number(await media.getAttribute('width'));
	const initialHeight = Number(await media.getAttribute('height'));
	expect(Number(await media.getAttribute('x')) + initialWidth / 2).toBeCloseTo(980, 1);
	expect(Number(await media.getAttribute('y')) + initialHeight / 2).toBeCloseTo(260, 1);

	await page.locator('[data-editor-element-id="logo-information"]').click({ force: true });
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'logo-information');
	await expect(page.getByLabel('Image scale')).toHaveValue('120');
	await page.getByLabel('Image scale').fill('180');
	await expect(media).toHaveAttribute('width', '180');
	await expect(media).toHaveAttribute('height', '180');
	const resizeHandle = page.locator('[data-transform-handle="media-resize"]');
	await expect(resizeHandle).toBeVisible();
	await dragLocatorBy(page, resizeHandle, { x: 80, y: 34 });

	const resizedWidth = Number(await media.getAttribute('width'));
	const resizedHeight = Number(await media.getAttribute('height'));
	expect(resizedWidth).toBeGreaterThan(initialWidth);
	expect(resizedHeight).toBeGreaterThan(initialHeight);
	expect(resizedWidth / resizedHeight).toBeCloseTo(initialWidth / initialHeight, 2);
	expect(await mapTransform(page)).toBe(cameraBefore);
	await page.getByLabel('Image rotation').fill('35');
	await expect(media).toHaveAttribute('transform', /rotate\(35 980 260\)/u);
	const rotateHandle = page.locator('[data-transform-handle="media-rotate"]');
	await expect(rotateHandle).toBeVisible();
	await dragLocatorBy(page, rotateHandle, { x: 48, y: 22 });
	await expect(media).toHaveAttribute('transform', /rotate\(/u);
});

test('authors a manual route segment in route edit mode', async ({ page }) => {
	await openEditor(page);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await page.getByRole('button', { name: /Draw route segment/ }).click();

	await clickMapPoint(page, { x: 520, y: 760 });
	await moveMapPointer(page, { x: 860, y: 805 });
	await expect(page.locator('.draft-route-line')).toBeVisible();
	expect((await page.locator('.draft-route-line').getAttribute('points'))?.trim().split(/\s+/u)).toHaveLength(2);
	await page.keyboard.down('Shift');
	await moveMapPointer(page, { x: 860, y: 805 });
	const constrainedPoint = (await page.locator('.draft-route-line').getAttribute('points'))
		?.trim()
		.split(/\s+/u)
		.at(-1)
		?.split(',')
		.map(Number);
	expect(constrainedPoint?.[1]).toBeCloseTo(760, 0);
	await clickMapPoint(page, { x: 860, y: 805 });
	await page.keyboard.up('Shift');
	await clickMapPoint(page, { x: 1120, y: 620 });
	await page.keyboard.press('Enter');

	await expect(page.locator('.route-network-line')).toHaveCount(2);
	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(page.locator('.route-network-line')).toHaveCount(1);
});

test('route Build explains every missing prerequisite and opens the required tool', async ({ page }) => {
	const project = createWayfindingStudioProject('route-build-requirements');
	await openEditor(page, project);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.getByRole('button', { name: 'Build', exact: true }).click();

	await expect(page.getByRole('button', { name: 'Build route network' })).toBeDisabled();
	await expect(page.getByRole('button', { name: /Define pedestrian space/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Add a starting point/ })).toBeVisible();
	await expect(page.getByRole('button', { name: /Add a routeable destination/ })).toBeVisible();
	await page.getByRole('button', { name: /Define pedestrian space/ }).click();
	await expect(page.getByRole('button', { name: 'Space', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('button', { name: 'Draw polygon' })).toHaveClass(/active/u);
});

test('builds a route network from authored pedestrian space and linked doors', async ({ page }, testInfo) => {
	const project = createAutomaticRouteTestProject();
	project.graph.nodes = [];
	project.graph.edges = [];
	project.destinations.push({
		floor: project.floors[0].id,
		id: 'destination-directory-only',
		name: 'Directory-only destination',
		routeable: true
	});
	await openEditor(page, project);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.getByRole('button', { name: 'Build', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Build route network' })).toBeEnabled();
	await expect(page.getByText(/1 entrance-ready destination will be connected/u)).toBeVisible();
	await expect(page.getByText(/1 mapped room needs a linked public entrance/u)).toBeVisible();
	await expect(page.getByText(/1 directory-only entry will be skipped/u)).toBeVisible();
	const readinessScreenshot = testInfo.outputPath('route-build-ready.png');
	await page.screenshot({ path: readinessScreenshot });
	await testInfo.attach('route-build-ready', {
		contentType: 'image/png',
		path: readinessScreenshot
	});
	await page.getByRole('button', { name: 'Build route network' }).click();

	await expect(page.locator('.route-network-line')).not.toHaveCount(0);
	const builtNetworkScreenshot = testInfo.outputPath('route-network-built.png');
	await page.screenshot({ path: builtNetworkScreenshot });
	await testInfo.attach('route-network-built', {
		contentType: 'image/png',
		path: builtNetworkScreenshot
	});
	const edgeCount = await page.locator('.route-network-line').count();
	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: 'Open Meeting room in the directory' }).click();
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(1);
	const routePreviewScreenshot = testInfo.outputPath('route-preview-built.png');
	await page.screenshot({ path: routePreviewScreenshot });
	await testInfo.attach('route-preview-built', {
		contentType: 'image/png',
		path: routePreviewScreenshot
	});
	const routePathCommands = (await page.locator('.route-overlay .simulated-route').getAttribute('d'))
		?.match(/[MLQ]/gu) ?? [];
	expect(routePathCommands.length).toBeGreaterThan(2);

	await page.getByRole('button', { name: 'Clear directions' }).click();
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(0);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await expect(page.locator('.route-network-line')).toHaveCount(edgeCount);
});

test('rebuilds the maintained campus map without route artifacts', async ({ page }, testInfo) => {
	const project = JSON.parse(await readFile(
		'examples/spatial-wayfinding/source/campus.wbwayfinding',
		'utf8'
	)) as WayfindingStudioProject;
	project.graph = {
		...project.graph,
		edges: [],
		nodes: []
	};
	await openEditor(page, project);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.getByRole('button', { name: 'Build', exact: true }).click();
	await page.getByRole('button', { name: 'Build route network' }).click();

	await expect(page.locator('.route-build-report')).toContainText('7/7');
	await expect(page.locator('.route-build-report')).toContainText('route anchors connected');
	await expect(page.locator('.route-network-line')).toHaveCount(10);
	const networkScreenshot = testInfo.outputPath('campus-route-network.png');
	await page.screenshot({ path: networkScreenshot });
	await testInfo.attach('campus-route-network', {
		contentType: 'image/png',
		path: networkScreenshot
	});

	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: 'Open Welcome Center in the directory' }).click();
	await expect(page.locator('.route-overlay .simulated-route')).toHaveCount(1);
	await expect(page.locator('.visitor-journey__instructions li')).toHaveCount(3);
	await expect(page.locator('.visitor-journey__instructions')).not.toContainText('In 1 m');
	const previewScreenshot = testInfo.outputPath('campus-route-preview.png');
	await page.screenshot({ path: previewScreenshot });
	await testInfo.attach('campus-route-preview', {
		contentType: 'image/png',
		path: previewScreenshot
	});
});

test('preserves and rebuilds routes from an imported painted pedestrian mask', async ({ page }) => {
	await openEditor(page, createPaintedMaskTestProject());
	await page.getByRole('button', { name: 'Route edit' }).click();
	await expect(page.getByText(/uses a painted pedestrian mask/)).toBeVisible();
	await expect(page.locator('.painted-mask-overlay rect')).not.toHaveCount(0);
	await page.getByRole('button', { name: 'Build', exact: true }).click();
	await page.getByRole('button', { name: /Rebuild route network/ }).click();
	await expect(page.getByRole('dialog')).toHaveCount(0);

	await expect(page.locator('.route-build-report')).toContainText('route anchors connected');
	await expect(page.locator('.route-network-line')).not.toHaveCount(0);
});

test('inserts, drags, and removes route bends without replacing the edge or moving the camera', async ({ page }) => {
	await openEditor(page);
	const cameraBefore = await mapTransform(page);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await clickMapPoint(page, { x: 700, y: 650 });
	await expect(page.locator('.graph-edge-point')).toHaveCount(1);
	await expect(page.locator('.graph-node-handle.endpoint')).toHaveCount(2);
	await expect(page.getByRole('button', { name: 'Add bend' })).toBeVisible();

	await page.getByRole('button', { name: 'Add bend' }).click();
	await expect(page.locator('.graph-edge-point')).toHaveCount(2);
	await page.getByRole('button', { name: 'Remove point' }).click();
	await expect(page.locator('.graph-edge-point')).toHaveCount(1);
	expect(await mapTransform(page)).toBe(cameraBefore);

	await expect(page.locator('.graph-midpoint')).toHaveCount(2);
	await page.locator('.graph-midpoint').first().click({ force: true });
	await expect(page.locator('.graph-edge-point')).toHaveCount(2);
	await page.getByRole('button', { name: 'Remove point' }).click();
	await expect(page.locator('.graph-edge-point')).toHaveCount(1);
	expect(await mapTransform(page)).toBe(cameraBefore);

	await clickMapPoint(page, { x: 700, y: 650 }, { clickCount: 2 });
	await expect(page.locator('.graph-edge-point')).toHaveCount(2);
	const activePoint = page.locator('.graph-edge-point.active');
	const beforeX = await activePoint.getAttribute('cx');
	await dragLocatorBy(page, activePoint, { x: 42, y: -24 });
	await expect(activePoint).not.toHaveAttribute('cx', beforeX ?? '');
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-kind', 'graph-edge');
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'route-main');
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-geometry-index', '1');
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selected-edge-geometry-length', '4');
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.keyboard.press('Delete');
	await expect(page.locator('.graph-edge-point')).toHaveCount(1);
	await expect(page.locator('.graph-edge-hit[data-route-edge-id="route-main"]')).toHaveCount(1);
	expect(await mapTransform(page)).toBe(cameraBefore);
});

test('places, moves, and removes route junctions without moving the camera', async ({ page }) => {
	await openEditor(page);
	const cameraBefore = await mapTransform(page);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	const nodesBefore = await page.locator('.graph-node-handle').count();

	await page.getByRole('button', { name: 'Place junction' }).click();
	await clickMapPoint(page, { x: 820, y: 520 });
	await expect(page.locator('.graph-node-handle')).toHaveCount(nodesBefore + 1);
	const activeNode = page.locator('.graph-node-handle.active');
	await expect(activeNode).toHaveCount(1);
	const beforeX = await activeNode.getAttribute('cx');
	await dragLocatorBy(page, activeNode, { x: 46, y: -20 });
	await expect(activeNode).not.toHaveAttribute('cx', beforeX ?? '');
	expect(await mapTransform(page)).toBe(cameraBefore);

	await page.keyboard.press('Delete');
	await expect(page.locator('.graph-node-handle')).toHaveCount(nodesBefore);
	expect(await mapTransform(page)).toBe(cameraBefore);
});

test('switches between standard and step-free route profiles on the authored graph', async ({ page }) => {
	await openEditor(page, createRouteProfileTestProject());
	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: 'Open Visitor information in the directory' }).click();
	const route = page.locator('.route-overlay .simulated-route');
	await expect(route).toHaveCount(1);
	await expect(route).toHaveAttribute('d', 'M 320 650 L 1300 430');
	const standardPath = await route.getAttribute('d');

	await openPreviewSimulation(page);
	await page.getByRole('button', { name: /Step-free/ }).click();
	await expect(route).not.toHaveAttribute('d', standardPath ?? '');
	await expect(route).toHaveAttribute(
		'd',
		/^M 320 650 .*Q 560 250 .*Q 1040 250 .*L 1300 430$/u
	);
	await expect(page.getByRole('button', { name: /Step-free/ })).toHaveAttribute('aria-pressed', 'true');
});

test('saves back to an opened project file and reserves Save as for a new handle', async ({ page }) => {
	const project = createTestProject();
	await page.addInitScript((serialized): void => {
		const createHandle = (
			name: string,
			storageKey: string
		): {
			createWritable: () => Promise<{
				close: () => Promise<void>;
				write: (data: string) => Promise<void>;
			}>;
			getFile: () => Promise<File>;
			name: string;
		} => ({
			createWritable: () => Promise.resolve({
				close: () => Promise.resolve(),
				write: (data: string) => {
					localStorage.setItem(storageKey, data);

					return Promise.resolve();
				}
			}),
			getFile: () => Promise.resolve(new File([serialized], name, { type: 'application/json' })),
			name
		});
		Object.defineProperty(window, 'showOpenFilePicker', {
			configurable: true,
			value: (): Promise<ReturnType<typeof createHandle>[]> =>
				Promise.resolve([createHandle('opened-map.wbwayfinding', 'opened-map-write')])
		});
		Object.defineProperty(window, 'showSaveFilePicker', {
			configurable: true,
			value: (): Promise<ReturnType<typeof createHandle>> =>
				Promise.resolve(createHandle('copied-map.wbwayfinding', 'copied-map-write'))
		});
	}, JSON.stringify(project));
	await page.goto('/v2/');
	await openProjectSettings(page);
	await page.getByRole('button', { name: 'Open', exact: true }).click();
	await expect(page.getByText('Opened opened-map.wbwayfinding', { exact: true })).toBeVisible();
	await page.getByLabel('Project name').fill('Updated opened project');
	await page.getByLabel('Project name').blur();
	await page.getByRole('button', { name: 'Save (Ctrl+S)' }).click();
	await expect.poll(async () => page.evaluate(() => localStorage.getItem('opened-map-write'))).not.toBeNull();
	await expect(page.getByText(/Saved to opened-map\.wbwayfinding/)).toBeVisible();

	await page.getByRole('button', { name: 'Save as' }).click();
	await expect.poll(async () => page.evaluate(() => localStorage.getItem('copied-map-write'))).not.toBeNull();
	await expect(page.getByText(/Saved to copied-map\.wbwayfinding/)).toBeVisible();
});

test('discards, autosaves, restores, and replaces local recovery without resurrecting stale work', async ({ page }) => {
	const recovery = createTestProject();
	recovery.name = 'Discard this recovery';
	await page.addInitScript(({ key, serialized }) => {
		if (sessionStorage.getItem('wayfinding-recovery-seeded') === 'true') return;
		localStorage.setItem(key, serialized);
		sessionStorage.setItem('wayfinding-recovery-seeded', 'true');
	}, { key: RECOVERY_KEY, serialized: JSON.stringify(recovery) });
	await page.goto('/v2/');
	const recoveryDialog = page.getByRole('dialog', { name: 'Restore unsaved local work?' });
	await expect(recoveryDialog).toBeVisible();
	await recoveryDialog.getByRole('button', { name: 'Discard' }).click();
	await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), RECOVERY_KEY)).toBeNull();

	await openProjectSettings(page);
	await page.getByLabel('Project name').fill('Autosaved concourse');
	await page.getByLabel('Project name').blur();
	await expect.poll(() => page.evaluate((key) => {
		const stored = localStorage.getItem(key);

		return stored ? (JSON.parse(stored) as { name?: string }).name : undefined;
	}, RECOVERY_KEY)).toBe('Autosaved concourse');

	await page.reload();
	await expect(recoveryDialog).toBeVisible();
	await recoveryDialog.getByRole('button', { name: 'Restore work' }).click();
	await expect(page.locator('.document-context')).toContainText('Autosaved concourse');

	await openProjectSettings(page);
	await page.getByLabel('Project name').fill('Recovery that must not return');
	await page.getByLabel('Project name').blur();
	await expect.poll(() => page.evaluate((key) => {
		const stored = localStorage.getItem(key);

		return stored ? (JSON.parse(stored) as { name?: string }).name : undefined;
	}, RECOVERY_KEY)).toBe('Recovery that must not return');
	await page.getByRole('button', { name: 'Search commands' }).click();
	await page.getByRole('searchbox', { name: 'Search commands' }).fill('Create a new project');
	await page.getByRole('option', { name: 'Create a new project' }).click();
	await page.getByRole('dialog', { name: 'Replace unsaved work?' })
		.getByRole('button', { name: 'Create project' })
		.click();
	await expect(page.locator('.document-context')).toContainText('Wayfinding project');
	await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), RECOVERY_KEY)).toBeNull();

	await page.reload();
	await expect(recoveryDialog).toHaveCount(0);
	await expect(page.locator('.document-context')).toContainText('Wayfinding project');
});

test('publishes a portable wbmap package instead of an internal runtime JSON', async ({ page }) => {
	await openEditor(page);
	const downloadPromise = page.waitForEvent('download');

	await page.getByRole('button', { name: 'Publish map' }).click();
	const download = await downloadPromise;
	expect(download.suggestedFilename()).toBe('Northline-Test-Center.wbmap');

	const path = await download.path();
	expect(path).not.toBeNull();
	const entries = unzipSync(new Uint8Array(await readFile(path)));
	expect(Object.keys(entries)).toEqual(expect.arrayContaining([
		'manifest.json',
		'map.json',
		'data/destinations.json',
		'routes/graph.json',
		'floors/level-0.scene.json',
		'floors/level-0.svg'
	]));
	await expect(page.getByText('Published map downloaded.', { exact: true })).toBeVisible();
});

test('explains publish blockers and opens the affected map object', async ({ page }) => {
	await openEditor(page);
	await page.locator('[data-editor-element-id="door-information"]').click();
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'door-information');
	await page.keyboard.press('Delete');
	await expect(page.locator('[data-editor-element-id="door-information"]')).toHaveCount(0);

	await page.getByRole('button', { name: 'Publish map' }).click();
	const dialog = page.getByRole('dialog', { name: 'Map is not ready to publish' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('destination entrance was removed');
	await dialog.getByRole('button', { name: /Open affected item/ }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page.getByText('Destination details', { exact: true })).toBeVisible();
});

test('opens a portable project through the standard file input', async ({ page }) => {
	const project = createTestProject();
	project.name = 'Portable project import';
	await page.goto('/v2/');
	await openProjectSettings(page);
	await page.locator('[data-project-input]').setInputFiles({
		buffer: Buffer.from(JSON.stringify(project)),
		mimeType: 'application/json',
		name: 'portable-project.wbwayfinding'
	});

	await expect(page.getByText('Opened portable-project.wbwayfinding', { exact: true })).toBeVisible();
	await expect(page.getByLabel('Project name')).toHaveValue('Portable project import');
	await expect(page.getByText('Portable project import', { exact: true }).first()).toBeVisible();
});

test('fits a maintained routed project inside the unobscured desktop stage', async ({ page }, testInfo) => {
	await page.goto('/v2/');
	await openProjectSettings(page);
	await page.locator('[data-project-input]').setInputFiles({
		buffer: await readFile('examples/spatial-wayfinding/source/campus.wbwayfinding'),
		mimeType: 'application/json',
		name: 'campus.wbwayfinding'
	});
	await page.getByRole('button', { name: 'Objects', exact: true }).click();
	await expect(page.getByText('Northline Campus Wayfinding', { exact: true }).first()).toBeVisible();
	await page.getByRole('button', { name: 'Fit', exact: true }).click();

	const stage = await page.locator('.stage').boundingBox();
	const leftPanel = await page.locator('.left-panel').boundingBox();
	const rightPanel = await page.locator('.right-panel').boundingBox();
	const map = await page.locator('.map-transform').boundingBox();

	expect(stage).not.toBeNull();
	expect(leftPanel).not.toBeNull();
	expect(rightPanel).not.toBeNull();
	expect(map).not.toBeNull();
	expect(stage!.x).toBeGreaterThanOrEqual(leftPanel!.x + leftPanel!.width - 1);
	expect(stage!.x + stage!.width).toBeLessThanOrEqual(rightPanel!.x + 1);
	expect(map!.x).toBeGreaterThanOrEqual(stage!.x);
	expect(map!.x + map!.width).toBeLessThanOrEqual(stage!.x + stage!.width);
	await expect(page.getByRole('button', { name: 'Entrance — Welcome Center', exact: true })).toBeVisible();
	const screenshotPath = testInfo.outputPath('routed-project-desktop.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('routed-project-desktop', {
		contentType: 'image/png',
		path: screenshotPath
	});
});

test('reports recoverable geometry repairs and accepts the same project file again', async ({ page }, testInfo) => {
	const project = createTestProject();
	const location = project.floors[0].elements.find((element) => element.id === 'location-information');

	if (!location || !('geometry' in location)) throw new Error('Expected location fixture.');
	location.geometry[0] = { x: -120, y: 220 };
	const projectFile = {
		buffer: Buffer.from(JSON.stringify(project)),
		mimeType: 'application/json',
		name: 'recoverable-project.wbwayfinding'
	};
	await page.goto('/v2/');
	await openProjectSettings(page);
	const input = page.locator('[data-project-input]');

	await input.setInputFiles(projectFile);
	const repairDialog = page.getByRole('dialog', { name: 'Project opened with repairs' });
	await expect(repairDialog).toContainText('Clipped');
	await expect(repairDialog.locator('.repair-report-list li')).toHaveCount(1);
	const screenshotPath = testInfo.outputPath('repair-report.png');
	await page.screenshot({ path: screenshotPath });
	await testInfo.attach('repair-report', {
		contentType: 'image/png',
		path: screenshotPath
	});
	await repairDialog.getByRole('button', { name: 'Continue reviewing' }).click();
	await expect(page.locator('[data-editor-element-id="location-information"]')).toBeVisible();

	await input.setInputFiles(projectFile);
	await expect(repairDialog).toBeVisible();
	await expect(repairDialog).toContainText('recoverable-project.wbwayfinding');
	await repairDialog.getByRole('button', { name: 'Continue reviewing' }).click();
});

test('presents a continuous multi-floor visitor journey with an explicit transition', async ({ page }) => {
	await openEditor(page, createMultiFloorTestProject());
	await page.getByRole('button', { name: 'Preview' }).click();
	await page.getByRole('button', { name: /Sky gallery/ }).click();

	await expect(page.locator('.visitor-journey__floor')).toHaveCount(2);
	await expect(page.locator('.visitor-journey')).toContainText('Ground floor');
	await expect(page.locator('.visitor-journey')).toContainText('First floor');
	await expect(page.locator('.visitor-journey__transition')).toContainText('Take the elevator to First floor');
	await page.locator('.visitor-journey__floor').filter({ hasText: 'First floor' }).click();
	await openPreviewSimulation(page);
	await expect(page.locator('.visitor-panel').getByLabel('Visible floor')).toHaveValue('first');
});

test('authors, calibrates, illustrates, reorders, and deletes floors without losing the active floor', async ({ page }) => {
	await openEditor(page, createMultiFloorTestProject());
	await openProjectSettings(page);
	await page.getByRole('combobox', { name: 'Current floor' }).selectOption('first');
	await page.getByLabel('Floor name').fill('Sky level');
	await page.getByLabel('Floor name').blur();
	await page.getByLabel('Map scale').fill('24');
	await page.getByLabel('Map scale').blur();
	await page.locator('#floor-background-input').setInputFiles({
		buffer: Buffer.from(
			'<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">'
			+ '<rect width="640" height="360" fill="#eef6f3"/>'
			+ '<path d="M80 80h480v200H80z" fill="none" stroke="#0f766e" stroke-width="12"/>'
			+ '</svg>'
		),
		mimeType: 'image/svg+xml',
		name: 'sky-level.svg'
	});
	await expect(page.getByText('Loaded sky-level.svg')).toBeVisible();
	await expect(page.getByRole('combobox', { name: 'Current floor' }).locator('option:checked')).toHaveText('Sky level');
	await page.getByRole('button', { name: 'Move current floor up' }).click();

	await expect(page.getByRole('combobox', { name: 'Current floor' })).toHaveValue('first');
	const floorOptions = page.getByRole('combobox', { name: 'Current floor' }).locator('option');
	await expect(floorOptions.nth(0)).toHaveAttribute('value', 'first');
	await expect(floorOptions.nth(1)).toHaveAttribute('value', 'level-0');

	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(floorOptions.nth(0)).toHaveAttribute('value', 'level-0');
	await expect(floorOptions.nth(1)).toHaveAttribute('value', 'first');
	await expect(page.getByLabel('Floor name')).toHaveValue('Sky level');
	await expect(page.getByLabel('Map scale')).toHaveValue('24');

	await page.getByRole('button', { name: 'Add floor' }).click();
	await expect(floorOptions).toHaveCount(3);
	const addedFloorId = await page.getByRole('combobox', { name: 'Current floor' }).inputValue();
	expect(addedFloorId).not.toBe('first');
	await page.getByLabel('Floor name').fill('Annex');
	await page.getByLabel('Floor name').blur();
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Delete Annex?' });
	await expect(dialog).toContainText('every object authored on it will be removed');
	await dialog.getByRole('button', { name: 'Delete floor' }).click();
	await expect(floorOptions).toHaveCount(2);
	await expect(page.getByRole('combobox', { name: 'Current floor' })).not.toHaveValue(addedFloorId);

	await page.getByRole('button', { name: /Undo/ }).click();
	await expect(floorOptions).toHaveCount(3);
	await page.getByRole('combobox', { name: 'Current floor' }).selectOption(addedFloorId);
	await expect(page.getByLabel('Floor name')).toHaveValue('Annex');
});

test('authors and reshapes a freehand pedestrian space inside the route workspace', async ({ page }) => {
	await openEditor(page);
	const existingWalkableAreas = page.locator('[data-editor-element-id^="walkable-"]');
	await expect(existingWalkableAreas).toHaveCount(0);
	await page.getByRole('button', { name: 'Route edit' }).click();
	await expect(existingWalkableAreas).toHaveCount(1);
	await page.getByRole('button', { name: /Draw a freehand pedestrian area/ }).click();
	await dragMapPath(page, [
		{ x: 520, y: 620 },
		{ x: 700, y: 560 },
		{ x: 920, y: 570 },
		{ x: 1090, y: 690 },
		{ x: 880, y: 760 },
		{ x: 630, y: 740 },
		{ x: 520, y: 620 }
	]);

	const authoredArea = page.locator('[data-editor-element-id^="walkable-"]');
	await expect(authoredArea).toHaveCount(2);
	await expect(page.locator('.selected-polygon')).toHaveCount(1);
	const firstVertex = page.locator('.polygon-vertex').first();
	const firstVertexX = await firstVertex.getAttribute('cx');
	await dragLocatorBy(page, firstVertex, { x: 26, y: 14 });
	await expect(firstVertex).not.toHaveAttribute('cx', firstVertexX ?? '');
	await expect(page.getByText('Map object', { exact: true })).toBeVisible();
});

test('snaps a freehand outline to visible floor-plan edges', async ({ page }) => {
	await openEditor(page, createTraceTestProject());
	await page.getByRole('button', { name: /Draw a freehand room outline/ }).click();
	await expect(page.getByRole('checkbox', { name: /Follow floor-plan edges/ })).toBeChecked();
	await page.getByRole('button', { name: 'Close project panel' }).click();
	await page.waitForTimeout(220);
	const path = [
		{ x: 270, y: 225 },
		{ x: 870, y: 225 },
		{ x: 870, y: 720 },
		{ x: 270, y: 720 },
		{ x: 270, y: 225 }
	];
	const map = page.locator('.map-transform');
	const bounds = await map.boundingBox();
	expect(bounds).not.toBeNull();
	const viewportPoint = (point: { x: number; y: number }): { x: number; y: number } => ({
		x: bounds!.x + point.x / 1920 * bounds!.width,
		y: bounds!.y + point.y / 1080 * bounds!.height
	});
	const first = viewportPoint(path[0]);
	await page.mouse.move(first.x, first.y);
	await page.mouse.down();

	for (const point of path.slice(1)) {
		const next = viewportPoint(point);
		await page.mouse.move(next.x, next.y, { steps: 3 });
	}
	const draftPoints = (await page.locator('.draft-line').getAttribute('points') ?? '')
		.trim()
		.split(/\s+/u);
	expect(draftPoints.length).toBeGreaterThanOrEqual(4);
	await page.mouse.up();

	const points = (await page.locator('.selected-polygon').getAttribute('points') ?? '')
		.trim()
		.split(/\s+/u)
		.map((pair) => pair.split(',').map(Number));
	expect(points.length).toBeGreaterThanOrEqual(4);
	expect(points.some(([x]) => Math.abs(x - 300) <= 12)).toBe(true);
	expect(points.some(([x]) => Math.abs(x - 900) <= 12)).toBe(true);
	expect(points.some(([, y]) => Math.abs(y - 200) <= 12)).toBe(true);
	expect(points.some(([, y]) => Math.abs(y - 750) <= 12)).toBe(true);
});

test('smart trace converts a real floor-plan region into editable project geometry', async ({ page }) => {
	await openEditor(page, createTraceTestProject());
	await page.getByRole('button', { name: /Detect an area from the floor plan/ }).click();
	await clickMapPoint(page, { x: 520, y: 420 });

	const tracedArea = page.locator('[data-editor-element-id^="location-"]');
	await expect(tracedArea).toHaveCount(1);
	await tracedArea.click({ force: true });
	await expect(page.getByText('Destination details', { exact: true })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(/Location/);
});

test('route-space detection cannot inherit the destination trace target', async ({ page }) => {
	await openEditor(page, createTraceTestProject());
	await page.getByRole('button', { name: /Detect an area from the floor plan/ }).click();
	await page.getByRole('button', { name: 'Route edit' }).click();
	await page.getByRole('button', { name: 'Detect from image', exact: true }).click();
	await clickMapPoint(page, { x: 520, y: 420 });

	await expect(page.locator('[data-editor-element-id^="walkable-"]')).toHaveCount(1);
	await expect(page.locator('[data-editor-element-id^="location-"]')).toHaveCount(0);
	await expect(page.getByText('Walkable area', { exact: true }).first()).toBeVisible();
});

test('keeps pedestrian areas behind map objects and route graph interactions', async ({ page }) => {
	await openEditor(page);

	const authoringOverlay = page.locator('.authoring-overlay');
	await expect(authoringOverlay.locator('[data-editor-element-id="walkable-main"]')).toHaveCount(0);
	await expect(authoringOverlay.locator('[data-editor-element-id="door-information"]')).toHaveCount(1);
	await authoringOverlay.locator('[data-editor-element-id="door-information"]').click();
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'door-information');

	await page.getByRole('button', { name: 'Route edit' }).click();
	await expect(page.getByRole('button', { name: 'Space', exact: true })).toHaveAttribute('aria-pressed', 'true');
	await expect(authoringOverlay.locator('[data-editor-element-id="walkable-main"]')).toHaveCount(1);
	await expect(authoringOverlay.locator('.graph-edge-hit')).toHaveCount(0);
	await authoringOverlay.locator('[data-editor-element-id="walkable-main"]').click({ force: true });
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-id', 'walkable-main');

	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	await expect(page.locator('.canvas-viewport')).not.toHaveAttribute('data-selection-id', 'walkable-main');
	await expect(authoringOverlay.locator('[data-editor-element-id="walkable-main"]')).toHaveCount(0);
	await expect(authoringOverlay.locator('.graph-edge-hit')).toHaveCount(1);
	await clickMapPoint(page, { x: 900, y: 650 });
	await expect(page.locator('.canvas-viewport')).toHaveAttribute('data-selection-kind', 'graph-edge');
	await expect(page.locator('.left-panel')).toContainText('Only route geometry is selectable here');
	expect(await panelLayoutProblems(page)).toEqual([]);
});
