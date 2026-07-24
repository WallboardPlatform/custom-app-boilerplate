export interface BuiltinMapIcon {
	dataUrl: string;
	id: string;
	label: string;
}

const icon = (id: string, label: string, body: string): BuiltinMapIcon => ({
	dataUrl: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#17201f" stroke-linecap="round" stroke-linejoin="round" stroke-width="4">${body}</g></svg>`)}`,
	id,
	label
});

export const BUILTIN_MAP_ICONS: BuiltinMapIcon[] = [
	icon('information', 'Information', '<circle cx="32" cy="32" r="26"/><path d="M32 29v18M32 18h.01"/>'),
	icon('restroom', 'Restroom', '<circle cx="20" cy="14" r="5"/><circle cx="44" cy="14" r="5"/><path d="M20 22v18m-9-10h18M14 58l6-18 6 18M44 22l-10 24h7v12m3-36 10 24h-7v12"/>'),
	icon('restroom-men', 'Men restroom', '<circle cx="32" cy="13" r="6"/><path d="M32 22v20m-12-12h24M24 59l8-17 8 17"/>'),
	icon('restroom-women', 'Women restroom', '<circle cx="32" cy="13" r="6"/><path d="M32 22 19 47h8v12m5-37 13 25h-8v12"/>'),
	icon('accessible', 'Accessible', '<circle cx="27" cy="12" r="5"/><path d="M27 20v16h14l8 17M27 27h14M25 32a16 16 0 1 0 17 18"/>'),
	icon('elevator', 'Elevator', '<rect x="12" y="8" width="40" height="48" rx="3"/><path d="M32 12v40M21 24l5-6 5 6M43 40l-5 6-5-6"/>'),
	icon('stairs', 'Stairs', '<path d="M8 52h12V40h12V28h12V16h12"/>'),
	icon('escalator', 'Escalator', '<circle cx="17" cy="13" r="4"/><path d="M18 20v15l8 8h12l13-22h7M7 53h34L58 25"/>'),
	icon('exit', 'Exit', '<path d="M29 9H12v46h17M36 20l12 12-12 12M20 32h28"/>'),
	icon('parking', 'Parking', '<rect x="11" y="7" width="42" height="50" rx="5"/><path d="M25 47V17h10a10 10 0 0 1 0 20H25"/>'),
	icon('food', 'Food', '<path d="M18 8v20M11 8v11c0 6 14 6 14 0V8M18 28v28M43 8v48M43 8c9 8 9 23 0 28"/>'),
	icon('cafe', 'Cafe', '<path d="M12 21h34v16a15 15 0 0 1-15 15h-4a15 15 0 0 1-15-15zM46 25h5a7 7 0 0 1 0 14h-5M18 10c0 5 4 5 4 10M31 10c0 5 4 5 4 10"/>'),
	icon('shopping', 'Shopping', '<path d="M12 23h40l-4 32H16zM23 25V17a9 9 0 0 1 18 0v8"/>'),
	icon('first-aid', 'First aid', '<rect x="8" y="15" width="48" height="38" rx="5"/><path d="M24 15v-5h16v5M32 25v18M23 34h18"/>'),
	icon('security', 'Security', '<path d="M32 7l21 8v14c0 14-9 23-21 28C20 52 11 43 11 29V15zM23 32l6 6 13-14"/>'),
	icon('bus', 'Bus', '<rect x="10" y="8" width="44" height="43" rx="7"/><path d="M16 17h32v17H16zM16 51v6M48 51v6M19 42h.01M45 42h.01"/>'),
	icon('train', 'Train', '<path d="M16 8h32a6 6 0 0 1 6 6v29a8 8 0 0 1-8 8H18a8 8 0 0 1-8-8V14a6 6 0 0 1 6-6zM15 16h34v19H15zM20 51l-7 7M44 51l7 7M21 43h.01M43 43h.01"/>'),
	icon('meeting', 'Meeting room', '<circle cx="20" cy="19" r="7"/><circle cx="44" cy="19" r="7"/><path d="M7 52c1-13 6-20 13-20s12 7 13 20M31 52c1-13 6-20 13-20s12 7 13 20"/>')
];
