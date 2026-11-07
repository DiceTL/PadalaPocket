# PadalaPocket technology glossary — reference

Audience: teammates preparing the demo and judge Q&A. This reference explains the architecture in plain language and separates implemented evidence from planned product behavior. The [architecture](../docs/architecture.md) is the canonical system overview; detailed contracts and limits are in the [technical spec](../docs/technical-spec.md). Task status is in the [implementation plan](../docs/implementation-plan.md).

## How to describe the current build

**Verified finding:** Shared workspace infrastructure, hosted health routing, contract fixtures, and an isolated operator-only Noir/Velo proof exist. The B-001 packet records successful Testnet Noir device/agent registration, escrow funding, authorization and merchant claim, plus a separate Velo checkout. These are separate demonstrations; they do not establish a complete family product flow.

**Not yet verified as a product flow:** Parent/student login and screens, AI photo assessment, parent decisions, recurring allowances, the weekly money lifecycle, My Money, and an authenticated anchor withdrawal. The architecture and technical spec describe proposals for these areas. Do not present plans, synthetic fixtures, or isolated proofs as completed functionality. See [B-001 evidence](../handoff/B-001.md), [S-001 evidence](../handoff/S-001.md), and [S-002 packet](../handoff/S-002.md).

## Terms

### Agent

**Meaning:** Software that uses rules or a model to choose or request an action, then calls other software to carry it out.

**PadalaPocket role:** The proposed backend agent checks a purchase against the app's rules and asks the payment system to authorize an allowed payment. It is a module in the backend, not a separately hosted robot.

**Example:** A student submits a meal purchase; the backend checks the applicable allowance and category before requesting payment.

**Limit:** The agent does not establish that an item was actually purchased or delivered. AI image output is not permission to spend; application rules and payment authorization are separate. The full product decision flow remains unimplemented.

### API and serverless function

**Meaning:** An API is a defined way for one program to request data or an action from another. A serverless function is server code run by a hosting service in response to a request.

**PadalaPocket role:** The browser is designed to call a same-origin `/api` endpoint. Node.js API functions run on Vercel; signing and payment SDK use stay on the server side.

**Example:** The health endpoint reports that the deployed API route is reachable.

**Limit:** A reachable health endpoint does not prove that product endpoints or the complete purchase flow work. S-001 records infrastructure and hosted health evidence; product routes remain separate work.

### Contract (smart contract)

**Meaning:** Program code deployed to a blockchain that enforces specified rules when transactions invoke it.

**PadalaPocket role:** The supplied Noir Testnet contracts provide device registration, agent policy, escrow authorization and merchant claim operations.

**Example:** The payment escrow contract records an authorized amount as pending for a merchant; a merchant-authorized claim moves it to the merchant's account.

**Limit:** A contract only enforces its encoded rules. It does not interpret purchase photos or know whether a parent considers an item appropriate. App checks and contract checks serve different purposes. The team uses the required deployed contracts, not its own deployment.

### Escrow

**Meaning:** Funds held under rules that control when they can be authorized or released.

**PadalaPocket role:** The Noir payment escrow can be funded before an agent authorizes a payment. B-001's proof recorded a 5 XLM escrow funding step, then a 0.01 XLM authorization.

**Example:** After authorization, the escrow amount decreased and the merchant's pending amount increased; after claim, pending cleared and the merchant wallet rose, net of fees.

**Limit:** This Testnet proof does not establish the production layout for Needs, Wants, Savings and My Money. Escrow withdrawal and the backing of logical app balances remain unresolved.

### Stellar and XLM

**Meaning:** Stellar is a public blockchain network. XLM is its native asset, used for transactions and fees on Stellar.

**PadalaPocket role:** The demo uses Stellar Testnet and XLM for proof transactions. Amounts on-ledger are measured in stroops (one XLM is 10,000,000 stroops).

**Example:** The B-001 packet records a Testnet authorization hash and separate merchant claim hash.

**Limit:** Testnet XLM is not real money and does not demonstrate PHP conversion, GCash receipt, or production payment readiness. Public ledger activity may reveal wallet relationships even if app records are private.

### Testnet

**Meaning:** A separate blockchain network for development and testing, using test assets rather than spendable mainnet funds.

**PadalaPocket role:** The hackathon demo is required to use Testnet only. B-001's Noir registration, funding, authorization and claim were executed there.

**Example:** A Testnet transaction hash proves that a specific test transaction was recorded, subject to checking its status and context.

**Limit:** A successful Testnet transaction does not prove a real-money transaction will be available, accepted, or economical. Never describe test XLM as a peso payout.

### Wallet, signer, and custody

**Meaning:** A wallet is an account interface for blockchain assets. A signer is a key that authorizes transactions for an account. Whoever controls the private key can generally authorize its actions.

**PadalaPocket role:** The B-001 proof used distinct Testnet owner, agent and merchant signing roles. Its operator route was protected by a server-side token and fixed demo actions.

**Example:** The owner role sets up/funds the proof, the agent authorizes within policy, and the merchant role claims pending funds.

**Limit:** This isolated operator proof is not parent/student login or a production custody design. Product custody, recovery and My Money signing authority need separate decisions and implementation. Never expose private keys or operator tokens in browser code, URLs, logs, or committed files.

### Noir

**Meaning:** In this project, Noir refers to the payment SDK and deployed Testnet contracts described in the supplied hackathon handbook; it is not a generic label for all payment processing.

**PadalaPocket role:** Pinned SDK version 0.3.0 is used in B-001 to register a device and agent, fund escrow, check and authorize a payment, and claim merchant funds.

**Example:** The recorded proof prepared and submitted a Noir operation, then checked the Testnet result before proceeding to the separate claim.

**Limit:** Noir's contract policy cannot enforce photo classification or all app-level parent rules. A successful Noir proof does not show that Velo sponsored that contract payment. See [EV-002](evidence-ledger.md#ev-002) and the [B-001 packet](../handoff/B-001.md).

### Velo

**Meaning:** Velo is a payment SDK/service used by the project for a checkout-related function.

**PadalaPocket role:** Pinned version 0.1.0-alpha.4 is used in B-001 for a separate checkout/status demonstration.

**Example:** The packet records a 0.10 XLM Velo checkout confirmed on Horizon. This transaction is separate from the Noir escrow authorization and merchant claim.

**Limit:** This checkout does not prove Velo sponsored, verified or settled the Noir contract payment. Velo's longer-term product role remains to be decided. See [EV-004](evidence-ledger.md#ev-004) and [DEC-042](../docs/decision-ledger.md#dec-042).

### Authorization, pending funds, and claim

**Meaning:** Authorization is permission for a payment under the contract's rules. Pending funds are recorded for the merchant but have not yet been claimed into the merchant account. A claim is the merchant-authorized action that completes that transfer step.

**PadalaPocket role:** These are distinct stages in the Noir proof and must be described separately in logs and demo narration.

**Example:** B-001 records a successful authorization followed by a separate successful merchant claim, with distinct hashes and balance snapshots.

**Limit:** An app approval alone is not a blockchain authorization or merchant claim. A submitted request or a UI success message alone is not proof of confirmed settlement.

### Anchor and off-ramp

**Meaning:** A Stellar anchor connects the network to an external asset or service. An off-ramp is a path from a digital asset toward local currency or a payout service.

**PadalaPocket role:** The architecture proposes the Stellar reference test anchor for an authenticated test withdrawal flow.

**Example:** A demo could initiate a Testnet withdrawal and display the anchor's actual status while labeling fiat completion as simulated.

**Limit:** The anchor withdrawal flow has not been verified in the product. The planned test anchor does not send pesos to GCash; production provider, eligibility, asset mapping, fees and settlement remain unresolved. See [DEC-006](../docs/decision-ledger.md#dec-006) and [EV-020–EV-021](evidence-ledger.md).

### Supabase

**Meaning:** A hosted application platform that provides Postgres database, authentication and file storage services.

**PadalaPocket role:** It is the working architecture baseline for family identity, application records, balances and private photo storage.

**Example:** The proposed backend validates family membership before returning data or storing a purchase photo.

**Limit:** This is the planned product data layer; the glossary should not imply that family login, private storage policies, or ledger reconciliation are complete. App database balances must be reconciled against backed ledger holdings.

### AI image assessment

**Meaning:** A vision-capable AI service can return a description or category estimate from an image.

**PadalaPocket role:** A server-side image-capable AI provider is proposed to help assess purchase photos against app rules.

**Example:** The service might suggest that an image appears to show a meal, after which the app applies its rules and any parent review requirement.

**Limit:** Provider and model are pending. A model may be wrong, miss context, or be uncertain. It cannot verify the actual purchase, price, recipient, delivery or payment. Do not claim live AI behavior until its provider integration is demonstrated.

### PHP centavos and stroops

**Meaning:** Centavos are hundredths of a Philippine peso. Stroops are Stellar's smallest XLM unit; 10,000,000 stroops equal 1 XLM.

**PadalaPocket role:** The proposed API uses integer decimal strings for a student-entered illustrative PHP price (`priceMinor`) and for on-chain amounts (`amountStroops`). A server-side mapping between them has not been accepted.

**Example:** `7500` centavos means an entered price of PHP 75.00; it does not mean a proven XLM amount.

**Limit:** The demo conversion rate, rounding, reserves and fees are unresolved. Do not imply that an entered peso amount has been exchanged or transferred unless an explicit verified flow supports that statement.

## Evidence and source links

- [Evidence ledger](evidence-ledger.md): sourced technical claims and limitations, including Noir escrow behavior (EV-002), Velo checkout distinction (EV-004), and competition constraints (EV-014–EV-015).
- [Preserved builder handbook](../seed/sources/velo-noir-builder-handbook.md): supplied competition requirements and expected Noir/Velo demo roles. Its original DOCX remains preserved.
- [B-001 packet](../handoff/B-001.md): implementation versions, commands, transaction hashes, balance snapshots, test results, limitations and acceptance state.
- [Architecture](../docs/architecture.md) and [technical spec](../docs/technical-spec.md): canonical proposed system flow and detailed contracts.

## Official documentation to consult

The evidence ledger links to pinned Noir and Velo source revisions used for the current claims. Check documentation against the pinned versions before repeating SDK/API details; current upstream documentation may describe a different release. Relevant starting points:

- [Noir SDK README at inspected commit](https://github.com/noirx402/noir/blob/97c3808a204db96bf74558e53bf2271f9f5252ab/sdk/agent-sdk/README.md)
- [Noir escrow contract at inspected commit](https://github.com/noirx402/noir/blob/97c3808a204db96bf74558e53bf2271f9f5252ab/backend/contracts/payment_escrow/src/lib.rs)
- [Velo checkout implementation at inspected commit](https://github.com/Velo-Ecosystem-Collection/Velo/blob/2f0b3209f7dfec015c2b48c1a7f25077aa669c58/packages/stellar/src/checkout.ts)
- [Stellar developer documentation](https://developers.stellar.org/docs)
- [Supabase documentation](https://supabase.com/docs)
- [Vercel Functions documentation](https://vercel.com/docs/functions)
- [Node.js documentation](https://nodejs.org/docs/latest/api/)

## Review handoff

James owns clarity, examples and caveats. Tyrone and Hedrix should check every statement about code, SDK behavior, versions and what the demo actually does. Update claims from evidence and task packets; do not copy a proposal into the short glossary as if implemented. The team should create or update `docs/technology-glossary.md` as the concise spoken version after this reference is reviewed.
