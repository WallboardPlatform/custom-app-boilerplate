(() => {
	'use strict';

	const PROPERTY_NAME = 'customContent';
	const valueInput = document.querySelector('#editor-value');
	const saveButton = document.querySelector('#save');
	const resetButton = document.querySelector('#reset');
	const status = document.querySelector('#status');
	let configValues = {};
	let initialText = '';

	const setStatus = (message, state = 'ready') => {
		status.textContent = message;
		status.dataset.state = state;
	};

	const requestProperties = () => {
		window.parent.window.postMessage({ messageType: 'customWidget_requestCustomProperties' }, '*');
	};

	const saveProperties = () => {
		let value;
		try {
			value = JSON.parse(valueInput.value);
		} catch {
			setStatus('Fix the JSON before saving.', 'error');
			valueInput.focus();
			return;
		}
		window.parent.window.postMessage({
			messageType: 'customWidget_saveCustomProperty',
			customPropertyValue: {
				configValues: { ...configValues, [PROPERTY_NAME]: value }
			}
		}, '*');
		setStatus('Saving in Wallboard...', 'saving');
	};

	window.addEventListener('message', (event) => {
		if (event.source !== window.parent || !event.data || typeof event.data !== 'object') return;
		configValues = event.data.configValues && typeof event.data.configValues === 'object'
			? { ...event.data.configValues }
			: {};
		initialText = JSON.stringify(configValues[PROPERTY_NAME] ?? {}, null, 2);
		valueInput.value = initialText;
		valueInput.disabled = false;
		saveButton.disabled = false;
		resetButton.disabled = false;
		setStatus('Connected to Wallboard.');
	});

	valueInput.addEventListener('input', () => {
		setStatus(valueInput.value === initialText ? 'No changes.' : 'Unsaved changes.', valueInput.value === initialText ? 'ready' : 'dirty');
	});
	resetButton.addEventListener('click', () => {
		valueInput.value = initialText;
		setStatus('Changes reset.');
	});
	saveButton.addEventListener('click', saveProperties);

	requestProperties();
})();
