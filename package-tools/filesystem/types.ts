export interface CopyOptions {
	transformFileName?: (fileName: string) => string;
	filter?: (filePath: string) => boolean;
}