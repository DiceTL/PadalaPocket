# Agent routing

Read this before editing project documents. Start at the current stage rather than generating the whole suite.

| Request | Read and update | Completion condition |
|---|---|---|
| Clarify the idea | seed/idea.md, work/problem-capture.md | Answer the current question or record the uncertainty; ask neutral follow-ups |
| Establish constraints | seed/context.md | Team inputs separated from verified event requirements |
| Compare competitors or workarounds | seed/market.md, work/evidence-ledger.md | Dated sources; fair comparisons; opportunity claims labeled hypotheses |
| Research a claim | work/evidence-ledger.md | Source, date checked, limitation, and the claim it supports |
| Make or revise a product choice | docs/decision-ledger.md, then affected files | Decision recorded before downstream edits |
| Finalize the concept | seed/idea.md, work/problem-capture.md | Team accepts a coherent concept; unresolved assumptions remain visible |
| Write product requirements | docs/product-spec.md (create then) | Follow Playbook.md outline; derive requirements from accepted choices |
| Choose or revise architecture/stack | docs/decision-ledger.md, then docs/architecture.md and affected technical-spec/context/README references | Architecture and diagram updated in the same change; decision/evidence linked; proposals distinguished from implementation |
| Evaluate technical feasibility or define interfaces | docs/architecture.md, docs/technical-spec.md, seed/context.md | Interfaces and constraints recorded; integration claims verified against official sources or experiments; architectural changes follow the row above |
| Plan UI or record design references | docs/design-brief.md | Ownership and design authority explicitly established |
| Plan implementation | docs/implementation-plan.md | Tasks map to specs, owners, dependencies, and verification |
| Prepare a build task | handoff/TASK-000-template.md, relevant specs | Product scope and interfaces ready for that slice; UI design authority settled for UI tasks |
| Build an authorized task | Relevant packet, guides/anti-slop-guardrails.md | Evidence recorded; delivery gate passed before task marked done |

## Optional references

- Crawling, RAG, orchestration, graphs: guides/core-architectural-engine-skills.md.
- Visualizations, streaming, citations: guides/frontend-ux-deep-insights-skills.md.
- Queues, privacy, storage: guides/backend-infrastructure-skills.md.
- Context and editing hygiene: guides/token-efficiency-guardrails.md.
- Actual agent skill setup: guides/agent-skills.md.

No interview, market-size estimate, pitch deck, or production architecture is a universal gate. Research should answer a decision-relevant question. Do not report product demand as validated from desk research alone.
