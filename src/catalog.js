// Parametric furniture built from primitives. Every item's group has its
// origin at the centre of its footprint, on the floor; the item's "front"
// faces local +z. Sizes in metres. `primary` materials take the user's colour.
import * as THREE from 'three';
import { shade, rng } from './textures.js';

export function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? '#000000',
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
}

const metal = () => mat('#5b5f66', { metalness: 0.6, roughness: 0.4 });
const chrome = () => mat('#b9bcc2', { metalness: 0.9, roughness: 0.3 });
const dark = () => mat('#2b2b2b');

// Box positioned by its bottom-centre.
function B(w, h, d, material, x = 0, yb = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, yb + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function Cy(rTop, rBot, h, material, x = 0, yb = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
  m.position.set(x, yb + h / 2, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}
function Sp(r, material, x, y, z, detail = 1) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function done(g, primary) {
  g.userData.primary = primary;
  return g;
}

function desk({ w, d, h }, c) {
  const g = new THREE.Group();
  const top = mat(c);
  const leg = metal();
  g.add(B(w, 0.03, d, top, 0, h - 0.03, 0));
  g.add(B(0.04, h - 0.03, d - 0.1, leg, -w / 2 + 0.05, 0, 0));
  g.add(B(0.04, h - 0.03, d - 0.1, leg, w / 2 - 0.05, 0, 0));
  g.add(B(w - 0.2, 0.35, 0.02, mat(shade(c, -0.1)), 0, h - 0.4, -d / 2 + 0.05));
  return done(g, [top]);
}

function deskL({ w, d, h }, c) {
  const g = new THREE.Group();
  const top = mat(c);
  const leg = metal();
  const depth = 0.8;
  g.add(B(w, 0.03, depth, top, 0, h - 0.03, -d / 2 + depth / 2));
  g.add(B(depth, 0.03, d - depth, top, -w / 2 + depth / 2, h - 0.03, depth / 2));
  g.add(B(0.04, h - 0.03, depth - 0.1, leg, w / 2 - 0.05, 0, -d / 2 + depth / 2));
  g.add(B(0.04, h - 0.03, depth - 0.1, leg, -w / 2 + 0.05, 0, -d / 2 + depth / 2));
  g.add(B(depth - 0.1, h - 0.03, 0.04, leg, -w / 2 + depth / 2, 0, d / 2 - 0.05));
  return done(g, [top]);
}

function standingDesk({ w, d, h }, c) {
  const g = new THREE.Group();
  const top = mat(c);
  const leg = metal();
  g.add(B(w, 0.03, d, top, 0, h - 0.03, 0));
  for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) {
    g.add(B(0.07, h - 0.06, 0.07, leg, x, 0.03, 0));
    g.add(B(0.1, 0.03, d - 0.1, leg, x, 0, 0));
  }
  return done(g, [top]);
}

function table({ w, d, h }, c) {
  const g = new THREE.Group();
  const top = mat(c);
  const leg = metal();
  g.add(B(w, 0.03, d, top, 0, h - 0.03, 0));
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) g.add(B(0.04, h - 0.03, 0.04, leg, x, 0, z));
  return done(g, [top]);
}

function roundTable({ w, h }, c) {
  const g = new THREE.Group();
  const top = mat(c);
  const m = metal();
  g.add(Cy(w / 2, w / 2, 0.03, top, 0, h - 0.03, 0, 40));
  g.add(Cy(0.04, 0.04, h - 0.05, m, 0, 0.02, 0));
  g.add(Cy(0.28, 0.32, 0.02, m, 0, 0, 0, 32));
  return done(g, [top]);
}

function monitor({ w }, c) {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.5 });
  const screen = mat('#16243a', { roughness: 0.25, metalness: 0.2, emissive: '#1a2f4d', emissiveIntensity: 0.6 });
  g.add(Cy(0.12, 0.12, 0.02, body, 0, 0, 0.02));
  g.add(B(0.04, 0.22, 0.03, body, 0, 0.02, 0.02));
  g.add(B(w, 0.37, 0.02, body, 0, 0.2, 0));
  g.add(B(w - 0.02, 0.35, 0.006, screen, 0, 0.21, 0.012));
  return done(g, [body]);
}

// All-in-one PC: foot plate, tilted neck, thin panel with an aluminium chin.
function allInOne({ w, d, h }, c) {
  const g = new THREE.Group();
  const alu = mat(c, { roughness: 0.45, metalness: 0.5 });
  const screen = mat('#101826', { roughness: 0.25, metalness: 0.2, emissive: '#1b3350', emissiveIntensity: 0.7 });
  const panelH = h - 0.1;
  g.add(B(w * 0.32, 0.006, d, alu, 0, 0, 0));
  const neck = B(0.17, 0.22, 0.012, alu, 0, 0.006, -0.02);
  neck.rotation.x = 0.3;
  g.add(neck);
  g.add(B(w, panelH, 0.012, alu, 0, 0.1, 0.02));
  g.add(B(w - 0.03, panelH - 0.09, 0.004, screen, 0, 0.175, 0.028));
  return done(g, [alu]);
}

function keyboard({ w, d }, c) {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.6 });
  g.add(B(w - 0.1, 0.012, d, body, -0.05, 0, 0));
  g.add(B(w - 0.12, 0.004, d - 0.02, mat(shade(c, -0.25)), -0.05, 0.012, 0));
  g.add(B(0.06, 0.03, 0.11, body, w / 2 - 0.03, 0, 0));
  return done(g, [body]);
}

function officeChair(_, c) {
  const g = new THREE.Group();
  const fab = mat(c, { roughness: 1 });
  const m = metal();
  for (let i = 0; i < 5; i++) {
    const arm = B(0.3, 0.03, 0.05, m, 0, 0.02, 0);
    arm.geometry.translate(0.15, 0, 0);
    arm.rotation.y = (i * 2 * Math.PI) / 5;
    g.add(arm);
    const wheel = Cy(0.025, 0.025, 0.02, dark(), Math.cos((i * 2 * Math.PI) / 5) * 0.29, 0, -Math.sin((i * 2 * Math.PI) / 5) * 0.29, 12);
    wheel.rotation.x = Math.PI / 2;
    g.add(wheel);
  }
  g.add(Cy(0.03, 0.03, 0.4, m, 0, 0.04, 0));
  g.add(B(0.5, 0.08, 0.5, fab, 0, 0.43, 0));
  g.add(B(0.46, 0.55, 0.07, fab, 0, 0.51, -0.21));
  for (const x of [-0.25, 0.25]) {
    g.add(B(0.03, 0.18, 0.03, dark(), x, 0.5, 0));
    g.add(B(0.05, 0.03, 0.3, dark(), x, 0.68, -0.02));
  }
  return done(g, [fab]);
}

function visitorChair(_, c) {
  const g = new THREE.Group();
  const fab = mat(c, { roughness: 1 });
  const m = metal();
  for (const x of [-0.2, 0.2]) for (const z of [-0.22, 0.2]) g.add(Cy(0.015, 0.015, 0.45, m, x, 0, z, 10));
  g.add(B(0.46, 0.05, 0.46, fab, 0, 0.45, 0));
  g.add(B(0.44, 0.4, 0.04, fab, 0, 0.5, -0.21));
  return done(g, [fab]);
}

function sofa({ w, d }, c) {
  const g = new THREE.Group();
  const fab = mat(c, { roughness: 1 });
  const fab2 = mat(shade(c, 0.06), { roughness: 1 });
  const bw = w - 0.28;
  g.add(B(bw, 0.42, d, fab, 0, 0.08, 0));
  g.add(B(bw, 0.42, 0.22, fab, 0, 0.5, -d / 2 + 0.11));
  const n = Math.max(1, Math.round(w / 0.8));
  const cw = bw / n;
  for (let i = 0; i < n; i++) g.add(B(cw - 0.03, 0.12, d - 0.26, fab2, -bw / 2 + cw * (i + 0.5), 0.5, 0.1));
  for (const x of [-(w / 2 - 0.07), w / 2 - 0.07]) g.add(B(0.14, 0.62, d, fab, x, 0.08, 0));
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) for (const z of [-d / 2 + 0.1, d / 2 - 0.1]) g.add(Cy(0.02, 0.02, 0.08, dark(), x, 0, z, 10));
  return done(g, [fab, fab2]);
}

function bookshelf({ w, d, h }, c) {
  const g = new THREE.Group();
  const wood = mat(c);
  const r = rng(42);
  g.add(B(0.02, h, d, wood, -w / 2 + 0.01, 0, 0));
  g.add(B(0.02, h, d, wood, w / 2 - 0.01, 0, 0));
  g.add(B(w, h, 0.015, wood, 0, 0, -d / 2 + 0.0075));
  const shelves = 5;
  const palette = ['#b4453a', '#2f5d8a', '#d9a441', '#3f7a3a', '#5c4a7a', '#e0dcd2', '#2b2b2b', '#c57b57'];
  for (let i = 0; i <= shelves; i++) {
    const y = Math.min(i * (h / shelves), h - 0.02);
    g.add(B(w - 0.04, 0.02, d - 0.02, wood, 0, y, 0.01));
    if (i === shelves) break;
    let x = -w / 2 + 0.04;
    const limit = w / 2 - 0.04 - r() * (w * 0.3);
    while (x < limit) {
      const bw = 0.025 + r() * 0.04;
      const bh = 0.17 + r() * 0.09;
      g.add(B(bw, bh, d - 0.12, mat(palette[Math.floor(r() * palette.length)]), x + bw / 2, y + 0.02, -0.02));
      x += bw + 0.004;
    }
  }
  return done(g, [wood]);
}

function sideboard({ w, d, h }, c) {
  const g = new THREE.Group();
  const wood = mat(c);
  g.add(B(w, h - 0.1, d, wood, 0, 0.1, 0));
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) g.add(B(0.03, 0.1, 0.03, metal(), x, 0, z));
  const doors = Math.max(2, Math.round(w / 0.6));
  for (let i = 1; i < doors; i++) g.add(B(0.004, h - 0.2, 0.006, dark(), -w / 2 + (w * i) / doors, 0.15, d / 2));
  for (let i = 0; i < doors; i++) g.add(B(0.02, 0.1, 0.02, metal(), -w / 2 + (w * (i + 0.5)) / doors, h / 2, d / 2 + 0.01));
  return done(g, [wood]);
}

function filingCabinet({ w, d, h }, c) {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.6, metalness: 0.2 });
  g.add(B(w, h, d, body, 0, 0, 0));
  const n = 3;
  const dh = (h - 0.08) / n;
  for (let i = 0; i < n; i++) {
    g.add(B(w - 0.03, dh - 0.02, 0.01, mat(shade(c, 0.06), { roughness: 0.6, metalness: 0.2 }), 0, 0.04 + i * dh, d / 2));
    g.add(B(0.12, 0.02, 0.02, metal(), 0, 0.04 + i * dh + dh * 0.6, d / 2 + 0.01));
  }
  return done(g, [body]);
}

function cabinet({ w, d, h }, c) {
  const g = new THREE.Group();
  const body = mat(c);
  g.add(B(w, h, d, body, 0, 0, 0));
  const doors = w > 0.7 ? 2 : 1;
  if (doors === 2) g.add(B(0.004, h - 0.06, 0.006, dark(), 0, 0.03, d / 2));
  for (let i = 0; i < doors; i++) {
    const x = doors === 2 ? (i ? 0.05 : -0.05) : w / 2 - 0.08;
    g.add(B(0.02, 0.14, 0.02, metal(), x, h / 2, d / 2 + 0.01));
  }
  return done(g, [body]);
}

function plant({ h }, c) {
  const g = new THREE.Group();
  const leaf = mat(c, { roughness: 1 });
  const leaf2 = mat(shade(c, 0.1), { roughness: 1 });
  const pot = mat('#b4713f');
  const potH = h * 0.22;
  g.add(Cy(h * 0.11, h * 0.09, potH, pot, 0, 0, 0));
  g.add(Cy(h * 0.1, h * 0.1, 0.02, mat('#3a2d22'), 0, potH - 0.025, 0));
  g.add(Cy(0.015, 0.025, h * 0.4, mat('#6b4e34'), 0, potH, 0));
  const top = h * 0.78;
  g.add(Sp(h * 0.22, leaf, 0, top, 0));
  g.add(Sp(h * 0.15, leaf2, h * 0.13, top - h * 0.12, h * 0.08));
  g.add(Sp(h * 0.14, leaf2, -h * 0.12, top - h * 0.1, -h * 0.1));
  g.add(Sp(h * 0.12, leaf, 0.02, top - h * 0.2, h * 0.14));
  return done(g, [leaf, leaf2]);
}

function floorLamp({ h }, c) {
  const g = new THREE.Group();
  const m = metal();
  const shadeMat = mat(c, { roughness: 0.9, side: THREE.DoubleSide, emissive: '#ffe2b8', emissiveIntensity: 0.35 });
  g.add(Cy(0.14, 0.14, 0.02, m, 0, 0, 0, 32));
  g.add(Cy(0.012, 0.012, h - 0.2, m, 0, 0.02, 0, 10));
  const shadeMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 32, 1, true), shadeMat);
  shadeMesh.position.y = h - 0.15;
  shadeMesh.castShadow = true;
  g.add(shadeMesh);
  g.add(Sp(0.04, mat('#fff4dc', { emissive: '#ffd9a6', emissiveIntensity: 2 }), 0, h - 0.18, 0, 2));
  const light = new THREE.PointLight('#ffd9a6', 5, 5, 2);
  light.position.y = h - 0.18;
  g.add(light);
  return done(g, [shadeMat]);
}

function rug({ w, d }, c) {
  const g = new THREE.Group();
  const fab = mat(c, { roughness: 1 });
  const a = B(w, 0.012, d, fab, 0, 0, 0);
  a.castShadow = false;
  const b = B(w - 0.24, 0.014, d - 0.24, mat(shade(c, 0.08), { roughness: 1 }), 0, 0, 0);
  b.castShadow = false;
  g.add(a, b);
  return done(g, [fab]);
}

function rugRound({ w }, c) {
  const g = new THREE.Group();
  const fab = mat(c, { roughness: 1 });
  const a = Cy(w / 2, w / 2, 0.012, fab, 0, 0, 0, 48);
  a.castShadow = false;
  g.add(a);
  return done(g, [fab]);
}

// Wall-mounted items span local z from -d/2 (the wall) to +d/2.
function whiteboard({ w, d, h }, c) {
  const g = new THREE.Group();
  const board = mat(c, { roughness: 0.3 });
  const frame = B(w + 0.04, h + 0.04, 0.02, metal(), 0, -0.02, -d / 2 + 0.01);
  const face = B(w, h, 0.015, board, 0, 0, -d / 2 + 0.025);
  const tray = B(w * 0.6, 0.02, 0.05, metal(), 0, -0.03, -d / 2 + 0.035);
  g.add(frame, face, tray);
  return done(g, [board]);
}

function artFrame({ w, d, h }, c) {
  const g = new THREE.Group();
  const paint = mat(c, { roughness: 0.8 });
  g.add(B(w + 0.06, h + 0.06, 0.03, mat('#2a2522'), 0, -0.03, -d / 2));
  g.add(B(w, h, 0.01, paint, 0, 0, -d / 2 + 0.03));
  g.add(B(w * 0.55, h * 0.5, 0.004, mat(shade(c, 0.25)), -w * 0.1, h * 0.22, -d / 2 + 0.036));
  g.add(B(w * 0.3, h * 0.3, 0.004, mat(shade(c, -0.18)), w * 0.25, h * 0.1, -d / 2 + 0.036));
  return done(g, [paint]);
}

function partition({ w, d, h }, c) {
  const g = new THREE.Group();
  const fab = mat(c, { roughness: 1 });
  g.add(B(w, h - 0.05, d, fab, 0, 0.05, 0));
  for (const x of [-w / 2 + 0.1, w / 2 - 0.1]) g.add(B(0.04, 0.05, 0.35, metal(), x, 0, 0));
  return done(g, [fab]);
}

function counter({ w, d }, c) {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.7 });
  g.add(B(w, 0.86, d, body, 0, 0, 0));
  g.add(B(w + 0.02, 0.04, d + 0.02, mat('#6b6b6b', { roughness: 0.4 }), 0, 0.86, 0));
  const sx = -w / 4;
  g.add(B(0.5, 0.015, 0.4, chrome(), sx, 0.9, 0));
  g.add(Cy(0.012, 0.012, 0.25, chrome(), sx, 0.9, -d / 2 + 0.08, 10));
  g.add(B(0.02, 0.02, 0.16, chrome(), sx, 1.13, -d / 2 + 0.15));
  const doors = Math.max(1, Math.round(w / 0.6));
  for (let i = 1; i < doors; i++) g.add(B(0.004, 0.8, 0.006, dark(), -w / 2 + (w * i) / doors, 0.03, d / 2));
  for (let i = 0; i < doors; i++) g.add(B(0.12, 0.02, 0.02, metal(), -w / 2 + (w * (i + 0.5)) / doors, 0.75, d / 2 + 0.01));
  return done(g, [body]);
}

function fridge({ w, d, h }, c) {
  const g = new THREE.Group();
  const body = mat(c, { roughness: 0.4, metalness: 0.3 });
  g.add(B(w, h, d, body, 0, 0, 0));
  g.add(B(0.02, 0.5, 0.03, chrome(), w / 2 - 0.06, h * 0.45, d / 2 + 0.015));
  g.add(B(0.02, 0.25, 0.03, chrome(), w / 2 - 0.06, h * 0.72, d / 2 + 0.015));
  g.add(B(w - 0.02, 0.004, 0.006, dark(), 0, h * 0.68, d / 2));
  return done(g, [body]);
}

function toilet(_, c) {
  const g = new THREE.Group();
  const white = mat(c, { roughness: 0.3 });
  g.add(Cy(0.17, 0.13, 0.38, white, 0, 0, 0.08, 24));
  g.add(B(0.36, 0.05, 0.46, white, 0, 0.38, 0.06));
  g.add(B(0.38, 0.4, 0.17, white, 0, 0.4, -0.24));
  g.add(B(0.1, 0.02, 0.03, chrome(), 0.1, 0.8, -0.24));
  return done(g, [white]);
}

function basin({ w, d, h }, c) {
  const g = new THREE.Group();
  const body = mat(c);
  const white = mat('#f6f7f7', { roughness: 0.3 });
  g.add(B(w - 0.04, h - 0.15, d - 0.04, body, 0, 0, 0));
  g.add(B(w, 0.04, d, white, 0, h - 0.15, 0));
  g.add(B(w * 0.7, 0.015, d * 0.65, mat('#d7dde3', { roughness: 0.3 }), 0, h - 0.11, 0.01));
  g.add(Cy(0.012, 0.012, 0.1, chrome(), 0, h - 0.11, -d / 2 + 0.06, 10));
  g.add(B(0.02, 0.02, 0.1, chrome(), 0, h - 0.02, -d / 2 + 0.1));
  return done(g, [body]);
}

function mirror({ w, d, h }, c) {
  const g = new THREE.Group();
  const frame = mat(c, { roughness: 0.5, metalness: 0.4 });
  g.add(B(w + 0.03, h + 0.03, 0.02, frame, 0, -0.015, -d / 2 + 0.01));
  g.add(B(w, h, 0.01, mat('#cfe0ea', { roughness: 0.05, metalness: 0.9 }), 0, 0, -d / 2 + 0.025));
  return done(g, [frame]);
}

function stool({ w, h }, c) {
  const g = new THREE.Group();
  const seat = mat(c);
  g.add(Cy(w / 2, w / 2, 0.04, seat, 0, h - 0.04, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    g.add(Cy(0.012, 0.012, h - 0.04, metal(), Math.cos(a) * (w / 2 - 0.04), 0, Math.sin(a) * (w / 2 - 0.04), 8));
  }
  return done(g, [seat]);
}

export const CATALOG = [
  { type: 'desk', name: 'Desk', size: '160 × 80', cat: 'Work', w: 1.6, d: 0.8, h: 0.75, color: '#d9b98a', build: desk },
  { type: 'deskWide', name: 'Desk', size: '180 × 90', cat: 'Work', w: 1.8, d: 0.9, h: 0.75, color: '#d9b98a', build: desk },
  { type: 'deskL', name: 'L-desk', size: '180 × 160', cat: 'Work', w: 1.8, d: 1.6, h: 0.75, color: '#d9b98a', build: deskL },
  { type: 'standingDesk', name: 'Standing desk', size: '140 × 70', cat: 'Work', w: 1.4, d: 0.7, h: 1.1, color: '#e8e2d6', build: standingDesk },
  { type: 'meetingTable', name: 'Meeting table', size: '180 × 90', cat: 'Work', w: 1.8, d: 0.9, h: 0.75, color: '#f0ece4', build: table },
  { type: 'roundTable', name: 'Round table', size: 'Ø 120', cat: 'Work', w: 1.2, d: 1.2, h: 0.75, color: '#f0ece4', build: roundTable },
  { type: 'monitor', name: 'Monitor', size: '27"', cat: 'Work', w: 0.62, d: 0.2, h: 0.45, color: '#2a2d31', elevation: 0.75, build: monitor, stackable: true },
  { type: 'allInOne', name: 'All-in-one PC', size: '27"', cat: 'Work', w: 0.65, d: 0.2, h: 0.52, color: '#c9cbd0', elevation: 0.75, build: allInOne, stackable: true },
  { type: 'keyboard', name: 'Keyboard & mouse', size: '55 × 15', cat: 'Work', w: 0.55, d: 0.15, h: 0.03, color: '#d6d6d4', elevation: 0.75, build: keyboard, stackable: true },
  { type: 'partition', name: 'Screen', size: '140 × 150', cat: 'Work', w: 1.4, d: 0.05, h: 1.5, color: '#9aa5b1', build: partition },

  { type: 'officeChair', name: 'Office chair', size: '65 × 65', cat: 'Seating', w: 0.65, d: 0.65, h: 1.1, color: '#333639', build: officeChair, fixedSize: true },
  { type: 'visitorChair', name: 'Visitor chair', size: '50 × 55', cat: 'Seating', w: 0.5, d: 0.55, h: 0.9, color: '#4b5563', build: visitorChair, fixedSize: true },
  { type: 'sofa', name: 'Sofa', size: '160 × 85', cat: 'Seating', w: 1.6, d: 0.85, h: 0.85, color: '#6b7a8f', build: sofa },
  { type: 'sofa3', name: 'Sofa, 3-seat', size: '220 × 90', cat: 'Seating', w: 2.2, d: 0.9, h: 0.85, color: '#6b7a8f', build: sofa },
  { type: 'armchair', name: 'Armchair', size: '85 × 85', cat: 'Seating', w: 0.85, d: 0.85, h: 0.85, color: '#8a6f5a', build: sofa },
  { type: 'stool', name: 'Stool', size: 'Ø 35', cat: 'Seating', w: 0.35, d: 0.35, h: 0.65, color: '#c9a66b', build: stool },

  { type: 'bookshelf', name: 'Bookshelf', size: '80 × 35 × 200', cat: 'Storage', w: 0.8, d: 0.35, h: 2.0, color: '#c9b08a', build: bookshelf },
  { type: 'bookshelfLow', name: 'Low shelf', size: '120 × 35 × 90', cat: 'Storage', w: 1.2, d: 0.35, h: 0.9, color: '#c9b08a', build: bookshelf },
  { type: 'sideboard', name: 'Sideboard', size: '120 × 45 × 80', cat: 'Storage', w: 1.2, d: 0.45, h: 0.8, color: '#a88a68', build: sideboard },
  { type: 'cabinet', name: 'Tall cabinet', size: '100 × 45 × 200', cat: 'Storage', w: 1.0, d: 0.45, h: 2.0, color: '#e6e1d7', build: cabinet },
  { type: 'filingCabinet', name: 'Filing cabinet', size: '40 × 60 × 130', cat: 'Storage', w: 0.4, d: 0.6, h: 1.3, color: '#9ca3ad', build: filingCabinet },
  { type: 'locker', name: 'Locker', size: '60 × 50 × 180', cat: 'Storage', w: 0.6, d: 0.5, h: 1.8, color: '#8d99a6', build: cabinet },

  { type: 'plant', name: 'Plant, large', size: 'h 160', cat: 'Decor', w: 0.6, d: 0.6, h: 1.6, color: '#3f7a3a', build: plant },
  { type: 'plantSmall', name: 'Plant, small', size: 'h 80', cat: 'Decor', w: 0.35, d: 0.35, h: 0.8, color: '#4f8a44', build: plant },
  { type: 'floorLamp', name: 'Floor lamp', size: 'h 170', cat: 'Decor', w: 0.4, d: 0.4, h: 1.7, color: '#efe6d2', build: floorLamp },
  { type: 'coffeeTable', name: 'Coffee table', size: '90 × 50', cat: 'Decor', w: 0.9, d: 0.5, h: 0.4, color: '#8a6f5a', build: table },
  { type: 'rug', name: 'Rug', size: '200 × 300', cat: 'Decor', w: 2.0, d: 3.0, h: 0.02, color: '#b8a48a', build: rug, passable: true },
  { type: 'rugSmall', name: 'Rug', size: '140 × 200', cat: 'Decor', w: 1.4, d: 2.0, h: 0.02, color: '#7d8a9a', build: rug, passable: true },
  { type: 'rugRound', name: 'Round rug', size: 'Ø 200', cat: 'Decor', w: 2.0, d: 2.0, h: 0.02, color: '#a79a86', build: rugRound, passable: true },
  { type: 'whiteboard', name: 'Whiteboard', size: '120 × 90', cat: 'Decor', w: 1.2, d: 0.05, h: 0.9, color: '#ffffff', elevation: 0.9, wallMounted: true, build: whiteboard },
  { type: 'artFrame', name: 'Wall art', size: '80 × 60', cat: 'Decor', w: 0.8, d: 0.04, h: 0.6, color: '#3b5b8a', elevation: 1.3, wallMounted: true, build: artFrame },
  { type: 'artLarge', name: 'Wall art, large', size: '120 × 90', cat: 'Decor', w: 1.2, d: 0.04, h: 0.9, color: '#b4453a', elevation: 1.2, wallMounted: true, build: artFrame },

  { type: 'counter', name: 'Kitchen counter', size: '200 × 60', cat: 'Kitchen', w: 2.0, d: 0.6, h: 0.9, color: '#e5e5e5', build: counter },
  { type: 'counterShort', name: 'Kitchen counter', size: '120 × 60', cat: 'Kitchen', w: 1.2, d: 0.6, h: 0.9, color: '#e5e5e5', build: counter },
  { type: 'fridge', name: 'Fridge', size: '60 × 65 × 180', cat: 'Kitchen', w: 0.6, d: 0.65, h: 1.8, color: '#d4d4d4', build: fridge },
  { type: 'kitchenTable', name: 'Bistro table', size: '70 × 70', cat: 'Kitchen', w: 0.7, d: 0.7, h: 0.75, color: '#e8e2d6', build: table },
  { type: 'kitchenCabinet', name: 'Kitchen cabinet', size: '80 × 40 × 200', cat: 'Kitchen', w: 0.8, d: 0.4, h: 2.0, color: '#e5e5e5', build: cabinet },

  { type: 'toilet', name: 'Toilet', size: '38 × 65', cat: 'Bathroom', w: 0.38, d: 0.65, h: 0.82, color: '#f6f7f7', build: toilet, fixedSize: true },
  { type: 'basin', name: 'Basin cabinet', size: '50 × 40', cat: 'Bathroom', w: 0.5, d: 0.4, h: 0.95, color: '#e8e4dc', build: basin },
  { type: 'mirror', name: 'Mirror', size: '50 × 70', cat: 'Bathroom', w: 0.5, d: 0.04, h: 0.7, color: '#8a8f99', elevation: 1.25, wallMounted: true, build: mirror },
  { type: 'bathCabinet', name: 'Tall cabinet', size: '40 × 35 × 180', cat: 'Bathroom', w: 0.4, d: 0.35, h: 1.8, color: '#e8e4dc', build: cabinet },
];

export const CATALOG_BY_TYPE = Object.fromEntries(CATALOG.map((d) => [d.type, d]));
export const CATEGORIES = [...new Set(CATALOG.map((d) => d.cat))];

export const MIN_SIZE = 0.1;

// The catalog entry with any per-item size overrides applied. Builders read
// w/d/h from this, so a resized item is just rebuilt with different numbers.
export function itemDef(def, data) {
  const pick = (k) => (Number.isFinite(data[k]) ? Math.max(MIN_SIZE, data[k]) : def[k]);
  return { ...def, w: pick('w'), d: pick('d'), h: pick('h') };
}

export function sizeLabel(def) {
  const cm = (v) => Math.round(v * 100);
  return `${cm(def.w)} × ${cm(def.d)} × ${cm(def.h)} cm`;
}

export function buildItem(def, color) {
  const g = def.build(def, color || def.color);
  g.traverse((o) => {
    if (o.isMesh) o.userData.item = true;
  });
  return g;
}
