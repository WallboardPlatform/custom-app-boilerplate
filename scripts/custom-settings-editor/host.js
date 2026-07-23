(() => {
	'use strict';

	const iframe = document.querySelector('#custom-editor');
	const hostState = document.querySelector('#host-state');
	const saveCount = document.querySelector('#save-count');
	let saves = 0;
	let configValues = {
		themePreset: 'dark',
		untouchedSetting: 'preserve-me',
		customContent: {
			heading: 'Visitor services',
			sections: [
				{
					id: 'arrival',
					title: 'Arrival',
					body: 'Main entrance opens at 08:00.',
					enabled: true
				},
				{
					id: 'accessibility',
					title: 'Accessibility',
					body: 'Step-free access is available from the east entrance.',
					enabled: true
				}
			]
		}
	};

	function renderState() {
		hostState.textContent = JSON.stringify(configValues, null, 2);
		saveCount.textContent = `${saves} ${saves === 1 ? 'save' : 'saves'}`;
	}

	window.addEventListener('message', (event) => {
		if (event.source !== iframe.contentWindow || !event.data || typeof event.data !== 'object') return;

		if (event.data.messageType === 'customWidget_requestCustomProperties') {
			iframe.contentWindow.postMessage({ configValues }, '*');
			return;
		}

		if (event.data.messageType === 'customWidget_saveCustomProperty') {
			const nextConfigValues = event.data.customPropertyValue?.configValues;

			if (!nextConfigValues || typeof nextConfigValues !== 'object') return;
			configValues = { ...nextConfigValues };
			saves += 1;
			renderState();
			iframe.contentWindow.postMessage({ configValues }, '*');
		}
	});

	renderState();
	iframe.src = iframe.dataset.src;
})();
