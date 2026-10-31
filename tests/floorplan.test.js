import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultRoom,
  defaultState,
  normalizeState,
  legacyRoomDefaults,
} from "../src/store.js";
import {
  legacyFloorPlan,
  validateFloorPlan,
  floorPlanRoom,
  planWalls,
  insetPolygon,
  interiorPoint,
  inside,
  customDoorZones,
  walkablePlan,
} from "../src/floorplan-model.js";
import { roomPolygons } from "../src/room.js";
import { contained, footprint, layoutWarnings } from "../src/geometry.js";
import { CATALOG_BY_TYPE, itemDef } from "../src/catalog.js";
import { planSVG } from "../src/plan.js";
import { History } from "../src/history.js";
const room = (id, points) => ({ id, name: id, floor: "oak", points });
const rectangle = () => ({
  version: 1,
  rooms: [
    room("Studio", [
      [0, 0],
      [6, 0],
      [6, 4],
      [0, 4],
    ]),
  ],
  openings: [],
});
const door = (extra = {}) => ({
  id: "door",
  roomId: "Studio",
  edge: 1,
  from: 1,
  width: 0.9,
  height: 2.1,
  sill: 0,
  kind: "door",
  hinge: "start",
  swing: "in",
  ...extra,
});
const adjacent = () => ({
  version: 1,
  rooms: [
    room("Studio", [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
    ]),
    room("Meeting", [
      [4, 0],
      [7, 0],
      [7, 4],
      [4, 4],
    ]),
  ],
  openings: [door()],
});

test("a legacy parametric room converts without losing its openings", () => {
  const p = validateFloorPlan(legacyFloorPlan(legacyRoomDefaults));
  assert.equal(p.rooms.length, 3);
  assert.equal(p.openings.length, 4);
  const walls = planWalls(p);
  assert.equal(walls.filter((w) => w.owners.length === 2).length, 4);
  assert.equal(
    walls.reduce((n, w) => n + w.openings.length, 0),
    4,
  );
});
test("concave and angled room plans validate and have usable inner faces", () => {
  const p = rectangle();
  p.rooms[0].points = [
    [0, 0],
    [6, 0],
    [6, 2],
    [4, 2],
    [4, 4],
    [2, 5],
    [0, 4],
  ];
  const valid = validateFloorPlan(p),
    inner = insetPolygon(valid.rooms[0].points, 0.075);
  assert.ok(inside(interiorPoint(inner), inner));
  assert.ok(inner.every((p) => inside(p, valid.rooms[0].points)));
  assert.ok(
    contained(footprint({ x: 2, z: 2, rot: 0 }, { w: 1, d: 1 }), inner),
  );
  assert.equal(
    contained(footprint({ x: 5, z: 3, rot: 0 }, { w: 1, d: 1 }), inner),
    false,
  );
});
test("crossed, overlapping, duplicate, too narrow and non-finite room geometry is rejected", () => {
  for (const points of [
    [
      [0, 0],
      [4, 4],
      [0, 4],
      [4, 0],
    ],
    [
      [0, 0],
      [4, 0],
      [4, 0.12],
      [0, 0.12],
    ],
    [
      [0, 0],
      [4, 0],
      [NaN, 4],
      [0, 4],
    ],
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [2, 0],
      [0, 4],
    ],
    // A narrow connecting corridor must not produce a crossed inset floor.
    [
      [0, 0],
      [2, 0],
      [2, 1],
      [4, 1],
      [4, 0],
      [6, 0],
      [6, 3],
      [4, 3],
      [4, 1.1],
      [2, 1.1],
      [2, 3],
      [0, 3],
    ],
  ]) {
    const p = rectangle();
    p.rooms[0].points = points;
    assert.throws(() => validateFloorPlan(p));
  }
  const overlap = adjacent();
  overlap.rooms[1].points = [
    [3, 0],
    [7, 0],
    [7, 4],
    [3, 4],
  ];
  assert.throws(() => validateFloorPlan(overlap), /overlap/);
  const duplicate = rectangle();
  duplicate.rooms.push({ ...structuredClone(duplicate.rooms[0]), id: "copy" });
  assert.throws(() => validateFloorPlan(duplicate), /overlap/);
});
test("adjacent rooms build one shared wall and one opening, regardless of opening owner", () => {
  const p = validateFloorPlan(adjacent()),
    walls = planWalls(p);
  assert.equal(walls.length, 7);
  const shared = walls.find((w) => w.owners.length === 2);
  assert.equal(shared.openings.length, 1);
  const q = adjacent();
  q.openings = [
    door({ roomId: "Meeting", edge: 3, from: 2.1, hinge: "end", swing: "out" }),
  ];
  const other = planWalls(validateFloorPlan(q)).find(
    (w) => w.owners.length === 2,
  );
  assert.ok(Math.abs(other.openings[0].from - shared.openings[0].from) < 1e-6);
  assert.equal(other.openings[0].hinge, shared.openings[0].hinge);
  assert.equal(other.openings[0].swing, shared.openings[0].swing);
});
test("partial shared walls split at junctions and openings cannot span a junction", () => {
  const p = adjacent();
  p.rooms[1].points = [
    [4, 1],
    [7, 1],
    [7, 3],
    [4, 3],
  ];
  p.openings = [];
  assert.equal(planWalls(validateFloorPlan(p)).length, 9);
  p.openings = [door({ from: 0.6, width: 1.2 })];
  assert.throws(() => validateFloorPlan(p), /junction/);
});
test("openings reject wall ends, overlaps across shared owners, missing walls and ceiling overflow", () => {
  for (const patch of [
    { from: -0.1 },
    { from: 3.5 },
    { height: 2.8 },
    { roomId: "missing" },
    { edge: 99 },
    { width: Infinity },
  ]) {
    const p = rectangle();
    p.openings = [door(patch)];
    assert.throws(() => validateFloorPlan(p));
  }
  const p = adjacent();
  p.openings.push(door({ id: "other", roomId: "Meeting", edge: 3, from: 2.1 }));
  assert.throws(() => validateFloorPlan(p), /between openings/);
  const q = rectangle();
  q.openings = [door({ kind: "window", sill: 2.3, height: 0.6 })];
  assert.throws(() => validateFloorPlan(q), /ceiling/);
});
test("hinges and swing direction affect door clearances and walkthrough crosses only door gaps", () => {
  const p = validateFloorPlan(adjacent()),
    zone = customDoorZones(p)[0];
  assert.deepEqual(zone.hinge, [4, 1]);
  assert.deepEqual(zone.inward, [-1, 0]);
  assert.equal(walkablePlan(p, [4, 1.45], 0.15), true);
  assert.equal(walkablePlan(p, [4, 2.7], 0.15), false);
  assert.equal(walkablePlan(p, [-0.2, 1], 0.15), false);
  assert.equal(walkablePlan(p, [4, 1.05], 0.15), false);
  const q = adjacent();
  q.openings[0].hinge = "end";
  q.openings[0].swing = "out";
  const flipped = customDoorZones(validateFloorPlan(q))[0];
  assert.deepEqual(flipped.hinge, [4, 1.9]);
  assert.equal(flipped.inward[0], 1);
});
test("custom plans survive JSON round trips and history while legacy files keep their old room schema", () => {
  const initial = {
      ...defaultState(),
      room: structuredClone(legacyRoomDefaults),
    },
    state = { ...initial, room: floorPlanRoom(defaultRoom, adjacent()) };
  const restored = normalizeState(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.room.floorPlan, state.room.floorPlan);
  assert.equal(restored.room.width, 7);
  assert.equal(restored.room.length, 4);
  const old = normalizeState(initial);
  assert.equal(old.room.floorPlan, undefined);
  const h = new History(initial);
  h.record(state);
  assert.equal(h.undo().room.floorPlan, undefined);
  assert.equal(h.redo().room.floorPlan.rooms.length, 2);
  assert.throws(
    () =>
      normalizeState({
        ...state,
        room: {
          ...state.room,
          floorPlan: {
            ...state.room.floorPlan,
            rooms: [{ ...state.room.floorPlan.rooms[0], floor: "missing" }],
          },
        },
      }),
    /floor finish/,
  );
});
test("custom plan exports and diagnostics use the drawn rooms and openings", () => {
  const cfg = floorPlanRoom(defaultRoom, adjacent()),
    p = roomPolygons(cfg);
  assert.deepEqual(Object.keys(p.polygons), ["Studio", "Meeting"]);
  const items = [
    { id: "desk", type: "desk", x: 3.2, z: 1.5, rot: 0 },
    { id: "outside", type: "plantSmall", x: 8, z: 2, rot: 0 },
  ];
  const warnings = layoutWarnings(
    items,
    (it) => itemDef(CATALOG_BY_TYPE[it.type], it),
    p.polygons,
    cfg,
  );
  assert.ok(warnings.some((w) => w.message.includes("studio door")));
  assert.ok(
    warnings.some(
      (w) => w.ids.includes("outside") && w.message.includes("outside"),
    ),
  );
  const out = planSVG({ room: cfg, items: [] });
  assert.match(out, /Studio/);
  assert.match(out, /Meeting/);
  assert.doesNotMatch(out, /Kitchen|Bathroom|WINDOW/);
  const escaped = rectangle();
  escaped.rooms[0].name = "<script>alert(1)</script>";
  assert.match(
    planSVG({ room: floorPlanRoom(defaultRoom, escaped), items: [] }),
    /&lt;script&gt;/,
  );
});
