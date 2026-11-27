# Penbook B — thin declarative composition (B2)

**Version 0.1.0 · experimental · independent B architecture**

Browser-only, file-first, vanilla ES modules and CSS. No dependencies, server API, account, IndexedDB or browser document database. Testlab discovers this static folder through prototype.json. It intentionally has no independent manifest or service worker; Testlab owns app installation and published version/commit UI. Branch remains unmerged until the two independent implementations are complete. 

## Run

Serve this folder from a static development server (for example `python -m http.server 8080` in this directory), then open localhost:8080 in Chromium. The development server only serves files; it is not an application backend. Choose one of the ten demos. Their HTML files can also be opened directly in any normal browser, including offline. In the editor: Ctrl+K commands; Ctrl+O Open, Ctrl+S Save, Ctrl+Shift+S Save As; Ctrl+Z/Shift+Z Undo/Redo; Ctrl+D duplicate; Ctrl+C/V composition clipboard; D draw; / insert palette when not typing. Double-click rich text/table cells or edit their source in properties. Drag free-positioned blocks on the canvas; drag the outline to reparent/reorder. Right/middle drag pans the finite scrollable region, Ctrl+wheel zooms. Pages mode shows one root child at a time. Use the root outline item for document metadata, style and template definitions. Use a workspace directory for read/write and reference refresh. Non-Chromium fallback uploads and downloads copies; folder handles are not remembered.

## Authority and editing contract

- A saved HTML file contains `#penbook-source` (schema 1 JSON), `#penbook-assets` (separate JSON resource dictionary), generated semantic presentation markup and a small fixed viewer script. Source sections escape literal less-than characters as JSON unicode escapes. They are inert. Both sections together are authoritative; the editor never imports the saved presentation DOM. Text/checkbox editing explicitly updates one model payload; gestures edit positions, graph nodes or sketch stroke data; other operations are JSON model transactions. Undo stores up to 60 in-memory model snapshots.
- Root and child objects have stable IDs. Container layout is free, horizontal, vertical or grid; native CSS handles arrangement. Extents are content, responsive, fixed or finite large canvas. Per-child position persists when switching to flow/grid. Free-to-flow ordering is y then x then stable ID. Local styles use a small native CSS property allowlist (no arbitrary CSS URLs); richer HTML/SVG/CSS/JS can be authored in payloads. Unsupported block types render a placeholder with original JSON retained.
- Named styles supply defaults; local CSS overrides win. Page templates share width, height and CSS appearance; local width/height/style override the definition, children and placement remain local. Linked composition instances resolve a component definition plus local overrides. Detach makes an independent copy. Instance descendants are generated, not independent editable blocks; edit their definition or detach.
- Sketch strokes use editable point lists rendered as SVG polylines; diagram nodes/edges have stable semantic IDs. Native SVG graphics are preserved as image payloads. Image resources retain original MIME and data URLs, deduplicated by data. Six gallery assets are synthetic vector studies. Gallery records are local JSON arrays.
- External reference paths are workspace-relative; refresh manually copies a new SVG snapshot or text/block summary. Snapshot remains when disconnected. No arbitrary adjacent-file access. The three mode labels are recorded but the prototype uses a snapshot-first resolver for all modes.
- Custom components have HTML, CSS, JS and JSON data. Static sandbox frame has no scripts; Run asks for confirmation and enables scripts in a sandbox without same-origin privilege. Stop resets the frame. CSP blocks normal network connections and remote resources; no parent state, DOM or file handles are passed. Own-frame navigation and resource exhaustion remain possible, and this is not a hardened security service. Run trusted code only. Rich text has a conservative semantic tag allowlist; unsupported markup is escaped in presentation but preserved when editing source. An editor-side visual rich-text edit can normalize unsupported markup. No arbitrary imported HTML is executed.
- Standalone presentation can become stale after source-only edits. A simple noncryptographic fingerprint shows a warning on mismatch; reopening always rebuilds from JSON. Saving updates both representations. For an agent/headless regeneration: `node regenerate.mjs input.html output.html` (different paths). This is the same renderer as the editor.

## Demo library and expected interactions

| File | Scenario | Try |
|---|---|---|
| [01](demos/01.html) | Journal | Draw/erase, navigate three fixed dated pages, insert page |
| [02](demos/02.html) | Brainstorm | Drag spatial cards, reparent via outline, pan/zoom |
| [03](demos/03.html) | Moodboard | Root free → grid → vertical → free, adjust tracks/gap, edit record array |
| [04](demos/04.html) | Mind map | Move nodes, connect by node numbers, auto-arrange, undo |
| [05](demos/05.html) | Note | Double-click rich text/table, edit checklist, add/reorder blocks |
| [06](demos/06.html) | Report | Edit root page template and shared heading/style, preview/print |
| [07](demos/07.html) | Presentation | Page through 16:9 slides, duplicate and copy a slide |
| [08](demos/08.html) | Website | Resize browser, edit shared cards, paste copied slide (switch demos without discarding unsaved work) |
| [09](demos/09.html) | Interactive | Edit parameter JSON, Run/Stop façade and counter, insert own component |
| [10](demos/10.html) | Architectural sheet | Open this prototype folder as workspace, refresh fixtures/architectural-view.svg, disconnect and retain snapshot |

[Reference HTML](fixtures/reference.html) · [Architectural view](fixtures/architectural-view.svg). Demo files are actual standalone editable documents, not app-only fixtures. 

## Checks

Run `node --check app.mjs`, `node --check core.mjs`, `node test.mjs`. Test suite verifies source/file roundtrips, layout, nested free positioning, IDs/relationships, unknown data, invalid schema, fingerprints, inert encoding, rich markup filtering, stress serialization, styles/templates, reuse, references, and an equivalent scripted source-edit trial. [Recorded model-level results](verification-core.json). Connector JavaScript runtime, not Chromium; times are single-run elapsed milliseconds, not comparable browser benchmarks. No independent agent trial, visual/browser smoke test, physical pen/touch test, filesystem chooser test, actual print, standalone CSP execution test or deployed release verification was performed. No comparison to A was undertaken.

Manual Chromium checklist:
1. Open each demo, change a block, save to a temporary folder, reopen, compare IDs/source and standalone appearance. Try source with duplicate IDs and malformed JSON; verify last good state.
2. Free → grid → vertical → free; drag and reparent, duplicate diagram and verify endpoint IDs. Try root/paged selection, zoom, and undo.
3. On report edit named style and template; edit component definition, detach an instance. Copy a slide to website using Ctrl+C/V.
4. Run/stop custom blocks; attempt parent DOM access inside test widget (must fail); offline opening with network disabled; external resource must not load.
5. Grant folder access, refresh architectural SVG, modify the fixture externally, refresh again; disconnect and rename file to verify snapshot. Save-back and Save As. 
6. Pen/touch draw, erase, pressure and pen-only checks on physical device; test portrait/small viewport and print preview.
7. Edit only source JSON in a saved copy using text editor, open in ordinary browser (stale warning), then open in B, save and verify fresh browser view.
8. Repeat performance measurements in both prototypes on identical hardware with at least five samples of open/save, layout switch and 500-block board render. 

## Limits and decisions

This is a first usable thin slice, not full parity with the brief. Deliberately small schema and native payloads. The finite canvas scrolls, not genuinely infinite in every direction; no multiselect/group align/distribute, lasso, pinch, per-point pressure interpolation, partial-stroke eraser, advanced crop, native style toolbar, live external block embedding, recursive reference resolution, remembered folder permissions, full page-template slots, visual source diagnostics beyond validation errors, automatic pagination or fully featured rich-text/table tools. Reference refresh for HTML is a text/summary snapshot, not an editable live include. Links inside a document can be authored in rich HTML; no internal link navigation UI. Diagram nested groups are composition containers, not internal graph clusters. Component overrides are coarse, and cross-document name collisions reject instead of merging. UI properties expose raw CSS/JSON for depth rather than adding many dedicated controls. Saving generated markup duplicates content in the envelope; embedded image bytes may appear both in the asset section and rendered image URLs. No separate comparison README outside this folder, no shared infrastructure edits, no deployment until sequential merge. 
