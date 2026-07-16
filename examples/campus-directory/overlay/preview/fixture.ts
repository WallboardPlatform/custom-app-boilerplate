import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface PreviewDirectoryRow extends Record<string, unknown> {
	building: string;
	floor: string;
	department: string;
	room: string;
	direction: string;
	accessibilityNote: string;
}

interface PreviewDirectoryDatasource {
	Directory: {
		header: Record<string, string>;
		rows: PreviewDirectoryRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource: PreviewDirectoryDatasource = sampleDatasourceJson as PreviewDirectoryDatasource;
const baseConfig: Record<string, unknown> = {
	campusName: 'Rivermark College',
	directoryTitle: 'Campus Directory',
	locationLabel: 'Welcome Center Lobby',
	emptyStateText: 'No directory entries are available.',
	pageDurationSeconds: 12,
	themePreset: 'light',
	backgroundColor: '#f5f7f4',
	textColor: '#17312c',
	accentColor: '#007f6d',
	accessibilityColor: '#4f7f21'
};

const withRows = (rows: PreviewDirectoryRow[]): PreviewDirectoryDatasource => ({
	Directory: {
		...sampleDatasource.Directory,
		rows
	}
});

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.directory-title',
	configValues,
	dataPickerValues: { directoryData: data },
	datasourceIds: { directoryData: 'preview-directory-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const sampleRows: PreviewDirectoryRow[] = sampleDatasource.Directory.rows;
const longDepartmentRows: PreviewDirectoryRow[] = [
	{
		building: 'Beacon Library and Collaborative Learning Pavilion',
		floor: 'Level 1',
		department: 'Center for Interdisciplinary Research, Digital Scholarship, and Community Partnerships',
		room: 'B-118',
		direction: 'Follow the blue floor line beyond the open stair and continue through the glass study gallery',
		accessibilityNote: 'Elevator access from the east entrance; height-adjustable consultation desk available'
	},
	{
		building: 'Cedar Science Center',
		floor: 'Level 2',
		department: 'Environmental Field Methods and Applied Conservation Laboratory',
		room: 'C-226',
		direction: 'Turn left from the central elevator and follow the green laboratory markers',
		accessibilityNote: 'Accessible lab station and seated controls available'
	},
	{
		building: 'Meridian Center',
		floor: 'Ground',
		department: 'Information Technology Service and Classroom Technology Support',
		room: 'M-010',
		direction: 'Opposite the north entrance beside the student services queue',
		accessibilityNote: 'Queue display includes audible announcements and a lowered service counter'
	}
];
const portraitEssentialRows: PreviewDirectoryRow[] = [
	{
		building: 'Alder Hall',
		floor: 'Ground',
		department: 'Admissions and Welcome Services',
		room: 'A-104',
		direction: 'Use the east corridor, pass the welcome desk, and enter the first office on the left',
		accessibilityNote: 'Step-free entrance from College Walk; automatic doors and a lowered service counter are available'
	},
	{
		building: 'Alder Hall',
		floor: 'Level 1',
		department: 'Student Accessibility and Academic Support',
		room: 'A-220',
		direction: 'Take the lobby elevator to level one, turn right, and continue to the north end of the corridor',
		accessibilityNote: 'Elevator, automatic door, and hearing loop are available; request tactile maps at reception'
	},
	{
		building: 'Beacon Library',
		floor: 'Ground',
		department: 'Welcome and Borrowing Desk',
		room: 'B-012',
		direction: 'Continue straight from the main entrance, cross the atrium, and use the desk beside the blue column',
		accessibilityNote: 'Height-adjustable counter and assistive listening devices are available at the central desk'
	},
	{
		building: 'Beacon Library',
		floor: 'Level 1',
		department: 'Research and Digital Scholarship Support',
		room: 'B-124',
		direction: 'Follow the blue floor line beyond the open stair, then enter the glass consultation suite on the right',
		accessibilityNote: 'Use the east elevator; the consultation suite has automatic doors and wheelchair turning space'
	},
	{
		building: 'Cedar Science Center',
		floor: 'Level 2',
		department: 'Environmental Field Methods Laboratory',
		room: 'C-226',
		direction: 'Take the central elevator to level two, turn left, and follow the green laboratory markers',
		accessibilityNote: 'Accessible laboratory station, seated controls, and an emergency visual alert are provided'
	},
	{
		building: 'Harbor Arts Center',
		floor: 'Ground',
		department: 'Riverside Theatre and Performance Services',
		room: 'H-020',
		direction: 'Cross the performance lobby and continue through the double doors opposite the box office',
		accessibilityNote: 'Wheelchair seating is available via aisle one; an induction loop operates during performances'
	}
];
const missingRoomRows: PreviewDirectoryRow[] = sampleRows.slice(0, 4).map(
	(row: PreviewDirectoryRow, index: number): PreviewDirectoryRow => index % 2 === 0 ? { ...row, room: '' } : row
);
const invalidRows: PreviewDirectoryRow[] = [
	sampleRows[0],
	{ ...sampleRows[1], building: '' },
	{ ...sampleRows[2], floor: '' },
	{ ...sampleRows[3], direction: '' },
	sampleRows[4]
];
const liveUpdateRows: PreviewDirectoryRow[] = sampleRows.map(
	(row: PreviewDirectoryRow, index: number): PreviewDirectoryRow => index === 0
		? { ...row, department: 'Enrollment Services', room: 'A-106', direction: 'East corridor beside the welcome desk' }
		: row
);
const unequalFloorRows: PreviewDirectoryRow[] = [
	...sampleRows.slice(0, 4),
	sampleRows[4],
	...sampleRows.slice(8, 12),
	sampleRows[15]
];
const finalPartialRows: PreviewDirectoryRow[] = sampleRows.slice(0, 14);

const previewFixture: PreviewFixture = createFixture('rivermark-campus-directory-preview', sampleDatasource);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'dark-theme',
		fixture: createFixture('rivermark-directory-dark', sampleDatasource, { ...baseConfig, themePreset: 'dark' }),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 91 }
	},
	{
		id: 'custom-theme',
		fixture: createFixture('rivermark-directory-custom', sampleDatasource, {
			...baseConfig,
			themePreset: 'custom',
			backgroundColor: '#edf2f6',
			textColor: '#202a3a',
			accentColor: '#9b3f35',
			accessibilityColor: '#397143'
		}),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 92, height: 90 }
	},
	{
		id: 'single-building',
		fixture: createFixture('rivermark-directory-single-building', withRows(sampleRows.slice(0, 4))),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 93, height: 92 }
	},
	{
		id: 'many-buildings',
		fixture: createFixture('rivermark-directory-many-buildings', withRows([...sampleRows].reverse())),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 92, height: 90 }
	},
	{
		id: 'unequal-floors',
		fixture: createFixture('rivermark-directory-unequal-floors', withRows(unequalFloorRows)),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 92, height: 91 }
	},
	{
		id: 'long-departments',
		fixture: createFixture('rivermark-directory-long-departments', withRows(longDepartmentRows), {
			...baseConfig,
			directoryTitle: 'Campus Navigation and Department Directory'
		}),
		viewport: { width: 1536, height: 432, background: 'light' },
		minimumContentCoverage: { width: 92, height: 89 }
	},
	{
		id: 'portrait-long-essential-fields',
		fixture: createFixture('rivermark-directory-portrait-essential-fields', withRows(portraitEssentialRows)),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 93, height: 92 }
	},
	{
		id: 'missing-rooms',
		fixture: createFixture('rivermark-directory-missing-rooms', withRows(missingRoomRows)),
		viewport: { width: 600, height: 600, background: 'light' },
		minimumContentCoverage: { width: 92, height: 88 }
	},
	{
		id: 'static-unbound',
		fixture: {
			id: 'rivermark-directory-static-unbound',
			readySelector: '.directory-title',
			configValues: baseConfig,
			dataPickerValues: {},
			datasourceIds: {},
			additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
		},
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 92, height: 91 }
	},
	{
		id: 'empty',
		fixture: createFixture('rivermark-directory-empty', withRows([])),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 92, height: 90 }
	},
	{
		id: 'invalid-rows',
		fixture: createFixture('rivermark-directory-invalid', withRows(invalidRows)),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 92, height: 90 }
	},
	{
		id: 'row-array',
		fixture: createFixture('rivermark-directory-row-array', sampleRows),
		viewport: { width: 960, height: 540, background: 'light' },
		minimumContentCoverage: { width: 92, height: 90 }
	},
	{
		id: 'final-partial-page',
		fixture: createFixture('rivermark-directory-final-page', withRows(finalPartialRows), {
			...baseConfig,
			pageDurationSeconds: 3
		}),
		viewport: { width: 1366, height: 768, background: 'light' },
		advanceTimeMs: 6500,
		minimumContentCoverage: { width: 92, height: 91 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('rivermark-directory-live-update', sampleDatasource),
		viewport: { width: 1366, height: 768, background: 'light' },
		minimumContentCoverage: { width: 92, height: 91 },
		liveDatasourceUpdate: {
			property: 'directoryData',
			value: withRows(liveUpdateRows),
			expectedText: 'Enrollment Services'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'dark',
		selector: '.wb-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'page-duration',
		property: 'pageDurationSeconds',
		changedValue: 20,
		selector: '.wb-app',
		measurement: { type: 'attribute', name: 'data-page-duration' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
