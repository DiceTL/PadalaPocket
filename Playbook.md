# Using the workflow

The workflow develops the idea first and introduces build specifications when the team is ready.
Use the existing proposal as input and revisit its choices freely.

## Seed

seed/idea.md owns the concept. seed/context.md owns constraints and event rules.
seed/market.md owns the competitor and workaround summary. Original inputs remain in seed/sources/.

## Work

work/problem-capture.md holds unresolved questions. Address one topic at a time using neutral questions.
Use work/evidence-ledger.md for dated sources and limitations. Interviews are not required.
Create work/market-scan.md only if detailed research outgrows seed/market.md; keep the summary there and link to the supporting records.

A useful research pass answers a named question and stops when the next decision can be made or the evidence is unavailable. Unknown is an acceptable result.

## Docs

Record important choices in docs/decision-ledger.md before editing affected documents.
When the team accepts the concept, create docs/product-spec.md with:

- Intended users, situation, problem, and desired outcome.
- MVP scope and explicitly deferred scope.
- User journeys, business rules, and important failure cases.
- Feature IDs (F-001 onward), observable acceptance criteria, and relevant security rules.
- Linked assumptions and decisions; no unsupported success metrics.

Create docs/technical-spec.md when technical choices need agreement, using:

- Team skills, time constraints, chosen stack, and reasons.
- Architecture and data ownership.
- Frontend/backend interface with concrete example requests, responses, and errors.
- Integration evidence, uncertainties, and experiments or fallbacks.
- Signing and authorization responsibilities where relevant.
- Deployment approach and verification plan.

Create only sections needed by this product. Keep requirements in the product spec and interfaces in the technical spec. Do not duplicate them in task packets.

The team’s acceptance of the concept permits specification. It does not authorize scaffolding or settle visual design. Record design authority in docs/design-brief.md before UI tasks.

## Handoff

After build authorization, break agreed scope into short tasks for the frontend and backend owners.
Agree on their shared interfaces before dependent implementation proceeds in parallel.
Each task names its scope, dependencies, acceptance criteria, and a real verification method.
Update task progress only in docs/implementation-plan.md; record evidence in the packet.

## Keeping this lightweight

Default to a short clarification pass, one focused research pass per relevant question, and targeted edits.
Set an actual planning time budget with the team in seed/context.md.
Pitch, GTM, business canvas, and a standalone QA plan are optional additions when needed.
Do not import old project decisions, numerical targets, or event rules from the source workflow.
