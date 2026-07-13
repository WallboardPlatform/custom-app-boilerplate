# Styling

Custom apps run inside the Wallboard system alongside many other components.
Strict styling isolation is required to prevent style leakage and ensure consistent rendering.

## CRITICAL: Styles Folder and Read only file

**Files in `src/styles/`:**
- `_index.scss` - Forwards all style modules
- `mixin.scss` - Core mixins (`reset-styles`, `box-sizing`, `user-select`, etc.)
- `reset.scss` - Global reset for `html.ca` scope
- `styles.scss` - Additional global styles (if present)

---

This folder contains mixins and resets that are tightly coupled with the build system.

The `src/styles/reset.scss` file contains **foundational infrastructure** and must NEVER be:
- Modified
- Files added
- Files removed
- Files renamed

## File Structure Overview

```
src/
  index.css              # Entry point - imports animation.css
  animation.css          # All @keyframes definitions (EDITABLE)
  styles/                # Core styles (DO NOT MODIFY)
    _index.scss
    mixin.scss
    reset.scss
  components/
    wb-component/
      wb-component.tsx
      wb-component.module.scss   # Component-specific styles
```

---

## CSS Modules Pattern

**ALL COMPONENTS USE CSS MODULES (.module.scss)**

Every component must have its own `.module.scss` file with the same base name as the component.

### Component Class Naming Convention

**Every component's outermost element MUST have dual class naming:**

```typescript jsx
import style from './wb-component.module.scss';

export default (): JSX.Element => {
  return (
    <div class={`wb-component ${style['wb-component']}`}>
      {/* content */}
    </div>
  );
};
```

**Why both classes?**

| Class                      | Purpose                                                                  |
|----------------------------|--------------------------------------------------------------------------|
| `wb-component`             | Plain string for external targeting, debugging, parent component styling |
| `${style['wb-component']}` | CSS Module scoped class for isolation                                    |

---

## SCSS File Structure Pattern

Every `.module.scss` file must follow this structure:

```scss
/** utf-8:  o */

/* <editor-fold desc="Component Name"> ------------------------------ */

.wb-component-name {
  @include reset-styles();  // ALWAYS FIRST LINE - resets inherited styles
  width: 100%;
  height: 100%;
  display: block;
}

:global(.wb-component-name) > * {
  @include box-sizing();
}

:global(.wb-component-name) > * * {
  @include box-sizing();
}

// Child components targeted by their plain class name
:global(.wb-component-name) > .wb-child-component {
  // styles for child
}

// State classes
:global(.wb-component-name.is-active) {
  // active state styles
}

:global(.wb-component-name.is-loading) {
  // loading state styles
}

/* </editor-fold desc="Component Name"> ----------------------------- */
```

### Key Points

1. **`@include reset-styles()`** - Always first line inside the component class. Resets all inherited styles using `all: initial` and applies `box-sizing: border-box`.

2. **`:global(.plain-class)`** - Use explicit global selectors for child elements and state classes. Without this, CSS Modules would hash plain class selectors.

3. **`@include box-sizing()`** - Apply to all children to ensure consistent box model.

4. **Editor fold comments** - Use `/* <editor-fold desc="..."> */` for code organization.

5. **UTF-8 marker** - First line `/** utf-8:  o */` ensures proper encoding.

---

## Targeting Child Components

Use `:global` to target child components by their plain class name:

```scss
.wb-parent {
  @include reset-styles();
}

:global(.wb-parent) > .wb-child {
  // Direct child with plain class
  width: 50%;
}

:global(.wb-parent) .wb-nested-child {
  // Any descendant with plain class
  color: red;
}

:global(.wb-parent) > .wb-content-renderer {
  order: 1;
}

:global(.wb-parent) > .wb-image-renderer {
  order: 2;
}
```

---

## State Classes with classList

Use SolidJS `classList` for conditional state classes:

```typescript jsx
<div
  class={`wb-component ${style['wb-component']}`}
  classList={{
    'is-active': isActiveSIG(),
    'is-loading': isLoadingSIG(),
    'image-below': settings()?.imagePosition === 'below',
    'image-above': settings()?.imagePosition === 'above'
  }}
>
```

```scss
.wb-component {
  @include reset-styles();
}

:global(.wb-component.is-active) {
  border: 2px solid green;
}

:global(.wb-component.is-loading) {
  opacity: 0.5;
}

:global(.wb-component.image-below) {
  flex-direction: column;

  > .wb-content { order: 1; }
  > .wb-image { order: 2; }
}

:global(.wb-component.image-above) {
  flex-direction: column;

  > .wb-content { order: 2; }
  > .wb-image { order: 1; }
}
```

---

## Dynamic CSS Variables

Use CSS custom properties for values that come from settings or reactive state.

### Naming Convention

**Prefix:** `--ca-[project-shorthand]-[property-name]`

| Project      | Shorthand   | Example Variable      |
|--------------|-------------|-----------------------|
| Readerboard  | `rb`        | `--ca-rb-page-width`  |
| Meeting Room | `mr`        | `--ca-mr-cell-height` |
| Directory    | `dir`       | `--ca-dir-gap-size`   |
| Value        | `val`       | `--ca-val-font-size`  |

### Usage Pattern

**Component (TSX):**
```typescript jsx
<div
  class={`wb-layout ${style['wb-layout']}`}
  style={{
    '--ca-dir-cell-width': cellWidthSIG(),
    '--ca-dir-cell-height': cellHeightSIG(),
    '--ca-dir-gap-vertical': `${settings()?.Table.gap.vertical}px`,
    '--ca-dir-gap-horizontal': `${settings()?.Table.gap.horizontal}px`,
    '--ca-dir-border-color': settings()?.Developer.cellBorderColor
  }}
>
```

**Styles (SCSS):**
```scss
.wb-layout {
  @include reset-styles();
}

:global(.wb-layout) {
  gap: var(--ca-dir-gap-vertical) var(--ca-dir-gap-horizontal);
}

:global(.wb-layout) > .cell {
  width: var(--ca-dir-cell-width);
  height: var(--ca-dir-cell-height);
  border-color: var(--ca-dir-border-color);
}
```

---

## Animations

### Where to Define Animations

**All `@keyframes` must be defined in `src/animation.css`**

Do NOT define keyframes in:
- Component `.module.scss` files
- `src/styles/animations.scss` (this file exists but does not work due to build issues right now) 

### Animation Naming Convention

**Prefix animations with project shorthand:** `wb-[project]-[animation-name]`

```css
/** utf-8:  o */

/* <editor-fold desc="Animation"> ----------------------------------- */

@keyframes wb-mr-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes wb-mr-fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes wb-mr-slide-in-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes wb-mr-slide-out-right {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}

/* </editor-fold desc="Animation"> ---------------------------------- */
```

### Using Animations in Components

Reference animations by name in your `.module.scss`:

```scss
.wb-component {
  @include reset-styles();
}

:global(.wb-component.entering) {
  animation: wb-mr-fade-in 0.3s ease-out forwards;
}

:global(.wb-component.exiting) {
  animation: wb-mr-fade-out 0.3s ease-in forwards;
}
```

---

## Available Mixins

These mixins are available from `src/styles/mixin.scss` (automatically imported):

### reset-styles()

Resets all inherited styles. **Always use as first line in component class.**

```scss
@mixin reset-styles() {
  all: initial;
  @include box-sizing;
}
```

### box-sizing()

Applies consistent box-sizing with vendor prefixes:

```scss
@mixin box-sizing() {
  -webkit-box-sizing: border-box;
  -moz-box-sizing: border-box;
  box-sizing: border-box;
}
```

### user-select($userSelect)

Controls text selection with vendor prefixes:

```scss
.no-select {
  @include user-select(none);
}
```

### placeholder

Styles input placeholders across browsers:

```scss
input {
  @include placeholder {
    color: gray;
    font-style: italic;
  }
}
```

---

## Inline Styles - When to Use

**Prefer CSS variables and SCSS over inline styles.**

Use inline styles ONLY for:
- Truly dynamic values that change frequently (e.g., position during drag)
- Values directly from user settings that have no CSS variable equivalent
- One-off styles that don't warrant a class

```typescript jsx
// ACCEPTABLE - dynamic positioning
<div style={{ transform: `translateX(${positionSIG()}px)` }}>

// ACCEPTABLE - direct from settings, no class equivalent
<p style={{
  'font-family': settings()?.font.family,
  'font-size': `${settings()?.font.size}px`,
  color: settings()?.font.color
}}>

// PREFER CSS VARIABLES instead of inline styles for repeated patterns (place the variable to the outer parent div for access)
<div style={{ '--ca-mr-font-color': settings()?.font.color }}>
```

---

## Creating a New Component's Styles

1. **Create the SCSS file** alongside the component:
   ```
   src/components/wb-new-component/
     wb-new-component.tsx
     wb-new-component.module.scss
   ```

2. **Follow the structure pattern:**
   ```scss
   /** utf-8:  o */

   /* <editor-fold desc="New Component"> ----------------------------- */

     .wb-new-component {
       @include reset-styles();
       width: 100%;
       height: 100%;
     }

     :global(.wb-new-component) > * {
       @include box-sizing();
     }

     :global(.wb-new-component) > * * {
       @include box-sizing();
     }

     :global(.wb-new-component) > .wb-child {
       // styles here
     }

   /* </editor-fold desc="New Component"> ---------------------------- */
   ```

3. **Import in component:**
   ```typescript
   import style from './wb-new-component.module.scss';
   ```

4. **Use dual class naming:**
   ```typescript jsx
   <div class={`wb-new-component ${style['wb-new-component']}`}>
   ```
