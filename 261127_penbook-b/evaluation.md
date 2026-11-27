# B-only architectural observation and parity checklist

## Observed implementation

The editor needs no secondary composition model: the persisted JSON is the runtime model, and DOM is disposable. The same pure renderer produces static HTML and editor block markup; native CSS handles layout, and the browser handles native SVG images and rich text. In exchange, schema validation, identity-aware duplication, asset/reference resolution, safe HTML projection, component resolution, and stale-preview detection are custom responsibilities. JSON allows unknown fields to survive roundtrips, but editor affordances do not automatically follow arbitrary new schemas. It is easier to express an opaque custom widget through native code than to teach the editor how to manipulate its internals.

Modules: core.mjs (model operations, validator, renderer), app.mjs (editor and file UI), testlab-theme.css, index.html, regenerate.mjs, test.mjs. Approximate implementation size excluding demos, tests and generated assets: 54315 characters. B has two document source sections and a derived projection; no hidden third tree. Compared to pure HTML, payloads are less directly readable because HTML/SVG source is JSON-escaped, and content duplicates in output. The separate asset section keeps binaries out of the editor source area, not out of the saved HTML itself. The stale preview is a real architectural tradeoff and is exercised in the test suite. No evidence about A or comparative winner is claimed.

| Brief criterion | B implementation / actual verification |
|---|---|
| File/source round-trip | 10 demos + reference model-level roundtrips passed; native picker and visual edit roundtrip pending |
| Layout and recursion | model conversion, reparenting, nested free renderer checks passed; browser gestures pending |
| Identity | duplicate graph node/edge remap and reparent cycle rejection passed |
| Reuse | model-level slide copy with dependencies passed; system clipboard pending |
| Styles/components | shared style/template renderer and instance propagation passed; visual detach pending |
| Graph | semantic edges, missing endpoint indication, renderer tests; live drag browser pending |
| References | SVG snapshot preservation passed; refresh permission and failure behavior pending browser test; no recursive live reference resolver |
| Custom content | native payload, inert encoding and generated sandbox structure; actual Run/Stop and security verification pending |
| Offline | HTML contains presentation and resources; actual offline browser test pending |
| Error handling | invalid schema and unknown blocks tested; failed-save UI and exotic payloads pending |
| B-specific | direct source fingerprint change and regenerated markup verified; stale warning display pending browser |
| Agent | scripted source-edit trial passed; not independently authored by another agent; no browser verification |
| Performance | single-run pure JS 500-block roundtrip; no statistically meaningful browser timing, render or memory benchmark |
| Device | no physical pen/touch testing |

No shared Testlab modifications or A implementation inspection. References reviewed at documentation level: Testlab guidance, HTML Notes, Website Builder, Graphic Design System, Archbook docs, Mindmap, Sketchnote and Sourcebook. Graphic Pad root inspected; no README available and its large implementation was not fully reviewed. The use of a small CSS property allowlist, fixed schema 1, JSON point lists for sketches, snapshot-first references, and simplified template relationship were implementation decisions not specified by the brief. These are candidates for the next experiment, not production commitments.
