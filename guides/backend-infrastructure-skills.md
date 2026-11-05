# Backend capability reference

Adapted from the source workflow. Read alongside delivery guardrails when applicable.

## Background work

Start with synchronous operations when appropriate. Add a queue for a concrete requirement.
If work may retry, define idempotency, bounded retry behavior, durable status, and recovery from partial execution.
Distinguish accepting a request from completing its external effect.

## Privacy and access

Use synthetic demo data where possible. Minimize stored personal data and define ownership/access boundaries.
Document retention and deletion when relevant. Technical safeguards do not establish legal compliance.
Avoid importing health-specific or jurisdiction-specific requirements without applicability and reliable evidence.

## Storage

Use a clear durable source of truth. Add caches, object storage, or multiple tiers for demonstrated needs.
Define reconciliation where local state can differ from an external system.
Record the chosen tradeoffs in the technical spec when created; this guide chooses no database or infrastructure vendor.
