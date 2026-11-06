# Design brief

## Design authority

* **Status:** Confirmed
* **Design Owner:** Hedrix (Frontend Human Designer)
* **Founder Authorization:** Confirmed
* **Figma Design Approval:** Approved by Tyrone and Founder
* **Frontend Implementation Responsibility:** Hedrix
* **Backend / API Responsibility:** Tyrone
* 
## Design references

* **Figma Source:** [PadalaPocket – FE-002 to FE-006 layouts](https://www.figma.com/design/aHBonOuy1uw5kCO0Ih0oxl/PadalaPocket-%E2%80%93-FE-002-to-FE-006-layouts?node-id=0-1&t=sUwbNSRyZ1JCxZnm-1)
* **Visual Reference Export:** `PadalaPocket – Initial Web App Layout.pdf` (9 pages)

## Screen inventory

| Screen Name | User Role | Main Purpose | Important UI Components | Primary Actions | Relevant States | Dependencies on Backend Data |
|---|---|---|---|---|---|---|
| **Sign-In** (FE-002) | Shared / Auth | Authenticate user and route to parent or student view | Email/password inputs, Mock data badge, Sign-in button | Submit credentials | Signing in (spinner), Wrong details, Network error, Signed out after timeout | Identity / Mock Auth API |
| **Parent Dashboard** (FE-003) | Parent | Overview child's weekly allowance, pending approvals, and activity | Needs/Wants/Savings/My Money summary cards, Approval queue, Recent activity list | Review pending requests, deposit funds | Loading skeleton, No requests yet, Error banner with Retry, Deposit pending | Needs/Wants spending totals, approval items count, recent activity |
| **Parent Approvals** (FE-004/005) | Parent | Review and decide on student purchase and savings release requests | Open requests list, detailed request card with product photo & AI guess, Closed history | Approve, Decline, Disable after tap | Approved, Payment sending, Declined, Expired, Auto-declined, Send failed (Retry) | Open approval queue, purchase photo, AI guess context, price & category |
| **Pay a Seller** (FE-004) | Student | Initiate a purchase by scanning demo QR, uploading photo, and entering price | QR scan trigger, photo upload/replace, price input, category selector (Needs/Wants), AI check box | Take/choose photo, select category, Pay | Over cap, Send to parent for approval, Item not clear (retake), AI unavailable (Retry), Insufficient balance | AI classification API, allowance balance rules |
| **Purchase Status** (FE-004) | Student | Track ongoing status of submitted purchases | Item status list with timestamps and status badges | Replace photo/price (if pending), View status | Not paid yet, Waiting for parent, Waiting for seller, Seller claimed, Paid, Declined, Connection lost (Retry) | Purchase order status, merchant claim status |
| **Savings** (FE-005) | Student | View locked savings balance and request release to My Money | Locked savings card, Request release controls, Request status tracker, History list | Send release request | Locked, Waiting for parent, Approved, Declined, Send failed (Retry), Single open request limit | Locked savings balance, request history |
| **My Money** (FE-005) | Student | Manage private personal funds hidden from parent view | Private balance card, Pay seller from My Money, Transaction history | View balance, review history | Empty history, Loading error (Retry), Insufficient balance, Send pending | Private balance, My Money transaction log |
| **Week-End Recap** (FE-005) | Student | Preview and trigger end-of-week allowance sweep (Needs to Savings, Wants to My Money) | Reminder banner, transfer preview breakdown, Demo clock controls | Advance to week end (demo) | Clock error (Retry), Transfer pending, Already advanced, Notification read/unread | Demo clock state, weekly transfer calculations |
| **Withdrawal & Payout** (FE-006) | Operator | Oversee Stellar Testnet simulated fiat payout and withdrawals | Withdrawal detail card, Status indicators, Anchor action buttons | Open anchor step, Refresh status | Pending (anchor step open), Completed (Done), Error (Failed, Retry), Rejected | Testnet anchor payout status, transaction verification |

## Layout and responsiveness

* **Target Viewports:** Designed for mobile-first student experiences (390px base width target) and desktop/tablet dashboard layouts for parents.
* **Layout Structure:** Card-based modular layout with off-white/clean background, rounded content containers, clear hierarchy, and persistent bottom navigation for student screens.
* **Navigation Placement:** Top status and header controls for Parent views; fixed bottom bar (`Home`, `Activity`, `Savings`, `My Money`) for Student views.
* **Responsive Expectations:** Must gracefully render on mobile screens down to 390px width and scale cleanly up to desktop resolutions. Responsive grid adjustments outside card stacking are marked pending confirmation.

## Visual design system

* **Color Palette:**
  * Primary Actions & Text: Dark Navy / Near Black
  * Cards & Surfaces: Pure White on Light Gray background
  * Status Indicators: Green (Approved/Done), Amber/Orange (Pending/Review/Waiting), Red (Declined/Failed)
  * Category Badges: Soft Pastel Blue/Teal for Needs, Light Purple/Indigo for Wants
* **Typography:** Clean sans-serif font hierarchy with heavy bold metrics for monetary values (`P200`, `P2,400`), semi-bold subheadings, and muted smaller text for timestamps and descriptions.
* **Components:**
  * **Buttons:** Primary solid navy pill buttons, secondary outlined rounded buttons. Buttons must disable upon single tap to prevent duplicate submissions.
  * **Cards:** Soft-cornered rectangular containers with border outlines or soft drop shadows.
  * **Badges & Tags:** Rounded pill chips for category labels and status tracking.
  * **Input Elements:** Bordered text inputs for price and credentials; tap targets for photo attachment.

## Interaction expectations

* **Navigation:** Fast switching between bottom nav tabs for students.
* **Allowance Allocation:** Visual split between Needs and Wants.
* **Purchase Flow:** Photo upload $\rightarrow$ AI item guess $\rightarrow$ System rule check (e.g., Needs cap $\le$ P500) $\rightarrow$ Instant proceed or route to Parent approval queue.
* **Savings & My Money:** Savings are locked by default and require parent approval to release into My Money. My Money is private, unrestricted, and completely hidden from parent views.
* **Week-End Sweep:** Unused Needs move to Savings; unused Wants move to My Money.
* **Duplicate Prevention:** Submit buttons must disable immediately after one tap.

## Copy tone and content

* **Tone:** Clear, encouraging, transparent, and age-appropriate for teenagers and clear for parents.
* **Mandatory Category Terminology:**
  * `Needs`
  * `Wants`
  * `Savings`
  * `My Money`
* **Privacy Statements:** Explicit microcopy on privacy bounds (e.g., "Mia's private space. Not shown here", "Hidden in the app, not anonymous on a public blockchain").

## Accessibility and usability

* **Readability & Contrast:** High-contrast text on primary buttons and balance displays.
* **State Feedback:** Explicit loading skeletons, empty states ("No requests yet"), error banners with a `Retry` trigger, and clear visual payment statuses.
* **Usability Safeguards:** Prevent accidental double-submits on all financial action buttons.

## API fixture review & backend gaps

| Screen / Feature | Required Data / State | Current API / Fixture Support Status | Backend Gap / Notes |
|---|---|---|---|
| **Sign-In (FE-002)** | Auth credentials & role projection | Labeled mock available (`/api/health`, mock auth) | Real family authentication backend pending (B-005) |
| **Parent Dashboard (FE-003)** | Allowance totals, pending requests, activity summary | Mock summaries available | Balances and non-empty approval arrays provisional/missing |
| **Approvals (FE-004/005)** | Open/closed purchase & savings requests | Empty approval states mocked | Non-empty approval examples and decision endpoints missing |
| **Pay a Seller / Purchase (FE-004)** | AI image check, rule validation, payment execution | Provisional | AI integration and payment execution endpoints pending (B-008, B-010) |
| **Savings & My Money (FE-005)** | Locked balance, private balance, transaction history | Missing / provisional | Durable money accounting and history APIs pending (B-006, B-011) |
| **Week-End Lifecycle (FE-005)** | Demo clock, automatic sweep triggers | Missing | Demo clock and weekly transfer logic pending (B-012) |
| **Withdrawal (FE-006)** | Stellar Testnet anchor payout status | Provisional / mock | Stellar Testnet anchor integration pending (B-001, B-013) |

## Unresolved questions for confirmation

1. Are exact mobile/desktop CSS breakpoints specified in Figma, or should standard Tailwind CSS breakpoints be applied?
2. Are floating toast notifications required for async events, or are inline error banners with `Retry` sufficient across all views?