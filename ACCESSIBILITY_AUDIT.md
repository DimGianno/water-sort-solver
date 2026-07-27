# WCAG 2.2 Accessibility Audit

## Audit Summary

- **Audit date:** 2026-07-27
- **Audited commit:** `7a42747a9a8f67b85f73b1342c2854fd593fa1e5`
- **Target:** Focused WCAG 2.2 Level AA review
- **Environment:** Windows, local Vite server, Chromium accessibility tree, Playwright 1.62.0
- **Viewports:** 1440x900 desktop and 412x915 mobile, with existing Pixel 7 and iPhone 13 Playwright profiles exercised by the regression suite
- **Themes:** Light and dark
- **Flows:** Configuration, layer-first building, validation, solving, cancellation semantics, import/export, and replay

This was a focused audit of color contrast, screen-reader semantics and announcements, reduced motion, and color-independent puzzle identification. It is not a complete WCAG conformance evaluation. Browser accessibility-tree output and live-region state changes were inspected, but spoken output was not verified with NVDA or another real assistive technology. A manual assistive-technology pass remains required before claiming screen-reader conformance.

No application code, tests, public interfaces, or dependencies were changed as part of this audit.

## Results Matrix

| Area                                      | Result             | Highest severity | Summary                                                                                                                                                        |
| ----------------------------------------- | ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Color contrast                            | Fail               | High             | Dark-theme primary controls and validation messages, faint labels, and focus indicators miss WCAG thresholds.                                                  |
| Screen-reader semantics and announcements | Fail               | High             | Palette focus is lost after selection, automatic layer advancement is silent, and replay changes lack usable state descriptions.                               |
| Reduced motion                            | Pass with advisory | Low              | CSS transitions and smooth scrolling are removed under reduced motion; replay remains user-started and pausable.                                               |
| Color-independent puzzle identification   | Fail               | High             | Bottle layers and replay segments use solid color alone; mobile palette names are hidden.                                                                      |
| Keyboard/focus sanity check               | Fail               | High             | Selecting a palette color removes the focused button and sends focus to the document body. This was a focused regression check, not a complete keyboard audit. |

## Prioritized Findings

### A11Y-001: Puzzle identity depends on color alone

- **Severity:** High
- **WCAG:** 1.4.1 Use of Color (Level A); related 1.3.3 Sensory Characteristics
- **Affected workflow:** Builder palette, filled builder bottles, and replay
- **User impact:** People with color-vision deficiencies or monochrome displays cannot reliably distinguish puzzle pieces. At the mobile breakpoint, palette names disappear and only a swatch plus remaining count is visible.
- **Evidence:** Filled `.layer` buttons have color names in `aria-label` but no visible text, pattern, symbol, or shape. `.rseg` replay segments have only a background color: no text, accessible name, or role. Mobile CSS hides `.palette-name`. In grayscale luminance analysis, Dark Green/Brown differed by only 0.0046, Pink/Blue by 0.0064, and Purple/Brown by 0.0111. The same behavior was reproduced in the four-bottle builder and solved 14-bottle replay at desktop and mobile sizes.
- **Recommended fix:** Assign each puzzle color a stable secondary identifier, such as a distinct pattern plus short visible label or symbol, and use it consistently in palette swatches, builder layers, move descriptions, and replay segments. Keep full color names in accessible names. Do not rely on contrast between colors as the only alternative.
- **Regression test:** Assert that every selected color renders a non-color identifier in the palette, builder, and replay; add monochrome visual baselines and confirm identifiers remain distinguishable when all swatches are rendered in grayscale.

### A11Y-002: Focus indicators do not meet non-text contrast

- **Severity:** High
- **WCAG:** 1.4.11 Non-text Contrast (Level AA)
- **Affected workflow:** All keyboard-operated controls
- **User impact:** Keyboard users with low vision may not be able to locate the focused control, especially against card and page backgrounds.
- **Evidence:** The shared focus outline mixes the accent with 65% transparency. Against representative page backgrounds, the computed composite contrast was approximately 1.62:1 in light mode and 1.83:1 in dark mode, below the required 3:1. The active theme button exposed the same computed solid three-pixel outline in both themes, and the result was reproduced at desktop and mobile sizes.
- **Recommended fix:** Use an opaque, theme-specific focus token that reaches at least 3:1 against every adjacent background. Where one color cannot meet both the control and surrounding background, use a two-color focus treatment such as an inner and outer ring.
- **Regression test:** Programmatically focus representative buttons, inputs, checkboxes, radios, selects, range controls, links, and layer buttons in both themes; calculate focus-indicator contrast against adjacent pixels and require at least 3:1.

### A11Y-003: Several text colors fail minimum contrast

- **Severity:** High
- **WCAG:** 1.4.3 Contrast (Minimum) (Level AA)
- **Affected workflow:** Configuration, validation, solve controls, and completion feedback
- **User impact:** Small labels, errors, success feedback, and primary actions can be difficult or impossible to read for users with low vision.
- **Evidence:** Repeated computed-style measurements produced these failures for normal-size text:

  | Element/state                       | Theme | Measured ratio | Required |
  | ----------------------------------- | ----- | -------------: | -------: |
  | Primary button white text on accent | Dark  |         2.85:1 |    4.5:1 |
  | Validation error `#b00020`          | Dark  |         2.33:1 |    4.5:1 |
  | Validation success `#0a7a22`        | Dark  |         3.11:1 |    4.5:1 |
  | General success token               | Dark  |         3.34:1 |    4.5:1 |
  | Faint configuration labels          | Light |         2.79:1 |    4.5:1 |
  | Faint configuration labels          | Dark  |         4.26:1 |    4.5:1 |

- **Recommended fix:** Replace fixed inline validation colors with theme tokens, darken the dark-theme primary-button background or use dark text on the current accent, and strengthen faint text tokens. Validate every semantic foreground/background pair in both themes.
- **Regression test:** Add a theme-token contrast test covering text, error, success, primary action, disabled-state exemptions, and all small metadata labels. Require 4.5:1 unless the rendered text qualifies as large text.

### A11Y-004: Palette selection destroys keyboard focus

- **Severity:** High
- **WCAG:** 2.4.3 Focus Order (Level A); related 3.2.2 On Input
- **Affected workflow:** Layer-first and color-first puzzle entry
- **User impact:** After choosing a color, keyboard and screen-reader users lose their current position and must navigate from the beginning of the document to continue entering the puzzle.
- **Evidence:** `renderPalette()` clears and recreates the palette after each selection. After activating `Red, 4 remaining`, `document.activeElement` was `BODY`. The remaining button was recreated as `Red, 3 remaining`; no focus target was restored. Source inspection confirms the palette container is cleared before every render.
- **Recommended fix:** Preserve palette button nodes where possible, or explicitly restore focus to the updated color button or a predictable next control. Ensure exhausted colors move focus to an announced fallback without resetting document navigation.
- **Regression test:** Activate palette colors using keyboard input in both fill modes, assert focus remains within the palette workflow after every placement, and verify a deterministic fallback when a color reaches zero remaining.

### A11Y-005: Automatic layer and replay changes are not announced

- **Severity:** Medium
- **WCAG:** 4.1.3 Status Messages (Level AA); related 4.1.2 Name, Role, Value
- **Affected workflow:** Layer-first automatic advancement and replay controls
- **User impact:** Screen-reader users are not told which layer will receive the next color or what changed after Previous, Next, or Play. They can read the separate move list, but the replay controls themselves provide no meaningful state feedback.
- **Evidence:** After a palette selection, `.layer.selected` moved from Bottle 1 layer 1 to layer 2, but the selected button had no `aria-current`, `aria-pressed`, or equivalent state, and `#paletteTitle` was not live. In replay, `#stepLabel` changed from Step 0/47 to Step 1/47 without a role or live property. Replay bottles and segments exposed only bottle numbers and visible `from`/`to` text; segment colors and contents were absent from the accessibility tree.
- **Recommended fix:** Expose the active builder target with a programmatic state and a concise live instruction. Give replay a dedicated, atomic status that announces step number and move, and provide each replay bottle with an accessible content summary without announcing the entire board on every tick.
- **Regression test:** Capture accessibility-tree and live-region changes after one layer-first placement, one color-first placement, Previous, Next, Play, Pause, and completion. Assert exactly one concise contextual update per action.

### A11Y-006: Export and solve can produce duplicate or excessive announcements

- **Severity:** Medium advisory
- **WCAG:** Related to 4.1.3 Status Messages; no focused conformance failure assigned because the messages are programmatically determinable
- **Affected workflow:** Export and solve completion
- **User impact:** Assistive-technology users may hear duplicate export confirmations and an excessively long solution announcement that competes with the concise solved status.
- **Evidence:** One Export action updated both polite `#ioMsg` ("Export copied to clipboard.") and polite status `#toast` ("Puzzle copied to clipboard"). Sample solve updated multiple live regions and placed all 47 moves into polite `#output` while `#success` separately announced the solved summary.
- **Recommended fix:** Use one confirmation channel for export. Keep the solved summary live, but make the full move list non-live or announce only that the list is available.
- **Regression test:** Observe live-region mutations during export and solve. Require one export confirmation and one concise solve-completion announcement; verify the complete move list remains navigable without being automatically spoken in full.

### A11Y-007: Import disclosure does not expose expanded state

- **Severity:** Medium
- **WCAG:** 4.1.2 Name, Role, Value (Level A)
- **Affected workflow:** Importing a saved puzzle
- **User impact:** Screen-reader users receive the polite instruction but cannot query whether the import section is open or what region the trigger controls.
- **Evidence:** Opening Import revealed `#ioArea` and updated `#ioMsg` to "Paste code and press Apply." The trigger retained focus but had neither `aria-expanded` nor `aria-controls`; the revealed container had no region name.
- **Recommended fix:** Add `aria-expanded` and `aria-controls` to the trigger, and give the controlled section a programmatic name. Keep focus on the trigger or move it to the textarea according to one documented, tested interaction model.
- **Regression test:** Toggle the import section and assert the trigger's expanded state, relationship, accessible region name, focus destination, and close behavior.

### A11Y-008: Reset leaves a stale replay step label

- **Severity:** Low
- **WCAG:** Advisory consistency issue; related to 4.1.2 Name, Role, Value
- **Affected workflow:** Reset after stepping through a solution
- **User impact:** The interface can show and expose a previous `Step 1/47` label while simultaneously stating that replay is unavailable, creating contradictory state.
- **Evidence:** After advancing to Step 1/47 and selecting Reset, the replay content was hidden and the placeholder returned, but `#stepLabel` remained `Step 1/47`. The mismatch was visible in the DOM and accessibility snapshot.
- **Recommended fix:** Reset the visible step label to `Step 0/0` whenever replay state is cleared.
- **Regression test:** Solve, advance one step, reset, and assert the replay placeholder, cleared solution state, and `Step 0/0` label agree.

## Passing and Advisory Checks

### Reduced motion

- Normal mode reported `prefers-reduced-motion: reduce` as false and used the documented short theme/control transitions and smooth replay reveal.
- The reduced-motion media block sets `scroll-behavior: auto` and removes transitions for elements and pseudo-elements.
- Solver reveal logic independently reads `prefers-reduced-motion` and changes `scrollIntoView` from `smooth` to `auto`.
- Existing Playwright projects run with reduced motion enabled; Chromium functional flows and all mobile WebKit flows exercised builder, solve, and replay without motion-related failures.
- Replay autoplay begins only after user activation, has a visible Pause control, and conveys the requested puzzle progression. WCAG 2.2 SC 2.3.3 is Level AAA, so this focused AA audit records the behavior as an advisory pass. A future preference to disable autoplay would still improve comfort.

### Existing semantic strengths

- Editable builder layers have descriptive accessible names containing bottle, layer, and color.
- Palette buttons expose color, remaining count, and pressed state.
- Validation, solver status, errors, success, and export feedback already use standard live-region or status semantics.
- Native controls provide names and states through labels, and no keyboard trap was observed during the focused sanity check.

## Standards References

- [Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/)
- [Understanding SC 1.4.1: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
- [Understanding SC 1.4.3: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)
- [Understanding SC 1.4.11: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast)
- [Understanding SC 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
- [Understanding SC 2.3.3: Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions)

## Verification Results and Limitations

| Command/check                           | Result                                                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                         | Passed; TypeScript no-emit check and Vite production build completed.                                                                                                                                                              |
| `npm test`                              | Passed; 24/24 Vitest tests.                                                                                                                                                                                                        |
| Focused desktop Chromium Playwright run | 8/9 passed; the workspace screenshot rendered 901px rather than the stored 902px baseline.                                                                                                                                         |
| Full Playwright run                     | 25/36 passed. Two Chromium screenshot checks drifted by 1–2px in height; all nine Firefox scenarios failed while creating a page in this local environment. Chromium functional flows and all nine mobile WebKit scenarios passed. |
| Browser accessibility-tree review       | Completed for initial, configured, solved, exported, imported, reset, and replay-step states.                                                                                                                                      |
| Contrast review                         | Computed-style and token measurements completed for both themes at desktop and mobile sizes.                                                                                                                                       |
| Color-independent review                | Completed from desktop/mobile renderings, DOM semantics, and grayscale luminance analysis.                                                                                                                                         |

The Playwright failures above were not caused by audit documentation changes and were not corrected or accepted by updating snapshots. Browser screenshots were inspected during the audit but are not committed as report assets. Cancellation behavior is covered by existing controller tests and exposes a polite solver status; a reliably long-running search was not available for manual speech-timing inspection. Real screen-reader speech order, interruption, and verbosity remain unverified until a manual NVDA pass is completed.

## Recommended Remediation Order

1. Add non-color puzzle identifiers across palette, builder, and replay.
2. Correct focus-indicator and theme text contrast.
3. Preserve focus during palette rerenders.
4. Add concise builder-target and replay-step semantics.
5. Consolidate live announcements and expose import disclosure state.
6. Clear stale replay labels and complete a manual NVDA verification pass.
