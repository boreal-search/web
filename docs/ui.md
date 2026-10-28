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
- Light and dark follow `prefers-color-scheme`; both are defined for every role.

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

## Waiting

No skeleton screens, spinners, shimmer or typing dots. Show nothing for the first ~300 ms,
then a thin bar and a seconds counter; label stages only when the engine reports them. On
completion the bar becomes the readout (pages used, pages searched, time).

## Copy

Short, plain, specific. Boreal never says "I". No exclamation marks or emoji. Label generated
text as generated. Prefer find, cite, check, export; avoid unlock, supercharge, insights,
assistant, copilot. Canadian English, sentence-case headings.

## Accessibility

A default, not a gate: visible focus, sensible focus order, focus targets for citation links,
non-colour cues for every state, comfortable hit areas, mono text no smaller than ~13 px.
