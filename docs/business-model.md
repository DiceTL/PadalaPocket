# Business model — revenue options to evaluate

**Current status:** Under [DEC-046](decision-ledger.md#dec-046), the finalized working revenue model is a **₱149 monthly subscription per household**, paid by the parent separately from allowance funds, with no family per-transaction fee. This is a team-selected planning price, not validated willingness to pay or guaranteed profitability. Under [DEC-047](decision-ledger.md#dec-047), conversion occurs when the parent sends weekly allowance, averaging 4.33 conversions per household/month. Under [DEC-050](decision-ledger.md#dec-050), the scenario uses a **flat ₱2 per conversion planning assumption**, not a verified provider quote. Coins.ph's consumer Coins Convert example lists no explicit trading fee for XLM/PHP, but its market-dependent sell spread remains unquantified and it is not a selected or integrated PadalaPocket route (EV-038). Payment provider, route, operating costs, family affordability, and real-world profitability remain unverified. See the [working assessment](../work/business-model-reference.md) for volume, cost, profit/loss, and break-even scenarios. No billing feature has been implemented.

The modeled conversion frequency follows the team's weekly parent allowance-send decision (DEC-025) and the founder's clarification (DEC-047). The flat ₱2 conversion amount is an assumption from DEC-050. Coins.ph's researched ₱0 explicit-fee example is specific to its consumer Coins Convert product; actual sell spread, business/API eligibility, and route charges require provider confirmation.

## Candidate revenue streams

| Option | Who could pay | What could trigger payment | Main question |
|---|---|---|---|
| **Referral revenue** | A bank, remittance provider, or other service provider | A parent completes a qualifying signup or other agreed action after choosing a clearly disclosed referral | Would a suitable provider pay, and can recommendations remain appropriate and trustworthy for families? |
| **Merchant service fee** | A participating seller | The seller uses Padala Pocket's payment acceptance or seller service | What measurable benefit would justify the seller's fee? |
| **Per-transaction fee** | Parent, seller, or another agreed payer | A payment or transfer is completed and the disclosed fee is charged | Who pays, how much can the transaction support, and what payment costs apply? |
| **Monthly household subscription (selected direction)** | Parent | Monthly access to the agreed family allowance-coordination service at ₱149 per household | Will parents pay this price, and can net monthly contribution cover service, conversion, and acquisition costs at reachable scale? |
| **Sponsored family access / organizational SaaS** | Potentially an OFW employer, remittance provider, or family-support program | Fixed fee for active households or a capped service period, independent of family spending volume | Fallback if direct payment is too burdensome; sponsor demand and economics remain unverified. |
| **Aggregated analytics** | Public-health organization or research institution | A defined, privacy-reviewed report or dataset | Does the product collect relevant data, is there a legitimate buyer need, and can privacy risks be acceptably controlled? This is not supported by the current product scope. |

The selected model is a parent-paid **₱149 monthly household subscription**. The fee must be shown separately from any allowance transfer and must not be silently deducted from the student's balance. Allowance purchases do not create subscription revenue and no per-transaction charge is selected. Conversion spreads or fees are modeled as business costs, not automatically passed to families. Neither price affordability nor profitability is validated. Do not imply subscription billing, a billing provider, production payment capability, or profitability exists.

## What the business model still needs to answer

- **Users and payers:** Students may use the product, while a parent, seller, service provider, or partner could pay. Do not assume the user and payer are the same person.
- **Value offered:** The proposed value is helping students manage allowance, helping parents support them from a distance, and potentially helping sellers receive or track payments. Which benefits matter enough to pay for remains unknown.
- **Money flow:** Map who sends money, who receives it, who charges the fee, and how Padala Pocket gets paid for each candidate model.
- **Separation of funds:** Prefer evaluating subscription/sponsorship billing separately from student allowance funds. A product fee must not silently reduce a student's allowance or balance.
- **Family protection:** Evaluate fixed sponsor funding before charges on family funding, purchases, or withdrawals. Any sponsor must not receive individual spending, balance, purchase-photo, or student-health data as a condition of access.
- **Costs:** Account for payment processing, payout, hosting, maintenance, support, security, partner integration, refunds or failed payments, and applicable compliance work. Which costs apply depends on the eventual operating arrangement.
- **Economics:** Revenue is not profit. Monthly operating result = retained paying households × ₱149 − subscription collection fees − weekly-send conversion charges/spread − variable service cost − fixed operating and acquisition costs. EV-035–EV-038 record public pricing evidence and its limits. Actual provider route, spread, recurring fees, retention, and cost to serve remain unknown.
- **Trust and disclosure:** Show any payment fee before confirmation and label paid referrals clearly. A referral payment must not be the reason a service is recommended, particularly for families and minor users.
- **Evidence needed:** Provider referral terms, seller interest and value, family response to fees, actual payment-provider pricing, and review of the real-money flow and applicable requirements.
- **Minors and trust:** Do not assume advertising, profiling, financial-data resale, lending, balance yield, or a crypto fee is acceptable just because it can produce income. Any proposal in those areas needs a clear user benefit, data minimization, transparent terms, and appropriate privacy, safeguarding, and regulatory review.

## Current limits

The accepted demo is Testnet-only, with one parent, one student, and one demo seller. It does not establish real-peso settlement, provider access, production payment costs, demand, or willingness to pay. Real peso/GCash settlement is deferred; see [DEC-029](decision-ledger.md#dec-029) and the [detailed business-model working notes](../work/business-model-reference.md). The team also cannot rely on Coins.ph business onboarding for this project under [DEC-004](decision-ledger.md#dec-004).

Regulatory classification depends on the actual service and funds flow. BSP materials describe activities that may fall within payment-system oversight; this is not a legal determination about Padala Pocket. Any real-money model needs qualified review and an appropriate provider/operating arrangement before launch. See EV-032 in the evidence ledger.

**Next business question:** Can families afford and retain a ₱149/month subscription, and which verified subscription and XLM-to-PHP routes produce positive contribution after actual fees and conversion frequency?

See the [detailed options and evaluation worksheet](../work/business-model-reference.md). James should challenge the assumptions and calculations before the team makes a choice.
