# Code Style

`eslint.config.mjs`, TypeScript strict mode, and nearby source are authoritative. Run `npm run lint`; do not manually reproduce every lint rule.

## Required

- TypeScript for app code; no explicit `any`. Use `unknown` plus type guards.
- Explicit function return types; type-only imports use `import type`.
- Single quotes, semicolons, tabs, and braces for control blocks.
- Use path aliases outside the current directory: `@components`, `@contexts`, `@hooks`, `@interfaces`, `@services`, `@utils`.
- Static styling belongs in SCSS modules. Inline style objects are for CSS variables or genuinely reactive values.
- Comments explain non-obvious constraints only. Preserve existing comments and do not work unrelated TODOs.
- Use the SDK logger; temporary debug messages start with `###`.
- Measure elapsed time with `performance.now()` because device clock time can change.

## Naming

| Item | Pattern | Example |
|------|---------|---------|
| Component file/class | `wb-*.tsx`, `Wb*` | `wb-status-row.tsx`, `WbStatusRow` |
| Component SCSS/root | matching `.module.scss`, `.wb-*` | `wb-status-row.module.scss` |
| Hook | `use*.ts` under `hooks/custom` | `useRotation.ts` |
| Service | `*.service.ts`, PascalCase class | `agenda.service.ts` |
| Interface/model | descriptive PascalCase | `AgendaItem` |
| Reactive accessor/memo | `SIG` suffix when ambiguity matters | `pageSIG` |
| Context/provider | `*Context`, `*Provider` | `AgendaContext` |

## Imports

Group SolidJS, system hooks/contexts, SDK/external packages, services/interfaces/components, assets, then styles. Separate type imports from runtime imports.

```tsx
import { createMemo } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useSettings } from '@hooks/system/useSettings';
import type { Settings } from '@interfaces/application.interface';

import style from './wb-panel.module.scss';
```

Catch unknown errors safely:

```ts
try {
	await operation();
} catch (error) {
	const cause: Error = error instanceof Error ? error : new Error(String(error));
	logger.error('Operation failed', cause);
}
```
