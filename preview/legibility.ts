export type ViewingDistance = 'near' | 'room' | 'distance';
export type TextRole = 'primary' | 'secondary' | 'metadata';

export const FONT_FLOORS: Record<ViewingDistance, Record<TextRole, number>> = {
	near: { primary: 18, secondary: 14, metadata: 11 },
	room: { primary: 28, secondary: 20, metadata: 14 },
	distance: { primary: 40, secondary: 28, metadata: 18 }
};

export const fontFloor = (distance: ViewingDistance, role: TextRole): number => FONT_FLOORS[distance][role];
