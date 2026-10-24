// Photo mode: re-renders the current view with a GPU path tracer for a
// near-photoreal still. The editor's real-time pipeline pauses while it runs;
// orbiting the camera restarts the render.
import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

// The path tracer lights the scene from an equirect environment, so build a
// small sky dome (bright blue above, grey ground below) tinted by time of day.
function skyTexture(day) {
  const w = 64;
  const h = 32;
  const night = 1 - day;
  const top = new THREE.Color('#6f9fd8').lerp(new THREE.Color('#0b0f1a'), night);
  const horizon = new THREE.Color('#e4ecf4').lerp(new THREE.Color('#1b1f2a'), night);
  const ground = new THREE.Color('#5c5a55').lerp(new THREE.Color('#050505'), night);
  const data = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    // Row 0 is the bottom of the texture, i.e. straight down.
    const up = y / (h - 1);
    const c = up > 0.5 ? horizon.clone().lerp(top, (up - 0.5) * 2) : ground.clone().lerp(horizon, up * 2);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.needsUpdate = true;
  return tex;
}

const GLASS = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 1, roughness: 0, ior: 1.5, thickness: 0.02 });

export class PhotoMode {
  constructor({ renderer, scene, getCamera, getControls, onStatus }) {
    this.renderer = renderer;
    this.scene = scene;
    this.getCamera = getCamera;
    this.getControls = getControls;
    this.onStatus = onStatus;
    this.active = false;
    this.ready = false;
    this.tracer = null;
  }

  async enter({ walls, day }) {
    if (this.active) return;
    this.active = true;
    this.ready = false;
    this.onStatus('Preparing scene…');
    const scene = this.scene;

    // Walls faded out for the dollhouse view would still block light here.
    this.hiddenWalls = walls.filter((g) => g.userData.material.opacity < 0.5);
    for (const g of this.hiddenWalls) g.visible = false;
    for (const g of walls) g.userData.material.opacity = 1;

    // Real glass instead of the cheap translucent pane.
    this.swapped = [];
    scene.traverse((o) => {
      if (o.isMesh && o.material?.userData?.glass) {
        this.swapped.push([o, o.material]);
        o.material = GLASS;
      }
    });

    this.prevEnv = scene.environment;
    this.prevEnvIntensity = scene.environmentIntensity;
    this.sky = skyTexture(day);
    scene.environment = this.sky;
    scene.environmentIntensity = 1;

    if (!this.tracer) {
      const t = new WebGLPathTracer(this.renderer);
      t.bounces = 6;
      t.transmissiveBounces = 6;
      t.filterGlossyFactor = 0.5;
      t.renderScale = 1;
      t.tiles.set(2, 2);
      t.dynamicLowRes = true;
      t.lowResScale = 0.25;
      t.minSamples = 1;
      t.renderDelay = 0;
      t.fadeDuration = 300;
      this.tracer = t;
    }
    try {
      // Let the status paint, then build the BVH on the main thread: the
      // scene is a few thousand triangles, so this takes well under a second.
      await new Promise((r) => setTimeout(r, 30));
      if (!this.active) return;
      this.tracer.setScene(scene, this.getCamera());
    } catch (err) {
      console.error(err);
      this.onStatus(`Photo mode failed: ${err.message}`);
      this.exit();
      return;
    }
    if (!this.active) return;
    this.controls = this.getControls();
    this.onCamera = () => this.tracer.updateCamera();
    this.controls.addEventListener('change', this.onCamera);
    this.ready = true;
  }

  render() {
    if (!this.active || !this.ready) return;
    this.tracer.renderSample();
    this.onStatus(`${Math.floor(this.tracer.samples)} samples · drag to change the view`);
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.ready = false;
    this.controls?.removeEventListener('change', this.onCamera);
    for (const g of this.hiddenWalls || []) g.visible = true;
    for (const [o, m] of this.swapped || []) o.material = m;
    this.scene.environment = this.prevEnv;
    this.scene.environmentIntensity = this.prevEnvIntensity;
    this.sky?.dispose();
    this.sky = null;
    this.onStatus('');
  }

  // Render one more sample and grab the canvas in the same task, before the
  // browser gets a chance to clear the drawing buffer.
  savePNG() {
    if (!this.ready) return;
    this.tracer.renderSample();
    const a = document.createElement('a');
    a.href = this.renderer.domElement.toDataURL('image/png');
    a.download = `offiz-photo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    a.click();
  }
}
