import { roomPolygons, polygonArea } from "./room.js";
import { footprint, bounds, doorZones, pointInside } from "./geometry.js";
import { itemDef, CATALOG_BY_TYPE } from "./catalog.js";
import { downloadBlob } from "./store.js";
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
const points = (p) => p.map((v) => v.join(",")).join(" ");
const line = (a, b, attrs = "") =>
  `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" ${attrs}/>`;
const text = (x, y, t, attrs = "") =>
  `<text x="${x}" y="${y}" ${attrs}>${esc(t)}</text>`;
function dimension(a, b, label) {
  const vertical = a[0] === b[0];
  return `<g stroke="#829087" stroke-width=".012">${line(a, b)}${[a, b].map((p) => line([p[0] - (vertical ? 0.06 : 0), p[1] - (vertical ? 0 : 0.06)], [p[0] + (vertical ? 0.06 : 0), p[1] + (vertical ? 0 : 0.06)])).join("")}</g>${text((a[0] + b[0]) / 2 + (vertical ? -0.12 : 0), (a[1] + b[1]) / 2 - (vertical ? 0 : 0.1), label, `fill="#53635d" font-size=".18" ${vertical ? 'text-anchor="end"' : ""}`)}`;
}
export function planMarkup(
  state,
  {
    selected = new Set(),
    warnings = [],
    preview = null,
    guides = [],
    dimensions = true,
    exporting = false,
  } = {},
) {
  const r = state.room,
    p = roomPolygons(r),
    W = p.W,
    L = p.L;
  const bad = new Set(warnings.flatMap((w) => w.ids));
  let out = `<rect x="-2" y="-2" width="${W + 4}" height="${L + 4}" fill="#f4f5f0"/>`;
  for (const [name, poly] of Object.entries({
    Office: p.office,
    Kitchen: p.kitchen,
    Bathroom: p.bathroom,
  }))
    if (poly) {
      out += `<polygon points="${points(poly)}" fill="${name === "Office" ? "#fffefa" : "#eef1e9"}" stroke="#3e5148" stroke-width=".07" stroke-linejoin="round"/>`;
      const b = bounds(poly);
      out += text(
        (b.left + b.right) / 2,
        name === "Office" ? (L - p.nd) * 0.55 : (b.top + b.bottom) / 2,
        `${name} · ${polygonArea(poly).toFixed(1)} m²`,
        'fill="#9aa69e" font-size=".18"',
      );
    }
  // Thin metre grid confined to the office's L-shaped outline.
  out += `<defs><clipPath id="office-clip"><polygon points="${points(p.office)}"/></clipPath></defs><g clip-path="url(#office-clip)" stroke="#9baa9e" stroke-opacity=".14" stroke-width=".008">`;
  for (let x = 0.5; x < W; x += 0.5) out += line([x, 0], [x, L]);
  for (let z = 0.5; z < L; z += 0.5) out += line([0, z], [W, z]);
  out += "</g>";
  out += line([0.08, 0], [W - 0.08, 0], 'stroke="#8ec3c9" stroke-width=".055"');
  out += text(
    W / 2,
    0.23,
    "WINDOW",
    'fill="#72949a" font-size=".14" letter-spacing=".03"',
  );
  for (const door of doorZones(r)) {
    const h = door.hinge,
      end = [
        h[0] + door.along[0] * door.width,
        h[1] + door.along[1] * door.width,
      ],
      open = door.polygon.at(-1);
    out += line(h, end, 'stroke="#fffefa" stroke-width=".13"');
    out += `<polyline points="${points(door.polygon.slice(1))}" fill="none" stroke="#7c8f85" stroke-width=".015" stroke-dasharray=".045 .025"/>${line(h, open, 'stroke="#4c6758" stroke-width=".025"')}`;
  }
  const sorted = [...state.items].sort(
    (a, b) =>
      (a.elevation || 0) +
      (CATALOG_BY_TYPE[a.type]?.passable ? -1 : 0) -
      ((b.elevation || 0) + (CATALOG_BY_TYPE[b.type]?.passable ? -1 : 0)),
  );
  for (const it of sorted) {
    const def = itemDef(CATALOG_BY_TYPE[it.type], it),
      sel = selected.has(it.id),
      warn = bad.has(it.id) && !exporting;
    const stroke = sel ? "#bc8512" : warn ? "#ce5963" : "#63776b";
    out += `<g data-item="${esc(it.id)}" role="button" tabindex="0" aria-label="${esc(def.name + " at " + it.x.toFixed(2) + ", " + it.z.toFixed(2) + " metres")}" transform="translate(${it.x} ${it.z}) rotate(${-(it.rot || 0)})" style="cursor:move"><title>${esc(def.name)}</title><rect x="${-def.w / 2}" y="${-def.d / 2}" width="${def.w}" height="${def.d}" rx=".035" fill="${sel ? "#f8e7bb" : def.passable ? "#ede6d9" : "#dce5db"}" fill-opacity="${def.passable ? 0.65 : 1}" stroke="${stroke}" stroke-width="${sel ? 0.035 : 0.018}"/>`;
    // Orientation mark and furniture detail make the silhouette legible at a glance.
    if (def.cat === "Seating")
      out += `<path d="M ${-def.w * 0.4} ${-def.d * 0.35} H ${def.w * 0.4}" stroke="${stroke}" stroke-width=".07" fill="none"/>`;
    else if (def.cat === "Storage" || def.cat === "Kitchen")
      out += line(
        [0, -def.d / 2],
        [0, def.d / 2],
        `stroke="${stroke}" stroke-width=".012"`,
      );
    else if (def.cat === "Work" && !def.stackable)
      out += line(
        [-def.w * 0.4, def.d * 0.35],
        [def.w * 0.4, def.d * 0.35],
        `stroke="${stroke}" stroke-width=".015"`,
      );
    if (def.w > 0.65 && def.d > 0.4 && !def.passable)
      out += text(
        0,
        0.035,
        def.name,
        `font-size=".16" fill="#40554a" pointer-events="none"`,
      );
    out += "</g>";
  }
  if (preview)
    out += `<polygon points="${points(footprint(preview.data, preview.def))}" fill="${preview.valid ? "#4aaa85" : "#d65461"}" fill-opacity=".35" stroke="${preview.valid ? "#319674" : "#d65461"}" stroke-width=".025" stroke-dasharray=".08 .04" pointer-events="none"/>`;
  for (const g of guides)
    out += line(
      g.axis === "x" ? [g.at, 0] : [0, g.at],
      g.axis === "x" ? [g.at, L] : [W, g.at],
      'stroke="#cf972a" stroke-width=".015" stroke-dasharray=".07 .04" pointer-events="none"',
    );
  if (dimensions) {
    out +=
      dimension([0, -0.4], [W, -0.4], `${W.toFixed(2)} m`) +
      dimension([-0.4, 0], [-0.4, L], `${L.toFixed(2)} m`) +
      dimension(
        [0, L + 0.4],
        [W - p.nw, L + 0.4],
        `${(W - p.nw).toFixed(2)} m`,
      );
    for (let x = 0; x <= W; x += 0.5)
      out +=
        line(
          [x, -0.65],
          [x, -0.65 - (Number.isInteger(x) ? 0.08 : 0.04)],
          'stroke="#a4b0a7" stroke-width=".012"',
        ) +
        (Number.isInteger(x)
          ? text(x, -0.82, x, 'font-size=".14" fill="#8b9a8f"')
          : "");
    for (let z = 0; z <= L; z += 0.5)
      out +=
        line(
          [-0.75, z],
          [-0.75 - (Number.isInteger(z) ? 0.08 : 0.04), z],
          'stroke="#a4b0a7" stroke-width=".012"',
        ) +
        (Number.isInteger(z)
          ? text(-0.98, z + 0.035, z, 'font-size=".14" fill="#8b9a8f"')
          : "");
    if (selected.size === 1) {
      const it = state.items.find((it) => selected.has(it.id));
      if (it) {
        const b = bounds(footprint(it, itemDef(CATALOG_BY_TYPE[it.type], it))),
          poly = [p.office, p.kitchen, p.bathroom]
            .filter(Boolean)
            .find((poly) => pointInside([it.x, it.z], poly));
        if (poly) {
          const xs = [],
            zs = [];
          for (let i = 0; i < poly.length; i++) {
            const a = poly[i],
              v = poly[(i + 1) % poly.length];
            if (
              a[0] === v[0] &&
              it.z >= Math.min(a[1], v[1]) &&
              it.z <= Math.max(a[1], v[1])
            )
              xs.push(a[0]);
            if (
              a[1] === v[1] &&
              it.x >= Math.min(a[0], v[0]) &&
              it.x <= Math.max(a[0], v[0])
            )
              zs.push(a[1]);
          }
          const left = Math.max(...xs.filter((v) => v <= b.left)),
            right = Math.min(...xs.filter((v) => v >= b.right)),
            top = Math.max(...zs.filter((v) => v <= b.top)),
            bottom = Math.min(...zs.filter((v) => v >= b.bottom));
          for (const [a, c] of [
            [
              [left, it.z],
              [b.left, it.z],
            ],
            [
              [b.right, it.z],
              [right, it.z],
            ],
            [
              [it.x, top],
              [it.x, b.top],
            ],
            [
              [it.x, b.bottom],
              [it.x, bottom],
            ],
          ])
            if ([...a, ...c].every(Number.isFinite)) {
              const dist = Math.hypot(a[0] - c[0], a[1] - c[1]);
              if (dist > 0.15) out += dimension(a, c, `${dist.toFixed(2)} m`);
            }
        }
      }
    }
  }
  return `<g font-family="Arial, sans-serif" text-anchor="middle">${out}</g>`;
}
export function planSVG(state, options = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="${Math.round((1400 * (state.room.length + 2.2)) / (state.room.width + 2.6))}" viewBox="-1.3 -1.1 ${state.room.width + 2.6} ${state.room.length + 2.2}">${planMarkup(state, { exporting: true, ...options })}</svg>`;
}
export async function exportPlan(state, format) {
  const svg = planSVG(state);
  if (format === "svg")
    return downloadBlob(
      new Blob([svg], { type: "image/svg+xml" }),
      "offiz-floor-plan.svg",
    );
  const image = new Image(),
    url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = url;
    });
    const c = document.createElement("canvas");
    c.width = 2000;
    c.height = Math.round((2000 * image.height) / image.width);
    c.getContext("2d").drawImage(image, 0, 0, c.width, c.height);
    const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Image export failed.");
    downloadBlob(blob, "offiz-floor-plan.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
export class PlanView {
  constructor(root, editor, getState, getWarnings) {
    Object.assign(this, { root, editor, getState, getWarnings });
    this.box = null;
    this.dimensions = true;
    root.addEventListener("pointerdown", (e) => this.down(e));
    root.addEventListener("pointermove", (e) => this.move(e));
    root.addEventListener("pointerup", () => {
      if (this.moving) {
        editor.finishDrag();
        this.moving = false;
      }
      this.pan = null;
    });
    root.addEventListener("pointercancel", () => {
      editor.finishDrag(true);
      this.moving = false;
      this.pan = null;
    });
    root.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const p = this.point(e),
          factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
        if (this.box[2] * factor < 2 || this.box[2] * factor > 100) return;
        this.box = [
          p.x + (this.box[0] - p.x) * factor,
          p.y + (this.box[1] - p.y) * factor,
          this.box[2] * factor,
          this.box[3] * factor,
        ];
        this.render();
      },
      { passive: false },
    );
    root.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.dataset.item) {
        e.preventDefault();
        editor.select(
          editor.items.get(e.target.dataset.item),
          true,
          e.shiftKey,
        );
      }
    });
  }
  fit() {
    const r = this.getState().room;
    this.box = [-1.3, -1.1, r.width + 2.6, r.length + 2.2];
    this.render();
  }
  point(e) {
    return new DOMPoint(e.clientX, e.clientY).matrixTransform(
      this.root.getScreenCTM().inverse(),
    );
  }
  down(e) {
    if (e.button !== 0 || !this.editor.enabled) return;
    const p = this.point(e);
    if (this.editor.preview) {
      this.editor.updatePlacement(p.x, p.y);
      this.editor.placePreview();
      return;
    }
    const id = e.target.closest("[data-item]")?.dataset.item;
    if (id) {
      const g = this.editor.items.get(id);
      if (e.shiftKey) {
        this.editor.select(g, true, true);
        return;
      }
      if (!this.editor.selectedIds.has(id)) this.editor.select(g);
      this.editor.beginDrag(p.x, p.y, "plan");
      this.moving = true;
    } else {
      this.editor.select(null);
      this.pan = { x: e.clientX, y: e.clientY, box: [...this.box] };
    }
    this.root.setPointerCapture(e.pointerId);
  }
  move(e) {
    if (!this.editor.enabled) return;
    const p = this.point(e);
    if (this.editor.preview) this.editor.updatePlacement(p.x, p.y);
    else if (this.moving) this.editor.dragTo(p.x, p.y);
    else if (this.pan) {
      const m = this.root.getScreenCTM();
      this.box = [
        this.pan.box[0] - (e.clientX - this.pan.x) / m.a,
        this.pan.box[1] - (e.clientY - this.pan.y) / m.d,
        ...this.pan.box.slice(2),
      ];
      this.render();
    }
  }
  render() {
    if (!this.box) return this.fit();
    this.root.setAttribute("viewBox", this.box.join(" "));
    this.root.innerHTML = planMarkup(this.getState(), {
      selected: this.editor.selectedIds,
      warnings: this.getWarnings(),
      preview: this.editor.preview,
      guides: this.editor.guides,
      dimensions: this.dimensions,
    });
  }
}
