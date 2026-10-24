// Catalog (left) and inspector (right) panels. Plain DOM, no framework.
import { CATALOG, CATEGORIES, sizeLabel } from './catalog.js';
import { FLOORS } from './textures.js';
import { WALL_NAMES } from './room.js';

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, children = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') e.className = v;
    else e.setAttribute(k, v);
  }
  for (const c of children) e.append(c);
  return e;
}

function field(label, input) {
  return el('div', { class: 'field' }, [el('label', {}, [label]), input]);
}

function num(value, opts, onChange) {
  const i = el('input', { type: 'number', step: opts.step ?? 0.05, min: opts.min, max: opts.max });
  i.value = String(+value.toFixed(3));
  i.addEventListener('change', () => {
    const v = parseFloat(i.value);
    if (Number.isFinite(v)) onChange(v);
  });
  return i;
}

function color(value, onInput, onChange) {
  const i = el('input', { type: 'color' });
  i.value = value;
  i.addEventListener('input', () => onInput?.(i.value));
  i.addEventListener('change', () => onChange?.(i.value));
  return i;
}

function select(options, value, onChange) {
  const s = el('select');
  for (const [k, label] of options) {
    const o = el('option', { value: k }, [label]);
    if (k === value) o.selected = true;
    s.append(o);
  }
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function fmtHour(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function createUI(h) {
  // ---- catalog -----------------------------------------------------------
  const catalog = $('#catalog');
  for (const cat of CATEGORIES) {
    catalog.append(el('h3', {}, [cat]));
    const grid = el('div', { class: 'cat-grid' });
    for (const def of CATALOG.filter((d) => d.cat === cat)) {
      const b = el('button', { class: 'cat-item', title: `Add ${def.name} (${def.size} cm)` }, [def.name, el('small', {}, [def.size])]);
      b.addEventListener('click', () => h.onSpawn(def));
      grid.append(b);
    }
    catalog.append(grid);
  }

  // ---- inspector ---------------------------------------------------------
  const insp = $('#inspector');
  const selSec = el('div');
  const wallSec = el('div');
  const roomSec = el('div');
  const lightSec = el('div');
  const helpSec = el('div');
  insp.append(selSec, wallSec, roomSec, lightSec, helpSec);

  function showItem(item, def) {
    selSec.replaceChildren(el('h3', {}, ['Selected']));
    if (!item) {
      selSec.append(el('div', { class: 'empty' }, ['Nothing selected. Click an item to select it, drag it to move. Add more from the left.']));
      return;
    }
    selSec.append(el('div', {}, [el('strong', {}, [def.name]), ` · ${sizeLabel(def)}`]));
    if (!def.fixedSize) {
      // Sizes are shown in cm; the item is rebuilt with the new dimensions.
      const cm = (key) => num(def[key] * 100, { step: 5, min: 10 }, (v) => h.onItemChange({ [key]: v / 100 }));
      selSec.append(field('Width cm', cm('w')), field('Depth cm', cm('d')), field('Height cm', cm('h')));
      if (item.w != null || item.d != null || item.h != null) {
        const reset = el('button', { class: 'small' });
        reset.textContent = 'Reset to catalog size';
        reset.addEventListener('click', () => h.onItemChange({ w: null, d: null, h: null }));
        selSec.append(el('div', { class: 'row' }, [reset]));
      }
    }
    selSec.append(field('Position x', num(item.x, { step: 0.05 }, (v) => h.onItemChange({ x: v }))));
    selSec.append(field('Position z', num(item.z, { step: 0.05 }, (v) => h.onItemChange({ z: v }))));
    selSec.append(field('Rotation °', num(item.rot || 0, { step: 15, min: -180, max: 180 }, (v) => h.onItemChange({ rot: v }))));
    selSec.append(field('Height off floor', num(item.elevation ?? 0, { step: 0.05, min: 0 }, (v) => h.onItemChange({ elevation: v }))));
    selSec.append(
      field(
        'Colour',
        color(item.color || def.color, (c) => h.onItemPreviewColor(c), (c) => h.onItemChange({ color: c }))
      )
    );
    const row = el('div', { class: 'row' });
    const btn = (label, fn, cls = '') => {
      const b = el('button', { class: cls });
      b.textContent = label;
      b.addEventListener('click', fn);
      return b;
    };
    row.append(btn('↺ 15°', () => h.onItemAction('rotateLeft')), btn('↻ 15°', () => h.onItemAction('rotateRight')));
    const row2 = el('div', { class: 'row' });
    row2.append(btn('Duplicate', () => h.onItemAction('duplicate')), btn('Delete', () => h.onItemAction('delete'), 'danger'));
    selSec.append(row, row2);
  }

  function showWall(id, room) {
    wallSec.replaceChildren();
    if (!id) return;
    wallSec.append(el('h3', {}, ['Wall']));
    wallSec.append(el('div', {}, [el('span', { class: 'wall-chip' }, [WALL_NAMES[id] || id])]));
    const current = room.wallColors[id] || room.wallColor;
    wallSec.append(
      field(
        'Paint',
        color(current, (c) => h.onWallColor(id, c), (c) => h.onWallColor(id, c))
      )
    );
    const row = el('div', { class: 'row' });
    const b = el('button', { class: 'small' });
    b.textContent = 'Use room colour';
    b.addEventListener('click', () => {
      h.onWallColor(id, null);
      showWall(id, room);
    });
    row.append(b);
    wallSec.append(row);
  }

  function renderRoom(room, lighting) {
    const r = (fn) => (v) => h.onRoomChange((room) => fn(room, v));
    roomSec.replaceChildren(
      el('h3', {}, ['Room']),
      field('Width', num(room.width, { step: 0.05, min: 2 }, r((m, v) => (m.width = v)))),
      field('Length', num(room.length, { step: 0.05, min: 2 }, r((m, v) => (m.length = v)))),
      field('Kitchen width', num(room.notch.width, { step: 0.05, min: 0.5 }, r((m, v) => (m.notch.width = v)))),
      field('Kitchen depth', num(room.notch.depth, { step: 0.05, min: 0.5 }, r((m, v) => (m.notch.depth = v)))),
      field('Ceiling', num(room.ceiling, { step: 0.05, min: 2 }, r((m, v) => (m.ceiling = v)))),
      field(
        'Wall paint',
        color(room.wallColor, (c) => h.onWallColor(null, c), (c) => h.onWallColor(null, c))
      ),
      el('h3', {}, ['Window (top wall)']),
      field('Sill height', num(room.window.sill, { step: 0.05, min: 0 }, r((m, v) => (m.window.sill = v)))),
      field('Top height', num(room.window.top, { step: 0.05, min: 0.5 }, r((m, v) => (m.window.top = v)))),
      el('h3', {}, ['Entrance door (bottom wall)']),
      field('From left', num(room.entranceDoor.from, { step: 0.05, min: 0 }, r((m, v) => (m.entranceDoor.from = v)))),
      field('Width', num(room.entranceDoor.width, { step: 0.05, min: 0.6 }, r((m, v) => (m.entranceDoor.width = v)))),
      el('h3', {}, ['Kitchen door (partition)']),
      field('From corner', num(room.kitchenDoor.from, { step: 0.05, min: 0 }, r((m, v) => (m.kitchenDoor.from = v)))),
      field('Width', num(room.kitchenDoor.width, { step: 0.05, min: 0.6 }, r((m, v) => (m.kitchenDoor.width = v)))),
      el('h3', {}, ['Floors']),
      field('Office', select(Object.entries(FLOORS).map(([k, f]) => [k, f.name]), room.floor, r((m, v) => (m.floor = v)))),
      field('Kitchen', select(Object.entries(FLOORS).map(([k, f]) => [k, f.name]), room.kitchenFloor, r((m, v) => (m.kitchenFloor = v))))
    );

    const timeLabel = el('span', {}, [fmtHour(lighting.hour)]);
    const slider = el('input', { type: 'range', min: 6, max: 20, step: 0.25 });
    slider.value = lighting.hour;
    slider.addEventListener('input', () => {
      timeLabel.textContent = fmtHour(+slider.value);
      h.onLightingChange({ hour: +slider.value });
    });
    const lights = el('input', { type: 'checkbox' });
    lights.checked = lighting.ceilingLights;
    lights.addEventListener('change', () => h.onLightingChange({ ceilingLights: lights.checked }));
    lightSec.replaceChildren(
      el('h3', {}, ['Daylight']),
      field('Time', el('div', {}, [slider])),
      field('', timeLabel),
      field('Ceiling lights', el('label', { class: 'toggle' }, [lights, ' on']))
    );
  }

  helpSec.replaceChildren(
    el('h3', {}, ['Shortcuts']),
    el('div', { class: 'hint' }, [
      el('div', {}, ['Drag an item to move it; it slides along walls.']),
      el('div', {}, [el('kbd', {}, ['R']), ' rotate · ', el('kbd', {}, ['⇧R']), ' rotate back']),
      el('div', {}, [el('kbd', {}, ['Arrows']), ' nudge 5 cm · ', el('kbd', {}, ['⇧']), ' 25 cm']),
      el('div', {}, [el('kbd', {}, ['D']), ' duplicate · ', el('kbd', {}, ['⌫']), ' delete · ', el('kbd', {}, ['Esc']), ' deselect']),
      el('div', {}, ['Click a wall to paint it. Right-drag pans, scroll zooms.']),
    ])
  );

  showItem(null);
  return { showItem, showWall, renderRoom, setSaveStatus: (t) => ($('#saveStatus').textContent = t) };
}
