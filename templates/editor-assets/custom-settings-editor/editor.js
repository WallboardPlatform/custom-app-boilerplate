(() => {
	'use strict';

	const PROPERTY_NAME = 'customContent';
	const DEFAULT_VALUE = {
		heading: 'Visitor information',
		sections: [
			{
				id: 'welcome',
				title: 'Welcome',
				body: 'Add the information visitors should see first.',
				enabled: true
			}
		]
	};
	const collectionTitle = document.querySelector('#collection-title');
	const sectionList = document.querySelector('#sections');
	const sectionTemplate = document.querySelector('#section-template');
	const emptyState = document.querySelector('#empty-state');
	const addButton = document.querySelector('#add-section');
	const saveButton = document.querySelector('#save');
	const resetButton = document.querySelector('#reset');
	const status = document.querySelector('#status');
	let configValues = {};
	let initialValue = structuredCloneValue(DEFAULT_VALUE);
	let workingValue = structuredCloneValue(DEFAULT_VALUE);
	let connected = false;
	let nextSectionNumber = 1;

	function structuredCloneValue(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function stringValue(value, fallback = '') {
		return typeof value === 'string' ? value : fallback;
	}

	function normalizeValue(value) {
		const candidate = value && typeof value === 'object' ? value : {};
		const sections = Array.isArray(candidate.sections)
			? candidate.sections.map((section, index) => {
				const item = section && typeof section === 'object' ? section : {};

				return {
					id: stringValue(item.id, `section-${index + 1}`),
					title: stringValue(item.title),
					body: stringValue(item.body),
					enabled: item.enabled !== false
				};
			})
			: structuredCloneValue(DEFAULT_VALUE.sections);

		return {
			heading: stringValue(candidate.heading, DEFAULT_VALUE.heading),
			sections
		};
	}

	function receivedConfigValues(data) {
		if (!data || typeof data !== 'object') return null;
		if (data.configValues && typeof data.configValues === 'object') return data.configValues;
		if (data.config && data.config.configValues && typeof data.config.configValues === 'object') {
			return data.config.configValues;
		}

		return null;
	}

	function setStatus(message, state = 'ready') {
		status.textContent = message;
		status.dataset.state = state;
	}

	function isDirty() {
		return JSON.stringify(workingValue) !== JSON.stringify(initialValue);
	}

	function updateStatus() {
		if (!connected) return;
		setStatus(isDirty() ? 'Unsaved changes' : 'All changes saved', isDirty() ? 'dirty' : 'ready');
	}

	function setControlsEnabled(enabled) {
		collectionTitle.disabled = !enabled;
		addButton.disabled = !enabled;
		saveButton.disabled = !enabled;
		resetButton.disabled = !enabled;
	}

	function createSection() {
		const id = `section-${Date.now()}-${nextSectionNumber}`;
		nextSectionNumber += 1;

		return {
			id,
			title: 'New section',
			body: '',
			enabled: true
		};
	}

	function moveSection(index, offset) {
		const nextIndex = index + offset;

		if (nextIndex < 0 || nextIndex >= workingValue.sections.length) return;
		const [section] = workingValue.sections.splice(index, 1);
		workingValue.sections.splice(nextIndex, 0, section);
		render();
		updateStatus();
	}

	function deleteSection(index) {
		const section = workingValue.sections[index];

		if (!section || !window.confirm(`Delete "${section.title || 'Untitled section'}"?`)) return;
		workingValue.sections.splice(index, 1);
		render();
		updateStatus();
	}

	function bindSection(article, section, index) {
		const position = article.querySelector('.section-position');
		const summary = article.querySelector('.section-summary');
		const title = article.querySelector('[data-field="title"]');
		const body = article.querySelector('[data-field="body"]');
		const enabled = article.querySelector('[data-field="enabled"]');
		const upButton = article.querySelector('[data-action="move-up"]');
		const downButton = article.querySelector('[data-action="move-down"]');

		article.dataset.sectionId = section.id;
		position.textContent = `Section ${index + 1}`;
		summary.textContent = section.title || 'Untitled section';
		title.value = section.title;
		body.value = section.body;
		enabled.checked = section.enabled;
		upButton.disabled = index === 0;
		downButton.disabled = index === workingValue.sections.length - 1;

		title.addEventListener('input', () => {
			section.title = title.value;
			summary.textContent = title.value || 'Untitled section';
			updateStatus();
		});
		body.addEventListener('input', () => {
			section.body = body.value;
			updateStatus();
		});
		enabled.addEventListener('change', () => {
			section.enabled = enabled.checked;
			updateStatus();
		});
		upButton.addEventListener('click', () => moveSection(index, -1));
		downButton.addEventListener('click', () => moveSection(index, 1));
		article.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSection(index));
	}

	function render() {
		collectionTitle.value = workingValue.heading;
		sectionList.replaceChildren();

		for (let index = 0; index < workingValue.sections.length; index += 1) {
			const fragment = sectionTemplate.content.cloneNode(true);
			const article = fragment.querySelector('.content-section');
			bindSection(article, workingValue.sections[index], index);
			sectionList.append(fragment);
		}

		emptyState.hidden = workingValue.sections.length > 0;
	}

	function requestProperties() {
		window.parent.window.postMessage({ messageType: 'customWidget_requestCustomProperties' }, '*');
	}

	function saveProperties() {
		if (!connected) return;
		const normalized = normalizeValue(workingValue);
		window.parent.window.postMessage({
			messageType: 'customWidget_saveCustomProperty',
			customPropertyValue: {
				configValues: { ...configValues, [PROPERTY_NAME]: normalized }
			}
		}, '*');
		initialValue = structuredCloneValue(normalized);
		workingValue = structuredCloneValue(normalized);
		render();
		setStatus('Saving in Wallboard...', 'saving');
	}

	window.addEventListener('message', (event) => {
		if (event.source !== window.parent) return;
		const incomingConfigValues = receivedConfigValues(event.data);

		if (!incomingConfigValues) return;
		configValues = { ...incomingConfigValues };
		initialValue = normalizeValue(configValues[PROPERTY_NAME]);
		workingValue = structuredCloneValue(initialValue);
		connected = true;
		setControlsEnabled(true);
		render();
		updateStatus();
	});

	collectionTitle.addEventListener('input', () => {
		workingValue.heading = collectionTitle.value;
		updateStatus();
	});
	addButton.addEventListener('click', () => {
		workingValue.sections.push(createSection());
		render();
		updateStatus();
		sectionList.lastElementChild?.querySelector('[data-field="title"]')?.focus();
	});
	resetButton.addEventListener('click', () => {
		workingValue = structuredCloneValue(initialValue);
		render();
		updateStatus();
	});
	saveButton.addEventListener('click', saveProperties);
	window.addEventListener('keydown', (event) => {
		if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
			event.preventDefault();
			saveProperties();
		}
	});
	window.addEventListener('beforeunload', (event) => {
		if (!isDirty()) return;
		event.preventDefault();
		event.returnValue = '';
	});

	setControlsEnabled(false);
	render();
	requestProperties();
})();
