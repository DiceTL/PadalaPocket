# Business model — working notes

Status: exploration only. The team has not selected a customer price, revenue source, or operating model. The current shortlist to evaluate is referral revenue, merchant service fees, and per-transaction fees; these are hypotheses, not a team decision or validated income. These notes are for Lili to develop; James should challenge assumptions and calculations. Any actual product or business choice belongs to the team.

## What PadalaPocket is trying to do

The current concept is an allowance wallet for students aged 13+ who receive allowance from an OFW parent. It aims to let the parent set boundaries for allowance spending while the student manages some money independently. The accepted demo covers one parent, one student and one seller on Testnet. It does not establish real peso settlement, a viable operating business, demand, or willingness to pay. See [product scope](../docs/product-spec.md), [team-selected audience](../seed/idea.md), and [market comparison](../seed/market.md).

For business-model thinking, keep three roles distinct:

- **User:** likely the student, the parent, or both.
- **Possible paying customer:** most likely the parent or family, but this is not decided or validated.
- **Other stakeholders:** seller, wallet/payment provider, remittance provider, or a sponsor/partner. Their interest and willingness to pay are unknown.

Do not assume that the person who uses the app is also the person who pays.

## Revenue models to evaluate

These three ideas form the current exploration shortlist, not a decision that Padala Pocket will use all of them. There is no defensible fee, provider agreement, or seller willingness-to-pay evidence yet.

| Model | Who could pay and for what | Possible payment trigger / example | Questions and risks |
|---|---|---|---|
| **Referral revenue** | A bank, remittance provider, or other service provider could pay Padala Pocket for a qualified referral | A parent chooses a clearly disclosed provider option, completes the provider's qualifying signup/action, and the provider pays under an agreement | What counts as a valid referral and what is the payout? Does the provider serve the intended customer and permit parent/minor-related referrals? Can recommendations remain suitable and independent? What disclosure, privacy, eligibility, and contract terms apply? No referral agreement exists. |
| **Merchant service fee** | A participating seller pays for payment acceptance, settlement, or seller tools | A seller uses an agreed service, such as receiving payments or accessing sales records | What seller benefit is measurable? Would a seller pay given the current small demo network? What onboarding, support, settlement, and provider costs apply? No seller demand or fee is established. |
| **Per-transaction fee** | Parent, seller, or another agreed payer pays a fee when a payment/transfer completes | The app shows a hypothetical fee before confirmation; the payer agrees and it is collected on completion | Who pays and is the fee fixed or percentage-based? Could it feel large on small purchases? What processing, network, conversion, refund, payout, and failure costs reduce the amount retained? Fee disclosure and actual payment-flow review are necessary. |

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
| Share who pay | TBD | TBD | TBD | Willingness-to-pay evidence or labeled assumption |
| Qualified referrals | TBD | TBD | TBD | Provider-defined qualifying event; validate volumes and eligibility |
| Participating merchants | TBD | TBD | TBD | Seller interest and agreed service scope |
| Eligible completed transactions | TBD | TBD | TBD | Define which payments count and avoid counting a referral as a payment |
| Fee or provider payout per event | TBD | TBD | TBD | Written provider/merchant terms or clearly labeled assumption |
| Gross revenue | Formula | Formula | Formula | Referral payouts + merchant fees + transaction fees, without double-counting |
| Variable costs | Formula | Formula | Formula | Payment/provider, support, payout, refund, and other applicable costs with sources |
| Fixed costs | TBD | TBD | TBD | Hosting baseline, staff/support, legal/compliance and other recurring costs |
| Operating profit/loss | Formula | Formula | Formula | Revenue − variable costs − fixed costs |
| Break-even events or merchants | Formula | Formula | Formula | Fixed costs ÷ contribution per event/merchant, if positive and applicable |

There are no supported numeric inputs yet, so the worksheet intentionally contains no revenue or profit forecast. Keep the **period as one month** and the **currency as PHP** when the team later has inputs. Do not treat the row labels or formulas as a chosen pricing plan.

For the current candidate models, use formulas that match the actual agreement and payment flow:

- Referral revenue = qualifying completed referrals × contracted payout per qualifying referral.
- Merchant-service revenue = participating merchants × contracted fee per period, or completed eligible transactions × contracted per-transaction merchant fee.
- Per-transaction revenue = completed eligible transactions × disclosed fee charged to the agreed payer.
- Contribution by stream = stream revenue − directly associated variable costs.
- Operating result = total contribution across streams − fixed operating costs.
- Break-even event volume = relevant fixed costs ÷ contribution per event, if contribution is positive and the event/unit assumptions match the model.

For low/base/high cases, vary qualifying referrals, participating merchants, eligible transactions, contracted/assumed payout or fees, provider costs, and fixed costs. Avoid choosing inputs just to produce a profit. Do not publish a numerical forecast until assumptions have sources or are clearly marked as illustrative. Use separate scenarios for each model before combining them; combined scenarios must avoid counting the same transaction or referral twice.

## Constraints before any real-money model

- The hackathon rules require Testnet and prohibit real funds. The demo’s fiat payout is simulated; it is not a revenue test.
- The product spec defers real peso/GCash settlement. The project's inability to provide business-registration documents already ruled out relying on Coins.ph business onboarding for this hackathon/startup project under [DEC-004](../docs/decision-ledger.md#dec-004).
- Regulatory classification depends on the actual service and funds flow. BSP guidance asks businesses contemplating stored peso wallets to assess the OPS and e-money rules. That is not a conclusion that PadalaPocket requires a specific licence; the proposed custody, payment, remittance and partner arrangement needs qualified review before a real-money launch. See EV-032.
- A partner's approval, fees, API access, customer eligibility and permission to serve minors are not established by public documentation alone.
- The current MVP scope is one parent, one student and one seller; multiple children, production scheduling and real peso/GCash settlement are deferred. Do not count hypothetical later features as MVP revenue.

## Evidence to gather before choosing

1. Would an appropriate provider pay for referrals, and what event, terms, payout, disclosure, and data handling would apply?
2. Would sellers pay for Padala Pocket's service, what seller benefit would justify it, and what fees do comparable services charge?
3. Who should pay a per-transaction fee, how would it be calculated and disclosed, and what actual provider costs would apply?
4. What are the actual support, payment, payout, security, integration, and compliance cost inputs for each proposed structure?
5. Can the service legally and operationally handle the intended funds, accounts and minors, directly or through an appropriate provider?
6. What evidence would make the team retain, change, or drop each candidate stream?

The team has excluded interviews as a required workflow gate. If it later chooses to collect customer input, ask neutrally about current routines and willingness to pay; don't present a preferred model as already decided.
