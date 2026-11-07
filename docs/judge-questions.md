# Judge questions

Team rehearsal draft. Status labels below reflect the [implementation plan](implementation-plan.md) and linked packets as of 2026-11-07; refresh them before presenting. **Demonstrated** means the cited evidence exists, not that the complete product journey works. James leads preparation; Lili rehearses the answers, and Tyrone/Hedrix verify technical claims.

Status key: **Concept** = accepted idea, not implementation evidence; **Planned** = task not yet accepted as done; **Demonstrated** = specific evidence recorded in a packet; **Open** = unresolved or unverified.

## 30-second introduction

PadalaPocket explores a weekly allowance workflow for a student aged 13 or older receiving allowance from an OFW parent, with spending boundaries they agree on and some money the student controls. This is a concept, not a researched claim about a specific family's unmet need. B-001 records successful Noir authorization and merchant claim on Testnet, plus a separate paid Velo checkout. Remote CI and merge evidence are still pending, and these proofs are not one connected payment flow. The allowance, AI, privacy, Savings, weekly workflow, and withdrawal journey remain planned; this is not yet a complete user-facing demo or a real-peso payout service.

## Core questions

### 1. What problem does PadalaPocket solve?

**Status: Concept; demand unvalidated.**

**Answer:** It explores whether families with a parent working abroad want a way to manage a student's weekly allowance with agreed spending boundaries and some student-controlled money. Needs/Wants budgets, purchase review, Savings, and My Money are the concept's proposed tools.

**Evidence:** Accepted concept in the [idea](../seed/idea.md) and [product spec](product-spec.md).

**Likely follow-up:** Have you proven families need this?

**Be candid:** No. Demand and benefits are hypotheses. The prototype demonstrates a concept and workflow, not validated impact.

### 2. Why use this instead of GCash Jr., Maya, or sending money directly?

**Status: Market scan documented; positioning hypothesis.**

**Answer:** GCash Jr. and Maya provide general-purpose wallet options for minors under their respective eligibility and guardian requirements. The opportunity PadalaPocket is exploring is a workflow that combines recurring allowance rules, Needs/Wants budgets, parent review of exceptions, and student-controlled funds. Families may find an existing wallet, cash, or direct transfers sufficient.

**Evidence:** The [market comparison](../seed/market.md) and dated entries [EV-026–EV-030](../work/evidence-ledger.md) summarize published offers and their limits.

**Likely follow-up:** Which feature is missing from competitors?

**Be candid:** We have not established a definitive feature gap. The comparison uses published materials, not a full product walkthrough or user research; a listed feature's absence from those pages does not prove the provider lacks it.

### 3. Who is the first user, and what does the demo include?

**Status: User profile is a concept; most user-facing journey tasks are Planned. B-001 payment proof is Demonstrated separately.**

**Short answer:** We are designing for one student aged 13 or older who receives weekly allowance from an OFW parent and wants agreed spending limits while retaining some personal spending money. This first-use situation is a working concept, not a finding from interviews or research.

**Technical follow-up:** The accepted scope is one parent, one student, and one demonstration seller. The intended journey includes weekly allowance setup/funding, AI-identified allowance-purchase photos, exception review, Savings/My Money, labeled week-start/week-end advancement, and Testnet withdrawal. Most of these user-facing tasks remain Planned; only the specific Noir and separate Velo payment proofs in B-001 are demonstrated. Do not describe the complete journey as runnable.

**Evidence:** Accepted scope is in [product spec](product-spec.md#scope); live payment proof is in [B-001](../handoff/B-001.md). The remaining journey's current status must be checked in the [implementation plan](implementation-plan.md).

**Likely follow-up:** Does it support multiple children or real merchants?

**Be candid:** Multiple children and production merchant acceptance are outside this demo scope. Do not present any other intended journey as working unless its task has current acceptance evidence.

### 4. What does AI decide?

**Status: Planned; live AI task B-004/B-008 not complete.**

**Answer:** AI is intended to identify the product in an allowance-purchase photo and assess whether its category matches the family's rules. The application applies the rules and decides whether to allow or escalate the request; AI does not authorize payment.

**Evidence:** Intended behavior is in [F-003 and F-005](product-spec.md#features-and-observable-acceptance-criteria); live AI behavior requires the corresponding implementation evidence.

**Likely follow-up:** Can a photo prove what was bought or that its price is fair?

**Be candid:** No. A photo cannot prove delivery, the final purchased item, or a fair price. Uncertain identification is intended to prompt an explanation and retry; do not claim live model performance without task evidence.

### 5. Can a parent approve a purchase that breaks the cap?

**Status: Open; B-002 is Planned.**

**Answer:** The product rule sends over-cap and category-conflict allowance purchases to a parent for review. Whether the payment contract can safely honor an over-cap approval is still an open feasibility item. A parent tapping approve in the app cannot, by itself, override the contract's on-chain cap.

**Evidence:** See the [product feasibility items](product-spec.md#feasibility-and-review-items), [B-002](../handoff/B-002.md), and the [implementation plan](implementation-plan.md).

**Likely follow-up:** What happens if the parent approves but the contract rejects it?

**Be candid:** That safe contract path has not yet been verified. Do not claim the exception flow is complete or that approval guarantees payment.

### 6. What does “private My Money” mean?

**Status: Requirement accepted; implementation and access-control verification Planned.**

**Answer:** The product requirement is that the student's My Money balance and purchase details are not exposed in parent-facing app views, notifications, exports, or APIs. The student can see their own balance and history. This describes the intended app privacy boundary, not anonymity.

**Evidence:** Requirement in [F-007](product-spec.md#features-and-observable-acceptance-criteria); implementation and access-control evidence must be checked in the relevant tasks.

**Likely follow-up:** Is the student's spending anonymous from a parent?

**Be candid:** No anonymity is promised. Public blockchain activity can reveal wallet relationships, and the full server-side access boundary remains to be implemented and verified.

### 7. Does the demo use real money or pay sellers through GCash?

**Status: Testnet only is required; withdrawal journey is Planned and no real peso payout is demonstrated.**

**Answer:** No. The demonstrated payment proofs use Stellar Testnet and no real funds. A Testnet withdrawal is part of the planned journey, not a demonstrated flow. Any peso or GCash payout shown is simulated and does not mean a seller received pesos.

**Evidence:** [Competition context](../seed/context.md#competition-requirements-from-supplied-handbook) and payout findings in the [evidence ledger](../work/evidence-ledger.md).

**Likely follow-up:** Could it pay a seller in pesos today?

**Be candid:** That is not established. A real payout would need an eligible, verified and authorized route; no provider is selected for production settlement.

### 8. What do Noir and Velo each do?

**Status: Demonstrated as two separate Testnet proofs in B-001; task remains In progress pending remote CI and merge evidence.**

**Short answer:** Noir authorization and claim worked on Testnet, and a separate Velo checkout was paid on Testnet. They are not one connected payment flow.

**Technical follow-up:** Noir's SDK interacted with deployed contracts to register the agent, fund escrow, check and authorize a constrained payment, and let the merchant claim pending funds. Velo's SDK created/retrieved a separate checkout, which was paid on Testnet. The Velo checkout did not fund Noir escrow or cause the Noir authorization/claim.

**Evidence:** Exact hashes, statuses, balance snapshots, SDK versions, and limitations are recorded in [B-001](../handoff/B-001.md); component boundaries are in [architecture](architecture.md#responsibilities-and-boundaries).

**Likely follow-up:** Has the integrated Noir/Velo payment flow been proven?

**Be candid:** The two Testnet demonstrations are separate. The Noir authorization and claim succeeded, and the Velo checkout separately succeeded; an end-to-end connection between them has not been demonstrated.

### 9. How does the student receive funds from a parent abroad?

**Status: Production funding and settlement route Open.**

**Answer:** The product proposes parent-funded weekly allowance, but the production funding and peso settlement route is unresolved. Testnet funding in the demo is not a remittance.

**Evidence:** Open routing questions in [architecture](architecture.md#main-flow-and-unresolved-money-routing) and alternatives in the [market comparison](../seed/market.md).

**Likely follow-up:** Are you replacing remittance providers?

**Be candid:** No. The current hypothesis concerns managing agreed spending after funds reach a family; it does not establish a new remittance rail.

### 10. What happens if AI, the network, or a payment call fails?

**Status: Requirements defined; full purchase-flow behavior Planned and unverified.**

**Answer:** The intended behavior treats uncertain identification, a policy rejection, and an unknown payment result as different cases. In particular, an unknown payment result must be reconciled against the transaction before another attempt or balance movement.

**Evidence:** Requirements are in [F-005 and the correctness rules](product-spec.md#important-security-and-correctness-rules); verified behavior belongs in the relevant implementation packet.

**Likely follow-up:** Can the app accidentally charge twice?

**Be candid:** Duplicate prevention and recovery are requirements, not proof of the full purchase flow. State only what the current implementation evidence demonstrates; do not promise a user-visible recovery behavior that has not been verified.

### 11. How do weekly rollover and Savings work?

**Status: Accepted concept; implementation tasks Planned.**

**Answer:** In the accepted demo concept, a clearly labeled application clock advances week start and week end. At week end, leftover Needs move to Savings and leftover Wants move to My Money. A student initiates a Savings release and a parent approves it; released money goes into My Money.

**Evidence:** [F-002 and F-006](product-spec.md#features-and-observable-acceptance-criteria); check the plan and task evidence before describing these as implemented.

**Likely follow-up:** Does advancing demo time change Stellar time or run a production scheduler?

**Be candid:** No. It advances the application's demo clock only. Stellar transaction validity uses real network time; production scheduling is not claimed.

### 12. What would you need before a real-world pilot?

**Status: Preconditions identified; no pilot readiness established.**

**Answer:** Pilot readiness would require evidence that families find the workflow useful; verified designs for identity, privacy, money accounting, and failure recovery; an eligible, authorized route for real-peso funding and payouts; and testing of AI behavior and the merchant experience in the intended setting.

**Evidence:** Open items appear in the [product spec](product-spec.md#feasibility-and-review-items), [market comparison](../seed/market.md), and [technical spec](technical-spec.md).

**Likely follow-up:** What is your business model or acquisition cost?

**Be candid:** Those are not validated in the project documents. Do not invent pricing, profitability, savings outcomes, adoption numbers, or acquisition costs.

### 13. How is this an agentic payment, and what does the agent actually decide?

**Status: Product rules are a concept; B-001 demonstrates constrained Noir agent authorization in an isolated Testnet proof, not a complete student purchase.**

**Short answer:** The intended product lets the application apply family rules to a purchase request, then uses a constrained payment agent to authorize an eligible payment. In the current proof, Noir successfully authorized a bounded Testnet payment and the merchant claimed it; that proof is not connected to a student's photo, allowance balance, or parent review.

**Technical follow-up:** The product assigns image identification to AI and final policy decisions to application rules. The payment agent executes within Noir contract constraints; it does not independently invent family policy. B-001 verifies contract registration, escrow funding, check, authorization, and claim for its fixed proof. The full request-to-payment path remains planned.

**Likely follow-up:** Does the AI agent decide whether to pay?

**Be candid:** No. AI is intended to identify the pictured product. Application policy evaluates the request, and the payment agent/contract path executes only an authorized payment. The full integrated path has not yet been demonstrated.

### 14. What is innovative about PadalaPocket?

**Status: Positioning hypothesis; novelty and user value unvalidated.**

**Answer:** The idea combines family-agreed weekly Needs/Wants budgets, review of some allowance purchases, and a student-controlled balance with constrained Testnet payments. We see that combination as worth exploring for families managing allowance across distance; we have not established that it is unique or that families prefer it to existing wallets and workarounds.

**Evidence:** Concept in the [idea](../seed/idea.md); competitor/workaround comparison and limitations in the [market comparison](../seed/market.md).

**Likely follow-up:** What proves this is new or better?

**Be candid:** Nothing in the current desk research proves novelty or superior outcomes. The comparison is a hypothesis for further validation, not a claim of a market gap.

## Handbook judging-criteria coverage

The handbook assigns **30%** to agentic payments fit, **25%** to technical execution, **20%** to innovation, **15%** to real-world potential, and **10%** to pitch and demo. The questions above prepare for those topics; they do not establish a score or replace the required working submission and demo.

| Handbook criterion | Covered by | Current evidence boundary |
|---|---|---|
| Agentic payments fit (30%) | Q4, Q5, Q13 | Product flow is planned; B-001 proves a constrained, separate Testnet payment slice, not the integrated user journey. |
| Technical execution (25%) | Q7, Q8, Q10, Q11 | Noir authorization/claim and a separate Velo checkout are recorded in B-001; full Velo/Noir end-to-end integration and the rest of the demo remain incomplete. |
| Innovation (20%) | Q2, Q14 | Combination is a positioning hypothesis; novelty and demand are not established. |
| Real-world potential (15%) | Q1, Q9, Q12 | Need, funding/payout route, and pilot readiness remain unvalidated or unresolved. |
| Pitch and demo (10%) | Opening pitch, Q3, Q7, Q8 | The opening pitch states current limits. The full user-facing demo is not yet runnable; refresh status and prepare the actual live demo plus backup required by the handbook. |

## Rehearsal rule

Check the [implementation plan](implementation-plan.md) and linked packet immediately before presenting each technical claim. The plan is the only task-status source; packets hold evidence. Lead with the short answer, then add the technical detail only when asked. Distinguish product requirements from implemented behavior, and distinguish the independent Noir and Velo Testnet proofs from an integrated payment flow. Keep answers direct and state material limitations plainly.
