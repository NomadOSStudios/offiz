import * as THREE from "three";
import { shade, rng } from "./textures.js";
import {
  mat,
  wood,
  fabric,
  metal,
  chrome,
  rubber,
  mesh,
  box as B,
  cylinder as Cy,
  ellipsoid as E,
  rod,
  tube,
  ring,
  lathe,
  piping,
  finishModel as done,
} from "./model-kit.js";

const group = () => new THREE.Group();
function feet(g, w, d, height, material, inset = 0.06) {
  for (const x of [-w / 2 + inset, w / 2 - inset])
    for (const z of [-d / 2 + inset, d / 2 - inset]) {
      g.add(Cy(0.014, 0.018, height, material, x, 0, z, 12));
    }
}
function handle(g, x, y, z, length, material, vertical = false) {
  const a = vertical ? [x, y - length / 2, z] : [x - length / 2, y, z];
  const b = vertical ? [x, y + length / 2, z] : [x + length / 2, y, z];
  g.add(rod(a, [a[0], a[1], z - 0.018], 0.005, material));
  g.add(rod(b, [b[0], b[1], z - 0.018], 0.005, material));
  g.add(rod(a, b, 0.006, material));
}
function grommet(g, x, y, z, material) {
  g.add(Cy(0.025, 0.025, 0.002, material, x, y, z));
  g.add(B(0.025, 0.001, 0.005, rubber(), x, y + 0.002, z, 0));
}
export function desk({ w, d, h }, c) {
  const g = group(),
    top = wood(c),
    frame = metal(),
    pad = rubber();
  g.add(B(w, 0.035, d, top, 0, h - 0.035, 0, 0.012));
  for (const x of [-w / 2 + 0.075, w / 2 - 0.075]) {
    for (const z of [-d / 2 + 0.085, d / 2 - 0.085]) {
      g.add(B(0.035, h - 0.065, 0.035, frame, x, 0.03, z, 0.004));
      g.add(B(0.039, 0.022, 0.039, pad, x, 0, z, 0.004));
    }
    g.add(B(0.035, 0.035, d - 0.135, frame, x, 0.022, 0, 0.004));
    g.add(B(0.045, 0.035, d - 0.12, frame, x, h - 0.07, 0, 0.004));
  }
  g.add(B(w - 0.15, 0.05, 0.035, frame, 0, h - 0.085, -d * 0.24));
  g.add(B(w * 0.65, 0.11, 0.07, frame, 0, h - 0.17, -d * 0.32));
  grommet(g, w * 0.34, h - 0.002, -d * 0.33, frame);
  return done(g, [top]);
}
export function deskL({ w, d, h }, c) {
  const g = group(),
    top = wood(c),
    frame = metal(),
    pad = rubber(),
    depth = Math.min(w, d) * 0.47;
  // One continuous L-shaped worktop, including a softly bevelled inner corner.
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + 0.01, -d / 2 + 0.01);
  shape.lineTo(w / 2 - 0.01, -d / 2 + 0.01);
  shape.lineTo(w / 2 - 0.01, -d / 2 + depth - 0.01);
  shape.lineTo(-w / 2 + depth - 0.01, -d / 2 + depth - 0.01);
  shape.lineTo(-w / 2 + depth - 0.01, d / 2 - 0.01);
  shape.lineTo(-w / 2 + 0.01, d / 2 - 0.01);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.017,
    bevelEnabled: true,
    bevelSize: 0.01,
    bevelThickness: 0.009,
    bevelSegments: 2,
    steps: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, h - 0.009, 0);
  g.add(mesh(geo, top));
  for (const [x, z] of [
    [-w / 2 + 0.07, -d / 2 + 0.07],
    [w / 2 - 0.07, -d / 2 + 0.07],
    [w / 2 - 0.07, -d / 2 + depth - 0.07],
    [-w / 2 + 0.07, d / 2 - 0.07],
    [-w / 2 + depth - 0.07, d / 2 - 0.07],
  ]) {
    g.add(B(0.04, h - 0.05, 0.04, frame, x, 0.016, z));
    g.add(B(0.045, 0.016, 0.045, pad, x, 0, z));
  }
  g.add(B(w - 0.12, 0.06, 0.035, frame, 0, h - 0.1, -d / 2 + 0.1));
  g.add(B(0.035, 0.06, d - 0.12, frame, -w / 2 + 0.1, h - 0.1, 0));
  grommet(g, w * 0.31, h - 0.002, -d / 2 + 0.12, frame);
  return done(g, [top]);
}
export function standingDesk({ w, d, h }, c) {
  const g = group(),
    top = wood(c),
    frame = metal("#d8dbda"),
    inner = metal("#a2a9a9"),
    pad = rubber();
  g.add(B(w, 0.032, d, top, 0, h - 0.032, 0));
  for (const x of [-w / 2 + 0.17, w / 2 - 0.17]) {
    g.add(B(0.085, 0.04, d * 0.87, frame, x, 0.013, 0, 0.015));
    for (const z of [-d * 0.35, d * 0.35])
      g.add(Cy(0.025, 0.025, 0.016, pad, x, 0, z));
    g.add(B(0.075, h * 0.46, 0.065, frame, x, 0.05, 0));
    g.add(B(0.06, h * 0.4, 0.05, inner, x, h * 0.46, 0));
    g.add(B(0.047, h * 0.19, 0.04, frame, x, h * 0.79, 0));
    g.add(B(0.09, 0.04, d * 0.75, frame, x, h - 0.07, 0));
  }
  g.add(B(w - 0.32, 0.07, 0.055, frame, 0, h - 0.12, 0));
  g.add(B(0.12, 0.022, 0.035, pad, w * 0.29, h - 0.055, d / 2 - 0.025));
  g.add(
    B(
      0.04,
      0.006,
      0.001,
      mat("#a6e4cf", { emissive: "#6bd6af", emissiveIntensity: 0.4 }),
      w * 0.27,
      h - 0.046,
      d / 2 - 0.007,
      0,
    ),
  );
  grommet(g, -w * 0.31, h - 0.002, -d * 0.33, inner);
  return done(g, [top]);
}
export function table({ w, d, h, type }, c) {
  const g = group(),
    top = wood(c),
    leg = wood(shade(c, -0.12)),
    bracket = metal();
  const coffee = type === "coffeeTable",
    thick = coffee ? 0.035 : 0.04;
  g.add(B(w, thick, d, top, 0, h - thick, 0, thick * 0.45));
  g.add(B(w * 0.7, 0.055, d * 0.68, leg, 0, h - thick - 0.055, 0));
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      g.add(
        rod(
          [x * w * 0.41, 0.012, z * d * 0.4],
          [x * w * 0.33, h - thick - 0.01, z * d * 0.32],
          0.018,
          leg,
          0.027,
        ),
      );
      g.add(Cy(0.019, 0.019, 0.012, bracket, x * w * 0.41, 0, z * d * 0.4, 12));
    }
  return done(g, [top, leg]);
}
export function roundTable({ w, d, h }, c) {
  const g = group(),
    top = wood(c),
    m = metal("#5c625f");
  const slab = lathe(
    [
      [0, 0],
      [0.97, 0],
      [1, 0.008],
      [1, 0.025],
      [0.98, 0.035],
      [0, 0.035],
    ],
    top,
  );
  slab.scale.set(w / 2, 1, d / 2);
  slab.position.y = h - 0.035;
  g.add(slab);
  g.add(
    lathe(
      [
        [0, 0],
        [w * 0.23, 0],
        [w * 0.25, 0.014],
        [w * 0.23, 0.027],
        [0.05, 0.052],
        [0.036, h - 0.09],
        [0.12, h - 0.035],
        [0, h - 0.035],
      ],
      m,
    ),
  );
  return done(g, [top]);
}

function display(g, w, height, bottom, depth, body, chin = 0.025) {
  const black = mat("#131b21", { roughness: 0.3 });
  const screen = mat("#263d4a", {
    roughness: 0.24,
    metalness: 0.25,
    emissive: "#183a4b",
    emissiveIntensity: 0.3,
  });
  g.add(B(w, height, depth, body, 0, bottom, 0, 0.01));
  g.add(
    B(
      w - 0.012,
      height - chin * 0.65,
      0.004,
      black,
      0,
      bottom + chin * 0.65,
      depth / 2,
      0.006,
    ),
  );
  g.add(
    B(
      w - 0.027,
      height - chin - 0.015,
      0.002,
      screen,
      0,
      bottom + chin,
      depth / 2 + 0.003,
      0.003,
    ),
  );
  // Quiet abstract wallpaper, modelled so exports and path tracing match 3D.
  const wave = mat("#4d7b83", {
    roughness: 0.5,
    emissive: "#315d66",
    emissiveIntensity: 0.15,
  });
  const wave2 = mat("#719b9c", { roughness: 0.5 });
  const innerH = height - chin - 0.03;
  const shape = new THREE.Shape();
  shape.moveTo(-w * 0.475, 0);
  shape.lineTo(w * 0.475, 0);
  shape.lineTo(w * 0.475, innerH * 0.6);
  shape.bezierCurveTo(
    w * 0.16,
    innerH * 0.05,
    -w * 0.06,
    innerH * 0.9,
    -w * 0.475,
    innerH * 0.38,
  );
  shape.closePath();
  g.add(
    mesh(
      new THREE.ShapeGeometry(shape, 16),
      wave,
      0,
      bottom + chin + 0.005,
      depth / 2 + 0.0045,
    ),
  );
  g.add(
    B(
      w * 0.21,
      0.006,
      0.001,
      wave2,
      -w * 0.3,
      bottom + height * 0.78,
      depth / 2 + 0.005,
      0,
    ),
  );
  const camera = Cy(0.0025, 0.0025, 0.002, black);
  camera.rotation.x = Math.PI / 2;
  camera.position.set(0, bottom + height - 0.005, depth / 2 + 0.002);
  g.add(camera);
}
export function monitor({ w, d, h }, c) {
  const g = group(),
    body = mat(c, { roughness: 0.38 }),
    support = metal();
  g.add(B(w * 0.36, 0.012, d, support, 0, 0, 0, 0.006));
  g.add(B(0.04, h * 0.48, 0.028, support, 0, 0.01, -0.012));
  display(g, w, h * 0.79, h * 0.21, 0.025, body);
  g.add(B(w * 0.34, 0.065, 0.025, body, 0, h * 0.4, -0.02));
  return done(g, [body]);
}
export function allInOne({ w, d, h }, c) {
  const g = group(),
    body = metal(c),
    black = rubber();
  g.add(B(w * 0.33, 0.007, d, body, 0, 0, 0, 0.003));
  g.add(rod([0, 0.01, -d * 0.3], [0, h * 0.43, -0.025], 0.035, body, 0.03));
  display(g, w, h * 0.79, h * 0.21, 0.014, body, h * 0.12);
  for (let i = 0; i < 5; i++)
    g.add(
      B(0.018, 0.005, 0.001, black, w * 0.16 + i * 0.023, h * 0.28, -0.008, 0),
    );
  return done(g, [body]);
}
export function keyboard({ w, d, h }, c) {
  const g = group(),
    body = metal(c),
    key = mat(shade(c, 0.07)),
    dark = rubber();
  const kw = w * 0.77,
    kd = d * 0.88,
    cx = -w * 0.115;
  g.add(B(kw, h * 0.42, kd, body, cx, 0, 0, 0.006));
  g.add(B(kw * 0.96, h * 0.05, kd * 0.91, dark, cx, h * 0.42, 0, 0.003));
  const step = (kw * 0.93) / 15,
    row = (kd * 0.84) / 5;
  for (let j = 0; j < 5; j++)
    for (let i = 0; i < 15; i++) {
      if (j === 4 && i > 3 && i < 10) continue;
      const space = j === 4 && i === 3;
      g.add(
        B(
          step * (space ? 6.8 : 0.82),
          h * 0.16,
          row * 0.77,
          key,
          cx - kw * 0.465 + step * (i + (space ? 3.5 : 0.5)),
          h * 0.47,
          -kd * 0.42 + row * (j + 0.5),
          0,
        ),
      );
    }
  g.add(E(w * 0.13, h, d * 0.72, body, w * 0.41, 0, 0));
  g.add(B(0.002, 0.002, d * 0.25, dark, w * 0.41, h * 0.93, -d * 0.1, 0));
  g.add(E(w * 0.014, h * 0.18, d * 0.1, dark, w * 0.41, h * 0.91, -d * 0.06));
  return done(g, [body, key]);
}

export function officeChair(_, c) {
  const g = group(),
    upholstery = fabric(c),
    frame = mat("#303638", { roughness: 0.53 }),
    polished = chrome(),
    tire = rubber(),
    seam = fabric(shade(c, 0.08));
  // Five tapered spokes and paired caster wheels with an inset hub.
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5,
      x = Math.cos(a) * 0.275,
      z = Math.sin(a) * 0.275;
    g.add(rod([0, 0.135, 0], [x, 0.065, z], 0.024, frame, 0.016));
    g.add(Cy(0.013, 0.013, 0.04, polished, x, 0.042, z, 12));
    for (const side of [-1, 1]) {
      const wheel = Cy(0.027, 0.027, 0.017, tire, 0, 0, 0, 16);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x + side * 0.018, 0.027, z);
      g.add(wheel);
    }
  }
  g.add(Cy(0.035, 0.045, 0.18, frame, 0, 0.1, 0));
  g.add(Cy(0.023, 0.023, 0.15, polished, 0, 0.27, 0));
  g.add(B(0.23, 0.035, 0.25, frame, 0, 0.41, -0.02, 0.013));
  g.add(B(0.49, 0.045, 0.47, frame, 0, 0.435, 0.005, 0.022));
  g.add(B(0.48, 0.075, 0.465, upholstery, 0, 0.463, 0.012, 0.036));
  g.add(piping(0.458, 0.442, seam, 0.495, 0, 0.012));
  // A curved mesh back and separate lumbar pad give the chair its silhouette.
  const back = B(0.445, 0.55, 0.055, frame, 0, 0.535, -0.23, 0.027);
  const woven = mat(shade(c, 0.06), { surface: "mesh", roughness: 0.94 });
  const insert = B(0.39, 0.485, 0.028, woven, 0, 0.568, -0.194, 0.013);
  for (const o of [back, insert]) {
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setZ(
        i,
        p.getZ(i) +
          0.032 * Math.sin((p.getY(i) / 0.55 + 0.5) * Math.PI) -
          0.028 * (p.getX(i) / 0.23) ** 2,
      );
    o.geometry.computeVertexNormals();
    g.add(o);
  }
  g.add(B(0.33, 0.075, 0.035, upholstery, 0, 0.62, -0.145, 0.017));
  for (const x of [-0.267, 0.267]) {
    g.add(
      tube(
        [
          [x * 0.6, 0.445, -0.07],
          [x, 0.47, -0.07],
          [x, 0.65, -0.05],
        ],
        0.013,
        frame,
      ),
    );
    g.add(B(0.065, 0.034, 0.27, frame, x, 0.65, -0.035, 0.016));
  }
  g.add(rod([0.09, 0.43, 0.025], [0.23, 0.425, 0.065], 0.008, polished));
  g.add(B(0.06, 0.015, 0.025, tire, 0.21, 0.415, 0.065));
  return done(g, [upholstery, woven, seam]);
}
export function visitorChair(_, c) {
  const g = group(),
    fab = fabric(c),
    seam = fabric(shade(c, 0.08)),
    frame = metal();
  for (const x of [-0.211, 0.211]) {
    g.add(
      tube(
        [
          [x, 0.46, -0.19],
          [x, 0.08, -0.235],
          [x, 0.018, -0.2],
          [x, 0.018, 0.21],
          [x, 0.08, 0.23],
          [x, 0.44, 0.18],
        ],
        0.012,
        frame,
        false,
        28,
      ),
    );
    g.add(rod([x, 0.44, -0.18], [x, 0.79, -0.22], 0.011, frame));
  }
  g.add(B(0.48, 0.064, 0.46, fab, 0, 0.43, 0, 0.031));
  const back = B(0.455, 0.38, 0.055, fab, 0, 0.5, -0.205, 0.027);
  back.rotation.x = -0.075;
  g.add(back);
  g.add(piping(0.455, 0.434, seam, 0.462));
  return done(g, [fab, seam]);
}
export function sofa({ w, d, h }, c) {
  const g = group(),
    fab = fabric(c),
    cushion = fabric(shade(c, 0.045)),
    seam = fabric(shade(c, 0.09)),
    leg = wood("#675144");
  const arm = Math.min(w * 0.15, 0.15),
    inner = w - arm * 2,
    seats = Math.max(1, Math.min(6, Math.round(w / 0.8))),
    cw = inner / seats;
  feet(g, w, d, h * 0.13, leg, Math.min(w, d) * 0.12);
  g.add(B(w - 0.045, h * 0.27, d - 0.045, fab, 0, h * 0.12, 0, 0.045));
  g.add(B(w - 0.05, h * 0.55, d * 0.19, fab, 0, h * 0.43, -d * 0.39, 0.045));
  for (const x of [-w / 2 + arm / 2, w / 2 - arm / 2]) {
    g.add(B(arm, h * 0.59, d, fab, x, h * 0.13, 0, Math.min(arm * 0.3, 0.047)));
    g.add(piping(arm * 0.8, d * 0.94, seam, h * 0.7, x, 0, 0.002));
  }
  for (let i = 0; i < seats; i++) {
    const x = -inner / 2 + cw * (i + 0.5),
      sw = cw - 0.016;
    g.add(B(sw, h * 0.17, d * 0.72, cushion, x, h * 0.385, d * 0.105, 0.055));
    g.add(piping(sw - 0.025, d * 0.69, seam, h * 0.48, x, d * 0.105));
    const back = B(
      sw,
      h * 0.46,
      d * 0.17,
      cushion,
      x,
      h * 0.52,
      -d * 0.28,
      0.06,
    );
    back.rotation.x = -0.1;
    g.add(back);
  }
  if (w > 1.2) {
    const pillow = B(
      0.27,
      h * 0.32,
      0.105,
      fabric(shade(c, 0.15)),
      -inner * 0.36,
      h * 0.56,
      -d * 0.14,
      0.048,
    );
    pillow.rotation.set(-0.18, 0.12, -0.16);
    g.add(pillow);
  }
  return done(g, [fab, cushion, seam]);
}
export function stool({ w, d, h }, c) {
  const g = group(),
    seat = wood(c),
    frame = metal();
  const top = lathe(
    [
      [0, 0],
      [w / 2 - 0.01, 0],
      [w / 2, 0.01],
      [w / 2, 0.032],
      [w / 2 - 0.015, 0.04],
      [0, 0.034],
    ],
    seat,
    0,
    h - 0.04,
    0,
  );
  top.scale.z = d / w;
  g.add(top);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    g.add(
      rod(
        [Math.cos(a) * w * 0.43, 0.012, Math.sin(a) * d * 0.43],
        [Math.cos(a) * w * 0.32, h - 0.03, Math.sin(a) * d * 0.32],
        0.012,
        frame,
        0.015,
      ),
    );
  }
  g.add(ring(w * 0.36, d * 0.36, 0.008, frame, h * 0.3));
  return done(g, [seat]);
}

export function bookshelf({ w, d, h }, c) {
  const g = group(),
    timber = wood(c),
    back = wood(shade(c, -0.05)),
    r = rng(42),
    thickness = 0.023;
  const count = Math.max(2, Math.min(8, Math.round(h / 0.39))),
    step = (h - 0.08) / count;
  g.add(B(w - 0.02, h - 0.045, 0.012, back, 0, 0.045, -d / 2 + 0.006, 0.003));
  for (const x of [-w / 2 + thickness / 2, w / 2 - thickness / 2])
    g.add(B(thickness, h, d, timber, x, 0, 0, 0.005));
  const palette = [
    "#606f65",
    "#bc775b",
    "#c6b28d",
    "#637d87",
    "#e7dfcf",
    "#424b54",
  ];
  const covers = palette.map((p) => mat(p)),
    paper = mat("#e3ddcc"),
    ceramic = mat("#c0b39d", { roughness: 0.4 });
  for (let s = 0; s <= count; s++) {
    const y = s === count ? h - thickness : 0.04 + step * s;
    g.add(
      B(w - thickness * 2, thickness, d - 0.008, timber, 0, y, 0.004, 0.004),
    );
    if (s === count) continue;
    const n = Math.max(2, Math.min(12, Math.floor(w * (s % 2 ? 7 : 10))));
    let x = -w / 2 + 0.05;
    for (let j = 0; j < n; j++) {
      const bw = Math.min(0.027 + r() * 0.027, w * 0.045),
        bh = step * (0.55 + r() * 0.3),
        bd = d * (0.6 + r() * 0.1);
      const book = covers[(j + s * 2) % covers.length];
      g.add(B(bw, bh, bd, book, x + bw / 2, y + thickness, 0, 0.001));
      g.add(
        B(
          bw * 0.72,
          0.003,
          0.001,
          paper,
          x + bw / 2,
          y + thickness + bh * 0.78,
          bd / 2 + 0.001,
          0,
        ),
      );
      g.add(
        B(
          bw * 0.72,
          0.002,
          0.001,
          paper,
          x + bw / 2,
          y + thickness + bh * 0.18,
          bd / 2 + 0.001,
          0,
        ),
      );
      x += bw + 0.006;
    }
    if (x < w * 0.18) {
      const vx = w * 0.3,
        base = y + thickness;
      if (s % 2) {
        g.add(
          B(
            w * 0.24,
            step * 0.36,
            d * 0.72,
            fabric("#9b9b8f"),
            vx,
            base,
            0,
            0.012,
          ),
        );
        g.add(
          B(
            0.045,
            0.014,
            0.004,
            metal(),
            vx,
            base + step * 0.22,
            d * 0.365,
            0.004,
          ),
        );
      } else {
        const vase = lathe(
          [
            [0, 0],
            [0.05, 0],
            [0.065, 0.09],
            [0.033, 0.14],
            [0.03, 0.19],
            [0.025, 0.19],
            [0.025, 0.15],
          ],
          ceramic,
          vx,
          base,
          0,
        );
        vase.scale.setScalar(Math.min(step / 0.25, w / 0.6));
        g.add(vase);
      }
    }
  }
  return done(g, [timber, back]);
}
export function sideboard({ w, d, h }, c) {
  const g = group(),
    body = wood(c),
    front = wood(shade(c, 0.035)),
    frame = metal(),
    shadow = mat("#353a37");
  const legH = h * 0.15,
    n = Math.max(2, Math.min(8, Math.round(w / 0.5))),
    dw = (w - 0.035) / n;
  feet(g, w, d, legH, frame);
  g.add(B(w, h - legH, d - 0.026, body, 0, legH, -0.013, 0.01));
  g.add(
    B(
      w - 0.02,
      h - legH - 0.04,
      0.012,
      shadow,
      0,
      legH + 0.02,
      d / 2 - 0.025,
      0,
    ),
  );
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * dw;
    g.add(
      B(
        dw - 0.006,
        h - legH - 0.05,
        0.02,
        front,
        x,
        legH + 0.022,
        d / 2 - 0.017,
        0.004,
      ),
    );
    handle(g, x, h * 0.8, d / 2 - 0.003, Math.min(0.13, dw * 0.4), frame);
  }
  return done(g, [body, front]);
}
export function cabinet({ w, d, h, type }, c) {
  const locker = type === "locker",
    g = group(),
    body = locker ? metal(c) : wood(c),
    front = locker ? metal(shade(c, 0.035)) : wood(shade(c, 0.025)),
    detail = metal(),
    dark = rubber();
  const plinth = h * 0.035,
    n = w > 0.7 ? 2 : 1,
    dw = (w - 0.032) / n;
  g.add(B(w - 0.05, plinth, d - 0.05, detail, 0, 0, -0.01));
  g.add(B(w, h - plinth, d - 0.024, body, 0, plinth, -0.012, 0.008));
  g.add(
    B(
      w - 0.02,
      h - plinth - 0.02,
      0.01,
      dark,
      0,
      plinth + 0.01,
      d / 2 - 0.026,
      0,
    ),
  );
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * dw;
    g.add(
      B(
        dw - 0.006,
        h - plinth - 0.025,
        0.019,
        front,
        x,
        plinth + 0.012,
        d / 2 - 0.016,
        0.004,
      ),
    );
    const hx = n === 2 ? (i ? 0.035 : -0.035) : w * 0.3;
    handle(
      g,
      hx,
      h * 0.5,
      d / 2 - 0.002,
      Math.min(0.16, h * 0.2),
      detail,
      true,
    );
    if (locker) {
      for (const y of [h * 0.17, h * 0.83])
        for (let j = 0; j < 4; j++)
          g.add(
            B(
              dw * 0.44,
              0.007,
              0.001,
              dark,
              x,
              y + j * 0.018,
              d / 2 - 0.005,
              0,
            ),
          );
      g.add(
        B(dw * 0.25, 0.035, 0.002, detail, x, h * 0.74, d / 2 - 0.004, 0.002),
      );
    }
  }
  return done(g, [body, front]);
}
export function filingCabinet({ w, d, h }, c) {
  const g = group(),
    body = metal(c),
    fronts = metal(shade(c, 0.04)),
    trim = chrome(),
    dark = rubber(),
    label = mat("#e9e6df");
  g.add(B(w, h, d - 0.025, body, 0, 0, -0.0125, 0.012));
  g.add(B(w - 0.02, h - 0.04, 0.01, dark, 0, 0.02, d / 2 - 0.025, 0));
  const dh = (h - 0.065) / 3;
  for (let i = 0; i < 3; i++) {
    const y = 0.025 + i * dh;
    g.add(B(w - 0.025, dh - 0.009, 0.021, fronts, 0, y, d / 2 - 0.015, 0.004));
    handle(g, 0, y + dh * 0.62, d / 2 - 0.002, w * 0.36, trim);
    g.add(
      B(w * 0.25, 0.035, 0.002, trim, 0, y + dh * 0.78, d / 2 - 0.003, 0.002),
    );
    g.add(
      B(
        w * 0.21,
        0.024,
        0.001,
        label,
        0,
        y + dh * 0.78 + 0.005,
        d / 2 - 0.001,
        0,
      ),
    );
  }
  return done(g, [body, fronts]);
}

function leafGeometry(start, end, width) {
  const p = [],
    uv = [],
    indices = [],
    a = new THREE.Vector3(...start),
    b = new THREE.Vector3(...end);
  const dir = b.clone().sub(a),
    side = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
  for (let i = 0; i <= 10; i++) {
    const t = i / 10,
      center = a.clone().lerp(b, t);
    center.y += Math.sin(t * Math.PI) * dir.length() * 0.18;
    const breadth = (Math.sin(t * Math.PI) ** 0.85 * width) / 2;
    for (let j = -1; j <= 1; j++) {
      const v = center.clone().addScaledVector(side, breadth * j);
      v.y -= Math.abs(j) * breadth * 0.32;
      p.push(v.x, v.y, v.z);
      uv.push(t, (j + 1) / 2);
    }
  }
  for (let i = 0; i < 10; i++)
    for (let j = 0; j < 2; j++) {
      const n = i * 3 + j;
      indices.push(n, n + 3, n + 1, n + 1, n + 3, n + 4);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
export function plant({ w, d, h }, c) {
  const g = group(),
    leaf = mat(c, { roughness: 0.66, side: THREE.DoubleSide }),
    light = mat(shade(c, 0.08), { roughness: 0.72, side: THREE.DoubleSide }),
    stem = mat("#68754a"),
    pot = mat("#bdb09a", { surface: "stone", roughness: 0.78 }),
    dirt = mat("#39362c", { surface: "stone" });
  const ph = h * 0.235,
    pr = Math.min(w, d) * 0.245,
    r = rng(19);
  g.add(
    lathe(
      [
        [0, 0],
        [pr * 0.76, 0],
        [pr * 0.8, ph * 0.05],
        [pr, ph * 0.95],
        [pr * 0.97, ph],
        [pr * 0.88, ph],
        [pr * 0.86, ph * 0.91],
        [pr * 0.74, ph * 0.15],
        [0, ph * 0.15],
      ],
      pot,
    ),
  );
  g.add(Cy(pr * 0.86, pr * 0.86, 0.01, dirt, 0, ph * 0.91, 0));
  const stemRadius = Math.min(w, d) * 0.012;
  for (let branch = 0; branch < 3; branch++) {
    const angle = branch * 2.4,
      sx = Math.cos(angle) * w * 0.05,
      sz = Math.sin(angle) * d * 0.05,
      top = h * (0.96 - branch * 0.07);
    g.add(
      tube(
        [
          [sx * 0.4, ph * 0.9, sz * 0.4],
          [sx, h * 0.58, sz],
          [sx * 0.7, top, sz * 0.7],
        ],
        stemRadius,
        stem,
      ),
    );
    for (let j = 0; j < 6; j++) {
      const a = angle + j * 2.399,
        base = ph + (h - ph) * (0.14 + j * 0.105),
        reach = 0.3 + r() * 0.13;
      const start = [sx, base, sz],
        end = [
          Math.cos(a) * w * reach,
          Math.min(h * 0.99, base + h * (0.18 + r() * 0.05)),
          Math.sin(a) * d * reach,
        ];
      g.add(
        mesh(
          leafGeometry(start, end, Math.min(w, d) * (0.18 + r() * 0.07)),
          j % 3 ? leaf : light,
        ),
      );
      const mid = start.map((v, i) => (v + end[i]) / 2);
      mid[1] += h * 0.04;
      g.add(tube([start, mid, end], stemRadius * 0.22, stem, false, 10));
    }
  }
  return done(g, [leaf, light]);
}
export function floorLamp({ w, d, h }, c) {
  const g = group(),
    brass = metal("#b99a67"),
    base = metal("#444a48"),
    shadeMat = fabric(c),
    warm = mat("#fff0d6", { emissive: "#ffd2a0", emissiveIntensity: 1.5 });
  const r = Math.min(w, d) / 2,
    sh = Math.min(h * 0.22, 0.32),
    bottom = h - sh;
  g.add(
    lathe(
      [
        [0, 0],
        [r * 0.69, 0],
        [r * 0.74, 0.012],
        [r * 0.72, 0.029],
        [r * 0.48, 0.037],
        [0, 0.037],
      ],
      base,
    ),
  );
  g.add(Cy(0.011, 0.014, h - sh * 0.42 - 0.03, brass, 0, 0.03, 0, 16));
  const geo = new THREE.CylinderGeometry(r * 0.77, r, sh, 64, 1, true),
    p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const a = Math.atan2(p.getX(i), p.getZ(i)),
      scale = 1 - 0.013 * (0.5 + Math.cos(a * 32) * 0.5);
    p.setX(i, p.getX(i) * scale);
    p.setZ(i, p.getZ(i) * scale);
  }
  geo.computeVertexNormals();
  shadeMat.side = THREE.DoubleSide;
  g.add(mesh(geo, shadeMat, 0, bottom + sh / 2, 0));
  g.add(ring(r * 0.98, r * 0.98, 0.003, brass, bottom + 0.003));
  g.add(ring(r * 0.765, r * 0.765, 0.003, brass, h - 0.003));
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3;
    g.add(
      rod(
        [0, bottom + 0.025, 0],
        [Math.cos(a) * r * 0.95, bottom + 0.025, Math.sin(a) * r * 0.95],
        0.002,
        brass,
      ),
    );
  }
  g.add(E(0.065, 0.09, 0.065, warm, 0, bottom + sh * 0.3, 0));
  const light = new THREE.PointLight("#ffd9a6", 5, 5, 2);
  light.position.y = bottom + sh * 0.45;
  g.add(light);
  return done(g, [shadeMat]);
}
export function rug({ w, d, h }, c) {
  const g = group(),
    edge = fabric(shade(c, -0.06)),
    fab = fabric(c),
    inset = Math.min(w, d) * 0.045;
  g.add(B(w, h * 0.65, d, edge, 0, 0, 0, Math.min(h * 0.32, 0.007)));
  g.add(
    B(
      w - inset * 2,
      h * 0.5,
      d - inset * 2,
      fab,
      0,
      h * 0.5,
      0,
      Math.min(h * 0.2, 0.005),
    ),
  );
  const line = fabric(shade(c, 0.14));
  for (const z of [-d / 2 + inset * 1.8, d / 2 - inset * 1.8]) {
    g.add(B(w - inset * 3.6, 0.001, 0.009, line, 0, h * 0.99, z, 0));
    g.add(
      B(
        w - inset * 3.6,
        0.001,
        0.003,
        line,
        0,
        h * 0.99,
        z + (z > 0 ? -0.018 : 0.018),
        0,
      ),
    );
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return done(g, [edge, fab, line]);
}
export function rugRound({ w, d, h }, c) {
  const g = group(),
    fab = fabric(c),
    edge = fabric(shade(c, -0.06)),
    stitch = fabric(shade(c, 0.11));
  const base = Cy(w / 2, w / 2, h * 0.7, edge, 0, 0, 0, 64);
  base.scale.z = d / w;
  g.add(base);
  const face = Cy(w * 0.473, w * 0.473, h * 0.5, fab, 0, h * 0.5, 0, 64);
  face.scale.z = d / w;
  g.add(face);
  g.add(ring(w * 0.45, d * 0.45, 0.002, stitch, h * 0.95));
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return done(g, [fab, edge, stitch]);
}
export function whiteboard({ w, d, h }, c) {
  const g = group(),
    face = mat(c, { roughness: 0.27 }),
    frame = chrome(),
    cap = rubber();
  g.add(B(w, h, d * 0.43, frame, 0, 0, -d * 0.285, 0.009));
  g.add(B(w - 0.028, h - 0.028, 0.008, face, 0, 0.014, -d * 0.04, 0.003));
  g.add(B(w * 0.7, 0.012, d * 0.9, frame, 0, 0.015, d * 0.04, 0.005));
  g.add(B(w * 0.7, 0.013, 0.003, frame, 0, 0.022, d * 0.46, 0.001));
  for (let i = 0; i < 3; i++) {
    const pen = mat(["#324855", "#a75e4e", "#526b56"][i]);
    g.add(
      rod(
        [-w * 0.24 + i * 0.13, 0.034, d * 0.14],
        [-w * 0.24 + i * 0.13 + 0.09, 0.034, d * 0.14],
        0.005,
        face,
      ),
    );
    g.add(
      rod(
        [-w * 0.24 + i * 0.13 + 0.07, 0.034, d * 0.14],
        [-w * 0.24 + i * 0.13 + 0.09, 0.034, d * 0.14],
        0.006,
        pen,
      ),
    );
  }
  g.add(B(0.09, 0.016, 0.025, cap, w * 0.23, 0.028, d * 0.1));
  return done(g, [face]);
}
export function artFrame({ w, d, h }, c) {
  const g = group(),
    frame = wood("#635449"),
    paper = mat("#eee7d8", { roughness: 0.94 }),
    paint = mat(c),
    accent = mat(shade(c, 0.22)),
    ink = mat(shade(c, -0.15));
  pictureFrame(g, w, d, h, frame, 0.016);
  g.add(B(w - 0.028, h - 0.028, 0.002, paper, 0, 0.014, d / 2 - 0.007, 0));
  const aw = w * 0.79,
    ah = h * 0.72,
    y = h * 0.14,
    z = d / 2 - 0.005;
  g.add(B(aw, ah, 0.001, accent, 0, y, z, 0));
  const sun = mesh(
    new THREE.CircleGeometry(Math.min(aw, ah) * 0.2, 40),
    paper,
    aw * 0.18,
    y + ah * 0.67,
    z + 0.001,
  );
  g.add(sun);
  const hill = new THREE.Shape();
  hill.moveTo(-aw / 2, 0);
  hill.lineTo(aw / 2, 0);
  hill.lineTo(aw / 2, ah * 0.32);
  hill.bezierCurveTo(
    aw * 0.12,
    ah * 0.72,
    -aw * 0.12,
    ah * 0.05,
    -aw / 2,
    ah * 0.48,
  );
  hill.closePath();
  g.add(mesh(new THREE.ShapeGeometry(hill, 24), paint, 0, y, z + 0.002));
  const arch = new THREE.Shape();
  arch.moveTo(-aw * 0.32, 0);
  arch.lineTo(-aw * 0.32, ah * 0.48);
  arch.absarc(-aw * 0.15, ah * 0.48, aw * 0.17, Math.PI, 0, true);
  arch.lineTo(aw * 0.02, 0);
  arch.closePath();
  g.add(mesh(new THREE.ShapeGeometry(arch, 24), ink, 0, y, z + 0.003));
  return done(g, [paint, accent, ink]);
}
export function partition({ w, d, h }, c) {
  const g = group(),
    frame = metal("#696f70"),
    fab = fabric(c),
    stitch = fabric(shade(c, -0.08));
  g.add(B(w, h - 0.055, d * 0.8, frame, 0, 0.055, 0, 0.016));
  for (const z of [-d * 0.36, d * 0.36]) {
    g.add(B(w - 0.028, h - 0.085, d * 0.25, fab, 0, 0.07, z, 0.006));
    for (let i = 1; i <= 3; i++)
      g.add(
        B(
          0.002,
          h - 0.12,
          0.001,
          stitch,
          -w / 2 + (w * i) / 4,
          0.085,
          z + Math.sign(z) * d * 0.13,
          0,
        ),
      );
  }
  for (const x of [-w * 0.3, w * 0.3])
    g.add(B(w * 0.25, 0.055, d, frame, x, 0, 0, 0.012));
  return done(g, [fab, stitch]);
}

// A real hole in the worktop and a recessed bowl; no painted-on sink rectangle.
function sink(g, w, d, y, sx, rx, rz, material, bowlMaterial) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2);
  shape.lineTo(w / 2, -d / 2);
  shape.lineTo(w / 2, d / 2);
  shape.lineTo(-w / 2, d / 2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absellipse(sx, 0, rx, rz, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.025,
    bevelEnabled: false,
    curveSegments: 32,
    steps: 1,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, y, 0);
  g.add(mesh(geo, material));
  const bowl = lathe(
    [
      [0, -0.115],
      [0.42, -0.115],
      [0.65, -0.09],
      [0.88, -0.035],
      [1, -0.002],
      [1.035, 0.003],
      [1.045, 0.001],
      [1, -0.012],
      [0.89, -0.05],
      [0.62, -0.105],
      [0.42, -0.125],
      [0, -0.125],
    ],
    bowlMaterial,
    sx,
    y,
    0,
  );
  bowl.scale.set(rx, 1, rz);
  g.add(bowl);
  g.add(
    Cy(
      Math.min(rx, rz) * 0.1,
      Math.min(rx, rz) * 0.1,
      0.002,
      metal(),
      sx,
      y - 0.114,
      0,
    ),
  );
}
function faucet(g, x, y, z, height) {
  const m = chrome();
  g.add(Cy(0.024, 0.025, 0.008, m, x, y, z));
  g.add(
    tube(
      [
        [x, y + 0.004, z],
        [x, y + height * 0.8, z],
        [x, y + height * 0.95, z + height * 0.32],
        [x, y + height * 0.73, z + height * 0.57],
      ],
      0.011,
      m,
    ),
  );
  g.add(
    rod(
      [x + 0.017, y + height * 0.35, z],
      [x + 0.05, y + height * 0.55, z],
      0.006,
      m,
    ),
  );
}
export function counter({ w, d, h }, c) {
  const g = group(),
    body = mat(c, { roughness: 0.5 }),
    front = mat(shade(c, 0.025), { roughness: 0.5 }),
    dark = metal(),
    stone = mat("#686a65", { surface: "stone", roughness: 0.4 }),
    steel = chrome();
  const top = h * 0.81,
    plinth = top * 0.1,
    rx = Math.min(w * 0.18, 0.235),
    rz = d * 0.3,
    sx = -w * 0.23;
  g.add(B(w - 0.04, plinth, d - 0.09, dark, 0, 0, -0.025));
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02])
    g.add(B(0.02, top - plinth - 0.025, d - 0.03, body, x, plinth, -0.015));
  g.add(
    B(w - 0.04, top - plinth - 0.025, 0.018, body, 0, plinth, -d / 2 + 0.01),
  );
  // Keep the cabinet interior below the bowl open, with a dark recess.
  g.add(B(w - 0.02, 0.014, d - 0.03, dark, 0, top - 0.15, -0.015));
  sink(g, w, d, top, sx, rx, rz, stone, steel);
  faucet(g, sx, top, -d * 0.39, h * 0.18);
  const n = Math.max(2, Math.min(8, Math.round(w / 0.5))),
    dw = (w - 0.03) / n;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * dw;
    g.add(
      B(
        dw - 0.006,
        top - plinth - 0.04,
        0.016,
        front,
        x,
        plinth + 0.008,
        d / 2 - 0.015,
        0.004,
      ),
    );
    handle(g, x, top - 0.09, d / 2 - 0.002, Math.min(dw * 0.4, 0.15), dark);
  }
  return done(g, [body, front]);
}
export function fridge({ w, d, h }, c) {
  const g = group(),
    body = metal(c),
    front = metal(shade(c, 0.025)),
    trim = chrome(),
    gasket = rubber();
  g.add(B(w - 0.018, h - 0.025, d - 0.045, body, 0, 0.025, -0.0225, 0.024));
  g.add(B(w - 0.01, h - 0.045, 0.012, gasket, 0, 0.03, d / 2 - 0.04, 0.006));
  const split = h * 0.67;
  g.add(
    B(w - 0.008, split - 0.028, 0.035, front, 0, 0.028, d / 2 - 0.026, 0.016),
  );
  g.add(
    B(
      w - 0.008,
      h - split - 0.01,
      0.035,
      front,
      0,
      split + 0.007,
      d / 2 - 0.026,
      0.016,
    ),
  );
  handle(g, w * 0.36, h * 0.49, d / 2 - 0.002, h * 0.23, trim, true);
  handle(g, w * 0.36, h * 0.79, d / 2 - 0.002, h * 0.14, trim, true);
  g.add(B(w * 0.2, 0.008, 0.001, trim, 0, h * 0.91, d / 2 - 0.007, 0));
  g.add(B(w - 0.07, 0.025, d - 0.1, gasket, 0, 0, 0));
  return done(g, [body, front]);
}
export function toilet(_, c) {
  const g = group(),
    ceramic = mat(c, { roughness: 0.2 }),
    seat = mat(shade(c, -0.025), { roughness: 0.32 }),
    steel = chrome();
  const base = lathe(
    [
      [0, 0],
      [0.11, 0],
      [0.12, 0.025],
      [0.085, 0.21],
      [0.13, 0.31],
      [0.16, 0.36],
      [0.17, 0.39],
      [0.15, 0.4],
      [0.13, 0.365],
      [0.09, 0.26],
      [0, 0.25],
    ],
    ceramic,
    0,
    0,
    0.085,
  );
  base.scale.z = 1.32;
  g.add(base);
  g.add(ring(0.161, 0.218, 0.016, seat, 0.412, 0, 0.085));
  // Closed-back cistern, separate lid, hinges and a dual flush button.
  g.add(B(0.36, 0.4, 0.15, ceramic, 0, 0.405, -0.245, 0.035));
  g.add(B(0.37, 0.024, 0.16, seat, 0, 0.796, -0.245, 0.011));
  g.add(E(0.055, 0.004, 0.035, steel, 0.07, 0.816, -0.245));
  for (const x of [-0.08, 0.08])
    g.add(B(0.028, 0.015, 0.05, steel, x, 0.412, -0.12, 0.007));
  return done(g, [ceramic, seat]);
}
export function basin({ w, d, h }, c) {
  const g = group(),
    body = wood(c),
    front = wood(shade(c, 0.03)),
    white = mat("#f2f0e8", { roughness: 0.22 }),
    dark = metal();
  const y = h * 0.84;
  g.add(B(w - 0.04, 0.07, d - 0.07, dark, 0, 0, -0.01));
  for (const x of [-w / 2 + 0.02, w / 2 - 0.02])
    g.add(B(0.02, y - 0.095, d - 0.025, body, x, 0.07, -0.0125));
  g.add(B(w - 0.04, y - 0.095, 0.018, body, 0, 0.07, -d / 2 + 0.01));
  for (let i = 0; i < 2; i++) {
    const dh = (y - 0.1) / 2,
      bottom = 0.075 + i * dh;
    g.add(
      B(w - 0.028, dh - 0.007, 0.016, front, 0, bottom, d / 2 - 0.014, 0.005),
    );
    handle(g, 0, bottom + dh - 0.045, d / 2 - 0.002, w * 0.34, dark);
  }
  sink(g, w, d, y, 0, w * 0.37, d * 0.31, white, white);
  faucet(g, 0, y, -d * 0.4, h * 0.15);
  return done(g, [body, front]);
}
export function mirror({ w, d, h }, c) {
  const g = group(),
    frame = metal(c),
    glass = mat("#d8e3e5", { roughness: 0.065, metalness: 0.96 });
  pictureFrame(g, w, d, h, frame, 0.013);
  g.add(B(w - 0.022, h - 0.022, 0.004, glass, 0, 0.011, d / 2 - 0.003, 0.002));
  return done(g, [frame]);
}

function pictureFrame(g, w, d, h, material, border) {
  g.add(B(w, h, 0.003, material, 0, 0, -d / 2 + 0.0015, 0.001));
  for (const x of [-w / 2 + border / 2, w / 2 - border / 2])
    g.add(B(border, h, d, material, x, 0, 0, 0.004));
  for (const y of [0, h - border])
    g.add(B(w - border * 2, border, d, material, 0, y, 0, 0.004));
}
