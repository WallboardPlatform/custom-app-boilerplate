export interface FixedCanvasFrame {
	designWidth: number;
	designHeight: number;
	renderedWidth: number;
	renderedHeight: number;
	offsetX: number;
	offsetY: number;
	scale: number;
}

const positiveDimension = (value: number): number => {
	return Number.isFinite(value) && value > 0 ? value : 1;
};

export const calculateFixedCanvasFrame = (
	containerWidth: number,
	containerHeight: number,
	designWidth: number,
	designHeight: number
): FixedCanvasFrame => {
	const safeContainerWidth: number = positiveDimension(containerWidth);
	const safeContainerHeight: number = positiveDimension(containerHeight);
	const safeDesignWidth: number = positiveDimension(designWidth);
	const safeDesignHeight: number = positiveDimension(designHeight);
	const scale: number = Math.min(
		safeContainerWidth / safeDesignWidth,
		safeContainerHeight / safeDesignHeight
	);
	const renderedWidth: number = safeDesignWidth * scale;
	const renderedHeight: number = safeDesignHeight * scale;

	return {
		designWidth: safeDesignWidth,
		designHeight: safeDesignHeight,
		renderedWidth,
		renderedHeight,
		offsetX: (safeContainerWidth - renderedWidth) / 2,
		offsetY: (safeContainerHeight - renderedHeight) / 2,
		scale
	};
};

export const fixedCanvasStyle = (frame: FixedCanvasFrame): Record<string, string> => ({
	height: `${frame.designHeight}px`,
	left: '50%',
	position: 'absolute',
	top: '50%',
	transform: `translate(-50%, -50%) scale(${frame.scale})`,
	'transform-origin': 'center center',
	width: `${frame.designWidth}px`
});
