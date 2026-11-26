const list = document.getElementById('prototypeList');
const count = document.getElementById('projectCount');
const search = document.getElementById('filterInput');
const empty = document.getElementById('emptyNotice');
let projects = [];
const VIEW_KEY = 'testlab-gallery-view';
const views = ['cards','small','icons','list','table'];
let view = 'cards';
try { const stored = localStorage.getItem(VIEW_KEY); if (views.includes(stored)) view = stored; } catch {}
const viewControls = document.getElementById('viewControls');
function setView(next) {
  if (!views.includes(next)) return;
  view = next;
  try { localStorage.setItem(VIEW_KEY, view); } catch {}
  render();
}
viewControls.addEventListener('click', event => { const button = event.target.closest('button[data-view]'); if (button) setView(button.dataset.view); });
const PIN_KEY = 'testlab-pinned-prototypes';
let pinned = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
  if (Array.isArray(stored)) pinned = new Set(stored.filter(value => typeof value === 'string'));
} catch {}
function togglePin(folder) {
  if (pinned.has(folder)) pinned.delete(folder); else pinned.add(folder);
  try { localStorage.setItem(PIN_KEY, JSON.stringify([...pinned])); } catch {}
  render();
  [...list.querySelectorAll('.pin-button')].find(button => button.dataset.folder === folder)?.focus({preventScroll:true});
}
window.addEventListener('storage', event => {
  if (event.key === VIEW_KEY) { view = views.includes(event.newValue) ? event.newValue : 'cards'; render(); return; }
  if (event.key !== PIN_KEY) return;
  try {
    const stored = JSON.parse(event.newValue || '[]');
    pinned = new Set(Array.isArray(stored) ? stored.filter(value => typeof value === 'string') : []);
    render();
  } catch {}
});
const dateLabel = input => {
  const match = /^(\d{2})(\d{2})(\d{2})$/.exec(String(input));
  if (!match) return String(input);
  return `${match[3]}.${match[2]}.20${match[1]}`;
};
const timestampLabel = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(date);
};
function iconElement(project) {
  const span = document.createElement('span');
  span.className = 'app-icon';
  span.setAttribute('aria-hidden','true');
  const name = /^[a-z0-9-]+$/.test(project.icon || '') ? project.icon : 'box';
  span.style.setProperty('--icon', "url('./icons/lucide/" + name + ".svg')");
  return span;
}
function projectHref(project) {
  return './' + encodeURIComponent(project.folder) + '/' + (project.commit ? '?v=' + encodeURIComponent(project.commit.slice(0,7)) : '');
}
function projectCard(project) {
  const card = document.createElement('a');
  card.className = 'project-card';
  card.href = projectHref(project);
  const header = document.createElement('div');
  header.className = 'card-head';
  const number = document.createElement('span');
  number.className = 'card-number';
  number.textContent = dateLabel(project.date);
  const status = document.createElement('span');
  status.className = 'status';
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  status.append(dot, document.createTextNode((project.status || 'Prototype').toUpperCase()));
  header.append(number, status);
  const symbol = document.createElement('div');
  symbol.className = 'card-symbol'; symbol.setAttribute('aria-hidden', 'true');
  symbol.append(iconElement(project));
  const bottom = document.createElement('div');
  bottom.className = 'card-bottom';
  const category = document.createElement('div');
  category.className = 'card-category';
  category.textContent = [project.category, ...(project.tags || []).slice(0, 1)].filter(Boolean).join(' · ');
  const titleRow = document.createElement('div');
  titleRow.className = 'card-title-row';
  const title = document.createElement('h3'); title.textContent = project.title;
  titleRow.append(title);
  const summary = document.createElement('p'); summary.textContent = project.description || '';
  const facts = document.createElement('dl');
  facts.className = 'card-facts';
  for (const [label, value] of [
    ['Created', timestampLabel(project.createdAt)],
    ['Updated', timestampLabel(project.updatedAt)],
    ['Version', project.version ? 'v' + project.version : '—']
  ]) {
    const item = document.createElement('div');
    const term = document.createElement('dt'); term.textContent = label;
    const detail = document.createElement('dd'); detail.textContent = value;
    if (label !== 'Version') detail.title = project[label === 'Created' ? 'createdAt' : 'updatedAt'] || 'Not available';
    item.append(term, detail);
    facts.append(item);
  }
  bottom.append(category, titleRow, summary, facts);
  card.append(header, symbol, bottom);
  const tile = document.createElement('div');
  tile.className = 'project-tile';
  tile.append(card, pinButton(project));
  return tile;
}
function projectIcon(project) {
  const tile = document.createElement('div');
  tile.className = 'project-tile';
  const card = document.createElement('a');
  card.className = 'project-card icon-card';
  card.href = projectHref(project);
  card.title = project.title;
  card.setAttribute('aria-label', project.title);
  const words = project.title.match(/[\p{L}\p{N}]+/gu) || ['?'];
  const initials = document.createElement('span');
  initials.className = 'icon-initials';
  initials.setAttribute('aria-hidden', 'true');
  initials.textContent = (words.length === 1 ? words[0].slice(0,2) : words.slice(0,3).map(word => word[0]).join('')).toUpperCase();
  card.append(iconElement(project), initials);
  tile.append(card, pinButton(project));
  return tile;
}
function pinButton(project) {
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'pin-button';
  pin.dataset.folder = project.folder;
  const isPinned = pinned.has(project.folder);
  pin.setAttribute('aria-pressed', String(isPinned));
  pin.setAttribute('aria-label', (isPinned ? 'Unpin ' : 'Pin ') + project.title);
  pin.title = isPinned ? 'Unpin prototype' : 'Pin prototype';
  pin.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5-3 1-4 4v4l-2 2-7-7 2-2h4l4-4 1-3Z"/><path d="m8.5 15.5-5 5"/></svg>';
  pin.addEventListener('click', () => togglePin(project.folder));
  return pin;
}
function projectTable(items) {
  const table = document.createElement('table');
  table.className = 'prototype-table';
  const head = table.createTHead().insertRow();
  for (const label of ['App','Category','Created','Updated','Version','Status','Pin']) {
    const th = document.createElement('th'); th.scope = 'col'; th.textContent = label; head.append(th);
  }
  const body = table.createTBody();
  for (const project of items) {
    const row = body.insertRow();
    const titleCell = row.insertCell();
    const link = document.createElement('a'); link.href = projectHref(project);
    link.className = 'table-app'; link.append(iconElement(project), document.createTextNode(project.title));
    titleCell.append(link);
    for (const value of [project.category, timestampLabel(project.createdAt), timestampLabel(project.updatedAt), project.version ? 'v'+project.version : '—', project.status]) {
      row.insertCell().textContent = value || '—';
    }
    row.insertCell().append(pinButton(project));
  }
  return table;
}
function render() {
  const needle = search.value.trim().toLocaleLowerCase();
  const displayed = projects.filter(project => [project.title, project.description, project.folder, project.category, project.status, ...(project.tags || [])].some(value => String(value || '').toLocaleLowerCase().includes(needle)));
  displayed.sort((a,b) => Number(pinned.has(b.folder)) - Number(pinned.has(a.folder))
    || String(b.date).localeCompare(String(a.date))
    || String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    || a.folder.localeCompare(b.folder));
  list.dataset.view = view;
  for (const button of viewControls.querySelectorAll('button[data-view]')) button.setAttribute('aria-pressed', String(button.dataset.view === view));
  list.replaceChildren(...(view === 'table' && displayed.length ? [projectTable(displayed)] : displayed.map(view === 'icons' ? projectIcon : projectCard)));
  count.textContent = String(projects.length).padStart(2, '0');
  empty.hidden = displayed.length !== 0;
}
search.addEventListener('input', render);
fetch('./catalog.json', { cache: 'no-cache' })
  .then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.json(); })
  .then(data => { projects = Array.isArray(data.projects) ? data.projects : []; render(); })
  .catch(() => {
    // Keep the static first-prototype link usable if the generated catalog is unavailable.
    count.textContent = '01';
    empty.hidden = true;
    search.disabled = true;
    search.placeholder = 'Search unavailable in source preview';
  });

// Install the root gallery as its own PWA; each dated prototype remains independent.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => {
      console.warn('Testlab offline shell could not be registered:', error);
    });
  });
}

const installButton = document.getElementById('installButton');
let pendingInstall = null;
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  pendingInstall = event;
  installButton.hidden = false;
});
installButton.addEventListener('click', async () => {
  if (!pendingInstall) return;
  const install = pendingInstall;
  pendingInstall = null;
  installButton.hidden = true;
  await install.prompt();
});
window.addEventListener('appinstalled', () => {
  pendingInstall = null;
  installButton.hidden = true;
});
