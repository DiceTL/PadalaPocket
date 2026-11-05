# Team roles and responsibilities

Tyrone and Hedrix build the MVP. James checks its logic and prepares for difficult questions. Lili turns the strongest supported parts into a clear pitch. Everyone should understand the product well enough to explain what works, what is simulated and what remains a future goal.

## Tyrone Louis V. Teemer — Backend developer and project manager

Tyrone builds the backend, coordinates dependencies and integration, and maintains the [implementation plan](implementation-plan.md). He records technical decisions and reviews completed work.

For S-002 and C-001–C-006, backend alone decides technical acceptance under [DEC-037](decision-ledger.md). Frontend evidence and feedback inform that review; frontend approval is not a gate. Product choices still follow team decision rules, and UI design ownership is recorded in the design brief.

## Hedrix Bryan E. Barcelona — Frontend developer

Hedrix builds the parent and student interfaces, connects them to the agreed API, and checks their interactions and states. He coordinates missing data, API mismatches and shared configuration changes with Tyrone.

Follow the [frontend steps in the onboarding guide](team-onboarding.md#hedrix-how-to-start-a-frontend-task), then the [frontend task sequence](implementation-plan.md#frontend-sequence) and the relevant `FE-xxx` packet. Use [development setup](development.md) to run the project. Confirm the human design source in the [design brief](design-brief.md) before creating screens. Record implementation and check results in the packet; Tyrone maintains task status in the plan.

## James Paul C. Soliven — Quality and strategy analyst

James tests both the app and the thinking behind it. He identifies strengths, logical gaps, weak assumptions and cases where the product may fail. His review should help the builders fix problems and help the team answer judges honestly.

He leads Q&A preparation: likely questions, concise answers, supporting evidence and points where the team should acknowledge an unresolved issue. His job is to challenge our own claims before the judges do. While features are unavailable, he can review the documented journey and proposed rules; once builds are ready, he tests the actual behavior.

## Christian Louianne B. Lili — Presenter and pitch lead

Lili creates the Canva deck, prepares the script and rehearses delivery. He chooses the clearest supported benefits and examples so the value is easy to understand. He explains material limitations candidly and connects them to a credible next step.

Lili also leads the business and positioning documents below, so James is not carrying all research while preparing Q&A and testing. James challenges the reasoning; Tyrone and Hedrix check claims about implementation in their respective areas. The team confirms actual product and business choices.

## Required outputs and owners

Each topic has a detailed reference for research and AI context, plus a short version the team can read or rehearse. Both should be understandable to humans. The detailed version adds sources, calculations and caveats; it should not be deliberately mechanical or harder to read.

| Topic | Lead and support | Detailed file | Short file |
|---|---|---|---|
| Quality review | James; builders reproduce and resolve findings | `work/quality-review-reference.md` | `docs/quality-review.md` |
| Judge Q&A | James; Lili rehearses, Tyrone and Hedrix check technical answers | `work/judge-questions-reference.md` | `docs/judge-questions.md` |
| Business model | Lili; James checks assumptions and calculations | `work/business-model-reference.md` | `docs/business-model.md` |
| Technology glossary | James; Tyrone and Hedrix check implementation claims | `work/technology-glossary-reference.md` | `docs/technology-glossary.md` |
| Pilot and future improvements | James; Lili adds adoption/business questions | `work/pilot-and-roadmap-reference.md` | `docs/pilot-and-roadmap.md` |
| Competitors and alternatives | Lili; James challenges comparisons | `work/market-reference.md` | `docs/market-summary.md` |
| Facts and statistics | Lili; James checks relevance and interpretation | `work/facts-and-statistics-reference.md` | `docs/facts-and-statistics.md` |
| Pitch script | Lili; James challenges claims and likely follow-ups | `work/pitch-script-reference.md` | `docs/pitch-script.md` |

The pitch deck stays in Canva. Lili can put its view link in the short script once available. Do not create empty files just to fill this table; start each pair when there is useful work to put in it.

### What belongs in each topic?

**Quality review:** describe the scenario, expected behavior, actual result, steps to reproduce and proof. Explain its impact and any strengths observed. Separate a flaw in the proposed logic from a bug observed in a working build. Link task-related findings to the relevant packet; this report does not replace the implementation plan's status tracking.

**Judge Q&A:** cover the problem, target users, competitors, privacy, parental controls, AI mistakes, payments, costs, sustainability and technical limits. For each question, include a direct answer, source or demo evidence, likely follow-up and what we still cannot claim. The short file should be usable for spoken rehearsal, rather than a list of aggressive rebuttals.

**Business model:** identify users, paying customers, stakeholders, who receives value and who pays. Explore revenue options, fixed costs, cost per active customer or transaction, and how the service could sustain itself. Show low/base/high customer scenarios, revenue, expenses, profit or loss and break-even. Separate hackathon Testnet costs from hypothetical real-money operations. Explain the period, currency, assumptions and formulas; an unsupported value is a labeled assumption. If costs or margins are unknown, say which inputs are needed rather than inventing a profitable forecast.

**Technology glossary:** give every teammate enough understanding to explain how PadalaPocket works and answer technical questions from judges. Cover the technologies, tools and concepts relevant to our architecture, demo and limitations. Examples include Noir, Velo, Stellar, Testnet, wallets, contracts, escrow, agents and anchors; expand the glossary whenever another unfamiliar term matters to the project. For each entry, explain what it means, its role in PadalaPocket, why we use it, a simple example and its limitations. Link official documentation and distinguish intended use from behavior our code has verified. The short version should help the team explain these ideas aloud in plain language.

**Pilot and future improvements:** distinguish current demo limits, possible improvements and accepted future decisions. Propose a first pilot audience, what the pilot would measure, success/failure criteria and required access or safeguards. Explain how recruitment, support and expansion might work. A future real-money pilot needs separate feasibility and authorization; the hackathon Testnet demo does not establish readiness. Future ideas do not become MVP tasks by appearing here.

**Competitors and alternatives:** explain what alternatives do, whom they serve, how they work, strengths, limitations and when someone might choose them over us. Include existing workarounds, not only apps. Describe where PadalaPocket could be better for a specific user/task, with evidence or an explicitly labeled hypothesis. A missing competitor feature does not prove demand. Keep [seed/market.md](../seed/market.md) as the canonical concise comparison; the summary should link to it and explain its pitch implications rather than maintain a competing comparison table.

**Facts and statistics:** keep the original source, date, geography, population, definition and limitation for each claim. Explain what the number supports and what it cannot establish. Prefer original sources. Distinguish the size of the OFW/remittance population from evidence that people need or would pay for PadalaPocket. The short version should contain only the strongest relevant claims, with source links.

**Pitch script:** connect the problem, target user, demo, supported advantage, business hypothesis and next step. Use the supplied handbook's current presentation requirements, checking for organizer updates. Mark simulated actions and future features clearly. The detailed notes can include slide cues, evidence and alternate wording; the short version is what Lili rehearses.

## Keep the two versions consistent

Store a fact once in its existing canonical home, such as the [evidence ledger](../work/evidence-ledger.md), [market comparison](../seed/market.md), product spec or technical spec. Detailed research files should link to those records and add analysis, not copy whole documents. New source checks belong in the evidence ledger with dates and limitations.

Each short file should link to its detailed reference and keep the caveats needed to avoid misleading readers. When a number or claim changes, the topic's lead updates both versions in the same change. Use clear labels: **verified finding**, **assumption**, **proposal**, or **team decision**. AI can help research and draft; the named lead checks the result before handing it over.

## Start here and hand work over

Start with this first pass: James reviews the product journey and drafts the hardest judge questions. Lili outlines the pitch and identifies claims that need market, cost or statistical support. They compare gaps, then research the highest-value ones. Keep the initial documents short and expand only where the demo or Q&A needs more support.

Send findings with a file link and the concrete question or action needed. James gives reproducible defects to the relevant builder. Lili checks live feature evidence with Tyrone or Hedrix, depending on who owns the feature, before presenting it as working. Tyrone and Hedrix respond to technical gaps through their task packets. Important choices go into the decision ledger before affected specifications change.
