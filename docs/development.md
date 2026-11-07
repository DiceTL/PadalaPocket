# Shared development setup

## Connected local app — L-001

The app now uses real Auth/API behavior by default, including development. Start the API from the repository root with `node --env-file=.env.local apps/api/src/dev.mjs`, then the frontend with `npm run dev --workspace @padalapocket/web`. The Vite proxy forwards `/api` to port 3001. Vite explicitly maps only Supabase URL and publishable key from root configuration; all signing/service/provider secrets remain server-only. Provisioned credentials stay in ignored local files. For the old labeled mock shell, explicitly set `VITE_APP_MODE=mock` in development; production always uses live mode. `?layout=...` routes remain separate sample previews.

Saved rules and private activity require the L-001 database migration. Existing reduced Needs funding/purchases are real Testnet operations; weekly scheduling, Wants funding and wallet lifecycle remain later stages until their delivery evidence is recorded.

S-001 establishes infrastructure only. The web entry is intentionally blank pending human design authority. `GET /api/health` reports runtime and Testnet configuration without provider calls. B-001 adds a separately protected operator proof route; it is disabled by default.

## Local commands

Use Node 26.12.1 and npm 12.2.1. From the repository root:

```sh
npm ci
npm run dev:api
```

In a second terminal run `npm run dev:web`. Vite prints its web address; `/api` requests proxy to `127.0.0.1:3001`. Direct health URL: `http://127.0.0.1:3001/api/health`. The setup requires no service keys. `.env.example` documents future values; copying it does not configure a working integration. No automatic local environment-file loader is installed yet; future server tasks must explicitly configure their secret-loading path.

Run all local/CI checks with `npm run check`; individual commands are `npm test`, `npm run check:contracts` and `npm run build`. Workspace tests can run with `npm run test --workspace @padalapocket/web` or `npm run test --workspace @padalapocket/api`. Node's built-in test runner is the initial test tool. Current web checks cover infrastructure, not browser interactions; select/install the actual browser test tool before FE implementation. API build is syntax verification because this is plain JavaScript. Web build uses pinned Vite.

S-002 adds [MOCK API fixtures](../handoff/api-examples/README.md) and strict fixture validation with negative tests through `npm run check:contracts`. This checks the development contract only, not live endpoint compatibility. No provider test runs in ordinary PR checks.

## Ownership and Git

For S-001, DEC-036 permits backend-only acceptance and direct work on main. Record the accepted commit and required clone, remote CI and hosted routing/runtime evidence; no teammate review or PR/merge is required for this task.

Follow [implementation plan](implementation-plan.md#shared-edit-protocol): backend owns root configuration, lockfile, API and CI; frontend owns approved web work after setup. For S/C tasks, backend records shared edit scope and may proceed without frontend acknowledgment under DEC-039; resolve actual overlapping edits before merge. For other tasks, reserve shared edits with the other developer before changing them. One editor updates contracts/config and merges first; the other syncs. Use task branches, reviewed PRs, green checks and normal merges from current main. Do not discard pre-existing local documentation changes. Backend alone implements, verifies and accepts S/C tasks under DEC-039 and updates their plan/packet evidence; frontend participation is optional. FE task ownership is unchanged.

The `Workspace checks` workflow runs install, contract checks, both workspace tests and build on PRs and main pushes. A repository admin should require job `check` before merge; until configured, the reviewer must manually confirm it is green. The local check command is runnable; remote CI and branch protection require actual GitHub execution/access and are not established by this document.

## Deployment routing

The root `vercel.json` builds `apps/web/dist`; `api/index.js` bridges Vercel's root function convention to `apps/api/src/router.mjs`. `/api/*` rewrites to this entry, with the handler validating the requested route. This routing is verified by the production health check recorded in [S-001 evidence](../handoff/S-001.md#final-acceptance-evidence--2026-11-06). Root package engines select Node 26.x. Check `node -v` in build logs and `runtime` from `/api/health`; they can differ in patch version. Later SDK work must verify both meet Noir's exact requirement.

Only public configuration may use `VITE_` names. Server credentials/signing keys must never appear in web imports or public environment variables. Use new Testnet-only accounts later; no real funds. No actual secret values belong in tracked files. Keep deployment secrets in host settings. Provider authentication and payment proof are later tasks, not part of the public health route.


## B-001 operator proof

This isolated Testnet experiment requires separate fresh owner/agent/merchant signers and a 256-bit operator token. Keep `.env.local` owner-readable only (`chmod 600 .env.local`); Git ignores it. Node explicitly loads it with `--env-file`; regular dev commands do not load secrets automatically. SDK pins are unchanged; DEC-043 scopes axios 1.20.0 beneath Stellar to address the earlier audit findings. Run `npm ci`, `npm run check`, and `npm audit --omit=dev` when changing that dependency baseline.

Initialization (`init`, then `fund`) is once only and refuses to replace existing identities. The original Gas proof used `VELO_GAS_API_KEY` and `VELO_GAS_BASE_URL=https://www.velo-build.dev`; its exact envelope/request and journal remain preserved. DEC-042's `transition-direct` command performs fresh read-only ledger/source-sequence checks before explicitly changing transport and renewing the unattempted finite policy expiry. It is registration-only, requires preserved historical evidence and refuses another transition. The successful transition is recorded in [B-001](../handoff/B-001.md); do not run it again or edit the journal to bypass a guard.

Configure Preview only with the same identities/policy, `PROOF_ENABLED=true`, `PROOF_TRANSPORT=direct`, a General `VELO_API_KEY`, and the fixed `PROOF_CHECKOUT_ID` from the proof packet. Set local `PROOF_BASE_URL` to that deployment's HTTPS origin. Production keeps this proof disabled. Signed envelopes stay local and are sent only in the authenticated POST body; direct mode requires no envelope environment redeployment per operation.

Run each pair separately, confirming ledger SUCCESS before preparing the next:

```sh
node --env-file=.env.local apps/api/scripts/proof.mjs prepare registerDevice
node --env-file=.env.local apps/api/scripts/proof.mjs call registerDevice
```

Repeat explicitly for `registerAgent`, then `fundEscrow`. Before authorization, run `call snapshot` and `call check`; require the real check to pass. Then prepare/call `authorize`, record `call snapshot`, prepare/call `claim`, and record `call snapshot` again. Demo funding is 5 XLM, authorization 0.1 XLM and cap 1 XLM. Record separate hashes and balances; pending/submitted is not success. `call checkout` retrieves the fixed separate 0.10-XLM Velo checkout; it never establishes Noir settlement or implements product funding.

The CLI journals dispatch before sending and refuses another direct dispatch or replacement preparation for an attempted operation. After any uncertainty use `call transaction HASH`; preserve the exact envelope/nonce and investigate rather than resetting identity. The original Gas `call status` remains identity-only. `.env.b001-evidence.json` is an ignored sanitized journal; `.env.b001-gas-envelope` is the owner-only sensitive archive. Never print, commit or upload the archive.

Preview protection is additional to operator authentication. A connected Vercel share helper can supply a temporary `_vercel_jwt` cookie saved, without logging it, in owner-only ignored `.env.b001-preview-cookie`. The CLI accepts only that single cookie or the legacy `__vercel_protection_bypass` cookie and sends it to its validated Preview origin with redirects forbidden. It also supports the pre-existing local `VERCEL_AUTOMATION_BYPASS_SECRET` header when already configured; do not disable Deployment Protection. Tokens/cookies/envelopes stay out of URLs and logs. B-005 disables/removes the temporary proof route in favor of real Auth.

## B-003 operator backing proof

From repository root, `node --env-file=.env.local apps/api/scripts/wallet-backing.mjs init` creates fresh experiment devices/student key and refuses existing state. `run` uses Testnet Friendbot for that student's fees, then executes the fixed funding/withdrawal/private-spending sequence. Sensitive `.env.b003-state.json` contains signing material and exact envelopes; keep owner-only permissions and never commit or share it. Existing production/B-001/B-002 devices are not modified.

After any interrupted/failed run, use `node --env-file=.env.local apps/api/scripts/wallet-backing.mjs observe` for identity-only ledger observations. Do not reset the journal, remove a stale lock, or rerun the experiment until its recorded stage and hashes have been inspected. SUCCESS hashes are recognized; uncertain dispatches never get replacement envelopes. Friendbot uncertainty also requires account inspection. The local CLI is an experiment, not automatic multi-instance recovery. See [B-003](../handoff/B-003.md) for outcome and limits.

B-003's additional topology verification uses `init-buckets`, `run-buckets`, and `observe-buckets` with the same CLI/env invocation. It creates separate Needs, Wants and Savings devices in ignored owner-only `.env.b003-buckets.json`, preserving the original journal and reusing its student identity for balance observation. Needs/Wants use the allowance agent; Savings names the parent as device agent because device registration requires an agent address, but receives no spending policy. The proof funds each with 1 Testnet XLM, checks policies, withdraws each independently and checks total funds against actual fees. These commands share the original CLI lock; the same uncertainty and inspection rules apply.

## B-004 anchor access proof

On `backend/B-004`, run `node --env-file=.env.local apps/api/scripts/anchor-proof.mjs start` once. It authenticates the existing Testnet merchant through validated SEP-10 and initiates a 1-XLM simulated reference-anchor withdrawal. It sends no ledger payment. The exclusive owner-only ignored `.env.b004-anchor.json` holds JWTs and interactive URLs; never print/share/commit it. `resume` is permitted only before any initiation dispatch. `history` reauthenticates and records actual transaction history; `status` requires a recorded withdrawal ID. Unknown initiation never automatically repeats. Inspect history and preserve the journal after errors. No production endpoint, actual payout, ledger transfer or AI identification is implemented by this CLI.

B-004 Gemini probe: set `GEMINI_API_KEY` in ignored `.env.local`, then run `node --env-file=.env.local apps/api/scripts/gemini-identify.mjs path/to/test-image.jpg`. Defaults to one attempted model request per UTC day; set `GEMINI_DAILY_TEST_LIMIT` to 2 or 3 only when needed. Model fallback is configurable with `GEMINI_VISION_MODELS` (at most three). Usage state is local and per checkout; Google's actual quota is project-scoped and remains authoritative. Use a synthetic/test product image for the B-004 proof.

B-004 Groq proof: `node --env-file=.env.local apps/api/scripts/groq-identify.mjs path/to/test-image.png` reads `GROQ_API_KEY` and permits one attempted request per UTC day, with no retry. Gemini's credential may remain configured. The local usage file is not the provider quota meter.

Anchor follow-up under DEC-051: `retry-initiation` is an explicit operator experiment for an ID-less failed initiation only; it preserves history and checks for an empty current history before dispatch. It is not automatic recovery or proof an earlier request can never appear. `recover` can attach a single merchant-matching incomplete withdrawal from history without dispatch. Never remove the journal to restart. Responses and failure bodies stay private. The current journal contains a recovered interactive link; complete its Testnet-only form before `status`. This CLI still sends no ledger payment.

DEC-052 correction: `recover` recovers transaction identity and its **information** URL only; that URL is not an interactive-form link. A one-time `new-unpaid-session` archives the original incomplete unpaid session and captures a genuine new initiation response. Never pay the archived session. The reference UI business server `/start` exchanges the genuine interactive token for a private session ID; `/submit` accepts synthetic demo fields. These endpoints were verified directly from its served source bundle, not inferred from the information URL.

`node --env-file=.env.local apps/api/scripts/anchor-transfer.mjs` performs one fixed 1-XLM Testnet merchant payment only after a fresh authenticated anchor lookup and matching returned/UI destination, memo and amount. It journals the signed envelope/hash before dispatch, uses a 120-second validity period and bounds the fee. If a hash is already stored, it only observes that hash through Testnet Horizon; missing/unknown results never prepare or submit another transfer. No other merchant operation may run concurrently. `anchor-proof.mjs status` reports anchor status independently of ledger transfer confirmation.

## Velo parent wallet setup — DEC-076/077

The Velo project owner must be the app's existing parent Testnet public wallet, displayed on parent Deposit. Velo's in-house checkout pays the project owner; there is no arbitrary receiver argument in SDK 0.1.0-alpha.4. Connect that wallet in Velo, select/create its project, and generate a Testnet API key. Store that key in ignored .env.local as VELO_API_KEY (host secret configuration for deployment), then restart the API. Preserve OWNER_SECRET because existing escrows belong to it. Never paste Stellar secret keys into a checkout, chat or repository. If the parent demo wallet needs importing into a wallet extension, its owner must perform that secret entry locally. Create a fresh checkout after the API key change; old sessions retain their receiver. Verify paid through Refresh Velo status; the browser redirect cannot establish payment.
