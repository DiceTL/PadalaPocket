# Welcome to PadalaPocket

This repository (or “repo”) is our shared project folder. It contains the app code, the decisions behind it, research, and instructions for building the demo. Markdown files (`.md`) are plain text documents; you can read them on GitHub or in a code editor.

Start here, then read [team roles](team-roles.md) to see where you fit. You do not need to understand every technical file to contribute.

## What are we building?

PadalaPocket is an allowance wallet concept for students aged 13 and older with a parent working abroad. We want to help families manage allowance across distance while giving the student some independence. Whether families want this particular solution still needs evidence.

The intended experience is:

1. The parent funds a weekly allowance split into **Needs** and **Wants**.
2. For allowance purchases, the student submits a product photo and price. AI helps identify the item, and spending rules determine whether it can proceed or needs parent approval.
3. At week end, leftover Needs funds move to **Savings**, while leftover Wants funds move to **My Money**.
4. The student needs parent approval to release Savings into My Money. My Money purchases have no parental spending controls or photo requirement, and its balance and purchase history are hidden from parent-facing app views. This does not promise anonymity on a public blockchain.

Our hackathon demo is scoped to one parent, one student and one seller. It uses **Stellar Testnet**, a network for testing with no real funds. Any fiat payout shown is simulated. The product rules are in the [product spec](product-spec.md); the [idea](../seed/idea.md) gives a shorter introduction.

The live website alone does not prove these features work. Use the [implementation plan](implementation-plan.md) for current progress and task packets for actual results. The [decision ledger](decision-ledger.md) explains what the team has chosen and what later decisions replaced.

## Your first reading session

Everyone should read these parts:

| Read | Why it matters |
|---|---|
| [Team roles](team-roles.md) | Your responsibilities, suggested outputs and who to coordinate with. |
| [Idea](../seed/idea.md) | The concept, target users and assumptions. |
| [Product spec](product-spec.md) | The demo journey and rules. Start with the scope and user flows; ask AI to explain unfamiliar details. |
| [Project context](../seed/context.md), especially competition requirements | What the supplied hackathon handbook requires and what is still uncertain. Read the linked handbook section before relying on an event rule. |
| [Implementation plan](implementation-plan.md) | Check task status. James and Lili can use the status tables without studying every build instruction. |

Then read for your role:

- **Hedrix:** [development setup](development.md), [design brief](design-brief.md), [architecture](architecture.md), the relevant parts of the [technical spec](technical-spec.md), and your next `FE-` task packet.
- **James:** [problem capture](../work/problem-capture.md), [market comparison](../seed/market.md), [evidence ledger](../work/evidence-ledger.md), and relevant product rules. Use the architecture and handbook when preparing technical Q&A.
- **Lili:** the [demo journey in the product spec](product-spec.md#demo-journey), [market comparison](../seed/market.md), [evidence ledger](../work/evidence-ledger.md), and the handbook's judging/submission sections. Ask Tyrone which features have working proof before putting them in the pitch.

Read only the sections needed for your task. If an older overview disagrees with a later decision, check the decision ledger and ask Tyrone; do not silently choose whichever version sounds better.

## Using AI when you have never used it before

An **agentic AI** can read files and, depending on its permissions, edit files or run commands. You can use it just to ask questions. Tools you can explore include Freebuff, Codex, Cursor, Kilo, OpenCode, Antigravity and Kiro. Check their current free access and usage limits when signing up; this guide does not guarantee any tool is free.

A simple way to start:

1. Get this repository onto your computer. If you are unfamiliar with GitHub's clone/download options, ask Tyrone to help with setup.
2. Open the PadalaPocket folder in your chosen AI editor or connect it as the tool's workspace. The AI needs access to the files to explain this particular project. In a chat tool without repo access, attach or paste the relevant Markdown files.
3. Start in an ask/read-only mode if available. Say that you want an explanation and no file changes.
4. Ask one question at a time. Request file links or section names so you can check the answer.

For simple explanations, start with the smallest or lowest-cost available model at **low or medium reasoning effort**. Effort means how much reasoning the tool lets the model spend; some tools do not offer that setting. If an answer misses context, give it the relevant file or use a stronger model. For important coding, research and writing, use a capable model at **medium or high effort** where available. Higher effort still needs human review and supporting evidence.

Copy one of these prompts:

> Read AGENTS.md and AGENT_ROUTING.md, then docs/team-onboarding.md and seed/idea.md. Explain PadalaPocket in plain language. Separate accepted decisions from open questions, and link the files supporting your explanation. Do not edit files.

> I am James/Lili/Hedrix. Read docs/team-roles.md. Explain what I should do first and which sections I need to read. Ask me before assuming a new responsibility.

> Explain this section using a simple example. Define unfamiliar terms and tell me which parts are assumptions rather than verified facts.

> Research this claim using original or official sources. Give the source links, dates, limitations and what each source actually supports. Do not invent numbers or say demand is validated just because a competitor lacks a feature.

AI can confidently get things wrong. Check important claims yourself, especially numbers, event rules, APIs and whether a feature actually works. Keep credentials, signing keys and private customer information out of prompts and tracked files. Ask before letting an agent commit, publish or change shared configuration.

## Where things live

| Folder or file | Plain-language purpose |
|---|---|
| `seed/` | The idea, constraints and market comparison. `seed/sources/` preserves original inputs; corrections go elsewhere. |
| `docs/` | Current plans and specifications: what we intend to build, technical design, decisions, team guides and UI references. |
| `handoff/` | Instructions and results for individual tasks. `S-` means shared setup, `B-` backend, `FE-` frontend, and `C-` integration checkpoint. `F-` in specs means a product feature, not a frontend task. |
| `work/` | Research evidence, experiments and questions. This is where a claim gets its supporting source and limitations. |
| `apps/web/` | The frontend: what people see and interact with. |
| `apps/api/` and `api/` | Backend code and its Vercel hosting entry point. |
| `guides/` | Working rules and optional technical help. Builders read [delivery guardrails](../guides/anti-slop-guardrails.md) before app/UI/copy changes. |
| `AGENTS.md` and [AGENT_ROUTING.md](../AGENT_ROUTING.md) | Instructions for AI agents and a map of which document to read or update. |
| `.github/workflows/` | Automated checks run by GitHub. A passing check is useful evidence, but does not prove every product feature works. |

## Hedrix: how to start a frontend task

1. Open the [frontend sequence](implementation-plan.md#frontend-sequence). Start with the next task whose prerequisites are complete; confirm authorization with Tyrone. The sequence begins at [FE-001](../handoff/FE-001.md) after C-001.
2. Read that task's packet, scope and acceptance checklist. Read the linked API examples and product rules relevant to the screen.
3. Establish the human design owner or approved reference in the [design brief](design-brief.md). Frontend coding ownership does not automatically authorize AI to invent the design.
4. Follow [development setup](development.md) for installation and run commands. Coordinate changes to API contracts, shared configuration and the dependency lockfile with Tyrone first.
5. Build the scoped task. Mock data is useful while endpoints are unavailable, but label it and use the agreed contract. Do not present mock behavior as working integration.
6. Record checks, observed results and limitations in the packet. Tyrone reviews acceptance and updates task status in the implementation plan.

A useful build prompt is: “Implement FE-xxx from its packet and the implementation plan. First confirm dependencies, design authority and authorization. Stay within scope, run required checks and record actual evidence.”

## A few terms you will hear

- **MVP:** the small version we aim to demonstrate in the hackathon.
- **API:** the agreed way the frontend asks the backend for data or actions.
- **SDK:** a toolkit a service provides for developers. The supplied handbook requires Noir and Velo SDK use.
- **Noir:** the required payment SDK and deployed contracts described in the handbook; do not confuse it with other products named Noir.
- **Velo:** the other required SDK. Its role and connection to the payment flow must be verified in our implementation.
- **Stellar / Testnet:** the blockchain network and its testing environment used by the prototype.
- **Anchor:** a service that connects blockchain assets with deposit or withdrawal flows. Our chosen test-anchor demo simulates fiat payout.

For precise SDK instructions, use the [handbook](../seed/sources/velo-noir-builder-handbook.md) and verified technical evidence, rather than treating these short definitions as implementation instructions.
