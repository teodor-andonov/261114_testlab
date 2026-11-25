import {
  PANEL_IDS, defaultLayout, isValidLayout, findStack, stackContaining,
  movePanel, allStacks,
} from "./layout-core.js";
import { zoneAt, gapInsertion } from "./dock-target.js";

const LABELS = {
  editor: "Editor", viewer: "Viewer", runner: "Replicad Runner",
  formatter: "Formatter", parameters: "Parametric Controls",
};
const STORAGE_KEY = "testlab:modular-studio:layout-v1";
const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};
const editable = target => target?.closest?.("input, textarea, select, [contenteditable='true'], .cm-editor");

export function createWorkspace(host, panels, onFocus = () => {}) {
  let layout;
  try { const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); layout = isValidLayout(saved) ? saved : defaultLayout(); }
  catch { layout = defaultLayout(); }
  let focusedId = stackContaining(layout, "editor")?.id || allStacks(layout)[0].id;
  let maximizedId = null;
  let draggingPanel = null;
  let highlighted = null;

  function clearHighlight() {
    if (!highlighted) return;
    highlighted.classList.remove("drop-target");
    highlighted.removeAttribute("data-drop-zone");
    highlighted = null;
  }
  function highlight(node, zone) {
    if (highlighted === node && node.dataset.dropZone === zone) return;
    if (highlighted !== node) clearHighlight();
    highlighted = node;
    node.classList.add("drop-target");
    node.dataset.dropZone = zone;
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch {}
  }
  function focus(id) {
    if (!findStack(layout, id)) return;
    focusedId = id;
    host.querySelectorAll(".dock-stack").forEach(node => {
      node.classList.toggle("focused", node.dataset.stack === focusedId);
    });
    onFocus(findStack(layout, focusedId));
  }
  function renderNode(node) {
    if (node.kind === "split") {
      const wrap = el("div", "dock-split " + (node.axis === "x" ? "horizontal" : "vertical"));
      const a = renderNode(node.a);
      const b = renderNode(node.b);
      a.style.flex = "0 0 calc(" + (node.ratio * 100) + "% - 3px)";
      b.style.flex = "1 1 0%";
      const grip = el("div", "split-grip");
      grip.setAttribute("role", "separator");
      grip.setAttribute("aria-orientation", node.axis === "x" ? "vertical" : "horizontal");
      grip.setAttribute("title", "Drag to resize, or drop a panel to insert in this gap");
      grip.addEventListener("dragover", event => {
        if (!draggingPanel) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        highlight(grip, "gap");
      });
      grip.addEventListener("drop", event => {
        if (!draggingPanel) return;
        event.preventDefault();
        event.stopPropagation();
        const moved = draggingPanel;
        const { targetId, zone } = gapInsertion(node, moved);
        draggingPanel = null;
        clearHighlight();
        document.body.classList.remove("dragging-panel");
        dock(moved, targetId, zone);
      });
      grip.addEventListener("pointerdown", event => {
        event.preventDefault();
        grip.setPointerCapture(event.pointerId);
        const box = wrap.getBoundingClientRect();
        const update = e => {
          const raw = node.axis === "x" ? (e.clientX - box.left) / box.width : (e.clientY - box.top) / box.height;
          node.ratio = Math.max(0.12, Math.min(0.88, raw));
          a.style.flexBasis = "calc(" + (node.ratio * 100) + "% - 3px)";
        };
        const stop = () => {
          grip.removeEventListener("pointermove", update);
          grip.removeEventListener("pointerup", stop);
          grip.removeEventListener("pointercancel", stop);
          persist();
        };
        grip.addEventListener("pointermove", update);
        grip.addEventListener("pointerup", stop);
        grip.addEventListener("pointercancel", stop);
      });
      wrap.append(a, grip, b);
      return wrap;
    }
    const root = el("section", "dock-stack");
    root.dataset.stack = node.id;
    root.setAttribute("aria-label", "Panel box");
    root.addEventListener("pointerdown", () => focus(node.id));
    root.addEventListener("focusin", () => focus(node.id));
    const header = el("div", "dock-head");
    header.tabIndex = -1;
    const tabs = el("div", "dock-tabs");
    tabs.setAttribute("role", "tablist");
    for (const panel of node.tabs) {
      const button = el("button", "dock-tab" + (node.active === panel ? " active" : ""), LABELS[panel]);
      button.type = "button";
      button.draggable = true;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", String(node.active === panel));
      button.title = "Drag to dock; click to select";
      button.addEventListener("click", () => {
        updateTab(node.id, panel);
        button.focus({ preventScroll: true });
      });
      button.addEventListener("dragstart", event => {
        draggingPanel = panel;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", panel);
        document.body.classList.add("dragging-panel");
      });
      button.addEventListener("dragend", () => {
        draggingPanel = null;
        clearHighlight();
        document.body.classList.remove("dragging-panel");
      });
      tabs.append(button);
    }
    const expand = el("button", "expand-btn", maximizedId === node.id ? "↙" : "⛶");
    expand.type = "button";
    expand.title = "Maximise / restore box (Space)";
    expand.setAttribute("aria-label", "Maximise or restore this box");
    expand.addEventListener("click", () => { focus(node.id); toggleMaximize(); });
    header.addEventListener("dblclick", event => {
      if (event.target.closest("button")) return;
      focus(node.id); toggleMaximize();
    });
    header.append(tabs, expand);

    const content = el("div", "dock-content");
    content.append(panels[node.active]);
    const accept = event => {
      if (!draggingPanel) return null;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      const zone = zoneAt(root.getBoundingClientRect(), event.clientX, event.clientY);
      highlight(root, zone);
      return zone;
    };
    root.addEventListener("dragover", accept, true);
    root.addEventListener("drop", event => {
      if (!draggingPanel) return;
      const zone = accept(event);
      const moved = draggingPanel;
      draggingPanel = null;
      clearHighlight();
      document.body.classList.remove("dragging-panel");
      dock(moved, node.id, zone);
    }, true);
    root.append(header, content);
    return root;
  }
  function render() {
    clearHighlight();
    if (maximizedId && !findStack(layout, maximizedId)) maximizedId = null;
    if (!findStack(layout, focusedId)) focusedId = allStacks(layout)[0].id;
    host.replaceChildren(renderNode(layout));
    syncPresentation();
    focus(maximizedId || focusedId);
  }
  function dock(panel, stackId, zone) {
    const before = layout;
    layout = movePanel(layout, panel, stackId, zone);
    if (before !== layout) {
      focusedId = stackContaining(layout, panel)?.id || focusedId;
      if (maximizedId) maximizedId = null;
      persist(); render();
    }
  }
  function syncPresentation() {
    host.classList.toggle("is-maximized", Boolean(maximizedId));
    for (const root of host.querySelectorAll(".dock-stack")) {
      const isMax = maximizedId === root.dataset.stack;
      root.classList.toggle("maximized", isMax);
      root.inert = Boolean(maximizedId && !isMax);
      root.querySelector(".expand-btn").textContent = isMax ? "↙" : "⛶";
    }
    document.dispatchEvent(new Event("workspace:presentation"));
  }
  function updateTab(id, panel) {
    const stack = findStack(layout, id);
    if (!stack || !stack.tabs.includes(panel)) return;
    if (stack.active !== panel) {
      stack.active = panel;
      const root = [...host.querySelectorAll(".dock-stack")].find(n => n.dataset.stack === id);
      if (root) {
        root.querySelector(".dock-content").replaceChildren(panels[panel]);
        [...root.querySelectorAll(".dock-tab")].forEach((tab, i) => {
          const active = stack.tabs[i] === panel;
          tab.classList.toggle("active", active);
          tab.setAttribute("aria-selected", String(active));
        });
      }
      persist();
      document.dispatchEvent(new Event("workspace:presentation"));
    }
    focus(id);
  }
  function toggleMaximize() {
    maximizedId = maximizedId === focusedId ? null : focusedId;
    syncPresentation();
  }
  function activate(panel) {
    const target = stackContaining(layout, panel);
    if (!target) return;
    if (maximizedId && maximizedId !== target.id) {
      maximizedId = null;
      syncPresentation();
    }
    updateTab(target.id, panel);
  }
  function reset() {
    layout = defaultLayout();
    focusedId = "s1"; maximizedId = null;
    persist(); render();
  }
  document.addEventListener("keydown", event => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey) return;
    if (document.querySelector("dialog[open]") || editable(event.target) || event.isComposing) return;
    if (event.key === "Tab" && (!event.target.closest?.("button, a") || event.target.closest?.(".dock-tab"))) {
      const stack = findStack(layout, focusedId);
      if (stack && stack.tabs.length > 1) {
        event.preventDefault();
        const next = (stack.tabs.indexOf(stack.active) + (event.shiftKey ? -1 : 1) + stack.tabs.length) % stack.tabs.length;
        updateTab(focusedId, stack.tabs[next]);
        host.querySelector(".dock-stack.focused .dock-tab.active")?.focus({ preventScroll: true });
      }
    } else if (event.code === "Space" && !event.repeat &&
               (!event.target.closest?.("button, a") || event.target.closest?.(".dock-tab"))) {
      event.preventDefault();
      toggleMaximize();
    } else if (event.key === "Escape" && maximizedId) {
      event.preventDefault();
      maximizedId = null; syncPresentation();
    }
  });
  host.addEventListener("dragleave", event => {
    if (!host.contains(event.relatedTarget)) clearHighlight();
  });
  render();
  return {
    reset, activate, dock, toggleMaximize,
    get focusedPanel() { return findStack(layout, focusedId)?.active; },
    get layout() { return structuredClone(layout); },
    get maximizeId() { return maximizedId; },
    listPanels: () => [...PANEL_IDS],
  };
}
