<!-- Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved. -->
<!-- Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE. -->
# Goals and implementation · Accounts-core

G-ynthetic Labs, internal. Kept current in the same commit as the work. Last updated 21 Nov 2026.
Status marks: **done**, **in progress**, **next**, **waits on the owner**.

## Goals
1. **One accounts module for every product.** Products pin it; none writes its own accounts code.
2. **Kept on the person's computer.** Every account, session, consent and count is sealed by the product's vault.
   Provider ids are kept as keyed hashes, sessions and magic links as digests, passwords as scrypt hashes.
3. **Every standard way in.** Google, Apple, GitHub (through connectors-lib), email and password, and optional magic
   links.
4. **Telemetry people can see.** Off by default, consent per probe version, aggregate only, small counts suppressed,
   and a person sees and sends every batch.
5. **Standard names.** OpenID Connect claim names, OAuth and RFC terms, and OpenTelemetry's counter and attribute.
6. **Partner-grade code.** Files at 300 lines or fewer (give or take 30), 1×3×n packages, every file mapped, every
   test keyed, and documents exported as PDF, Word and plain text.

## Implementation

| # | Item | Status | Where |
| --- | --- | --- | --- |
| 1 | Vault and audit log ports, documents, conformance check | done | `packages/core/src/local` |
| 2 | Accounts, linked sign-ins, sessions, password hashes and lockout | done | `packages/core/src/account` |
| 3 | Email and password; magic links, mail sender port, rate limit | done | `packages/email` |
| 4 | Probe registry, disclosure, consent, meter, aggregate export | done | `packages/telemetry` |
| 5 | Probe contract and sign-in probe | done | adapter-lib PR #9, #12 |
| 6 | Sign in with Google, Apple and GitHub | done | connectors-lib PR #22 |
| 7 | Agent-Advocate-core pins Accounts-core; vault conformance against `@poly/vault` | next | Agent-Advocate-core |
| 8 | Sign-in screens (in the shared screen kit) | next | agent-screen-kit; show first |
| 9 | Registrations, numbers, feature names, privacy notice | waits on the owner | `docs/owner-items.md` |
