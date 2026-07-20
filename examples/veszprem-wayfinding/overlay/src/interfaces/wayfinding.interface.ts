export interface Destination {
	id: string;
	name: string;
	englishName: string;
	category: string;
	description: string;
	accessible: boolean;
	routeable: boolean;
}

export interface RoutePoint {
	id: string;
	x: number;
	y: number;
	endPoint: boolean;
}

export interface RouteResult {
	distancePixels: number;
	pointIds: string[];
	walkingSeconds: number;
	walkingDistance: number;
}
