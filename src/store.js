// App state: room configuration (from Emad's sketch), furniture items, lighting.
// Autosaved to localStorage; export/import as JSON.

import { CATALOG_BY_TYPE } from "./catalog.js";
import { FLOORS } from "./textures.js";
const KEY = "offiz.v1";
const LAYOUTS_KEY = "offiz.layouts.v1";

// All distances in metres. Plan orientation: x runs along the window wall
// (left → right), z runs from the window wall (z = 0) towards the entrance
// wall (z = length). The kitchen sits in the notch at the bottom-right.
export const defaultRoom = {
  width: 6.7,
  length: 9.5,
  ceiling: 2.7,
  notch: { width: 3.5, depth: 2.3 },
  wallThickness: 0.15,
  // The whole top wall is glazing from 1.5 m up to (almost) the ceiling.
  window: { sill: 1.5, top: 2.6 },
  // Entrance door on the bottom wall, measured from the left corner.
  entranceDoor: { from: 1.2, width: 0.9, height: 2.1 },
  // Kitchen door on the side partition, measured from the inner corner (top of notch).
  kitchenDoor: { from: 1.0, width: 0.8, height: 2.1 },
  // Bathroom is the far-right part of the notch, full depth. Its door is on the
  // kitchen/bathroom wall, measured from the long partition. Width 0 = none.
  bathroom: {
    width: 1.75,
    door: { from: 0.6, width: 0.7, height: 2.1 },
    floor: "tileDark",
  },
  wallColor: "#f2efe8",
  wallColors: {},
  floor: "carpetTiles",
  kitchenFloor: "tile",
};

let nextId = 1;
export const uid = () =>
  `i${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function starterItems() {
  return [
    { id: uid(), type: "desk", x: 2.0, z: 2.2, rot: 0 },
    { id: uid(), type: "monitor", x: 2.0, z: 2.0, rot: 180, elevation: 0.75 },
    { id: uid(), type: "officeChair", x: 2.0, z: 2.9, rot: 180 },
    { id: uid(), type: "plant", x: 0.45, z: 0.5, rot: 0 },
    { id: uid(), type: "bookshelf", x: 0.2, z: 4.2, rot: 90 },
    {
      id: uid(),
      type: "whiteboard",
      x: 0.025,
      z: 6.0,
      rot: 90,
      elevation: 0.9,
    },
    { id: uid(), type: "sofa", x: 6.25, z: 4.6, rot: -90 },
    { id: uid(), type: "coffeeTable", x: 5.3, z: 4.6, rot: 0 },
    { id: uid(), type: "rug", x: 5.3, z: 4.6, rot: 90 },
    { id: uid(), type: "counterShort", x: 4.1, z: 9.2, rot: 180 },
    { id: uid(), type: "fridge", x: 4.55, z: 7.65, rot: 0 },
    { id: uid(), type: "toilet", x: 6.35, z: 8.9, rot: -90 },
    { id: uid(), type: "basin", x: 5.85, z: 7.5, rot: 0 },
    { id: uid(), type: "mirror", x: 5.85, z: 7.325, rot: 0, elevation: 1.25 },
  ];
}

// Saved rooms from older versions get any new settings filled in.
function mergeRoom(saved = {}) {
  const d = structuredClone(defaultRoom);
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
  return {
    room: structuredClone(defaultRoom),
    items: starterItems(),
    lighting: { hour: 14, ceilingLights: true },
  };
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
  range(r.width, 2, 50, "Room width");
  range(r.length, 2, 50, "Room length");
  range(r.ceiling, 2.1, 10, "Ceiling");
  range(r.wallThickness, 0.05, 0.5, "Wall thickness");
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
