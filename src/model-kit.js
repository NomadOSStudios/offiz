// Shared furniture construction. Dimensions are metres, origin is bottom-centre,
// and the usable/front side faces +Z. Maps are small, deterministic, and shared;
// geometries and materials belong to each item so editor disposal is safe.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { rng } from "./textures.js";

const maps = new Map();
function surfaceMap(kind) {
  if (maps.has(kind)) return maps.get(kind);
  const size = 128,
    data = new Uint8Array(size * size * 4),
    random = rng(37);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const grain = Math.sin(
        y * 0.8 + Math.sin(x * 0.049) * 2 + Math.sin(y * 0.23),
      );
      const weave = x % 4 < 2 !== y % 4 < 2 ? 1 : -1;
      const v =
        kind === "wood"
          ? 232 + grain * 10 + (random() - 0.5) * 9
          : kind === "fabric"
            ? 230 + weave * 9 + (random() - 0.5) * 16
            : kind === "mesh"
              ? x % 8 < 2 || y % 8 < 2
                ? 238
                : 130
              : 235 + (random() - 0.5) * 22;
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  t.name = `Furniture ${kind}`;
  maps.set(kind, t);
  return t;
}

export function mat(color, opts = {}) {
  const { surface, ...properties } = opts;
  const m = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.65,
    ...properties,
  });
  if (surface) {
    m.map = surfaceMap(surface);
    m.bumpMap = m.map;
    m.bumpScale =
      surface === "wood" ? 0.0008 : surface === "mesh" ? 0.001 : 0.0013;
    m.userData.surface = surface;
  }
  return m;
}
export const wood = (c) => mat(c, { surface: "wood", roughness: 0.5 });
export const fabric = (c) => mat(c, { surface: "fabric", roughness: 0.94 });
export const metal = (c = "#42484b") =>
  mat(c, { metalness: 0.65, roughness: 0.32 });
export const chrome = () => mat("#d4d8dc", { metalness: 0.9, roughness: 0.22 });
export const rubber = () => mat("#24292b", { roughness: 0.92 });

// Object-space UVs keep grain and weave at the same density on resized panels.
function surfaceUV(geo, material) {
  if (!material.userData.surface) return;
  const pos = geo.attributes.position,
    normal = geo.attributes.normal,
    uv = geo.attributes.uv;
  const density =
    material.userData.surface === "wood"
      ? 2
      : material.userData.surface === "mesh"
        ? 5
        : 8;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(normal.getX(i)),
      ny = Math.abs(normal.getY(i)),
      nz = Math.abs(normal.getZ(i));
    const u = nx > ny && nx > nz ? pos.getZ(i) : pos.getX(i);
    const v = ny >= nx && ny >= nz ? pos.getZ(i) : pos.getY(i);
    uv.setXY(i, u * density, v * density);
  }
}
export function mesh(geo, material, x = 0, y = 0, z = 0) {
  surfaceUV(geo, material);
  const o = new THREE.Mesh(geo, material);
  o.position.set(x, y, z);
  o.castShadow = o.receiveShadow = true;
  return o;
}
export function box(w, h, d, material, x = 0, y = 0, z = 0, radius = 0.008) {
  const geo =
    radius > 0
      ? new RoundedBoxGeometry(
          w,
          h,
          d,
          radius > 0.025 ? 3 : 2,
          Math.min(radius, w / 2, h / 2, d / 2),
        )
      : new THREE.BoxGeometry(w, h, d);
  return mesh(geo, material, x, y + h / 2, z);
}
export function cylinder(
  rt,
  rb,
  h,
  material,
  x = 0,
  y = 0,
  z = 0,
  segments = 24,
  open = false,
) {
  return mesh(
    new THREE.CylinderGeometry(rt, rb, h, segments, 1, open),
    material,
    x,
    y + h / 2,
    z,
  );
}
export function ellipsoid(w, h, d, material, x = 0, y = 0, z = 0) {
  const geo = new THREE.SphereGeometry(1, 24, 12);
  geo.scale(w / 2, h / 2, d / 2);
  return mesh(geo, material, x, y + h / 2, z);
}
export function rod(a, b, radius, material, endRadius = radius) {
  const from = new THREE.Vector3(...a),
    to = new THREE.Vector3(...b),
    dir = to.clone().sub(from);
  const o = cylinder(endRadius, radius, dir.length(), material);
  o.position.copy(from.add(to).multiplyScalar(0.5));
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return o;
}
export function tube(points, radius, material, closed = false, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    closed,
    "centripetal",
  );
  return mesh(
    new THREE.TubeGeometry(curve, segments, radius, 6, closed),
    material,
  );
}
export function ring(rx, rz, radius, material, y = 0, x = 0, z = 0) {
  const geo = new THREE.TorusGeometry(1, radius / Math.max(rx, rz), 8, 48);
  geo.rotateX(Math.PI / 2);
  geo.scale(rx, Math.max(rx, rz), rz);
  return mesh(geo, material, x, y, z);
}
export function lathe(profile, material, x = 0, y = 0, z = 0) {
  return mesh(
    new THREE.LatheGeometry(
      profile.map(([r, h]) => new THREE.Vector2(r, h)),
      32,
    ),
    material,
    x,
    y,
    z,
  );
}
export function piping(w, d, material, y, x = 0, z = 0, radius = 0.0025) {
  const r = Math.min(w, d) * 0.12;
  return tube(
    [
      [x - w / 2 + r, y, z - d / 2],
      [x + w / 2 - r, y, z - d / 2],
      [x + w / 2, y, z - d / 2 + r],
      [x + w / 2, y, z + d / 2 - r],
      [x + w / 2 - r, y, z + d / 2],
      [x - w / 2 + r, y, z + d / 2],
      [x - w / 2, y, z + d / 2 - r],
      [x - w / 2, y, z - d / 2 + r],
    ],
    radius,
    material,
    true,
    40,
  );
}

// Many small details, few draw calls. Bake each material into a single mesh.
// Keep lights separately; no geometry or materials are shared between items.
export function finishModel(group, primary = []) {
  group.updateMatrixWorld(true);
  const batches = new Map(),
    sources = [];
  group.traverse((o) => {
    if (!o.isMesh) return;
    const key = `${o.material.uuid}/${o.castShadow}/${o.receiveShadow}`;
    if (!batches.has(key))
      batches.set(key, {
        material: o.material,
        cast: o.castShadow,
        receive: o.receiveShadow,
        geometries: [],
      });
    const geo = o.geometry.index
      ? o.geometry.toNonIndexed()
      : o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    geo.clearGroups();
    batches.get(key).geometries.push(geo);
    sources.push(o);
  });
  for (const o of sources) {
    o.removeFromParent();
    o.geometry.dispose();
  }
  for (const batch of batches.values()) {
    const geo = mergeGeometries(batch.geometries);
    for (const g of batch.geometries) g.dispose();
    const o = new THREE.Mesh(geo, batch.material);
    o.castShadow = batch.cast;
    o.receiveShadow = batch.receive;
    group.add(o);
  }
  group.userData.primary = primary;
  return group;
}
