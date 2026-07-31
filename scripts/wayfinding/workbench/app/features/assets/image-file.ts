export interface DecodedImageFile {
	dataUrl: string;
	height: number;
	mimeType: string;
	width: number;
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

export const readImageFile = async (file: File): Promise<DecodedImageFile> => {
	if (!file.type.startsWith('image/')) {
		throw new Error('Choose a PNG, JPEG, WebP, SVG, or another supported image file.');
	}

	if (file.size > MAX_IMAGE_BYTES) {
		throw new Error('The image is larger than 25 MB. Optimize it before adding it to the project.');
	}

	const dataUrl = await new Promise<string>((resolve, reject): void => {
		const reader = new FileReader();
		reader.onerror = (): void => reject(new Error('The selected image could not be read.'));
		reader.onload = (): void => {
			if (typeof reader.result === 'string') resolve(reader.result);
			else reject(new Error('The selected image did not produce a valid image source.'));
		};
		reader.readAsDataURL(file);
	});
	const image = new Image();
	image.src = dataUrl;
	await image.decode();

	if (!image.naturalWidth || !image.naturalHeight) {
		throw new Error('The selected file does not contain readable image dimensions.');
	}

	return {
		dataUrl,
		height: image.naturalHeight,
		mimeType: file.type,
		width: image.naturalWidth
	};
};
