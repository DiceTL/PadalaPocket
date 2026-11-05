# Project context

Updated 2026-11-06. This is the project orientation and constraint summary. Product rules, architecture, detailed interfaces, evidence and task progress have separate canonical homes below. Competition statements describe the supplied handbook, not independently confirmed organizer amendments.

## Current direction and document map

The team accepted a focused PadalaPocket Testnet demo for one OFW parent, one student and one seller under DEC-029. It includes photo AI for allowance purchases, parent review, Savings/private My Money, weekly time advancement and a test-anchor withdrawal with simulated fiat payout. Real GCash receipt remains a future feasibility gap. Product and technical specs are drafts; application implementation has not started or been authorized.

| Need | Canonical document |
|---|---|
| Accepted concept and category catalog | [Idea](idea.md) |
| Requirements, demo journey and proposed operational defaults | [Product spec](../docs/product-spec.md) |
| Stack, architecture diagram, components and architectural changes | [Architecture](../docs/architecture.md), maintained with every architectural decision |
| Data/API contracts, signing and recovery | [Technical spec](../docs/technical-spec.md) |
| Accepted decisions and supersessions | [Decision ledger](../docs/decision-ledger.md) |
| Researched claims, experiments and limitations | [Evidence ledger](../work/evidence-ledger.md) |
| Task progress and implementation sequencing | [Implementation plan](../docs/implementation-plan.md) |
| UI ownership and references | [Design brief](../docs/design-brief.md) |
| Competition wording, code samples, contract IDs and full README template | [Extracted builder handbook](sources/velo-noir-builder-handbook.md) |

Read the handbook extract first for competition details. It preserves the original content, including historical SDK advice; corrections belong in evidence/current specs. The [original DOCX](sources/velo-noir-builder-handbook.docx) remains the source artifact. A handbook example does not prove installed SDK behavior, a working Noir/Velo connection or organizer approval of a particular integration.

## Confirmed team constraints

- Two builders: frontend and backend.
- Goal stated in the setup conversation: implement the MVP in less than 30 hours.
- Develop the idea into a concrete concept before building.
- Interviews are not part of this workflow.
- Prefer neutral questions that avoid steering product choices.
- The team cannot provide business registration/onboarding documents for this hackathon/startup project, per founder clarification on 2026-11-06. See [DEC-004](../docs/decision-ledger.md) for the resulting Coins.ph scope decision.

## Team experience and working approach

Founder-provided, 2026-11-06:

- Frontend builder: Python, HTML, CSS, JavaScript, C and SQL.
- Backend builder/founder: Python, HTML, CSS, JavaScript, C, Java, C#, Supabase and Vercel.
- Much of the implementation will be AI-assisted. JavaScript is shared experience; no React, Next.js or TypeScript experience has been stated. AI assistance is not evidence of integration correctness or a guaranteed build duration.
- Working stack and system design: [architecture](../docs/architecture.md); detailed developer interfaces: [technical spec](../docs/technical-spec.md). Drafted under DEC-030 and organized under DEC-031 for team review. Local SDK installation/import compatibility is verified below. Hosted runtime and transaction-duration behavior remain unverified; no build authorization is implied.

## SDK Node verification

Checked 2026-11-06; canonical package requirements and experiment evidence: [EV-025](../work/evidence-ledger.md). Local Node **26.12.1** with npm **12.2.1** passed strict-engine installation and ESM imports for Noir, its Stellar peer, and both tested Velo releases. All installation work stayed in temporary directories; no app was scaffolded.

Use JavaScript ESM (`import`/`export`) for these packages. Proposed runtime: local Node 26.12.1 and Vercel 26.x, subject to checking the deployed build and function versions against Noir's exact minimum. Vercel supports selecting a major version but controls minor/patch updates. No deployment or Testnet payment was tested here.

The handbook names Velo's alpha tag; npm currently points `alpha` to **0.1.0-alpha.4** and `latest` to **1.0.0**. Both loaded locally. This version difference does not amend the competition rules: retain the handbook's alpha choice unless organizer guidance establishes otherwise, and pin the exact version during implementation.

## To establish

- Registration completion and any organizer amendments after the supplied handbook: not checked. No blanket permission to simulate required Noir/Velo payment integration is stated.
- Available service accounts, AI provider/access, hosting plans and budget: unknown. Stack familiarity is recorded above; the shared technical draft requires review.
- Planning time budget and when the build clock starts: unknown.
- Design ownership/reference: see [design brief](../docs/design-brief.md).

## Competition requirements from supplied handbook

Source: [Velo x Noir Agentic Payment Hackathon Builder Handbook — extracted text](sources/velo-noir-builder-handbook.md), updated Nov 5, 2026; supplied by founder and read Nov 6. [Original DOCX](sources/velo-noir-builder-handbook.docx) preserved byte-for-byte. This records the supplied rules, not independent confirmation of organizer updates or successful SDK integration. See [EV-014–EV-015](../work/evidence-ledger.md).

- **Eligibility and timing (Philippine time, UTC+8):** Luma RSVP and registration form both required by Nov 4, 11:59 PM; solo or teams of 2–4. Build Nov 5–7; submission Nov 7, 12:00 PM; top 10 announced Nov 7, 4:00 PM; finalist pitch Nov 8, 1:00–8:00 PM. [Luma](https://luma.com/gjclwpkd), [registration form](https://forms.gle/wL8tPiCwGkK8YENV9), [organizer Discord](https://discord.gg/Mt2hD7DG).
- **All six build requirements:** agentic payment (the agent decides, requests or makes payment); use the Noir SDK (`@noirx402/agent-sdk`) with the handbook's deployed Noir Testnet contracts, not self-deployed copies; use Velo SDK (`@carts1024/velo-sdk`, alpha tag) for other application functions; Stellar Testnet only and never real funds; public GitHub monorepo with prescribed README; deployed working website at a public URL.
- **Payment mechanics:** the handbook lists device registration, agent policy, escrow funding, `checkPayment`, `authorizePayment` into merchant pending balance, then merchant `claim`. It calls for funded Testnet owner, agent and merchant accounts. NFC hardware is optional; a UID can be typed. Listed Noir IDs match those inspected in EV-002; keep the full identifiers in the handbook rather than duplicating them here.
- **Agent and integration boundaries:** prerequisites allow an LLM API, framework or rule-based decision logic. Noir and Velo are separate; the team's code connects them. The handbook's reference architecture is not proof that Velo's standard verifier accepts Noir contract payments; EV-004 remains an open integration concern.
- **Submission:** prescribed root README sections (including SDK versions, real code links, integrations and Testnet proof), public monorepo, working live URL, two-minute demo video, short write-up, registered team details, and at least one demo transaction hash/explorer link. Workspace package manager, one root install command, reproducible setup and `.env.example`; no committed secrets. Full README template and registration support checklist remain in the handbook. Submission link is announced in Discord.
- **Judging:** agentic payments fit 30%, technical execution 25%, innovation 20%, real-world potential 15%, pitch/demo 10%. Finalist format: five-minute pitch/live demo plus three-minute Q&A.

### Required repository and README detail

The [handbook's repository section](sources/velo-noir-builder-handbook.md#repo-and-readme-format) requires every part in one public monorepo, root-declared npm/pnpm/yarn workspaces and one installation command. Its example separates web, server, agent and shared code; folder names may change. Our proposed folder layout is in architecture and is not scaffolded. Turborepo is optional. Keep setup reproducible, include `.env.example`, and never commit real secrets.

Root README must follow the supplied order: project name/pitch/live website/two-minute video/team, then **Problem; Solution; How the agentic payment works; Architecture; Noir integration; Velo integration; Testnet proof; Repo structure; Run it locally; Environment variables; Screenshots; What's next; Credits**. Architecture explicitly requires an image or Mermaid diagram of the apps, agent, Noir contracts and Velo. Integration sections need exact SDK versions and real code/file/line links; Testnet proof needs an agent transaction's Stellar Expert link. Our current README is a planning entry point and has not yet been converted to this submission format.

The [submission checklist](sources/velo-noir-builder-handbook.md#submission-checklist) also requires the short write-up, registered team names/Discord handles and a working public deployment. A local-only demo does not qualify. A finalist should bring a running laptop demo and backup video. These are deliverables, not completion claims.

### Integration and access prerequisites

- The [prerequisite section](sources/velo-noir-builder-handbook.md#prerequisites) calls for JavaScript/TypeScript async skills, Node/workspaces, Git/GitHub, a web frontend, hosting, Chrome for the Noir extension, an agent decision approach and Stellar basics. Rule-based payment decisions are allowed by the handbook; the team's own photo-identification feature still requires actual image AI.
- The [Noir section](sources/velo-noir-builder-handbook.md#using-noir) supplies deployed contract IDs, SDK examples and signer options. Use funded owner, agent and merchant Testnet accounts. The agent controls when, whom and how much to pay within authority; a normal checkout click alone does not satisfy the stated agentic requirement. Never deploy substitute contracts for the required flow. Testnet can reset, so reproducible setup will be needed.
- The [Velo section](sources/velo-noir-builder-handbook.md#using-velo) instructs wallet login to the dashboard, project creation and generation of a Testnet API key. Its checkout/webhook examples are source guidance; credentials and service readiness are not verified for this team. If webhooks are used, verify the raw body/signature server-side and deduplicate effects. The handbook's reference architecture does not establish Noir contract-payment compatibility with Velo checkout.
- Team access to the AI API, Supabase project, hosting account, Velo key and signer setup is not established. Confirm each before its dependent implementation task; do not place actual values in context or tracked Markdown.
- Registration includes support screenshots described in [How to register](sources/velo-noir-builder-handbook.md#how-to-register). Completion is unknown. Questions go to Discord `#dev-help`, `#noir-sdk-and-extension` or `#velo-integration`; no organizer contact has been made by the agent.

### Evidence and simulation boundary

Completed checks include SDK/source inspection, public test-anchor capability discovery and local SDK installation/import. They do not establish a deployed app, confirmed PadalaPocket payment/claim, authenticated withdrawal, accurate AI classification or real-world demand. The main architecture uncertainties are indexed in [architecture](../docs/architecture.md#main-flow-and-unresolved-money-routing); verification details live in technical spec and the evidence ledger.

Keep demo application time distinct from ledger time. Fiat payout is simulated; required Noir/Velo SDK behavior and claimed Testnet transactions must be real. Current market comparison and design brief remain incomplete; their existence does not establish research or design completion.

## Effect on payment feasibility

Real peso/GCash settlement is not a listed competition requirement; real funds are prohibited. A genuine Noir Testnet payment and merchant claim can demonstrate that part of the concept. This removes live conversion as a competition deliverable dependency, but does not supply an everyday seller payout route or prove the app's real-world potential. Any peso conversion shown must be disclosed as simulated; that cannot replace required working SDK integrations and Testnet proof. See [DEC-005](../docs/decision-ledger.md).

Prototype withdrawal-service selection: [DEC-006](../docs/decision-ledger.md). Production conversion-provider selection is deferred.

## Historical technical claims in the original idea

The handbook confirms mandatory Noir/Velo use, with stricter SDK/deployment requirements above. The original idea's API versions, fees and alpha claims remain historical inputs unless separately checked. The handbook also contains technical guidance that must be checked against installed SDK versions at build time.
