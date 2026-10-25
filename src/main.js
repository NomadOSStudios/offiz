import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { PhotoMode } from "./photo.js";
import { buildRoom, disposeGroup, roomPolygons, polygonArea } from "./room.js";
import { createLighting } from "./lighting.js";
import { Editor } from "./editor.js";
import {
  createUI,
  el,
  button,
  openDialog,
  closeDialog,
  nameForm,
} from "./ui.js";
import {
  loadState,
  loadError,
  getRecoveryState,
  saveState,
  exportState,
  importState,
  defaultState,
  loadLayouts,
  saveLayouts,
  validateRoom,
  uid,
  downloadBlob,
} from "./store.js";
import { History } from "./history.js";
import { layoutWarnings, footprint, pointInside } from "./geometry.js";
import { CATALOG_BY_TYPE, itemDef } from "./catalog.js";
import { PlanView, planSVG, exportPlan } from "./plan.js";
import { openFloorPlanEditor } from "./floorplan-editor.js";
import {
  interiorPoint,
  customDoorZones,
  walkablePlan,
  inside,
} from "./floorplan-model.js";
const $ = (id) => document.getElementById(id);
let state = loadState();
state.views ??= [];
let layouts = loadLayouts();
const history = new History(state);
let ui,
  plan,
  room = null,
  photo,
  view = "3d",
  warnings = [],
  messageTimer,
  saveTimer,
  visualFrame;
const viewport = $("viewport");
function message(t) {
  if ($("workspaceDialog").open) {
    let notice = $("dialogBody").querySelector(".dialog-error");
    if (!notice) {
      notice = el("p", { class: "dialog-error", role: "alert" });
      $("dialogBody").prepend(notice);
    }
    notice.textContent = t;
  }
  clearTimeout(messageTimer);
  $("message").textContent = t;
  $("message").hidden = false;
  messageTimer = setTimeout(() => ($("message").hidden = true), 4500);
}
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
viewport.appendChild(renderer.domElement);
renderer.domElement.setAttribute("aria-label", "Interactive 3D office");
const labels = new CSS2DRenderer();
labels.domElement.className = "labels";
viewport.appendChild(labels.domElement);
const scene = new THREE.Scene(),
  pmrem = new THREE.PMREMGenerator(renderer),
  environment = new RoomEnvironment();
scene.environment = pmrem.fromScene(environment, 0.04).texture;
pmrem.dispose();
environment.dispose();
const persp = new THREE.PerspectiveCamera(50, 1, 0.1, 120),
  controls = new OrbitControls(persp, renderer.domElement);
controls.maxPolarAngle = Math.PI / 2 - 0.03;
controls.minDistance = 0.4;
controls.maxDistance = 60;
controls.enableDamping = true;
controls.dampingFactor = 0.1;
const composer = new EffectComposer(renderer),
  renderPass = new RenderPass(scene, persp),
  gtao = new GTAOPass(scene, persp, 1, 1);
gtao.updateGtaoMaterial({
  radius: 0.3,
  distanceExponent: 1,
  thickness: 1,
  scale: 1,
  samples: 16,
  distanceFallOff: 1,
  screenSpaceRadius: false,
});
gtao.blendIntensity = 0.85;
composer.addPass(renderPass);
composer.addPass(gtao);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.08, 0.5, 2.2));
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass());
const lighting = createLighting(scene);
const editor = new Editor({
  scene,
  dom: renderer.domElement,
  getCamera: () => persp,
  getControls: () => controls,
  getRoomGroup: () => room?.group,
  onChange: () => persist(),
  onSelect: (item, def, items) => {
    ui?.showItem(item, def, items);
    ui?.renderItems(editor.serialize(), editor.selectedIds);
  },
  onWallSelect: (id) => ui.showWall(id, state.room),
  onMessage: message,
  onVisual: () => scheduleVisual(),
});
const diagnosticHelpers = new THREE.Group();
scene.add(diagnosticHelpers);
function roomInfo(cfg = state.room) {
  const p = roomPolygons(cfg);
  return {
    ...p,
    polygons: p.polygons,
    custom: !!cfg.floorPlan,
    ceiling: cfg.ceiling,
  };
}
function snapshot() {
  return { ...state, items: editor.serialize() };
}
function scheduleVisual() {
  if (!ui || visualFrame) return;
  visualFrame = requestAnimationFrame(() => {
    visualFrame = null;
    refreshVisual();
  });
}
function refreshVisual() {
  if (!room) return;
  state.items = editor.serialize();
  warnings = layoutWarnings(
    state.items,
    (it) => itemDef(CATALOG_BY_TYPE[it.type], it),
    room.polygons,
    state.room,
  );
  ui?.showWarnings(warnings);
  ui?.renderItems(state.items, editor.selectedIds);
  plan?.render();
  $("sceneStats").textContent = `${state.items.length} pieces · ${Object.values(
    room.polygons,
  )
    .filter(Boolean)
    .reduce((sum, p) => sum + polygonArea(p), 0)
    .toFixed(1)} m²`;
  disposeGroup(diagnosticHelpers);
  diagnosticHelpers.clear();
  scene.add(diagnosticHelpers);
  for (const id of new Set(warnings.flatMap((w) => w.ids))) {
    const g = editor.items.get(id);
    if (!g || editor.selectedIds.has(id)) continue;
    const d = g.userData.def,
      pts = footprint(g.userData.item, d);
    pts.push(pts[0]);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        pts.map(([x, z]) => new THREE.Vector3(x, 0.035, z)),
      ),
      new THREE.LineBasicMaterial({ color: "#cc6a62", depthTest: false }),
    );
    line.renderOrder = 8;
    diagnosticHelpers.add(line);
  }
  for (const guide of editor.guides) {
    const p =
      guide.axis === "x"
        ? [
            [guide.at, 0],
            [guide.at, room.L],
          ]
        : [
            [0, guide.at],
            [room.W, guide.at],
          ];
    diagnosticHelpers.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(
          p.map(([x, z]) => new THREE.Vector3(x, 0.04, z)),
        ),
        new THREE.LineBasicMaterial({ color: "#e2b659", depthTest: false }),
      ),
    );
  }
}
function rebuildRoom({ fit = false } = {}) {
  if (room) disposeGroup(room.group);
  room = buildRoom(state.room);
  scene.add(room.group);
  editor.setRoom(roomInfo());
  lighting.setCeilingLights(roomInfo(), state.lighting.ceilingLights);
  lighting.setHour(state.lighting.hour, roomInfo());
  setCeiling($("ceilingToggle").checked);
  if (fit) fitCamera();
  scheduleVisual();
}
function fitCamera() {
  if (view === "plan") {
    plan?.fit();
    return;
  }
  const { width: W, length: L, ceiling: H } = state.room;
  const aspect = viewport.clientWidth / Math.max(1, viewport.clientHeight);
  const direction = new THREE.Vector3(0.5, 0.65, 0.85).normalize();
  const right = new THREE.Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  const tanY = Math.tan(THREE.MathUtils.degToRad(persp.fov / 2));
  const tanX = tanY * Math.max(0.1, aspect);
  controls.target.set(W / 2, H / 2, L / 2);
  let distance = 1;
  for (const x of [-0.9, W + 0.9])
    for (const y of [0, H])
      for (const z of [-0.9, L + 0.9]) {
        const point = new THREE.Vector3(x, y, z).sub(controls.target);
        distance = Math.max(
          distance,
          Math.abs(point.dot(right)) / tanX + point.dot(direction),
          Math.abs(point.dot(up)) / tanY + point.dot(direction),
        );
      }
  distance *= 1.08;
  controls.maxDistance = Math.max(60, distance * 2);
  persp.far = Math.max(120, distance + W + L);
  persp.updateProjectionMatrix();
  persp.position.copy(controls.target).addScaledVector(direction, distance);
  controls.update();
}
function setCeiling(on) {
  $("ceilingToggle").checked = on;
  if (room) room.ceiling.visible = on;
  lighting.setPanelsVisible(on);
}
let ceilingBeforeInterior = false;
function setView(next) {
  if (photo?.active) exitPhoto();
  editor.finishDrag();
  editor.cancelPlacement();
  const wasInterior = ["door", "walk"].includes(view),
    interior = ["door", "walk"].includes(next);
  if (interior && !wasInterior) {
    ceilingBeforeInterior = $("ceilingToggle").checked;
    setCeiling(true);
  } else if (wasInterior && !interior) setCeiling(ceilingBeforeInterior);
  view = next;
  controls.enabled = next !== "walk" && next !== "plan";
  editor.enabled = next !== "walk";
  if (next === "walk") editor.select(null);
  $("planCanvas").toggleAttribute("hidden", next !== "plan");
  renderer.domElement.style.visibility = next === "plan" ? "hidden" : "";
  labels.domElement.style.display =
    next === "plan" || !$("dimsToggle").checked ? "none" : "";
  $("walkHint").hidden = next !== "walk";
  $("viewCaption").hidden = interior || next === "plan";
  $("wallMode").disabled = next !== "3d";
  $("ceilingToggle").disabled = next === "plan";
  $("photoBtn").disabled = next === "plan";
  $("viewTitle").textContent =
    next === "plan"
      ? "Every centimetre, considered."
      : "A place to do your best work.";
  $("viewSubtitle").textContent =
    next === "plan"
      ? "Drag pieces to arrange · Scroll to zoom · Drag empty space to pan"
      : "Orbit to explore · Select to make it yours";
  document.querySelectorAll("[data-view]").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === next);
    b.setAttribute("aria-pressed", String(b.dataset.view === next));
  });
  if (interior) {
    if (state.room.floorPlan) {
      const first = state.room.floorPlan.rooms[0],
        center = interiorPoint(first.points);
      const door = customDoorZones(state.room.floorPlan).find((d) => {
        const p = [
          d.hinge[0] + (d.along[0] * d.width) / 2 + d.inward[0] * 0.4,
          d.hinge[1] + (d.along[1] * d.width) / 2 + d.inward[1] * 0.4,
        ];
        return (
          inside(p, first.points) &&
          walkablePlan(state.room.floorPlan, p, state.room.wallThickness)
        );
      });
      const start = door
        ? [
            door.hinge[0] +
              (door.along[0] * door.width) / 2 +
              door.inward[0] * 0.4,
            door.hinge[1] +
              (door.along[1] * door.width) / 2 +
              door.inward[1] * 0.4,
          ]
        : center;
      persp.position.set(
        start[0],
        Math.min(1.6, state.room.ceiling - 0.25),
        start[1],
      );
      controls.target.set(
        door ? center[0] : center[0] + 0.5,
        1.4,
        door ? center[1] : center[1] - 0.5,
      );
    } else {
      const d = state.room.entranceDoor;
      persp.position.set(d.from + d.width / 2, 1.6, state.room.length - 0.35);
      controls.target.set(state.room.width / 2, 1.4, state.room.length / 2 - 1);
    }
    if (next === "walk") syncWalk();
    else controls.update();
  } else if (next === "3d") fitCamera();
  else plan.fit();
  scheduleVisual();
}
function updateWalls() {
  if (!room || photo?.active) return;
  const mode = $("wallMode").value;
  for (const g of room.walls) {
    const [nx, nz] = g.userData.normal,
      [cx, cz] = g.userData.center,
      outside = (persp.position.x - cx) * nx + (persp.position.z - cz) * nz > 0;
    const cut = outside && view === "3d";
    g.visible = !(cut && mode === "cutaway");
    const m = g.userData.material,
      target = cut && mode === "fade" ? 0.1 : 1;
    m.opacity += (target - m.opacity) * 0.3;
    m.depthWrite = m.opacity > 0.9;
  }
}
function updateHistory() {
  $("undoBtn").disabled = !history.canUndo;
  $("redoBtn").disabled = !history.canRedo;
}
function saveNow() {
  clearTimeout(saveTimer);
  try {
    saveState(snapshot());
    ui.setSaveStatus("Saved locally");
  } catch (err) {
    ui.setSaveStatus("Save failed · export a backup");
    message(`Could not save locally: ${err.message}`);
  }
}
function persist(record = true) {
  state.items = editor.serialize();
  if (record) history.record(state);
  updateHistory();
  ui?.setSaveStatus("Saving…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 180);
  scheduleVisual();
}
function applyState(s, { record = true, fit = false } = {}) {
  if (photo.active) exitPhoto();
  editor.finishDrag();
  editor.cancelPlacement();
  const selected = [...editor.selectedIds];
  state = structuredClone(s);
  state.views ??= [];
  rebuildRoom({ fit });
  editor.load(state.items, selected);
  ui.renderRoom(state.room, state.lighting);
  const activeTab = ui.getTab();
  editor.notifySelection();
  ui.setTab(activeTab);
  ui.showWall(null, state.room);
  if (view === "plan" && fit) plan.fit();
  persist(record);
}
function undo() {
  editor.finishDrag(true);
  const s = history.undo();
  if (s) {
    applyState(s, { record: false });
    message("Undone");
  }
}
function redo() {
  editor.finishDrag(true);
  const s = history.redo();
  if (s) {
    applyState(s, { record: false });
    message("Redone");
  }
}
function editable() {
  if (photo?.active) exitPhoto();
  if (view === "walk") setView("3d");
}
function designFloorPlan() {
  editable();
  editor.finishDrag();
  editor.cancelPlacement();
  openFloorPlanEditor(snapshot(), (nextRoom, keepFurniture) => {
    validateRoom(nextRoom);
    const next = {
      ...snapshot(),
      room: nextRoom,
      items: keepFurniture ? editor.serialize() : [],
    };
    const oldRoom = editor.room;
    editor.setRoom(roomInfo(nextRoom));
    for (const it of next.items) {
      const def = itemDef(CATALOG_BY_TYPE[it.type], it);
      if (def.wallMounted) editor.snapToWall(it, def);
    }
    editor.setRoom(oldRoom);
    applyState(next, { fit: true });
    setView("3d");
    message("Floor plan applied. Undo restores the previous layout.");
  });
}
$("floorPlanBtn").onclick = designFloorPlan;
ui = createUI({
  onFloorPlan: () => designFloorPlan(),
  onSpawn: (def) => {
    editable();
    editor.beginPlacement(def);
  },
  onItemChange: (patch) => {
    editable();
    editor.updateSelected(patch);
  },
  onItemAction: (a) => {
    editable();
    const actions = {
      rotateLeft: () => editor.rotateSelected(-15),
      rotateRight: () => editor.rotateSelected(15),
      duplicate: () => editor.duplicateSelected(),
      delete: () => editor.deleteSelected(),
      group: () => editor.groupSelected(),
      ungroup: () => editor.ungroupSelected(),
      alignX: () => editor.align("x"),
      alignZ: () => editor.align("z"),
    };
    actions[a]?.();
  },
  onSelectId: (id, additive = false) => {
    editable();
    editor.select(editor.items.get(id), true, additive);
  },
  onSelectIds: (ids) => {
    editable();
    editor.selectedIds = new Set(ids);
    editor.refreshSelection();
  },
  onRoomChange: (mutate) => {
    editable();
    const next = structuredClone(state.room);
    mutate(next);
    try {
      validateRoom(next);
      const oldRoom = editor.room;
      const previouslyOutside = new Set(
        editor
          .serialize()
          .filter(
            (it) => !editor.isInside(it, itemDef(CATALOG_BY_TYPE[it.type], it)),
          )
          .map((it) => it.id),
      );
      editor.setRoom(roomInfo(next));
      const trials = editor.serialize();
      for (const it of trials) {
        const def = itemDef(CATALOG_BY_TYPE[it.type], it);
        if (def.wallMounted) editor.snapToWall(it, def);
      }
      const invalid = trials.filter(
        (it) =>
          !previouslyOutside.has(it.id) &&
          !editor.isInside(it, itemDef(CATALOG_BY_TYPE[it.type], it)),
      );
      editor.setRoom(oldRoom);
      if (invalid.length)
        throw new Error(
          `Move or resize ${invalid.length} piece${invalid.length === 1 ? "" : "s"} before reducing the room.`,
        );
      state.room = next;
      const selected = [...editor.selectedIds];
      rebuildRoom();
      editor.load(trials, selected);
      ui.renderRoom(state.room, state.lighting);
      const activeTab = ui.getTab();
      editor.notifySelection();
      ui.setTab(activeTab);
      persist();
    } catch (err) {
      message(err.message);
      ui.renderRoom(state.room, state.lighting);
    }
  },
  onWallColor: (id, c) => {
    editable();
    if (id == null) state.room.wallColor = c;
    else if (c == null) delete state.room.wallColors[id];
    else state.room.wallColors[id] = c;
    for (const g of room.walls)
      g.userData.material.color.set(
        state.room.wallColors[g.userData.id] || state.room.wallColor,
      );
    ui.renderRoom(state.room, state.lighting);
    persist();
  },
  onLightingChange: (patch, commit = true) => {
    editable();
    const changedLights = patch.ceilingLights != null;
    Object.assign(state.lighting, patch);
    lighting.setHour(state.lighting.hour, roomInfo());
    if (changedLights)
      lighting.setCeilingLights(roomInfo(), state.lighting.ceilingLights);
    if (commit) persist();
  },
});
plan = new PlanView($("planCanvas"), editor, snapshot, () => warnings);
photo = new PhotoMode({
  renderer,
  scene,
  getCamera: () => persp,
  getControls: () => controls,
  onStatus: (t) => ($("photoStatus").textContent = t),
});
async function enterPhoto() {
  if (view === "plan" || photo.active) return;
  editor.finishDrag();
  editor.cancelPlacement();
  editor.select(null);
  editor.enabled = false;
  controls.enabled = true;
  diagnosticHelpers.visible = false;
  labels.domElement.style.display = "none";
  $("viewCaption").hidden = true;
  $("walkHint").hidden = true;
  $("photoBar").hidden = false;
  $("photoBtn").classList.add("active");
  $("photoSave").disabled = true;
  try {
    await photo.enter({ walls: room.walls, day: lighting.day });
    if (!photo.active) return;
    $("photoSave").disabled = !photo.ready;
  } catch (err) {
    exitPhoto();
    message(`Photo mode unavailable: ${err.message}`);
  }
}
function exitPhoto() {
  photo.exit();
  editor.enabled = view !== "walk";
  controls.enabled = view !== "walk" && view !== "plan";
  if (view === "walk") {
    persp.position.y = 1.6;
    syncWalk();
  }
  diagnosticHelpers.visible = true;
  labels.domElement.style.display =
    view === "plan" || !$("dimsToggle").checked ? "none" : "";
  $("viewCaption").hidden = view !== "3d";
  $("walkHint").hidden = view !== "walk";
  $("photoBar").hidden = true;
  $("photoBtn").classList.remove("active");
  updateWalls();
}
$("photoBtn").onclick = () => (photo.active ? exitPhoto() : enterPhoto());
$("photoExit").onclick = exitPhoto;
$("photoSave").onclick = () => photo.savePNG();
// Eye-level navigation: look with a drag, move with keys, and slide along walls.
let yaw = 0,
  pitch = 0,
  lookDrag = null;
const held = new Set();
function syncWalk() {
  const direction = controls.target.clone().sub(persp.position).normalize();
  yaw = Math.atan2(direction.x, -direction.z);
  pitch = Math.asin(direction.y);
  lookWalk();
}
function lookWalk() {
  const d = new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  );
  controls.target.copy(persp.position).add(d);
  persp.lookAt(controls.target);
}
function canWalk(x, z) {
  const r = state.room,
    nx = r.width - r.notch.width,
    nz = r.length - r.notch.depth,
    bx = r.width - r.bathroom.width,
    margin = 0.13;
  if (r.floorPlan) {
    if (!walkablePlan(r.floorPlan, [x, z], r.wallThickness, margin))
      return false;
  } else {
    if (
      x < margin ||
      z < margin ||
      x > r.width - margin ||
      z > r.length - margin
    )
      return false;
    if (x > nx - margin && z > nz - margin && z < nz + 0.1 + margin)
      return false;
    if (Math.abs(x - (nx + 0.05)) < 0.05 + margin && z > nz) {
      const start = nz + r.kitchenDoor.from;
      if (z < start + margin || z > start + r.kitchenDoor.width - margin)
        return false;
    }
    if (r.bathroom.width && Math.abs(x - bx) < 0.05 + margin && z > nz) {
      const start = nz + 0.1 + r.bathroom.door.from;
      if (z < start + margin || z > start + r.bathroom.door.width - margin)
        return false;
    }
  }
  for (const g of editor.items.values()) {
    const d = g.userData.def,
      it = g.userData.item;
    if (
      d.passable ||
      (it.elevation || 0) > 1.6 ||
      (it.elevation || 0) + d.h < 0.25
    )
      continue;
    if (
      pointInside([x, z], footprint(it, { ...d, w: d.w + 0.15, d: d.d + 0.15 }))
    )
      return false;
  }
  return true;
}
renderer.domElement.addEventListener("pointerdown", (e) => {
  if (view !== "walk" || photo.active || e.button !== 0) return;
  lookDrag = [e.clientX, e.clientY];
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener("pointermove", (e) => {
  if (!lookDrag) return;
  yaw += (e.clientX - lookDrag[0]) * 0.004;
  pitch = THREE.MathUtils.clamp(
    pitch - (e.clientY - lookDrag[1]) * 0.004,
    -1.1,
    1.1,
  );
  lookDrag = [e.clientX, e.clientY];
  lookWalk();
});
window.addEventListener("pointerup", () => (lookDrag = null));
window.addEventListener("blur", () => {
  held.clear();
  lookDrag = null;
});
window.addEventListener("keydown", (e) => {
  if (
    e.target.closest?.('input,select,textarea,[contenteditable="true"]') ||
    $("workspaceDialog").open
  )
    return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
    e.preventDefault();
    redo();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
    e.preventDefault();
    e.shiftKey ? editor.ungroupSelected() : editor.groupSelected();
    return;
  }
  if (view === "walk") {
    if (e.key === "Escape") {
      setView("3d");
      return;
    }
    if (
      [
        "w",
        "a",
        "s",
        "d",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Shift",
      ].includes(e.key)
    ) {
      e.preventDefault();
      held.add(e.key);
    }
  }
});
window.addEventListener("keyup", (e) => held.delete(e.key));
function walk(dt) {
  if (view !== "walk" || photo.active || $("workspaceDialog").open) return;
  let forward =
      (held.has("w") || held.has("ArrowUp") ? 1 : 0) -
      (held.has("s") || held.has("ArrowDown") ? 1 : 0),
    side = Number(held.has("d")) - Number(held.has("a"));
  yaw +=
    (Number(held.has("ArrowRight")) - Number(held.has("ArrowLeft"))) * dt * 1.4;
  const speed =
      (dt * (held.has("Shift") ? 2.4 : 1.25)) /
      Math.max(1, Math.hypot(forward, side)),
    dx = (Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed,
    dz = (-Math.cos(yaw) * forward + Math.sin(yaw) * side) * speed;
  if (canWalk(persp.position.x + dx, persp.position.z)) persp.position.x += dx;
  if (canWalk(persp.position.x, persp.position.z + dz)) persp.position.z += dz;
  lookWalk();
}
// Layout snapshots are deliberately separate from the current editing history.
function writeLayouts(next) {
  try {
    saveLayouts(next);
    layouts = next;
    $("layoutCount").textContent = layouts.length;
    return true;
  } catch (err) {
    message(`Could not save layouts: ${err.message}`);
    return false;
  }
}
function layoutsDialog() {
  const list = el("div", { class: "dialog-list" });
  for (const l of layouts) {
    const title = el("strong", {}, [
      l.name,
      el("small", {}, [
        `${l.state.items.length} pieces · ${l.state.room.width.toFixed(2)} × ${l.state.room.length.toFixed(2)} m`,
      ]),
    ]);
    list.append(
      el("div", { class: "saved-row" }, [
        title,
        button("Open", () => {
          applyState(l.state, { fit: true });
          closeDialog();
          message(`Opened “${l.name}”. Undo restores the previous layout.`);
        }),
        button("Compare", () => compareLayout(l)),
        button("Update", () => {
          if (
            writeLayouts(
              layouts.map((saved) =>
                saved.id === l.id
                  ? { ...saved, state: structuredClone(snapshot()) }
                  : saved,
              ),
            )
          ) {
            layoutsDialog();
            message(`Updated “${l.name}”.`);
          }
        }),
        button(
          "Delete",
          () => {
            if (
              confirm(
                `Delete saved layout “${l.name}”? The current room will stay as it is.`,
              )
            ) {
              if (writeLayouts(layouts.filter((v) => v.id !== l.id)))
                layoutsDialog();
            }
          },
          "danger",
        ),
      ]),
    );
  }
  openDialog("A little room for alternatives", [
    el("p", { class: "hint" }, [
      "Save a named version, explore another idea, then compare the plans side by side. Your current layout continues to autosave.",
    ]),
    nameForm("Save layout", "e.g. Open workspace", (name) => {
      if (layouts.length >= 30)
        return message("You can keep up to 30 saved layouts.");
      if (
        writeLayouts([
          ...layouts,
          { id: uid(), name, state: structuredClone(snapshot()) },
        ])
      )
        layoutsDialog();
    }),
    ...(layouts.length
      ? [list]
      : [
          el("p", { class: "empty" }, [
            "No saved alternatives yet. Save this arrangement to start.",
          ]),
        ]),
  ]);
}
function compareLayout(l) {
  const grid = el("div", { class: "compare-grid" });
  for (const [name, s] of [
    ["Current layout", snapshot()],
    [l.name, l.state],
  ]) {
    const card = el("div", { class: "compare-card" }, [el("h3", {}, [name])]),
      drawing = el("div");
    drawing.innerHTML = planSVG(s);
    card.append(drawing);
    grid.append(card);
  }
  openDialog("Compare your ideas", [
    grid,
    button("Back to layouts", layoutsDialog, "text-button"),
  ]);
}
function camerasDialog() {
  const list = el("div", { class: "dialog-list" });
  for (const [i, v] of (state.views || []).entries())
    list.append(
      el("div", { class: "saved-row" }, [
        el("strong", {}, [
          v.name,
          el("small", {}, [
            v.view === "plan"
              ? "Plan drawing"
              : v.view === "walk"
                ? "Walkthrough"
                : "3D camera",
          ]),
        ]),
        button("Go to view", () => {
          setView(v.view);
          persp.position.fromArray(v.position);
          controls.target.fromArray(v.target);
          if (v.view === "walk") syncWalk();
          else if (v.view === "plan" && v.planBox) {
            plan.box = [...v.planBox];
            plan.render();
          } else controls.update();
          closeDialog();
        }),
        button(
          "Delete",
          () => {
            state.views.splice(i, 1);
            persist();
            camerasDialog();
          },
          "danger",
        ),
      ]),
    );
  openDialog("Keep the best angles", [
    el("p", { class: "hint" }, [
      "Save the current camera or plan framing. Camera bookmarks are included in your layout files.",
    ]),
    nameForm("Save camera", "e.g. Window-side view", (name) => {
      if (state.views.length >= 30)
        return message("You can keep up to 30 camera views.");
      state.views.push({
        name,
        view,
        position: persp.position.toArray(),
        target: controls.target.toArray(),
        ...(view === "plan" ? { planBox: [...plan.box] } : {}),
      });
      persist();
      camerasDialog();
    }),
    list,
  ]);
}
async function exportImage() {
  closeDialog();
  if (view === "plan") return exportPlan(snapshot(), "png");
  if (photo.active && photo.ready) {
    photo.savePNG();
    return;
  }
  const outlineVisible = editor.outlines.map((o) => o.visible);
  editor.outlines.forEach((o) => (o.visible = false));
  diagnosticHelpers.visible = false;
  const preview = editor.preview?.g;
  if (preview) preview.visible = false;
  try {
    composer.render();
    const data = renderer.domElement.toDataURL("image/png"),
      a = document.createElement("a");
    a.href = data;
    a.download = "offiz-view.png";
    a.click();
  } finally {
    editor.outlines.forEach((o, i) => (o.visible = outlineVisible[i]));
    diagnosticHelpers.visible = true;
    if (preview) preview.visible = true;
  }
}
function exportDialog() {
  openDialog("Take your ideas with you", [
    el("p", { class: "hint" }, [
      "Export a dimensioned drawing, a clean image of the current view, or an editable layout file.",
    ]),
    el("div", { class: "export-grid" }, [
      button("Floor plan · SVG\nScalable drawing with dimensions", () => {
        exportPlan(snapshot(), "svg");
        closeDialog();
      }),
      button("Floor plan · PNG\nHigh resolution, ready to share", () => {
        closeDialog();
        exportPlan(snapshot(), "png")
          .then(() => message("Floor plan PNG prepared. Check your downloads."))
          .catch((e) => message(e.message));
      }),
      button("Current view · PNG\nCapture the current camera", () =>
        exportImage().catch((e) => message(e.message)),
      ),
      button("Layout · JSON\nFurniture, materials and cameras", () => {
        exportState(snapshot());
        closeDialog();
      }),
    ]),
    button(
      "Refine a photo first",
      () => {
        closeDialog();
        if (view === "plan") setView("3d");
        enterPhoto();
      },
      "text-button",
    ),
  ]);
}
$("layoutsBtn").onclick = layoutsDialog;
$("layoutCount").textContent = layouts.length;
$("camerasBtn").onclick = camerasDialog;
$("exportBtn").onclick = exportDialog;
$("moreBtn").onclick = () =>
  openDialog("Workspace files", [
    el("div", { class: "row" }, [
      button("Import layout JSON", () => $("importFile").click()),
      button(
        "Reset to starter layout",
        () => {
          applyState(defaultState(), { fit: true });
          closeDialog();
          message(
            "Starter layout restored. Undo returns to your previous room.",
          );
        },
        "danger",
      ),
    ]),
    ...(getRecoveryState()
      ? [
          button("Download original saved file", () =>
            downloadBlob(
              new Blob([getRecoveryState()], { type: "application/json" }),
              "offiz-recovery.json",
            ),
          ),
        ]
      : []),
    sectionHelp(),
  ]);
function sectionHelp() {
  return el("p", { class: "hint" }, [
    "⌘/Ctrl Z undo · ⇧⌘/Ctrl Z redo · Shift-click multi-select · ⌘/Ctrl G group · ⇧⌘/Ctrl G ungroup · R/Shift R rotate · D duplicate · Arrows nudge 5 cm (Shift: 25 cm) · Esc cancel placement or deselect.",
  ]);
}
$("importFile").onchange = async (e) => {
  const f = e.target.files?.[0];
  if (f)
    try {
      const next = await importState(f);
      applyState(next, { fit: true });
      closeDialog();
      message("Layout imported. Undo restores your previous room.");
    } catch (err) {
      message(`Could not import: ${err.message}`);
    }
  e.target.value = "";
};
$("undoBtn").onclick = undo;
$("redoBtn").onclick = redo;
document
  .querySelectorAll("[data-view]")
  .forEach((b) => (b.onclick = () => setView(b.dataset.view)));
$("fitBtn").onclick = () =>
  view === "walk" || view === "door" ? setView(view) : fitCamera();
$("dimsToggle").onchange = () => {
  plan.dimensions = $("dimsToggle").checked;
  plan.render();
  labels.domElement.style.display =
    view === "plan" || photo.active || !$("dimsToggle").checked ? "none" : "";
};
$("snapToggle").onchange = (e) => (editor.snap = e.target.checked);
$("ceilingToggle").onchange = (e) => {
  if (photo.active) exitPhoto();
  setCeiling(e.target.checked);
};
$("wallMode").onchange = () => {
  if (photo.active) exitPhoto();
  updateWalls();
};
for (const name of ["catalog", "inspector"])
  $(name + "Toggle").onclick = () => {
    const hidden = $("app").classList.toggle(name + "-hidden");
    $(name + "Toggle").setAttribute("aria-expanded", String(!hidden));
  };
if (innerWidth <= 760)
  for (const name of ["catalog", "inspector"]) {
    $("app").classList.add(name + "-hidden");
    $(name + "Toggle").setAttribute("aria-expanded", "false");
  }
window.addEventListener("beforeunload", saveNow);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    held.clear();
    saveNow();
  }
});
function resize() {
  const w = Math.max(1, viewport.clientWidth),
    h = Math.max(1, viewport.clientHeight);
  renderer.setSize(w, h);
  composer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  composer.setSize(w, h);
  labels.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  if (photo.active) photo.tracer?.updateCamera();
}
new ResizeObserver(resize).observe(viewport);
rebuildRoom({ fit: true });
editor.load(state.items);
ui.renderRoom(state.room, state.lighting);
plan.fit();
refreshVisual();
updateHistory();
resize();
if (loadError) {
  ui.setSaveStatus("Saved file needs recovery");
  message(
    "The saved file could not load. Its original contents are available under ••• → Download original saved file.",
  );
}
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(0.04, (now - previous) / 1000);
  previous = now;
  if (view === "plan") return;
  walk(dt);
  if (view !== "walk" || photo.active) controls.update();
  if (photo.active) {
    photo.render();
    return;
  }
  updateWalls();
  composer.render();
  labels.render(scene, persp);
});
