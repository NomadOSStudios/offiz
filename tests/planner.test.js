import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { History } from "../src/history.js";
import {
  contained,
  footprint,
  overlaps,
  layoutWarnings,
  doorZones,
} from "../src/geometry.js";
import {
  defaultState,
  normalizeState,
  validateRoom,
  legacyRoomDefaults,
} from "../src/store.js";
import { roomPolygons } from "../src/room.js";
import { CATALOG_BY_TYPE, itemDef } from "../src/catalog.js";
import { Editor } from "../src/editor.js";
import { planSVG } from "../src/plan.js";
const def = (it) => itemDef(CATALOG_BY_TYPE[it.type], it);
const room = structuredClone(legacyRoomDefaults),
  polys = roomPolygons(room),
  polygons = {
    office: polys.office,
    kitchen: polys.kitchen,
    bathroom: polys.bathroom,
  };
function makeEditor(items) {
  globalThis.window ??= { addEventListener() {} };
  let changes = 0,
    notice = "";
  const editor = new Editor({
    scene: new THREE.Scene(),
    dom: { addEventListener() {}, style: {} },
    getControls: () => ({ enabled: true }),
    onChange: () => changes++,
    onSelect() {},
    onMessage: (t) => (notice = t),
  });
  editor.setRoom({ ...polys, polygons, ceiling: room.ceiling });
  editor.load(items);
  return { editor, changes: () => changes, notice: () => notice };
}
const desk = (id = "a", x = 2, z = 2, extra = {}) => ({
  id,
  type: "desk",
  x,
  z,
  rot: 0,
  ...extra,
});
test("history restores isolated snapshots, branches after undo, and respects its limit", () => {
  const h = new History({ items: [] }, 3),
    s = { items: ["a"] };
  h.record(s);
  s.items.push("b");
  h.record(s);
  h.record({ items: ["c"] });
  assert.deepEqual(h.undo(), { items: ["a", "b"] });
  assert.deepEqual(h.undo(), { items: ["a"] });
  assert.equal(h.undo(), null);
  h.record({ items: ["branch"] });
  assert.equal(h.canRedo, false);
  assert.deepEqual(h.undo(), { items: ["a"] });
});
test("containment detects an item bridging a concave notch even if its corners fit", () => {
  const concave = [
    [0, 0],
    [4, 0],
    [4, 4],
    [3, 4],
    [3, 1],
    [1, 1],
    [1, 4],
    [0, 4],
  ];
  const bridging = [
    [0.5, 0.5],
    [3.5, 0.5],
    [3.5, 3.5],
    [0.5, 3.5],
  ];
  assert.equal(contained(bridging, concave), false);
  assert.equal(
    contained(
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      concave,
    ),
    true,
  );
});
test("rotated footprints and touching edges are handled without false collisions", () => {
  assert.equal(
    overlaps(
      footprint(desk(), def(desk())),
      footprint(desk("b", 3.6, 2), def(desk())),
    ),
    false,
  );
  assert.equal(
    overlaps(
      footprint(desk(), def(desk())),
      footprint(desk("b", 3, 2, { rot: 45 }), def(desk())),
    ),
    true,
  );
});
test("numeric movement, resizing, elevation and rotation enforce the room envelope atomically", () => {
  const { editor, changes } = makeEditor([desk("a", 0.85, 2)]);
  editor.select(editor.items.get("a"));
  editor.updateSelected({ x: -1 });
  assert.equal(editor.selected.position.x, 0.85);
  assert.equal(changes(), 0);
  editor.updateSelected({ w: 3 });
  assert.equal(editor.selected.userData.def.w, 1.6);
  assert.equal(changes(), 0);
  editor.updateSelected({ elevation: 2.5 });
  assert.equal(changes(), 0);
  editor.updateSelected({ x: 1 });
  assert.equal(changes(), 1);
  editor.updateSelected({ z: 0.45 });
  editor.rotateSelected(90);
  assert.equal(editor.selected.userData.item.rot, 0);
});
test("multi-selection moves and rotates around a common centre and duplicates independent groups", () => {
  const { editor } = makeEditor([desk("a", 2, 2), desk("b", 4, 2)]);
  editor.select(editor.items.get("a"));
  editor.select(editor.items.get("b"), true, true);
  editor.groupSelected();
  const group = editor.selected.userData.item.group;
  editor.rotateSelected(90);
  assert.deepEqual(
    editor.selection.map((g) => [
      Math.round(g.position.x),
      Math.round(g.position.z),
    ]),
    [
      [3, 3],
      [3, 1],
    ],
  );
  editor.moveSelection(-10, 0);
  assert.equal(editor.selection[0].position.x, 3);
  editor.duplicateSelected();
  assert.equal(editor.items.size, 4);
  assert.equal(editor.selection.length, 2);
  assert.notEqual(editor.selected.userData.item.group, group);
  assert.equal(
    new Set(editor.selection.map((g) => g.userData.item.group)).size,
    1,
  );
  editor.ungroupSelected();
  assert.ok(editor.selection.every((g) => !g.userData.item.group));
});
test("a drag is a single change; cancelling a drag restores all grouped pieces", () => {
  const { editor, changes } = makeEditor([
    desk("a", 2, 2, { group: "g" }),
    desk("b", 4, 2, { group: "g" }),
  ]);
  editor.select(editor.items.get("a"));
  editor.beginDrag(2, 2, "plan");
  editor.dragTo(2.5, 2.5);
  editor.dragTo(3, 3);
  assert.equal(changes(), 0);
  editor.finishDrag();
  assert.equal(changes(), 1);
  assert.equal(editor.items.get("a").position.x, 3);
  const before = editor.serialize();
  editor.beginDrag(3, 3, "plan");
  editor.dragTo(2, 2);
  editor.finishDrag(true);
  assert.deepEqual(editor.serialize(), before);
  assert.equal(changes(), 1);
});
test("layout checks permit rugs and supported monitors but detect furniture and door swing conflicts", () => {
  const items = [
    desk(),
    { id: "m", type: "monitor", x: 2, z: 2, elevation: 0.75 },
    { id: "r", type: "rug", x: 2, z: 2 },
  ];
  assert.equal(layoutWarnings(items, def, polygons, room).length, 0);
  items.push(desk("b", 2, 2));
  assert.ok(
    layoutWarnings(items, def, polygons, room).some(
      (w) => w.ids.includes("a") && w.ids.includes("b"),
    ),
  );
  const zone = doorZones(room)[0],
    it = {
      id: "block",
      type: "stool",
      x: zone.hinge[0] - 0.3,
      z: zone.hinge[1] - 0.3,
    };
  assert.ok(
    layoutWarnings([it], def, polygons, room).some((w) =>
      w.message.includes("entrance"),
    ),
  );
});
test("imports retain groups and cameras, merge older room defaults and reject malformed data", () => {
  const state = {
    ...defaultState(),
    room: structuredClone(legacyRoomDefaults),
  };
  delete state.room.bathroom;
  state.items = [desk("a", 2, 2, { group: "station" })];
  state.views = [
    { name: "Front", view: "3d", position: [1, 2, 3], target: [0, 0, 0] },
  ];
  const normalized = normalizeState(state);
  assert.equal(normalized.items[0].group, "station");
  assert.equal(normalized.views.length, 1);
  assert.equal(normalized.room.bathroom.width, 1.4);
  assert.throws(
    () => normalizeState({ ...state, items: [desk(), desk()] }),
    /duplicate/,
  );
  assert.throws(
    () => normalizeState({ ...state, items: [desk("bad", NaN, 2)] }),
    /position/,
  );
  assert.throws(() => normalizeState({ ...state, items: {} }), /items/);
  const invalid = structuredClone(room);
  invalid.window.top = invalid.window.sill - 0.1;
  assert.throws(() => validateRoom(invalid), /Window top/);
});
test("exported plans are independent SVGs with measurements and escaped item IDs", () => {
  const s = defaultState();
  s.items = [desk('test"<>&')];
  const svg = planSVG(s);
  assert.ok(svg.startsWith("<svg xmlns="));
  assert.ok(svg.includes("6.80 m"));
  assert.ok(svg.includes("test&quot;&lt;&gt;&amp;"));
  assert.ok(!svg.includes('data-item="test"<'));
});

test("dragging along a wall preserves the valid axis without crossing the boundary", () => {
  const { editor } = makeEditor([desk("a", 0.85, 2)]);
  editor.select(editor.items.get("a"));
  editor.beginDrag(0.85, 2);
  editor.dragTo(-1, 3);
  assert.equal(editor.selected.position.x, 0.85);
  assert.equal(editor.selected.position.z, 3);
  editor.finishDrag();
});

test("an unreadable old autosave is preserved before a new layout replaces it", async () => {
  const { loadState, saveState, getRecoveryState } = await import(
    "../src/store.js"
  );
  const data = new Map([["offiz.v1", '{"broken":true}']]);
  globalThis.localStorage = {
    getItem: (k) => data.get(k) || null,
    setItem: (k, v) => data.set(k, v),
  };
  const restored = loadState();
  assert.ok(restored.room);
  assert.equal(getRecoveryState(), '{"broken":true}');
  saveState(restored);
  assert.equal(data.get("offiz.v1.recovery"), '{"broken":true}');
  assert.ok(JSON.parse(data.get("offiz.v1")).room);
  delete globalThis.localStorage;
});
