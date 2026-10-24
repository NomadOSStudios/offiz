// Procedural canvas textures so the app needs no downloaded assets.
import * as THREE from 'three';

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

// Floor geometry UVs are in metres, so repeat = 1 / (metres per tile).
function finish(c, metersPerTile) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(1 / metersPerTile, 1 / metersPerTile);
  return t;
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return '#' + c.getHexString();
}

// Small seeded PRNG so textures look the same on every rebuild.
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function woodTexture(base, planks = 8, meters = 2) {
  const [c, ctx] = canvas(1024);
  const r = rng(7);
  const ph = c.height / planks;
  for (let i = 0; i < planks; i++) {
    ctx.fillStyle = shade(base, (r() - 0.5) * 0.12);
    ctx.fillRect(0, i * ph, c.width, ph);
    ctx.strokeStyle = 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    for (let g = 0; g < 14; g++) {
      const y = i * ph + r() * ph;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(c.width / 3, y + (r() - 0.5) * 8, (2 * c.width) / 3, y + (r() - 0.5) * 8, c.width, y);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(0, i * ph, c.width, 2);
    const joint = ((i % 3) * c.width) / 3 + c.width / 6;
    ctx.fillRect(joint, i * ph, 2, ph);
  }
  return finish(c, meters);
}

export function carpetTexture(base, meters = 1) {
  const [c, ctx] = canvas(256);
  const r = rng(11);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 26;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, meters);
}

export function tileTexture(base, grout = '#b9b9b9', n = 2, meters = 1.2) {
  const [c, ctx] = canvas(512);
  const r = rng(5);
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, 512, 512);
  const s = 512 / n;
  const g = 4;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = shade(base, (r() - 0.5) * 0.05);
      ctx.fillRect(i * s + g / 2, j * s + g / 2, s - g, s - g);
    }
  }
  return finish(c, meters);
}

export function concreteTexture(base, meters = 1.5) {
  const [c, ctx] = canvas(512);
  const r = rng(3);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + r() * 0.04})`;
    ctx.beginPath();
    ctx.ellipse(r() * 512, r() * 512, 20 + r() * 80, 10 + r() * 50, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  const img = ctx.getImageData(0, 0, 512, 512);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (r() - 0.5) * 10;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, meters);
}

export const FLOORS = {
  oak: { name: 'Oak planks', make: () => woodTexture('#c49a6c') },
  walnut: { name: 'Walnut planks', make: () => woodTexture('#6e4b33') },
  ash: { name: 'Light ash', make: () => woodTexture('#e3d3b5') },
  carpetGrey: { name: 'Grey carpet', make: () => carpetTexture('#8a8d92') },
  carpetBlue: { name: 'Blue carpet', make: () => carpetTexture('#4a5a78') },
  carpetGreen: { name: 'Green carpet', make: () => carpetTexture('#5f7a5a') },
  tile: { name: 'Light tile', make: () => tileTexture('#e9e6df') },
  tileDark: { name: 'Slate tile', make: () => tileTexture('#4e5257', '#2e3135') },
  concrete: { name: 'Polished concrete', make: () => concreteTexture('#a8a7a2') },
};

const cache = new Map();
export function getFloorTexture(key) {
  const k = FLOORS[key] ? key : 'oak';
  if (!cache.has(k)) cache.set(k, FLOORS[k].make());
  return cache.get(k);
}
