# Penbook — Prototype 01 implementation plan

**Status:** Planned, not implemented · 28 November 2026
**Scope authority:** [Prototype 01](PENBOOK_PROTOTYPE_01.md)
**Context:** [Vision](PENBOOK_VISION.md) · [Architecture](PENBOOK_ARCHITECTURE.md) · [Agent guidance](AGENTS.md)

## Approach

Build a fresh, independent foundation in Testlab. Use only the supplied specifications and current Testlab repository guidance; do not inspect or inherit earlier experiments, schemas, or unrelated applications. This is a staged plan for Prototype 01 only, not a roadmap for Penbook. Prioritise engine and architectural integrity over visual polish. Each stage ends with a demonstrable result and focused regression tests; fix foundational defects before proceeding. The five user-facing demos must be real files through the same engine. Exactly three user-facing content types: Markdown text, image and SVG.

## Stage 0 — Repository and specification setup

- Create `261128_penbook-01/` and archive the four supplied Markdown files unchanged in `docs/`. Add this plan and a scoped root AGENTS.md pointing to the documents.
- Read root Testlab guidance and deployment workflow. Keep the initial folder documentation-only; no manifest or gallery entry until a usable entry point exists. No shared infrastructure changes in this stage.
- All implementation acceptance checks are pending.

## Stage 1 — Model, registry, transactions and resources

- Establish small ES-module codebase, minimal test runner and independent document schema: identity/metadata, recursive root container, common properties, parent-context placement, module-specific properties/data, document preset and resource references. Use plain JS objects and binary Blob/ArrayBuffer resource storage; distinguish authored, effective, derived and session state.
- Implement validation of tree/unique IDs, supported layout/extent, geometry, module payloads and references; preserve unknown content types with a safe placeholder contract. Reject invalid operations atomically.
- Establish explicit registries for content/layout/view/format, small scoped module context and generic transaction/history API; implement add/remove/move/reorder/reparent/duplicate and cycle checks. Snapshot lightweight JSON or patches, not binary bytes. Preserve asset references through history; retain resources needed for undo; clear redo on a new edit.
- Implement resource ID/MIME/byte access, content deduplication where practical, reference checks and object URL lifecycle. Test-only module exercises defaults, validation, declared properties, editing/commit and presentation hooks without introducing production type branches.
- Write schema and contract notes, unit tests and a small source-only fixture.

**Exit:** Valid recursive documents and model operations tested; invalid operations leave the last valid document intact; ID and asset semantics proven; test-only registration works at the model level. F01, F06, F09 (model portion), F02 (initial), F18 (model portion).

## Stage 2 — Spatial engine, shared renderer and minimal modules

- Build a keyed shared render path with mount/update/unmount, effective defaults and explicit content/layout contracts. Use one visual representation for editor and presentation; authoring overlays separate.
- Implement independent per-axis fixed/auto/available/unbounded extent and fixed/fit/fill child sizing; document fallback for ambiguous constraints, nested sizing, logical CSS pixels, negative freeform positions and finite export bounds.
- Implement registered freeform, horizontal/vertical flow and grid (equal tracks, explicit spans, overlap, gaps/padding/alignment, appearance/clipping). Keep tree order, spatial placement and draw order independent. Deterministic conversion free → grid → flow → free with retained prior placements, warnings and undo; explicit extent conversion.
- Implement minimal registered Markdown text (headings, paragraphs, emphasis, lists, links), image (original local bytes, fit, caption/alt), SVG (safe native payload and basic fit). Select justified Markdown and SVG sanitisation approach; raw active markup is not executed; standalone output uses the same safe rendering rules. Test the registration-only smoke module with the shared renderer and generic properties.
- Implement scroll, pan/zoom (including negative coordinates, fit/reset and coordinate mapping), and paged view over ordinary fixed-size child containers. View changes never mutate authored structure. Use small nested fixtures and test overlap and sizing in Chromium.

**Exit:** Actual rendered note, nested composition and fixed grid with a full-page transparent SVG annotation, plus pan/zoom and paged navigation. Verify targeted updates at the renderer boundary. F02 (render), F03–F05, F07, F10 (initial), F18 (markup portion).

## Stage 3 — Live authoring and command shell

- Minimal shell: live central document, recursive hierarchy, properties, contextual toolbar, optional module tools slot, file explorer region, searchable command palette and status bar. Restrained grayscale UI with theme overrides; use Testlab navigation at publication, not duplicate shell controls.
- Implement persistent composition/content modes; single/sibling multi-selection; direct move/resize for common freeform tasks; hierarchy/commands/numeric properties for reparenting, nesting, grid spans, ordering and covered objects; draw order separate from structure. All actions use generic commands/transactions; pointer gestures commit as one edit, not one edit per event.
- Implement accessible text editing and formatting with Markdown retained, image import/replace, SVG import/source edit. Active block switching commits or cancels gestures deliberately; unaffected modules remain mounted. Generic inspector and contextual module controls come from declarations, not central content switches.
- Provide preview without authoring chrome, document JSON source editor omitting binary bytes and native block payload editor; validate before applying, preserve last valid state on failure. One chronological undo/redo across modes and modules; dirty/save state groundwork. Keyboard shortcuts must not steal ordinary typing. Add model and browser regression cases.

**Exit:** User can edit a live mixed document, manipulate composition, edit native payloads, select covered content, switch active editors and undo/redo the chronological sequence. F02 (generic authoring), F04/F06 (UI), F08–F10, F18 (source edits).

## Stage 4 — Presets and creation behaviour

- Define one configuration structure for application preset library, active configuration and saved document snapshot: view/mode, panel visibility, new block/container defaults, document and page subtree templates.
- Ship standard default, text note, board and paged notebook configurations. New document offers active, chosen app preset or standard default. Open activates saved snapshot; live adjustments do not persist until explicit save-to-app or save-to-document. App presets/settings only in browser storage, never authoritative documents.
- Instantiate page templates with fresh IDs and valid resource dependencies. Paged navigation and adding pages are generic composition operations; test after reopen in Stage 5. Existing authored dimensions/layout/content unchanged by view or active preset alone.

**Exit:** All preset paths and independent page creation demonstrated, with model/browser checks; F11 (reopen portion in Stage 5).

## Stage 5 — Portable formats and local file workflow

- Register clean JSON and primary editable HTML adapters, both reconstructing the same source and resource store. Asset-free JSON readable; separate resource payload section for asset-bearing JSON. Document exact experimental fields and resource encoding.
- HTML: short identifying header, inert authoritative source near start (candidate `script#document-source`), isolated resource section, fresh presentation via the shared renderer and only necessary local dependencies. Store a binary once, even if reused; preserve MIME and bytes; correctly escape script-closing strings, text and attributes. A trusted minimal asset resolver is acceptable only for image-bearing output. No editor scripts in standalone output.
- On open ignore stale/modified/missing projection and rebuild from validated source/resources. Missing authoritative source is an error. On save generate fresh output. Test source-only parsed edits that preserve old projection and bytes, then reopen/regenerate; document agent editing and stale browser projection behaviour.
- Implement actual file open/save/save-as, authorised folder listing/create/open/save-back, picker/import/download fallback, dirty confirmation and explicit cancellation, denial and failure handling. Validate and encode before writing; do not claim atomic native file replacement. Browser document store, linked assets, ZIP and autosave/conflict recovery are not required.
- Verify JSON and HTML round-trips, shared resources and missing assets, active markup safety, offline standalone file:// viewing with networking disabled, text-only dependency scope and preset/page creation after reopen. Test-only module serialization and export without changes to generic adapters.

**Exit:** Both editable formats round-trip and standalone HTML works offline; safe source edits, failures and permission handling tested as feasible. F02 (complete), F11 (complete), F12–F18.

## Stage 6 — Real demos, stress tests and evaluation

Generate via the same engine and adapters, using original/synthetic local media:

| File | Exercises |
|---|---|
| 01 — Text note | Vertical flow, fixed/responsive width, auto height, Markdown and embedded image; edit/reorder/size. |
| 02 — Moodboard | Unbounded freeform, several content blocks and overlap; pan/zoom, resize, stacking and conversion round-trip. |
| 03 — Architectural sheet | Fixed grid, spans, text/images/SVG, transparent full-grid annotations; hierarchy selection, draw order and standalone fidelity. |
| 04 — Paged notebook | Two ordinary fixed page containers, content/paged preset, new page template works after reopen. |
| 05 — Mixed composition | Nested mixed layouts/extents; reparent, duplicate, asset sharing, view independence and undo/redo. |

- Five editable HTML files, representative JSON equivalents and instructions; no custom per-demo behavior.
- Generate synthetic stress fixtures (100–500 lightweight blocks and moderate asset-heavy variant); measure lightweight note and larger fixture read/parse/render, serialize/write where possible, board/grid interaction and layout conversion. Record sizes, browser/version, hardware/environment, method and limitations. No invented latency guarantees.
- Run F01–F20 acceptance matrix end-to-end. Record pass/fail/unverified, test commands and evidence; distinguish automated browser checks from real native file-picker permissions and physical device testing. Fix critical bugs, not speculative non-goals. Write evaluation and known limitations; no subsequent prototype roadmap.

**Exit:** All five demos editable/saveable/reopenable through same engine; acceptance and performance evidence documented. F19, F20 and full F01–F18 regression.

## Stage 7 — Testlab integration and first runnable release

- Establish usable static entry point, `prototype.json` with appropriate locally available Lucide icon, plain SemVer (proposed 0.1.0 for first user-facing release), theme overrides, and scoped PWA/offline strategy compatible with Testlab. Decide build integration after inspecting current assembly script; keep changes isolated and document any necessary shared build changes before making them.
- Run model/browser/production-build checks available. Follow then-current root AGENTS.md for development branch, squash merge, deployment and release verification. Verify exact SHA/version in public release.json and HTML label; report workflow result, URL with SHA and any limitations. Do not release an empty documentation-only app.
- Handoff: run/build instructions, schema and module contract, conversion policies, file format and source-only editing guidance, demos, acceptance report and evaluation.

## Proposed implementation decisions (reversible, not architecture amendments)

- Prefer vanilla ES modules and native DOM/CSS; choose build tool only as needed. Consider small justified Markdown parser and SVG sanitiser; record licence and offline bundling when selected. No framework requirement.
- Use native CSS Grid/Flexbox/positioning and CSS px; document grid indexing, finite board bounds and layout conversion policies in Stage 2 rather than freezing exact schema now.
- Start with lightweight JSON snapshots or patches and separate immutable resource bytes; measure before optimising. Use a keyed renderer, not repeated global replacement.
- Implement safe SVG as a constrained static payload, not a vector editor. Keep raw HTML/JS execution, advanced modules, named styles/components, generated queries, linked assets, ZIP, thumbnails and other brief non-goals out of scope.
- Suggested source areas: core, content, layouts, views, formats, resources, ui, tests, demos. Create actual files only when their responsibilities become necessary.

## Acceptance tracking

All F01–F20 are **pending** as of setup. Stage checkpoints above map to the brief; the final report must include each ID individually with status, reproduction steps/evidence, and any blocker. Browser/native permission tests must not be inferred from unit tests. No implementation, test success or app release is asserted by this plan.
