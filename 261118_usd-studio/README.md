# USD Studio · Testlab

Browser-only JavaScript CAD using NVIDIA USD BRep's SMLib via @classcad/smlibwasm 0.6.2. No Replicad, OpenCascade, Rhino, backend, or model storage. CodeMirror and Three.js are presentation dependencies.

Option A: JS is the sole editable model; USDA is derived and read-only. Use trusted model scripts only: a Web Worker isolates execution from UI but is not a security sandbox. No automatic USDA-to-code conversion or USDA importing in the UI.

```js
const defaultParams = { width: 80, depth: 60, height: 20 };
const main = (sm, p) => sm.Box(p.width, p.depth, p.height);
```

Return Part, Shell or an array of these. Direct API: https://smlibpy.classcad.ch/docs/javascript/ . Native toUsd writes BrepArray and optional display mesh; no hand-authored fake BRep. USD readers require the NVIDIA schema to interpret exact topology. Three.js previews are tessellations; edge overlay samples actual BRep edges (skipping parametric seams). Multi-object preview uses native body colors when provided and fallback colors otherwise; body names and colors flow through the kernel exporter.

Worker scopes free transient kernel objects. It reopens generated USDA with strict/check and compares object counts and solid volume before enabling export. That is a same-library round-trip check, not independent OpenUSD validation. Tests cover box, drilled/filleted plate, union, separated objects and optional mesh output. Sliders modify source literals and camera remains stable during rebuilds.

Commands: Ctrl/Cmd+K, Run Ctrl/Cmd+Enter, Save Ctrl/Cmd+S. Local file picker or download fallback. No direct USDA editing or importing.

Development: npm install; npm test; npm run build. Runtime verification and independent schema validation are required before claiming full interoperability. Kernel package MIT/Apache-2.0/OFL-1.1; preserve upstream notices when distributing.

## 0.1.1-alpha.1 — worker startup and diagnostics

Worker sends ready only after dynamic WASM import has resolved; the UI queues builds until then. Explicit stage messages, user script console output, native warning handler and initialization exceptions feed the copyable Engine Output panel. Startup has a 45 s watchdog and each modelling stage a 60 s watchdog. Stop terminates the worker; Run restarts it. Browser CI serves the compiled app under the GitHub Pages subpath and requires actual WASM initialization, geometry generation, log messages, USDA output and restart. Run locally with `npm run build && npx playwright install chromium && npm run test:browser`.

## 0.1.2-alpha.1 — CAD preview and architectural demos

Preview uses non-indexed triangle corners with SMLib's exact surface normals instead of averaging normals across shared vertices. Chord tolerance 0.01 model units; real BRep edge curves are sampled for display with depth offset. The four new original architectural studies are Fluid twist tower (loft), Ribbon pavilion (three sweeps), Parametric strata tower (variable plates), and Bifurcating canopy ribs (spatial spline sweeps). Each uses direct kernel API and undergoes native USDA round-trip tests. The export geometry remains unaffected by preview changes.

## 0.1.3-alpha.1 — Galaxy SOHO architectural study

An original procedural interpretation of [Zaha Hadid Architects' Galaxy SOHO](https://www.zha.com/projects/architecture/galaxy-soho) and a supplied aerial photo. Four differentiated annular towers, rounded lofted slabs, hollow external and atrium glazing rings, four roof crowns and oculus rims, tiered curved skybridges, podium and planting. Every element is a named, colored solid; connections are separate parts with intentional interface overlaps rather than a single boolean-unioned building. Dimensions are illustrative model units (not measured real-world metres). Not a construction model, not a measured replica; glazing is represented by colored solid walls, not transparent material simulations. The example source and its parameters stay editable. Tests exercise native geometry, names, colors and USDA round-trip, plus a mobile-size browser run.

## 0.1.4-alpha.1 — adaptive progressive preview

Modelling retains the current exact bodies in the worker. Preview quality (draft/standard/high/ultra) sets chord tolerance as 0.5/0.1/0.025/0.005% of each body bounding-box diagonal with angular limits and adaptive edge display sampling. Changing quality reuses the same bodies. A bounded 64 MiB LRU cache uses exact native SMB bytes (hash plus byte equality) and quality; unchanged geometry can reuse tessellation even when source parameters change. Mesh batches arrive progressively, first object immediately, and stale previews are cancelled between batches. Logs distinguish modelling, tessellation, preparation and cache time, triangles and cache hits. USDA export/inspection is explicit and validated before download; preview quality never changes exact BReps. Export-with-mesh uses the kernel's independent export settings. Worker retains one model and disposes it when source changes. No persistent storage. Parallel workers and GPU batching deferred pending measurement.

## 0.1.5-alpha.1 — lean interactive preview

Auto preview quality selects Draft for 80 or more bodies and Standard otherwise; explicit quality overrides it. Shaded is the default display mode. Real CAD edges are sampled only when requested, independently of tessellation; switching to edges reuses cached surface meshes. Cache retains only viewport arrays rather than redundant indexed geometry. Bounds are reused across quality changes. Render on demand (including orbit damping, resize and incoming batches), rather than a continuous animation loop. Slider drags commit source changes on release. USDA inspection/export is explicit, even if the USDA tab is already visible after an edit; no automatic export on rebuild. Exact geometry, strict export validation, and demo details are unchanged. Model and export remain on the same worker to avoid copying native BReps.
