# Design brief

## Design authority

* **Status:** Confirmed
* **Design Owner:** Hedrix (Frontend Human Designer)
* **Founder Authorization:** Confirmed
* **Figma Design Approval:** Approved by Tyrone and Founder
* **Frontend Implementation Responsibility:** Hedrix
* **Backend / API Responsibility:** Tyrone
* **Revision note (FE-001, 2026-11-07):** The 9-page PDF export was reviewed against the product spec, technical spec and S-002 fixture guide. The items under "Corrections to the current layouts" and "Design gaps and pending layouts" are proposed changes. They are **not yet confirmed** by the human design owner and founder, and not all are in Figma. Each needs reconfirmation before the task that builds it (see "Reconfirmation needed").

## Design references

* **Figma Source:** [PadalaPocket – FE-002 to FE-006 layouts](https://www.figma.com/design/aHBonOuy1uw5kCO0Ih0oxl/PadalaPocket-%E2%80%93-FE-002-to-FE-006-layouts?node-id=0-1&t=sUwbNSRyZ1JCxZnm-1)
* **Visual Reference Export:** `PadalaPocket – Initial Web App Layout.pdf` (9 pages: FE-003 parent dashboard, FE-004/005 approvals, FE-002 sign-in, FE-004 Pay a seller, FE-004 Purchase status, FE-005 Savings, FE-005 My Money, FE-005 Week-end recap, FE-006 Withdrawal). All pages are labeled "final draft" and use sample data.
* **Review basis (2026-11-07):** The 9-page PDF export supplied in this conversation was inspected visually and compared with the current product spec, technical spec and S-002 fixtures. The user confirmed that the web-app layout has not changed since export, so this PDF is the current visual reference for FE-001. The Figma file itself was not inspected directly; the proposed changes below still need review by the human design owner.

## Screen inventory

| Screen Name | User Role | Main Purpose | Important UI Components | Primary Actions | Relevant States | Dependencies on Backend Data |
|---|---|---|---|---|---|---|
| **Sign-In** (FE-002) | Shared / Auth | Authenticate user and route to parent or student view | Email/password inputs, Mock data badge, Sign-in button. No role picker. | Submit credentials | Signing in (button disabled, spinner), Wrong details, Network error (Retry), Signed out after timeout | Identity / Mock Auth API |
| **Parent Dashboard** (FE-003) | Parent | Overview child's weekly allowance, pending approvals, and activity | Needs left / Wants left / Savings (locked) cards, My Money placeholder with no amount, "Needs your approval" list, Recent activity list. **Proposed addition:** funding-wallet balance | Review pending requests, Deposit funds | Loading skeleton, No requests yet, Error banner with Retry, Deposit pending | Needs/Wants spending totals, funding-wallet balance, approval items count, recent activity |
| **Parent Approvals** (FE-004/005) | Parent | Review and decide on student purchase and Savings release requests | Open requests list with countdown, request detail with product photo and AI guess, Closed list | Approve, Decline (disable after one tap) | Approved, Payment sending, Declined, Expired, Auto-declined, Already decided elsewhere, Send failed (Retry) | Open approval queue, purchase photo, AI guess, price, category, expiry |
| **Pay a Seller** (FE-004) | Student | Start a purchase by scanning the demo QR, adding a photo and entering a price | Seller card (demo QR), photo take/choose/replace, price input, Needs/Wants/Category selectors, AI check card | Scan again, Take/choose photo, select bucket and category, Pay | Over cap (send to parent for approval), Item not clear (retake photo), AI unavailable (Retry), Insufficient funds (**Rejected, parent notified**) | AI classification, allowance balance rules, seller lookup |
| **Purchase Status** (FE-004) | Student | Track submitted purchases | Status cards with badges | **Proposed:** Cancel and start a new request (while waiting for parent) | Waiting for parent, Checking payment, Waiting for seller, Paid, Declined, Payment failed (Retry), Connection lost / status unknown | Purchase status, merchant claim status |
| **Savings** (FE-005) | Student | View locked Savings and request release to My Money | Locked savings card, amount input, Request status, History | Send request | Locked, Waiting for parent, Approved, Declined, Send failed (Retry), One open request at a time | Locked Savings balance, request history |
| **My Money** (FE-005) | Student | Manage private personal funds hidden from the parent view | Private balance card ("Only you see this"), Pay a seller from My Money, History | Pay a seller | Empty history, Loading, Error (Retry), Not enough balance, Send pending (not shown as spent) | Private balance, My Money history |
| **Week-End Recap** (FE-005) | Student (reminder and recap). Parent (demo clock, proposed) | Show the end-of-week sweep: leftover Needs to Savings, leftover Wants to My Money | Reminder banner (Simulated time), transfer preview, notification state | Student: read only. **Proposed:** Advance to week end moves to parent demo tools | Transfer pending (Moving, then Done), Transfer failed (Retry), Already advanced, Notification unread/read, Clock error (Retry) | Demo clock state, weekly transfer results, notifications |
| **Withdrawal & Payout** (FE-006) | Parent acting as demo operator (proposal per technical spec; confirmation pending) | Run the demo seller's test-anchor withdrawal after a confirmed merchant claim, with simulated fiat payout disclosed | "Simulated payout" banner, withdrawal detail, status, mock/live config label | Open anchor step, Refresh status | Pending, Completed (Done, real confirmation only), Error (Failed, Retry), Fake or unverified completion (rejected, shown as error) | Anchor withdrawal ID and status, claim status |

## Layout and responsiveness

* **Target Viewports:** Student mobile at 390px and parent desktop at 1280px, as shown in the PDF export. Intermediate breakpoints are not shown.
* **Layout Structure:** Card-based modular layout on a light gray background, white rounded cards, clear hierarchy.
* **Navigation Placement:**
  * **Parent:** left sidebar at 1280px with Overview, Allowance rules, Approvals (count badge), Activity, Savings, Deposit, and a child selector card at the top. *This replaces the earlier "top header" description to match the PDF.* Below 768px the sidebar collapses to a top bar (proposed).
  * **Student:** fixed bottom bar with Home, Activity, Savings, My Money. Targets at least 44px.
* **Responsive Expectations:** Render correctly at 390px and scale to 1280px. Breakpoints between and beyond those widths are a proposal pending confirmation (see Unresolved questions).

## Visual design system

* **Color Palette:**
  * Primary Actions & Text: Dark Navy / Near Black
  * Cards & Surfaces: Pure White on Light Gray background
  * Status Indicators: Green (Approved/Paid/Done), Amber/Orange (Pending/Waiting), Red (Declined/Failed), Gray (Checking payment, Not completed)
  * Category Badges: Soft teal for Needs, light purple/indigo for Wants
  * Privacy badge: light purple ("Only you see this")
* **Typography:** Clean sans-serif hierarchy. Heavy bold amounts (`₱200`, `₱2,400`), semi-bold subheadings, muted small text for timestamps and descriptions. Amounts display as pesos formatted from integer centavo strings (`priceMinor`).
* **Components:**
  * **Buttons:** Primary solid navy pill buttons, secondary outlined rounded buttons. Buttons must disable on the first tap to prevent duplicate submissions.
  * **Cards:** Soft-cornered containers with border outlines.
  * **Badges & Tags:** Rounded pill chips for categories, status and labels (MOCK DATA, Simulated time, Operator only).
  * **Input Elements:** Bordered text inputs for price and credentials; tap targets for photo attachment.

## Interaction expectations

* **Navigation:** Fast switching between bottom nav tabs for students.
* **Allowance Allocation:** Visual split between Needs and Wants.
* **Purchase Flow:** Photo upload → AI item guess → rule check (cap, category, balance) → instant proceed or route to the parent approval queue. A changed photo or price after submission is a new request that needs approval again.
* **Savings & My Money:** Savings are locked by default and need parent approval to release into My Money. My Money is private and completely hidden from parent views.
* **Week-End Sweep:** Unused Needs move to Savings; unused Wants move to My Money.
* **Duplicate Prevention:** Submit buttons disable immediately after one tap.
* **Unknown payment outcomes:** "Checking payment" and "status unknown" must never look paid and must not offer a blind retry.

## Copy tone and content

* **Tone:** Clear, encouraging, transparent, age-appropriate for teenagers and clear for parents.
* **Mandatory Category Terminology:**
  * `Needs`
  * `Wants`
  * `Savings`
  * `My Money`
* **Privacy Statements:** Explicit microcopy on privacy bounds (e.g., "Mia's private space. Not shown here.", "Hidden in the app, not anonymous on a public blockchain").
* **Simulation labels:** "MOCK DATA (development mode label)", "Sample data", "Simulated time", and "Simulated payout. No real pesos move." must stay visible wherever they apply. "Deposit funds" should be labeled as a Testnet or simulated allocation (proposed).

## Accessibility and usability

* **Readability & Contrast:** High-contrast text on primary buttons and balance displays.
* **State Feedback:** Explicit loading skeletons, empty states ("No requests yet"), error banners with a `Retry` trigger, and clear payment statuses.
* **Usability Safeguards:** Prevent accidental double-submits on all financial action buttons. Keyboard navigation and 390px width must both work (per the FE-006 layout).

## API fixture review & backend gaps

Reviewed 2026-11-07 against `handoff/api-examples/README.md` (s002-v1), `cases.json` and the technical spec. The set contains 24 fixtures (2 identity, 11 purchase states, 2 role-specific purchase projections, 1 empty approvals and 8 generic errors). This count does not establish live endpoint behavior; all cases are synthetic.

| Screen / Feature | Required Data / State | Fixture coverage | Notes |
|---|---|---|---|
| **Sign-In (FE-002)** | Auth credentials and trusted role projection | **Partial.** `parent-identity` and `student-identity` cover role projections only. Generic `error-*` cases demonstrate the technical error envelope; they are not Supabase Auth responses or network/timeout fixtures. | Sign-in is Supabase Auth (B-005). It needs a mock boundary, not a fixture. Technical spec uses two real demo logins, never a role switch. |
| **Parent Dashboard (FE-003)** | Needs/Wants left, Savings total, funding-wallet balance, pending count, recent activity; no My Money fields | **Gap.** Only the identity projection exists. | `/api/me` expansion is missing (balances, rules, schedule). Amount units and wallet mapping wait for C-002. The My Money card is placeholder text only. |
| **Approvals (FE-004/005)** | Open and closed purchase and Savings requests with photo, AI guess, price, category, expiry | **Gap.** `empty-approvals` only (`{items:[]}`). | Nonempty item shape is undefined. A single `purchase-awaiting_parent` snapshot exists but has no photo or AI fields. Savings requests have no read contract. |
| **Pay a Seller / Purchase (FE-004)** | Purchase states, AI result, rule outcome, seller lookup | **Partial.** All 11 purchase states are covered, with reasons such as `AI_UNCERTAIN`, `CAP_EXCEEDED`, `INSUFFICIENT_FUNDS`. | Missing: AI product name and category, category field, photo upload response, seller/QR resolution. The "Looks like: notebook" card cannot be driven by fixtures yet (provider-dependent, B-008). |
| **Purchase Status (FE-004)** | Status list with timestamps; claim status | **Partial (strongest).** All states exist, including `unknown`. | Single-purchase reads only. There is no list or history endpoint and no timestamps. Pending and unknown must never render as paid. |
| **Savings & My Money (FE-005)** | Locked balance, private balance, history, Savings request status | **Gap.** `student-purchase` shows one private My Money purchase only. | No balances, history or Savings request reads (B-006, B-011). Parent samples must stay free of My Money fields. |
| **Week-End Lifecycle (FE-005)** | Demo clock, week start and end, reminder, transfer results, notifications | **Gap.** No fixtures. | Demo clock state, notifications and transfer outcomes need read contracts (B-012). |
| **Withdrawal (FE-006)** | Merchant claim result, anchor status, withdrawal ID | **Gap.** No fixtures. | B-013 covers withdrawal endpoints/status/recovery; B-001 proves the separate Noir/Velo payment and claim path. Never show seeded transaction proof. |

**Requests for Tyrone (for C-002):** expand `/api/me` for parent and student; define the nonempty approval item (purchase and Savings) with expiry; add an AI evidence summary, category and a list read for purchases; add notification, demo clock, merchant-claim and withdrawal reads.

## Corrections to the current layouts

Found in the PDF export. All are proposed changes needing reconfirmation.

1. **Demo clock placement.** The technical spec makes `POST /api/demo/advance` a parent/operator call, but the student Week-end recap has "Advance to week end (demo)". Move the control to parent demo tools. The student sees only the reminder and recap. Add a week-start control.
2. **Withdrawal / My Money exposure.** The Withdrawal page shows "Requested by Mia (My Money)", which exposes My Money to the parent operator (F-007). Tie withdrawal to the demo seller after a merchant claim, show a synthetic recipient, show a transaction hash only when confirmed, and keep the "No real pesos move" banner.
3. **Replace photo or price.** Purchase Status offers "Replace photo or price" on a request waiting for the parent. The technical spec freezes requests once awaiting approval, and photo replacement is only allowed from `needs_photo`. Proposed: remove in-place editing and offer "Cancel and start a new request" only if backend defines and accepts cancellation behavior; say a new request needs approval again. Keep a true "Replace photo" only for the item-not-clear state.
4. **Merchant claim.** Add a parent demo-tools action for the merchant claim (`POST /api/demo/merchant-claim`). Reword "The seller claims it with the demo QR" to match.
5. **Funding-wallet balance.** Add it to the parent dashboard (F-001) and label "Deposit funds" as Testnet or simulated.
6. **Insufficient funds copy.** Pay a Seller should say "Rejected, parent notified", not an approval request (F-005). Add a parent notification for it.
7. **Reminder timing.** The reminder appears 24 hours before the next allocation (F-002), not "2 hours" before week end. Add the parent state for a skipped allocation when funds are insufficient.
8. **Category options.** Categories come from the category catalog in `seed/idea.md`. The Pay a Seller "Category" chip needs a defined list.
9. **Declined state.** "Declined" currently covers a parent rejection, an expiry and an auto-decline. Keep one badge but show the reason line (Parent declined, Expired, Rejected for funds).

Kept as designed: Wants purple/indigo, Declined and Failed red, Paid and Done green, solid navy pill buttons, bottom navigation targets at least 44px.

## Design gaps and pending layouts

**Screens not yet designed (not in the PDF)**
* Student Home and Parent Activity. Both are in navigation. For FE-002, Student Home can be a placeholder route.
* Allowance rules and Deposit (parent sidebar items). Needed for F-001: weekly amount, 60/40 default ratio, purchase cap, categories per bucket, funding-wallet balance.
* Parent demo tools: merchant claim, withdrawal entry point, demo clock.
* Notifications list.
* A shared states sheet: loading, empty, error, pending, expired.
* Where students reach Purchase status and Week-end recap from the bottom navigation.

## Reconfirmation needed

The human design owner (Hedrix) confirms visual/layout choices; the founder confirms product or scope changes; Tyrone reviews technical/API consequences. The proposals remain unconfirmed. Only some of them block FE-002.

| Item | Needed before |
|---|---|
| Sidebar-to-top-bar behavior, breakpoints, Student Home placeholder | FE-002 |
| Sign-in page (no changes) | FE-002 |
| Funding-wallet balance, Allowance rules and Deposit screens | FE-003 |
| Purchase Status and Pay a Seller corrections (3, 6, 8, 9), merchant claim (4) | FE-004 |
| Demo clock move, reminder timing, notifications list (1, 7) | FE-005 |
| Withdrawal correction (2) | FE-006 |

## Unresolved questions for confirmation

Proposed answers are suggestions, not decisions.

1. **Breakpoints.** The PDF export shows 390px student and 1280px parent frames; the Figma source was not reviewed. *Proposed:* 390, 768 and 1280px, with the parent sidebar collapsing to a top bar below 768px.
2. **Notifications.** Are floating toasts required for async events? *Proposed:* inline banners with `Retry` plus a notifications list; no toasts. The product spec requires parent notifications for events such as an insufficient-funds rejection.
3. **Operator role.** Do withdrawal and merchant-claim actions belong to the parent account acting as demo operator? *Proposed:* yes, per the technical spec, with no third role or login.
4. **Reminder and clock.** Which role sees the F-002 funding reminder, and where does the demo clock live? *Proposed:* the parent sees the funding reminder, the student sees the weekly recap, and the clock lives in parent demo tools (the API is parent-only).
5. **Purchase cap display.** The product spec names a purchase cap without defining whether the same cap applies to Needs and Wants. The PDF shows a Wants request above a ₱500 cap. Confirm whether the UI should present one shared cap or bucket-specific caps, and label the approval reason accordingly.
