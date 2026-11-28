# Penbook — Agent instructions

## Read before implementation

- [VISION](PENBOOK_VISION.md): durable product intent and non-goals. [ARCHITECTURE](PENBOOK_ARCHITECTURE.md): living system definition and decision status. [PROTOTYPE 01](PENBOOK_PROTOTYPE_01.md): current implementation scope and acceptance. The architecture is not a backlog; implement only the active brief. Flag conflicts; do not silently settle major open decisions.
- Penbook is experimental. All current documents are disposable test material. Refactor, replace schemas and break compatibility when useful; no migrations or legacy workarounds until explicitly requested. Maintain a format identifier and document the current schema.
- Start Prototype 01 independently. Earlier A/B tests and other applications are references, not codebases to extend or migrate. Do not change unrelated repositories or prototypes.

## Architecture

- Browser-only, local-first, file-first PWA; target desktop Chromium. No application server, account, remote database or persistent browser document store. Browser storage is for settings, presets, handles and optional disposable recovery/cache only.
- Keep one authoritative JSON composition. The rendered DOM/HTML, previews and runtime state are derived. Only container blocks contain compositional children. Modules own atomic content; layouts own arrangement; views own navigation; formats own serialization. Keep the core type-agnostic and use small registered modules, not a dependency graph or plugin framework.
- Prefer ordinary HTML/CSS/JS and native payload formats; justify dependencies. Build reusable mechanisms, not use-case-specific subsystems. Preserve stored versus resolved properties and authored versus generated structure. Develop individual content modules gradually.
- Use one document transaction/history system; isolate transient module state and update only affected views. Contextual commands, toolbar, properties and optional module tools; prioritise the engine over UI polish.
- HTML is the primary portable file; clean JSON must work independently. Keep authoritative source clearly delimited and separate from binary assets and generated presentation. Never send Base64 or full large HTML files into agent context. Parse and patch only relevant source; preserve unrelated data, validate, and let Penbook regenerate presentation on open/save. No remote dependencies in self-contained output.

## Development and verification

- Work in substantial, coherent cycles. Keep code, tests, sample files and relevant documentation aligned. Prefer simple, inspectable implementations over speculative abstractions. Record material decisions, limitations and proposals; update agreed architecture only when the decision is actually made.
- Read applicable repository guidance and inspect current build/deploy workflow. Keep work scoped to the assigned app; follow its branching, version, commit and publishing conventions. Do not silently change shared infrastructure. If deployment is in scope, verify the actual result and report URL/version/commit.
- Test model operations, module boundaries, real browser editing, offline HTML, source/asset round-trips and failure recovery. Never claim unrun tests or device verification. Report blockers, compromises, deviations and evidence for the next prototype. Define the next prototype adaptively after evaluation, not via a fixed roadmap.
