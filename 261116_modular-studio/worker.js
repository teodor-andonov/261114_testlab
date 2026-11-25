import initOpenCascade from "replicad-opencascadejs";
import wasmURL from "replicad-opencascadejs/wasm?url";
import * as replicad from "replicad";
import {
  makeGeometryDocument, convertGeometry, listConversions, SOURCE_FORMAT,
} from "./geometry-formats.js";

let initialization;
let geometryDocument = null;
function releaseGeometry() {
  const shapes = new Set(geometryDocument?.items.map(item => item.shape) || []);
  geometryDocument = null;
  for (const shape of shapes) {
    try { shape.delete?.(); } catch { /* Already disposed by user script. */ }
  }
}
const init = () => (initialization ||= initOpenCascade({ locateFile: () => wasmURL })
  .then(oc => { replicad.setOC(oc); return oc; }));

function compile(source, logs) {
  const capturedConsole = {
    log: (...parts) => logs.push(parts.map(String).join(" ")),
    info: (...parts) => logs.push(parts.map(String).join(" ")),
    warn: (...parts) => logs.push("Warning: " + parts.map(String).join(" ")),
    error: (...parts) => logs.push("Error: " + parts.map(String).join(" ")),
  };
  // Only execute trusted source. A Worker doesn't block network access.
  const evaluate = new Function("replicad", "console",
    source + "\nreturn { main: typeof main !== 'undefined' ? main : null, defaults: typeof defaultParams !== 'undefined' ? defaultParams : {} };");
  const { main, defaults } = evaluate(replicad, capturedConsole);
  if (typeof main !== "function") throw Error("Define main(replicad, params).");
  if (!defaults || Array.isArray(defaults) || typeof defaults !== "object") throw Error("defaultParams must be an object.");
  for (const [key, value] of Object.entries(defaults)) {
    if (!["number", "boolean", "string"].includes(typeof value) ||
        (typeof value === "number" && !Number.isFinite(value))) {
      throw Error("Unsupported defaultParams value: " + key);
    }
  }
  return { main, defaults: structuredClone(defaults) };
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  const start = performance.now();
  const logs = [];
  try {
    await init();
    if (type === "build") {
      releaseGeometry();
      const { main, defaults } = compile(data.source, logs);
      const outputs = await main(replicad, defaults);
      const list = Array.isArray(outputs) ? outputs : [outputs];
      if (!list.length) throw Error("Model returned no shapes.");
      const shapes = list.map((entry, index) => {
        const shape = entry?.shape || entry;
        if (!shape || typeof shape.mesh !== "function" || typeof shape.blobSTEP !== "function") {
          throw Error("Item " + (index + 1) + " is not a Replicad shape.");
        }
        return { shape, name: entry?.name || "Shape " + (index + 1) };
      });
      geometryDocument = makeGeometryDocument(shapes, id);
      self.postMessage({
        id, type: "built", defaults, logs,
        geometry: {
          sourceFormat: SOURCE_FORMAT,
          units: geometryDocument.units,
          count: geometryDocument.items.length,
          names: geometryDocument.items.map(item => item.name),
          outputs: listConversions(SOURCE_FORMAT),
        },
        duration: Math.round(performance.now() - start),
      });
      return;
    }
    if (type === "convert") {
      if (!geometryDocument || geometryDocument.revision !== data.buildId) {
        throw Error("Geometry changed; rebuild before converting.");
      }
      const result = await convertGeometry(geometryDocument, data.target, { replicad });
      if (result.kind === "preview") {
        self.postMessage({
          id, buildId: data.buildId, type: "converted", target: data.target,
          meshes: result.value, duration: Math.round(performance.now() - start),
        });
      } else {
        self.postMessage({
          id, buildId: data.buildId, type: "converted", target: data.target,
          bytes: result.bytes, extension: result.extension,
          duration: Math.round(performance.now() - start),
        }, [result.bytes]);
      }
      return;
    }
    throw Error("Unknown worker command: " + type);
  } catch (error) {
    self.postMessage({ id, type: "error", operation: type, target: data.target || null, message: error?.message || String(error), logs });
  }
};
