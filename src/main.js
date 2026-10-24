import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { buildRoom, disposeGroup, roomPolygons } from './room.js';
import { createLighting } from './lighting.js';
import { Editor } from './editor.js';
import { createUI } from './ui.js';
import { loadState, saveState, clearState, exportState, importState, defaultState } from './store.js';

let state = loadState();
const viewport = document.getElementById('viewport');

// ---- renderer, cameras, controls --------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
viewport.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.domElement.className = 'labels';
viewport.appendChild(labelRenderer.domElement);

const scene = new THREE.Scene();

const persp = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
ortho.up.set(0, 0, -1);

const controls3d = new OrbitControls(persp, renderer.domElement);
controls3d.maxPolarAngle = Math.PI / 2 - 0.03;
controls3d.minDistance = 0.4;
controls3d.maxDistance = 40;
controls3d.enableDamping = true;
controls3d.dampingFactor = 0.1;

const controlsPlan = new OrbitControls(ortho, renderer.domElement);
controlsPlan.enableRotate = false;
controlsPlan.enabled = false;
controlsPlan.enableDamping = true;
controlsPlan.dampingFactor = 0.1;

let view = '3d';
const activeCamera = () => (view === 'plan' ? ortho : persp);
const activeControls = () => (view === 'plan' ? controlsPlan : controls3d);

// ---- room, lighting, editor ------------------------------------------------
const lighting = createLighting(scene);
let room = null;

const editor = new Editor({
  scene,
  dom: renderer.domElement,
  getCamera: activeCamera,
  getControls: activeControls,
  getRoomGroup: () => room?.group,
  onChange: () => persist(),
  onSelect: (item, def) => {
    ui.showItem(item, def);
    if (item) ui.showWall(null);
  },
  onWallSelect: (id) => ui.showWall(id, state.room),
});

function roomInfo() {
  const p = roomPolygons(state.room);
  return { polygons: { office: p.office, kitchen: p.kitchen }, W: p.W, L: p.L, nw: p.nw, nd: p.nd, ceiling: state.room.ceiling };
}

function rebuildRoom({ refit = false } = {}) {
  if (room) disposeGroup(room.group);
  room = buildRoom(state.room);
  scene.add(room.group);
  const info = roomInfo();
  editor.setRoom(info);
  lighting.setCeilingLights(info, state.lighting.ceilingLights);
  lighting.setHour(state.lighting.hour, info);
  const ceilingOn = document.getElementById('ceilingToggle').checked;
  room.ceiling.visible = ceilingOn;
  lighting.setPanelsVisible(ceilingOn);
  // Wall-mounted items follow the walls when the room changes shape.
  for (const g of editor.items.values()) {
    if (g.userData.def.wallMounted) {
      editor.snapToWall(g.userData.item, g.userData.def);
      editor.applyTransform(g);
    }
  }
  if (refit) fitCameras();
  updateOrthoFrustum();
}

function fitCameras() {
  const { W, L } = room;
  persp.position.set(W / 2 + 6.5, 7.5, L + 6.5);
  controls3d.target.set(W / 2, 0.6, L / 2);
  controls3d.update();
  ortho.position.set(W / 2, 30, L / 2);
  controlsPlan.target.set(W / 2, 0, L / 2);
  ortho.lookAt(W / 2, 0, L / 2);
  controlsPlan.update();
}

function updateOrthoFrustum() {
  if (!room) return;
  const aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
  const half = Math.max((room.L + 2.5) / 2, (room.W + 3) / 2 / aspect);
  ortho.left = -half * aspect;
  ortho.right = half * aspect;
  ortho.top = half;
  ortho.bottom = -half;
  ortho.updateProjectionMatrix();
}

function setCeilingVisible(on) {
  document.getElementById('ceilingToggle').checked = on;
  room.ceiling.visible = on;
  lighting.setPanelsVisible(on);
}

let ceilingBeforeDoorView = null;
function setView(v) {
  const wasDoor = view === 'door';
  view = v;
  controls3d.enabled = v !== 'plan';
  controlsPlan.enabled = v === 'plan';
  document.querySelectorAll('#viewButtons button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  // Eye level needs a ceiling; the overview needs it out of the way.
  if (v === 'door' && !wasDoor) {
    ceilingBeforeDoorView = document.getElementById('ceilingToggle').checked;
    setCeilingVisible(true);
  } else if (wasDoor && v !== 'door' && ceilingBeforeDoorView != null) {
    setCeilingVisible(ceilingBeforeDoorView);
    ceilingBeforeDoorView = null;
  }
  if (v === 'door') {
    const { W, L } = room;
    const d = state.room.entranceDoor;
    persp.position.set(d.from + d.width / 2, 1.6, L - 0.35);
    controls3d.target.set(W / 2, 1.1, L / 2 - 1.5);
    controls3d.update();
  } else if (v === '3d') {
    fitCameras();
  }
}

// Walls between the camera and the room fade so the inside stays visible.
function updateWallFade() {
  if (!room) return;
  const cam = activeCamera();
  for (const g of room.walls) {
    const [nx, nz] = g.userData.normal;
    const [cx, cz] = g.userData.center;
    const outside = (cam.position.x - cx) * nx + (cam.position.z - cz) * nz > 0;
    const m = g.userData.material;
    const target = outside && view !== 'plan' ? 0.1 : 1;
    m.opacity += (target - m.opacity) * 0.3;
    m.depthWrite = m.opacity > 0.9;
  }
}

// ---- persistence -----------------------------------------------------------
let saveTimer = null;
function persist() {
  state.items = editor.serialize();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveState(state);
    ui.setSaveStatus('Saved');
    setTimeout(() => ui.setSaveStatus(''), 1500);
  }, 300);
}

function applyState(s) {
  state = s;
  editor.load(state.items);
  rebuildRoom({ refit: true });
  ui.renderRoom(state.room, state.lighting);
  ui.showItem(null);
  ui.showWall(null);
  persist();
}

// ---- UI --------------------------------------------------------------------
const ui = createUI({
  onSpawn: (def) => editor.spawn(def),
  onItemChange: (patch) => editor.updateSelected(patch),
  onItemPreviewColor: (c) => {
    const g = editor.selected;
    if (!g) return;
    for (const m of g.userData.primary || []) m.color.set(c);
  },
  onItemAction: (a) => {
    if (a === 'rotateLeft') editor.rotateSelected(-15);
    if (a === 'rotateRight') editor.rotateSelected(15);
    if (a === 'duplicate') editor.duplicateSelected();
    if (a === 'delete') editor.deleteSelected();
  },
  onRoomChange: (mutate) => {
    mutate(state.room);
    rebuildRoom();
    ui.renderRoom(state.room, state.lighting);
    persist();
  },
  onWallColor: (id, c) => {
    if (id == null) {
      state.room.wallColor = c;
    } else if (c == null) {
      delete state.room.wallColors[id];
    } else {
      state.room.wallColors[id] = c;
    }
    for (const g of room.walls) {
      const wid = g.userData.id;
      g.userData.material.color.set(state.room.wallColors[wid] || state.room.wallColor);
    }
    persist();
  },
  onLightingChange: (patch) => {
    Object.assign(state.lighting, patch);
    const info = roomInfo();
    lighting.setHour(state.lighting.hour, info);
    lighting.setCeilingLights(info, state.lighting.ceilingLights);
    persist();
  },
});

document.querySelectorAll('#viewButtons button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
document.getElementById('dimsToggle').addEventListener('change', (e) => {
  labelRenderer.domElement.style.display = e.target.checked ? '' : 'none';
});
document.getElementById('ceilingToggle').addEventListener('change', (e) => {
  setCeilingVisible(e.target.checked);
});
document.getElementById('snapToggle').addEventListener('change', (e) => {
  editor.snap = e.target.checked;
});
document.getElementById('exportBtn').addEventListener('click', () => {
  state.items = editor.serialize();
  exportState(state);
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    applyState(await importState(f));
  } catch (err) {
    alert(`Could not import: ${err.message}`);
  }
  e.target.value = '';
});
document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Reset the room and furniture to the starting layout?')) return;
  clearState();
  applyState(defaultState());
});

// ---- boot ------------------------------------------------------------------
function resize() {
  const w = viewport.clientWidth;
  const hgt = viewport.clientHeight;
  renderer.setSize(w, hgt);
  labelRenderer.setSize(w, hgt);
  persp.aspect = w / Math.max(1, hgt);
  persp.updateProjectionMatrix();
  updateOrthoFrustum();
}
new ResizeObserver(resize).observe(viewport);

editor.load(state.items);
rebuildRoom({ refit: true });
ui.renderRoom(state.room, state.lighting);
resize();

renderer.setAnimationLoop(() => {
  controls3d.update();
  controlsPlan.update();
  updateWallFade();
  const cam = activeCamera();
  renderer.render(scene, cam);
  labelRenderer.render(scene, cam);
});
