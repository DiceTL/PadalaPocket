# Delivery guardrails

Adapted from the source workflow's anti-slop guide.

## Baseline

- No fabricated facts, testimonials, transaction success, compliance claims, or research.
- Label demo simulations. Every shipped control must perform its stated action.
- Confirm APIs against the installed version and actual integration; never invent methods.
- Keep credentials and signing keys server-side. Ignore local secrets before the first commit.
- Authenticate and separately authorize access to each user's resources.
- Parameterize queries and sanitize untrusted content before rendering HTML.
- Use established authentication/password tooling; do not invent cryptography.
- Show applicable empty, loading, pending, success, and failure states honestly.
- Follow the agreed design. Maintain readable contrast, keyboard access, and visible focus.
- Prefer existing project conventions and dependencies; add tools only for an actual requirement.
- Where available, use database access policies alongside server ownership checks; otherwise document equivalent access controls.

## Delivery gate

Before marking a build task done, record evidence that:

1. Relevant acceptance criteria and failure cases were checked with real commands or interactions.
2. Changed controls work and applicable UI states are present.
3. Authentication, ownership, secrets, and input-handling checks relevant to the change pass.
4. External API use matches the installed version; transaction claims reflect verified results.
5. Design and accessibility checks relevant to the changed screens pass.
6. Remaining limitations and simulations are explicitly disclosed.

Use not-applicable with a reason for irrelevant checks. An unverified applicable criterion remains open.
Record evidence in the packet, then update task status in the implementation plan.
