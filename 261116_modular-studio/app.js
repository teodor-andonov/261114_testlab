import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { syncFaces, syncLines } from "replicad-threejs-helper";
import { EditorState, Compartment } from "@codemirror/state";
import { EditorView, lineNumbers, highlightActiveLine, keymap, drawSelection } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput } from "@codemirror/language";
import { listConversions, SOURCE_FORMAT } from "./geometry-formats.js";
import { createWorkspace } from "./layout.js";
import { EXAMPLES } from "./examples.js";
import { editParameter } from "./param-source.js";
import { createJobQueue } from "./job-queue.js";

const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};
const button = (text, action, cls = "") => {
  const node = el("button", cls, text);
  node.type = "button";
  node.addEventListener("click", action);
  return node;
};
const eventBus = new EventTarget();
const publish = (name, detail) => eventBus.dispatchEvent(new CustomEvent(name, { detail }));
const subscribe = (name, callback) => eventBus.addEventListener(name, e => callback(e.detail));
const panels = {};
const title = $("documentName");
const dirtyIndicator = $("dirty");
const statusText = $("status");
const focusText = $("focusLabel");

let filename = EXAMPLES[0].filename;
let handle = null;
let dirty = false;
let built = false;
let lastBuildId = 0;
let nextId = 0;
let autoBuildTimer = null;
let parameterValues = {};
let previousSchema = null;
let formatterInfo = null;
const pendingConversions = new Map();
const formatStatuses = new Map();
let fitted = false;

function setStatus(message, kind = "") {
  statusText.textContent = message;
  statusText.dataset.kind = kind;
  publish("status", { message, kind });
}
function setDirty(value) {
  dirty = value;
  dirtyIndicator.hidden = !value;
  document.title = (value ? "● " : "") + filename + " · Modular Studio";
}
function setFilename(value) {
  filename = String(value || "model.js").replace(/[/\\]/g, "_").replace(/\.js$/i, "") + ".js";
  title.textContent = filename;
  setDirty(dirty);
}
function download(blob, name) {
  const href = URL.createObjectURL(blob);
  const link = el("a");
  link.href = href; link.download = name;
  link.tabIndex = -1;
  link.style.display = "none";
  document.body.append(link);
  link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 20000);
}

// Panel DOM is constructed once and moved between stacks without remounting.
const editorHost = el("div", "editor-host");
const editorFoot = el("div", "panel-foot", "JavaScript source is authoritative · Ctrl/⌘ + Enter to run");
const editorRoot = el("div", "panel-root editor-root");
editorRoot.append(editorHost, editorFoot);
panels.editor = editorRoot;

const viewportRoot = el("div", "panel-root viewport-root");
const viewportActions = el("div", "viewer-actions");
const canvasWrap = el("div", "canvas-wrap");
const canvas = el("canvas");
canvas.setAttribute("aria-label", "3D model viewer");
const placeholder = el("div", "viewer-placeholder", "Run a model to generate geometry");
const viewHint = el("div", "view-hint", "Orbit · drag    Pan · right drag    Zoom · scroll");
canvasWrap.append(canvas, placeholder, viewHint);
viewportRoot.append(viewportActions, canvasWrap);
panels.viewer = viewportRoot;

const runnerRoot = el("div", "panel-root runner-root");
const runnerActions = el("div", "runner-actions");
const runnerStats = el("div", "run-stats", "Replicad / OpenCascade WASM · idle");
const runLog = el("pre", "run-log", "No build yet.\nUse Run to evaluate the editor source.");
runLog.setAttribute("aria-live", "polite");
runnerRoot.append(runnerActions, runnerStats, runLog);
panels.runner = runnerRoot;

const formatterRoot = el("div", "panel-root formatter-root");
const formatterInput = el("div", "format-input");
const formatterOutputs = el("div", "format-outputs");
const formatterFoot = el("p", "format-note", "Format adapters convert worker-owned geometry; the viewer consumes the same geometry document as exports.");
formatterRoot.append(formatterInput, formatterOutputs, formatterFoot);
panels.formatter = formatterRoot;

const paramRoot = el("div", "panel-root params-root");
const paramIntro = el("div", "param-intro", "Controls edit the corresponding literals in defaultParams.");
const paramList = el("div", "param-list");
paramList.append(el("p", "empty", "Run a model to discover its parameters."));
paramRoot.append(paramIntro, paramList);
panels.parameters = paramRoot;

const workspace = createWorkspace($("workspace"), panels, stack => {
  const name = stack.active === "parameters" ? "Parametric Controls" :
    stack.active === "runner" ? "Replicad Runner" :
    stack.active[0].toUpperCase() + stack.active.slice(1);
  if (focusText.textContent !== name) focusText.textContent = name;
});

const editorColor = new Compartment();
let editor;
const cmTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "12.5px" },
  ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace" },
  ".cm-content": { minHeight: "100%", padding: "12px 0" },
});
editor = new EditorView({
  state: EditorState.create({
    doc: EXAMPLES[0].source,
    extensions: [
      lineNumbers(), highlightActiveLine(), drawSelection(), history(),
      indentOnInput(), bracketMatching(), javascript(),
      EditorView.contentAttributes.of({ spellcheck: "false", autocapitalize: "off", autocorrect: "off" }),
      editorColor.of(document.documentElement.dataset.theme === "light" ? [] : oneDark),
      keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of(update => { if (update.docChanged) sourceEdited(); }),
      cmTheme,
    ],
  }),
  parent: editorHost,
});
const source = () => editor.state.doc.toString();
function sourceEdited() {
  setDirty(true);
  built = false;
  lastBuildId = -1;
  clearTimeout(autoBuildTimer);
  cancelStaleJobs();
  formatterInfo = null;
  formatStatuses.clear();
  renderFormatter();
  publish("source:changed", source());
}
function replaceSource(value, name, fileHandle = null) {
  clearTimeout(autoBuildTimer);
  editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value }, selection: { anchor: 0 } });
  setFilename(name);
  handle = fileHandle;
  setDirty(false);
  previousSchema = null;
  parameterValues = {};
  fitted = false;
  paramList.replaceChildren(el("p", "empty", "Building model…"));
  runModel();
}
window.addEventListener("testlab:themechange", event => {
  editor.dispatch({ effects: editorColor.reconfigure(event.detail.theme === "light" ? [] : oneDark) });
});

// The runner produces data, never UI: a dedicated Web Worker owns OpenCascade.
let worker = null;
const queue = createJobQueue(job => {
  if (!worker) {
    worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
    worker.addEventListener("message", onWorkerMessage);
    worker.addEventListener("error", onWorkerError);
    worker.addEventListener("messageerror", onWorkerError);
  }
  worker.postMessage(job);
});
function cancelStaleJobs() {
  for (const job of queue.cancelStale()) pendingConversions.delete(job.id);
}
function runModel() {
  clearTimeout(autoBuildTimer);
  built = false;
  const id = ++nextId;
  lastBuildId = id;
  formatterInfo = null;
  formatStatuses.clear();
  renderFormatter();
  setStatus("Building model…");
  runnerStats.textContent = "Computing geometry…";
  runLog.textContent = "Replicad worker is processing the current source.";
  cancelStaleJobs();
  queue.enqueue({ type: "build", id, source: source() });
}
function autoRun() {
  clearTimeout(autoBuildTimer);
  autoBuildTimer = setTimeout(runModel, 260);
}
function requestConversion(target) {
  if (!built || !formatterInfo) {
    setStatus("Build the current model before converting.", "error");
    return;
  }
  if (target === "stl" && formatterInfo.count > 1) {
    setStatus("STL supports one shape. Use STEP for assemblies.", "error");
    return;
  }
  if (!listConversions(formatterInfo.sourceFormat).some(item => item.target === target)) {
    setStatus("No conversion adapter for " + target, "error");
    return;
  }
  if ([...pendingConversions.values()].some(job => job.buildId === lastBuildId && job.target === target)) return;
  const id = ++nextId;
  pendingConversions.set(id, { buildId: lastBuildId, target, filename });
  formatStatuses.set(target, "Converting…");
  renderFormatter();
  if (target !== "viewer/mesh") setStatus("Converting geometry → " + target.toUpperCase() + "…");
  queue.enqueue({ type: "convert", id, buildId: lastBuildId, target });
}
function exportModel(format) {
  requestConversion(format);
}
function onWorkerMessage({ data }) {
  try { handleWorkerMessage(data); }
  finally { queue.complete(data.id); }
}
function handleWorkerMessage(data) {
  if (data.type === "error" && data.operation === "convert") {
    const request = pendingConversions.get(data.id);
    pendingConversions.delete(data.id);
    if (!request) return;
    if (request.buildId !== lastBuildId) {
      if (request.target !== "viewer/mesh") setStatus("Export failed: " + data.message, "error");
      return;
    }
    formatStatuses.set(request.target, "Failed");
    renderFormatter();
    setStatus("Formatter: " + data.message, "error");
    if (request.target === "viewer/mesh") {
      placeholder.hidden = false;
      placeholder.textContent = "Could not generate viewer geometry.";
    }
    return;
  }
  if (data.type === "error") {
    if (data.id !== lastBuildId) return;
    built = false;
    formatterInfo = null;
    renderFormatter();
    setStatus(data.message, "error");
    runLog.textContent = [...(data.logs || []), "ERROR  " + data.message].join("\n");
    runnerStats.textContent = "Build failed";
    placeholder.hidden = false;
    placeholder.textContent = "Model build failed. See runner.";
    return;
  }
  if (data.type === "converted") {
    const request = pendingConversions.get(data.id);
    pendingConversions.delete(data.id);
    if (!request || data.buildId !== request.buildId) return;
    const current = request.buildId === lastBuildId;
    if (request.target === "viewer/mesh" && !current) return;
    try {
      if (request.target === "viewer/mesh") {
        drawGeometry(data.meshes);
        placeholder.hidden = true;
        setStatus("Model ready · " + data.meshes.length +
          (data.meshes.length === 1 ? " shape" : " shapes"), "ok");
        publish("geometry:preview", { count: data.meshes.length });
        formatStatuses.set(request.target, "Displayed");
      } else {
        const exportName = request.filename.replace(/\.js$/i, data.extension);
        download(new Blob([data.bytes], { type: "application/octet-stream" }), exportName);
        if (current) {
          formatStatuses.set(request.target, "Exported");
          setStatus(request.target.toUpperCase() + " exported", "ok");
        }
      }
    } catch (error) {
      if (current) formatStatuses.set(request.target, "Failed");
      setStatus("Formatter: " + error.message, "error");
    }
    if (current) renderFormatter();
    return;
  }
  if (data.type !== "built" || data.id !== lastBuildId) return;
  built = true;
  formatterInfo = data.geometry;
  formatStatuses.clear();
  const newParams = data.defaults;
  const changed = !previousSchema ||
    Object.keys(previousSchema).length !== Object.keys(newParams).length ||
    Object.keys(newParams).some(key => !Object.is(previousSchema[key], newParams[key]));
  parameterValues = { ...newParams };
  if (changed) renderParameters();
  previousSchema = { ...newParams };
  const count = data.geometry.count;
  runnerStats.textContent = count + (count === 1 ? " shape" : " shapes") +
    " · " + data.duration + " ms (incl. initial WASM load)";
  runLog.textContent = [...(data.logs || []), "Geometry document built. Sending to formatter."].join("\n");
  setStatus("Formatting viewer geometry…");
  publish("geometry:built", { count, duration: data.duration });
  requestConversion("viewer/mesh");
}
function onWorkerError(event) {
  worker?.terminate();
  worker = null;
  queue.reset();
  pendingConversions.clear();
  built = false;
  formatterInfo = null;
  formatStatuses.clear();
  renderFormatter();
  setStatus("CAD worker crashed: " + (event.message || "message could not be read") + ". Run to retry.", "error");
  runnerStats.textContent = "Worker error";
}
runnerActions.append(button("▶ Run", runModel, "primary"));
subscribe("status", ({ message, kind }) => {
  if (kind === "error" && !runLog.textContent.includes(message)) runLog.textContent += "\n" + message;
});

// Parameters always write into the visible source; they never become hidden overrides.
function applyParameter(name, next) {
  if (Object.is(parameterValues[name], next)) return true;
  try {
    const edit = editParameter(source(), name, next);
    editor.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert } });
    parameterValues[name] = next;
    if (previousSchema) previousSchema[name] = next;
    autoRun();
    return true;
  } catch (error) {
    setStatus(error.message, "error");
    return false;
  }
}
function parameterRow(name, value) {
  const row = el("div", "parameter-row");
  const label = el("label", "parameter-label", name.replace(/([A-Z])/g, " $1"));
  label.title = name;
  row.append(label);
  if (typeof value === "number") {
    const slider = el("input", "param-slider");
    slider.type = "range";
    const span = Math.max(10, Math.abs(value) * 2);
    slider.min = String(value >= 0 ? 0 : Math.floor(value - span));
    slider.max = String(Math.max(10, Math.ceil(value + span)));
    slider.step = Number.isInteger(value) ? "1" : "0.1";
    slider.value = String(value);
    slider.setAttribute("aria-label", name);
    const numeric = el("input", "param-value");
    numeric.type = "number"; numeric.step = "any"; numeric.value = String(value);
    numeric.setAttribute("aria-label", name + " value");
    slider.addEventListener("input", () => {
      const previous = parameterValues[name];
      numeric.value = slider.value;
      if (!applyParameter(name, Number(slider.value))) {
        numeric.value = String(previous); slider.value = String(previous);
      }
    });
    numeric.addEventListener("change", () => {
      const next = Number(numeric.value);
      const previous = parameterValues[name];
      if (!Number.isFinite(next) || !applyParameter(name, next)) numeric.value = String(previous);
      else {
        slider.min = String(Math.min(Number(slider.min), next));
        slider.max = String(Math.max(Number(slider.max), next));
        slider.value = String(next);
      }
    });
    row.append(slider, numeric);
  } else if (typeof value === "boolean") {
    const input = el("input", "param-check");
    input.type = "checkbox"; input.checked = value;
    input.setAttribute("aria-label", name);
    input.addEventListener("change", () => {
      if (!applyParameter(name, input.checked)) input.checked = parameterValues[name];
    });
    row.append(input);
  } else {
    const input = el("input", "param-text");
    input.type = "text"; input.value = value;
    input.setAttribute("aria-label", name);
    input.addEventListener("change", () => {
      if (!applyParameter(name, input.value)) input.value = parameterValues[name];
    });
    row.append(input);
  }
  return row;
}
function renderParameters() {
  paramList.replaceChildren();
  const entries = Object.entries(parameterValues);
  if (!entries.length) { paramList.append(el("p", "empty", "No defaultParams found in this model.")); return; }
  for (const [key, value] of entries) paramList.append(parameterRow(key, value));
}

// Formatter is a processor with typed source → target geometry adapters.
// The panel visualises the conversion graph and triggers export commands.
// Mount the formatter controls once: status updates must not destroy the
// focused button, scroll position, or accessibility tree during an export.
const formatName = el("div", "format-input-name", SOURCE_FORMAT);
const formatDetail = el("div", "format-input-detail");
formatterInput.append(el("div", "format-kicker", "INPUT"), formatName, formatDetail);
formatterOutputs.append(el("div", "format-kicker", "OUTPUT ADAPTERS"));
const formatRows = new Map();
for (const adapter of listConversions()) {
  const row = el("div", "format-row");
  const text = el("div", "format-row-text");
  text.append(
    el("div", "format-title", adapter.label),
    el("div", "format-description", adapter.representation + " · " + adapter.fidelity),
    el("div", "format-description", adapter.description),
  );
  const actions = el("div", "format-row-actions");
  const state = el("span", "format-state");
  const action = button(adapter.automatic ? "Refresh" : "Export ↓", () => {
    if (action.getAttribute("aria-disabled") !== "true") requestConversion(adapter.target);
  });
  action.title = adapter.description;
  action.dataset.target = adapter.target;
  actions.append(state, action);
  row.append(text, actions);
  formatterOutputs.append(row);
  formatRows.set(adapter.target, { row, state, action, adapter });
}
function renderFormatter() {
  formatName.textContent = formatterInfo?.sourceFormat || SOURCE_FORMAT;
  formatDetail.textContent = formatterInfo
    ? formatterInfo.count + (formatterInfo.count === 1 ? " shape" : " shapes") + " · " + formatterInfo.units
    : "Run a model to produce geometry";
  const available = new Set(listConversions(formatterInfo?.sourceFormat || SOURCE_FORMAT).map(a => a.target));
  for (const [target, { row, state, action, adapter }] of formatRows) {
    row.hidden = !available.has(target);
    const converting = formatStatuses.get(target) === "Converting…";
    state.textContent = formatStatuses.get(target) || (adapter.automatic ? "Automatic" : "Ready");
    const unsupportedAssembly = target === "stl" && formatterInfo?.count > 1;
    const disabled = !built || !formatterInfo || converting || unsupportedAssembly;
    // Keep the active button focusable even while it is busy. Guard the
    // command itself as well; aria-disabled alone is not an event guard.
    action.setAttribute("aria-disabled", String(disabled));
    action.title = unsupportedAssembly ? "STL supports one shape. Use STEP for assemblies." : adapter.description;
  }
}
renderFormatter();

// Three.js holds the scene/camera independently from the dock layout.
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20000);
camera.up.set(0, 0, 1);
camera.position.set(120, -130, 100);
const orbit = new OrbitControls(camera, canvas);
orbit.enableDamping = true; orbit.dampingFactor = 0.09;
scene.add(new THREE.AmbientLight(0xffffff, 2.1));
const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(80, -100, 130);
scene.add(light);
const grid = new THREE.GridHelper(400, 40, 0x617281, 0x3b444d);
grid.rotation.x = Math.PI / 2;
scene.add(grid);
const geometryGroup = new THREE.Group();
scene.add(geometryGroup);
function fitModel() {
  const bounds = new THREE.Box3().setFromObject(geometryGroup);
  if (bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const diameter = Math.max(size.x, size.y, size.z, 1);
  orbit.target.copy(center);
  camera.position.copy(center).add(new THREE.Vector3(1.2, -1.5, 1.15).normalize().multiplyScalar(diameter * 2.6));
  camera.near = Math.max(0.01, diameter / 500);
  camera.far = Math.max(2000, diameter * 80);
  camera.updateProjectionMatrix();
  orbit.update();
  fitted = true;
  requestFrame();
}
function drawGeometry(meshes) {
  for (const child of [...geometryGroup.children]) {
    child.geometry?.dispose(); child.material?.dispose();
    geometryGroup.remove(child);
  }
  for (const mesh of meshes) {
    const faces = new THREE.BufferGeometry();
    syncFaces(faces, mesh.faces);
    faces.computeBoundingSphere();
    geometryGroup.add(new THREE.Mesh(faces, new THREE.MeshStandardMaterial({
      color: 0x95adc0, metalness: 0.08, roughness: 0.71, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
    })));
    if (mesh.edges) {
      const edges = new THREE.BufferGeometry();
      syncLines(edges, mesh.edges);
      geometryGroup.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x34475a })));
    }
  }
  if (!fitted) fitModel();
  requestFrame();
}
let showGrid = true;
const gridButton = button("Grid: on", () => {
  showGrid = !showGrid; grid.visible = showGrid;
  gridButton.textContent = "Grid: " + (showGrid ? "on" : "off");
  requestFrame();
});
viewportActions.append(button("Fit", fitModel), gridButton);
// Render on demand, including damping frames reported by OrbitControls.
let frame = 0;
let renderedWidth = 0, renderedHeight = 0;
function requestFrame() {
  if (!frame && !document.hidden) frame = requestAnimationFrame(renderFrame);
}
function renderFrame() {
  frame = 0;
  if (!canvas.isConnected || document.querySelector("dialog[open]")) return;
  if (canvas.closest("[inert]")) return;
  const width = canvasWrap.clientWidth, height = canvasWrap.clientHeight;
  if (width < 2 || height < 2) return;
  if (width !== renderedWidth || height !== renderedHeight) {
    renderedWidth = width; renderedHeight = height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  orbit.update();
  renderer.render(scene, camera);
}
const resize = new ResizeObserver(requestFrame);
resize.observe(canvasWrap);
orbit.addEventListener("change", requestFrame);
document.addEventListener("visibilitychange", requestFrame);
document.addEventListener("workspace:presentation", requestFrame);
requestFrame();

// Files are opened and saved locally, without browser-owned model storage.
async function saveModel(forceAs = false) {
  try {
    const blob = new Blob([source()], { type: "text/javascript" });
    if (handle && !forceAs) {
      const writable = await handle.createWritable();
      await writable.write(blob); await writable.close();
    } else if ("showSaveFilePicker" in window) {
      const next = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }],
      });
      const writable = await next.createWritable();
      await writable.write(blob); await writable.close();
      handle = next; setFilename(next.name);
    } else {
      download(blob, filename);
      handle = null;
    }
    setDirty(false); setStatus("Source saved", "ok");
  } catch (error) {
    if (error.name !== "AbortError") setStatus("Save failed: " + error.message, "error");
  }
}
async function openModel() {
  if (dirty && !confirm("Discard unsaved changes?")) return;
  try {
    if ("showOpenFilePicker" in window) {
      const handles = await window.showOpenFilePicker({
        multiple: false, types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }],
      });
      const file = await handles[0].getFile();
      replaceSource(await file.text(), file.name, handles[0]);
    } else $("openInput").click();
  } catch (error) {
    if (error.name !== "AbortError") setStatus("Open failed: " + error.message, "error");
  }
}
$("openInput").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (file) replaceSource(await file.text(), file.name);
  event.target.value = "";
});
function loadExample(index) {
  if (dirty && !confirm("Discard unsaved changes?")) return;
  const example = EXAMPLES[index];
  replaceSource(example.source, example.filename);
}

// Searchable command palette handles global actions without a bulky toolbar.
const commands = [
  ["Run model", runModel],
  ["Open model…", openModel],
  ["Save model", () => saveModel()],
  ["Save as…", () => saveModel(true)],
  ...EXAMPLES.map((example, index) => ["Demo: " + example.name, () => loadExample(index)]),
  ["Refresh viewer geometry", () => requestConversion("viewer/mesh")],
  ["Fit geometry to view", fitModel],
  ["Export STEP", () => exportModel("step")],
  ["Export STL", () => exportModel("stl")],
  ["Reset panel layout", workspace.reset],
  ...workspace.listPanels().map(id => ["Focus " + id, () => workspace.activate(id)]),
];
const palette = $("commandPalette");
const commandSearch = $("commandSearch");
const commandResults = $("commandResults");
let selectedCommand = 0;
let filteredCommands = commands;
function renderCommands() {
  const q = commandSearch.value.trim().toLowerCase();
  filteredCommands = commands.filter(([name]) => name.toLowerCase().includes(q));
  selectedCommand = 0;
  commandResults.replaceChildren();
  if (!filteredCommands.length) commandResults.append(el("div", "empty", "No matching commands."));
  filteredCommands.forEach(([name, run], index) => {
    const row = button(name, () => executeCommand(run), "command-row");
    if (index === 0) row.classList.add("selected");
    commandResults.append(row);
  });
}
function openPalette() {
  if (palette.open) { commandSearch.focus({ preventScroll: true }); return; }
  commandSearch.value = "";
  renderCommands();
  palette.showModal();
  commandSearch.focus({ preventScroll: true });
}
function executeCommand(action) {
  palette.close();
  action();
}
palette.addEventListener("close", requestFrame);
$("commandButton").addEventListener("click", openPalette);
$("closePalette").addEventListener("click", () => palette.close());
commandSearch.addEventListener("input", renderCommands);
commandSearch.addEventListener("keydown", event => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    selectedCommand = (selectedCommand + (event.key === "ArrowDown" ? 1 : -1) + filteredCommands.length) %
      Math.max(1, filteredCommands.length);
    [...commandResults.children].forEach((node, i) => node.classList.toggle("selected", i === selectedCommand));
    commandResults.children[selectedCommand]?.scrollIntoView({ block: "nearest" });
  } else if (event.key === "Enter" && filteredCommands[selectedCommand]) {
    event.preventDefault();
    const action = filteredCommands[selectedCommand][1];
    executeCommand(action);
  }
});
palette.addEventListener("click", event => { if (event.target === palette) palette.close(); });
document.addEventListener("keydown", event => {
  if (event.isComposing || event.defaultPrevented) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    if (event.repeat) { event.preventDefault(); return; }
    event.preventDefault();
    if (palette.open) palette.close(); else openPalette();
  } else if (palette.open) {
    return;
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault(); saveModel();
  } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault(); runModel();
  }
});
window.addEventListener("beforeunload", event => { if (dirty) event.preventDefault(); });
setFilename(filename);
setDirty(false);
setStatus("Ready to run");
