// Selection, dragging and keyboard editing of furniture items.
import * as THREE from 'three';
import { buildItem, CATALOG_BY_TYPE } from './catalog.js';
import { pointInPolygon } from './room.js';

const SNAP = 0.05;
const ROT_STEP = 15;

export class Editor {
  constructor({ scene, dom, getCamera, getControls, getRoomGroup, onChange, onSelect, onWallSelect }) {
    this.scene = scene;
    this.dom = dom;
    this.getCamera = getCamera;
    this.getControls = getControls;
    this.getRoomGroup = getRoomGroup;
    this.onChange = onChange;
    this.onSelect = onSelect;
    this.onWallSelect = onWallSelect;
    this.snap = true;

    this.itemsGroup = new THREE.Group();
    scene.add(this.itemsGroup);
    this.items = new Map();
    this.selected = null;
    this.outline = null;
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.drag = null;
    this.downPos = null;
    this.room = null;

    dom.addEventListener('pointerdown', (e) => this.onDown(e), true);
    window.addEventListener('pointermove', (e) => this.onMove(e));
    window.addEventListener('pointerup', (e) => this.onUp(e));
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  setRoom(room) {
    this.room = room;
  }

  // ---- items -------------------------------------------------------------

  addItem(data) {
    const def = CATALOG_BY_TYPE[data.type];
    if (!def) return null;
    if (data.elevation == null && def.elevation != null) data.elevation = def.elevation;
    const g = buildItem(def, data.color);
    g.userData.item = data;
    g.userData.def = def;
    this.applyTransform(g);
    this.itemsGroup.add(g);
    this.items.set(data.id, g);
    return g;
  }

  rebuildItem(g) {
    const { item, def } = g.userData;
    const wasSelected = this.selected === g;
    this.removeGroup(g);
    const n = this.addItem(item);
    if (wasSelected) this.select(n, false);
    return n;
  }

  removeGroup(g) {
    if (this.selected === g) this.select(null, false);
    this.items.delete(g.userData.item.id);
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.itemsGroup.remove(g);
  }

  applyTransform(g) {
    const d = g.userData.item;
    g.position.set(d.x, d.elevation ?? 0, d.z);
    g.rotation.y = THREE.MathUtils.degToRad(d.rot || 0);
  }

  load(items) {
    for (const g of [...this.items.values()]) this.removeGroup(g);
    for (const it of items) this.addItem(it);
  }

  serialize() {
    return [...this.items.values()].map((g) => ({ ...g.userData.item }));
  }

  // Place a new item near the middle of the office (nudged so repeats don't stack).
  spawn(def, extra = {}) {
    const n = this.items.size % 6;
    const { W, L, nd } = this.room;
    const data = {
      id: `i${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      type: def.type,
      x: W / 2 + (n - 2.5) * 0.3,
      z: (L - nd) / 2 + (n % 2) * 0.4,
      rot: 0,
      ...extra,
    };
    if (def.elevation != null) data.elevation = def.elevation;
    if (def.wallMounted) this.snapToWall(data, def);
    this.clampInside(data, def);
    const g = this.addItem(data);
    this.select(g);
    this.onChange();
    return g;
  }

  updateSelected(patch) {
    if (!this.selected) return;
    const g = this.selected;
    const d = g.userData.item;
    const def = g.userData.def;
    const needsRebuild = patch.color != null && patch.color !== d.color;
    Object.assign(d, patch);
    if (def.wallMounted && (patch.x != null || patch.z != null)) this.snapToWall(d, def);
    if (needsRebuild) this.rebuildItem(g);
    else this.applyTransform(g);
    this.onChange();
    this.onSelect(this.selected?.userData.item ?? null, def);
  }

  rotateSelected(deg) {
    if (!this.selected) return;
    const d = this.selected.userData.item;
    this.updateSelected({ rot: ((d.rot || 0) + deg + 540) % 360 - 180 });
  }

  deleteSelected() {
    if (!this.selected) return;
    this.removeGroup(this.selected);
    this.onChange();
  }

  duplicateSelected() {
    if (!this.selected) return;
    const d = this.selected.userData.item;
    const def = this.selected.userData.def;
    const copy = { ...d, id: `i${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}` };
    const nx = (def.wallMounted ? 0 : 1) * 0.4;
    copy.x += def.wallMounted ? 0 : nx;
    copy.z += def.wallMounted ? def.w + 0.1 : 0.4;
    if (def.wallMounted) this.snapToWall(copy, def);
    this.clampInside(copy, def);
    const g = this.addItem(copy);
    this.select(g);
    this.onChange();
  }

  // ---- selection ---------------------------------------------------------

  select(g, notify = true) {
    if (this.outline) {
      this.outline.removeFromParent();
      this.outline.geometry.dispose();
      this.outline = null;
    }
    this.selected = g;
    if (g) {
      const def = g.userData.def;
      const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(def.w + 0.02, def.h + 0.02, def.d + 0.02));
      this.outline = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#f0b429' }));
      this.outline.position.y = def.h / 2;
      g.add(this.outline);
    }
    if (notify) this.onSelect(g ? g.userData.item : null, g ? g.userData.def : null);
  }

  // ---- geometry helpers --------------------------------------------------

  corners(d, def) {
    const r = THREE.MathUtils.degToRad(d.rot || 0);
    const c = Math.cos(r);
    const s = Math.sin(r);
    const hw = def.w / 2;
    const hd = def.d / 2;
    return [
      [-hw, -hd],
      [hw, -hd],
      [hw, hd],
      [-hw, hd],
    ].map(([x, z]) => [d.x + x * c + z * s, d.z - x * s + z * c]);
  }

  isInside(d, def) {
    if (!this.room) return true;
    const cs = this.corners(d, def);
    const { office, kitchen } = this.room.polygons;
    return cs.every((p) => pointInPolygon(p, office)) || cs.every((p) => pointInPolygon(p, kitchen));
  }

  // Pull a point back into the envelope so spawned items are always reachable.
  clampInside(d, def) {
    if (def.wallMounted || this.isInside(d, def)) return;
    const { W, L } = this.room;
    d.x = THREE.MathUtils.clamp(d.x, def.w / 2 + 0.05, W - def.w / 2 - 0.05);
    d.z = THREE.MathUtils.clamp(d.z, def.d / 2 + 0.05, L - def.d / 2 - 0.05);
    if (!this.isInside(d, def)) {
      d.x = W / 2;
      d.z = (L - this.room.nd) / 2;
    }
  }

  // Wall-mounted items: stick the back to the nearest wall, facing into the room.
  snapToWall(d, def) {
    if (!this.room) return;
    let best = null;
    for (const poly of [this.room.polygons.office, this.room.polygons.kitchen]) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        const len2 = dx * dx + dz * dz;
        let t = ((d.x - a[0]) * dx + (d.z - a[1]) * dz) / len2;
        const half = def.w / 2 / Math.sqrt(len2);
        t = THREE.MathUtils.clamp(t, half, 1 - half);
        const px = a[0] + dx * t;
        const pz = a[1] + dz * t;
        const dist = Math.hypot(d.x - px, d.z - pz);
        if (!best || dist < best.dist) best = { dist, px, pz, dx, dz, len: Math.sqrt(len2) };
      }
    }
    if (!best) return;
    // Inward normal for the clockwise polygons is (-dz, dx).
    const nx = -best.dz / best.len;
    const nz = best.dx / best.len;
    const off = def.d / 2 + 0.005;
    d.x = best.px + nx * off;
    d.z = best.pz + nz * off;
    d.rot = Math.round(THREE.MathUtils.radToDeg(Math.atan2(nx, nz)));
  }

  // ---- pointer -----------------------------------------------------------

  setPointer(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.pointer, this.getCamera());
  }

  pickItem() {
    const hits = this.ray.intersectObjects(this.itemsGroup.children, true);
    for (const h of hits) {
      let o = h.object;
      if (!o.userData.item) continue;
      while (o.parent && o.parent !== this.itemsGroup) o = o.parent;
      return o;
    }
    return null;
  }

  pickWall() {
    const rg = this.getRoomGroup();
    if (!rg) return null;
    const hits = this.ray.intersectObjects(rg.children, true);
    for (const h of hits) {
      if (h.object.userData.wallId) return h.object.userData.wallId;
      if (h.object.userData.kind === 'floor') return null;
    }
    return null;
  }

  onDown(e) {
    if (e.button !== 0) return;
    this.setPointer(e);
    this.downPos = [e.clientX, e.clientY];
    const g = this.pickItem();
    if (!g) return;
    e.stopImmediatePropagation();
    this.select(g);
    const d = g.userData.item;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(d.elevation ?? 0));
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, hit)) return;
    this.drag = { g, plane, offset: new THREE.Vector3(d.x - hit.x, 0, d.z - hit.z), moved: false };
    this.getControls().enabled = false;
    this.dom.style.cursor = 'grabbing';
  }

  onMove(e) {
    if (!this.drag) return;
    this.setPointer(e);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(this.drag.plane, hit)) return;
    const { g, offset } = this.drag;
    const d = g.userData.item;
    const def = g.userData.def;
    let nx = hit.x + offset.x;
    let nz = hit.z + offset.z;
    if (this.snap) {
      nx = Math.round(nx / SNAP) * SNAP;
      nz = Math.round(nz / SNAP) * SNAP;
    }
    const trial = { ...d, x: nx, z: nz };
    if (def.wallMounted) {
      this.snapToWall(trial, def);
    } else if (!this.isInside(trial, def)) {
      // Slide along whichever axis still fits so items glide along walls.
      const tx = { ...d, x: nx };
      const tz = { ...d, z: nz };
      if (this.isInside(tx, def)) Object.assign(trial, { x: nx, z: d.z });
      else if (this.isInside(tz, def)) Object.assign(trial, { x: d.x, z: nz });
      else return;
    }
    if (trial.x === d.x && trial.z === d.z && trial.rot === d.rot) return;
    Object.assign(d, trial);
    this.applyTransform(g);
    this.drag.moved = true;
  }

  onUp(e) {
    if (this.drag) {
      const moved = this.drag.moved;
      this.drag = null;
      this.getControls().enabled = true;
      this.dom.style.cursor = '';
      if (moved) {
        this.onChange();
        this.onSelect(this.selected.userData.item, this.selected.userData.def);
      }
      return;
    }
    if (!this.downPos) return;
    const dist = Math.hypot(e.clientX - this.downPos[0], e.clientY - this.downPos[1]);
    this.downPos = null;
    if (dist > 4 || e.target !== this.dom) return;
    this.setPointer(e);
    const wall = this.pickWall();
    this.select(null);
    this.onWallSelect(wall);
  }

  onKey(e) {
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (!this.selected) return;
    const d = this.selected.userData.item;
    const def = this.selected.userData.def;
    const step = e.shiftKey ? 0.25 : SNAP;
    const nudge = (dx, dz) => {
      const trial = { ...d, x: +(d.x + dx).toFixed(3), z: +(d.z + dz).toFixed(3) };
      if (def.wallMounted) this.snapToWall(trial, def);
      else if (!this.isInside(trial, def)) return;
      this.updateSelected({ x: trial.x, z: trial.z, rot: trial.rot });
    };
    switch (e.key) {
      case 'r':
        this.rotateSelected(ROT_STEP);
        break;
      case 'R':
        this.rotateSelected(-ROT_STEP);
        break;
      case 'Delete':
      case 'Backspace':
        this.deleteSelected();
        break;
      case 'd':
        this.duplicateSelected();
        break;
      case 'Escape':
        this.select(null);
        break;
      case 'ArrowLeft':
        nudge(-step, 0);
        break;
      case 'ArrowRight':
        nudge(step, 0);
        break;
      case 'ArrowUp':
        nudge(0, -step);
        break;
      case 'ArrowDown':
        nudge(0, step);
        break;
      default:
        return;
    }
    e.preventDefault();
  }
}
