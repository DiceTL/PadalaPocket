# PadalaPocket idea

State: focused hackathon concept accepted under DEC-029; product spec drafted for review. Historical source: [original text](sources/padalapocket-original.md).
Original mechanisms remain proposals unless adopted in the decision ledger.

## Proposed concept

The source describes a weekly allowance wallet for families with a parent working abroad.
It proposes a parent-funded allowance, purchases approved within limits by a payment agent,
and a split of remaining funds into savings and personal spending money.

## Proposed users and problem

Initial audience: students aged 13+ receiving allowance from an OFW parent, with spending boundaries agreed together; see [DEC-007](../docs/decision-ledger.md). Parent and student roles, caregiver involvement and the precise first-use situation remain to be defined.
It hypothesizes a gap in visibility, spending autonomy, and budgeting across distance.
The source itself labels the central pain as an unvalidated team assumption.

## Mechanisms proposed in the source

- Needs and wants allowance buckets, per-purchase limits, category checks, and expiry.
- Child balances for allowance, savings, and personal money.
- Parent escalation for some rejected purchases, with a timeout.
- A week-end transfer of leftover needs money to savings and leftover wants money to personal money.
- Parent and child views, simulated purchases, and Testnet integrations.

These are candidates to examine, including alternatives and possible removal.
The original source contains fuller examples and proposed technical details.

## Current unknowns

Demand and differentiating value remain assumptions; technical feasibility and proposed operational defaults still need review. Accepted scope and rules are in the product spec.
Market findings belong in [market.md](market.md). Team choices belong in [the decision ledger](../docs/decision-ledger.md).

## Accepted prototype direction

One parent, one student and one demo seller; demonstrate weekly funding, AI-assisted allowance purchases, Savings/My Money and test-anchor withdrawal using Testnet only. Demo time advancement includes both week start and week end; fiat payout is simulated. Full requirements and proposed defaults live in [product spec](../docs/product-spec.md), derived from [DEC-006–DEC-029](../docs/decision-ledger.md).

## Category catalog

Accepted under DEC-028. Initial photo-based demo subset: **Meals; Snacks and sweets; Drinks; School supplies; Books and learning materials; Toys and collectibles**. Parent assigns allowed categories to Needs/Wants; these names do not determine an item's purpose by themselves.

Remaining catalog for later purchase-type support:

- Transportation
- School fees and activities
- Mobile load and internet
- Hygiene and personal care
- Health supplies
- Clothing and footwear
- Bags and accessories
- Electronics and accessories
- Games and digital purchases
- Sports and fitness
- Arts, music, and hobbies
- Entertainment and outings
- Gifts and celebrations
- Household items
- Other / unidentified (fallback label; not automatic spending permission)

Fares, fees, load and digital purchases need evidence rules beyond ordinary product photos; accepting their categories does not establish that support for the demo. Identifiable alcohol, tobacco and similar restricted-item flags trigger parent review under DEC-019 rather than passing solely as Drinks/Other. An image that cannot be confidently identified follows the explanation/photo-retry flow under DEC-020–DEC-021.

## Accepted concept

A weekly allowance wallet for students aged 13+ with an OFW parent: Needs/Wants spending follows agreed parental rules and AI photo review; leftover funds build Savings and private My Money. Savings release requires parent approval. See the product spec for the accepted demo scope; real GCash settlement remains unresolved.
