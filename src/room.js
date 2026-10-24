// Builds the room shell (walls, openings, floors, ceiling, dimension labels)
// from the room config. Rebuilt whenever a room setting changes.
import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { getFloorTexture } from './textures.js';

export const WALL_NAMES = {
  north: 'Window wall',
  east: 'Right wall',
  south: 'Entrance wall',
  west: 'Left wall',
  kitchenNorth: 'Long partition',
  kitchenWest: 'Side partition (kitchen door)',
  bathWall: 'Kitchen / bathroom wall',
};

// Interior partitions are this thick and sit inside the notch, so every
// polygon below is a room's actual inner faces.
export const PARTITION = 0.1;

export function roomPolygons(cfg) {
  const W = cfg.width;
  const L = cfg.length;
  const pt = PARTITION;
  const nw = Math.min(cfg.notch.width, W - 0.5);
  const nd = Math.min(cfg.notch.depth, L - 0.5);
  // The bathroom is the far-right part of the notch, full depth; 0 = none.
  const bwRaw = Math.max(0, Math.min(cfg.bathroom?.width ?? 0, nw - 0.8));
  const bw = bwRaw > 0.3 ? bwRaw : 0;
  const office = [
    [0, 0],
    [W, 0],
    [W, L - nd],
    [W - nw, L - nd],
    [W - nw, L],
    [0, L],
  ];
  const kx = bw ? W - bw - pt / 2 : W;
  const kitchen = [
    [W - nw + pt, L - nd + pt],
    [kx, L - nd + pt],
    [kx, L],
    [W - nw + pt, L],
  ];
  const bathroom = bw
    ? [
        [W - bw + pt / 2, L - nd + pt],
        [W, L - nd + pt],
        [W, L],
        [W - bw + pt / 2, L],
      ]
    : null;
  return { office, kitchen, bathroom, W, L, nw, nd, bw };
}

export function centroid(poly) {
  const n = poly.length;
  return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
}

export function pointInPolygon([x, z], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function polygonArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  }
  return Math.abs(a / 2);
}

// Wall segment a → b (plan coords). For the clockwise polygons above the
// outward normal is (dz, -dx). Pieces are boxes so openings are simply gaps.
function buildWall({ a, b, height, thickness, offset = 0, openings = [], material, extendStart = 0, extendEnd = 0, id }) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const nx = uz;
  const nz = -ux;
  const g = new THREE.Group();
  g.userData = {
    kind: 'wall',
    id,
    normal: [nx, nz],
    center: [(a[0] + b[0]) / 2 + nx * offset, (a[1] + b[1]) / 2 + nz * offset],
    material,
  };
  const rotY = Math.atan2(-uz, ux);
  const at = (t) => [a[0] + ux * t + nx * offset, a[1] + uz * t + nz * offset];

  const piece = (s, e, y0, y1) => {
    if (e - s <= 0.001 || y1 - y0 <= 0.001) return;
    // Floor-standing pieces sink into the slab so no seam shows at the base.
    if (y0 === 0) y0 = -0.05;
    const m = new THREE.Mesh(new THREE.BoxGeometry(e - s, y1 - y0, thickness), material);
    const [px, pz] = at((s + e) / 2);
    m.position.set(px, (y0 + y1) / 2, pz);
    m.rotation.y = rotY;
    m.castShadow = m.receiveShadow = true;
    m.userData.wallId = id;
    g.add(m);
  };

  const ops = openings
    .map((o) => ({ ...o, from: Math.max(0, o.from), to: Math.min(len, o.to) }))
    .filter((o) => o.to - o.from > 0.05)
    .sort((p, q) => p.from - q.from);
  let cursor = -extendStart;
  for (const o of ops) {
    const from = Math.max(cursor, o.from);
    piece(cursor, from, 0, height);
    if (o.bottom > 0) piece(from, o.to, 0, o.bottom);
    if (o.top < height) piece(from, o.to, o.top, height);
    cursor = o.to;
  }
  piece(cursor, len + extendEnd, 0, height);

  // Frames, glass, leaves and swing arcs for openings.
  for (const o of ops) {
    const w = o.to - o.from;
    const [cx, cz] = at((o.from + o.to) / 2);
    const h = o.top - o.bottom;
    if (o.kind === 'window') {
      const glassMat = new THREE.MeshPhysicalMaterial({ color: '#bcd8f0', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0 });
      glassMat.userData.glass = true; // photo mode swaps this for real glass
      const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), glassMat);
      glass.position.set(cx, (o.top + o.bottom) / 2, cz);
      glass.rotation.y = rotY;
      g.add(glass);
      const fm = new THREE.MeshStandardMaterial({ color: '#3b3f45', roughness: 0.5, metalness: 0.4 });
      const frame = new THREE.Group();
      const bar = (bw, bh, bx, by) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, thickness * 0.5), fm);
        m.position.set(bx, by, 0);
        m.castShadow = true;
        frame.add(m);
      };
      bar(w, 0.06, 0, h / 2 - 0.03);
      bar(w, 0.06, 0, -h / 2 + 0.03);
      bar(0.06, h, -w / 2 + 0.03, 0);
      bar(0.06, h, w / 2 - 0.03, 0);
      const mullions = Math.max(0, Math.round(w / 1.3) - 1);
      for (let i = 1; i <= mullions; i++) bar(0.04, h, -w / 2 + (w * i) / (mullions + 1), 0);
      frame.position.set(cx, (o.top + o.bottom) / 2, cz);
      frame.rotation.y = rotY;
      g.add(frame);
    }
    if (o.kind === 'door') {
      const fm = new THREE.MeshStandardMaterial({ color: '#d9d4c7', roughness: 0.7 });
      const leafMat = new THREE.MeshStandardMaterial({ color: o.color || '#8b6b4e', roughness: 0.6 });
      const door = new THREE.Group();
      const bar = (bw, bh, bx, by, mat = fm, depth = thickness + 0.02) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, depth), mat);
        m.position.set(bx, by, 0);
        m.castShadow = true;
        door.add(m);
      };
      bar(0.05, h, -w / 2 + 0.025, h / 2);
      bar(0.05, h, w / 2 - 0.025, h / 2);
      bar(w, 0.05, 0, h - 0.025);
      bar(w - 0.1, h - 0.07, 0, (h - 0.07) / 2, leafMat, 0.04);
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.02, 0.02),
        new THREE.MeshStandardMaterial({ color: '#b9bcc2', metalness: 0.8, roughness: 0.3 })
      );
      handle.position.set(w / 2 - 0.15, 1.0, -0.035);
      door.add(handle);
      door.position.set(cx, o.bottom, cz);
      door.rotation.y = rotY;
      g.add(door);

      // Swing arc on the floor (plan symbol), opening inward. Hinge at the
      // "from" end unless the opening says hinge: 'end'.
      const hingeEnd = o.hinge === 'end';
      const [hx, hz] = at(hingeEnd ? o.to : o.from);
      const sx = hingeEnd ? -ux : ux;
      const sz = hingeEnd ? -uz : uz;
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const th = (i / 16) * (Math.PI / 2);
        pts.push(new THREE.Vector3(hx + (sx * Math.cos(th) - nx * Math.sin(th)) * w, 0.01, hz + (sz * Math.cos(th) - nz * Math.sin(th)) * w));
      }
      pts.push(new THREE.Vector3(hx, 0.01, hz));
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8a8f99' }));
      g.add(arc);
    }
  }
  return g;
}

function floorMesh(poly, texKey) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ map: getFloorTexture(texKey), roughness: 0.9 });
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  m.userData.kind = 'floor';
  return m;
}

function ceilingMesh(poly, h) {
  const shape = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, z)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f7f7f5', roughness: 1 }));
  m.position.y = h;
  m.receiveShadow = true;
  return m;
}

function centroidXYZ(poly) {
  const [x, z] = centroid(poly);
  return [x, 0.02, z];
}

function label(text, x, y, z, cls = 'dim') {
  const el = document.createElement('div');
  el.className = 'label ' + cls;
  el.textContent = text;
  const o = new CSS2DObject(el);
  o.position.set(x, y, z);
  return o;
}

export function buildRoom(cfg) {
  const { office, kitchen, bathroom, W, L, nw, nd, bw } = roomPolygons(cfg);
  const H = cfg.ceiling;
  const t = cfg.wallThickness;
  const group = new THREE.Group();
  const walls = [];

  const paint = (id) =>
    new THREE.MeshStandardMaterial({ color: cfg.wallColors[id] || cfg.wallColor, roughness: 0.95, transparent: true });

  const addWall = (spec) => {
    const g = buildWall({ ...spec, height: H, material: paint(spec.id) });
    walls.push(g);
    group.add(g);
  };

  const win = cfg.window;
  const ed = cfg.entranceDoor;
  const kd = cfg.kitchenDoor;

  // Outer envelope, clockwise, each wall extended at its start to close the corner.
  addWall({
    id: 'north',
    a: [0, 0],
    b: [W, 0],
    thickness: t,
    offset: t / 2,
    extendStart: t,
    openings: [{ kind: 'window', from: 0.08, to: W - 0.08, bottom: win.sill, top: Math.min(win.top, H - 0.05) }],
  });
  addWall({ id: 'east', a: [W, 0], b: [W, L], thickness: t, offset: t / 2, extendStart: t });
  addWall({
    id: 'south',
    a: [W, L],
    b: [0, L],
    thickness: t,
    offset: t / 2,
    extendStart: t,
    // Measured from the left corner, so flip into this wall's direction (right → left).
    openings: [{ kind: 'door', from: W - (ed.from + ed.width), to: W - ed.from, bottom: 0, top: ed.height, color: '#6f5440' }],
  });
  addWall({ id: 'west', a: [0, L], b: [0, 0], thickness: t, offset: t / 2, extendStart: t });

  // Kitchen partitions (centred on the line). Direction follows the office
  // polygon so "outward" is the kitchen side.
  // Partitions sit inside the notch (offset towards the kitchen), so the
  // office polygon's edges are their faces.
  const pt = PARTITION;
  const bath = cfg.bathroom;
  addWall({ id: 'kitchenNorth', a: [W, L - nd], b: [W - nw, L - nd], thickness: pt, offset: pt / 2 });
  addWall({
    id: 'kitchenWest',
    a: [W - nw, L - nd + pt],
    b: [W - nw, L],
    thickness: pt,
    offset: pt / 2,
    // Measured from the inner corner; this wall starts one partition further in.
    openings: [{ kind: 'door', from: kd.from - pt, to: kd.from - pt + kd.width, bottom: 0, top: kd.height, color: '#c9c3b6' }],
  });
  if (bathroom) {
    // Kitchen/bathroom wall, centred on x = W - bw. Door measured from the long
    // partition, hinged at its far end, swinging into the kitchen.
    addWall({
      id: 'bathWall',
      a: [W - bw, L - nd + pt],
      b: [W - bw, L],
      thickness: pt,
      openings: [
        { kind: 'door', from: bath.door.from, to: bath.door.from + bath.door.width, bottom: 0, top: bath.door.height, color: '#c9c3b6', hinge: 'end' },
      ],
    });
  }

  group.add(floorMesh(office, cfg.floor), floorMesh(kitchen, cfg.kitchenFloor));
  if (bathroom) group.add(floorMesh(bathroom, bath.floor));

  // Slab under everything so nothing shows through from below. Its top sits
  // 2 cm below the floor planes so the two never z-fight.
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(W + 2 * t, 0.2, L + 2 * t),
    new THREE.MeshStandardMaterial({ color: '#8d8a82', roughness: 1 })
  );
  slab.position.set(W / 2, -0.12, L / 2);
  slab.receiveShadow = true;
  group.add(slab);

  const ceiling = new THREE.Group();
  ceiling.add(ceilingMesh(office, H), ceilingMesh(kitchen, H));
  if (bathroom) ceiling.add(ceilingMesh(bathroom, H));
  ceiling.visible = false;
  group.add(ceiling);

  const labels = new THREE.Group();
  const f = (v) => `${v.toFixed(2)} m`;
  labels.add(
    label(f(W), W / 2, 0.02, -0.55),
    label(f(L), -0.75, 0.02, L / 2),
    label(f(W - nw), (W - nw) / 2, 0.02, L + 0.55),
    label(f(nd), W + 0.65, 0.02, L - nd / 2),
    label(f(nw), W - nw / 2, 0.02, L - nd - 0.35),
    label(`Office · ${polygonArea(office).toFixed(1)} m²`, W / 2, 0.02, (L - nd) / 2 + 0.6, 'name'),
    label(`Kitchen · ${polygonArea(kitchen).toFixed(1)} m²`, ...centroidXYZ(kitchen), 'name'),
    label('Window', W / 2, 0.02, 0.35, 'name'),
    label('Door', ed.from + ed.width / 2, 0.02, L - 0.3, 'name')
  );
  if (bathroom) labels.add(label(`Bathroom · ${polygonArea(bathroom).toFixed(1)} m²`, ...centroidXYZ(bathroom), 'name'));
  group.add(labels);

  return { group, walls, ceiling, labels, polygons: { office, kitchen, bathroom }, W, L };
}

export function disposeGroup(g) {
  g.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m.dispose();
    }
    if (o.isCSS2DObject) o.element.remove();
  });
  g.removeFromParent();
}
