<!-- Copyright (c) 2026 G-ynthetic Labs LLC. All rights reserved. -->
<!-- Proprietary and confidential. Trade secret of G-ynthetic Labs LLC. Unauthorized copying, use or disclosure is prohibited. See LICENSE. -->
<!-- POLICY-PROCEDURE:BEGIN -->
## Company policy & procedure — check before acting

G-ynthetic Labs policy and procedure live in **G-ynthetic-Labs/Policy-Procedure** (https://github.com/G-ynthetic-Labs/Policy-Procedure). If it is not in this session, attach or clone it. Before any task — writing code, starting a codebase, UI, docs, commits, choosing models or vendors, anything — open its `INDEX.md`, find every one-liner whose topic or keywords match what you are about to do, read each matched file **in full**, then act on it and name the IDs you applied. If nothing matches, say so. If a policy conflicts with the user's instruction, stop and raise it before acting.

_Managed block — edit it in Policy-Procedure/POINTER.md, not here._
<!-- POLICY-PROCEDURE:END -->

<!-- REPO-MAP:BEGIN -->
## Company coding policy and repo map

Canonical copy: `repo-map.json` in **G-ynthetic-Labs/Policy-Procedure** (POL-REPO-001, updated 2026-11-21). Every company repository carries this block at the end of `.claude/CLAUDE.md`. Where an older note in this repository's CLAUDE.md files disagrees with it, this block is the newer rule (William, 21 Nov 2026) and wins; a repository's own checks still have to pass.

### Coding policy

1. **File size (POL-CODE-001):** aim every code file at 300 lines, in a band of 270 to 330; 330 is the hard ceiling and the only line a check fails on, and a file under 270 is never a failure. A file headed past 330 becomes a nested 1×3×n module (POL-CODE-002). A repository check that still fails files above 270 is raised to 330 in a pull request; until then, keep passing it.
2. **Maps (POL-CODE-004):** every repository keeps `codemap.json` (classes, methods, functions and dependencies per code file) and `features.md` (where each feature's code lives), current in the same commit as the change.
3. **Names (POL-CODE-003):** use the industry-standard, widely adopted name wherever one exists; a standard function gets its standard name. Invent a name only when no widely adopted one exists, and say so in the docs.
4. **Goals (POL-CODE-007):** every repository keeps a goals and implementation list (`GOALS.md`: goals, what is built, next steps), current in the same commit as the work.
5. **Stack (POL-CODE-006):** React, Vite, TypeScript, Python and Node.js only (Electron counts as Node.js), each on its current stable release. Any other new language, framework or run-time dependency needs William.
6. **Documents (POL-DOCS-002):** every user-facing document, in our apps and in what we deliver, can be exported or printed as PDF, Word (.docx, which is also the Google Docs export and must open cleanly there) and plain text (.txt).
7. **Shared code (POL-REPO-001):** shared code lives in its generic repository below and is pinned or imported from there, never copied or duplicated in a product. Before writing code, find its home in the map; if the code belongs elsewhere, build it there.
8. **Pull requests:** partner-grade work, no shortcuts. Pull requests are opened ready for review, never as drafts.

### Where code goes

| What you are writing | Its home |
|---|---|
| A model adapter (talks to one kind of model server) | adapter-lib |
| A connector (reaches one outside system or service) | connectors-lib |
| Choosing which model answers, the model pool | LLM-tank |
| A role, skill, tool or job description | Roles-lib, Skills-lib, Tools-lib, agent-job-description-lib |
| Checking or granting what an agent may do | Capability-gate |
| Sealing, attestation, reproducible inference | Certified-Inference |
| Accounts, sign-in sessions, passcodes, telemetry runtime | Accounts-core |
| Storing the record durably | record-storage-lib |
| Engine pieces (record, buckets, adapter contract, pass) | engine-core |
| Harness governance and deployment configuration | Agent-Harness |
| Anything every agent's screen needs | agent-screen-kit |
| A UI component, skin, reference, 3D model, animation, sound or effect | the matching UI library |
| Anything every email agent needs | Agent-email-core |
| Anything both Poly editions need | Agent-Advocate-core |
| A legal notice or legal document | Legal-attribution |
| A company policy or procedure | Policy-Procedure |

### Which repository owns what

**Engine and governance**

- **engine-core**: The domain-agnostic engine: storage buckets with coordinates, the signed append-only record, the one adapter contract, events and the pass mathematics.
- **Agent-Harness**: The harness on engine-core: the pass, its governance module (just cause, default deny, permits, lockout, record, reports) and per-deployment configuration and delivery. _No agent goes here; agents live in their own repositories._
- **Capability-gate**: The governor: what an agent may do, checked before it acts; grants are single-use.
- **Certified-Inference**: Sealing: byte-for-byte reproducible local inference, attestation where the model runs, and the tamper-evident ledger for any bytes.
- **record-storage-lib**: Durable record storage for every core: the record on SQLite per deployment, the signed-head log, anchors, restore, paging, backups and exports.
- **N-3-lattice**: The N^3 lattice package: geometry, the index and coordinate mapping, the facet store and the stacked variant.
- **N-n-lattice**: The sequential N^n lattice package that the engine pins; sibling of N-3-lattice with its own copy of the same core.
- **cascade-lattice-CS**: The generic Cascade Lattice simulation engine: a domain plugs in as a template, the template routes information in, the engine processes it and the record is read back out; City Secured is the first domain. Deterministic whole-number runs, every record an exercise. _No place, hazard, resource or domain word in its engine code; domain content goes into a template._

**Shared code libraries**

- **adapter-lib**: Model adapters, one folder per model server, all meeting one contract; also the telemetry probe contract and per-use-case probes. _No connectors, no retries, no routing._
- **connectors-lib**: Connectors to outside systems (mail, calendars, SMS, notifications, sign-in, generated connectors), credentials by secretRef only. _No model adapters._
- **LLM-tank**: The model pool every client agent draws on and its deterministic routing table; its core never names a provider. _Provider-specific code stays in adapter-lib._
- **Accounts-core**: User accounts kept on the person's own computer, sign-in sessions, email passcodes and magic links, and the telemetry runtime (consent, collection, aggregate reports, record of what was sent). _No adapters, no connectors._
- **agent-screen-kit**: The shared screen every agent core mounts (sign-in, what waits for a role, approve or deny as oneself) and each core's preconfigured dashboard.
- **Legal-attribution**: The legal notice on every file, the stamp and check tool, and the legal documents; every repository vendors it instead of writing its own.
- **Policy-Procedure**: Company policy and procedure, the keyed index, and the canonical copy of this repo map.

**Agent libraries (one shared tree: category > core > specialty)**

- **Roles-lib**: Roles: what an agent in one position is responsible for, and which skills and tools it may use.
- **Skills-lib**: Skills: packaged instructions for one kind of task, naming the tools they use.
- **Tools-lib**: Tools: one capability an agent can call, with inputs, outputs and limits; also the tool runtime (toolslib/) and the Library Bench.
- **agent-job-description-lib**: Job descriptions each core and specialty is built from, synthesised from at least three real postings kept as sources.

**UI libraries (same entry format, tiers and checks)**

- **Components-lib**: Working controls and widgets: buttons, toggles, switches, knobs, readouts, built once and reskinned per app.
- **Skins-lib**: The look over plain parts: surfaces, frames, colours and type.
- **References-lib**: The bar: approved screens per app at desktop and phone size, and the screenshot checker.
- **Models-lib**: 3D objects and where they sit: placeholders now, final art later, swapped one for one.
- **Animations-lib**: Motion: how things enter, move, change and settle on screen.
- **Sounds-lib**: Sound cues, always quiet and only behind a Sound switch the person turns on.
- **Effects-lib**: Light and material: glow, energy, particles, procedural panel art and text treatments.
- **Dashboards**: The dashboard builder: layouts, skins, gadgets and the export contract; its dashboards are imported into Architect-Workbench.

**Agent cores (generic; specialties pin them)**

- **Agent-email-core**: The generic email agent: pipeline, gateway, screen kit and support-desk pack every email agent needs. _Nothing of one email specialty._
- **Agent-Advocate-core**: The shared Poly foundation both editions pin (kernel, validation, governance, voice, vault, editions, benchmark). _Nothing of one edition._
- **Agent-emergency-core**: The generic emergency operations agents: one position agent per Emergency Operations Center position. _Nothing of one city, county or utility._
- **Agent-<category>-core**: Every other category has one generic core repository (bookkeeping, dispatch, front desk and the rest); the tree is in the Agent repository's index.md.

**Specialties and products (own screens, settings and wiring only)**

- **Agent-email-personal**: The personal email agent (inbox assistant) and its screen; pins Agent-email-core.
- **Agent-email-online-business**: The online-business email agent (customer desk) and its screen; pins Agent-email-core.
- **agent-Day-Trader**: The day-trading specialty, paper trading only: a full copy of Agent-Harness v1 with the trader added.
- **Agent-Advocate-Personal**: Poly, Personal edition: its own screens, settings and wiring; pins Agent-Advocate-core.
- **Agent-Advocate-Business**: Poly, Business edition: its own screens, settings and wiring; pins Agent-Advocate-core.
- **Agent-desktop**: n-HR, the one desktop app every agent is bought, installed and run in, with its Android shell. _No core's package, pack or screen._
- **Agent**: Every agent in one tree (category > core > specialty) as byte-for-byte copies of their source repositories. _Never edit an imported code/ folder here; work happens in the source repository._
- **Architect-Workbench**: The owner's development tool from first consultation to a licensed engine; reaches the engine only over HTTP.

**Company**

- **operations**: How a consulting job runs, consult to closed books: the six stages and gates, templates, register shapes and tools. _No client data, ever._
- **Logo-Mockup**: Logo and brand mockups and the brand presenter.
- **eyes-only**: The owner's leadership-only documents. _Read only for William on his instruction; never quote, summarise or copy from it anywhere else._

**Superseded or reference only (add no new work)**

- **Tooling**: The original tools, skills and roles store, migrated into Tools-lib, Skills-lib and Roles-lib. _Add nothing here; use the three libraries._
- **Poly**: The old Poly prototype, superseded by Agent-Advocate-core and its editions. _Leave untouched._
- **Advocate**: The original Advocate base the Poly rebuild started from; reference only. _Build new Poly work in Agent-Advocate-core and its editions._

### Keeping this block current

- When a repository is linked to a session and its `.claude/CLAUDE.md` lacks this block, add it: from Policy-Procedure run `python3 tools/pp_pointer.py <repo>` (it creates the file or appends to it, and never changes text outside the markers), then open a pull request.
- A repository missing from the map, or a purpose that has changed, is fixed in `repo-map.json` and rolled out (PRO-REPO-001); never edit this block by hand.

_Managed block — edit it in Policy-Procedure/repo-map.json, not here._
<!-- REPO-MAP:END -->
