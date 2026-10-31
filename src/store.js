// Local layouts stay in browser storage. Only fictional starter rooms ship.
import { CATALOG_BY_TYPE } from "./catalog.js";
import { FLOORS } from "./textures.js";
import { floorPlanRoom } from "./floorplan-model.js";
import livingRoom from "./examples/living-room.json" with { type: "json" };
import bedroom from "./examples/bedroom.json" with { type: "json" };
const KEY = "offiz.v1";
const LAYOUTS_KEY = "offiz.layouts.v1";
const starterStates = { "living-room": livingRoom, bedroom };
export const STARTER_LAYOUTS = [
  {
    id: "living-room",
    name: "The Sunday room",
    label: "living room",
    description:
      "A sunlit living room with olive upholstery, warm oak and walnut.",
  },
  {
    id: "bedroom",
    name: "The quiet room",
    label: "bedroom",
    description:
      "A calm bedroom with a king bed, sage walls, light ash floors and a reading corner.",
  },
];
export function starterState(id) {
  if (!Object.hasOwn(starterStates, id))
    throw new Error("Unknown starter layout.");
  return structuredClone(starterStates[id]);
}

// Generic fallback values for incomplete files from the old parametric schema.
// Complete older saves retain their own dimensions; no private layout is bundled.
export const legacyRoomDefaults = {
  width: 8,
  length: 7,
  ceiling: 2.7,
  notch: { width: 3, depth: 2 },
  wallThickness: 0.15,
  window: { sill: 1, top: 2.5 },
  entranceDoor: { from: 1, width: 0.9, height: 2.1 },
  kitchenDoor: { from: 0.2, width: 0.8, height: 2.1 },
  bathroom: {
    width: 1.4,
    door: { from: 0.25, width: 0.7, height: 2.1 },
    floor: "tileDark",
  },
  wallColor: "#f2efe8",
  wallColors: {},
  floor: "oak",
  kitchenFloor: "tile",
};
export const defaultRoom = structuredClone(livingRoom.room);

let nextId = 1;
export const uid = () =>
  `i${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function starterItems() {
  return structuredClone(livingRoom.items);
}

// Saved rooms from older versions get any new settings filled in.
function mergeRoom(saved = {}) {
  if (saved.floorPlan)
    return {
      ...structuredClone(defaultRoom),
      ...saved,
      wallColors: { ...(saved.wallColors || {}) },
    };
  const d = structuredClone(legacyRoomDefaults);
  const out = { ...d, ...saved };
  for (const k of [
    "notch",
    "window",
    "entranceDoor",
    "kitchenDoor",
    "bathroom",
  ])
    out[k] = { ...d[k], ...(saved[k] || {}) };
  out.bathroom.door = { ...d.bathroom.door, ...(saved.bathroom?.door || {}) };
  out.wallColors = { ...(saved.wallColors || {}) };
  return out;
}

export function defaultState() {
  return starterState("living-room");
}

export let loadError = null;
let recoveryState = null;
export function loadState() {
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch (err) {
    recoveryState = raw;
    loadError = err.message;
    return defaultState();
  }
}
export function getRecoveryState() {
  try {
    return recoveryState || localStorage.getItem(KEY + ".recovery");
  } catch {
    return recoveryState;
  }
}
export function saveState(state) {
  // Preserve a rejected old save before replacing it with an editable starter.
  // If storage is full, throw before the original can be overwritten.
  if (recoveryState) localStorage.setItem(KEY + ".recovery", recoveryState);
  localStorage.setItem(KEY, JSON.stringify(state));
  recoveryState = null;
}

export function clearState() {
  localStorage.removeItem(KEY);
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `offiz-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importState(file) {
  return file.text().then((txt) => {
    const s = JSON.parse(txt);
    if (!s || typeof s !== "object" || !s.room)
      throw new Error("Not an Offiz file");
    return normalizeState(s);
  });
}

export function validateRoom(r) {
  const range = (v, min, max, label) => {
    if (!Number.isFinite(v) || v < min || v > max)
      throw new Error(
        `${label} must be between ${min.toFixed(2)} and ${max.toFixed(2)} m.`,
      );
  };
  range(r.ceiling, 2.1, 10, "Ceiling");
  range(r.wallThickness, 0.05, 0.5, "Wall thickness");
  if (r.floorPlan) {
    Object.assign(r, floorPlanRoom(r, r.floorPlan));
    for (const room of r.floorPlan.rooms)
      if (!FLOORS[room.floor]) throw new Error("Unknown room floor finish.");
    for (const c of [r.wallColor, ...Object.values(r.wallColors)])
      if (!/^#[0-9a-f]{6}$/i.test(c)) throw new Error("Invalid paint colour.");
    return r;
  }
  range(r.width, 2, 50, "Room width");
  range(r.length, 2, 50, "Room length");
  range(r.notch.width, 0.8, r.width - 0.8, "Kitchen section width");
  range(r.notch.depth, 1, r.length - 1, "Kitchen depth");
  range(r.bathroom.width, 0, r.notch.width - 0.8, "Bathroom width");
  if (r.bathroom.width > 0 && r.bathroom.width < 0.5)
    throw new Error("Bathroom width must be 0, or at least 0.50 m.");
  range(r.window.sill, 0, r.ceiling - 0.15, "Window sill");
  range(r.window.top, r.window.sill + 0.1, r.ceiling - 0.05, "Window top");
  for (const [d, len, label, offset] of [
    [r.entranceDoor, r.width - r.notch.width, "Entrance", 0],
    [r.kitchenDoor, r.notch.depth, "Kitchen door", 0.1],
    [r.bathroom.door, r.notch.depth - 0.1, "Bathroom door", 0],
  ]) {
    if (label === "Bathroom door" && !r.bathroom.width) continue;
    range(d.width, 0.6, len - offset, `${label} width`);
    range(d.from, offset, len - d.width, `${label} position`);
    range(d.height, 1.8, r.ceiling - 0.05, `${label} height`);
  }
  for (const f of [r.floor, r.kitchenFloor, r.bathroom.floor])
    if (!FLOORS[f]) throw new Error("Unknown floor finish.");
  for (const c of [r.wallColor, ...Object.values(r.wallColors)])
    if (!/^#[0-9a-f]{6}$/i.test(c)) throw new Error("Invalid paint colour.");
  return r;
}

export function normalizeState(s) {
  if (!s || typeof s !== "object" || !s.room)
    throw new Error("Not an Offiz file.");
  const room = validateRoom(mergeRoom(s.room));
  if (!Array.isArray(s.items) || s.items.length > 1000)
    throw new Error("A layout must contain at most 1,000 items.");
  const ids = new Set();
  const items = s.items.map((it) => {
    if (
      !it ||
      !CATALOG_BY_TYPE[it.type] ||
      typeof it.id !== "string" ||
      ids.has(it.id)
    )
      throw new Error("Unknown furniture or duplicate item ID.");
    ids.add(it.id);
    for (const k of ["x", "z"])
      if (!Number.isFinite(it[k]) || Math.abs(it[k]) > 100)
        throw new Error("Invalid furniture position.");
    for (const k of ["rot", "elevation", "w", "d", "h"])
      if (it[k] != null && (!Number.isFinite(it[k]) || Math.abs(it[k]) > 1000))
        throw new Error("Invalid furniture dimensions.");
    for (const k of ["w", "d", "h"])
      if (it[k] != null && (it[k] < 0.1 || it[k] > 50))
        throw new Error("Furniture sizes must be between 0.10 and 50 m.");
    if (it.elevation < 0 || (it.color && !/^#[0-9a-f]{6}$/i.test(it.color)))
      throw new Error("Invalid furniture height or colour.");
    return { ...it };
  });
  const lighting = { hour: 14, ceilingLights: true, ...s.lighting };
  if (
    !Number.isFinite(lighting.hour) ||
    lighting.hour < 6 ||
    lighting.hour > 20 ||
    typeof lighting.ceilingLights !== "boolean"
  )
    throw new Error("Invalid lighting settings.");
  const views = Array.isArray(s.views)
    ? s.views
        .filter(
          (v) =>
            typeof v.name === "string" &&
            ["3d", "door", "walk", "plan"].includes(v.view) &&
            [v.position, v.target].every(
              (a) =>
                Array.isArray(a) &&
                a.length === 3 &&
                a.every((n) => Number.isFinite(n) && Math.abs(n) < 1000),
            ),
        )
        .slice(0, 30)
    : [];
  for (const v of views) {
    if (
      v.planBox &&
      (!Array.isArray(v.planBox) ||
        v.planBox.length !== 4 ||
        !v.planBox.every(Number.isFinite) ||
        v.planBox[2] <= 0 ||
        v.planBox[3] <= 0)
    )
      delete v.planBox;
  }
  return { room, items, lighting, views };
}
export function loadLayouts() {
  try {
    const data = JSON.parse(localStorage.getItem(LAYOUTS_KEY) || "[]");
    return Array.isArray(data)
      ? data.slice(0, 30).flatMap((l) => {
          try {
            return [
              {
                id: String(l.id),
                name: String(l.name),
                state: normalizeState(l.state),
              },
            ];
          } catch {
            return [];
          }
        })
      : [];
  } catch {
    return [];
  }
}
export function saveLayouts(layouts) {
  localStorage.setItem(LAYOUTS_KEY, JSON.stringify(layouts));
}
export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
