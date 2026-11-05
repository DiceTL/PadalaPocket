# Shared development setup

S-001 establishes infrastructure only. The web entry is intentionally blank pending human design authority. The only API route is `GET /api/health`, reporting runtime and Testnet configuration; it performs no payment, authentication or provider action.

## Local commands

Use Node 26.12.1 and npm 12.2.1. From the repository root:

```sh
npm ci
npm run dev:api
```

In a second terminal run `npm run dev:web`. Vite prints its web address; `/api` requests proxy to `127.0.0.1:3001`. Direct health URL: `http://127.0.0.1:3001/api/health`. The setup requires no service keys. `.env.example` documents future values; copying it does not configure a working integration. No automatic local environment-file loader is installed yet; future server tasks must explicitly configure their secret-loading path.

Run all local/CI checks with `npm run check`; individual commands are `npm test`, `npm run check:contracts` and `npm run build`. Workspace tests can run with `npm run test --workspace @padalapocket/web` or `npm run test --workspace @padalapocket/api`. Node's built-in test runner is the initial test tool. Current web checks cover infrastructure, not browser interactions; select/install the actual browser test tool before FE implementation. API build is syntax verification because this is plain JavaScript. Web build uses pinned Vite.

S-001 has no API fixtures: contract checking explicitly reports not applicable and fails closed if JSON fixtures appear without the S-002 validator. It must be replaced with real fixture validation in S-002. No provider test runs in ordinary PR checks.

## Ownership and Git

For S-001, DEC-036 permits backend-only acceptance and direct work on main. Record the accepted commit and required clone, remote CI and hosted routing/runtime evidence; no teammate review or PR/merge is required for this task.

Follow [implementation plan](implementation-plan.md#shared-edit-protocol): backend owns root configuration, lockfile, API and CI; frontend owns approved web work after setup. Reserve shared edits with the other developer before changing them. One editor updates contracts/config and merges first; the other syncs. Use task branches, reviewed PRs, green checks and normal merges from current main. Do not discard pre-existing local documentation changes. Backend alone updates plan/checkpoint status; owners record task evidence.

The `Workspace checks` workflow runs install, contract checks, both workspace tests and build on PRs and main pushes. A repository admin should require job `check` before merge; until configured, the reviewer must manually confirm it is green. The local check command is runnable; remote CI and branch protection require actual GitHub execution/access and are not established by this document.

## Deployment routing

The root `vercel.json` builds `apps/web/dist`; `api/index.js` bridges Vercel's root function convention to `apps/api/src/health.mjs`. `/api/*` rewrites to this entry, with the handler validating the requested route. This routing is verified by the production health check recorded in [S-001 evidence](../handoff/S-001.md#final-acceptance-evidence--2026-11-06). Root package engines select Node 26.x. Check `node -v` in build logs and `runtime` from `/api/health`; they can differ in patch version. Later SDK work must verify both meet Noir's exact requirement.

Only public configuration may use `VITE_` names. Server credentials/signing keys must never appear in web imports or public environment variables. Use new Testnet-only accounts later; no real funds. No actual secret values belong in tracked files. Keep deployment secrets in host settings. Provider authentication and payment proof are later tasks, not part of the public health route.
