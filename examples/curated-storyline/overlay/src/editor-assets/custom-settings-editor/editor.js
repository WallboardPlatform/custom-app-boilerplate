(() => {
	'use strict';

	const PROPERTY_NAME = 'customContent';
	const DEFAULT_VALUE = {
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
				body: 'Sit for a moment. The bench translates the movement of nearby visitors into a low, evolving score.',
				detail: 'MARA VEGA, 2026',
				tone: 'cobalt',
				layout: 'quote',
				enabled: true
			},
			{
				id: 'material-library',
				label: 'TODAY IN THE STUDIO',
				title: 'Material library',
				body: 'Handle samples from the exhibition and meet the conservation team.',
				detail: '14:00-17:30 / PROJECT ROOM',
				tone: 'sun',
				layout: 'schedule',
				enabled: true
			}
		]
	};
	const venueInput = document.querySelector('#venue');
	const titleInput = document.querySelector('#collection-title');
	const deckInput = document.querySelector('#collection-deck');
	const storyList = document.querySelector('#stories');
	const storyTemplate = document.querySelector('#story-template');
	const emptyState = document.querySelector('#empty-state');
	const addButton = document.querySelector('#add-story');
	const saveButton = document.querySelector('#save');
	const resetButton = document.querySelector('#reset');
	const status = document.querySelector('#status');
	let configValues = {};
	let initialValue = cloneValue(DEFAULT_VALUE);
	let workingValue = cloneValue(DEFAULT_VALUE);
	let connected = false;
	let nextStoryNumber = 1;

	function cloneValue(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function stringValue(value, fallback = '') {
		return typeof value === 'string' ? value : fallback;
	}

	function toneValue(value) {
		return value === 'cobalt' || value === 'sun' || value === 'mint' ? value : 'coral';
	}

	function layoutValue(value) {
		return value === 'quote' || value === 'schedule' ? value : 'statement';
	}

	function normalizeValue(value) {
		const candidate = value && typeof value === 'object' ? value : {};
		const stories = Array.isArray(candidate.stories)
			? candidate.stories.map((story, index) => {
				const item = story && typeof story === 'object' ? story : {};

				return {
					id: stringValue(item.id, `story-${index + 1}`),
					label: stringValue(item.label, `STORY ${String(index + 1).padStart(2, '0')}`),
					title: stringValue(item.title),
					body: stringValue(item.body),
					detail: stringValue(item.detail),
					tone: toneValue(item.tone),
					layout: layoutValue(item.layout),
					enabled: item.enabled !== false
				};
			})
			: cloneValue(DEFAULT_VALUE.stories);

		return {
			venue: stringValue(candidate.venue, DEFAULT_VALUE.venue),
			title: stringValue(candidate.title, DEFAULT_VALUE.title),
			deck: stringValue(candidate.deck, DEFAULT_VALUE.deck),
			stories
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
		venueInput.disabled = !enabled;
		titleInput.disabled = !enabled;
		deckInput.disabled = !enabled;
		addButton.disabled = !enabled;
		saveButton.disabled = !enabled;
		resetButton.disabled = !enabled;
	}

	function createStory() {
		const id = `story-${Date.now()}-${nextStoryNumber}`;
		nextStoryNumber += 1;

		return {
			id,
			label: 'NEW SCENE',
			title: 'Untitled story',
			body: '',
			detail: '',
			tone: 'mint',
			layout: 'statement',
			enabled: true
		};
	}

	function moveStory(index, offset) {
		const nextIndex = index + offset;

		if (nextIndex < 0 || nextIndex >= workingValue.stories.length) return;
		const story = workingValue.stories.splice(index, 1)[0];
		workingValue.stories.splice(nextIndex, 0, story);
		render();
		updateStatus();
	}

	function deleteStory(index) {
		const story = workingValue.stories[index];

		if (!story || !window.confirm(`Delete "${story.title || 'Untitled story'}"?`)) return;
		workingValue.stories.splice(index, 1);
		render();
		updateStatus();
	}

	function bindStory(article, story, index) {
		const position = article.querySelector('.story-position');
		const summary = article.querySelector('.story-summary');
		const swatch = article.querySelector('.tone-swatch');
		const label = article.querySelector('[data-field="label"]');
		const title = article.querySelector('[data-field="title"]');
		const body = article.querySelector('[data-field="body"]');
		const detail = article.querySelector('[data-field="detail"]');
		const layout = article.querySelector('[data-field="layout"]');
		const tone = article.querySelector('[data-field="tone"]');
		const enabled = article.querySelector('[data-field="enabled"]');
		const upButton = article.querySelector('[data-action="move-up"]');
		const downButton = article.querySelector('[data-action="move-down"]');

		article.dataset.storyId = story.id;
		position.textContent = `Scene ${index + 1}`;
		summary.textContent = story.title || 'Untitled story';
		swatch.dataset.tone = story.tone;
		label.value = story.label;
		title.value = story.title;
		body.value = story.body;
		detail.value = story.detail;
		layout.value = story.layout;
		tone.value = story.tone;
		enabled.checked = story.enabled;
		upButton.disabled = index === 0;
		downButton.disabled = index === workingValue.stories.length - 1;

		label.addEventListener('input', () => {
			story.label = label.value;
			updateStatus();
		});
		title.addEventListener('input', () => {
			story.title = title.value;
			summary.textContent = title.value || 'Untitled story';
			updateStatus();
		});
		body.addEventListener('input', () => {
			story.body = body.value;
			updateStatus();
		});
		detail.addEventListener('input', () => {
			story.detail = detail.value;
			updateStatus();
		});
		layout.addEventListener('change', () => {
			story.layout = layout.value;
			updateStatus();
		});
		tone.addEventListener('change', () => {
			story.tone = tone.value;
			swatch.dataset.tone = tone.value;
			updateStatus();
		});
		enabled.addEventListener('change', () => {
			story.enabled = enabled.checked;
			updateStatus();
		});
		upButton.addEventListener('click', () => moveStory(index, -1));
		downButton.addEventListener('click', () => moveStory(index, 1));
		article.querySelector('[data-action="delete"]').addEventListener('click', () => deleteStory(index));
	}

	function render() {
		venueInput.value = workingValue.venue;
		titleInput.value = workingValue.title;
		deckInput.value = workingValue.deck;
		storyList.replaceChildren();

		for (let index = 0; index < workingValue.stories.length; index += 1) {
			const fragment = storyTemplate.content.cloneNode(true);
			const article = fragment.querySelector('.story-card');
			bindStory(article, workingValue.stories[index], index);
			storyList.append(fragment);
		}

		emptyState.hidden = workingValue.stories.length > 0;
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
		initialValue = cloneValue(normalized);
		workingValue = cloneValue(normalized);
		render();
		setStatus('Saving in Wallboard...', 'saving');
	}

	window.addEventListener('message', (event) => {
		if (event.source !== window.parent) return;
		const incomingConfigValues = receivedConfigValues(event.data);

		if (!incomingConfigValues) return;
		configValues = { ...incomingConfigValues };
		initialValue = normalizeValue(configValues[PROPERTY_NAME]);
		workingValue = cloneValue(initialValue);
		connected = true;
		setControlsEnabled(true);
		render();
		updateStatus();
	});

	venueInput.addEventListener('input', () => {
		workingValue.venue = venueInput.value;
		updateStatus();
	});
	titleInput.addEventListener('input', () => {
		workingValue.title = titleInput.value;
		updateStatus();
	});
	deckInput.addEventListener('input', () => {
		workingValue.deck = deckInput.value;
		updateStatus();
	});
	addButton.addEventListener('click', () => {
		workingValue.stories.push(createStory());
		render();
		updateStatus();
		storyList.lastElementChild?.querySelector('[data-field="title"]')?.focus();
	});
	resetButton.addEventListener('click', () => {
		workingValue = cloneValue(initialValue);
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
