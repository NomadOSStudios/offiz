import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultState,
  defaultRoom,
  normalizeState,
  legacyRoomDefaults,
  loadState,
  saveState,
  STARTER_LAYOUTS,
  starterState,
} from "../src/store.js";
import {
  CATALOG,
  CATALOG_BY_TYPE,
  CATEGORIES,
  itemDef,
} from "../src/catalog.js";
import { layoutWarnings, footprint, pointInside } from "../src/geometry.js";
import { roomPolygons } from "../src/room.js";
import { walkablePlan, planWalls } from "../src/floorplan-model.js";

test("the shipped living room has clear furniture placement and an accessible entry", () => {
  const state = normalizeState(defaultState());
  assert.equal(state.room.floorPlan.rooms.length, 1);
  assert.equal(state.room.floorPlan.rooms[0].name, "The Sunday room");
  assert.equal(state.items.length, 12);
  assert.ok(state.items.some((it) => it.type === "sectional"));
  assert.ok(state.items.some((it) => it.type === "television"));
  assert.ok(state.items.every((it) => CATALOG_BY_TYPE[it.type].cat !== "Work"));
  assert.equal(state.room.notch, undefined);
  const warnings = layoutWarnings(
    state.items,
    (it) => itemDef(CATALOG_BY_TYPE[it.type], it),
    roomPolygons(state.room).polygons,
    state.room,
  );
  assert.deepEqual(warnings, []);
  // A continuous entry lane runs from the doorway into the seating area.
  for (const z of [5.5, 5, 4.5, 4, 3.5])
    assert.equal(walkablePlan(state.room.floorPlan, [5.9, z], 0.18), true);
});

test("starter snapshots are independent from edits and do not mutate the bundled example", () => {
  const before = defaultState(),
    edited = defaultState();
  edited.items[0].x = 99;
  edited.room.floorPlan.rooms[0].points[0][0] = 99;
  edited.room.wallColors.changed = "#ff0000";
  edited.views.push({ name: "Private angle" });
  assert.deepEqual(defaultState(), before);
  assert.deepEqual(defaultRoom, before.room);
});

test("the bedroom starter has clear placement, usable circulation and an accent wall", () => {
  const state = normalizeState(starterState("bedroom"));
  assert.equal(state.room.floorPlan.rooms[0].name, "The quiet room");
  assert.equal(state.items.length, 14);
  for (const type of [
    "bedKing",
    "nightstand",
    "bedsideLamp",
    "wardrobe",
    "dresser",
    "bedBench",
    "armchair",
  ])
    assert.ok(
      state.items.some((it) => it.type === type),
      type,
    );
  const getDef = (it) => itemDef(CATALOG_BY_TYPE[it.type], it);
  assert.deepEqual(
    layoutWarnings(
      state.items,
      getDef,
      roomPolygons(state.room).polygons,
      state.room,
    ),
    [],
  );
  const walls = planWalls(state.room.floorPlan);
  assert.ok(
    Object.keys(state.room.wallColors).every((id) =>
      walls.some((w) => w.id === id),
    ),
  );
  // Enter, cross the foot of the bed, then reach either bedside without obstacles.
  const paths = [
    [
      [4.7, 5.25],
      [4.7, 4.55],
      [2.2, 4.55],
      [1.55, 4.55],
      [1.55, 1.3],
    ],
    [
      [3.8, 4.55],
      [3.8, 2.95],
      [4.15, 2.95],
      [4.15, 1.3],
    ],
  ];
  for (const path of paths)
    for (let i = 1; i < path.length; i++)
      for (let t = 0; t <= 1; t += 0.1) {
        const p = path[i - 1].map((v, axis) => v + (path[i][axis] - v) * t);
        assert.ok(walkablePlan(state.room.floorPlan, p, 0.18), `wall at ${p}`);
        for (const it of state.items) {
          const def = getDef(it);
          if (def.passable || (it.elevation || 0) > 1.5) continue;
          assert.equal(
            pointInside(
              p,
              footprint(it, { ...def, w: def.w + 0.3, d: def.d + 0.3 }),
            ),
            false,
            `${it.id} obstructs ${p}`,
          );
        }
      }
});

test("both starters are independently editable and the living room remains the default", () => {
  assert.deepEqual(
    STARTER_LAYOUTS.map((s) => s.id),
    ["living-room", "bedroom"],
  );
  for (const { id } of STARTER_LAYOUTS) {
    const before = starterState(id),
      edited = starterState(id);
    edited.room.floorPlan.rooms[0].points[0][0] = 100;
    edited.items[0].color = "#ff0000";
    assert.deepEqual(starterState(id), before);
    assert.deepEqual(
      normalizeState(JSON.parse(JSON.stringify(before))).items,
      before.items,
    );
  }
  assert.deepEqual(defaultState(), starterState("living-room"));
  assert.throws(() => starterState("missing"), /Unknown starter/);
});

test("home categories provide all bedroom and living-room essentials with stable IDs", () => {
  assert.ok(CATEGORIES.includes("Bedroom"));
  assert.ok(CATEGORIES.includes("Living room"));
  assert.equal(new Set(CATALOG.map((d) => d.type)).size, CATALOG.length);
  for (const type of [
    "bedSingle",
    "bedDouble",
    "bedKing",
    "nightstand",
    "dresser",
    "wardrobe",
    "bedBench",
    "bedsideLamp",
  ])
    assert.equal(CATALOG_BY_TYPE[type].cat, "Bedroom");
  for (const type of [
    "sectional",
    "mediaConsole",
    "television",
    "sideTable",
    "ottoman",
    "tableLamp",
    "sofa",
    "armchair",
    "coffeeTable",
  ])
    assert.equal(CATALOG_BY_TYPE[type].cat, "Living room");
});

test("existing local room and alternatives survive the change of bundled starter", () => {
  const saved = {
    room: { ...structuredClone(legacyRoomDefaults), width: 9, length: 8 },
    items: [{ id: "private-desk", type: "desk", x: 2.5, z: 3, rot: 90 }],
    lighting: { hour: 11, ceilingLights: true },
    views: [],
  };
  const raw = JSON.stringify(saved),
    alternatives = "[]";
  const data = new Map([
    ["offiz.v1", raw],
    ["offiz.layouts.v1", alternatives],
  ]);
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  try {
    const restored = loadState();
    assert.deepEqual(restored, saved);
    assert.equal(restored.room.floorPlan, undefined);
    assert.equal(data.get("offiz.v1"), raw);
    saveState(restored);
    assert.deepEqual(JSON.parse(data.get("offiz.v1")), saved);
    assert.equal(data.get("offiz.layouts.v1"), alternatives);
    data.delete("offiz.v1");
    assert.deepEqual(loadState(), defaultState());
  } finally {
    if (previous === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previous;
  }
});
