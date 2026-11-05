# TASK-000 Template

Copy to TASK-###.md only when preparing an authorized build slice. Track state in the implementation plan.

## Scope and ownership

Owner: frontend / backend / shared.
Outcome, boundaries, excluded work, files allowed to change, and dependencies: fill in.

## References

Link relevant product-spec feature IDs, technical-spec interfaces, decisions, and design source for UI work.
Read [delivery guardrails](../guides/anti-slop-guardrails.md).

## Behavior and acceptance

Write individual unchecked acceptance criteria (`- [ ]`) for observable success, relevant failure cases, and explicit demo simulations. Use FE-xxx for frontend tasks; F-xxx denotes product features.
Reference canonical rules instead of copying the full specs.

## Verification

Name specific behavior/failure test cases, actual commands established in S-001, relevant automated PR checks, and required manual/live interactions. Record an effort range and investigation limit where relevant.
Do not invent commands before the app stack exists.

## Evidence after implementation

Record checks actually run, results, files changed, delivery gate result, and remaining limitations.
Mark the task done in the implementation plan only after acceptance and relevant delivery checks pass.
