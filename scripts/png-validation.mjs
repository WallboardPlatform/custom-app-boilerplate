import fs from 'node:fs';
import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
	let crc = value;

	for (let bit = 0; bit < 8; bit += 1) {
		crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
	}

	return crc >>> 0;
});

const crc32 = (data) => {
	let crc = 0xffffffff;

	for (const value of data) {
		crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
	}

	return (crc ^ 0xffffffff) >>> 0;
};

export const readPngDimensions = (filePath) => {
	const data = fs.readFileSync(filePath);

	if (
		data.length < 33
		|| !data.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)
		|| data.readUInt32BE(8) !== 13
		|| data.toString('ascii', 12, 16) !== 'IHDR'
	) {
		throw new Error('file is not a structurally valid PNG');
	}

	const width = data.readUInt32BE(16);
	const height = data.readUInt32BE(20);

	if (width === 0 || height === 0) {
		throw new Error('PNG width and height must be greater than zero');
	}

	let offset = 8;
	let hasImageData = false;
	let hasEnd = false;
	const imageDataChunks = [];

	while (offset + 12 <= data.length) {
		const chunkLength = data.readUInt32BE(offset);
		const chunkEnd = offset + 12 + chunkLength;

		if (chunkEnd > data.length) {
			throw new Error('PNG contains a truncated chunk');
		}

		const chunkType = data.toString('ascii', offset + 4, offset + 8);
		const chunkDataEnd = offset + 8 + chunkLength;
		const storedCrc = data.readUInt32BE(chunkDataEnd);
		const calculatedCrc = crc32(data.subarray(offset + 4, chunkDataEnd));

		if (storedCrc !== calculatedCrc) {
			throw new Error(`PNG ${chunkType} chunk failed its CRC check`);
		}

		if (chunkType === 'IDAT') {
			hasImageData = true;
			imageDataChunks.push(data.subarray(offset + 8, chunkDataEnd));
		}

		hasEnd = hasEnd || chunkType === 'IEND';
		offset = chunkEnd;

		if (chunkType === 'IEND') {
			break;
		}
	}

	if (!hasImageData || !hasEnd) {
		throw new Error('PNG must contain image data and an end chunk');
	}

	try {
		const inflatedImageData = inflateSync(Buffer.concat(imageDataChunks));

		if (inflatedImageData.length === 0) {
			throw new Error('image data is empty');
		}
	} catch (error) {
		throw new Error(`PNG image data could not be decompressed: ${error.message}`);
	}

	return { width, height };
};
