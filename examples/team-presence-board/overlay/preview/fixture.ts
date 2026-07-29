import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

type PresenceRecord = Record<string, unknown>;

interface PresencePayload {
	users: PresenceRecord[];
}

const sampleUsers: PresenceRecord[] = (sampleDatasourceJson as PresencePayload).users;

const PHOTO_TEMPLATE = (background: string): string => {
	return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' fill='%23${background}'/><circle cx='32' cy='25' r='11' fill='%23E8D5B5'/><path d='M10 64c2-15 11-21 22-21s20 6 22 21z' fill='%23E8D5B5'/></svg>`;
};

// The default preview roster keeps only records whose photos resolve offline (data URIs).
const offlineSafeUsers: PresenceRecord[] = sampleUsers.filter((user: PresenceRecord): boolean => {
	return typeof user.profilePicture !== 'string' || user.profilePicture.indexOf('data:') === 0;
});

const overrideUser = (user: PresenceRecord, overrides: PresenceRecord): PresenceRecord => {
	return { ...user, ...overrides };
};

const DENSE_NAMES: string[] = [
	'Aliz Berta', 'Boris Kelen', 'Cilla Marton', 'Denes Orban', 'Edit Palfi', 'Ferenc Rado',
	'Gitta Selmec', 'Hunor Tari', 'Ilka Ujvari', 'Jozsef Vincze', 'Klara Zentai', 'Lorand Abel',
	'Melinda Bakos', 'Nandor Csete', 'Orsolya Dudas', 'Pal Egressy', 'Reka Farago', 'Sandor Gulyas',
	'Timea Hajdu', 'Ubul Iszak', 'Vilma Jozsa', 'Zalan Kende', 'Alma Lantos', 'Bende Mohos',
	'Csenge Nemes', 'Doma Osvath'
];
const DENSE_STATUSES: { availability: string; activity: string }[] = [
	{ availability: 'Available', activity: 'Available' },
	{ availability: 'Busy', activity: 'InAMeeting' },
	{ availability: 'Busy', activity: 'InACall' },
	{ availability: 'Away', activity: 'Away' },
	{ availability: 'DoNotDisturb', activity: 'Presenting' },
	{ availability: 'Offline', activity: 'OffWork' },
	{ availability: 'Available', activity: 'Available' },
	{ availability: 'Away', activity: 'BeRightBack' }
];
const DENSE_HUES: string[] = ['2E4B5E', '5E4B2E', '4A2E5E', '2E5E4B', '5E2E39', '405E2E', '2E3B5E', '5E552E'];

const denseUsers: PresenceRecord[] = DENSE_NAMES.map((name: string, index: number): PresenceRecord => {
	const parts: string[] = name.split(' ');
	const localPart: string = `${parts[0].toLowerCase()}.${parts[1].toLowerCase()}`;
	const status: { availability: string; activity: string } = DENSE_STATUSES[index % DENSE_STATUSES.length];

	return {
		id: `00000000-0000-4000-9000-${String(index + 1).padStart(12, '0')}`,
		displayName: name,
		givenName: parts[0],
		surname: parts[1],
		mail: `${localPart}@example.com`,
		userPrincipalName: `${localPart}@example.com`,
		jobTitle: 'Team Member',
		department: 'Company',
		officeLocation: 'North Office',
		businessPhones: [],
		mobilePhone: null,
		preferredLanguage: 'en-US',
		profilePicture: PHOTO_TEMPLATE(DENSE_HUES[index % DENSE_HUES.length]),
		availability: status.availability,
		activity: status.activity,
		presenceColor: '#92c353',
		statusMessage: null,
		managerId: null,
		managerDisplayName: null,
		managerJobTitle: null,
		managerDepartment: null
	};
});

const baseConfig: Record<string, unknown> = {
	scopeTitle: 'All Team',
	memberFilter: '',
	requirePhoto: true,
	showHeader: true,
	showTicker: true,
	showOfflineZone: true,
	themePreset: 'dark',
	backgroundColor: '#151B1B',
	panelColor: '#1C2424',
	wellColor: '#0E1212',
	textColor: '#EAEAEA',
	mutedTextColor: '#738084',
	accentColor: '#D1202C',
	motionPreset: 'expressive'
};

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig,
	readySelector = '.wb-presence-scope'
): PreviewFixture => ({
	id,
	readySelector,
	configValues,
	dataPickerValues: { presenceData: data },
	datasourceIds: { presenceData: 'preview-presence-data' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const previewFixture: PreviewFixture = createFixture('team-presence-preview', { users: offlineSafeUsers });

const allOfflineUsers: PresenceRecord[] = offlineSafeUsers.map((user: PresenceRecord): PresenceRecord => {
	return overrideUser(user, { availability: 'Offline', activity: 'OffWork' });
});

const brokenPhotoUsers: PresenceRecord[] = [
	overrideUser(offlineSafeUsers[0], { profilePicture: 'broken-photo-reference' }),
	overrideUser(offlineSafeUsers[1], { profilePicture: null }),
	overrideUser(offlineSafeUsers[3], { profilePicture: 'broken-photo-reference' }),
	overrideUser(offlineSafeUsers[4], { profilePicture: null }),
	overrideUser(offlineSafeUsers[7], { profilePicture: 'broken-photo-reference' }),
	overrideUser(offlineSafeUsers[10], { profilePicture: null })
];

const longNameUsers: PresenceRecord[] = [
	overrideUser(offlineSafeUsers[0], {
		displayName: 'Alexandrina Konstantinovna Sample-Personname',
		givenName: 'Alexandrina',
		availability: 'Busy',
		activity: 'InAConferenceCall'
	}),
	...offlineSafeUsers.slice(1, 10)
];

const liveUpdateUsers: PresenceRecord[] = offlineSafeUsers.map((user: PresenceRecord): PresenceRecord => {
	return user.mail === 'ava.winter@example.com'
		? overrideUser(user, { availability: 'Busy', activity: 'InAMeeting' })
		: user;
});

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'dense-wall',
		fixture: createFixture('team-presence-dense-wall', { users: denseUsers }, {
			...baseConfig,
			scopeTitle: 'Whole Company'
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 93 }
	},
	{
		id: 'compact-trio',
		fixture: createFixture(
			'team-presence-compact-trio',
			{
				users: offlineSafeUsers.map((user: PresenceRecord): PresenceRecord => {
					return user.mail === 'ava.winter@example.com'
						? overrideUser(user, { displayName: 'Ava Alexandrina Konstantinovna Winter-Sample' })
						: user;
				})
			},
			{
				...baseConfig,
				scopeTitle: 'Leadership',
				memberFilter: 'ava.winter, theo.marsh, petra.lund'
			}
		),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 95, height: 93 }
	},
	{
		id: 'hero-door-card',
		fixture: createFixture('team-presence-hero', { users: offlineSafeUsers }, {
			...baseConfig,
			scopeTitle: "Theo's Office",
			memberFilter: 'theo.marsh'
		}),
		viewport: { width: 1280, height: 800, background: 'dark' },
		minimumContentCoverage: { width: 95, height: 92 }
	},
	{
		id: 'light-theme',
		fixture: createFixture('team-presence-light', { users: offlineSafeUsers }, {
			...baseConfig,
			themePreset: 'light'
		}),
		viewport: { width: 1920, height: 1080, background: 'light' },
		minimumContentCoverage: { width: 93, height: 93 }
	},
	{
		id: 'empty',
		fixture: createFixture('team-presence-empty', { users: [] }),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 91 }
	},
	{
		id: 'malformed-data',
		fixture: createFixture('team-presence-malformed', { unexpected: 'shape' }),
		viewport: { width: 960, height: 540, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 91 }
	},
	{
		id: 'all-offline',
		fixture: createFixture('team-presence-all-offline', { users: allOfflineUsers }),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 95, height: 93 }
	},
	{
		id: 'broken-photos',
		fixture: createFixture('team-presence-broken-photos', { users: brokenPhotoUsers }, {
			...baseConfig,
			requirePhoto: false
		}),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 92 }
	},
	{
		id: 'long-names',
		fixture: createFixture('team-presence-long-names', { users: longNameUsers }, {
			...baseConfig,
			scopeTitle: 'Extremely Long Configured Scope Title For Regional Presence Overflow Checking'
		}),
		viewport: { width: 1536, height: 432, background: 'dark' },
		minimumContentCoverage: { width: 94, height: 90 }
	},
	{
		id: 'hidden-offline',
		fixture: createFixture('team-presence-hidden-offline', { users: offlineSafeUsers }, {
			...baseConfig,
			showOfflineZone: false
		}),
		viewport: { width: 1920, height: 1080, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 93 }
	},
	{
		id: 'chrome-hidden',
		fixture: createFixture(
			'team-presence-chrome-hidden',
			{ users: offlineSafeUsers },
			{ ...baseConfig, showHeader: false, showTicker: false },
			'[data-preview-id="presence-root"]'
		),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 92, height: 83 }
	},
	{
		id: 'live-datasource-update',
		fixture: createFixture('team-presence-live-update', { users: offlineSafeUsers }),
		viewport: { width: 1366, height: 768, background: 'dark' },
		minimumContentCoverage: { width: 93, height: 92 },
		liveDatasourceUpdate: {
			property: 'presenceData',
			value: { users: liveUpdateUsers },
			expectedText: 'In a meeting · just now'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '.wb-presence-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	},
	{
		id: 'scope-title',
		property: 'scopeTitle',
		changedValue: 'Updated Scope',
		selector: '.wb-presence-scope',
		measurement: { type: 'text-content' },
		expectation: { type: 'change' }
	},
	{
		id: 'show-header',
		property: 'showHeader',
		changedValue: false,
		selector: '.wb-presence-app',
		measurement: { type: 'attribute', name: 'data-header' },
		expectation: { type: 'change' }
	},
	{
		id: 'show-ticker',
		property: 'showTicker',
		changedValue: false,
		selector: '.wb-presence-app',
		measurement: { type: 'attribute', name: 'data-ticker' },
		expectation: { type: 'change' }
	},
	{
		id: 'show-offline-zone',
		property: 'showOfflineZone',
		changedValue: false,
		selector: '.wb-presence-app',
		measurement: { type: 'attribute', name: 'data-zones' },
		expectation: { type: 'change' }
	},
	{
		id: 'member-filter',
		property: 'memberFilter',
		changedValue: 'ava.winter',
		selector: '.wb-presence-app',
		measurement: { type: 'attribute', name: 'data-people-count' },
		expectation: { type: 'change' }
	},
	{
		id: 'require-photo',
		property: 'requirePhoto',
		changedValue: false,
		selector: '.wb-presence-app',
		measurement: { type: 'attribute', name: 'data-people-count' },
		expectation: { type: 'change' }
	},
	{
		id: 'motion-preset',
		property: 'motionPreset',
		changedValue: 'off',
		selector: '.wb-presence-app',
		measurement: { type: 'attribute', name: 'data-motion' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
