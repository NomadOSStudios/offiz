import * as THREE from "three";
import { buildItem } from "./catalog.js";
export function makeThumbnails(catalog) {
  const urls = new Map();
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(180, 112);
    renderer.setPixelRatio(1);
    renderer.setClearColor("#22292b", 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#71807b", 2.8));
    const sun = new THREE.DirectionalLight("#fff3dc", 3);
    sun.position.set(3, 5, 4);
    scene.add(sun);
    const camera = new THREE.OrthographicCamera(-1.6, 1.6, 1, -1, 0.01, 50);
    for (const def of catalog) {
      const g = buildItem(def);
      scene.add(g);
      const box = new THREE.Box3().setFromObject(g),
        c = box.getCenter(new THREE.Vector3()),
        size = box.getSize(new THREE.Vector3()),
        scale = Math.max(size.y, size.x * 0.7, size.z * 0.7) * 0.8 + 0.08;
      camera.left = -scale * 1.6;
      camera.right = scale * 1.6;
      camera.top = scale;
      camera.bottom = -scale;
      camera.position.copy(c).add(new THREE.Vector3(4, 3, 5));
      camera.lookAt(c);
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
      urls.set(def.type, renderer.domElement.toDataURL());
      g.removeFromParent();
      g.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
  } catch (err) {
    console.warn("Catalog thumbnails unavailable", err);
  } finally {
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  return urls;
}
