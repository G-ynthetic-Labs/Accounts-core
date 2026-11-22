<!-- Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved. -->
<!-- Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE. -->
# Accounts-core · notes for every session

Purpose: user accounts kept on the person's own computer, sign-in sessions, passwords and magic links, and the
telemetry runtime (consent, counting, aggregate export, record of what was sent). No adapters, no connectors.

- Read `README.md` first, then `docs/design.md`, then `docs/owner-items.md`.
- **Where things go (POL-REPO-001):** sign-in connectors in connectors-lib; the probe contract and probes in
  adapter-lib (pinned as `vendor/adapter-lib`); sealing in the product's vault. Never edit anything under `vendor/`.
- **Simulated only.** No real mail service, sign-in provider, telemetry service or credential without the owner's
  word. Credentials only as `{ "secretRef": "<name>" }`. Tests use synthetic `.test` people only.
- **People decide (D-145, D-208).** Only a person changes an account, gives consent or sends telemetry; an assistant
  is refused.
- **No invented numbers.** Every number is the owner's; unset refuses (A100, A101).
- **Standard names (POL-CODE-003).** Use the industry name wherever one exists.
- **Rules:**
  - Code files at 300 lines or fewer, give or take 30 (hard ceiling 330). Every package is a 1×3×n module with
    `@address module.part.sub`.
  - Stack: React, Vite, TypeScript, Python and Node.js only, on current stable releases.
  - The legal notice heads every file (`npm run legal -- stamp`).
  - Every code file carries the header (what, Spec, Source of truth, How it works) and a `@feature` from `repo.json`;
    `npm run map` regenerates `codemap.json`, `feature-map.json` and `features.md`. A new feature name needs the owner.
  - `GOALS.md` is kept current in the same commit as the work.
  - Tests use `node:test`; every test name starts with its key (`ACC-T###`, `EML-T###`, `TEL-T###`), listed in
    `key-registry/accounts-keys.json` in the same commit. A red test is never weakened, skipped or deleted.
  - D-166: the words in `repo.json` → `internalMarkers` never appear in anything a client can reach. No compliance
    claims; the audit log is tamper-evident, never called tamper-proof.
  - `npm run check` passes before every commit; `npm run docs` after a document changes.
