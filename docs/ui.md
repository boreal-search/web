# UI rules

Build rules for screens. Values live in `src/app.css` (`@theme`); this file says how to use them.

## Colour

Use the theme roles, never literal colours. Tailwind's default palette is cleared, so
`text-red-500` and friends don't exist.

| Role          | Use                                                  |
| ------------- | ---------------------------------------------------- |
| `page`        | Page background                                      |
| `surface`     | Raised surfaces                                      |
| `ink`         | Text                                                 |
| `muted`       | Secondary text                                       |
| `rule`        | Hairline dividers only (1.2:1, never a control edge) |
| `edge`        | Input and control borders (3:1 or more)              |
| `accent`      | Links, the primary action, focus rings               |
| `on-accent`   | Text on `accent`                                     |
| `verified`    | Answer state: verified                               |
| `unsupported` | Answer state: unsupported                            |
| `highlight`   | Wash behind quoted passages                          |
| `danger`      | Destructive actions and system errors                |
| `sheet`       | Page renders: same in both themes, never inverted    |

- No red in search results or answer states. `danger` is for destructive actions and
  system errors elsewhere.
- Green (`verified`, `accent`) is never decorative.
- Light and dark follow `prefers-color-scheme` unless the user picks one on `/account`
  (`<html data-theme>`); every colour role is one `light-dark(light, dark)` value.

## Type

Three roles, and the role says whose words they are.

| Class        | Face              | For                                           |
| ------------ | ----------------- | --------------------------------------------- |
| `font-sans`  | Schibsted Grotesk | Headings, UI, summaries, queries (default)    |
| `font-serif` | Source Serif 4    | Quoted passages from documents only           |
| `font-mono`  | JetBrains Mono    | Locators, page numbers, times, counts, states |

Headings are upright, one colour: no italics, no coloured words. A quote always shows its
locator (`VOL 3 · §12.6 · P.412`), and a locator opens the PDF at that page.

## Answer states

`AnswerCheck` in `src/lib/answer.ts` is the one vocabulary for code and UI:
`verified`, `unsupported`, `not_checked`, `not_found`. Show each with the `.flag` class and
`data-state`, which pairs a shape, a label and a colour, so no state relies on colour alone.
"Not found in the pages searched" and "Not checked" are neutral, not errors.

## Results view

Query, then the generated summary (labelled as generated, each sentence cited) with one status
line and one readout, then the evidence: the selected page render large enough to read beside
the ranked results. Show rank only; engine scores are not confidence.
The large page opens on the first result the answer cites. Choosing `[n]` shows that result's
page with only that sentence's cited text outlined (`sheet-mark` wash multiplied on the paper,
a 1.5 px edge by check status: `sheet-mark-verified` / `-unsupported` / `-not-checked`, light
values in both themes); otherwise each page outlines everything the answer cites on it, and a
citation the engine couldn't place opens its page unmarked, its locator saying "page". Phones
have no side viewer: a `[n]` or a thumbnail opens the page full width under its row (Close or
Escape returns focus). Keys: J K next/previous, Space zoom page (`.sheet.zoomed`), O open PDF at
page, C copy citation (title · page · permanent PDF link).

## Waiting

No skeleton screens, spinners, shimmer or typing dots. Show nothing for the first ~300 ms,
then a thin bar and a seconds counter; label stages only when the engine reports them. On
completion the bar becomes the readout (pages used, pages searched, time).

## Components

Shared classes in `src/app.css` (listed at its top). Prefer these over one-off styles; page
layout beyond them uses Tailwind utilities from the theme.

- Layout: `.page-head` (h1, then a `.readout` line), `.band` (a `<section>` under a full-width
  rule; bands, not boxes), `.actions` (button row). The shell is in `+layout.svelte`.
- Text: `.muted`, `.readout` (mono readings, `<b>` = value), `.loc` (locator; `a.loc` opens the
  PDF), `.source` (serif, document words only, always with a `.loc`), `.empty`.
- Forms: `form.stack`, `.field` (label, control, `.help`, `.field-error` linked by
  `aria-describedby`, `aria-invalid` on the control), `.check` (checkbox row), `fieldset`/`legend`.
- Buttons: `<button>` is secondary; `.primary` (one per form), `.quiet` (text), `.danger`
  (destructive only); `a.button` for a link shaped like a button.
- Notices: `.notice` with `role="status"`; `data-tone="error"` with `role="alert"` (never in
  search: engine problems there are plain notices); `data-tone="partial"` for done-with-a-caveat.
  Engine and system failures render `FailureNotice` (`#lib/components/FailureNotice.svelte`)
  with the `Failure` itself: copy from `describeFailure`, neutral for engine failures, never red.
- Tables: hairline `table` by default; `.table-wrap` to scroll sideways on phones, or
  `table.stacked` with `data-label` on each `td`; `.num` for right-aligned figures.
- States: `.flag[data-state]` (see Answer states). Waiting: `.waiting` > `.progress`
  (`style:--value` 0–1) + `.readout` seconds counter. Pages: `.sheet` (dims in dark, `.zoomed`
  is full brightness).
- A11y: `.sr-only` hides text visually but keeps it for screen readers.

## Copy

Short, plain, specific. Boreal never says "I". No exclamation marks or emoji. Label generated
text as generated. Prefer find, cite, check, export; avoid unlock, supercharge, insights,
assistant, copilot. Canadian English, sentence-case headings.

## Accessibility

A default, not a gate: visible focus, sensible focus order, focus targets for citation links,
non-colour cues for every state, comfortable hit areas, mono text no smaller than ~13 px.
