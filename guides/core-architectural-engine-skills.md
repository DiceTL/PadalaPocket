# Architecture capability reference

Adapted from the source workflow. Read only when the concept calls for these capabilities.

## Crawling and ingestion

Check for an official API, export, or existing dataset first. If crawling is needed, define the actual data need, access constraints, rate limits, retries, and recovery. A small corpus may not need a distributed pipeline.

## Retrieval and RAG

First determine whether retrieval is needed and whether ordinary search or database queries suffice.
Define a representative evaluation set before adding embeddings, reranking, or a vector store.
Track source provenance and deletion requirements. Do not treat model output as evidence.

## Agent orchestration

Start with explicit steps and a small tool surface. Add orchestration only for a demonstrated requirement.
Separate authority to propose, approve, and execute actions. Require evidence of success from tools.
An autonomous payment policy need not imply an LLM or multi-agent framework.

## Deduplication and graphs

Use stable IDs and simple matching before entity resolution or graph infrastructure.
Add a graph only when a concrete relationship query requires it.

Record chosen architecture and unresolved feasibility issues in the technical spec when it is created.
Verify vendor capabilities and versions through current official sources at decision time.
