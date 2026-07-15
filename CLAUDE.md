# CLAUDE.md

# Project Context

Before starting any task, read and follow the rules in these files:
- `workflow.md`
- `architecture.md`
- `widget-best-practices.md`
- ALL FILES IN docs/system

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Custom app** - Custom apps are specialized Node.js modules uploaded to the server,
tailored for use within the Wallboard system. Each server has its own set of custom widgets,
which are frontend web applications that appear in the content editor, built with the `wallboard-app-sdk`.

**Work Modes** - These apps have two distinct work modes, inside the editor and inside the displayer

### Inside the editor 
Everything can change: every state and every setting

### Inside the displayer
The settings stay the same, only the internal states can change, like data sources, bound data and after external user interaction,
the internal values, like selections made. 

**Instances** - Multiple instances of the same custom app can be placed in a single page. Meaning the custom apps
should operate in a enclosed containerized environment, so that no instance could interfere with the inner states
of the other instances.

## **CRITICAL: Never touch index.tsx**
This is the outermost layer of the project visible to the outside, which means it has to work as the outside needs it to.
The whole structure of the file has been already tested and verified, there is no need for further changes to it.

## **CRITICAL: Browser Compatibility All code must be Chromium 56+ compatible**
The project has to be compatible with the minimum Chromium version of 56, this means that any feature,
that is new, both in HTML or CSS cannot be used within the project, to ensure this requirement.
Before using anything new, refer to its documentation and check if it's available in the required Chromium 
version.

This doesn't affect any TypeScript code, because it gets compile back to ES6, so only HTML and CSS have to
be considered.

## Technology stack

- **TypeScript 5.9** - Primary language
- **SolidJS 1.9** - Reactive UI library with fine-grained reactivity and no virtual DOM
- **Vite 7.1** - Fast build tool and development server with HMR support
- **SASS 1.87** - CSS preprocessor for modular styling with SCSS syntax
- **RxJS 7.8** - Reactive programming library for handling async data streams
- **TSyringe 4.10** - Lightweight dependency injection container for TypeScript
- **Wallboard App SDK 2.0.x** - SDK for building custom Wallboard widgets
- **Chart.js 4.5** - Default charting library for common KPI, line, bar, doughnut, and gauge-like visuals
- **ESLint 9.26** - Linting tool for code quality and consistency
- **Prettier 3.5** - Code formatter for consistent code style
- **Webpack 5.99** - Module bundler for legacy Chrome builds

## Key Commands

### Initial setup
```bash
npm run setup
```
Runs SDK setup, then installs dependencies from public npm and anonymous Wallboard Nexus.

### SDK setup only
```bash
npm run setup:sdk
```
Updates `wallboard-app-sdk` to an anonymous Nexus tarball URL. Run this before `npm install` if dependencies are not installed yet.

### Builds

#### Development build
```bash
npm run build:development
```

#### Development build with zip output
```bash
npm run build:development:zip
```

#### Production build
```bash
npm run build:production
```

#### Production build with zip output
```bash
npm run build:production:zip
```

#### Validated production package
```bash
npm run validate:package
```

Builds the zip and fails when a runtime asset is missing from `resourceList`, a cache-listed file is absent, or local media uses an unsafe runtime-relative URL.
It also rejects corrupt editor PNGs and CSS features outside the documented Chromium 56 compatibility contract.

### Linting

#### Lint check for problems
```bash
npm run lint
```

#### Auto Lint fix
```bash
npm run lint:fix
```

### Code formatting
```bash
npm run prettify
```

### Local visual preview
```bash
npm run dev:preview
npm run validate:visual
```

The interactive preview is available at `http://127.0.0.1:5173/preview/`. Keep `preview/fixture.ts` aligned with the app's settings and datasource values. Add named `previewScenarios` for materially different states; use `advanceTimeMs` to validate rotating or paginated end states.

### Datasource contract validation
```bash
npm run validate:examples
```

Before implementing a data-bound app, follow `docs/system/datasource-contracts.md`. Prefer an explicit user schema or a verified built-in Wallboard contract; otherwise generate a `TABLE` contract and its editable sample data.

Apps that intentionally consume multiple existing sources declare every picker in `datasource-contract.json.bindings`. Use one sanitized sample bundle and select each fixture with `source.samplePath`; do not combine independent live sources solely to fit a single-binding contract.

### Validated delivery
Before implementation, create `generation-brief.json` from the request and run `npm run validate:brief`. This validates the plan without requiring implementation artifacts. After implementation, run `npm run validate:project` to cross-check identity, datasource bindings, editor settings, preview states, behavior evidence, and assets. See `docs/system/generation-brief.md`.

```bash
npm run deliver -- <output-directory>
```

This is the final handoff command. It validates the app, creates the uploadable zip, preserves the generation brief, packages datasource templates when present, and writes a machine-readable delivery manifest. Follow `docs/system/app-identity-and-delivery.md`; internal app name plus version must be unique across Wallboard app records.

## Architecture Overview

### Directory Structure
```
./                      # Root folder
├── docs/                           # Folder containing all of the projects documentation
├── package-tools/                  # Tools used for building and compiling
├── src/                            # Project resource folder
│   ├── components/                 # Folder containing all of the components
│   │   ├── wb-app/
│   │   ├── wb-app.tsx              # Root component and entry point, this should always be here, do not remove/move it, minor internal changes can be made to it
│   │   ├── wb-app.module.scss
│   │   └── wb-table/                 # Example component, custom components should always have the `wb-` prefix, representing Wallboard 
│   │       ├── wb-table.tsx
│   │       ├── wb-table.module.scss
│   │       └── wb-cell-types/
│   │           ├── wb-number-cell.tsx
│   │           └── wb-text-cell.tsx
│   ├── contexts/                   # SolidJS Contexts
│   │   ├── application.context.tsx
│   │   ├── dependency-injection.context.tsx
│   │   └── interceptor.context.tsx
│   ├── editor-assets/              # Files for the Wallboard editor
│   │   ├── icon.png
│   │   ├── placeholder.png
│   │   └── properties.json
│   ├── hooks/                      # Custom hooks
│   │   ├── getApplicationState.ts
│   │   ├── getMetadata.ts
│   │   ├── useConfig.ts
│   │   ├── useDataSources.ts
│   │   ├── useExternalCommandListener.ts
│   │   ├── useInterceptor.ts
│   │   ├── useService.ts
│   │   └── useSettings.ts
│   ├── interfaces/                 # Apps Interfaces
│   │   └── application.interface.ts
│   ├── services/                   # Custom services
│   │   └── service.abstract.ts
│   ├── stores/                     # Reactive SolidJS store
│   ├── styles/                     # Global styling files
│   │   ├── _index.scss
│   │   ├── mixin.scss
│   │   ├── reset.scss
│   │   └── styles.scss
│   ├── animation.css
│   ├── index.css
│   ├── index.tsx
│   ├── services.ts
│   ├── settings.ts
│   └── vite-env.d.ts
```

## Development Guidelines

1. **Typescript** - New script files MUST be created in typescript instead of javascript
2. **Coding convention** - Always follow the Airbnb convention
3. **Styling Best Practices** - NEVER use inline CSS styles on DOM elements for static styles. Always locate and edit the component's SCSS file instead to maintain separation of concerns and consistency. The SCSS file has the same file name as the component, but .module.scss extension instead of .ts
4. **Code comments** - Only add NEW comments where absolutely necessary, always avoid redundancy. Never add line breaks mid-sentence in comments. Avoid multi-line comments.
5. **Don't remove comments that you did not write!!!!!** - This includes when replacing large blocks of code - existing comments must be preserved in the replacement.
6. **Emojis** - NEVER use emojis
7. **TODOs** - Only work on TODOs found in code if the user instructed so or approved it, otherwise ignore
8. **debug logs** - temporary logs for debugging purposes should be in the following format: ```console.debug(`### text`, data);```
9. **time measurement** - when measuring time differences between timestamp use performance.now() timestamps instead of Date.now() because on certain devices the current time through the Date object can change

## File Editing Best Practices
- **Development environment is on Windows** always use windows-compatible commands and tools
- **Use UTF-8 encoding** for all text files (.md, .js, .ts, .json, etc.)
- **Avoid special characters** no emojis, arrows or boxing characters

## Documentation References

### Claude-specific (`docs/claude/`)
- `workflow.md` - Development process and phases

### System documentation (`docs/system/`)
- `architecture.md` - Architecture concepts
- `app-identity-and-delivery.md` - Runtime identity, replacement rules, validated delivery bundle, and datasource template packaging
- `generation-brief.md` - Prompt-to-project contract, required evidence, and validation rules
- `code-styling.md` - Code styling guidelines
- `components.md` - Component creation and patterns
- `configuration.md` - Configuration options
- `datasource-contracts.md` - Data contract selection, table fallback, binding types, and generated datasource artifacts
- `contexts.md` - SolidJS contexts usage
- `hooks.md` - Custom hooks documentation
- `interfaces.md` - TypeScript interfaces
- `sdk-usage.md` - Wallboard App SDK usage
- `services.md` - Service layer documentation
- `solidjs-patterns.md` - SolidJS patterns and best practices
- `stores.md` - SolidJS stores usage
- `styling.md` - SCSS styling guidelines
- `widget-best-practices.md` - Production widget behavior, responsiveness, transparency, empty states, and performance
