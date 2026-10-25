import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  CATALOG,
  CATALOG_BY_TYPE,
  buildItem,
  itemDef,
} from "../src/catalog.js";

function dispose(g) {
  g.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
}
function checkEnvelope(def) {
  const g = buildItem(def),
    box = new THREE.Box3().setFromObject(g);
  const eps = 1e-5;
  assert.ok(
    Math.abs(box.min.y) < eps,
    `${def.type}: rests on its placement plane`,
  );
  assert.ok(box.max.y <= def.h + eps, `${def.type}: height`);
  assert.ok(
    box.min.x >= -def.w / 2 - eps && box.max.x <= def.w / 2 + eps,
    `${def.type}: width`,
  );
  assert.ok(
    box.min.z >= -def.d / 2 - eps && box.max.z <= def.d / 2 + eps,
    `${def.type}: depth`,
  );
  let meshes = 0,
    triangles = 0;
  g.traverse((o) => {
    if (!o.isMesh) return;
    meshes++;
    triangles += o.geometry.attributes.position.count / 3;
    assert.equal(o.userData.item, true, `${def.type}: selectable`);
    for (const attr of Object.values(o.geometry.attributes))
      assert.ok(
        attr.array.every(Number.isFinite),
        `${def.type}: finite vertex data`,
      );
    assert.ok(
      Number.isFinite(o.geometry.boundingSphere.radius),
      `${def.type}: valid culling bounds`,
    );
  });
  assert.ok(meshes > 0 && meshes <= 16, `${def.type}: ${meshes} draw calls`);
  assert.ok(triangles < 40000, `${def.type}: ${triangles} triangles`);
  dispose(g);
}

test("every catalog model stays in its declared placement envelope with finite geometry and bounded detail", () => {
  for (const def of CATALOG) checkEnvelope(def);
});
test("resized models remain valid at minimum sizes, large sizes and changed aspect ratios", () => {
  for (const def of CATALOG) {
    for (const override of [
      { w: 0.1, d: 0.1, h: 0.1 },
      { w: def.w * 1.8, d: def.d * 0.6, h: def.h * 1.25 },
    ])
      checkEnvelope(itemDef(def, override));
  }
});
test("custom finishes and preview mutations are isolated between duplicate furniture", () => {
  const def = CATALOG_BY_TYPE.sofa,
    a = buildItem(def, "#355c4c"),
    b = buildItem(def, "#355c4c");
  const originals = b.children
    .filter((o) => o.isMesh)
    .map((o) => o.material.color.getHexString());
  assert.ok(originals.includes("355c4c"));
  a.traverse((o) => {
    if (o.isMesh) {
      o.material.color.set("#ff0000");
      o.material.opacity = 0.5;
      o.geometry.translate(10, 0, 0);
    }
  });
  assert.deepEqual(
    b.children
      .filter((o) => o.isMesh)
      .map((o) => o.material.color.getHexString()),
    originals,
  );
  assert.ok(new THREE.Box3().setFromObject(b).max.x < 1);
  dispose(a);
  dispose(b);
});
test("sink openings expose recessed bowls instead of hidden or solid cabinet tops", () => {
  for (const [type, x, deckY] of [
    ["counter", -0.46, 0.9 * 0.81],
    ["basin", 0, 0.95 * 0.84],
  ]) {
    const g = buildItem(CATALOG_BY_TYPE[type]);
    g.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(x, 2, 0),
      new THREE.Vector3(0, -1, 0),
    );
    const hit = ray.intersectObject(g, true)[0];
    assert.ok(hit, `${type}: a visible bowl`);
    assert.ok(
      hit.point.y < deckY - 0.07 && hit.point.y > deckY - 0.16,
      `${type}: recessed ${deckY - hit.point.y}m`,
    );
    dispose(g);
  }
});
test("wall art and mirrors expose their inset faces through the frame", () => {
  for (const type of ["artFrame", "mirror"]) {
    const def = CATALOG_BY_TYPE[type],
      g = buildItem(def);
    g.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(
      new THREE.Vector3(0, def.h * 0.6, 1),
      new THREE.Vector3(0, 0, -1),
    );
    const hit = ray.intersectObject(g, true)[0];
    assert.ok(hit && hit.point.z > 0, `${type}: face visible`);
    if (type === "mirror") {
      assert.notEqual(
        hit.object.material,
        g.userData.primary[0],
        "mirror glass is visible, not the frame",
      );
      assert.ok(hit.object.material.metalness > 0.9);
    }
    if (type === "artFrame")
      assert.equal(
        hit.object.material.userData.surface,
        undefined,
        "art is visible, not frame wood",
      );
    dispose(g);
  }
});
