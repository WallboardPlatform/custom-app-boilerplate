# Component

**CRITICAL** - It's not React, do not use React patterns. Use the SolidJS patterns.

**CRITICAL** - Do not try to use React styled elements, use the SolidJS equivalents.

**CRITICAL** - CSS must be Chromium 56+ compatible (CSS is NOT transpiled). TypeScript can use modern features (it gets transpiled). Refer to `CLAUDE.md` for more information

**CRITICAL** - Remember, each components name has to be prefixed with `wb-`, referring to Wallboard

## How to create a new component
1. Create a folder in the relevant `src/components` folder or the sub folder where the new component needs to be.
   The folders name has to be the same as the components.
   If it logically doesn't make much sense, for example the new component is only a small subcomponent for a
   larger one, then it can be placed next to the parent component.
2. Create and name the file to resemble what it does, or how it works, and give it the prefix of `wb-`. Note:
   the folder has to have the prefix as well.
   Refer to the File Naming section in this document.

### When to create a new component and subcomponent
**New component** - When its logically independent and implements a larger feature or look, and often can't be
reused elsewhere.
**Subcomponent** - To make the return statement more readable or to make a part reusable. They are usually
smaller logically dependent and often reusable components. If there is a list rendering, the HTML structure went
very deep (like 5-6 layers deep), or a part of the HTML structure repeats itself,
then consider creating a subcomponent for it.

Note: Subcomponents can be as large as a full-fledged component, if it logically makes sense for it.

## Component File Structure
```
Component
├── Imports
├── Component declaration
│   ├── SolidJS references
│   ├── SolidJS contexts
│   ├── Hooks
│   ├── Services
│   ├── Signals
│   ├── Variables
│   ├── SolidJS lifecycle functions
│   ├── Memos and effects
│   ├── Arrow functions
│   └── return statement
EOF
```

No local type definitions are allowed.
Refer to the `interfaces.md` documentation for more information.

Local constants are placed on the top of the Variables section.

More technical example:
```typescript jsx
// Imports
import { on, onMount, createEffect, createSignal, createMemo, useContext } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { useService } from '@hooks/useService';
import { useSettings } from '@hooks/useSettings';

import { ValueContext } from '@contexts/ValueContext';

import { UtilsService } from '@services/UtilsService';

import type { Settings, ComponentValue, ComponentProps } from '@interfaces/application.interface';

// Component declaration
export default (props: { componentProps: ComponentProps }): JSX.Element => {
   /* References (DOM element refs), declared with `let` and the definite assignment assertion (`!`), then attached using the `ref` directive */
   let rootRef!: HTMLDivElement;

   /* Contexts */
   const valueSIG: Accessor<ComponentValue> | undefined = useContext(ValueContext);

   /* Hooks */
   const settingsSIG: Accessor<Settings> = useSettings();

   /* Services */
   const utils: UtilsService = useService(UtilsService);

   /* Signals */
   const [countSIG, setCountSIG] = createSignal<number>(0);

   /* Variables (const variables go to the top) */
   const maxItems: number = 10;
   let initTimeout: NodeJS.Timeout | null = null;

   /* Lifecycle functions */
   onMount((): void => {
      foo();
   });

   /* Memos and create effects */
   createEffect(on(settingsSIG, (): void => {
      foo();
   }, { defer: true }));

   const barSIG = createMemo((): string => {
      return new Array(countSIG())
              .map((): string => 'bar')
              .join(', ');
   });

   /* Arrow functions */
   const foo = (value?: number): void => {
      setCountSIG(value ?? 0);
   };

   return <>
      <div ref={(el: HTMLDivElement): HTMLDivElement => rootRef = el}>
         {barSIG()}
      </div>
   </>;
};
```

## Props typing
The props have to be wrapped inside the `props` primary object. Anything
can be inside this wrapper object, but the JSX.Element has to be inside the
`children` key.

**Important** - Don't create interface for the props object.

Example:
```typescript jsx
// DON'T (breaks reactivity):
export default ({ value, children }: Props): JSX.Element => { /**/ };

// DO:
export default (props: { value: number, children: JSX.Element }): JSX.Element => {
	// Access via props.value, props.children
};
```

## Export component
Every component file contains only one singular default exported component:
``` typescript jsx
export default (props: {receivedState: State}): JSX.Element => {
    return <>
        <StateDisplay state={props.receivedState} />
    </>;
};
```

Note: Don't create named exports for components.

## Imports pattern
Check existing files for import patterns.
See also: `workflow.md` - Implementation Phase for import management guidelines.

The imports should adhere to the following order:
- SolidJS
- Hooks
- Stores
- Contexts
- wallboard-app-sdk
- External libraries
- Services
- Interfaces
- Components
- Images or other assets
- CSS stylesheets

Between every import type, there shall be an empty line between them.
Every import should end with a semicolon, no exceptions.
Every import should be wrapped in curly brackets, even if there is only one import.
There are only three exemptions to this rule:
- Stylesheets
- Components
- Assets

Components use default exports, so when importing them, do not use curly brackets:
```typescript jsx
// Importing a component (default export, no curly brackets)
import WbTable from '@components/wb-table/wb-table';

// Importing from solid-js (named exports, with curly brackets)
import { createSignal, For, Show } from 'solid-js';
```

Curly brackets shall always have a space before and after them.

An example of the bracket rules:
```typescript jsx
// DO:
// Normal import:
import { createEffect } from 'solid-js';

// Stylesheet import:
import style from '@components/wb-table/table.module.scss';
```

If importing a type or an interface, place it in a type import.
The type import shall be placed under the same file's normal import:
```typescript jsx
// DO:
import { FILE_TYPE_ENUM } from '@interfaces/application.interface';
import type { Settings } from '@interfaces/application.interface';

// DON'T:
import { FILE_TYPE_ENUM, Settings } from '@interfaces/application.interface';
```

Use the available aliases if they are available and if the imported item is not in the same directory:
```typescript jsx
//DO:
import { UtilsService } from '@services/utils.service';

//DON'T:
import { UtilsService } from './../services/utils.service.ts';
```

A full import example:
```typescript jsx
import { useContext, createEffect, createMemo, createSignal } from 'solid-js';
import type { Accessor, JSX } from 'solid-js';

import { getMetadata } from '@hooks/getMetadata';
import { useDataSources } from '@hooks/useDataSources';
import { useSettings } from '@hooks/useSettings';

import { tableDataStore } from '@stores/table-state-store';

import { ValueContext } from '@contexts/ValueContext';

import { CONTENT_TYPES, createLogger, MetadataProvider, useApiMethods } from 'wallboard-app-sdk';
import type { IApiService, ILoggerService } from 'wallboard-app-sdk';

import { UtilsService } from '@services/utils.service';

import type { Settings, TableBorderSettings } from '@interfaces/application.interface';
import { COLUMN_TYPE } from '@interfaces/table.interface';
import type { Table } from '@interfaces/table.interface';

import WbTableController from '@components/wb-value-multi/wb-table/wb-table-controller';

import style from './wb-table.module.scss';
```

## How to create functions inside the component
Do not use the function keyword, only arrow functions are allowed.
Every function needs to be inside the component, no outer functions are allowed.

**Exception:** In context files (`src/contexts/custom/`), pure helper functions that do not use any reactive state (signals, stores, accessors) can be defined outside the provider component. This keeps the provider clean and makes the helper functions easier to test.

```typescript jsx
// DO:
export default (): JSX.Element => {
    // Functions
    const foo = (): string => {
        return 'bar';
    };

    return <>
        {foo()}
    </>;
};

// DON'T:
function foo(): string {
    return 'bar';
}

export default (): JSX.Element => {
    return <>
        {foo()}
    </>;
};
```

### Event Handlers
Use arrow functions even for event handlers:
```typescript jsx
  const handleClick = (event: MouseEvent): void => {
    // handler logic
};
```

## Ordering inside the component
Each component element should be in this order:
- SolidJS references
- Contexts
- Hooks
- Services
- Signals
- Variables
- SolidJS Lifecycle functions
- SolidJS Memos and createEffects
- Arrow functions
- Return statement

If a function needs to be declared before its order, then it can be exempt to this rule.

## Component return statement

Each component has to return with the type `JSX.Element`.
The return statement is wrapped inside an empty tag (`<>` and `</>`, respectively), instead of brackets. Any
of the HTML structure has to be placed inside.

### SolidJS specific components and patterns
For further information refer to the `solidjs-patterns.md` documentation.

#### List rendering
Do not use the React style `.map()` function, use the SolidJS's
`<For each={/* LIST HERE */}> </For>` element.

#### Conditional rendering
Do not use the React style logical operator, use the SolidJS's `<Show when={} fallback={}></Show>`
and the `<Switch></Switch>` and `<Match when={}></Match>` elements.

Example of a full proper return statement:
```typescript jsx
  return <>
    <div class={`wb-table ${style['wb-table']}`}>
        <For each={rowsSIG()}>
            {(currentRow: TableRow): JSX.Element => {
                return <>
                    <TableRow row={currentRow} />
                </>;
            }}
        </For>
    </div>
</>;
```

#### Error boundaries
Do not use the SolidJS's Error Boundaries, because the whole project is already wrapped inside one,
in the `index.tsx` entry point file.
There is no need to handle local unintended errors, that are major. That's what the global Error Boundary is for,
but if it's an edge case, then it has to be handled locally with a try-catch block, if it logically makes sense,
like when doing an API request.

## Common Mistakes

### React Patterns to Avoid

#### Destructuring Props
```typescript jsx
// DON'T (breaks SolidJS reactivity):
export default ({ value, onChange }: Props): JSX.Element => {
    return <div>{value}</div>;
};

// DO (preserve reactivity through props object):
export default (props: Props): JSX.Element => {
    return <div>{props.value}</div>;
};
```

#### Using .map() for Lists
```typescript jsx
// DON'T (React pattern):
return <div>
    {items.map((item) => <span>{item.name}</span>)}
</div>;

// DO (SolidJS pattern):
return <div>
    <For each={items}>
        {(item): JSX.Element => <span>{item.name}</span>}
    </For>
</div>;
```

#### Using Ternary/Logical Operators for Conditional Rendering
```typescript jsx
// DON'T (React pattern):
return <div>
    {isVisible && <span>Visible</span>}
    {isLoading ? <Loading /> : <Content />}
</div>;

// DO (SolidJS pattern):
return <div>
    <Show when={isVisible}>
        <span>Visible</span>
    </Show>
    <Show when={isLoading} fallback={<Content />}>
        <Loading />
    </Show>
</div>;
```

#### Using useState
```typescript jsx
// DON'T (React hook):
const [count, setCount] = useState(0);

// DO (SolidJS signal):
const [countSIG, setCountSIG] = createSignal<number>(0);
```

#### Using useEffect
```typescript jsx
// DON'T (React hook):
useEffect(() => {
   logger.log('Value changed:', value);
}, [value]);

// DO (SolidJS effect with explicit tracking):
createEffect(
     on(
          (): Accessor<Table> => valueSIG,
          (settings: Accessor<Settings>): void => {
             logger.log('Value changed:', value());
          },
          { defer: true }
     )
);
```

### SolidJS-Specific Mistakes

#### Accessing Signals Without Calling Them
```typescript jsx
// DON'T (won't be reactive, just gets initial value):
const doubled = countSIG * 2;

// DO (call the signal to get reactive value):
const doubled = countSIG() * 2;

// DO (use createMemo for derived values):
const doubledSIG = createMemo((): number => countSIG() * 2);
```

#### Forgetting the SIG Suffix
```typescript jsx
// DON'T (unclear what is reactive):
const [count, setCount] = createSignal(0);
const value = useContext(ValueContext);
const doubled = createMemo(() => count() * 2);

// DO (clear reactive indicators):
const [countSIG, setCountSIG] = createSignal<number>(0);
const valueSIG = useContext(ValueContext);
const doubledSIG = createMemo((): number => countSIG() * 2);
```

#### Using classList Instead of className
```typescript jsx
// DON'T (React attribute):
<div className={style.wbcontainer}>

 // DO Examples (SolidJS/HTML attribute):
 <div class={`style.wbcontainer ${style['wb-container']}`}> // Root element

<div classList={{
   'row': settings().Table.orientation === 'vertical',
   'col': settings().Table.orientation === 'horizontal'
}}>
```

### General Mistakes

#### Declaring Functions Outside Components
```typescript jsx
// DON'T (function outside component scope):
const formatValue = (val: number): string => val.toFixed(2);

export default (): JSX.Element => {
    return <span>{formatValue(5)}</span>;
};

// DO (function inside component scope):
export default (): JSX.Element => {
    const formatValue = (val: number): string => val.toFixed(2);

    return <span>{formatValue(5)}</span>;
};
```

#### Using the function Keyword
```typescript jsx
// DON'T:
function handleClick(): void { /* ... */ }

// DO:
const handleClick = (): void => { /* ... */ };
```

#### Missing Type Annotations
```typescript jsx
// DON'T (implicit types):
const [count, setCount] = createSignal(0);
const handleClick = (e) => { /* ... */ };

// DO (explicit types):
const [countSIG, setCountSIG] = createSignal<number>(0);
const handleClick = (e: MouseEvent): void => { /* ... */ };
```

#### Omitting Curly Brackets
```typescript jsx
// DON'T:
if (condition) doSomething();
for (const item of items) process(item);

// DO:
if (condition) {
    doSomething();
}
for (const item of items) {
    process(item);
}
```

### Styling
For more information please refer to the `styling.md` documentation.