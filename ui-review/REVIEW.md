# UI review — PadalaPocket

## Scope and method

Source: `/home/tyrone-teemer/Desktop/PadalaPocket`. Screenshot source: `/home/tyrone-teemer/Downloads/PadalaPocket` (deployed example accounts). Review directory is repository-relative `ui-review/`, as resolved from the placeholder paths in the request. Originals were opened read-only and remain unchanged.

Phase 1 is complete:241 directory files accounted for;238 PNGs individually opened and visually inspected;17 screens,34 screen/viewport sections; Unreviewed: none. Full list: [FILES.md](FILES.md). Grouped states, dimensions and source mapping: [INVENTORY.md](INVENTORY.md); machine-readable evidence: [inventory.json](inventory.json). Screenshots are distinct captures, not238 distinct pages.

Assessment A: independent visual review; Assessment B: source/contrast review. Primary reviewer opened every screenshot before critique. Screenshot-only dimensions are estimates; exact source values and calculated contrast are explicitly identified. No hover-only, keyboard-open phone or live awaiting-parent purchase was captured. Several “settled” files still show loading/unloaded content. Full-scroll composites can show fixed navigation in the middle. These are evidence limits, not automatically implementation defects.

### Accessibility evidence

Measured CSS contrast: input border #bcc2b7/white1.82:1; muted #59616d/white6.26:1; primary #21655f/white6.79:1; error #842c28/#fff1ef8.04:1. No text contrast failure is established by these pairs. Input boundary is a likely AA concern where needed to identify the control. Small font size alone is not a contrast failure. Existing44px clickable labels/buttons exceed AA’s24px minimum;44px is the practical phone target used here. Native popup hit targets are browser-controlled.

Sources: [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

## Phase 2 — Screen critique

### Parent Activity — Desktop

Screenshot filenames:

- `Desktop/parent/035-activity-viewport.png`
- `Desktop/parent/036-activity-full-page.png`
- `Desktop/parent/037-activity-photo-1.png`
- `Desktop/parent/038-activity-photo-2.png`
- `Desktop/parent/039-activity-photo-3.png`
- `Desktop/parent/040-activity-photo-4.png`
- `Desktop/parent/041-activity-photo-5.png`
- `Desktop/parent/042-activity-photo-6.png`
- `Desktop/parent/043-activity-photo-7.png`
- `Desktop/parent/044-activity-photo-8.png`
- `Desktop/parent/045-activity-photo-9.png`
- `Desktop/parent/046-activity-photo-10.png`
- `Desktop/parent/extra-activity-network-error.png`
- `Desktop/parent/extra-activity-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Item photos can be inspected in a modal; refresh errors retain prior history.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M4 | Medium | **Activity/approval rows** — The 88px photo plus gap leaves an estimated 200px-wide mobile detail column. Rules, dates and hashes wrap repeatedly; metadata also looks small. | At ≤480px put a 72px photo above full-width details; set detail paragraphs to14px/1.5 with8px vertical margins, retain headings16px and disclosure targets min-height44px. Keep desktop side-by-side rows. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Loading/retry photo states are represented. Readable status text distinguishes blocked/rejected/paid without relying on color. No pending decision is fabricated.

### Parent Activity — Mobile

Screenshot filenames:

- `Mobile/parent/027-activity-viewport.png`
- `Mobile/parent/028-activity-full-page.png`
- `Mobile/parent/029-activity-photo-1.png`
- `Mobile/parent/030-activity-photo-2.png`
- `Mobile/parent/031-activity-photo-3.png`
- `Mobile/parent/032-activity-photo-4.png`
- `Mobile/parent/033-activity-photo-5.png`
- `Mobile/parent/034-activity-photo-6.png`
- `Mobile/parent/035-activity-photo-7.png`
- `Mobile/parent/036-activity-photo-8.png`
- `Mobile/parent/037-activity-photo-9.png`
- `Mobile/parent/038-activity-photo-10.png`
- `Mobile/parent/extra-activity-network-error.png`
- `Mobile/parent/extra-activity-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Item photos can be inspected in a modal; refresh errors retain prior history.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| M4 | Medium | **Activity/approval rows** — The 88px photo plus gap leaves an estimated 200px-wide mobile detail column. Rules, dates and hashes wrap repeatedly; metadata also looks small. | At ≤480px put a 72px photo above full-width details; set detail paragraphs to14px/1.5 with8px vertical margins, retain headings16px and disclosure targets min-height44px. Keep desktop side-by-side rows. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Loading/retry photo states are represented. Readable status text distinguishes blocked/rejected/paid without relying on color. No pending decision is fabricated.

### Parent Allowance rules — Desktop

Screenshot filenames:

- `Desktop/parent/019-allowance-rules-viewport.png`
- `Desktop/parent/020-allowance-rules-full-page.png`
- `Desktop/parent/extra-allowance-rules-settled.png`
- `Desktop/parent/extra-rules-group-1-all-checked-unsaved.png`
- `Desktop/parent/extra-rules-group-1-all-unchecked-unsaved.png`
- `Desktop/parent/extra-rules-group-2-all-checked-unsaved.png`
- `Desktop/parent/extra-rules-group-2-all-unchecked-unsaved.png`
- `Desktop/parent/extra-rules-local-validation-error.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Needs and Wants have separate labelled groups; entire category labels are clickable.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| M5 | Medium | **Allowed-category form** — Desktop shows two successive, very long category lists despite available width; phone category labels/examples are dense. | Add a rules-form class; at ≥1000px place Needs/Wants fieldsets side by side. Keep numeric fields and validation full width and phone fieldsets stacked. Names14px, examples13px/1.5, row padding8px0, clickable label min-height44px. |
| M6 | Medium | **Rules validation location** — The validation message is below30 category choices, far from the invalid amount at the top. | Move the existing validation node immediately after the three numeric fields and before the category fieldsets. Preserve text, conditions and submit handler. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Checked/unchecked/invalid drafts are visible. Checkbox squares are18px in source, but clickable labels are already44px high; do not report a false24px target failure.

### Parent Allowance rules — Mobile

Screenshot filenames:

- `Mobile/parent/011-allowance-rules-viewport.png`
- `Mobile/parent/012-allowance-rules-full-page.png`
- `Mobile/parent/extra-allowance-rules-settled.png`
- `Mobile/parent/extra-rules-group-1-all-checked-unsaved.png`
- `Mobile/parent/extra-rules-group-1-all-unchecked-unsaved.png`
- `Mobile/parent/extra-rules-group-2-all-checked-unsaved.png`
- `Mobile/parent/extra-rules-group-2-all-unchecked-unsaved.png`
- `Mobile/parent/extra-rules-local-validation-error.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Needs and Wants have separate labelled groups; entire category labels are clickable.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| M5 | Medium | **Allowed-category form** — Desktop shows two successive, very long category lists despite available width; phone category labels/examples are dense. | Add a rules-form class; at ≥1000px place Needs/Wants fieldsets side by side. Keep numeric fields and validation full width and phone fieldsets stacked. Names14px, examples13px/1.5, row padding8px0, clickable label min-height44px. |
| M6 | Medium | **Rules validation location** — The validation message is below30 category choices, far from the invalid amount at the top. | Move the existing validation node immediately after the three numeric fields and before the category fieldsets. Preserve text, conditions and submit handler. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Checked/unchecked/invalid drafts are visible. Checkbox squares are18px in source, but clickable labels are already44px high; do not report a false24px target failure.

### Parent Approvals — Desktop

Screenshot filenames:

- `Desktop/parent/021-approvals-viewport.png`
- `Desktop/parent/022-approvals-full-page.png`
- `Desktop/parent/023-approvals-transaction-evidence-expanded-1.png`
- `Desktop/parent/024-approvals-transaction-evidence-expanded-2.png`
- `Desktop/parent/025-approvals-transaction-evidence-expanded-3.png`
- `Desktop/parent/026-approvals-transaction-evidence-expanded-4.png`
- `Desktop/parent/027-approvals-transaction-evidence-expanded-5.png`
- `Desktop/parent/028-approvals-transaction-evidence-expanded-6.png`
- `Desktop/parent/029-approvals-photo-1.png`
- `Desktop/parent/030-approvals-photo-2.png`
- `Desktop/parent/031-approvals-photo-3.png`
- `Desktop/parent/032-approvals-photo-4.png`
- `Desktop/parent/033-approvals-photo-5.png`
- `Desktop/parent/034-approvals-photo-6.png`
- `Desktop/parent/extra-approvals-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Item photo and parent decision history are retained; paid and rejected labels are explicit.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M4 | Medium | **Activity/approval rows** — The 88px photo plus gap leaves an estimated 200px-wide mobile detail column. Rules, dates and hashes wrap repeatedly; metadata also looks small. | At ≤480px put a 72px photo above full-width details; set detail paragraphs to14px/1.5 with8px vertical margins, retain headings16px and disclosure targets min-height44px. Keep desktop side-by-side rows. |
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Photo dialogs have a readable44px close action and useful phone gutters; no extra photo-modal defect is supported. Expanded rejected evidence can be empty; backend behavior is outside scope.

### Parent Approvals — Mobile

Screenshot filenames:

- `Mobile/parent/013-approvals-viewport.png`
- `Mobile/parent/014-approvals-full-page.png`
- `Mobile/parent/015-approvals-transaction-evidence-expanded-1.png`
- `Mobile/parent/016-approvals-transaction-evidence-expanded-2.png`
- `Mobile/parent/017-approvals-transaction-evidence-expanded-3.png`
- `Mobile/parent/018-approvals-transaction-evidence-expanded-4.png`
- `Mobile/parent/019-approvals-transaction-evidence-expanded-5.png`
- `Mobile/parent/020-approvals-transaction-evidence-expanded-6.png`
- `Mobile/parent/021-approvals-photo-1.png`
- `Mobile/parent/022-approvals-photo-2.png`
- `Mobile/parent/023-approvals-photo-3.png`
- `Mobile/parent/024-approvals-photo-4.png`
- `Mobile/parent/025-approvals-photo-5.png`
- `Mobile/parent/026-approvals-photo-6.png`
- `Mobile/parent/extra-approvals-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Item photo and parent decision history are retained; paid and rejected labels are explicit.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| M4 | Medium | **Activity/approval rows** — The 88px photo plus gap leaves an estimated 200px-wide mobile detail column. Rules, dates and hashes wrap repeatedly; metadata also looks small. | At ≤480px put a 72px photo above full-width details; set detail paragraphs to14px/1.5 with8px vertical margins, retain headings16px and disclosure targets min-height44px. Keep desktop side-by-side rows. |
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Photo dialogs have a readable44px close action and useful phone gutters; no extra photo-modal defect is supported. Expanded rejected evidence can be empty; backend behavior is outside scope.

### Parent Deposit — Desktop

Screenshot filenames:

- `Desktop/parent/049-deposit-viewport.png`
- `Desktop/parent/050-deposit-full-page.png`
- `Desktop/parent/extra-deposit-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Paid and configuration-required states are explicit; receiving wallet wraps on phones.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |
| L2 | Low | **Velo history grouping** — Paid and configuration-required entries have little separation, making it harder to tell which message belongs to which amount. | Give .live-activity-item entries16px padding, a1px existing divider-color border,12px radius and16px separation. Preserve both status messages. |

State/responsiveness notes: The red configuration message is legible. Its technical copy is preserved under the copy-meaning constraint.

### Parent Deposit — Mobile

Screenshot filenames:

- `Mobile/parent/041-deposit-viewport.png`
- `Mobile/parent/042-deposit-full-page.png`
- `Mobile/parent/extra-deposit-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Paid and configuration-required states are explicit; receiving wallet wraps on phones.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |
| L2 | Low | **Velo history grouping** — Paid and configuration-required entries have little separation, making it harder to tell which message belongs to which amount. | Give .live-activity-item entries16px padding, a1px existing divider-color border,12px radius and16px separation. Preserve both status messages. |

State/responsiveness notes: The red configuration message is legible. Its technical copy is preserved under the copy-meaning constraint.

### Parent Overview — Desktop

Screenshot filenames:

- `Desktop/parent/008-overview-viewport.png`
- `Desktop/parent/009-overview-full-page.png`
- `Desktop/parent/010-overview-allocation-history-4-expanded-1.png`
- `Desktop/parent/011-overview-select-1-sunday.png`
- `Desktop/parent/012-overview-select-1-monday.png`
- `Desktop/parent/013-overview-select-1-tuesday.png`
- `Desktop/parent/014-overview-select-1-wednesday.png`
- `Desktop/parent/015-overview-select-1-thursday.png`
- `Desktop/parent/016-overview-select-1-friday.png`
- `Desktop/parent/017-overview-select-1-saturday.png`
- `Desktop/parent/018-overview-select-1-opened.png`
- `Desktop/parent/extra-overview-settled.png`
- `Desktop/parent/extra-weekly-day-friday.png`
- `Desktop/parent/extra-weekly-day-monday.png`
- `Desktop/parent/extra-weekly-day-saturday.png`
- `Desktop/parent/extra-weekly-day-sunday.png`
- `Desktop/parent/extra-weekly-day-thursday.png`
- `Desktop/parent/extra-weekly-day-tuesday.png`
- `Desktop/parent/extra-weekly-day-wednesday.png`
- `Desktop/parent-overview-1440x900.png`

Source: `apps/web/src/views/live-layout.js`, `apps/web/src/views/weekly.js`, `apps/web/src/views/render.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Needs/Wants colors and amounts are easy to distinguish; funding history is expandable.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M3 | Medium | **Dashboard action alignment** — The outlined action sits lower than the filled action in both balance dashboards; the pair reads as unrelated controls. | Set margin-top:0 on buttons inside .live-actions and align-items:stretch. Apply only to Overview/Home actions. |
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Loading weekly/activity text is present in several captures. Day-selection filenames sometimes show only the dashboard top; see inventory limits.

### Parent Overview — Mobile

Screenshot filenames:

- `Mobile/parent/008-overview-viewport.png`
- `Mobile/parent/009-overview-full-page.png`
- `Mobile/parent/010-overview-allocation-history-4-expanded-1.png`
- `Mobile/parent/extra-overview-settled.png`
- `Mobile/parent/extra-weekly-day-friday.png`
- `Mobile/parent/extra-weekly-day-monday.png`
- `Mobile/parent/extra-weekly-day-saturday.png`
- `Mobile/parent/extra-weekly-day-sunday.png`
- `Mobile/parent/extra-weekly-day-thursday.png`
- `Mobile/parent/extra-weekly-day-tuesday.png`
- `Mobile/parent/extra-weekly-day-wednesday.png`

Source: `apps/web/src/views/live-layout.js`, `apps/web/src/views/weekly.js`, `apps/web/src/views/render.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Needs/Wants colors and amounts are easy to distinguish; funding history is expandable.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| M3 | Medium | **Dashboard action alignment** — The outlined action sits lower than the filled action in both balance dashboards; the pair reads as unrelated controls. | Set margin-top:0 on buttons inside .live-actions and align-items:stretch. Apply only to Overview/Home actions. |
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Loading weekly/activity text is present in several captures. Day-selection filenames sometimes show only the dashboard top; see inventory limits.

### Parent Savings — Desktop

Screenshot filenames:

- `Desktop/parent/047-savings-viewport.png`
- `Desktop/parent/048-savings-full-page.png`
- `Desktop/parent/extra-savings-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Balance qualifiers and Needs-to-Savings explanation are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M7 | Medium | **Weekly balance hierarchy** — The Savings/My Money amount uses ordinary body styling and competes with explanatory text; the primary fact is difficult to scan. | Give the existing amount paragraph a dedicated class with24px, weight650, line-height1.4, tabular numerals and12px vertical spacing. Keep simulated PHP and Testnet XLM qualifiers visible. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Sparse content reflects the currently available balance/refresh function; do not invent saving goals or releases to fill space.

### Parent Savings — Mobile

Screenshot filenames:

- `Mobile/parent/039-savings-viewport.png`
- `Mobile/parent/040-savings-full-page.png`
- `Mobile/parent/extra-savings-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Balance qualifiers and Needs-to-Savings explanation are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| M7 | Medium | **Weekly balance hierarchy** — The Savings/My Money amount uses ordinary body styling and competes with explanatory text; the primary fact is difficult to scan. | Give the existing amount paragraph a dedicated class with24px, weight650, line-height1.4, tabular numerals and12px vertical spacing. Keep simulated PHP and Testnet XLM qualifiers visible. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Sparse content reflects the currently available balance/refresh function; do not invent saving goals or releases to fill space.

### Parent Withdrawal — Desktop

Screenshot filenames:

- `Desktop/parent/051-withdrawal-viewport.png`
- `Desktop/parent/052-withdrawal-full-page.png`
- `Desktop/parent/extra-withdrawal-settled.png`

Source: `apps/web/src/views/live-layout.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Unavailable state is honest and offers a return action.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |

State/responsiveness notes: No withdrawal form exists in this collection; adding one would be a feature and is excluded.

### Parent Withdrawal — Mobile

Screenshot filenames:

- `Mobile/parent/043-withdrawal-viewport.png`
- `Mobile/parent/044-withdrawal-full-page.png`
- `Mobile/parent/extra-withdrawal-settled.png`

Source: `apps/web/src/views/live-layout.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Unavailable state is honest and offers a return action.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |

State/responsiveness notes: No withdrawal form exists in this collection; adding one would be a feature and is excluded.

### Shared connection banner — Desktop

Screenshot filenames:

- `Desktop/parent/053-connection-offline-banner.png`
- `Desktop/student/035-connection-offline-banner.png`

Source: `apps/web/src/pwa.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: The notice explains stale balances and reconnect risk.

Problems and concrete fixes:

No additional screen-specific visual defect is established. White notice surface and dark text are readable. Shared navigation findings apply to the underlying account; banner itself does not need a new feature.

### Shared connection banner — Mobile

Screenshot filenames:

- `Mobile/parent/045-connection-offline-banner.png`
- `Mobile/student/035-connection-offline-banner.png`

Source: `apps/web/src/pwa.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: The notice explains stale balances and reconnect risk.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H1 | High | **Mobile parent shell** — The brand, seven destinations, sign-out and duplicate role strip take an estimated 373px before page content, reducing the first-screen task area. | Keep the brand/role and sign-out in one compact row; use a 44px-high horizontally scrollable navigation row; hide only the duplicate role-only topbar on phones. Preserve all destinations. |
| H2 | High | **Mobile student navigation** — My Money is clipped and Week-end recap is offscreen in the horizontal strip; these destinations are difficult to discover. | At ≤760px use a three-column, two-row grid for all six destinations, wrap labels, keep each target ≥44px high, and reserve 120px bottom clearance. Preserve desktop sidebar. |

State/responsiveness notes: White notice surface and dark text are readable. Shared navigation findings apply to the underlying account; banner itself does not need a new feature.

### Shared offline fallback — Desktop

Screenshot filenames:

- `Desktop/parent/extra-offline-navigation-fallback.png`
- `Desktop/student/extra-offline-navigation-fallback.png`

Source: `apps/web/public/offline.html`. Shared shell CSS/render source also applies.

What works: Clear offline heading and retry action; no fixture balance is substituted.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| L3 | Low | **Offline fallback palette** — The standalone offline page uses a brighter teal and bluer background than the connected app. | Use the established app teal/background in offline CSS in a later cache-aware delivery change. Leave this low-impact difference in place here to avoid changing service-worker delivery behavior. |

State/responsiveness notes: Text and retry button look readable; card has adequate phone gutters and desktop measure. No additional defect is supported by the supplied image.

### Shared offline fallback — Mobile

Screenshot filenames:

- `Mobile/parent/extra-offline-navigation-fallback.png`
- `Mobile/student/extra-offline-navigation-fallback.png`

Source: `apps/web/public/offline.html`. Shared shell CSS/render source also applies.

What works: Clear offline heading and retry action; no fixture balance is substituted.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| L3 | Low | **Offline fallback palette** — The standalone offline page uses a brighter teal and bluer background than the connected app. | Use the established app teal/background in offline CSS in a later cache-aware delivery change. Leave this low-impact difference in place here to avoid changing service-worker delivery behavior. |

State/responsiveness notes: Text and retry button look readable; card has adequate phone gutters and desktop measure. No additional defect is supported by the supplied image.

### Shared sign-in — Desktop

Screenshot filenames:

- `Desktop/parent/001-login-viewport.png`
- `Desktop/parent/002-login-full-page.png`
- `Desktop/parent/003-login-install-help.png`
- `Desktop/parent/extra-signed-out.png`
- `Desktop/student/001-login-viewport.png`
- `Desktop/student/002-login-full-page.png`
- `Desktop/student/003-login-install-help.png`
- `Desktop/student/extra-signed-out.png`

Source: `apps/web/src/views/render.js`, `apps/web/src/styles.css`, `apps/web/src/pwa.js`. Shared shell CSS/render source also applies.

What works: Clear sign-in heading and44px controls; persistent field labels.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| L1 | Low | **Sign-in/signup vertical spacing** — The full-page login image extends below the viewport with blank space; source forces an844px card plus the installation bar. Signup also has oversized gaps around the role explanation. | Remove the mobile card min-height844px; use content-based card height and zero margins on the role explanation inside the form. Preserve existing16px form gap and44px targets. |

State/responsiveness notes: Installation help remains legible; large-screen centering is orderly. No hover, submitted sign-in error or keyboard-open phone state is present.

### Shared sign-in — Mobile

Screenshot filenames:

- `Mobile/parent/001-login-viewport.png`
- `Mobile/parent/002-login-full-page.png`
- `Mobile/parent/003-login-install-help.png`
- `Mobile/parent/extra-signed-out.png`
- `Mobile/student/001-login-viewport.png`
- `Mobile/student/002-login-full-page.png`
- `Mobile/student/003-login-install-help.png`
- `Mobile/student/extra-signed-out.png`

Source: `apps/web/src/views/render.js`, `apps/web/src/styles.css`, `apps/web/src/pwa.js`. Shared shell CSS/render source also applies.

What works: Clear sign-in heading and44px controls; persistent field labels.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| L1 | Low | **Sign-in/signup vertical spacing** — The full-page login image extends below the viewport with blank space; source forces an844px card plus the installation bar. Signup also has oversized gaps around the role explanation. | Remove the mobile card min-height844px; use content-based card height and zero margins on the role explanation inside the form. Preserve existing16px form gap and44px targets. |

State/responsiveness notes: Installation help remains legible; large-screen centering is orderly. No hover, submitted sign-in error or keyboard-open phone state is present.

### Shared signup — Desktop

Screenshot filenames:

- `Desktop/parent/004-signup-default.png`
- `Desktop/parent/005-signup-parent-selected.png`
- `Desktop/parent/006-signup-student-selected.png`
- `Desktop/parent/007-signup-account-type-menu.png`
- `Desktop/student/004-signup-default.png`
- `Desktop/student/005-signup-parent-selected.png`
- `Desktop/student/006-signup-student-selected.png`
- `Desktop/student/007-signup-account-type-menu.png`

Source: `apps/web/src/views/render.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Parent/Student choices are explicit; the native menu shows selection and focus.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| L1 | Low | **Sign-in/signup vertical spacing** — The full-page login image extends below the viewport with blank space; source forces an844px card plus the installation bar. Signup also has oversized gaps around the role explanation. | Remove the mobile card min-height844px; use content-based card height and zero margins on the role explanation inside the form. Preserve existing16px form gap and44px targets. |

State/responsiveness notes: The open native popup overlaps content by design; this is not a defect. Confirmation email outcomes are not captured.

### Shared signup — Mobile

Screenshot filenames:

- `Mobile/parent/004-signup-default.png`
- `Mobile/parent/005-signup-parent-selected.png`
- `Mobile/parent/006-signup-student-selected.png`
- `Mobile/parent/007-signup-account-type-menu.png`
- `Mobile/student/004-signup-default.png`
- `Mobile/student/005-signup-parent-selected.png`
- `Mobile/student/006-signup-student-selected.png`
- `Mobile/student/007-signup-account-type-menu.png`

Source: `apps/web/src/views/render.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Parent/Student choices are explicit; the native menu shows selection and focus.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| L1 | Low | **Sign-in/signup vertical spacing** — The full-page login image extends below the viewport with blank space; source forces an844px card plus the installation bar. Signup also has oversized gaps around the role explanation. | Remove the mobile card min-height844px; use content-based card height and zero margins on the role explanation inside the form. Preserve existing16px form gap and44px targets. |

State/responsiveness notes: The open native popup overlaps content by design; this is not a defect. Confirmation email outcomes are not captured.

### Student Activity — Desktop

Screenshot filenames:

- `Desktop/student/017-activity-viewport.png`
- `Desktop/student/018-activity-full-page.png`
- `Desktop/student/019-activity-photo-1.png`
- `Desktop/student/020-activity-photo-2.png`
- `Desktop/student/021-activity-photo-3.png`
- `Desktop/student/022-activity-photo-4.png`
- `Desktop/student/023-activity-photo-5.png`
- `Desktop/student/024-activity-photo-6.png`
- `Desktop/student/025-activity-photo-7.png`
- `Desktop/student/026-activity-photo-8.png`
- `Desktop/student/027-activity-photo-9.png`
- `Desktop/student/028-activity-photo-10.png`
- `Desktop/student/extra-activity-network-error.png`
- `Desktop/student/extra-activity-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Item photos can be inspected in a modal; refresh errors retain prior history.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M4 | Medium | **Activity/approval rows** — The 88px photo plus gap leaves an estimated 200px-wide mobile detail column. Rules, dates and hashes wrap repeatedly; metadata also looks small. | At ≤480px put a 72px photo above full-width details; set detail paragraphs to14px/1.5 with8px vertical margins, retain headings16px and disclosure targets min-height44px. Keep desktop side-by-side rows. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Loading/retry photo states are represented. Readable status text distinguishes blocked/rejected/paid without relying on color. No pending decision is fabricated.

### Student Activity — Mobile

Screenshot filenames:

- `Mobile/student/017-activity-viewport.png`
- `Mobile/student/018-activity-full-page.png`
- `Mobile/student/019-activity-photo-1.png`
- `Mobile/student/020-activity-photo-2.png`
- `Mobile/student/021-activity-photo-3.png`
- `Mobile/student/022-activity-photo-4.png`
- `Mobile/student/023-activity-photo-5.png`
- `Mobile/student/024-activity-photo-6.png`
- `Mobile/student/025-activity-photo-7.png`
- `Mobile/student/026-activity-photo-8.png`
- `Mobile/student/027-activity-photo-9.png`
- `Mobile/student/028-activity-photo-10.png`
- `Mobile/student/extra-activity-network-error.png`
- `Mobile/student/extra-activity-settled.png`

Source: `apps/web/src/views/family.js`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Item photos can be inspected in a modal; refresh errors retain prior history.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H2 | High | **Mobile student navigation** — My Money is clipped and Week-end recap is offscreen in the horizontal strip; these destinations are difficult to discover. | At ≤760px use a three-column, two-row grid for all six destinations, wrap labels, keep each target ≥44px high, and reserve 120px bottom clearance. Preserve desktop sidebar. |
| M4 | Medium | **Activity/approval rows** — The 88px photo plus gap leaves an estimated 200px-wide mobile detail column. Rules, dates and hashes wrap repeatedly; metadata also looks small. | At ≤480px put a 72px photo above full-width details; set detail paragraphs to14px/1.5 with8px vertical margins, retain headings16px and disclosure targets min-height44px. Keep desktop side-by-side rows. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Loading/retry photo states are represented. Readable status text distinguishes blocked/rejected/paid without relying on color. No pending decision is fabricated.

### Student Home — Desktop

Screenshot filenames:

- `Desktop/student/008-home-viewport.png`
- `Desktop/student/009-home-full-page.png`
- `Desktop/student/extra-home-settled.png`

Source: `apps/web/src/views/live-layout.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Balance colors match the parent view; primary payment action and private pockets are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M3 | Medium | **Dashboard action alignment** — The outlined action sits lower than the filled action in both balance dashboards; the pair reads as unrelated controls. | Set margin-top:0 on buttons inside .live-actions and align-items:stretch. Apply only to Overview/Home actions. |

State/responsiveness notes: Pocket buttons wrap on narrow cards but remain readable. A fixed bar appearing midway through a full-scroll composite is a capture artifact, not proof of a live overlap defect.

### Student Home — Mobile

Screenshot filenames:

- `Mobile/student/008-home-viewport.png`
- `Mobile/student/009-home-full-page.png`
- `Mobile/student/extra-home-settled.png`
- `Mobile/student-home-390x844.png`

Source: `apps/web/src/views/live-layout.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Balance colors match the parent view; primary payment action and private pockets are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H2 | High | **Mobile student navigation** — My Money is clipped and Week-end recap is offscreen in the horizontal strip; these destinations are difficult to discover. | At ≤760px use a three-column, two-row grid for all six destinations, wrap labels, keep each target ≥44px high, and reserve 120px bottom clearance. Preserve desktop sidebar. |
| M3 | Medium | **Dashboard action alignment** — The outlined action sits lower than the filled action in both balance dashboards; the pair reads as unrelated controls. | Set margin-top:0 on buttons inside .live-actions and align-items:stretch. Apply only to Overview/Home actions. |

State/responsiveness notes: Pocket buttons wrap on narrow cards but remain readable. A fixed bar appearing midway through a full-scroll composite is a capture artifact, not proof of a live overlap defect.

### Student My Money — Desktop

Screenshot filenames:

- `Desktop/student/031-my-money-viewport.png`
- `Desktop/student/032-my-money-full-page.png`
- `Desktop/student/extra-my-money-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Private-pocket explanation and Testnet qualifier are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M7 | Medium | **Weekly balance hierarchy** — The Savings/My Money amount uses ordinary body styling and competes with explanatory text; the primary fact is difficult to scan. | Give the existing amount paragraph a dedicated class with24px, weight650, line-height1.4, tabular numerals and12px vertical spacing. Keep simulated PHP and Testnet XLM qualifiers visible. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: No private-pocket payment flow is shown; adding one is outside this task.

### Student My Money — Mobile

Screenshot filenames:

- `Mobile/student/031-my-money-viewport.png`
- `Mobile/student/032-my-money-full-page.png`
- `Mobile/student/extra-my-money-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Private-pocket explanation and Testnet qualifier are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H2 | High | **Mobile student navigation** — My Money is clipped and Week-end recap is offscreen in the horizontal strip; these destinations are difficult to discover. | At ≤760px use a three-column, two-row grid for all six destinations, wrap labels, keep each target ≥44px high, and reserve 120px bottom clearance. Preserve desktop sidebar. |
| M7 | Medium | **Weekly balance hierarchy** — The Savings/My Money amount uses ordinary body styling and competes with explanatory text; the primary fact is difficult to scan. | Give the existing amount paragraph a dedicated class with24px, weight650, line-height1.4, tabular numerals and12px vertical spacing. Keep simulated PHP and Testnet XLM qualifiers visible. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: No private-pocket payment flow is shown; adding one is outside this task.

### Student Pay a seller — Desktop

Screenshot filenames:

- `Desktop/student/010-pay-a-seller-viewport.png`
- `Desktop/student/011-pay-a-seller-full-page.png`
- `Desktop/student/012-pay-a-seller-select-1-needs.png`
- `Desktop/student/013-pay-a-seller-select-1-wants.png`
- `Desktop/student/014-pay-a-seller-select-1-opened.png`
- `Desktop/student/015-pay-photo-chosen-draft.png`
- `Desktop/student/016-pay-camera-dialog-simulated-device.png`
- `Desktop/student/extra-pay-a-seller-settled.png`
- `Desktop/student/extra-pay-camera-captured-unsent-simulated.png`
- `Desktop/student/extra-pay-camera-unavailable.png`
- `Desktop/student/extra-pay-missing-photo-validation.png`

Source: `apps/web/src/views/render.js`, `apps/web/src/views/camera.js`, `apps/web/src/views/camera.css`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Needs/Wants selection, camera fallback and explicit price entry are present.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| M8 | Medium | **Camera and selected-photo feedback** — Camera failure is visually similar to ready guidance and a disabled capture button looks like it is still waiting. Selected/missing-photo messages are small, plain helper text. | Set camera status and photo-selection text to14px/1.5 with12px padded surfaces; add an error class in the existing camera failure path and use the existing error palette; use not-allowed cursor for unavailable capture. Do not change acquisition or submission behavior. |
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Native dropdown, file-selected, simulated camera, camera-unavailable and missing-photo validation are visible. No OS file-picker or real camera scene is claimed.

### Student Pay a seller — Mobile

Screenshot filenames:

- `Mobile/student/010-pay-a-seller-viewport.png`
- `Mobile/student/011-pay-a-seller-full-page.png`
- `Mobile/student/012-pay-a-seller-select-1-needs.png`
- `Mobile/student/013-pay-a-seller-select-1-wants.png`
- `Mobile/student/014-pay-a-seller-select-1-opened.png`
- `Mobile/student/015-pay-photo-chosen-draft.png`
- `Mobile/student/016-pay-camera-dialog-simulated-device.png`
- `Mobile/student/extra-pay-a-seller-settled.png`
- `Mobile/student/extra-pay-camera-captured-unsent-simulated.png`
- `Mobile/student/extra-pay-camera-unavailable.png`
- `Mobile/student/extra-pay-missing-photo-validation.png`

Source: `apps/web/src/views/render.js`, `apps/web/src/views/camera.js`, `apps/web/src/views/camera.css`, `apps/web/src/styles.css`. Shared shell CSS/render source also applies.

What works: Needs/Wants selection, camera fallback and explicit price entry are present.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H2 | High | **Mobile student navigation** — My Money is clipped and Week-end recap is offscreen in the horizontal strip; these destinations are difficult to discover. | At ≤760px use a three-column, two-row grid for all six destinations, wrap labels, keep each target ≥44px high, and reserve 120px bottom clearance. Preserve desktop sidebar. |
| M1 | Medium | **Essential input outlines** — Faint empty-field outlines are hard to locate. Source color #bcc2b7 measures 1.82:1 against white; this is a likely WCAG AA non-text contrast issue where the border is the identifying cue. Secondary buttons have readable labels and are not automatically failures. | Use #778477 for essential field outlines (target ≥3:1 against white and page background); preserve lighter decorative card dividers and existing focus outlines. |
| M2 | Medium | **Small form labels** — Form labels look small relative to 16px input values. Source confirms 12px labels. Contrast is sufficient; small size remains a readability concern. | Increase field labels from 12px to 14px, line-height 1.5; keep inputs at16px and min-height44px. |
| M8 | Medium | **Camera and selected-photo feedback** — Camera failure is visually similar to ready guidance and a disabled capture button looks like it is still waiting. Selected/missing-photo messages are small, plain helper text. | Set camera status and photo-selection text to14px/1.5 with12px padded surfaces; add an error class in the existing camera failure path and use the existing error palette; use not-allowed cursor for unavailable capture. Do not change acquisition or submission behavior. |
| M9 | Medium | **Transaction references and payment history** — Unstyled hashes dominate Pay a seller history; narrow evidence text is difficult to distinguish from human-readable outcomes. | Apply12–13px monospace, line-height1.6, padding12px and a neutral inset background to existing transaction-reference/evidence paragraphs. Keep overflow-wrap:anywhere and all text. Add a payment-history class with20px spacing. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Native dropdown, file-selected, simulated camera, camera-unavailable and missing-photo validation are visible. No OS file-picker or real camera scene is claimed.

### Student Savings — Desktop

Screenshot filenames:

- `Desktop/student/029-savings-viewport.png`
- `Desktop/student/030-savings-full-page.png`
- `Desktop/student/extra-savings-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Balance qualifiers and Needs-to-Savings explanation are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M7 | Medium | **Weekly balance hierarchy** — The Savings/My Money amount uses ordinary body styling and competes with explanatory text; the primary fact is difficult to scan. | Give the existing amount paragraph a dedicated class with24px, weight650, line-height1.4, tabular numerals and12px vertical spacing. Keep simulated PHP and Testnet XLM qualifiers visible. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Sparse content reflects the currently available balance/refresh function; do not invent saving goals or releases to fill space.

### Student Savings — Mobile

Screenshot filenames:

- `Mobile/student/029-savings-viewport.png`
- `Mobile/student/030-savings-full-page.png`
- `Mobile/student/extra-savings-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Balance qualifiers and Needs-to-Savings explanation are visible.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H2 | High | **Mobile student navigation** — My Money is clipped and Week-end recap is offscreen in the horizontal strip; these destinations are difficult to discover. | At ≤760px use a three-column, two-row grid for all six destinations, wrap labels, keep each target ≥44px high, and reserve 120px bottom clearance. Preserve desktop sidebar. |
| M7 | Medium | **Weekly balance hierarchy** — The Savings/My Money amount uses ordinary body styling and competes with explanatory text; the primary fact is difficult to scan. | Give the existing amount paragraph a dedicated class with24px, weight650, line-height1.4, tabular numerals and12px vertical spacing. Keep simulated PHP and Testnet XLM qualifiers visible. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Sparse content reflects the currently available balance/refresh function; do not invent saving goals or releases to fill space.

### Student Week-end recap — Desktop

Screenshot filenames:

- `Desktop/student/033-week-end-recap-viewport.png`
- `Desktop/student/034-week-end-recap-full-page.png`
- `Desktop/student/extra-week-end-recap-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Confirmed rollover state and both transfer amounts are explicit.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Long dates wrap on mobile without clipping. The screenshot supports improving prose spacing, not changing rollout timing or state handling.

### Student Week-end recap — Mobile

Screenshot filenames:

- `Mobile/student/033-week-end-recap-viewport.png`
- `Mobile/student/034-week-end-recap-full-page.png`
- `Mobile/student/extra-week-end-recap-settled.png`

Source: `apps/web/src/views/weekly.js`, `apps/web/src/views/live-layout.css`. Shared shell CSS/render source also applies.

What works: Confirmed rollover state and both transfer amounts are explicit.

Problems and concrete fixes:

| ID | Severity | Element / problem and why | Concrete fix |
|---|---|---|---|
| H2 | High | **Mobile student navigation** — My Money is clipped and Week-end recap is offscreen in the horizontal strip; these destinations are difficult to discover. | At ≤760px use a three-column, two-row grid for all six destinations, wrap labels, keep each target ≥44px high, and reserve 120px bottom clearance. Preserve desktop sidebar. |
| M10 | Medium | **Inherited page subtitles** — Savings/My Money/recap instruct the user to submit a product photo; parent Savings/Withdrawal describe distribution. These subtitles describe another task. | Replace with page-specific descriptions only after explicit copy-meaning authorization. Current task prohibits changing copy meaning; preserve these strings in this pass. |
| M11 | Medium | **Panel prose rhythm** — Explanatory paragraphs in payment, rules and weekly panels have tightly packed lines compared with page descriptions, especially when wrapping on phones. | Set preview-panel direct prose to line-height1.55 and max-width75ch; retain existing paragraph order and12px inter-element gap. Do not expand already-legible dashboard descriptions. |

State/responsiveness notes: Long dates wrap on mobile without clipping. The screenshot supports improving prose spacing, not changing rollout timing or state handling.

## Cross-cutting issues

Count unique root causes once: **2 High,11 Medium,3 Low (16 total)**. Repeated table references are occurrences, not additional issue counts.

| ID | Severity | Shared root / implementation boundary |
|---|---|---|
| H1 | High | Shared shell; approval required (>5 screens). |
| H2 | High | Shared shell; approval required (>5 screens). |
| M1 | Medium | Shared controls; approval required (>5 screens). |
| M2 | Medium | Shared controls; approval required (>5 screens). |
| M3 | Medium | Scoped to two dashboard screens. |
| M4 | Medium | Scoped to parent Approvals and both Activity views (three screens). |
| M5 | Medium | Scoped to Allowance rules. |
| M6 | Medium | Scoped to Allowance rules; DOM placement only. |
| M7 | Medium | Scoped to parent/student Savings and student My Money (three screens). |
| M8 | Medium | Scoped to Pay a seller and its camera dialog. |
| M9 | Medium | Scoped to Overview, Approvals, Deposit and Pay a seller (four screens). |
| M10 | Medium | Requires user decision; SKIPPED under current constraint. |
| M11 | Medium | Shared panel styling; approval required (>5 screens). |
| L1 | Low | Scoped to sign-in/signup only; no auth behavior changes. |
| L2 | Low | Scoped to Deposit. |
| L3 | Low | SKIPPED; cache-version/delivery update outside this visual pass. |

### Prioritized fix list

1. H1/H2: restore usable mobile task space and expose every navigation destination; user approval required for shared shell changes.
2. M1/M2/M11: shared outline contrast, label readability and panel prose spacing; user approval required before changing controls/panels across more than five screens.
3. M4/M9: widen mobile review details and distinguish transaction references from purchase outcomes.
4. M5/M6: use desktop rule-form width and place validation beside the relevant fields.
5. M7/M8/M3: emphasize weekly balances, distinguish camera failure, align paired dashboard actions.
6. L1/L2: remove forced sign-in height and separate Velo history entries.
7. M10/L3: preserve misleading inherited copy and offline palette for now; reasons are recorded, not silently fixed.

## Implementation log

User approved all five shared visual fixes H1/H2/M1/M2/M11 before shared UI changes. Screen-specific edits affect existing presentation only. No copy strings, routes, authentication code, API calls, amounts, validation conditions, payment handlers or data contracts were changed. No dependencies were installed, no files were deleted, and screenshot originals were not modified. Prior UI-002 history is preserved; this follow-up is [UI-003](../handoff/UI-003.md), authorized by DEC-092.

| ID | Status | Files changed | Result / reason |
|---|---|---|---|
| H1 | **DONE** | apps/web/src/styles.css | Approved shared fix. Compact mobile parent header retains brand, role, sign-out and every scrollable destination; viewport check confirms header under180px. |
| H2 | **DONE** | apps/web/src/views/live-layout.css | Approved shared fix. All six destinations fit a3×2 phone grid, each target at least44px high; bottom clearance adjusted. |
| M1 | **DONE** | apps/web/src/styles.css | Approved shared fix. New #778477 input outline measures3.92:1 against white and3.65:1 against page background; decorative borders unchanged. |
| M2 | **DONE** | apps/web/src/styles.css | Approved shared fix. Labels now14px/1.5; browser computed style checked. |
| M3 | **DONE** | apps/web/src/views/live-layout.css | Dashboard action buttons have zero top margin and matching stretch alignment. |
| M4 | **DONE** | apps/web/src/styles.css | Phone rows use72px photos above full-width details; metadata14px/1.5 and evidence disclosure targets44px. |
| M5 | **DONE** | apps/web/src/views/family.js; apps/web/src/styles.css | Rules-only form class enables two desktop category columns; mobile stays stacked; names/examples enlarged with padded label targets. |
| M6 | **DONE** | apps/web/src/views/family.js; apps/web/src/styles.css | Same alert moved before categories and made sticky12px from viewport top. Follow-up source review identified an offscreen-submit risk; final captures/assertions verify the alert stays visible after Save at the bottom on phone and desktop. Validation conditions/wording unchanged. |
| M7 | **DONE** | apps/web/src/views/weekly.js; apps/web/src/views/live-layout.css | Existing money formatter and qualifiers retained; dedicated paragraph uses24px/650 weight and tabular numerals. |
| M8 | **DONE** | apps/web/src/views/camera.js; apps/web/src/views/camera.css | Existing failure path adds presentation classes only; status/selection use14px padded surfaces and failure uses existing error palette. Disabled unavailable capture uses not-allowed cursor. |
| M9 | **DONE** | apps/web/src/views/render.js; apps/web/src/styles.css; apps/web/src/views/live-layout.css | Existing hashes gain wrapping monospace inset surfaces; history gets20px separation. Every hash, outcome and action remains present. |
| M10 | **SKIPPED** | None | Fixing the misleading inherited subtitles changes copy meaning, which the user explicitly excluded. Requires a separate copy decision. |
| M11 | **DONE** | apps/web/src/views/live-layout.css | Approved shared fix. Panel prose has1.55 line-height and direct explanatory paragraphs a75ch maximum measure. |
| L1 | **PARTIAL** | apps/web/src/styles.css | Removed844px card minimum and redundant role-description margins. Default installation bar is accounted for, but expanded manual-help height is variable and can still extend the document beyond one viewport; no shared PWA behavior was changed. |
| L2 | **DONE** | apps/web/src/styles.css | Existing Velo history articles have16px padding,12px radius and separate outlined surfaces; existing gap plus4px adjacent margin gives16px separation. |
| L3 | **SKIPPED** | None | Offline document palette retained because updating the cached document also needs a service-worker cache-version/delivery change, excluded from this visual-only pass. |

Result: **13 DONE,1 PARTIAL,2 SKIPPED**. Both High items are DONE. Of11 Medium items,10 are DONE and M10 is SKIPPED with the copy-meaning reason above. Low items: one DONE,one PARTIAL,one SKIPPED.

### Verification and limits

- `npm run check` exited0: contract fixtures/tests,38 web tests,98 API tests and both builds. Run outside the sandbox for the existing child-process tests. No new unit tests were needed for these presentation changes.
- Production-build Chromium pass visited all13 authenticated pages at390×844 and1440×900: all26 document-overflow checks passed; mobile parent header height and all student nav target bounds passed; desktop category-column geometry and computed14px labels/input border color passed. [Readback](after/checks.json).
- The first browser harness reached a rules page while account data was still loading and failed before its geometry assertion. This was a verification-harness readiness issue; explicit element waits were added and the full pass reran successfully. Some original files named “settled” similarly show pending data; the inventory flags them.
- After reviewing the images and independent source feedback, M6 gained sticky error presentation. The web build and `git diff --check` passed again. A targeted confirmation verified invalid submission from the bottom shows the unchanged alert inside both viewports. [Readback](after/checks-rules.json), [phone image](after/mobile-parent-allowance-rules-validation-at-submit.png), [desktop image](after/desktop-parent-allowance-rules-validation-at-submit.png).
- After images were visually inspected for compact phone navigation, all-six student tabs, both category layouts, full-width mobile approval details, larger balance typography, separated Velo entries and camera error surfaces. [New capture index](AFTER.md). Original238 screenshots were all viewed; the post-change pass checks selected affected states rather than claiming every financial outcome was recreated.
- Impeccable detector ran once across all seven changed UI source files and returned an empty finding array. No new suppressions were added. Independent source review found no business/API/auth/routing/copy-meaning changes.
- Verification serves local production assets with GET-only proxy access to the deployed example accounts. Camera ready uses a simulated device; denial is controlled in the browser for the error-state check. No rules were saved, no checkout was created and no purchase/approval/rollover was submitted. Secrets are read from ignored local configuration and are not written to review artifacts.
- Physical-device installation, native mobile keyboard behavior, hover-only states and live financial states absent from the originals remain unverified. Changes are local and uncommitted/undeployed.

### Decisions remaining

M10 needs permission to replace misleading page subtitles with accurate page-specific descriptions. L1 has a minor remaining variable-height installation-help layout limit. L3 can be considered with a future cache-aware delivery update. No change to financial behavior is proposed.
