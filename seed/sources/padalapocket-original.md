# Original PadalaPocket proposal extracted as text

Extracted on 2026-11-05 from the adjacent original DOCX. Paragraph order is preserved; table layout and visual formatting are not. This is historical source material, not current verified requirements.

HACKATHON IDEA TEMPLATE

PadalaPocket

A weekly allowance wallet for families with a parent working abroad: a payment agent approves the child’s spending within the parent’s limits, then splits what is left between savings and personal money.

The idea, the evidence, and the scope, laid out so others can evaluate it.

SUBMITTED BY

[Name(s) of the person or team]

HACKATHON

[Hackathon name and track]

DATE

[Date]

Hackathon requirements

Table 1: Required for every project

Requirement

How my idea meets it

Agentic payment

Pass (by design). A payment agent approves the child’s purchases on its own, with no parent tap each time. Its limits are a per-purchase cap, the remaining balance of the weekly allowance, allowed categories, and an expiry at the end of the week. Purchases over a limit are rejected or sent to the parent, and the request auto-rejects after 10 minutes. The agent also triggers the week-end sweep of unspent money, signed by the app-held owner key.

Interacts with the latest Noir Testnet contracts

Pass on paper (checked against the Noir repository). Uses device_registry, agent_registry and payment_escrow. The IDs in the original template (deployed 2026-10-07) are retired. The repository redeployed on 2026-10-24 with security fixes, and the current IDs are in Table 7. Every call we need exists: register, register_agent, fund_escrow, authorize, claim, defund_escrow and sweep_on_revoke. Still to do: run the full flow once on Testnet with the new IDs.

Built with Velo

Needs verification. Velo Pay PaymentIntents and signed webhooks for the parent’s deposit, and Gas Station (SDK method gas.sponsor) for fees. The Velo repository confirms both exist as alpha software and that its PDAX integration has been retired. We have not tested whether Gas Station can sponsor Noir’s contract calls, and Velo’s live checkout path is still being qualified, so both have fallbacks (section 8).

1. Name and one-line pitch

PadalaPocket is a weekly allowance wallet for children whose parent works abroad. The parent funds it once, a payment agent approves school and daily spending within the parent’s limits, and whatever is left at week end is split between the child’s savings and the child’s own spending money.

2. Problem background and who has it

Background. The Philippines had about 2.19 million overseas workers in 2024, and many of them are parents. They send money home, but once it arrives they are far from the daily decisions: whether school fare, lunch and supplies are covered, and whether anything is being saved.

Who has it. Working parents abroad, the relatives who care for their children, and school-age children and teens. Estimates of how many children are left behind range from about 1.5 million to 9 million, and there is no reliable official count.

The pain. Parents typically choose between sending a lump sum to a caregiver, which gives the parent little visibility and the child little say, or giving the child unrestricted money (team assumption, not yet validated with parents). Research on transnational Filipino families notes that parents often cope with their absence by giving children money and material goods (Parreñas, 2001), which does not teach budgeting or saving. Time zones add a further gap when a child needs an urgent purchase approved.

3. Facts and evidence

Table 2: Supporting facts

Fact or statistic

Source

Year

The number of Overseas Filipino Workers reached about 2.19 million in 2024, up 1.5% from 2023.

Philippine Statistics Authority, Survey on Overseas Filipinos (as reported by Inquirer.net and GMA News)

2024

Overseas Filipinos sent home about ₱262.2 billion in remittances in 2024.

Philippine Statistics Authority (as reported by The Global Filipino Magazine)

2024

Estimates of children left behind by OFW parents range from at least 1.5 million to about 9 million; there is no systematic official count.

Princeton JPIA, citing Bernardo et al. (2025); Reyes, UNICEF-sponsored literature review (2008)

2025 and 2008

4. The solution and what makes it different

What we build. A parent app and a child app on Stellar Testnet. The parent deposits funds and sets the rules once: the weekly allowance, how it divides between needs (food, fare, school supplies) and wants, a per-purchase cap, allowed categories, and an optional fixed savings contribution.

Three balances for the child. Allowance (needs and wants, spent only within the rules), Savings (locked, set by the parent) and My Money (the child’s own, free to spend without approval).

How the agent works. When the child taps to pay, the payment agent checks the rules and approves or rejects the purchase on its own. Over-limit requests go to the parent and auto-reject after a timeout. At week end the agent sweeps what is unspent: leftover needs money moves to Savings and leftover wants money moves to My Money.

Example. A ₱1,500 weekly allowance is ₱900 for needs and ₱600 for wants. The child spends ₱700 on needs and ₱100 on wants. The remaining ₱200 goes to Savings and ₱500 goes to My Money.

What makes it different:

Rewards saving without punishing real needs. Leftover needs money goes to savings, not spending money, so a child cannot pocket cash by skipping lunch.

Freedom within limits. My Money belongs to the child and needs no approval, so the child learns to budget by making real choices.

The agent acts twice. It approves purchases during the week and decides the week-end sweep.

Built for distance. One deposit from abroad, rules set once, and approval requests that expire instead of blocking the child.

5. Expected impact

Parents abroad: fund the week in a single deposit, set the rules once, and see allowance spending without approving every purchase.

Children: learn to budget with real money. A child who leaves ₱200 of needs money unspent each week builds ₱10,400 in savings over 52 weeks (illustrative), and keeps unspent wants money as personal money.

Caregivers and merchants: caregivers no longer handle the child’s cash, and merchants are paid from pre-funded escrow instead of waiting on a transfer from the parent.

6. MVP scope: in and out

Table 3: Included vs. not included

Included in the MVP

Not included

Parent screen: deposit funds, set the weekly allowance, the needs and wants split, the per-purchase cap and categories.

Real-money on-ramp and off-ramp, and live currency conversion (pesos shown at a fixed demo rate).

Child screen with Allowance, Savings and My Money balances.

Savings goals, weekly recap, and parent matching or interest on savings.

Payment agent that approves or rejects simulated tap purchases against the rules.

Real tap hardware and real merchants such as a school canteen.

Over-limit purchase sends a parent approval request that auto-rejects after 10 minutes.

Push notifications, multiple children, and multiple guardians.

Week-end sweep by the agent (demo button fast-forwards the week): needs remainder to Savings, wants remainder to My Money.

Automatic production scheduling, identity checks for minors, and regulatory work.

7. How it could work (high level)

Table 4: Technical outline

Area

Details

Agent and payment flow

The parent signs once to register two Noir devices for the child, a Needs device and a Wants device. Each has its own agent policy (max per payment, asset, expiry at week end) and its own funded escrow, so each bucket’s balance is enforced on-chain. A simulated tap triggers a payment request. The backend agent checks category and cap, then authorizes with a nonce or rejects, and merchants claim from escrow. At week end the app-held owner key withdraws each remainder with defund_escrow and the backend forwards it: needs remainder to Savings, wants remainder to My Money. A new policy is registered for the next week.

Noir Testnet contracts used

device_registry: register, get_device, is_authorized. agent_registry: register_agent, get_policy, check_payment, revoke_agent. payment_escrow: fund_escrow, authorize, claim, defund_escrow, sweep_on_revoke. The @noirx402/agent-sdk (0.3.0) wraps these calls. Per the repository, escrow is tied to one token per device, agent registration follows the device owner’s ownership rules, and defund_escrow and sweep_on_revoke return funds to the owner wallet, not to anyone else. Current IDs are in Table 7.

Velo components used

Velo Pay PaymentIntent for the parent’s deposit, with a signed payment.succeeded webhook to credit the ledger and fund the escrows. Gas Station (SDK gas.sponsor, Testnet only, alpha) to sponsor fees. Noir’s repository notes that the first authorize costs roughly 2.3 XLM in Testnet fees, so the agent accounts need XLM or sponsorship. The Velo Playground and contract event monitor help debug the demo.

Other tech or data

Web app with parent and child views, plus a backend rules engine and ledger. Category rules and the Savings and My Money balances live off-chain, because the agent policy covers only amount, asset and expiry. Testnet XLM, as the Noir app uses, shown in pesos at a fixed rate. Mocked: merchants and tap hardware (simulated device IDs), peso conversion, parent notifications. Seeded: one demo child and one week of purchases.

8. Risks and open questions

Table 5: Risks

Risk or open question

How you'd handle it

Category and merchant rules are not part of the on-chain policy.

Enforce them in the backend agent before calling authorize, and say so in the demo. The chain still enforces amount, asset, expiry and escrow balance.

A child could skip real needs to keep the leftover money.

The needs and wants split sends leftover needs money to Savings. The parent also gets an alert when spending is unusually low.

The parent is unavailable (time zone) when an over-limit purchase needs approval.

Requests auto-reject after 10 minutes. Possible later addition: a parent-set emergency buffer.

Velo’s live checkout path may not be ready on Testnet.

Fallback: the deposit is a direct Testnet transfer from the parent’s wallet, with a webhook-style event. Keep Gas Station and webhooks if available.

Noir contract IDs change on redeploy (they did on 2026-10-24, and old policies and balances do not carry over). The weekly sweep also needs the owner’s signature, not the agent’s.

Read IDs from config and re-check the repository README the day before the demo. The app-held owner key signs the weekly sweep and re-registers the policy; say so openly in the demo.

No real merchants or peso settlement in the hackathon, and Velo has retired its PDAX integration.

Use a simulated tap page and a fixed demo rate, clearly labelled as simulated.

Wallets for minors raise custody and compliance questions.

Out of scope for the MVP. The app holds the child’s keys under the parent’s account; flag as a future legal review.

Gas Station may not sponsor Noir’s calls (Testnet-only alpha with a contract allowlist and a single-signature rule), and Noir’s first authorize costs about 2.3 XLM in fees.

Fund the agent accounts with Testnet XLM before the demo, and use Gas Station only if a trial sponsorship works.

Reference: mandatory Noir and Velo integration

These two repositories are required by the hackathon, not optional technology suggestions. Use them to test whether the proposed project can genuinely meet the rules. Review current READMEs, deployments, and technical limitations before making claims; the information below is a starting reference, not a guarantee of current availability.

Required repositories: https://github.com/noirx402/noir  |  https://github.com/Velo-Ecosystem-Collection/Velo

Noir (Stellar / Soroban, x402 tap-to-pay)

Noir lets a hardware tap debit a linked wallet through Soroban contracts, using a per-device agent.

Table 6: Noir contracts

Contract

What it does

Key methods

device_registry

Maps a hashed device ID to a wallet and its agent.

register, revoke, get_device, is_authorized

agent_registry

Authorizes an agent under a policy of max amount, asset, and expiry. Max 0 means uncapped; expiry 0 means none.

register_agent, revoke_agent, get_policy, check_payment

payment_escrow

Wallet pre-funds escrow; agent authorizes payments with a nonce; merchants claim in batch.

fund_escrow, authorize, claim, defund_escrow, sweep_on_revoke

Table 7: Current Testnet contract IDs (redeployed 2026-10-24; the 2026-10-07 IDs in the original template are retired)

Contract

ID

device_registry

CAC4KOLHDLDYDWBOKXNKRN5KVHO56PLOIFXDLTBUWGVN6GVDEB7FQHU5

agent_registry

CCMZDSPTLX7IIJWCYEUM5DJUHOSOYSTHGK777S2TXZWEMC5ZZGPJ3EBV

payment_escrow

CC7EAW5FNJEDBS7THM5IT6XIOHO4AOYMLXT3KSZ3HWUIKEACTW7E5BFS

Every redeploy creates fresh contract instances with new IDs. Confirm these against the repo's deploy-evidence folder or the hackathon organizers before relying on them.

Velo (Stellar application operations)

Velo is a developer layer around Stellar: build, verify, observe, pay, settle.

Table 8: Velo components useful for an agentic payment

Component

What it offers

Velo Pay

PaymentIntents via the API or the server-side @carts1024/velo-sdk, with idempotency, plus hosted checkout. Only the backend, after verifying the ledger, can mark a payment as paid.

Signed webhooks

HMAC-SHA256 signed payment.succeeded events with retries and delivery logs.

Gas Station

Sponsors eligible Testnet fees under daily caps, per-wallet quotas, and a contract allowlist.

Registry and PayAccess

VeloRegistry: CDIWR3WQ7DKQORRRAZOTWFQ2AOZZOFFNA3CUTL5CJPL4JVZ2GMF27V37. VeloPayAccess: CAXMXAWM7QSW57TE3MG2DQI6ZG4UQPYK3VGPMF5K7XO5ASEEJ7IXL7RH.

Tooling

Playground, transaction debugger, contract event monitor, and @carts1024/velo-wallets.

Limits to plan around: Velo’s checkout is code-complete but its live end-to-end path is still being qualified. Velo has since retired its PDAX integration, so peso cash-out is not available through Velo, and mainnet settlement is not implemented. Gas Station is Testnet only.

Requirement assessment

Agentic payment: pass (by design). The agent approves purchases and triggers the sweep under explicit parent-set limits (cap, balance, categories, expiry). The sweep itself is signed by the app-held owner key.

Noir Testnet contracts: pass on paper. The repository shows every call we need, and the 2026-10-07 IDs from the template are retired in favour of the 2026-10-24 redeploy. Not yet run by us on Testnet.

Velo: needs verification. Velo Pay and signed webhooks handle the deposit, and Gas Station handles fees. Both are alpha, Gas Station support for Noir’s calls is untested, and live checkout is still being qualified, so a direct Testnet transfer is the fallback.

Open items and dependencies: category rules run off-chain; merchants, tap hardware, peso conversion and parent notifications are simulated; project name, team, hackathon and date are still to be filled in.
