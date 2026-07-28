# Archetype standards and the mechanism registry

## Deciding whether something becomes an example

`examples/mechanisms.json` is a closed vocabulary of what an example may claim to teach, and
`example.json` declares each example's claims. An example must own at least one mechanism no
other example owns; `validate-example-mechanisms` enforces it.

Three outcomes, not two, when a delivered app arrives:

| Outcome | When |
|---------|------|
| **Add** | It teaches a mechanism the vocabulary lacks, or that no example claims. |
| **Replace** | It teaches a covered mechanism better. Point `referenceExample` at it; the incumbent keeps its slot for whatever else it owns. |
| **Harvest** | Its technique is worth taking and its content is not. Most delivered apps land here — they carry customer data and predate the current gates. |

Mechanisms with no example are reported, not failed. Naming a gap before filling it is the point:
the report is the portfolio backlog.



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

## Empty state

Suite: `preview/conformance/empty-state.ts`. Applies to any app whose datasource can return nothing — 17 of the 23 examples declare an empty scenario.

| Level | Rule | Why |
|-------|------|-----|
| MUST | An empty datasource renders visible text | `widget-best-practices.md` already forbids a blank widget. A blank signage surface is indistinguishable from a crashed player or a dead screen. |
| MUST | The app stays identifiable | Losing the masthead as well as the data makes the screen look broken rather than idle. |
| MUST | The message clears the `secondary` floor for the declared viewing distance | Empty-state copy is routinely left at metadata size, unreadable from the distance the rest of the app was designed for. |
| MUST | Content is not orphaned against the top edge | An empty state is still a composition. |
| SHOULD | The message is operator-configurable | 14 examples already expose an `emptyStateText` setting. |
| MAY | Wording, illustration, placement, whether an icon appears | Appearance is the app's. |

The `message` locator is required rather than inferred. An earlier version measured the largest text anywhere in the widget, which is always the app title, so the legibility assertion could never fail — a conformance test that cannot fail is worse than none.

## Status indicator

Suite: `preview/conformance/status-indicator.ts`. Applies wherever colour carries meaning — 13 examples tint by state.

| Level | Rule | Why |
|-------|------|-----|
| MUST | State is named in words, not only tinted | Colour alone excludes about one viewer in twelve, and survives none of the conditions signage runs in: sunlit panels, miscalibrated screens, a greyscale photo of the board in a report. |
| MUST | Distinct states read distinctly | Identical wording across states means the words are decoration and the colour is still doing the work. |
| MUST | State text clears 3:1 against **its own** background | A chip usually tints its own background, which is where contrast collapses even when the surrounding surface is fine. |
| SHOULD | Expose the state in a `data-` attribute | Makes the state assertable without reading colour. |
| MAY | Which hues mean what, glyphs, chip shape | Appearance is the app's. |

The `stateLabel` locator is required. An earlier version accepted any text anywhere in the indicator, so a row carrying a station name and a timestamp passed with its state label deleted — the same too-broad-scope flaw as the first empty-state legibility check.

## Paginated content

Suite: `preview/conformance/pagination.ts`. Seven examples page through more records than fit.

| Level | Rule | Why |
|-------|------|-----|
| MUST | Every record appears exactly once per cycle | The silent failure. A pager that drops a record shows a board that looks entirely correct; nobody watching can tell their flight is the one never scheduled into a page. |
| MUST | No page is empty while records exist | A blank page mid-rotation reads as a broken player. |
| MUST | A full cycle returns to the first page | Drift compounds until the rotation no longer covers the set. |
| MAY | Indicator style, transition, rows per page, balancing | Appearance is the app's. |

The suite needs the app to expose page index, page count and a stable per-record key, and to let a test step the rotation. Match the app's own rotation delay exactly when installing a controlled timer — a looser filter also captures the clock tick, and invoking that advances nothing.

## Promoting a review

`example:review:promote` refuses a workspace prepared from source the repository no longer holds. `validate:visual-review` only proves a workspace agrees with its own snapshot, so an experiment that re-prepares an example with a reverted change leaves a workspace that passes validation while carrying evidence for code that is gone. That happened twice while these standards were being written.
