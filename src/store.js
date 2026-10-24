// App state: room configuration (from Emad's sketch), furniture items, lighting.
// Autosaved to localStorage; export/import as JSON.

const KEY = 'offiz.v1';

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
  bathroom: { width: 1.75, door: { from: 0.6, width: 0.7, height: 2.1 }, floor: 'tileDark' },
  wallColor: '#f2efe8',
  wallColors: {},
  floor: 'carpetTiles',
  kitchenFloor: 'tile',
};

let nextId = 1;
export const uid = () => `i${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function starterItems() {
  return [
    { id: uid(), type: 'desk', x: 2.0, z: 2.2, rot: 0 },
    { id: uid(), type: 'monitor', x: 2.0, z: 2.0, rot: 180, elevation: 0.75 },
    { id: uid(), type: 'officeChair', x: 2.0, z: 2.9, rot: 180 },
    { id: uid(), type: 'plant', x: 0.45, z: 0.5, rot: 0 },
    { id: uid(), type: 'bookshelf', x: 0.2, z: 4.2, rot: 90 },
    { id: uid(), type: 'whiteboard', x: 0.025, z: 6.0, rot: 90, elevation: 0.9 },
    { id: uid(), type: 'sofa', x: 6.25, z: 4.6, rot: -90 },
    { id: uid(), type: 'coffeeTable', x: 5.3, z: 4.6, rot: 0 },
    { id: uid(), type: 'rug', x: 5.3, z: 4.6, rot: 90 },
    { id: uid(), type: 'counterShort', x: 4.1, z: 9.2, rot: 180 },
    { id: uid(), type: 'fridge', x: 4.55, z: 7.65, rot: 0 },
    { id: uid(), type: 'toilet', x: 6.35, z: 8.9, rot: -90 },
    { id: uid(), type: 'basin', x: 5.85, z: 7.5, rot: 0 },
    { id: uid(), type: 'mirror', x: 5.85, z: 7.325, rot: 0, elevation: 1.25 },
  ];
}

// Saved rooms from older versions get any new settings filled in.
function mergeRoom(saved = {}) {
  const d = structuredClone(defaultRoom);
  const out = { ...d, ...saved };
  for (const k of ['notch', 'window', 'entranceDoor', 'kitchenDoor', 'bathroom']) out[k] = { ...d[k], ...(saved[k] || {}) };
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

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    s.room = mergeRoom(s.room);
    s.lighting = { ...defaultState().lighting, ...s.lighting };
    s.items ??= [];
    return s;
  } catch {
    return defaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearState() {
  localStorage.removeItem(KEY);
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `offiz-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function importState(file) {
  return file.text().then((txt) => {
    const s = JSON.parse(txt);
    if (!s || typeof s !== 'object' || !s.room) throw new Error('Not an Offiz file');
    s.room = mergeRoom(s.room);
    s.lighting = { ...defaultState().lighting, ...s.lighting };
    s.items ??= [];
    return s;
  });
}
