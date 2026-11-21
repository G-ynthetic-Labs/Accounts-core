<!-- Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved. -->
<!-- Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE. -->
# Accounts-core · what waits on the owner

**G-ynthetic Labs · Internal** · 21 Nov 2026

Each item below refuses until it is set or decided. Nothing here has been guessed.

## Registrations

| Item | Why it is needed |
|---|---|
| A Google Cloud OAuth client of the Desktop type | Sign in with Google (connectors-lib `sign-in-google`). |
| Whether to use that client's secret | Google issues Desktop clients a secret it says is not confidential. The sign-in kit's rule is "no client secret". If you allow it, it is passed by `secretRef` only. |
| An Apple Services ID with Sign in with Apple, and an https return page | Apple posts its answer to an https page. The page hands the fields back to the app unchanged. |
| A GitHub OAuth app with the device flow turned on | Sign in with GitHub by a short code. No secret is needed. |
| The mail service for magic links | `MailSender` is a port. Until a service is chosen, magic links stay off or go to the simulated outbox. |
| The telemetry exporter service | `MetricExporter` is a port. Until a service is chosen, nothing leaves the computer. |

## Numbers

None of these is set:

- **Sessions:** `sessionMinutes`.
- **Passwords:** `cost`, `blockSize`, `parallelization` (scrypt), `minLength`, `lockoutThreshold`, `lockoutMinutes`.
- **Magic links:** `enabled`, `linkBase`, `productName`, `linkMinutes`, `maxSends`, `windowMinutes`.
- **Sign-in connectors:** `clockSkewSeconds`.
- **Telemetry:** `enabled`, `exportIntervalDays`, `suppressionThreshold`.

## Decisions

- **Feature names:** `accounts-core`, `accounts-email`, `accounts-telemetry`, `accounts-tools`. In connectors-lib: `sign-in-google`, `sign-in-apple`, `sign-in-github`. These are proposed, and a new feature name needs your word.
- **Privacy notice:** any telemetry needs the privacy notice rewritten and reviewed by the lawyer before it ships. The current custom-agent notice says "no telemetry".
- **Poly's credential-check probe** (adapter-lib `domains/poly/telemetry.js`) is proposed. Turning it on is your call.
- **Contract §12, account sign-in:** this connectors-lib amendment is proposed and awaits your word.
- **The pin:** Agent-Advocate-core pinning Accounts-core, and running the vault conformance check against Poly's vault.

## Findings to look at

- **Poly's vault item names.** `@poly/vault` accepts any secret-name form on `put`, but its envelope check reads back only slug names. A name that `put` accepts can therefore fail on `get`. Accounts-core uses slug names only. The vault itself should be made consistent in Agent-Advocate-core.
- **Two kinds of sign-in in connectors-lib.** The sign-in kit's original use is connecting a service for an agent. Account sign-in is a person signing in to our product. They share the kit's steps (PKCE, answer checks), but their rules differ on client secrets. That difference is set out in contract §12.
