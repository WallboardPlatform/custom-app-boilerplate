import sampleDatasourceJson from '../sample-datasource.json';

import type { PreviewFixture, PreviewScenario, PreviewSettingEffect } from './fixture.types';

interface PreviewAndonRow extends Record<string, unknown> {
	line: string;
	station: string;
	state: string;
	reason: string;
	ownerRole: string;
	elapsedDuration: string;
}

interface PreviewAndonDatasource {
	AndonStatus: {
		header: Record<string, string>;
		rows: PreviewAndonRow[];
		connectors: Record<string, unknown>;
	};
}

const sampleDatasource: PreviewAndonDatasource = sampleDatasourceJson as PreviewAndonDatasource;
const sampleRows: PreviewAndonRow[] = sampleDatasource.AndonStatus.rows;
const baseConfig: Record<string, unknown> = {
	boardTitle: 'NORTHSTAR ASSEMBLY',
	boardSubtitle: 'PRODUCTION ANDON',
	emptyStateText: 'No station status rows are available.',
	pageDurationSeconds: 3,
	themePreset: 'dark',
	backgroundColor: '#111615',
	surfaceColor: '#1c2422',
	primaryTextColor: '#f4f6f2',
	secondaryTextColor: '#a6b2ae',
	normalColor: '#35c879',
	attentionColor: '#f0b43a',
	stoppedColor: '#f05252',
	unknownColor: '#8c9a9e'
};

const withRows = (rows: PreviewAndonRow[]): PreviewAndonDatasource => ({
	AndonStatus: {
		...sampleDatasource.AndonStatus,
		rows
	}
});

const createFixture = (
	id: string,
	data: unknown,
	configValues: Record<string, unknown> = baseConfig
): PreviewFixture => ({
	id,
	readySelector: '.andon-brand__name',
	configValues,
	dataPickerValues: { andonData: data },
	datasourceIds: { andonData: 'preview-andon-status' },
	additionalConfig: { licenseType: null, mockDatasource: {}, style: {} }
});

const unknownRows: PreviewAndonRow[] = [
	{ ...sampleRows[0], line: 'LINE P / PILOT BUILD', station: 'P-10 FIXTURE LOAD', state: 'Normal' },
	{
		...sampleRows[1],
		line: 'LINE P / PILOT BUILD',
		station: 'P-20 CALIBRATION',
		state: 'Engineering review',
		reason: 'Control state has not been mapped',
		ownerRole: 'Controls Engineer',
		elapsedDuration: '12:08'
	},
	{ ...sampleRows[2], line: 'LINE P / PILOT BUILD', station: 'P-30 RELEASE', state: 'Attention' }
];
const longReasonRows: PreviewAndonRow[] = [
	{
		...sampleRows[0],
		line: 'LINE A / ADVANCED POWERTRAIN FINAL ASSEMBLY',
		station: 'A-100 AUTOMATED FRAME DATUM VERIFICATION',
		state: 'Stopped',
		reason: 'Primary datum verification exceeded tolerance after the automated fixture completed its second measurement cycle',
		ownerRole: 'Senior Manufacturing Quality Technician',
		elapsedDuration: '1 day 02:45:17'
	},
	{
		...sampleRows[1],
		line: 'LINE A / ADVANCED POWERTRAIN FINAL ASSEMBLY',
		station: 'A-110 MULTI-SPINDLE TORQUE CONFIRMATION',
		state: 'Attention',
		reason: 'Replacement fastener cassette is being verified before replenishment can resume',
		ownerRole: 'Materials and Production Support Lead',
		elapsedDuration: '02:38:44'
	},
	{
		...sampleRows[2],
		line: 'LINE A / ADVANCED POWERTRAIN FINAL ASSEMBLY',
		station: 'A-120 FINAL VISION INSPECTION',
		state: 'Normal',
		reason: 'Inspection sequence is operating within the released quality plan',
		ownerRole: 'Automated Inspection Operator',
		elapsedDuration: '00:00:42'
	},
	{
		...sampleRows[3],
		line: 'LINE B / ELECTRIFIED MODULE INTEGRATION',
		station: 'B-100 HIGH-VOLTAGE COMPONENT PRESENTATION',
		state: 'Normal',
		reason: 'Sequenced component presentation is available for the next production unit',
		ownerRole: 'Material Flow Coordinator',
		elapsedDuration: '00:01:05'
	},
	{
		...sampleRows[4],
		line: 'LINE B / ELECTRIFIED MODULE INTEGRATION',
		station: 'B-110 CONTROLLED PRESS-FIT OPERATION',
		state: 'Stopped',
		reason: 'Perimeter guarding interlock remains open following a scheduled verification activity',
		ownerRole: 'Electrical and Mechanical Maintenance',
		elapsedDuration: '00:47:14'
	},
	{
		...sampleRows[5],
		line: 'LINE B / ELECTRIFIED MODULE INTEGRATION',
		station: 'B-120 END-OF-LINE FUNCTIONAL VALIDATION',
		state: 'Normal',
		reason: 'Functional validation sequence is progressing through the released test stages',
		ownerRole: 'End-of-Line Test Operator',
		elapsedDuration: '00:03:33'
	},
	{
		...sampleRows[6],
		line: 'LINE B / ELECTRIFIED MODULE INTEGRATION',
		station: 'B-130 SERIALIZATION AND RELEASE',
		state: 'Attention',
		reason: 'Release queue is waiting for a final electronic production record confirmation',
		ownerRole: 'Production Control Specialist',
		elapsedDuration: '00:12:48'
	}
];
const allNormalRows: PreviewAndonRow[] = sampleRows.map((row: PreviewAndonRow): PreviewAndonRow => ({
	...row,
	state: 'Normal',
	reason: 'Cycle within standard'
}));
const allStoppedRows: PreviewAndonRow[] = sampleRows.slice(0, 8).map(
	(row: PreviewAndonRow, index: number): PreviewAndonRow => ({
		...row,
		state: 'Stopped',
		reason: index % 2 === 0 ? 'Safety response active' : 'Equipment response required',
		ownerRole: index % 2 === 0 ? 'Line Lead' : 'Maintenance',
		elapsedDuration: `0${Math.floor(index / 2)}:${String(12 + index * 3).padStart(2, '0')}`
	})
);
const invalidRows: PreviewAndonRow[] = [
	{ ...sampleRows[0], line: '' },
	{ ...sampleRows[1], station: '' },
	{ ...sampleRows[2], line: 'LINE V / VALIDATION', station: 'V-10 VALID ROW', state: 'Normal' }
];
const stateCycle: string[] = ['Normal', 'Normal', 'Attention', 'Stopped', 'Running', 'Waiting'];
const maximumRows: PreviewAndonRow[] = Array.from(
	{ length: 18 },
	(_: unknown, index: number): PreviewAndonRow => {
		const lineNumber: number = Math.floor(index / 3) + 1;
		const stationNumber: number = (index % 3) + 1;

		return {
			line: `LINE ${lineNumber} / ASSEMBLY ZONE`,
			station: `${lineNumber}-${stationNumber} PROCESS STATION`,
			state: stateCycle[index % stateCycle.length],
			reason: index % 4 === 0 ? 'Production response is active' : 'Cycle status within current operating plan',
			ownerRole: index % 4 === 0 ? 'Line Lead' : 'Cell Operator',
			elapsedDuration: `0${index % 6}:${String(10 + index * 2).padStart(2, '0')}`
		};
	}
);
const oversizedLineRows: PreviewAndonRow[] = Array.from(
	{ length: 17 },
	(_: unknown, index: number): PreviewAndonRow => ({
		line: 'LINE X / EXTENDED COMMISSIONING',
		station: `X-${String(index + 1).padStart(2, '0')} COMMISSIONING POINT`,
		state: index === 12 ? 'Stopped' : index % 5 === 0 ? 'Attention' : 'Normal',
		reason: index === 12 ? 'Verification fixture response required' : 'Commissioning sequence active',
		ownerRole: index === 12 ? 'Commissioning Lead' : 'Launch Technician',
		elapsedDuration: `0${Math.floor(index / 6)}:${String(14 + index).padStart(2, '0')}`
	})
);
const liveUpdateRows: PreviewAndonRow[] = sampleRows.map(
	(row: PreviewAndonRow, index: number): PreviewAndonRow => index === 0
		? {
			...row,
			state: 'Stopped',
			reason: 'Torque verification failed',
			ownerRole: 'Quality Technician',
			elapsedDuration: '00:03'
		}
		: row
);

const previewFixture: PreviewFixture = createFixture('northstar-andon-preview', sampleDatasource);

export const previewScenarios: PreviewScenario[] = [
	{
		id: 'mixed-line-load',
		fixture: createFixture('northstar-andon-mixed-line-load', sampleDatasource),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 87, height: 90 }
	},
	{
		id: 'light-theme',
		fixture: createFixture('northstar-andon-light-theme', sampleDatasource, { ...baseConfig, themePreset: 'light' }),
		viewport: { width: 1080, height: 1920, background: 'light' },
		minimumContentCoverage: { width: 87, height: 90 }
	},
	{
		id: 'unknown-state',
		fixture: createFixture('northstar-andon-unknown-state', withRows(unknownRows)),
		viewport: { width: 480, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 88, height: 92 }
	},
	{
		id: 'long-reasons',
		fixture: createFixture('northstar-andon-long-reasons', withRows(longReasonRows), {
			...baseConfig,
			boardTitle: 'NORTHSTAR ASSEMBLY OPERATIONS'
		}),
		viewport: { width: 480, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 88, height: 91 }
	},
	{
		id: 'all-normal',
		fixture: createFixture('northstar-andon-all-normal', withRows(allNormalRows)),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 87, height: 90 }
	},
	{
		id: 'all-stopped',
		fixture: createFixture('northstar-andon-all-stopped', withRows(allStoppedRows)),
		viewport: { width: 480, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 88, height: 92 }
	},
	{
		id: 'empty',
		fixture: createFixture('northstar-andon-empty', withRows([])),
		viewport: { width: 480, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 88, height: 92 }
	},
	{
		id: 'invalid-rows',
		fixture: createFixture('northstar-andon-invalid-rows', withRows(invalidRows)),
		viewport: { width: 480, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 88, height: 92 }
	},
	{
		id: 'maximum-content',
		fixture: createFixture('northstar-andon-maximum-content', withRows(maximumRows)),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 87, height: 90 }
	},
	{
		id: 'final-partial-group',
		fixture: createFixture('northstar-andon-final-partial-group', withRows(oversizedLineRows)),
		viewport: { width: 1080, height: 1920, background: 'dark' },
		advanceTimeMs: 3500,
		minimumContentCoverage: { width: 87, height: 90 }
	},
	{
		id: 'live-update',
		fixture: createFixture('northstar-andon-live-update', sampleDatasource),
		viewport: { width: 480, height: 1920, background: 'dark' },
		minimumContentCoverage: { width: 88, height: 92 },
		liveDatasourceUpdate: {
			property: 'andonData',
			value: withRows(liveUpdateRows),
			expectedText: 'Torque verification failed'
		}
	}
];

export const previewSettingEffects: PreviewSettingEffect[] = [
	{
		id: 'theme-preset',
		property: 'themePreset',
		changedValue: 'light',
		selector: '.wb-app',
		measurement: { type: 'computed-style', property: 'background-color' },
		expectation: { type: 'change' }
	}
];

export default previewFixture;
