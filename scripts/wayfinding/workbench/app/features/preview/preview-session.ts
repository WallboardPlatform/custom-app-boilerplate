import {
	createSignal,
	type Accessor
} from 'solid-js';

import type { VisitorRouteProfile } from '../routing';

export interface PreviewDiagnosticLayers {
	routeNetwork: boolean;
}

export interface PreviewSession {
	category: string;
	destinationId?: string;
	diagnosticLayers: PreviewDiagnosticLayers;
	floorId: string;
	language: string;
	originId?: string;
	profile: VisitorRouteProfile;
	query: string;
	simulationOpen: boolean;
}

export interface PreviewSessionController {
	reset: (language: string) => void;
	setCategory: (category: string) => void;
	setDestinationId: (destinationId: string | undefined) => void;
	setDiagnosticLayer: (layer: keyof PreviewDiagnosticLayers, visible: boolean) => void;
	setFloorId: (floorId: string) => void;
	setLanguage: (language: string) => void;
	setOriginId: (originId: string | undefined) => void;
	setProfile: (profile: VisitorRouteProfile) => void;
	setQuery: (query: string) => void;
	setSimulationOpen: (open: boolean) => void;
	state: Accessor<PreviewSession>;
}

const initialSession = (language: string): PreviewSession => ({
	category: '',
	diagnosticLayers: {
		routeNetwork: false
	},
	floorId: '',
	language,
	profile: 'standard',
	query: '',
	simulationOpen: false
});

export const createPreviewSession = (language: string): PreviewSessionController => {
	const [state, setState] = createSignal<PreviewSession>(initialSession(language));
	const patch = (value: Partial<PreviewSession>): void => {
		setState((current) => Object.entries(value).every(
			([key, next]) => Object.is(current[key as keyof PreviewSession], next)
		)
			? current
			: { ...current, ...value });
	};

	return {
		reset: (nextLanguage): void => {
			setState(initialSession(nextLanguage));
		},
		setCategory: (category): void => patch({ category }),
		setDestinationId: (destinationId): void => patch({ destinationId }),
		setDiagnosticLayer: (layer, visible): void => {
			setState((current) => current.diagnosticLayers[layer] === visible
				? current
				: {
					...current,
					diagnosticLayers: {
						...current.diagnosticLayers,
						[layer]: visible
					}
				});
		},
		setFloorId: (floorId): void => patch({ floorId }),
		setLanguage: (nextLanguage): void => patch({ language: nextLanguage }),
		setOriginId: (originId): void => patch({ originId }),
		setProfile: (profile): void => patch({ profile }),
		setQuery: (query): void => patch({ query }),
		setSimulationOpen: (simulationOpen): void => patch({ simulationOpen }),
		state
	};
};
