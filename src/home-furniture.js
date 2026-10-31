// Home furniture uses the same bottom-centre origin and +Z front as the catalog.
import * as THREE from "three";
import { shade } from "./textures.js";
import {
  mat,
  wood,
  fabric,
  metal,
  box as B,
  cylinder as Cy,
  ellipsoid as E,
  rod,
  piping,
  finishModel as done,
} from "./model-kit.js";

const group = () => new THREE.Group();
function legs(g, w, d, height, material, centerZ = 0) {
  for (const x of [-w * 0.4, w * 0.4])
    for (const z of [-d * 0.38, d * 0.38])
      g.add(Cy(0.018, 0.025, height, material, x, 0, z + centerZ, 12));
}
function pull(g, x, y, z, width, material) {
  g.add(rod([x - width / 2, y, z], [x + width / 2, y, z], 0.006, material));
}

export function bed({ w, d, h }, c) {
  const g = group(),
    frame = wood("#81654c"),
    linen = fabric(c),
    sheet = fabric("#f4eee3"),
    seam = fabric(shade(c, -0.16)),
    accent = fabric("#777f65"),
    head = fabric(shade(c, -0.12));
  legs(g, w, d, h * 0.14, frame);
  g.add(B(w, h * 0.2, d * 0.94, frame, 0, h * 0.12, d * 0.02, 0.025));
  g.add(B(w, h * 0.86, d * 0.065, head, 0, h * 0.14, -d * 0.467, 0.035));
  // Padded headboard panels, mattress welt, soft duvet and separate pillows.
  for (const x of [-w * 0.25, w * 0.25])
    g.add(
      B(w * 0.48, h * 0.59, d * 0.025, linen, x, h * 0.38, -d * 0.426, 0.025),
    );
  g.add(B(w * 0.95, h * 0.22, d * 0.88, sheet, 0, h * 0.32, d * 0.025, 0.06));
  g.add(piping(w * 0.94, d * 0.87, sheet, h * 0.44, 0, d * 0.025));
  g.add(B(w * 0.96, h * 0.085, d * 0.66, linen, 0, h * 0.51, d * 0.137, 0.04));
  g.add(
    B(w * 0.96, h * 0.025, d * 0.105, sheet, 0, h * 0.59, -d * 0.145, 0.012),
  );
  const count = w < 1.3 ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : (i ? 1 : -1) * w * 0.235;
    g.add(
      B(
        w * (count === 1 ? 0.72 : 0.41),
        h * 0.11,
        d * 0.19,
        sheet,
        x,
        h * 0.54,
        -d * 0.3,
        0.05,
      ),
    );
  }
  g.add(B(w * 0.97, h * 0.025, d * 0.19, accent, 0, h * 0.598, d * 0.33, 0.01));
  for (let i = 0; i < 7; i++)
    g.add(
      B(
        0.009,
        h * 0.005,
        d * 0.185,
        seam,
        (i - 3) * w * 0.12,
        h * 0.623,
        d * 0.33,
        0,
      ),
    );
  return done(g, [linen, head, seam]);
}

export function bedroomStorage({ w, d, h, type }, c) {
  const g = group(),
    timber = wood(c),
    front = wood(shade(c, 0.04)),
    recess = mat("#3e352e"),
    brass = metal("#ae9271"),
    wardrobe = type === "wardrobe",
    base = wardrobe ? h * 0.035 : h * 0.14;
  if (wardrobe) g.add(B(w * 0.92, base, d * 0.86, recess, 0, 0, 0));
  else legs(g, w, d, base, timber);
  g.add(B(w, h - base, d * 0.94, timber, 0, base, -d * 0.03, 0.012));
  g.add(
    B(
      w * 0.965,
      (h - base) * 0.88,
      0.012,
      recess,
      0,
      base + h * 0.035,
      d * 0.445,
      0,
    ),
  );
  const cols = wardrobe || type === "dresser" ? 2 : 1;
  const rows = wardrobe ? 1 : type === "dresser" ? 3 : 2;
  const cw = (w * 0.94) / cols,
    rh = ((h - base) * 0.88) / rows;
  for (let col = 0; col < cols; col++)
    for (let row = 0; row < rows; row++) {
      const x = (col - (cols - 1) / 2) * cw,
        y = base + h * 0.035 + row * rh;
      g.add(
        B(cw - 0.009, rh - 0.009, d * 0.035, front, x, y, d * 0.465, 0.004),
      );
      if (wardrobe) {
        const hx = x + (col ? -1 : 1) * cw * 0.35;
        g.add(
          rod(
            [hx, h * 0.43, d * 0.498],
            [hx, h * 0.59, d * 0.498],
            0.007,
            brass,
          ),
        );
      } else pull(g, x, y + rh * 0.72, d * 0.498, cw * 0.24, brass);
    }
  return done(g, [timber, front]);
}

export function sectional({ w, d, h }, c) {
  const g = group(),
    upholstery = fabric(c),
    seam = fabric(shade(c, -0.12)),
    feet = wood("#584737"),
    cushion = fabric("#e4d8c2"),
    accent = fabric("#b97858");
  const mainDepth = d * 0.56,
    backZ = -d / 2;
  legs(g, w, mainDepth, h * 0.13, feet, backZ + mainDepth / 2);
  for (const x of [-w * 0.42, -w * 0.22])
    g.add(Cy(0.018, 0.025, h * 0.13, feet, x, 0, d * 0.41, 12));
  g.add(
    B(
      w,
      h * 0.29,
      mainDepth,
      upholstery,
      0,
      h * 0.11,
      backZ + mainDepth / 2,
      0.055,
    ),
  );
  g.add(
    B(
      w * 0.35,
      h * 0.29,
      d * 0.92,
      upholstery,
      -w * 0.325,
      h * 0.11,
      d * 0.04,
      0.055,
    ),
  );
  g.add(
    B(
      w * 0.91,
      h * 0.63,
      d * 0.13,
      upholstery,
      0,
      h * 0.35,
      backZ + d * 0.065,
      0.06,
    ),
  );
  for (const x of [-w * 0.464, w * 0.464])
    g.add(
      B(
        w * 0.072,
        h * 0.62,
        mainDepth,
        upholstery,
        x,
        h * 0.14,
        backZ + mainDepth / 2,
        0.055,
      ),
    );
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * w * 0.28,
      chaise = i === 0,
      sd = chaise ? d * 0.76 : d * 0.35,
      z = chaise ? d * 0.08 : -d * 0.165;
    g.add(B(w * 0.27, h * 0.17, sd, upholstery, x, h * 0.4, z, 0.05));
    g.add(piping(w * 0.257, sd * 0.96, seam, h * 0.485, x, z));
    g.add(
      B(w * 0.275, h * 0.4, d * 0.1, upholstery, x, h * 0.56, -d * 0.33, 0.045),
    );
  }
  g.add(
    B(
      w * 0.14,
      h * 0.34,
      d * 0.095,
      cushion,
      -w * 0.28,
      h * 0.57,
      -d * 0.24,
      0.04,
    ),
  );
  g.add(
    B(
      w * 0.14,
      h * 0.32,
      d * 0.095,
      accent,
      w * 0.28,
      h * 0.57,
      -d * 0.24,
      0.04,
    ),
  );
  return done(g, [upholstery, seam]);
}

export function mediaConsole({ w, d, h }, c) {
  const g = group(),
    timber = wood(c),
    dark = mat("#37332e"),
    fronts = wood(shade(c, 0.04)),
    hardware = metal("#9e8a6a");
  legs(g, w, d, h * 0.2, dark);
  g.add(B(w, h * 0.075, d, timber, 0, h * 0.925, 0, 0.015));
  g.add(B(w, h * 0.065, d, timber, 0, h * 0.2, 0));
  g.add(B(w, h * 0.66, 0.025, timber, 0, h * 0.265, -d / 2 + 0.013));
  for (const x of [-w * 0.49, -w * 0.18, w * 0.18, w * 0.49])
    g.add(B(w * 0.02, h * 0.66, d, timber, x, h * 0.265, 0));
  for (const x of [-w * 0.337, w * 0.337]) {
    g.add(B(w * 0.29, h * 0.64, 0.025, fronts, x, h * 0.275, d / 2 - 0.018));
    pull(g, x, h * 0.79, d / 2, w * 0.09, hardware);
  }
  g.add(B(w * 0.34, h * 0.025, d * 0.88, timber, 0, h * 0.56, 0));
  // Open centre shelf with a receiver and a small stack of books.
  g.add(B(w * 0.23, h * 0.16, d * 0.72, dark, 0, h * 0.59, 0, 0.01));
  const books = mat("#cbb99b");
  for (let i = 0; i < 3; i++)
    g.add(
      B(
        w * (0.15 + i * 0.015),
        h * 0.055,
        d * 0.63,
        books,
        -w * 0.035,
        h * (0.27 + i * 0.06),
        d * 0.05,
        0.002,
      ),
    );
  return done(g, [timber, fronts]);
}

export function television({ w, d, h }, c) {
  const g = group(),
    frame = metal(c),
    black = mat("#0c1317", { roughness: 0.2 }),
    screen = mat("#253f42", { roughness: 0.22, metalness: 0.18 }),
    glow = mat("#9aab9b", { roughness: 0.5 });
  const depth = Math.min(d * 0.3, 0.045);
  g.add(B(w, h * 0.88, depth, frame, 0, h * 0.12, 0, 0.012));
  g.add(
    B(
      w * 0.978,
      h * 0.837,
      0.003,
      black,
      0,
      h * 0.14,
      depth / 2 + 0.002,
      0.004,
    ),
  );
  g.add(
    B(
      w * 0.96,
      h * 0.816,
      0.002,
      screen,
      0,
      h * 0.15,
      depth / 2 + 0.004,
      0.003,
    ),
  );
  // Muted landscape art on the screen keeps it legible without external images.
  g.add(
    E(w * 0.17, h * 0.23, 0.001, glow, w * 0.26, h * 0.59, depth / 2 + 0.006),
  );
  const hills = mat("#597675");
  g.add(E(w * 0.94, h * 0.29, 0.001, hills, 0, h * 0.16, depth / 2 + 0.007));
  for (const x of [-w * 0.32, w * 0.32])
    for (const sign of [-1, 1])
      g.add(
        rod(
          [x, h * 0.17, 0],
          [x + sign * w * 0.05, 0.008, sign * d * 0.46],
          0.01,
          frame,
        ),
      );
  return done(g, [frame]);
}

export function sideTable({ w, d, h }, c) {
  const g = group(),
    timber = wood(c),
    base = wood(shade(c, -0.12));
  const top = Cy(0.5, 0.5, h * 0.075, timber, 0, h * 0.925, 0, 40);
  top.scale.set(w, 1, d);
  g.add(top);
  g.add(
    Cy(
      Math.min(w, d) * 0.14,
      Math.min(w, d) * 0.2,
      h * 0.85,
      base,
      0,
      h * 0.075,
      0,
    ),
  );
  const foot = Cy(0.42, 0.45, h * 0.075, base);
  foot.scale.set(w, 1, d);
  g.add(foot);
  return done(g, [timber, base]);
}

export function ottoman({ w, d, h }, c) {
  const g = group(),
    cloth = fabric(c),
    seam = fabric(shade(c, -0.12)),
    timber = wood("#745840");
  legs(g, w, d, h * 0.18, timber);
  g.add(B(w, h * 0.56, d, cloth, 0, h * 0.15, 0, 0.07));
  g.add(B(w, h * 0.3, d, cloth, 0, h * 0.7, 0, 0.07));
  g.add(piping(w * 0.96, d * 0.96, seam, h * 0.79));
  return done(g, [cloth, seam]);
}

export function tableLamp({ w, d, h }, c) {
  const g = group(),
    ceramic = mat(c, { roughness: 0.35 }),
    linen = fabric("#f1e4cd"),
    brass = metal("#ad9472"),
    radius = Math.min(w, d) / 2;
  g.add(Cy(radius * 0.57, radius * 0.67, h * 0.045, ceramic));
  g.add(E(w * 0.62, h * 0.46, d * 0.62, ceramic, 0, h * 0.035, 0));
  g.add(Cy(radius * 0.07, radius * 0.07, h * 0.25, brass, 0, h * 0.4, 0));
  // Open shade plus an inner diffuser; no additional shadow-casting light.
  const shade = Cy(0.35, 0.5, h * 0.4, linen, 0, h * 0.6, 0, 32, true);
  shade.scale.set(w, 1, d);
  shade.material.side = THREE.DoubleSide;
  g.add(shade);
  const diffuser = mat("#ffe8b9", {
    emissive: "#ffd49a",
    emissiveIntensity: 0.45,
  });
  g.add(Cy(radius * 0.86, radius * 0.86, 0.003, diffuser, 0, h * 0.62, 0));
  return done(g, [ceramic]);
}
