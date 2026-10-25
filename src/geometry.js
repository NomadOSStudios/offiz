// Shared geometry for numeric edits, dragging, plan drawing and layout checks.
import { customDoorZones } from "./floorplan-model.js";
const EPS = 1e-6;
export function footprint(item, def) {
  const a = ((item.rot || 0) * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a);
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([x, z]) => {
    x *= def.w / 2;
    z *= def.d / 2;
    return [item.x + x * c + z * s, item.z - x * s + z * c];
  });
}
export function pointInside(p, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j],
      b = poly[i],
      cross = (p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0]);
    if (
      Math.abs(cross) < EPS &&
      p[0] >= Math.min(a[0], b[0]) - EPS &&
      p[0] <= Math.max(a[0], b[0]) + EPS &&
      p[1] >= Math.min(a[1], b[1]) - EPS &&
      p[1] <= Math.max(a[1], b[1]) + EPS
    )
      return true;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export function contained(shape, poly) {
  if (!shape.every((p) => pointInside(p, poly))) return false;
  // Corner-only checks miss a long item bridging the concave office notch.
  for (let i = 0; i < shape.length; i++) {
    const a = shape[i],
      b = shape[(i + 1) % shape.length];
    if (!pointInside([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], poly))
      return false;
    for (let j = 0; j < poly.length; j++) {
      const c = poly[j],
        d = poly[(j + 1) % poly.length];
      if (
        cross(a, b, c) * cross(a, b, d) < -EPS &&
        cross(c, d, a) * cross(c, d, b) < -EPS
      )
        return false;
    }
  }
  return true;
}
// Separating-axis test; touching edges are allowed. Inputs are convex.
export function overlaps(a, b) {
  for (const p of [a, b])
    for (let i = 0; i < p.length; i++) {
      const q = p[(i + 1) % p.length],
        axis = [-(q[1] - p[i][1]), q[0] - p[i][0]];
      const av = a.map((v) => v[0] * axis[0] + v[1] * axis[1]),
        bv = b.map((v) => v[0] * axis[0] + v[1] * axis[1]);
      if (
        Math.max(...av) <= Math.min(...bv) + EPS ||
        Math.max(...bv) <= Math.min(...av) + EPS
      )
        return false;
    }
  return true;
}
export function bounds(points) {
  return {
    left: Math.min(...points.map((p) => p[0])),
    right: Math.max(...points.map((p) => p[0])),
    top: Math.min(...points.map((p) => p[1])),
    bottom: Math.max(...points.map((p) => p[1])),
  };
}
export function doorZones(cfg) {
  if (cfg.floorPlan) return customDoorZones(cfg.floorPlan);
  const W = cfg.width,
    L = cfg.length,
    nw = cfg.notch.width,
    nd = cfg.notch.depth,
    bw = cfg.bathroom.width;
  const ed = cfg.entranceDoor,
    kd = cfg.kitchenDoor,
    bd = cfg.bathroom.door;
  const defs = [
    {
      name: "Entrance",
      hinge: [ed.from + ed.width, L],
      along: [-1, 0],
      inward: [0, -1],
      width: ed.width,
    },
    {
      name: "Kitchen door",
      hinge: [W - nw + 0.05, L - nd + kd.from],
      along: [0, 1],
      inward: [-1, 0],
      width: kd.width,
    },
  ];
  if (bw > 0.3)
    defs.push({
      name: "Bathroom door",
      hinge: [W - bw, L - nd + 0.1 + bd.from + bd.width],
      along: [0, -1],
      inward: [-1, 0],
      width: bd.width,
    });
  return defs.map((d) => ({
    ...d,
    polygon: [
      d.hinge,
      ...Array.from({ length: 25 }, (_, i) => {
        const a = ((i / 24) * Math.PI) / 2;
        return [
          d.hinge[0] +
            d.width * (d.along[0] * Math.cos(a) + d.inward[0] * Math.sin(a)),
          d.hinge[1] +
            d.width * (d.along[1] * Math.cos(a) + d.inward[1] * Math.sin(a)),
        ];
      }),
    ],
  }));
}
export function layoutWarnings(items, getDef, polygons, cfg) {
  const warnings = [],
    shapes = items.map((it) => footprint(it, getDef(it)));
  items.forEach((it, i) => {
    const d = getDef(it);
    if (
      !Object.values(polygons)
        .filter(Boolean)
        .some((p) => contained(shapes[i], p)) ||
      (it.elevation || 0) + d.h > cfg.ceiling + 0.001
    )
      warnings.push({
        ids: [it.id],
        message: `${d.name} is outside the room envelope.`,
      });
    if (d.passable) return;
    for (const door of doorZones(cfg))
      if (
        (it.elevation || 0) < (door.height || 2.1) &&
        overlaps(shapes[i], door.polygon)
      )
        warnings.push({
          ids: [it.id],
          message: `${d.name} intersects the ${door.name.toLowerCase()} swing.`,
        });
    for (let j = i + 1; j < items.length; j++) {
      const other = items[j],
        od = getDef(other);
      if (
        od.passable ||
        Math.min((it.elevation || 0) + d.h, (other.elevation || 0) + od.h) -
          Math.max(it.elevation || 0, other.elevation || 0) <
          0.025
      )
        continue;
      if (overlaps(shapes[i], shapes[j]))
        warnings.push({
          ids: [it.id, other.id],
          message: `${d.name} overlaps ${od.name.toLowerCase()}.`,
        });
    }
  });
  return warnings;
}
