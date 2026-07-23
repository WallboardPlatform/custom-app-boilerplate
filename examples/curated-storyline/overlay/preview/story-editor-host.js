(() => {
	'use strict';

	const frame = document.querySelector('#story-editor');
	let configValues = {
		themePreset: 'dark',
		rotationSeconds: 9,
		customContent: {
			venue: 'NORTHLINE ARTS',
			title: 'MATERIAL MEMORY',
			deck: 'Three encounters with salvage, sound, and light',
			stories: [
				{
					id: 'recovered-light',
					label: 'INSTALLATION 01',
					title: 'Recovered light',
					body: 'Discarded glass becomes a shifting field of color as daylight moves through the gallery.',
					detail: 'ATRIUM / LEVEL 1',
					tone: 'coral',
					layout: 'statement',
					enabled: true
				},
				{
					id: 'listening-bench',
					label: 'ARTIST NOTE',
					title: 'The room remembers every footstep.',
					body: 'Sit for a moment. The bench translates nearby movement into a low, evolving score.',
					detail: 'MARA VEGA, 2026',
					tone: 'cobalt',
					layout: 'quote',
					enabled: true
				}
			]
		}
	};

	window.addEventListener('message', (event) => {
		if (event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;

		if (event.data.messageType === 'customWidget_requestCustomProperties') {
			frame.contentWindow.postMessage({ configValues }, '*');
		}

		if (event.data.messageType === 'customWidget_saveCustomProperty') {
			const nextValues = event.data.customPropertyValue?.configValues;

			if (nextValues && typeof nextValues === 'object') {
				configValues = nextValues;
				frame.contentWindow.postMessage({ configValues }, '*');
			}
		}
	});

	window.__storyEditorHost = {
		getState: () => JSON.parse(JSON.stringify(configValues))
	};
})();
