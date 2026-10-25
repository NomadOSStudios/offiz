import { el, button, openDialog, closeDialog } from "./ui.js";
import { FLOORS } from "./textures.js";
import { History } from "./history.js";
import {
  legacyFloorPlan,
  validateFloorPlan,
  floorPlanRoom,
  planWalls,
  openingSegment,
  signedArea,
  interiorPoint,
  projectPoint,
  planId,
} from "./floorplan-model.js";
const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, text = "") => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
};
const pointString = (p) => p.map((p) => p.join(",")).join(" ");
const copy = (o) => structuredClone(o);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function openFloorPlanEditor(state, onApply) {
  return new FloorPlanEditor(state, onApply);
}
class FloorPlanEditor {
  constructor(state, onApply) {
    this.cfg = copy(state.room);
    this.onApply = onApply;
    this.plan = copy(this.cfg.floorPlan || legacyFloorPlan(this.cfg));
    this.history = new History(this.plan);
    this.mode = "select";
    this.selected = null;
    this.drawing = [];
    this.snap = true;
    this.box = [-1.3, -1.1, this.cfg.width + 2.6, this.cfg.length + 2.2];
    this.canvas = svg("svg", {
      "aria-label": "Draw and edit rooms",
      tabindex: "0",
      class: "floorplan-drawing",
    });
    this.canvas.style.touchAction = "none";
    this.side = el("aside", { class: "floorplan-inspector" });
    this.notice = el("p", {
      class: "floorplan-notice",
      role: "status",
      "aria-live": "polite",
    });
    this.instructions = el("p", { class: "floorplan-instructions" });
    this.keep = el("input", {
      type: "checkbox",
      checked: "",
      "aria-label": "Keep existing furniture",
    });
    const bar = el("div", {
      class: "floorplan-tools",
      role: "toolbar",
      "aria-label": "Floor plan tools",
    });
    this.modes = {};
    for (const [key, label] of [
      ["select", "Select"],
      ["draw", "Draw room"],
      ["door", "Door"],
      ["window", "Window"],
    ]) {
      const b = button(label, () => this.setMode(key));
      this.modes[key] = b;
      bar.append(b);
    }
    this.undoButton = button("↶", () => this.undo());
    this.undoButton.setAttribute("aria-label", "Undo floor plan edit");
    this.redoButton = button("↷", () => this.redo());
    this.redoButton.setAttribute("aria-label", "Redo floor plan edit");
    const snap = el("input", { type: "checkbox", checked: "" });
    snap.onchange = () => (this.snap = snap.checked);
    bar.append(
      this.undoButton,
      this.redoButton,
      button("−", () => this.zoom(1.2)),
      button("+", () => this.zoom(1 / 1.2)),
      button("Fit", () => this.fit()),
      el("label", { class: "toggle" }, [snap, " Snap 10 cm"]),
      button("New plan", () => {
        this.commit({ version: 1, rooms: [], openings: [] }, true);
        this.selected = null;
        this.box = [-1, -1, 10, 8];
        this.setMode("draw");
      }),
    );
    const workspace = el("div", { class: "floorplan-workspace" }, [
      el("div", { class: "floorplan-stage" }, [this.canvas]),
      this.side,
    ]);
    this.apply = button("Apply floor plan", () => this.applyPlan(), "primary");
    const footer = el("div", { class: "floorplan-footer" }, [
      el("label", { class: "toggle" }, [
        this.keep,
        ` Keep existing furniture (${state.items.length})`,
      ]),
      button("Cancel", closeDialog),
      this.apply,
    ]);
    this.root = el("div", { class: "floorplan-editor" }, [
      bar,
      this.instructions,
      workspace,
      this.notice,
      footer,
    ]);
    openDialog("Design your floor plan", [this.root]);
    this.dialog = document.getElementById("workspaceDialog");
    this.dialog.classList.add("floorplan-dialog");
    this.cleanup = () => {
      this.dialog.classList.remove("floorplan-dialog");
      this.dialog.removeEventListener("close", this.cleanup);
      this.dialog.removeEventListener("cancel", this.cancel);
    };
    this.cancel = (e) => {
      if (this.drawing.length || this.drag) {
        e.preventDefault();
        this.cancelDraft();
      }
    };
    this.dialog.addEventListener("close", this.cleanup);
    this.dialog.addEventListener("cancel", this.cancel);
    this.canvas.addEventListener("pointerdown", (e) => this.down(e));
    this.canvas.addEventListener("pointermove", (e) => this.move(e));
    this.canvas.addEventListener("pointerup", () => this.up());
    this.canvas.addEventListener("pointercancel", () => this.cancelDraft());
    this.canvas.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoom(e.deltaY > 0 ? 1.12 : 1 / 1.12, this.point(e));
      },
      { passive: false },
    );
    this.root.addEventListener("keydown", (e) => this.key(e));
    this.setMode("select");
    this.canvas.focus();
  }
  setMode(mode) {
    this.cancelDraft();
    this.mode = mode;
    if (mode === "draw") this.selected = null;
    this.notice.textContent = "";
    for (const [key, b] of Object.entries(this.modes)) {
      b.classList.toggle("active", key === mode);
      b.setAttribute("aria-pressed", String(key === mode));
    }
    this.instructions.textContent =
      mode === "draw"
        ? "Click each corner, then click the first point or press Enter to close the room. Shift keeps walls straight. Esc cancels."
        : mode === "door" || mode === "window"
          ? `Click a wall to place a ${mode}. Select it to change size, position${mode === "door" ? ", hinge and swing" : ""}.`
          : "Drag corners to reshape rooms. Drag openings along their wall. Click walls to split them. Drag empty space to pan.";
    this.render();
    this.inspect();
  }
  point(e) {
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
      this.canvas.getScreenCTM().inverse(),
    );
    return [p.x, p.y];
  }
  snapped(p, e = {}) {
    let q = p.map((v) =>
      Math.max(0, Math.min(50, this.snap ? Math.round(v * 10) / 10 : v)),
    );
    const last = this.drawing.at(-1);
    if (e.shiftKey && last) {
      if (Math.abs(q[0] - last[0]) < Math.abs(q[1] - last[1])) q[0] = last[0];
      else q[1] = last[1];
    }
    const candidates = [
      ...this.plan.rooms.flatMap((r) => r.points),
      ...this.drawing,
    ];
    const threshold = this.box[2] * 0.014;
    const near = candidates.find((v) => distance(q, v) < threshold);
    return near ? [...near] : q.map((v) => Math.round(v * 1000) / 1000);
  }
  validation(plan) {
    try {
      return {
        plan: validateFloorPlan(plan, this.cfg.ceiling, this.cfg.wallThickness),
      };
    } catch (e) {
      return { error: e.message };
    }
  }
  commit(next, allowEmpty = false) {
    const result =
      !next.rooms.length && allowEmpty ? { plan: next } : this.validation(next);
    if (result.error) {
      this.notice.textContent = result.error;
      this.render();
      this.inspect();
      return false;
    }
    this.plan = result.plan;
    this.history.record(this.plan);
    this.notice.textContent = "";
    this.render();
    this.inspect();
    return true;
  }
  undo() {
    if (this.drawing.length) {
      this.drawing.pop();
      this.render();
      return;
    }
    this.cancelDraft();
    const next = this.history.undo();
    if (next) {
      this.plan = next;
      this.selected = null;
      this.render();
      this.inspect();
    }
  }
  redo() {
    this.cancelDraft();
    const next = this.history.redo();
    if (next) {
      this.plan = next;
      this.selected = null;
      this.render();
      this.inspect();
    }
  }
  cancelDraft() {
    if (this.drag?.before) this.plan = this.drag.before;
    this.drag = null;
    this.drawing = [];
    this.hover = null;
    this.render();
  }
  fit() {
    const all = this.plan.rooms.flatMap((r) => r.points);
    if (!all.length) this.box = [-1, -1, 10, 8];
    else {
      const xs = all.map((p) => p[0]),
        zs = all.map((p) => p[1]),
        x = Math.min(...xs),
        z = Math.min(...zs);
      this.box = [
        x - 1,
        z - 1,
        Math.max(3, Math.max(...xs) - x + 2),
        Math.max(3, Math.max(...zs) - z + 2),
      ];
    }
    this.render();
  }
  zoom(factor, at = null) {
    if (this.box[2] * factor < 2 || this.box[2] * factor > 70) return;
    const p = at || [
      this.box[0] + this.box[2] / 2,
      this.box[1] + this.box[3] / 2,
    ];
    this.box = [
      p[0] + (this.box[0] - p[0]) * factor,
      p[1] + (this.box[1] - p[1]) * factor,
      this.box[2] * factor,
      this.box[3] * factor,
    ];
    this.render();
  }
  finishRoom() {
    if (this.drawing.length < 3) {
      this.notice.textContent = "Add at least three corners.";
      return;
    }
    const points = copy(this.drawing);
    if (signedArea(points) < 0) points.reverse();
    const room = {
      id: planId(),
      name: `Room ${this.plan.rooms.length + 1}`,
      floor: this.cfg.floor,
      points,
    };
    const next = copy(this.plan);
    next.rooms.push(room);
    if (this.commit(next)) {
      this.drawing = [];
      this.hover = null;
      this.selected = { kind: "room", id: room.id };
      this.setMode("select");
    }
  }
  down(e) {
    if (e.button !== 0 && e.button !== 1) return;
    e.preventDefault();
    this.canvas.focus();
    const p = this.point(e),
      target = e.target.closest("[data-kind]");
    if (e.button === 1 || e.altKey) {
      this.drag = { kind: "pan", start: p, box: [...this.box] };
    } else if (this.mode === "draw") {
      const q = this.snapped(p, e);
      if (
        this.drawing.length > 2 &&
        distance(q, this.drawing[0]) < this.box[2] * 0.02
      ) {
        this.finishRoom();
        return;
      }
      if (!this.drawing.length || distance(q, this.drawing.at(-1)) > 0.1)
        this.drawing.push(q);
      this.hover = q;
      this.render();
      return;
    } else if (this.mode === "door" || this.mode === "window") {
      if (target?.dataset.kind === "edge")
        this.placeOpening(target.dataset.id, +target.dataset.index, p);
      else this.notice.textContent = "Click directly on a wall.";
      return;
    } else if (target) {
      const { kind, id, index } = target.dataset;
      this.selected = { kind, id, index: +index };
      if (kind === "point")
        this.drag = {
          kind: "point",
          id,
          index: +index,
          before: copy(this.plan),
        };
      if (kind === "opening")
        this.drag = { kind: "opening", id, before: copy(this.plan), start: p };
      this.inspect();
      this.render();
    } else {
      this.selected = null;
      this.inspect();
      this.drag = {
        kind: "pan",
        client: [e.clientX, e.clientY],
        box: [...this.box],
      };
    }
    this.canvas.setPointerCapture(e.pointerId);
  }
  move(e) {
    const p = this.point(e);
    if (this.mode === "draw") {
      this.hover = this.snapped(p, e);
      this.render();
      return;
    }
    if (!this.drag) return;
    const drag = this.drag;
    if (drag.kind === "pan") {
      if (!drag.client) drag.client = [e.clientX, e.clientY];
      const m = this.canvas.getScreenCTM();
      this.box = [
        drag.box[0] - (e.clientX - drag.client[0]) / m.a,
        drag.box[1] - (e.clientY - drag.client[1]) / m.d,
        ...drag.box.slice(2),
      ];
      this.render();
      return;
    }
    const next = copy(drag.before);
    if (drag.kind === "point") {
      const old = drag.before.rooms.find((r) => r.id === drag.id).points[
          drag.index
        ],
        q = this.snapped(p, e);
      for (const r of next.rooms)
        for (let i = 0; i < r.points.length; i++)
          if (distance(r.points[i], old) < 1e-6) r.points[i] = [...q];
      this.reflowOpenings(next, drag.before);
    } else {
      const o = next.openings.find((o) => o.id === drag.id),
        old = drag.before.openings.find((o) => o.id === drag.id),
        room = next.rooms.find((r) => r.id === o.roomId),
        a = room.points[o.edge],
        b = room.points[(o.edge + 1) % room.points.length];
      const delta =
        projectPoint(p, a, b).along - projectPoint(drag.start, a, b).along;
      o.from = Math.max(
        0.05,
        Math.min(
          distance(a, b) - o.width - 0.05,
          Math.round((old.from + delta) * 100) / 100,
        ),
      );
    }
    const result = this.validation(next);
    if (!result.error) this.plan = result.plan;
    this.notice.textContent = result.error || "Release to apply this change.";
    this.render();
  }
  up() {
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.kind === "pan") {
      this.render();
      return;
    }
    const next = this.plan;
    this.plan = drag.before;
    if (!this.commit(next)) {
      this.render();
      this.inspect();
    }
  }
  reflowOpenings(next, before) {
    for (const o of next.openings) {
      const old = before.openings.find((v) => v.id === o.id),
        r = next.rooms.find((r) => r.id === o.roomId),
        prev = before.rooms.find((r) => r.id === o.roomId);
      const oldLen = distance(
          prev.points[o.edge],
          prev.points[(o.edge + 1) % prev.points.length],
        ),
        len = distance(
          r.points[o.edge],
          r.points[(o.edge + 1) % r.points.length],
        );
      o.from = Math.max(
        0.05,
        Math.min(
          len - o.width - 0.05,
          ((old.from + o.width / 2) / oldLen) * len - o.width / 2,
        ),
      );
    }
  }
  placeOpening(roomId, edge, p) {
    const room = this.plan.rooms.find((r) => r.id === roomId),
      a = room.points[edge],
      b = room.points[(edge + 1) % room.points.length],
      len = distance(a, b),
      kind = this.mode,
      width = Math.min(kind === "door" ? 0.9 : 1.2, len - 0.1),
      offset = projectPoint(p, a, b).along - width / 2;
    const o = {
      id: planId(),
      roomId,
      edge,
      kind,
      width,
      from: Math.max(
        0.05,
        Math.min(
          len - width - 0.05,
          this.snap
            ? Math.round(offset * 10) / 10
            : Math.round(offset * 1000) / 1000,
        ),
      ),
      height:
        kind === "door"
          ? Math.min(2.1, this.cfg.ceiling - 0.05)
          : Math.min(1.2, this.cfg.ceiling - 0.95),
      sill: kind === "door" ? 0 : 0.9,
      hinge: "start",
      swing: "in",
    };
    const next = copy(this.plan);
    next.openings.push(o);
    if (this.commit(next)) {
      this.selected = { kind: "opening", id: o.id };
      this.setMode("select");
    }
  }
  key(e) {
    if (e.target.closest("input,select,textarea")) return;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      e.shiftKey ? this.redo() : this.undo();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
      e.preventDefault();
      this.redo();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      this.cancelDraft();
      this.setMode("select");
    }
    if (e.key === "Enter" && this.mode === "draw") {
      e.preventDefault();
      this.finishRoom();
    }
    if (["Backspace", "Delete"].includes(e.key)) {
      e.preventDefault();
      if (this.drawing.length) {
        this.drawing.pop();
        this.render();
      } else this.removeSelected();
    }
    const target = e.target.closest("[data-kind]");
    if (target && ["Enter", " "].includes(e.key) && this.mode === "select") {
      e.preventDefault();
      this.selected = {
        kind: target.dataset.kind,
        id: target.dataset.id,
        index: +target.dataset.index,
      };
      this.inspect();
      this.render();
    }
  }
  mutate(fn) {
    const next = copy(this.plan);
    fn(next);
    this.commit(next);
  }
  removeSelected() {
    const s = this.selected;
    if (!s) return;
    if (s.kind === "opening")
      this.mutate(
        (p) => (p.openings = p.openings.filter((o) => o.id !== s.id)),
      );
    else if (s.kind === "room") {
      const next = copy(this.plan);
      next.rooms = next.rooms.filter((r) => r.id !== s.id);
      next.openings = next.openings.filter((o) => o.roomId !== s.id);
      this.commit(next, true);
    } else if (s.kind === "point") {
      this.removeCorner();
      return;
    } else return;
    this.selected = null;
    this.render();
    this.inspect();
  }
  splitWall() {
    const s = this.selected,
      next = copy(this.plan),
      r = next.rooms.find((r) => r.id === s.id),
      a = r.points[s.index],
      b = r.points[(s.index + 1) % r.points.length],
      half = distance(a, b) / 2;
    for (const o of next.openings.filter((o) => o.roomId === r.id)) {
      if (o.edge > s.index) o.edge++;
      else if (o.edge === s.index) {
        if (o.from < half && o.from + o.width > half) {
          this.notice.textContent =
            "Move this opening away from the midpoint before splitting the wall.";
          return;
        }
        if (o.from >= half) {
          o.edge++;
          o.from -= half;
        }
      }
    }
    r.points.splice(s.index + 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    if (this.commit(next)) {
      this.selected = { kind: "point", id: r.id, index: s.index + 1 };
      this.render();
      this.inspect();
    }
  }
  removeCorner() {
    const s = this.selected,
      next = copy(this.plan),
      r = next.rooms.find((r) => r.id === s.id);
    if (r.points.length <= 3) {
      this.notice.textContent = "A room needs at least three corners.";
      return;
    }
    const prev = (s.index + r.points.length - 1) % r.points.length;
    if (
      next.openings.some(
        (o) => o.roomId === r.id && (o.edge === s.index || o.edge === prev),
      )
    ) {
      this.notice.textContent =
        "Remove openings on the two adjoining walls before deleting this corner.";
      return;
    }
    r.points.splice(s.index, 1);
    for (const o of next.openings)
      if (o.roomId === r.id && o.edge > s.index) o.edge--;
    if (this.commit(next)) {
      this.selected = { kind: "room", id: r.id };
      this.render();
      this.inspect();
    }
  }
  field(
    label,
    value,
    onChange,
    { type = "number", min = 0, max = 50, step = 0.1, options = null } = {},
  ) {
    const input = options
      ? el("select", { "aria-label": label })
      : el("input", { type, "aria-label": label, min, max, step });
    if (options)
      for (const [v, name] of options)
        input.append(el("option", { value: v }, [name]));
    input.value =
      type === "number" && !options ? +Number(value).toFixed(3) : value;
    input.onchange = () => {
      onChange(type === "number" && !options ? +input.value : input.value);
    };
    return el("label", { class: "floorplan-field" }, [
      el("span", {}, [label]),
      input,
    ]);
  }
  inspect() {
    this.side.replaceChildren();
    const s = this.selected;
    const intro = el("div", {}, [
      el("span", { class: "eyebrow" }, ["YOUR FLOOR PLAN"]),
      el("h3", {}, [
        `${this.plan.rooms.length} room${this.plan.rooms.length === 1 ? "" : "s"} · ${this.plan.openings.length} opening${this.plan.openings.length === 1 ? "" : "s"}`,
      ]),
    ]);
    this.side.append(intro);
    if (!s) {
      this.side.append(
        el("p", { class: "hint" }, [
          "Draw a room to add a closed outline. Adjacent rooms can share walls. Dimensions are metres, measured along wall centre lines.",
        ]),
      );
      if (this.mode === "draw")
        this.side.append(
          button("Finish room", () => this.finishRoom()),
          button("Cancel drawing", () => this.setMode("select")),
        );
    } else if (s.kind === "opening") {
      const o = this.plan.openings.find((o) => o.id === s.id);
      if (!o) return;
      const room = this.plan.rooms.find((r) => r.id === o.roomId),
        set = (k, v) =>
          this.mutate((p) => (p.openings.find((v) => v.id === s.id)[k] = v));
      this.side.append(
        el("h2", {}, [o.kind === "door" ? "Door" : "Window"]),
        el("p", { class: "hint" }, [`${room.name} · wall ${o.edge + 1}`]),
        this.field(
          "Offset from wall start · m",
          o.from,
          (v) => set("from", v),
          { min: 0.05, step: 0.05 },
        ),
        this.field("Opening width · m", o.width, (v) => set("width", v), {
          min: o.kind === "door" ? 0.6 : 0.25,
          step: 0.05,
        }),
        this.field("Opening height · m", o.height, (v) => set("height", v), {
          min: o.kind === "door" ? 1.8 : 0.2,
          step: 0.05,
        }),
      );
      if (o.kind === "window")
        this.side.append(
          this.field("Window sill · m", o.sill, (v) => set("sill", v), {
            step: 0.05,
          }),
        );
      else
        this.side.append(
          this.field("Hinge", o.hinge, (v) => set("hinge", v), {
            options: [
              ["start", "Wall start"],
              ["end", "Wall end"],
            ],
          }),
          this.field("Swing", o.swing, (v) => set("swing", v), {
            options: [
              ["in", `Into ${room.name}`],
              ["out", `Out of ${room.name}`],
            ],
          }),
        );
      this.side.append(
        button("Remove opening", () => this.removeSelected(), "danger"),
      );
    } else {
      const r = this.plan.rooms.find((r) => r.id === s.id);
      if (!r) return;
      this.side.append(
        this.field(
          "Room name",
          r.name,
          (v) =>
            this.mutate((p) => (p.rooms.find((r) => r.id === s.id).name = v)),
          { type: "text" },
        ),
        this.field(
          "Room floor",
          r.floor,
          (v) =>
            this.mutate((p) => (p.rooms.find((r) => r.id === s.id).floor = v)),
          { options: Object.entries(FLOORS).map(([k, f]) => [k, f.name]) },
        ),
        el("p", { class: "hint" }, [
          `${Math.abs(signedArea(r.points)).toFixed(2)} m² · ${r.points.length} corners`,
        ]),
      );
      if (s.kind === "point") {
        this.side.append(el("h3", {}, [`Corner ${s.index + 1}`]));
        for (let axis = 0; axis < 2; axis++)
          this.side.append(
            this.field(
              `${axis ? "Z" : "X"} · m`,
              r.points[s.index][axis],
              (v) => {
                const next = copy(this.plan),
                  old = r.points[s.index];
                for (const room of next.rooms)
                  for (const p of room.points)
                    if (distance(p, old) < 1e-6) p[axis] = v;
                this.reflowOpenings(next, this.plan);
                this.commit(next);
              },
            ),
          );
        this.side.append(
          button("Remove corner", () => this.removeCorner(), "danger"),
        );
      }
      if (s.kind === "edge") {
        const a = r.points[s.index],
          b = r.points[(s.index + 1) % r.points.length];
        this.side.append(
          el("h3", {}, [
            `Wall ${s.index + 1} · ${distance(a, b).toFixed(2)} m`,
          ]),
          button("Add corner at midpoint", () => this.splitWall()),
          button("Add door here", () => {
            this.setMode("door");
            this.placeOpening(r.id, s.index, [
              (a[0] + b[0]) / 2,
              (a[1] + b[1]) / 2,
            ]);
          }),
          button("Add window here", () => {
            this.setMode("window");
            this.placeOpening(r.id, s.index, [
              (a[0] + b[0]) / 2,
              (a[1] + b[1]) / 2,
            ]);
          }),
        );
      }
      this.side.append(
        button(
          "Remove room",
          () => {
            this.selected = { kind: "room", id: r.id };
            this.removeSelected();
          },
          "danger",
        ),
      );
    }
    const rooms = el("div", { class: "floorplan-rooms" });
    for (const r of this.plan.rooms)
      rooms.append(
        button(r.name, () => {
          this.selected = { kind: "room", id: r.id };
          this.setMode("select");
        }),
      );
    if (this.plan.rooms.length)
      this.side.append(el("h3", {}, ["Rooms"]), rooms);
  }
  render() {
    if (!this.canvas) return;
    this.canvas.setAttribute("viewBox", this.box.join(" "));
    this.canvas.replaceChildren();
    const p = this.plan,
      scale = 1 / (this.canvas.getScreenCTM()?.a || 50),
      stroke = Math.max(0.025, scale * 2);
    const defs = svg("defs"),
      pattern = svg("pattern", {
        id: "draft-grid",
        width: 0.5,
        height: 0.5,
        patternUnits: "userSpaceOnUse",
      });
    pattern.append(
      svg("path", {
        d: "M .5 0 H 0 V .5",
        fill: "none",
        stroke: "#b6c4b9",
        "stroke-width": 0.008,
      }),
    );
    defs.append(pattern);
    this.canvas.append(
      defs,
      svg("rect", { x: 0, y: 0, width: 50, height: 50, fill: "#f4f5ef" }),
      svg("rect", {
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        fill: "url(#draft-grid)",
      }),
    );
    for (const r of p.rooms) {
      const selected = this.selected?.id === r.id;
      this.canvas.append(
        svg("polygon", {
          points: pointString(r.points),
          fill: selected ? "#dce8de" : "#e9eee5",
          stroke: "none",
          "data-kind": "room",
          "data-id": r.id,
          role: "button",
          tabindex: 0,
          "aria-label": `Select room ${r.name}`,
        }),
      );
      r.points.forEach((a, i) => {
        const b = r.points[(i + 1) % r.points.length],
          on =
            selected &&
            this.selected.kind === "edge" &&
            this.selected.index === i;
        this.canvas.append(
          svg("line", {
            x1: a[0],
            y1: a[1],
            x2: b[0],
            y2: b[1],
            stroke: on ? "#c88c21" : "#4c6555",
            "stroke-width": on ? 0.09 : this.cfg.wallThickness,
            "stroke-linecap": "round",
            "pointer-events": "none",
          }),
        );
        this.canvas.append(
          svg("line", {
            x1: a[0],
            y1: a[1],
            x2: b[0],
            y2: b[1],
            stroke: "transparent",
            "stroke-width": Math.max(0.2, scale * 15),
            "data-kind": "edge",
            "data-id": r.id,
            "data-index": i,
            role: "button",
            tabindex: 0,
            "aria-label": `${r.name}, wall ${i + 1}, ${distance(a, b).toFixed(2)} metres`,
          }),
        );
        this.canvas.append(
          svg(
            "text",
            {
              x: (a[0] + b[0]) / 2,
              y: (a[1] + b[1]) / 2 - 0.13,
              "font-size": Math.max(0.14, scale * 11),
              fill: "#62776a",
              "text-anchor": "middle",
              "pointer-events": "none",
            },
            `${distance(a, b).toFixed(2)} m`,
          ),
        );
      });
      const [x, z] = interiorPoint(r.points);
      this.canvas.append(
        svg(
          "text",
          {
            x,
            y: z,
            "font-size": Math.max(0.18, scale * 14),
            "font-weight": 600,
            "text-anchor": "middle",
            fill: "#415c4b",
            "pointer-events": "none",
          },
          r.name,
        ),
      );
    }
    for (const o of p.openings) {
      const { a, b, u } = openingSegment(p, o),
        selected = this.selected?.id === o.id,
        color = selected
          ? "#bb821d"
          : o.kind === "door"
            ? "#937352"
            : "#4f9fae",
        g = svg("g", {
          "data-kind": "opening",
          "data-id": o.id,
          role: "button",
          tabindex: 0,
          "aria-label": `Select ${o.kind} in ${p.rooms.find((r) => r.id === o.roomId).name}`,
        });
      g.append(
        svg("line", {
          x1: a[0],
          y1: a[1],
          x2: b[0],
          y2: b[1],
          stroke: "#f4f5ef",
          "stroke-width": this.cfg.wallThickness + 0.025,
        }),
      );
      g.append(
        svg("line", {
          x1: a[0],
          y1: a[1],
          x2: b[0],
          y2: b[1],
          stroke: color,
          "stroke-width": o.kind === "door" ? 0.035 : 0.06,
        }),
      );
      if (o.kind === "door") {
        const end = o.hinge === "end",
          h = end ? b : a,
          along = end ? u.map((v) => -v) : u,
          sign = o.swing === "out" ? -1 : 1,
          normal = [-u[1] * sign, u[0] * sign];
        const arc = Array.from({ length: 20 }, (_, i) => {
          const t = ((i / 19) * Math.PI) / 2;
          return [
            h[0] + o.width * (along[0] * Math.cos(t) + normal[0] * Math.sin(t)),
            h[1] + o.width * (along[1] * Math.cos(t) + normal[1] * Math.sin(t)),
          ];
        });
        g.append(
          svg("polyline", {
            points: pointString(arc),
            fill: "none",
            stroke: color,
            "stroke-width": stroke / 2,
            "stroke-dasharray": ".05 .035",
          }),
          svg("line", {
            x1: h[0],
            y1: h[1],
            x2: arc.at(-1)[0],
            y2: arc.at(-1)[1],
            stroke: color,
            "stroke-width": stroke,
          }),
        );
      }
      g.append(
        svg("line", {
          x1: a[0],
          y1: a[1],
          x2: b[0],
          y2: b[1],
          stroke: "transparent",
          "stroke-width": Math.max(0.25, scale * 17),
        }),
      );
      this.canvas.append(g);
    }
    for (const r of p.rooms)
      r.points.forEach((point, i) => {
        const on =
          this.selected?.id === r.id &&
          this.selected.kind === "point" &&
          this.selected.index === i;
        this.canvas.append(
          svg("circle", {
            cx: point[0],
            cy: point[1],
            r: Math.max(0.065, scale * 5),
            fill: on ? "#d8a842" : "#f7faf5",
            stroke: on ? "#b47a16" : "#506d59",
            "stroke-width": stroke,
            "data-kind": "point",
            "data-id": r.id,
            "data-index": i,
            role: "button",
            tabindex: 0,
            "aria-label": `${r.name}, corner ${i + 1}`,
          }),
        );
      });
    if (this.drawing.length) {
      const pts = [...this.drawing, ...(this.hover ? [this.hover] : [])];
      this.canvas.append(
        svg("polyline", {
          points: pointString(pts),
          fill: "none",
          stroke: "#2f8e68",
          "stroke-width": stroke * 1.5,
          "stroke-dasharray": ".1 .05",
          "pointer-events": "none",
        }),
      );
      this.drawing.forEach((p, i) =>
        this.canvas.append(
          svg("circle", {
            cx: p[0],
            cy: p[1],
            r: i === 0 ? 0.11 : 0.055,
            fill: i === 0 ? "#2f8e68" : "#fff",
            stroke: "#2f8e68",
            "stroke-width": stroke,
            "pointer-events": "none",
          }),
        ),
      );
      if (this.hover) {
        const last = this.drawing.at(-1);
        this.canvas.append(
          svg(
            "text",
            {
              x: (last[0] + this.hover[0]) / 2,
              y: (last[1] + this.hover[1]) / 2 - 0.16,
              "font-size": 0.18,
              fill: "#28734f",
              "text-anchor": "middle",
              "pointer-events": "none",
            },
            `${distance(last, this.hover).toFixed(2)} m`,
          ),
        );
      }
    }
    this.undoButton.disabled = !this.history.canUndo && !this.drawing.length;
    this.redoButton.disabled = !this.history.canRedo;
    this.apply.disabled =
      !p.rooms.length || !!this.drawing.length || !!this.drag;
  }
  applyPlan() {
    try {
      const room = floorPlanRoom(this.cfg, this.plan);
      this.onApply(room, this.keep.checked);
      closeDialog();
    } catch (e) {
      this.notice.textContent = e.message;
    }
  }
}
