# Modular Studio — Testlab prototype

**Version:** 0.3.0-alpha.1. Browser-only, static Vite experiment: a small composition shell inspired by the *ideas* discussed around Patchwork and the flexibility of Obsidian. Built independently, not a Patchwork fork.

## Architecture

```
                           Workspace shell
                         splits / tabs / focus
                                |
  JavaScript source -> Replicad Runner -> Geometry document (worker-owned)
       ^                                       |
       |                                 Geometry Formatter
  Parametric Controls                     /      |       \
       |                              viewer mesh  STEP    STL
       |                                  |
     Editor                             Viewer
```

**Shell** — small recursive split/stack layout tree. Panels may move without being recreated. Only the *layout preference* is persisted in namespaced localStorage.

**Editor** — CodeMirror 6 edits a normal `.js` file.

**Replicad Runner** — evaluates trusted scripts and produces a geometry document consisting of OpenCascade-backed Replicad shapes. It does not directly produce the viewer's meshes or exports.

**Geometry Formatter** — registry of source/target format adapters, distinct from the runner and the UI panel. The formatter converts the worker-owned `replicad/shapes` document into:
- `viewer/mesh` (tessellated faces and feature edges; automatically sent to the Three.js viewer)
- `step` (precise CAD B-rep; export on demand)
- `stl` (tessellated mesh; single shape only in this prototype)

Because OpenCascade WASM shapes aren't transferable to the UI thread, the formatter operates **inside the same Web Worker** as the runner; the two are separate modules and commands. This is an explicit translation contract, *not* a universal converter. Other runners like build123d could be added with new input adapters, and formats such as 3DM or glTF could be added as new outputs. There is no fake "one shape converts to everything" shortcut and no mesh presented as exact CAD.

**Viewer** — receives formatter-generated mesh data, never reads the Replicad source directly. Its camera persists across builds and panel moves.

**Parametric Controls** — reads the literal `defaultParams` values; changes replace only the exact matching tokens in the editor source and rebuild. No hidden parameter state.

## The file model

Source is an ordinary JavaScript file; opening, editing and saving uses the user's files. No backend, server-side storage, accounts, collaboration or file diffs.

```js
const defaultParams = { width: 60, height: 20 };
const main = (replicad, params) =>
  replicad.makeBaseBox(params.width, 40, params.height);
```

Only run trusted model files: moving evaluation to a Web Worker protects the UI but is **not** a security sandbox for hostile JavaScript.

## Docking UX

Only two visual targets:
- **Box** — outline the whole box; drop the dragged tab to dock alongside existing tabs.
- **Gap** — a single line at a box edge or existing splitter; drop to split the workspace.

Drag a divider to resize. Tab / Shift+Tab cycles tabs in the focused box **outside text inputs**; Space maximises/restores that box. Double-click the box header or use its maximize button for the same action. Ctrl/⌘+K opens searchable commands; Ctrl/⌘+Enter runs the model; Ctrl/⌘+S saves it. Reset the bento layout from the command palette.

This first version uses native desktop drag-and-drop; narrow mobile layouts stack boxes vertically and support maximizing. Touch-native docking is not yet implemented.

## Build and tests

```bash
npm install
npm test
npm run build
npm run dev
```

Tests cover the layout tree, drop-target classification, parameter-source edits, and geometry adapter conversion contracts. The Testlab deployment workflow builds this prototype before assembling the gallery. Gallery Home and theme controls are injected by the Testlab build.


## Stability and demos

The formatter retains its DOM elements while conversion status changes. Tabs update only the selected dock content; maximizing uses presentation CSS rather than tearing down the entire layout. The viewer renders on demand, pauses behind the command palette, and resizes only when its actual dimensions change. A serialized worker queue collapses obsolete builds and previews while preserving already accepted file exports; repeated export clicks for the same revision are ignored. File names are captured at request time, and a worker crash allows the next Run to recreate the worker.

The command palette lists six built-in examples: parametric pavilion, rounded block, parametric box, Boolean union + fillets, perforated facade panel and stepped tower. The box and Boolean/fillet scripts are copied from the independent Replicad Studio prototype.

Run browser regression checks against the production Vite build with `npx playwright install chromium` and `npm run test:browser` after `npm run build`. These check modal/keyboard behavior, mount stability, demo execution with real WASM, and STEP export/download.
