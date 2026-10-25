import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildItem } from "./catalog.js";
export function makeThumbnails(catalog) {
  const urls = new Map();
  let renderer, environment, target, pmrem;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(240, 156);
    renderer.setPixelRatio(1);
    renderer.setClearColor("#22292b", 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    const scene = new THREE.Scene();
    pmrem = new THREE.PMREMGenerator(renderer);
    environment = new RoomEnvironment();
    target = pmrem.fromScene(environment, 0.04);
    scene.environment = target.texture;
    scene.add(new THREE.HemisphereLight("#ffffff", "#b8c5c0", 2));
    const sun = new THREE.DirectionalLight("#fff3df", 3);
    sun.position.set(3, 5, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.bias = -0.001;
    sun.shadow.normalBias = 0.02;
    scene.add(sun);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.ShadowMaterial({ opacity: 0.18 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.002;
    ground.receiveShadow = true;
    scene.add(ground);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50),
      aspect = 240 / 156;
    for (const def of catalog) {
      const g = buildItem(def);
      scene.add(g);
      const box = new THREE.Box3().setFromObject(g),
        c = box.getCenter(new THREE.Vector3());
      camera.position.copy(c).add(new THREE.Vector3(4, 2.8, 5));
      camera.lookAt(c);
      camera.updateMatrixWorld();
      // Project the actual model envelope, including wide and flat pieces.
      let sx = 0,
        sy = 0;
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            const p = new THREE.Vector3(x, y, z).applyMatrix4(
              camera.matrixWorldInverse,
            );
            sx = Math.max(sx, Math.abs(p.x));
            sy = Math.max(sy, Math.abs(p.y));
          }
      const scale = Math.max(sy, sx / aspect) * 1.13;
      camera.left = -scale * aspect;
      camera.right = scale * aspect;
      camera.top = scale;
      camera.bottom = -scale;
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      urls.set(def.type, renderer.domElement.toDataURL());
      g.removeFromParent();
      g.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    ground.geometry.dispose();
    ground.material.dispose();
  } catch (err) {
    console.warn("Catalog thumbnails unavailable", err);
  } finally {
    target?.dispose();
    environment?.dispose();
    pmrem?.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return urls;
}
