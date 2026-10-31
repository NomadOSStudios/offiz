// Standalone model viewer. Does not read or write the saved layout.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { CATALOG, CATEGORIES, buildItem } from "./catalog.js";
import { makeThumbnails } from "./thumbnails.js";
const stage = document.getElementById("stage"),
  renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.append(renderer.domElement);
renderer.domElement.setAttribute("aria-label", "Interactive furniture model");
const scene = new THREE.Scene();
scene.background = new THREE.Color("#e9e8e2");
const env = new RoomEnvironment(),
  pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(env, 0.04).texture;
env.dispose();
pmrem.dispose();
scene.add(new THREE.HemisphereLight("#ffffff", "#a4b5a4", 2.1));
const light = new THREE.DirectionalLight("#fff3e0", 3);
light.position.set(3, 6, 5);
light.castShadow = true;
light.shadow.mapSize.set(2048, 2048);
light.shadow.normalBias = 0.015;
light.shadow.bias = -0.0003;
scene.add(light);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  new THREE.MeshStandardMaterial({ color: "#e9e8e2", roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.002;
floor.receiveShadow = true;
scene.add(floor);
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100),
  controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.49;
let item;
function fit() {
  const box = new THREE.Box3().setFromObject(item),
    center = box.getCenter(new THREE.Vector3());
  controls.target.copy(center);
  const direction = new THREE.Vector3(0.85, 0.57, 1.2).normalize();
  camera.position.copy(center).add(direction);
  camera.lookAt(center);
  const inverse = camera.quaternion.clone().invert();
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  let distance = 0;
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z)
          .sub(center)
          .applyQuaternion(inverse);
        distance = Math.max(
          distance,
          p.z + Math.abs(p.x) / (tanY * camera.aspect),
          p.z + Math.abs(p.y) / tanY,
        );
      }
  camera.position.copy(center).addScaledVector(direction, distance * 1.23);
  controls.update();
}
function show(def) {
  if (item) {
    item.removeFromParent();
    item.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
  item = buildItem(def);
  scene.add(item);
  fit();
  document.getElementById("name").textContent = def.name;
  document.getElementById("detail").textContent =
    `${def.cat} · ${Math.round(def.w * 100)} × ${Math.round(def.d * 100)} × ${Math.round(def.h * 100)} cm`;
  document
    .querySelectorAll(".tile")
    .forEach((b) =>
      b.setAttribute("aria-pressed", b.dataset.type === def.type),
    );
}
const thumbs = makeThumbnails(CATALOG),
  select = document.querySelector("select"),
  library = document.querySelector(".library");
for (const cat of CATEGORIES) {
  const o = document.createElement("option");
  o.textContent = cat;
  select.append(o);
}
for (const def of CATALOG) {
  const b = document.createElement("button");
  b.className = "tile";
  b.dataset.type = def.type;
  b.dataset.category = def.cat;
  b.setAttribute("aria-label", `View ${def.name}, ${def.size}`);
  const img = document.createElement("img");
  img.src = thumbs.get(def.type);
  img.alt = "";
  const name = document.createElement("span");
  name.textContent = def.name;
  b.append(img, name);
  b.onclick = () => show(def);
  library.append(b);
}
select.onchange = () => {
  document
    .querySelectorAll(".tile")
    .forEach(
      (b) =>
        (b.hidden =
          select.value !== "All categories" &&
          b.dataset.category !== select.value),
    );
};
document.getElementById("fit").onclick = fit;
new ResizeObserver(() => {
  const { width, height } = stage.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (item) fit();
}).observe(stage);
show(CATALOG.find((d) => d.type === "sectional"));
renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
