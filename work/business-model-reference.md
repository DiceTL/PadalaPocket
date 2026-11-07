# Business model — working notes

Status: the team finalized a **₱149 monthly household subscription** under [DEC-046](../docs/decision-ledger.md#dec-046); affordability and profitability remain unvalidated. The computation uses a founder-selected **₱2 per weekly allowance conversion planning assumption** under [DEC-050](../docs/decision-ledger.md#dec-050), not a provider quote. Coins.ph publishes a Coins Convert example with no explicit trading fee but an unquantified, market-dependent spread for XLM/PHP (EV-038). This assessment compares the selected subscription with sponsor/B2B, transaction and merchant revenue, referrals, grants, advertising/data, and financial-product alternatives. The screenshots supplied on 2026-11-07 are proposal references only; their client tiers, volumes, prices, revenue, and margins are not sourced evidence.

## What PadalaPocket is trying to do

The current concept is an allowance wallet for students aged 13+ who receive allowance from an OFW parent. It aims to let the parent set boundaries for allowance spending while the student manages some money independently. The accepted demo covers one parent, one student and one seller on Testnet. It does not establish real peso settlement, a viable operating business, demand, or willingness to pay. See [product scope](../docs/product-spec.md), [team-selected audience](../seed/idea.md), and [market comparison](../seed/market.md).

For business-model thinking, keep three roles distinct:

- **User:** likely the student, the parent, or both.
- **Selected payer direction:** parent pays a household subscription; the actual customer's willingness to pay is not validated.
- **Other stakeholders:** seller, wallet/payment provider, remittance provider, or a sponsor/partner. Their interest and willingness to pay are unknown.

Do not assume that the person who uses the app is also the person who pays.

## Revenue models to evaluate

Under [DEC-047](../docs/decision-ledger.md#dec-047), conversion occurs when the **parent sends the weekly allowance**, not when the student purchases something. The product's weekly allowance schedule implies an average of **52 ÷ 12 = 4.33 parent sends/conversions per household per month**. Purchase counts are shown as usage volume but do not multiply the conversion cost.

Provider research found that Coins.ph's Coins Convert supports XLM/PHP and charges no explicit trading fee, but its buy/sell prices differ due to market-dependent spread. The spread is not quantified, conversion minimums vary, and consumer Buy/Sell requires identity verification (EV-038). This is a provider example, not a selected or integrated PadalaPocket route. Per [DEC-050](../docs/decision-ledger.md#dec-050), the computation uses a **founder-selected ₱2 per weekly allowance conversion planning assumption**. This is not a verified provider quote or a cap on the actual spread. No family transaction fee is charged.

The model assumes Xendit's public international-card price example for the ₱149 subscription: 4.5% + ₱10 + ₱11 = **₱27.705 per household/month**, before applicable taxes; **₱10 other variable cost per household/month**; and **₱100,000 monthly fixed plus acquisition costs**. These are scenario inputs, not actual PadalaPocket costs. The ₱2 conversion assumption excludes any separate transaction-level network/provider charges; actual total conversion spread and business-route eligibility remain unresolved. Coins.ph consumer conversion pricing does not establish business/API eligibility; PadalaPocket's existing Coins.ph business-onboarding constraint remains in DEC-004.

| Active paying households | Allowance purchases/household/month | Est. purchases/month | Parent allowance sends/conversions per household/month (average) | Est. conversions/month | Subscription price/household | Total gross monthly revenue | Subscription processing | Conversion cost/month at ₱2 each | Other variable costs | Fixed + acquisition costs | Modeled operating profit/(loss) | Operating margin proxy |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 5 | 5,000 | 4.33 | 4,333 | ₱149 | ₱149,000 | ₱27,705 | ₱8,667 | ₱10,000 | ₱100,000 | **₱2,628** | 1.8% |
| 1,000 | 10 | 10,000 | 4.33 | 4,333 | ₱149 | ₱149,000 | ₱27,705 | ₱8,667 | ₱10,000 | ₱100,000 | **₱2,628** | 1.8% |
| 1,000 | 20 | 20,000 | 4.33 | 4,333 | ₱149 | ₱149,000 | ₱27,705 | ₱8,667 | ₱10,000 | ₱100,000 | **₱2,628** | 1.8% |
| 3,000 | 5 | 15,000 | 4.33 | 13,000 | ₱149 | ₱447,000 | ₱83,115 | ₱26,000 | ₱30,000 | ₱100,000 | **₱207,885** | 46.5% |
| 3,000 | 10 | 30,000 | 4.33 | 13,000 | ₱149 | ₱447,000 | ₱83,115 | ₱26,000 | ₱30,000 | ₱100,000 | **₱207,885** | 46.5% |
| 3,000 | 20 | 60,000 | 4.33 | 13,000 | ₱149 | ₱447,000 | ₱83,115 | ₱26,000 | ₱30,000 | ₱100,000 | **₱207,885** | 46.5% |
| 5,000 | 5 | 25,000 | 4.33 | 21,667 | ₱149 | ₱745,000 | ₱138,525 | ₱43,333 | ₱50,000 | ₱100,000 | **₱413,142** | 55.5% |
| 5,000 | 10 | 50,000 | 4.33 | 21,667 | ₱149 | ₱745,000 | ₱138,525 | ₱43,333 | ₱50,000 | ₱100,000 | **₱413,142** | 55.5% |
| 5,000 | 20 | 100,000 | 4.33 | 21,667 | ₱149 | ₱745,000 | ₱138,525 | ₱43,333 | ₱50,000 | ₱100,000 | **₱413,142** | 55.5% |

At ₱2 per weekly send, conversion cost averages **₱8.67 per household/month**, contribution after listed variable costs is **₱102.63 per household/month**, and modeled break-even is **975 paying households/month**.

Formula: **gross monthly revenue = active paying households × ₱149**; **conversion cost = weekly parent sends × ₱2**; **modeled operating profit/loss = gross revenue − subscription processing − conversion cost − other variable costs − ₱100,000 fixed/acquisition costs**. Operating margin proxy = modeled operating profit/loss ÷ gross revenue. Purchase volume is shown for context and does not change conversion count under the clarified money flow. The margin is a pre-tax operating proxy, not a verified net profit margin. Coins.ph's explicit trading-fee example is zero but its spread remains unknown (EV-038); Xendit is only a public subscription-processing example (EV-035). No per-purchase fee is charged to families.

**Review conclusion:** the ₱149 subscription remains the finalized planning price. At 1,000 households, the model shows ₱2,628 operating profit before spread; at 3,000 and 5,000 households it shows ₱207,885 and ₱413,142 respectively. Actual spread, provider eligibility, recurring service/acquisition costs, and family affordability remain unvalidated; these are scenarios, not a forecast.
### Screenshot proposal review

The supplied Stream 1 image proposes entity-based B2G/B2B SaaS tiers plus ₱1.30 per transaction. Its Basic, Professional, and Enterprise client labels and volumes are assumptions with no cited basis. The displayed monthly totals do not match the displayed base price plus per-transaction formula:

| Tier | Displayed base + volume | Formula result | Displayed monthly revenue |
|---|---:|---:|---:|
| Basic | ₱6,451.20 + 4,000 × ₱1.30 | ₱11,651.20 | ₱11,635.51 |
| Professional | ₱8,681.28 + 40,000 × ₱1.30 | ₱60,681.28 | ₱58,724.35 |
| Enterprise | ₱27,392.41 + 400,000 × ₱1.30 | ₱547,392.41 | ₱545,823.13 |

The shown net margins cannot be assessed because their cost bases are not provided. Do not reuse screenshot prices, transaction volumes, revenue totals, or margins as forecasts or recommended pricing.

The supplied Stream 2 image proposes monetizing anonymized community nutrition trends. That is outside the current product scope: no such data product or relevant dataset is established. The NPC's current advisory reminds platforms processing children's personal data of their DPA obligations, including transparency, legitimate purpose, proportionality, and concerns about profiling (EV-033). A privacy review should also assess small-group re-identification and sensitive-inference risks; those are threat-model questions, not verified findings about PadalaPocket. A claim of anonymization alone does not establish safety or legality. The buyer, legitimate purpose, data provenance, minimum aggregation, retention, notice/consent basis, and safeguards are unknown. Do not add health data collection to the product based on this image.

### Fit and current ranking

1. **Monthly household subscription — selected direction; price finalized, affordability and profit unvalidated.** It gives direct recurring revenue and avoids per-purchase charges, but puts a ₱149 bill on the parent and competes with existing wallets/manual routines. Profit needs enough retained subscribers above break-even after provider and conversion costs.
2. **Sponsor-funded access — family-friendly fallback, very low confidence on buyer demand.** Could reduce the family bill, but sales cycles, sponsor concentration, and custom support may harm margins. Revisit if families resist direct billing and a sponsor shows a real budget.
3. **Free core + optional subscription add-on — possible future refinement, very low confidence.** Reduces exclusion but needs an agreed boundary between free and paid value and adds product complexity. Not selected.
4. **Grant/CSR and referral revenue — possible supplements, not dependable core revenue.** Grants may be non-recurring; referral payments require suitable terms and independent recommendations.
5. **Merchant service fees, card economics, or B2B white-label — weak near-term fit.** These need merchant/provider demand, production payment capability, integration and support; merchant acquisition may trigger additional oversight for covered operators (EV-034).
6. **Per-transaction fees, behavioral ads, family-data sales, balance yield, lending/BNPL, and crypto revenue — poor fit for the initial model.** These create greater family cost, trust, privacy, debt, custody, or financial risk than current evidence justifies.

**Family-first conditions for any sponsor fallback:** family participation must be voluntary; sponsor payment must not vary with the amount or frequency of family spending; sponsors must not hold family funds or control spending; and they receive no individual balance, purchase, photo, or health data. Any reports should be limited to service operations and reviewed aggregate counts needed to administer a contract. Families retain a clear route to another funding provider, and the service needs a continuity or export path if sponsorship ends. These are safeguards to evaluate, not product requirements adopted by the team.

The selected subscription direction should be reconsidered if families will not pay ₱149, recurring value is weak, or realistic acquisition and service costs put break-even above reachable scale. Price acceptance and a plausible path to recover fixed costs both need evidence.
### Smallest useful validation plan

1. **Price/value check:** ask parents neutrally what they use now, what problem remains, how they react to the team-selected hypothetical ₱149 monthly household plan, and whether their available payment method/currency would add charges. Stated interest is not proof of paid retention.
2. **Cost-to-serve check:** obtain actual billing-provider pricing and estimate variable support, hosting/AI, refunds, security, and customer-acquisition costs. Include engineering and operator time rather than treating it as free.
3. **Retention/scale check:** estimate how many households must remain paid and for how many months to recoup acquisition cost; compare that requirement with a reachable, evidence-backed audience rather than the national OFW total.
4. **Decision gate:** retain ₱149 as the selected planning price, but validate family acceptance and measured contribution plus a credible retention/acquisition plan before calling it sustainable. If direct billing is too burdensome but a sponsor can show a funded cohort contract, revisit sponsorship. Do not claim profitability before these checks.
### How to compare each idea

For each candidate, document:

1. **Payer:** the person or organization charged.
2. **Value:** the service or benefit they receive.
3. **Trigger:** the event that creates the payment obligation.
4. **Money flow:** who sends/receives funds and how Padala Pocket is paid.
5. **Costs and requirements:** payment/provider costs, operations, support, security, integration, and any applicable review.
6. **Unknowns and evidence:** the source or experiment needed before treating the idea as viable.

The models may overlap: a merchant service fee could be calculated per transaction. State both what service is being paid for and how the fee is calculated. Do not call a fee collected “profit”; subtract applicable costs first. Show payment charges before confirmation and label paid referrals. Avoid recommending a provider because it pays a referral fee, especially in a product used by minors.

## Cost model: inputs still missing

Build a cost list before making a revenue or break-even claim. Separate fixed and per-family/per-transaction costs, and separate the Testnet demo from a hypothetical real-money service.

**Potential recurring/fixed costs:** product engineering and maintenance; hosting and database baseline; security reviews; customer support; legal and regulatory advice; accounting and company operations; provider minimums or commercial contracts.

**Potential usage-linked costs:** image-AI calls and storage; payment processing; network or provider fees; conversion and payout fees; identity checks or fraud tools; chargebacks, failed payments and support time. Which costs apply depends on the eventual product and licensed-provider arrangement.

The current prototype has no real peso transaction costs to use as a proxy for production economics. Testnet results cannot establish real payment-provider prices, remittance charges, or merchant settlement costs. Obtain actual pricing or written estimates from selected providers before filling in amounts.

## Scenario and break-even worksheet

Use a period such as one month and one currency consistently. Label every input as **sourced**, **assumption**, or **unknown**.

| Monthly measure | Low case | Base case | High case | Input/source to add |
|---|---|---|---|---|
| Active families | TBD | TBD | TBD | Adoption evidence; not the total OFW population |
| Paying households / conversion | TBD | TBD | TBD | Observed paid conversion and retention; signups are not paying subscribers |
| New paying households / CAC | TBD | TBD | TBD | Acquisition channel spend ÷ new subscribers; include replacement of churn |
| Monthly household price | ₱149 finalized planning price | — | — | Team decision DEC-046; price reactions are not paid-demand evidence |
| Contracted sponsors/cohorts | TBD | TBD | TBD | Named buyer, budget owner, signed pilot/contract evidence |
| Sponsor fee per period | TBD | TBD | TBD | Written commercial terms; do not infer from the screenshot tiers |
| Qualified referrals | TBD | TBD | TBD | Provider-defined qualifying event; validate volumes and eligibility |
| Participating merchants | TBD | TBD | TBD | Seller interest and agreed service scope |
| Eligible completed transactions | TBD | TBD | TBD | Define which payments count and avoid counting a referral as a payment |
| XLM-to-PHP conversions | Paying households × 52/12 | Paying households × 52/12 | Paying households × 52/12 | Weekly parent allowance sends per DEC-025/047; count independent of student purchases |
| Conversion-cost assumption per weekly send | ₱2 | ₱2 | ₱2 | Founder-selected planning assumption; not a provider quote or cap on spread (DEC-050, EV-038) |
| Conversion spread | Unknown | Unknown | Unknown | Check actual quoted XLM sell rate and reference rate at conversion |
| Fee or provider payout per event | TBD | TBD | TBD | Written provider/merchant terms or clearly labeled assumption |
| Gross revenue | Formula | Formula | Formula | Paying households × subscription price + any separately validated supplemental streams; avoid double-counting |
| Variable costs | Formula | Formula | Formula | Subscription processing + conversions × conversion cost + support/AI/hosting/refunds and other applicable costs |
| Fixed costs + acquisition | Formula | Formula | Formula | Engineering, baseline operations, sales/acquisition spend, support, security and compliance; avoid double-counting |
| Operating profit/loss | Formula | Formula | Formula | Revenue − variable costs − fixed costs |
| Break-even paying households | Formula | Formula | Formula | (Fixed costs + acquisition spend) ÷ contribution per retained household, if positive |

There are no supported numeric inputs for conversion spread, retention, or actual operating costs, so the worksheet is not a revenue or profit forecast. Keep the **period as one month** and the **currency as PHP**. The ₱149 is a team-selected planning price under DEC-046, not a proven market price. The ₱2 conversion assumption is a team-selected assumption under DEC-050, not a quoted tariff; Coins.ph's ₱0 explicit-fee example does not mean zero total conversion cost because its spread and route eligibility remain unresolved.

For the current candidate models, use formulas that match the actual agreement and payment flow:

- Referral revenue = qualifying completed referrals × contracted payout per qualifying referral.
- Monthly subscription revenue = retained paying households × monthly household price.
- Sponsor revenue = only if separately adopted: contracted fixed cohort fee, or billable active households within an agreed cohort cap × contracted fee per active household per period.
- Merchant-service revenue = participating merchants × contracted fee per period, or completed eligible transactions × contracted per-transaction merchant fee.
- Per-transaction revenue = completed eligible transactions × disclosed fee charged to the agreed payer.
- Contribution by stream = stream revenue − directly associated variable costs.
- Operating result for the selected model = retained paying households × (₱149 − subscription collection cost per household − other variable cost per household) − conversions × conversion cost − fixed operating costs − monthly acquisition spend.
- Break-even paying households = (fixed operating costs + monthly acquisition spend) ÷ contribution per retained household, where contribution includes subscription collection, per-household variable costs, and assumed conversion count per household. It applies only if contribution is positive and period/retention assumptions match.

For low/base/high cases, vary paying households, paid conversion, retention/churn, price, billing/variable costs, new subscribers/CAC, and fixed operating costs. Avoid choosing inputs just to produce a profit. Label scenarios as assumptions until inputs have evidence. Use separate scenarios for each model before combining them; combined scenarios must avoid counting the same family or revenue twice.

## Constraints before any real-money model

- The hackathon rules require Testnet and prohibit real funds. The demo’s fiat payout is simulated; it is not a revenue test.
- The product spec defers real peso/GCash settlement. The project's inability to provide business-registration documents already ruled out relying on Coins.ph business onboarding for this hackathon/startup project under [DEC-004](../docs/decision-ledger.md#dec-004).
- Regulatory classification depends on the actual service and funds flow. BSP guidance asks businesses contemplating stored peso wallets to assess the OPS and e-money rules. That is not a conclusion that PadalaPocket requires a specific licence; the proposed custody, payment, remittance and partner arrangement needs qualified review before a real-money launch. See EV-032.
- A partner's approval, fees, API access, customer eligibility and permission to serve minors are not established by public documentation alone.
- The current MVP scope is one parent, one student and one seller; multiple children, production scheduling and real peso/GCash settlement are deferred. Do not count hypothetical later features as MVP revenue.
- A recurring subscription charge is not part of the accepted Testnet product flow. Billing provider, currency handling, entitlement/cancellation/refund behavior, pricing disclosure, and UI design are unselected; do not imply they are implemented.

## Evidence to gather before setting price or building billing

1. What share of qualified families will pay ₱149 per month, and how many remain paid after initial use?
2. Which provider/method can be activated for the team's business, and what are its account-specific recurring fees, conversion spread/charges, failure/refund rates, and cross-border card/FX costs for an OFW parent? Public price pages are only a starting point (EV-035–EV-038).
3. What are monthly variable and fixed cost-to-serve, including acquisition and engineering/operator time?
4. At the observed contribution per retained subscriber, is break-even scale reachable without excluding the families the product aims to help?
5. If direct billing proves too burdensome, is there a sponsor with actual budget and a family-safe contract path?
6. What product requirements, UI design, billing provider, and implementation task must be agreed before subscription billing is built?

The team has excluded interviews as a required workflow gate. If it later chooses to collect customer input, ask neutrally about current routines and willingness to pay; don't present a preferred model as already decided.
