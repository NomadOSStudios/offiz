// Serializable floor-plan geometry. Room polygons follow wall centre lines;
// placement polygons are inset to the inner wall faces. All distances are metres.
const EPS = 1e-6;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const cross = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
export const planId = () =>
  `p${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
export const signedArea = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0) / 2;
export function projectPoint(p, a, b) {
  const length = dist(a, b),
    ux = (b[0] - a[0]) / length,
    uz = (b[1] - a[1]) / length;
  const along = (p[0] - a[0]) * ux + (p[1] - a[1]) * uz,
    t = Math.max(0, Math.min(length, along));
  const point = [a[0] + ux * t, a[1] + uz * t];
  return { point, along, length, distance: dist(p, point), u: [ux, uz] };
}
export function inside(p, poly, boundary = true) {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j],
      b = poly[i];
    if (projectPoint(p, a, b).distance < EPS) return boundary;
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function intersects(a, b, c, d) {
  const x = cross(a, b, c),
    y = cross(a, b, d),
    z = cross(c, d, a),
    w = cross(c, d, b);
  return (
    (x * y < -EPS && z * w < -EPS) ||
    [
      [a, c, d],
      [b, c, d],
      [c, a, b],
      [d, a, b],
    ].some(([p, q, r]) => projectPoint(p, q, r).distance < EPS)
  );
}
export function interiorPoint(poly) {
  const xs = poly.map((p) => p[0]),
    zs = poly.map((p) => p[1]),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minZ = Math.min(...zs),
    maxZ = Math.max(...zs);
  let best = poly[0],
    clearance = -1;
  for (let i = 0; i < 13; i++)
    for (let j = 0; j < 13; j++) {
      const p = [
        minX + ((maxX - minX) * (i + 0.5)) / 13,
        minZ + ((maxZ - minZ) * (j + 0.5)) / 13,
      ];
      if (!inside(p, poly, false)) continue;
      const d = Math.min(
        ...poly.map(
          (a, k) => projectPoint(p, a, poly[(k + 1) % poly.length]).distance,
        ),
      );
      if (d > clearance) {
        best = p;
        clearance = d;
      }
    }
  return best;
}
export function insetPolygon(poly, amount) {
  const lines = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length],
      l = dist(a, b),
      u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    return { a: [a[0] - u[1] * amount, a[1] + u[0] * amount], u };
  });
  return lines.map((b, i) => {
    const a = lines[(i + lines.length - 1) % lines.length],
      den = a.u[0] * b.u[1] - a.u[1] * b.u[0];
    if (Math.abs(den) < EPS) return b.a;
    const delta = [b.a[0] - a.a[0], b.a[1] - a.a[1]],
      t = (delta[0] * b.u[1] - delta[1] * b.u[0]) / den;
    return [a.a[0] + a.u[0] * t, a.a[1] + a.u[1] * t];
  });
}
export function legacyFloorPlan(cfg) {
  const W = cfg.width,
    L = cfg.length,
    nw = cfg.notch.width,
    nd = cfg.notch.depth,
    bw = cfg.bathroom.width;
  const rooms = [
    {
      id: "office",
      name: "Office",
      floor: cfg.floor,
      points: [
        [0, 0],
        [W, 0],
        [W, L - nd],
        [W - nw, L - nd],
        [W - nw, L],
        [0, L],
      ],
    },
    {
      id: "kitchen",
      name: "Kitchen",
      floor: cfg.kitchenFloor,
      points: [
        [W - nw, L - nd],
        [W - bw, L - nd],
        [W - bw, L],
        [W - nw, L],
      ],
    },
  ];
  if (bw > 0)
    rooms.push({
      id: "bathroom",
      name: "Bathroom",
      floor: cfg.bathroom.floor,
      points: [
        [W - bw, L - nd],
        [W, L - nd],
        [W, L],
        [W - bw, L],
      ],
    });
  const ed = cfg.entranceDoor,
    kd = cfg.kitchenDoor,
    bd = cfg.bathroom.door;
  const openings = [
    {
      id: "window",
      kind: "window",
      roomId: "office",
      edge: 0,
      from: 0.08,
      width: W - 0.16,
      sill: cfg.window.sill,
      height: cfg.window.top - cfg.window.sill,
    },
    {
      id: "entrance",
      kind: "door",
      roomId: "office",
      edge: 4,
      from: W - nw - ed.from - ed.width,
      width: ed.width,
      height: ed.height,
      hinge: "start",
      swing: "in",
    },
    {
      id: "kitchen-door",
      kind: "door",
      roomId: "kitchen",
      edge: 3,
      from: nd - kd.from - kd.width,
      width: kd.width,
      height: kd.height,
      hinge: "end",
      swing: "out",
    },
  ];
  if (bw > 0)
    openings.push({
      id: "bath-door",
      kind: "door",
      roomId: "bathroom",
      edge: 3,
      from: nd - 0.1 - bd.from - bd.width,
      width: bd.width,
      height: bd.height,
      hinge: "start",
      swing: "out",
    });
  return { version: 1, rooms, openings };
}
export function openingSegment(plan, o) {
  const r = plan.rooms.find((r) => r.id === o.roomId),
    a = r.points[o.edge],
    b = r.points[(o.edge + 1) % r.points.length],
    l = dist(a, b),
    u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  return {
    a: [a[0] + u[0] * o.from, a[1] + u[1] * o.from],
    b: [a[0] + u[0] * (o.from + o.width), a[1] + u[1] * (o.from + o.width)],
    u,
    room: r,
  };
}
const wallCache = new WeakMap();
export function planWalls(plan) {
  if (wallCache.has(plan)) return wallCache.get(plan);
  const vertices = plan.rooms.flatMap((r) => r.points),
    map = new Map();
  for (const room of plan.rooms)
    room.points.forEach((a, edge) => {
      const b = room.points[(edge + 1) % room.points.length],
        l = dist(a, b),
        u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
      const ts = [
        0,
        l,
        ...vertices
          .map((p) => projectPoint(p, a, b))
          .filter((p) => p.distance < EPS && p.along > EPS && p.along < l - EPS)
          .map((p) => p.along),
      ]
        .sort((a, b) => a - b)
        .filter((v, i, all) => !i || v - all[i - 1] > EPS);
      for (let j = 0; j < ts.length - 1; j++) {
        const p = [a[0] + u[0] * ts[j], a[1] + u[1] * ts[j]],
          q = [a[0] + u[0] * ts[j + 1], a[1] + u[1] * ts[j + 1]];
        const key = [p, q]
          .map((p) => p.map((v) => v.toFixed(5)).join(","))
          .sort()
          .join(":");
        if (!map.has(key))
          map.set(key, {
            id: `wall:${key}`,
            a: p,
            b: q,
            length: ts[j + 1] - ts[j],
            owners: [],
            openings: [],
          });
        map.get(key).owners.push({ roomId: room.id, edge });
      }
    });
  const walls = [...map.values()];
  for (const o of plan.openings) {
    const seg = openingSegment(plan, o),
      m = [(seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2];
    const wall = walls.find(
      (w) =>
        projectPoint(m, w.a, w.b).distance < EPS &&
        projectPoint(seg.a, w.a, w.b).distance < EPS &&
        projectPoint(seg.b, w.a, w.b).distance < EPS,
    );
    if (!wall) continue;
    const from = projectPoint(seg.a, wall.a, wall.b).along,
      to = projectPoint(seg.b, wall.a, wall.b).along,
      reversed = from > to;
    wall.openings.push({
      ...o,
      from: Math.min(from, to),
      to: Math.max(from, to),
      bottom: o.kind === "door" ? 0 : o.sill,
      top: (o.kind === "door" ? 0 : o.sill) + o.height,
      hinge: reversed
        ? o.hinge === "end"
          ? "start"
          : "end"
        : o.hinge || "start",
      swing: reversed ? (o.swing === "out" ? "in" : "out") : o.swing || "in",
      open: true,
    });
  }
  wallCache.set(plan, walls);
  return walls;
}
export function validateFloorPlan(raw, ceiling = 2.7, thickness = 0.15) {
  const fail = (m) => {
    throw new Error(m);
  };
  if (
    !raw ||
    raw.version !== 1 ||
    !Array.isArray(raw.rooms) ||
    !Array.isArray(raw.openings)
  )
    fail("Invalid floor-plan file.");
  if (raw.rooms.length < 1 || raw.rooms.length > 30)
    fail("Draw between 1 and 30 rooms.");
  if (raw.openings.length > 150)
    fail("A floor plan can have at most 150 openings.");
  const ids = new Set(),
    id = (v) => {
      if (typeof v !== "string" || !v || v.length > 80 || ids.has(v))
        fail("Floor-plan IDs must be unique.");
      ids.add(v);
      return v;
    };
  const plan = {
    version: 1,
    rooms: raw.rooms.map((r) => ({
      id: id(r.id),
      name: String(r.name || "Room").slice(0, 60),
      floor: r.floor,
      points: r.points?.map((p) => (Array.isArray(p) ? [p[0], p[1]] : null)),
    })),
    openings: raw.openings.map((o) => ({
      id: id(o.id),
      roomId: o.roomId,
      edge: o.edge,
      kind: o.kind,
      from: o.from,
      width: o.width,
      height: o.height,
      sill: o.kind === "window" ? o.sill : 0,
      hinge: o.hinge || "start",
      swing: o.swing || "in",
    })),
  };
  for (const r of plan.rooms) {
    const p = r.points;
    if (!Array.isArray(p) || p.length < 3 || p.length > 60)
      fail("Each room needs 3–60 corners.");
    if (
      p.some((v) => !v || v.some((n) => !Number.isFinite(n) || n < 0 || n > 50))
    )
      fail("Keep corners within the 50 × 50 metre drawing area.");
    if (signedArea(p) <= 0.25)
      fail("Rooms must be clockwise, with at least 0.25 m² of floor space.");
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length];
      if (dist(a, b) < Math.max(0.2, thickness * 1.5))
        fail(`${r.name}: walls are too short.`);
      for (let j = i + 1; j < p.length; j++) {
        if (j === i + 1 || (i === 0 && j === p.length - 1)) continue;
        if (intersects(a, b, p[j], p[(j + 1) % p.length]))
          fail(`${r.name}: walls must not cross or touch themselves.`);
      }
    }
    const inner = insetPolygon(p, thickness / 2);
    if (signedArea(inner) <= 0.05 || inner.some((v) => !inside(v, p)))
      fail(`${r.name}: this room is too narrow for the wall thickness.`);
    for (let i = 0; i < inner.length; i++)
      for (let j = i + 2; j < inner.length; j++) {
        if (i === 0 && j === inner.length - 1) continue;
        if (
          intersects(
            inner[i],
            inner[(i + 1) % inner.length],
            inner[j],
            inner[(j + 1) % inner.length],
          )
        )
          fail(`${r.name}: this room is too narrow for the wall thickness.`);
      }
  }
  for (let i = 0; i < plan.rooms.length; i++)
    for (let j = i + 1; j < plan.rooms.length; j++) {
      const a = plan.rooms[i],
        b = plan.rooms[j];
      const samples = (p) =>
        p.flatMap((v, k) => [
          v,
          [
            (v[0] + p[(k + 1) % p.length][0]) / 2,
            (v[1] + p[(k + 1) % p.length][1]) / 2,
          ],
        ]);
      const crosses = a.points.some((v, k) =>
        b.points.some(
          (q, l) =>
            cross(v, a.points[(k + 1) % a.points.length], q) *
              cross(
                v,
                a.points[(k + 1) % a.points.length],
                b.points[(l + 1) % b.points.length],
              ) <
              -EPS &&
            cross(q, b.points[(l + 1) % b.points.length], v) *
              cross(
                q,
                b.points[(l + 1) % b.points.length],
                a.points[(k + 1) % a.points.length],
              ) <
              -EPS,
        ),
      );
      if (
        crosses ||
        samples(a.points).some((p) => inside(p, b.points, false)) ||
        samples(b.points).some((p) => inside(p, a.points, false)) ||
        inside(interiorPoint(a.points), b.points, false)
      )
        fail(
          `${a.name} and ${b.name} overlap. Rooms may share a wall, but not floor space.`,
        );
    }
  for (const o of plan.openings) {
    const room = plan.rooms.find((r) => r.id === o.roomId);
    if (
      !room ||
      !Number.isInteger(o.edge) ||
      o.edge < 0 ||
      o.edge >= room.points.length
    )
      fail("An opening is missing its wall.");
    if (
      !["door", "window"].includes(o.kind) ||
      !["start", "end"].includes(o.hinge) ||
      !["in", "out"].includes(o.swing)
    )
      fail("Invalid opening type or swing.");
    if (![o.from, o.width, o.height, o.sill].every(Number.isFinite))
      fail("Opening dimensions must be numbers.");
    const len = dist(
      room.points[o.edge],
      room.points[(o.edge + 1) % room.points.length],
    );
    if (
      o.width < (o.kind === "door" ? 0.6 : 0.25) ||
      o.from < 0.05 - EPS ||
      o.from + o.width > len - 0.05 + EPS
    )
      fail(
        `${room.name}: the ${o.kind} must fit on its wall, with 5 cm at each end.`,
      );
    if (
      o.height < (o.kind === "door" ? 1.8 : 0.2) ||
      o.sill < 0 ||
      o.sill + o.height > ceiling - 0.05 + EPS
    )
      fail(`Keep the ${o.kind} below the ceiling.`);
  }
  const walls = planWalls(plan);
  if (walls.reduce((n, w) => n + w.openings.length, 0) !== plan.openings.length)
    fail("An opening crosses a room junction. Move it onto one wall segment.");
  for (const w of walls) {
    if (w.owners.length > 2) fail("More than two rooms share a wall.");
    w.openings.sort((a, b) => a.from - b.from);
    for (let i = 1; i < w.openings.length; i++)
      if (w.openings[i].from < w.openings[i - 1].to + 0.05 - EPS)
        fail("Leave at least 5 cm between openings on the same wall.");
  }
  return plan;
}
export function floorPlanRoom(cfg, draft) {
  const plan = validateFloorPlan(draft, cfg.ceiling, cfg.wallThickness),
    points = plan.rooms.flatMap((r) => r.points);
  return {
    ...cfg,
    floorPlan: plan,
    width: Math.max(2, ...points.map((p) => p[0])),
    length: Math.max(2, ...points.map((p) => p[1])),
  };
}
export function customDoorZones(plan) {
  return plan.openings
    .filter((o) => o.kind === "door")
    .map((o) => {
      const { a, b, u, room } = openingSegment(plan, o),
        end = o.hinge === "end",
        sign = o.swing === "out" ? -1 : 1,
        hinge = end ? b : a,
        along = end ? u.map((v) => -v) : u,
        inward = [-u[1] * sign, u[0] * sign];
      return {
        name: `${room.name} door`,
        height: o.height,
        hinge,
        along,
        inward,
        width: o.width,
        polygon: [
          hinge,
          ...Array.from({ length: 25 }, (_, i) => {
            const t = (i * Math.PI) / 48;
            return [
              hinge[0] +
                o.width * (along[0] * Math.cos(t) + inward[0] * Math.sin(t)),
              hinge[1] +
                o.width * (along[1] * Math.cos(t) + inward[1] * Math.sin(t)),
            ];
          }),
        ],
      };
    });
}
export function walkablePlan(plan, p, thickness, margin = 0.13) {
  if (!plan.rooms.some((r) => inside(p, r.points))) return false;
  for (const w of planWalls(plan)) {
    const q = projectPoint(p, w.a, w.b);
    if (q.distance >= thickness / 2 + margin) continue;
    if (
      !w.openings.some(
        (o) =>
          o.kind === "door" &&
          q.along > o.from + margin &&
          q.along < o.to - margin,
      )
    )
      return false;
  }
  return true;
}
