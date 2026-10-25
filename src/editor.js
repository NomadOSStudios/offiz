import * as THREE from "three";
import { buildItem, itemDef, CATALOG_BY_TYPE } from "./catalog.js";
import { footprint, contained, bounds } from "./geometry.js";
import { uid } from "./store.js";
const SNAP = 0.05;
const dispose = (g) =>
  g.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) for (const m of [].concat(o.material)) m.dispose();
  });
export class Editor {
  constructor(options) {
    Object.assign(this, options);
    this.snap = true;
    this.enabled = true;
    this.items = new Map();
    this.selectedIds = new Set();
    this.outlines = [];
    this.itemsGroup = new THREE.Group();
    this.scene.add(this.itemsGroup);
    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.drag = null;
    this.room = null;
    this.preview = null;
    this.guides = [];
    this.dom.addEventListener("pointerdown", (e) => this.onDown(e), true);
    window.addEventListener("pointermove", (e) => this.onMove(e));
    window.addEventListener("pointerup", (e) => this.onUp(e));
    window.addEventListener("pointercancel", () => this.finishDrag());
    window.addEventListener("blur", () => this.finishDrag());
    window.addEventListener("keydown", (e) => this.onKey(e));
  }
  get selected() {
    return this.items.get([...this.selectedIds][0]) || null;
  }
  get selection() {
    return [...this.selectedIds]
      .map((id) => this.items.get(id))
      .filter(Boolean);
  }
  setRoom(room) {
    this.room = room;
  }
  addItem(data) {
    const base = CATALOG_BY_TYPE[data.type];
    if (!base) return null;
    data.elevation ??= base.elevation ?? 0;
    const def = itemDef(base, data),
      g = buildItem(def, data.color);
    g.userData.item = data;
    g.userData.def = def;
    this.applyTransform(g);
    this.itemsGroup.add(g);
    this.items.set(data.id, g);
    return g;
  }
  applyTransform(g) {
    const d = g.userData.item;
    g.position.set(d.x, d.elevation || 0, d.z);
    g.rotation.y = THREE.MathUtils.degToRad(d.rot || 0);
  }
  clearOutlines() {
    for (const o of this.outlines) {
      o.removeFromParent();
      dispose(o);
    }
    this.outlines = [];
  }
  removeGroup(g) {
    this.items.delete(g.userData.item.id);
    this.selectedIds.delete(g.userData.item.id);
    g.removeFromParent();
    dispose(g);
  }
  load(items, selected = []) {
    this.cancelPlacement();
    this.clearOutlines();
    for (const g of [...this.items.values()]) this.removeGroup(g);
    for (const it of items) this.addItem({ ...it });
    this.selectedIds = new Set(selected.filter((id) => this.items.has(id)));
    this.refreshSelection(false);
  }
  serialize() {
    return [...this.items.values()].map((g) => ({ ...g.userData.item }));
  }
  select(g, notify = true, additive = false) {
    const ids = g
      ? g.userData.item.group
        ? [...this.items.values()]
            .filter((o) => o.userData.item.group === g.userData.item.group)
            .map((o) => o.userData.item.id)
        : [g.userData.item.id]
      : [];
    if (!additive) this.selectedIds.clear();
    const remove = additive && ids.every((id) => this.selectedIds.has(id));
    for (const id of ids)
      remove ? this.selectedIds.delete(id) : this.selectedIds.add(id);
    this.refreshSelection(notify);
  }
  refreshSelection(notify = true) {
    this.clearOutlines();
    for (const g of this.selection) {
      const d = g.userData.def,
        box = new THREE.BoxGeometry(d.w + 0.012, d.h + 0.012, d.d + 0.012),
        geo = new THREE.EdgesGeometry(box);
      box.dispose();
      const outline = new THREE.LineSegments(
        geo,
        new THREE.LineBasicMaterial({ color: "#f0b429", depthTest: false }),
      );
      outline.position.y = d.h / 2;
      outline.renderOrder = 10;
      g.add(outline);
      this.outlines.push(outline);
    }
    if (notify) this.notifySelection();
    this.onVisual?.();
  }
  notifySelection() {
    this.onSelect(
      this.selected?.userData.item ?? null,
      this.selected?.userData.def ?? null,
      this.selection.map((g) => g.userData.item),
    );
  }
  corners(d, def) {
    return footprint(d, def);
  }
  rooms() {
    return Object.values(this.room?.polygons || {}).filter(Boolean);
  }
  isInside(d, def) {
    return (
      ["w", "d", "h"].every(
        (k) =>
          d[k] == null || (Number.isFinite(d[k]) && d[k] >= 0.1 && d[k] <= 50),
      ) &&
      [d.x, d.z, d.rot || 0, d.elevation || 0, def.w, def.d, def.h].every(
        Number.isFinite,
      ) &&
      (d.elevation || 0) >= 0 &&
      (!this.room ||
        ((d.elevation || 0) + def.h <= this.room.ceiling + 0.001 &&
          this.rooms().some((p) => contained(footprint(d, def), p))))
    );
  }
  snapToWall(d, def) {
    let best = null;
    for (const poly of this.rooms())
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i],
          b = poly[(i + 1) % poly.length],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          len = Math.hypot(dx, dz);
        if (len < def.w + 0.01) continue;
        const t = THREE.MathUtils.clamp(
          ((d.x - a[0]) * dx + (d.z - a[1]) * dz) / (len * len),
          def.w / 2 / len,
          1 - def.w / 2 / len,
        );
        const px = a[0] + dx * t,
          pz = a[1] + dz * t,
          dist = Math.hypot(d.x - px, d.z - pz);
        if (!best || dist < best.dist) best = { px, pz, dx, dz, len, dist };
      }
    if (!best) return;
    const nx = -best.dz / best.len,
      nz = best.dx / best.len;
    d.x = best.px + nx * (def.d / 2 + 0.005);
    d.z = best.pz + nz * (def.d / 2 + 0.005);
    d.rot = Math.round((Math.atan2(nx, nz) * 180) / Math.PI);
  }
  commitTrials(trials, { commit = true, quiet = false } = {}) {
    if (
      trials.some((d) => !this.isInside(d, itemDef(CATALOG_BY_TYPE[d.type], d)))
    ) {
      if (!quiet) {
        this.onMessage?.("That change would cross a wall or ceiling.");
        this.notifySelection();
      }
      return false;
    }
    let changed = false;
    this.clearOutlines();
    for (const d of trials) {
      const old = this.items.get(d.id);
      if (!old) continue;
      if (JSON.stringify(old.userData.item) === JSON.stringify(d)) continue;
      const rebuild = ["w", "d", "h", "color"].some(
        (k) => old.userData.item[k] !== d[k],
      );
      if (rebuild) {
        const selected = this.selectedIds.has(d.id);
        this.removeGroup(old);
        this.addItem(d);
        if (selected) this.selectedIds.add(d.id);
      } else {
        old.userData.item = d;
        this.applyTransform(old);
      }
      changed = true;
    }
    this.refreshSelection(commit);
    if (changed && commit) this.onChange();
    return changed;
  }
  updateSelected(patch) {
    if (!this.selected || !this.enabled) return;
    const d = this.selected.userData.item;
    if (this.selection.length > 1 && (patch.x != null || patch.z != null))
      return this.moveSelection((patch.x ?? d.x) - d.x, (patch.z ?? d.z) - d.z);
    if (this.selection.length > 1 && patch.rot != null)
      return this.rotateSelected(patch.rot - (d.rot || 0));
    const trials = this.selection.map((g) => {
      const next = { ...g.userData.item, ...patch };
      for (const k of ["w", "d", "h"]) if (next[k] === null) delete next[k];
      const def = itemDef(CATALOG_BY_TYPE[next.type], next);
      if (def.wallMounted && ["x", "z", "w", "d"].some((k) => k in patch))
        this.snapToWall(next, def);
      return next;
    });
    return this.commitTrials(trials);
  }
  moveSelection(dx, dz, { commit = true, quiet = false } = {}) {
    const trials = this.selection.map((g) => {
      const d = {
        ...g.userData.item,
        x: g.userData.item.x + dx,
        z: g.userData.item.z + dz,
      };
      if (g.userData.def.wallMounted && this.selection.length === 1)
        this.snapToWall(d, g.userData.def);
      return d;
    });
    return this.commitTrials(trials, { commit, quiet });
  }
  rotateSelected(deg) {
    if (!this.selection.length) return;
    const cx =
        this.selection.reduce((s, g) => s + g.position.x, 0) /
        this.selection.length,
      cz =
        this.selection.reduce((s, g) => s + g.position.z, 0) /
        this.selection.length,
      a = (deg * Math.PI) / 180;
    return this.commitTrials(
      this.selection.map((g) => {
        const d = g.userData.item,
          x = d.x - cx,
          z = d.z - cz;
        return {
          ...d,
          x: cx + x * Math.cos(a) + z * Math.sin(a),
          z: cz - x * Math.sin(a) + z * Math.cos(a),
          rot: (((d.rot || 0) + deg + 540) % 360) - 180,
        };
      }),
    );
  }
  deleteSelected() {
    if (!this.selection.length) return;
    this.clearOutlines();
    for (const g of this.selection) this.removeGroup(g);
    this.refreshSelection();
    this.onChange();
  }
  duplicateSelected() {
    const groups = new Map(),
      source = this.selection.map((g) => g.userData.item);
    if (!source.length) return;
    let copies = null;
    for (const [dx, dz] of [
      [0.4, 0.4],
      [-0.4, 0.4],
      [0.4, -0.4],
      [-0.4, -0.4],
      [0, 0],
    ]) {
      const trial = source.map((d) => ({ ...d, x: d.x + dx, z: d.z + dz }));
      if (
        trial.every((d) =>
          this.isInside(d, itemDef(CATALOG_BY_TYPE[d.type], d)),
        )
      ) {
        copies = trial;
        break;
      }
    }
    if (!copies) return this.onMessage?.("No room for a duplicate.");
    this.selectedIds.clear();
    for (const d of copies) {
      d.id = uid();
      if (d.group) {
        if (!groups.has(d.group)) groups.set(d.group, uid());
        d.group = groups.get(d.group);
      }
      this.addItem(d);
      this.selectedIds.add(d.id);
    }
    this.refreshSelection();
    this.onChange();
  }
  groupSelected() {
    if (this.selection.length < 2) return;
    const group = uid();
    for (const g of this.selection) g.userData.item.group = group;
    this.notifySelection();
    this.onChange();
  }
  ungroupSelected() {
    for (const g of this.selection) delete g.userData.item.group;
    this.notifySelection();
    this.onChange();
  }
  align(axis) {
    if (this.selection.length < 2) return;
    const b = bounds(
        this.selection.flatMap((g) =>
          footprint(g.userData.item, g.userData.def),
        ),
      ),
      target = axis === "x" ? (b.left + b.right) / 2 : (b.top + b.bottom) / 2;
    this.commitTrials(
      this.selection.map((g) => ({ ...g.userData.item, [axis]: target })),
    );
  }
  beginPlacement(def) {
    this.cancelPlacement();
    this.select(null);
    const data = {
      id: uid(),
      type: def.type,
      x: this.room.W / 2,
      z: (this.room.L - this.room.nd) / 2,
      rot: 0,
      elevation: def.elevation || 0,
    };
    const g = buildItem(def);
    g.traverse((o) => {
      if (o.isMesh) {
        o.material.transparent = true;
        o.material.opacity = 0.5;
        o.material.depthWrite = false;
      }
    });
    this.scene.add(g);
    this.preview = { def, data, g, valid: false };
    this.updatePlacement(data.x, data.z);
    this.onMessage?.(
      `Place ${def.name.toLowerCase()}: click the room · R rotates · Esc cancels`,
    );
  }
  updatePlacement(x, z) {
    if (!this.preview) return;
    const p = this.preview;
    p.data.x = this.snap ? Math.round(x / SNAP) * SNAP : x;
    p.data.z = this.snap ? Math.round(z / SNAP) * SNAP : z;
    if (p.def.wallMounted) this.snapToWall(p.data, p.def);
    p.valid = this.isInside(p.data, p.def);
    p.g.position.set(p.data.x, p.data.elevation, p.data.z);
    p.g.rotation.y = ((p.data.rot || 0) * Math.PI) / 180;
    p.g.traverse((o) => {
      if (o.isMesh) o.material.color.set(p.valid ? "#51b8a0" : "#e05d63");
    });
    this.onVisual?.();
  }
  placePreview() {
    if (!this.preview?.valid)
      return this.onMessage?.("Choose a position fully inside a room.");
    const d = { ...this.preview.data };
    this.cancelPlacement();
    const g = this.addItem(d);
    this.select(g);
    this.onChange();
    this.onMessage?.("Placed. Drag to move; Shift-click to select more.");
  }
  cancelPlacement() {
    if (this.preview) {
      this.preview.g.removeFromParent();
      dispose(this.preview.g);
      this.preview = null;
    }
    this.onVisual?.();
  }
  alignedPosition(x, z) {
    this.guides = [];
    if (!this.snap || !this.selected) return [x, z];
    x = Math.round(x / SNAP) * SNAP;
    z = Math.round(z / SNAP) * SNAP;
    const selected = this.selected,
      def = selected.userData.def,
      trial = { ...selected.userData.item, x, z },
      b = bounds(footprint(trial, def));
    const anchorsX = [b.left, (b.left + b.right) / 2, b.right],
      anchorsZ = [b.top, (b.top + b.bottom) / 2, b.bottom];
    const targetsX = [0, this.room.W],
      targetsZ = [0, this.room.L];
    for (const g of this.items.values())
      if (!this.selectedIds.has(g.userData.item.id)) {
        const q = bounds(footprint(g.userData.item, g.userData.def));
        targetsX.push(q.left, (q.left + q.right) / 2, q.right);
        targetsZ.push(q.top, (q.top + q.bottom) / 2, q.bottom);
      }
    const closest = (a, t) =>
      a
        .flatMap((v) => t.map((w) => ({ delta: w - v, at: w })))
        .filter((v) => Math.abs(v.delta) < 0.07)
        .sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))[0];
    const sx = closest(anchorsX, targetsX),
      sz = closest(anchorsZ, targetsZ);
    if (sx) {
      x += sx.delta;
      this.guides.push({ axis: "x", at: sx.at });
    }
    if (sz) {
      z += sz.delta;
      this.guides.push({ axis: "z", at: sz.at });
    }
    return [x, z];
  }
  beginDrag(x, z, source = "3d") {
    if (!this.selected) return;
    this.drag = {
      source,
      start: [x, z],
      original: this.serialize(),
      positions: this.selection.map((g) => ({ ...g.userData.item })),
      anchor: { ...this.selected.userData.item },
      moved: false,
    };
  }
  dragTo(x, z) {
    if (!this.drag) return;
    const d = this.drag,
      [nx, nz] = this.alignedPosition(
        d.anchor.x + x - d.start[0],
        d.anchor.z + z - d.start[1],
      );
    const dx = nx - d.anchor.x,
      dz = nz - d.anchor.z;
    let trials = d.positions.map((it) => ({
      ...it,
      x: it.x + dx,
      z: it.z + dz,
    }));
    if (trials.length === 1 && CATALOG_BY_TYPE[trials[0].type].wallMounted)
      this.snapToWall(
        trials[0],
        itemDef(CATALOG_BY_TYPE[trials[0].type], trials[0]),
      );
    const valid = (candidates) =>
      candidates.every((it) =>
        this.isInside(it, itemDef(CATALOG_BY_TYPE[it.type], it)),
      );
    if (!valid(trials)) {
      const alongX = trials.map((it) => ({
        ...it,
        z: this.items.get(it.id).userData.item.z,
      }));
      const alongZ = trials.map((it) => ({
        ...it,
        x: this.items.get(it.id).userData.item.x,
      }));
      trials = valid(alongX) ? alongX : valid(alongZ) ? alongZ : [];
    }
    if (trials.length) {
      // Moving doesn't rebuild geometry on every frame.
      for (const it of trials) {
        const g = this.items.get(it.id);
        g.userData.item = it;
        this.applyTransform(g);
      }
      d.moved = true;
      this.onVisual?.();
    }
  }
  finishDrag(cancel = false) {
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    this.guides = [];
    this.getControls().enabled = this.enabled;
    this.dom.style.cursor = "";
    if (cancel) {
      this.load(d.original, [...this.selectedIds]);
      this.notifySelection();
    } else if (d.moved) {
      this.notifySelection();
      this.onChange();
    }
    this.onVisual?.();
  }
  setPointer(e) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      (-(e.clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(this.pointer, this.getCamera());
  }
  groundPoint() {
    return this.ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
  }
  pickItem() {
    for (const h of this.ray.intersectObjects(this.itemsGroup.children, true)) {
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
    for (const h of this.ray.intersectObjects(rg.children, true)) {
      let o = h.object,
        visible = true;
      while (o) {
        if (!o.visible) visible = false;
        o = o.parent;
      }
      if (!visible) continue;
      if (h.object.userData.wallId) return h.object.userData.wallId;
      if (h.object.userData.kind === "floor") return null;
    }
    return null;
  }
  onDown(e) {
    if (e.button !== 0 || !this.enabled) return;
    this.setPointer(e);
    if (this.preview) {
      e.stopImmediatePropagation();
      const p = this.groundPoint();
      if (p) this.updatePlacement(p.x, p.z);
      this.placePreview();
      return;
    }
    this.downPos = [e.clientX, e.clientY];
    const g = this.pickItem();
    if (!g) return;
    e.stopImmediatePropagation();
    if (e.shiftKey) {
      this.select(g, true, true);
      return;
    }
    if (!this.selectedIds.has(g.userData.item.id)) this.select(g);
    const p = this.groundPoint();
    if (p) {
      this.beginDrag(p.x, p.z);
      this.getControls().enabled = false;
      this.dom.style.cursor = "grabbing";
    }
  }
  onMove(e) {
    if (this.drag?.source === "plan") return;
    if (
      !this.enabled ||
      (!this.drag && !this.preview) ||
      (e.target !== this.dom && !this.drag)
    )
      return;
    this.setPointer(e);
    const p = this.groundPoint();
    if (!p) return;
    if (this.preview) this.updatePlacement(p.x, p.z);
    else this.dragTo(p.x, p.z);
  }
  onUp(e) {
    if (this.drag) {
      this.finishDrag();
      this.downPos = null;
      return;
    }
    if (!this.downPos) return;
    const dist = Math.hypot(
      e.clientX - this.downPos[0],
      e.clientY - this.downPos[1],
    );
    this.downPos = null;
    if (dist > 4 || e.target !== this.dom || e.shiftKey || this.preview) return;
    this.setPointer(e);
    if (this.pickItem()) return;
    this.select(null);
    this.onWallSelect(this.pickWall());
  }
  onKey(e) {
    if (
      globalThis.document?.querySelector("dialog[open]") ||
      e.target.closest?.('input,select,textarea,[contenteditable="true"]') ||
      !this.enabled ||
      e.metaKey ||
      e.ctrlKey
    )
      return;
    if (e.key === "Escape") {
      e.preventDefault();
      this.finishDrag(true);
      this.cancelPlacement();
      this.select(null);
      return;
    }
    if (this.preview && e.key.toLowerCase() === "r") {
      this.preview.data.rot += e.shiftKey ? -15 : 15;
      this.updatePlacement(this.preview.data.x, this.preview.data.z);
      e.preventDefault();
      return;
    }
    if (!this.selected) return;
    const step = e.shiftKey ? 0.25 : SNAP;
    const actions = {
      r: () => this.rotateSelected(15),
      R: () => this.rotateSelected(-15),
      d: () => this.duplicateSelected(),
      Delete: () => this.deleteSelected(),
      Backspace: () => this.deleteSelected(),
      ArrowLeft: () => this.moveSelection(-step, 0),
      ArrowRight: () => this.moveSelection(step, 0),
      ArrowUp: () => this.moveSelection(0, -step),
      ArrowDown: () => this.moveSelection(0, step),
    };
    if (actions[e.key]) {
      e.preventDefault();
      actions[e.key]();
    }
  }
}
