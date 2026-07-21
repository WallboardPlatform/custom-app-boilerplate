import type { FloorId } from './application.interface';

export interface Destination {
	accessible: boolean | null;
	alternateName: string;
	category: string;
	description: string;
	floor: FloorId;
	hours: string;
	id: string;
	keywords: string;
	mapLabel: string;
	name: string;
	status: string;
}
