import { createContext, Show } from 'solid-js';
import type { JSX, Context } from 'solid-js';

import type { ApplicationState } from 'wallboard-app-sdk';

export const ApplicationContext: Context<ApplicationState | undefined> = createContext<ApplicationState>();

export function ApplicationProvider(props: {
	state: ApplicationState | undefined;
	children: JSX.Element;
}): JSX.Element {
	return (
		<>
			<Show when={props.state}>
				{/* eslint-disable-next-line solid/reactivity */}
				<ApplicationContext.Provider value={props.state}>
					{props.children}
				</ApplicationContext.Provider>
			</Show>
		</>
	);
}