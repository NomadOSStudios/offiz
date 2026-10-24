// Sun through the window wall, sky ambient, and ceiling lights.
import * as THREE from 'three';

const SKY_DAY = new THREE.Color('#dfe9f3');
const SKY_NIGHT = new THREE.Color('#1b1f2a');
const SUN_LOW = new THREE.Color('#ffb070');
const SUN_HIGH = new THREE.Color('#fff7ec');

export function createLighting(scene) {
  const hemi = new THREE.HemisphereLight('#dfe8f3', '#6b6256', 0.6);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);

  const ceiling = new THREE.Group();
  scene.add(ceiling);
  const panelMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff3dc', emissiveIntensity: 1.2 });
  const panels = [];
  let panelsVisible = false;

  // The light panels only make sense when the ceiling itself is drawn.
  function setPanelsVisible(v) {
    panelsVisible = v;
    for (const p of panels) p.visible = v;
  }

  function setCeilingLights(room, on) {
    ceiling.clear();
    panels.length = 0;
    const { W, L, nw, nd } = room;
    const spots = [
      [W / 2 - 1.6, (L - nd) / 2 - 1.2],
      [W / 2 + 1.6, (L - nd) / 2 - 1.2],
      [W / 2 - 1.6, (L - nd) / 2 + 1.4],
      [W / 2 + 1.6, (L - nd) / 2 + 1.4],
      [(W - nw) / 2, L - 1.0],
    ];
    // One light in the middle of each small room.
    for (const poly of [room.polygons?.kitchen, room.polygons?.bathroom]) {
      if (poly) spots.push([poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length]);
    }
    for (const [x, z] of spots) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.6), panelMat);
      panel.position.set(x, room.ceiling - 0.02, z);
      panel.visible = panelsVisible;
      panels.push(panel);
      ceiling.add(panel);
      const light = new THREE.PointLight('#fff2dc', 14, 8, 2);
      light.position.set(x, room.ceiling - 0.12, z);
      ceiling.add(light);
    }
    ceiling.visible = on;
  }

  // hour in [6, 20]. The sun travels along the window wall, which is at z = 0.
  function setHour(hour, room) {
    const t = THREE.MathUtils.clamp((hour - 6) / 14, 0, 1);
    const day = Math.sin(Math.PI * t);
    const elev = day * THREE.MathUtils.degToRad(62);
    const az = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-70, 70, t));
    const R = 30;
    const cx = room.W / 2;
    const cz = room.L / 2;
    sun.position.set(cx + Math.sin(az) * Math.cos(elev) * R, Math.max(0.5, Math.sin(elev) * R), cz - Math.cos(az) * Math.cos(elev) * R);
    sun.target.position.set(cx, 0, cz);
    sun.intensity = 2.8 * day;
    sun.color.copy(SUN_LOW).lerp(SUN_HIGH, Math.min(1, day * 1.6));
    // The environment map carries most of the ambient now; the hemisphere
    // light just keeps the floor from going black at night.
    hemi.intensity = 0.08 + 0.3 * day;
    hemi.color.copy(SKY_NIGHT).lerp(new THREE.Color('#dfe8f3'), day);
    scene.environmentIntensity = 0.08 + 0.27 * day;
    scene.background = SKY_NIGHT.clone().lerp(SKY_DAY, Math.min(1, day * 1.4));
    api.day = day;
  }

  const api = { sun, hemi, ceiling, setHour, setCeilingLights, setPanelsVisible, day: 1 };
  return api;
}
