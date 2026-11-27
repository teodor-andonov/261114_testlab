# Penbook A verification

## Checks executed
- JavaScript syntax: both source files checked with the JavaScript parser in the authoring environment.
- Generated fixture checks: ten actual standalone HTML documents, unique block IDs within each file, root and runtime present.
- Repository scope: only the assigned prototype folder is intended to change.
- Browser runtime, Chromium native file handles, offline and trust boundary: **not executed** in the authoring environment. No performance timings or independent agent trial. No publication.

## Browser contract harness
Open tests.html from the served prototype folder. It checks all ten fixture round-trips, placement retention, duplicate identity, rejection of active content and duplicate IDs, opaque markup preservation, graph updates and editor-marker exclusion. Harness syntax checked; actual browser execution pending.

## Manual acceptance checklist (not yet executed)
| Scenario | Steps | Implementation / gap |
|---|---|---|
| File and source round-trip | Open 05, edit text, apply source, save and reopen | Implemented; verify formatting, IDs and data URLs; HTML parser recovery not strict |
| Layout | Select gallery-grid in 03; free → grid → vertical → free, undo | Implemented; 20px row bands, stores placements; flow clears width/height, approximation when no prior positions |
| Recursive nesting | Drag outline node onto nested container, try cycle, unnest | Implemented direct block children; arbitrary wrappers opaque |
| Cross-document reuse | Copy slide container, open 08, paste | In-memory clipboard; inline assets preserved, IDs remapped, shared stylesheet classes rely on target styles; cross-session not implemented |
| Identity | Duplicate and reparent; check markup IDs | Block IDs remapped, limited explicit internal ref attributes; SVG graph node IDs are local to diagram |
| Styles/components | Change named stylesheet; edit linked header, propagate and detach | Explicit propagation, not live template engine; shared fields not separately overridden; data-driven gallery uses native record markup rather than live array renderer |
| Graph | Open 04, drag node, add edge, arrange, undo | Implemented; graph edges scoped to one SVG; no cross-block connectors |
| References | Open 10, refresh fixture, grant folder with missing source | SVG snapshot refresh only; HTML/block reference resolution, live mode and cycle detection absent |
| Custom widget | Open 09, static preview, Run/Stop, edit template | Implemented; no dedicated parameter JSON UI; native component controls in sandbox |
| Offline | Save and open 01/09 outside app without network | Embedded files designed for standalone; app offline cache not added; not verified |
| Errors | Duplicate ID in source; malformed source; cancel save | Explicit contract checks; HTML parser can recover malformed tags; not tested |
| Pen/touch | Draw/erase in 01; pressure, pen-only | Initial stroke pressure only; whole-stroke erase; physical devices untested |
| UX | Navigate pages, zoom, scroll; command palette | Single selection; no full multi-select, free pan outside canvas only, no clipboard system paste, no drag across documents, no folder persistence |
| A-specific | Add safe opaque markup and CSS, edit nearby block, round-trip | Native source preserved where supported; not browser tested |
| Performance | Open/save time, layout switch, stress board | Not measured |

## Architecture observations
No custom block tree renderer is needed: the browser lays out native markup directly. Editing imposes a modest reserved attribute contract, selection chrome exclusion, source validation, layout conversion special cases, and a separate widget trust boundary. Native CSS provides named styles and responsive grids directly. The source is ordinary HTML but includes a fixed security policy and widget runtime, and embedded data URLs can be unwieldy. Shared component propagation is explicit because each instance is real markup; it is not yet a full linked template system. The most important next experiment is browser-backed round-trip testing with complex CSS, opaque blocks, assets and external agent-authored changes, followed by comparable performance measurements.
