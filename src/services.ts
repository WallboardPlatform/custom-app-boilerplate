// Import all service classes here...

/**
 * Constructor type for dependency injection
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T = any> = new (...args: any[]) => T;

/**
 * Registry of all service classes that should be automatically registered as singletons
 * Add every new services to this array when you create them, so it will be containerized
 */
const serviceClasses: Constructor[] = [
	// Add services here...
];

export default serviceClasses;
