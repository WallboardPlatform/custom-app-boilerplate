# Code Styling Guide

This document defines the coding conventions and style guidelines for the project.

## Path Aliases

Use path aliases for cleaner imports:
```
@contexts/* -> src/contexts/*
@services/* -> src/services/*
@components/* -> src/components/*
@interfaces/* -> src/interfaces/*
@hooks/* -> src/hooks/*
```

## General Code Style

- ESLint with TypeScript strict mode and SolidJS plugin, path for the config: `./eslint.config.mjs`
- **Avoid `any`**: Use `unknown` with type guards or proper typing
- Explicit return types required on all functions, including arrow functions
- Single quotes for strings, semicolons required
- Tab indentation: Tab size 4, Indent 4, Continuation 8
- Always use curly braces for block statements and loops

## Type-Only Imports

Always use `import type` for type-only imports to improve build performance:

```typescript
// CORRECT
import type { Accessor, JSX } from 'solid-js';
import type { Settings } from '@interfaces/application.interface';

// WRONG - importing types without 'type' keyword
import { Accessor, JSX } from 'solid-js';
```

## Naming Conventions

| Element            | Convention                             | Example                                   |
|--------------------|----------------------------------------|-------------------------------------------|
| Variables          | camelCase                              | `const userData`                          |
| Functions          | camelCase                              | `formatTitle()`                           |
| Constants          | camelCase or UPPER_SNAKE_CASE          | `const maxRetries` or `const MAX_RETRIES` |
| Interfaces         | PascalCase with `I` prefix (optional)  | `Settings`, `IApiService`                 |
| Types              | PascalCase                             | `DataSourceKey`                           |
| Classes            | PascalCase                             | `InterceptorService`                      |
| Components         | PascalCase with `Wb` prefix            | `WbLayoutBuilder`                         |
| Files (components) | kebab-case with `wb-` prefix           | `wb-layout-builder.tsx`                   |
| Files (hooks)      | camelCase with `use` prefix            | `useSettings.ts`                          |
| Files (services)   | kebab-case with `.service` suffix      | `example.service.ts`                      |
| Files (interfaces) | kebab-case with `.interface` suffix    | `example.interface.ts`                    |
| Files (contexts)   | kebab-case with `.context` suffix      | `application.context.tsx`                 |
| Context variable   | PascalCase with `Context` suffix       | `ApplicationContext`                      |
| Context provider   | PascalCase with `Provider` suffix      | `ApplicationProvider`                     |
| Files (SCSS)       | mirrors component name, `.module.scss` | `wb-app.module.scss`                      |
| SCSS root class    | kebab-case with `wb-` prefix           | `.wb-app`, `.wb-layout-builder`           |

## Type Annotations

### Variable Declarations

Always provide explicit type annotations for variables:

```typescript
// CORRECT
const metadata: MetadataProvider = getMetadata();
const logger: ILoggerService = createLogger(metadata, 'WbApp');
const settings: Accessor<Settings> = useSettings();

// WRONG - missing type annotations
const metadata = getMetadata();
const logger = createLogger(metadata, 'WbApp');
```

### Function Parameters and Return Types

Always specify parameter types and return types:

```typescript
// CORRECT
const formatTitle: (title: string) => string = (title: string): string => {
    return title.slice(0, 10);
};

// CORRECT - callback in lifecycle hooks
onMount((): void => {
    logger.info('Mounted');
});

// WRONG - missing return type
const formatTitle = (title: string) => {
    return title.slice(0, 10);
};
```

## JSDoc Documentation

Use JSDoc for hooks, services, and complex functions:

```typescript
/**
 * Hook to access the application settings.
 *
 * Returns a reactive accessor that provides access to the application's settings object.
 *
 * @returns {Accessor<Settings>} A SolidJS accessor that returns the settings object.
 *
 * @throws {Error} Throws an error if called outside an ApplicationProvider.
 *
 * @example
 * ```tsx
 * function ThemeSelector() {
 *   const settings = useSettings();
 *   return <div class={settings().theme}>{settings().theme}</div>;
 * }
 */
export function useSettings<T = Settings>(): Accessor<T> {
    // implementation
}
```

## Class Structure (Services)

Follow this pattern for service classes:

```typescript
export class ImageCacheService extends Service {
    // 1. Properties are ordered in: 1. private 2. protected 3. public
    private utils: UtilsService = useService(UtilsService);
    private imageUrl: string | undefined = undefined;
    public isImageReady: boolean = false;
		
    // 2. Class functions
	public setImageUrl(url: string): void {
		this.imageUrl = url;
		
		this.handleImageProcessing();
    }
		
    protected handleImageProcessing(): void {
		/* HANDLING LOGIC IMPLEMENTATION */
		this.isImageReady = true;
    }
		
    // 3. Lifecycle method overrides
    override onDestruct(): void {
		this.isImageReady = false;
		this.imageUrl = undefined;
    }
}
```

## Interface Definitions

```typescript
/* Use descriptive comments for interface sections */
export interface Config {
    configValues: ConfigValues;
    dataPickerValues: DataPickerValues;
    datasourceIds: Record<DataSourceKey, string | number | undefined>;
}

/* Generic interfaces with type parameters */
export interface DataSourceValue<T = unknown> {
    id?: string | null;
    value?: T;
}
```

## Error Handling

### Custom Error Classes

```typescript
class LifecycleNotImplementedError extends Error {
    constructor(serviceName: string, methodName: string) {
        super(`Service '${serviceName}' must implement ${methodName}() lifecycle hook.`);
        this.name = 'LifecycleNotImplementedError';
    }
}
```

### Try-Catch Patterns

```typescript
try {
    // operation
} catch (error) {
    const err: Error = error instanceof Error ? error : new Error(String(error));
    logger.error('Operation failed:', err);
}
```

## SolidJS Component Patterns

### Component Export Pattern

```typescript jsx
export default (props: {
    hostElement: HTMLDivElement;
}): JSX.Element => {
    /* Hooks */
    const metadata: MetadataProvider = getMetadata();

    /* Lifecycle */
    onMount((): void => {
        // initialization
    });

    /* Effects */
    createEffect((): void => {
        // reactive logic
    });

    /* Render */
    return (
        <div class={style['wb-app']}>
            {/* content */}
        </div>
    );
};
```

## Debug Logging

Use the standardized debug log format, always use the SDKs logger, if not already declared, declare it:

```typescript
logger.debug(`### descriptive text`, data);
```

## Forbidden Practices

1. Never use `any` - use `unknown` with type guards
2. Never omit curly braces from block statements
3. Never use inline styles for static styling - use SCSS modules
4. Never use `function` keyword inside components
5. Never use Date.now() for time measurement - use performance.now()
6. Never remove existing comments you didn't write