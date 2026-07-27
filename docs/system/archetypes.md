# Archetype standards

Recurring interactive elements have a conformance floor. The floor constrains **behaviour and capability, never appearance** — an app may render an archetype however its design calls for, and must still pass.

Each standard ships as a spec table plus an executable suite. The suite is authoritative; this page states the reasons.

| Level | Meaning |
|-------|---------|
| MUST | Conformance fails without it. |
| SHOULD | Default; deviating needs a written reason in the review. |
| MAY | Free. |

Rules come from defects observed in delivered apps, not from first principles. Add one when a defect recurs, not when it is imagined.

## On-screen keyboard

Suite: `preview/conformance/keyboard.ts`. Logic: `capabilities/keyboard`.

| Level | Rule | Why |
|-------|------|-----|
| MUST | Every control suppresses `pointerdown` **and** `mousedown` | Focus leaving the bound field hides the caret and stops physical typing. `pointerdown` covers touch and modern mice; `mousedown` covers the compatibility event legacy players emit. Guarding only the letter keys is the usual half-fix. |
| MUST | Pressing a key leaves DOM focus unmoved | The observable consequence of the rule above. |
| MUST | Every control is `type="button"` | Otherwise a keyboard inside a form submits it. |
| MUST | Every control has an accessible name | Keys are glyphs; without a name they are unreachable and untestable. |
| MUST | Space produces no leading or doubled space | A wide space bar double-taps under a finger. The query matches nothing and looks identical on screen. |
| MUST | `disabled` blocks every action, not only the styling | A disabled keyboard must not be drivable by a synthetic click. |
| SHOULD | Backspace removes one grapheme, not one code unit | `Array.from` rather than `slice(-1)`, so accented and non-Latin input is not corrupted. |
| SHOULD | Enforce maximum length in the shared helper | Per-call-site limits drift apart. |
| SHOULD | Display keys uppercase, emit lowercase | Uppercase reads at distance; the value stays matchable. |
| MAY | Layout, palette, placement, key shape, which optional controls exist | Appearance is the app's. |

### Opting in

Call the suite from the app's own spec with a descriptor:

```ts
registerKeyboardConformance({
  name: 'Destination search',
  open: async (page) => { /* navigate, open the keyboard */ },
  keyboard: (page) => page.getByRole('dialog', { name: 'Search destinations' }),
  letterKeyName: 'Key v',
  spaceKeyName: 'Space',
  focusTarget: (page) => page.getByRole('searchbox', { name: 'Search destinations' })
});
```

Apps that render their own keyboard instead of using the capability are held to the same bar by calling the same suite.
