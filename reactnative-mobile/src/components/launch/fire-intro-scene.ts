/**
 * Data + WebGL renderer for the "Than lửa" launch intro
 * (approved preview: design-previews/intro-than-lua.html).
 *
 * Every particle's motion is a pure function of time, so the whole scene is
 * uploaded once as static vertex buffers and the vertex shaders compute where
 * each ember and flame is from a single `uT` uniform. Per frame the JS thread
 * only sets a handful of uniforms and issues ~8 draw calls.
 *
 * Coordinates are in the 390×844 design frame, mapped onto the screen with
 * "cover" scaling (see `introFrame`).
 */
import nameData from "./fire-intro-name.json";

export const INTRO_W = 390;
export const INTRO_H = 844;
/** Centre of the icon and of the ember sphere. */
const CX = 195;
const CY = 400;
const ICON = 190;
const BAR = { y: 528, w: 210, h: 3 } as const;
/** Box the name textures cover (design units). */
export const NAME_BOX = nameData.box as { x: number; y: number; w: number; h: number };

const BURST = 1110;
const STEP = 16;
const N_EMBERS = 620;

export type Pt = { x: number; y: number };
type Ember = { phi: number; th: number; emit: number; seed: number; bx: number; by: number; tx: number; ty: number; go: number; size: number };
type Emitter = {
  kind: 0 | 1 | 2;
  from: number;
  to: number;
  rate: number;
  seed: number;
  life: [number, number];
  rise: [number, number];
  size: [number, number];
  pick: (h1: number, h2: number, st: number) => Pt | null;
};

export type FireScene = {
  /** 10 floats per ember: phi, th, emit, seed | bx, by, tx, ty | go, size. */
  embers: Float32Array;
  emberCount: number;
  /** 8 floats per flame: sx, sy, st, life | rise, size, phase, kind. */
  flames: Float32Array;
  flameCount: number;
  targets: Pt[];
};

const lerp = (a: number, b: number, x: number) => a + (b - a) * x;
const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function onSphere(p: Ember, t: number) {
  const R = lerp(60, 132, outCubic(seg(t, p.emit, p.emit + 500)));
  const rot = t * 0.0042;
  const tilt = 0.42;
  const x = R * Math.sin(p.phi) * Math.cos(p.th + rot);
  const y = R * Math.cos(p.phi);
  const z = R * Math.sin(p.phi) * Math.sin(p.th + rot);
  const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
  const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
  const s = 420 / (420 + z2);
  return { x: CX + x * s, y: CY + y2 * s, depth: s };
}

export function buildFireScene(): FireScene {
  const targets = (nameData.targets as number[][]).map(([x, y]) => ({ x, y }));
  const r = rng(71);
  const embers: Ember[] = Array.from({ length: N_EMBERS }, (_, i) => {
    // even spread on a sphere (golden spiral)
    const k = (i + 0.5) / N_EMBERS;
    const phi = Math.acos(1 - 2 * k);
    const th = i * 2.39996;
    const ba = r() * 6.283;
    const bs = lerp(120, 330, Math.pow(r(), 0.7));
    const tg = targets[i % targets.length];
    const emit = 380 + r() * 380;
    const seed = r() * 100;
    const bx = Math.cos(ba) * bs;
    const by = Math.sin(ba) * bs * 1.25 - 40 * r();
    const tx = tg.x + (r() - 0.5) * 1.5;
    const ty = tg.y + (r() - 0.5) * 1.5;
    const go = 1290 + r() * 170;
    const size = lerp(2.2, 4.2, r());
    return { phi, th, emit, seed, bx, by, tx, ty, go, size };
  });

  const emitters: Emitter[] = [
    // the glove burns: tall tongues of fire off the leather
    {
      kind: 0, from: 330, to: 1000, rate: 7, seed: 1, life: [420, 720], rise: [80, 170], size: [9, 20],
      pick: (h1, h2) => {
        const a = h1 * 6.283;
        const rr = Math.sqrt(h2) * 86;
        return { x: CX + Math.cos(a) * rr * 0.92, y: CY + 14 + Math.sin(a) * rr };
      },
    },
    // the sphere keeps burning while it turns: flames off its front face
    {
      kind: 1, from: 700, to: BURST, rate: 5, seed: 2, life: [300, 520], rise: [40, 100], size: [5, 12],
      pick: (h1, _h2, st) => {
        const p = embers[Math.floor(h1 * embers.length)];
        if (st < p.emit) return null;
        const s = onSphere(p, st);
        return s.depth > 0.98 ? s : null;
      },
    },
    // the name burns; these loop (each on its own period) for as long as the intro holds
    {
      kind: 2, from: 1500, to: 2020, rate: 8, seed: 3, life: [380, 680], rise: [34, 96], size: [6, 15],
      pick: (h1) => targets[Math.floor(h1 * targets.length)],
    },
  ];

  const flames: number[] = [];
  for (const e of emitters) {
    for (let s = Math.ceil(e.from / STEP); s * STEP <= e.to; s++) {
      const st = s * STEP;
      for (let k = 0; k < e.rate; k++) {
        const b = e.seed * 1000 + s * 17 + k * 3;
        const h1 = hash(b);
        const h2 = hash(b + 0.5);
        const h3 = hash(b + 1.1);
        const h4 = hash(b + 1.7);
        const src = e.pick(h1, h2, st);
        if (!src) continue;
        flames.push(
          src.x, src.y, st, lerp(e.life[0], e.life[1], h3),
          lerp(e.rise[0], e.rise[1], h4), lerp(e.size[0], e.size[1], h1), h2, e.kind,
        );
      }
    }
  }

  const ember = new Float32Array(N_EMBERS * 10);
  embers.forEach((p, i) => ember.set([p.phi, p.th, p.emit, p.seed, p.bx, p.by, p.tx, p.ty, p.go, p.size], i * 10));
  return { embers: ember, emberCount: N_EMBERS, flames: new Float32Array(flames), flameCount: flames.length / 8, targets };
}

/**
 * Map the design frame onto a screen with "cover" scaling (like
 * preserveAspectRatio xMidYMid slice): px per design unit and offsets.
 */
export function introFrame(width: number, height: number) {
  const u = Math.max(width / INTRO_W, height / INTRO_H);
  return { u, ox: (width - INTRO_W * u) / 2, oy: (height - INTRO_H * u) / 2 };
}

/** Flame strength per emitter at time t (glove, sphere, name). */
export function flameStrength(t: number): [number, number, number] {
  const cool = seg(t, 1700, 2150);
  return [
    seg(t, 330, 560) * (1 - seg(t, 900, 1150)),
    seg(t, 700, 820) * (1 - seg(t, 1110, 1300)),
    seg(t, 1500, 1640) * (1 - 0.5 * cool),
  ];
}

// ---------------------------------------------------------------- shaders

const COMMON = `
uniform float uT;
uniform vec3 uFrame;   // u, ox, oy
uniform vec2 uView;    // layout size (dp)
uniform float uDpr;
uniform float uMaxPoint;
float seg(float t, float a, float b) { return clamp((t - a) / (b - a), 0.0, 1.0); }
float outC(float x) { float y = 1.0 - x; return 1.0 - y * y * y; }
float inOut(float x) { return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
vec4 toClip(vec2 d) {
  vec2 px = uFrame.yz + d * uFrame.x;
  return vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
}
float pointPx(float designSize) { return min(designSize * uFrame.x * uDpr, uMaxPoint); }
`;

const EMBER_VS = `
precision highp float;
attribute vec4 aA; // phi, th, emit, seed
attribute vec4 aB; // bx, by, tx, ty
attribute vec2 aC; // go, size
uniform float uLag;
uniform vec3 uTrail; // size, heat, alpha factors
varying float vHeat;
varying float vAlpha;
${COMMON}
const vec2 C = vec2(${CX}.0, ${CY}.0);
const float BURST = ${BURST}.0;
vec3 sphere(float t) {
  float R = mix(60.0, 132.0, outC(seg(t, aA.z, aA.z + 500.0)));
  float rot = t * 0.0042;
  float tilt = 0.42;
  float x = R * sin(aA.x) * cos(aA.y + rot);
  float y = R * cos(aA.x);
  float z = R * sin(aA.x) * sin(aA.y + rot);
  float y2 = y * cos(tilt) - z * sin(tilt);
  float z2 = y * sin(tilt) + z * cos(tilt);
  float s = 420.0 / (420.0 + z2);
  return vec3(C.x + x * s, C.y + y2 * s, s);
}
void main() {
  float now = uT;
  float t = uT - uLag;
  float emit = aA.z;
  float seed = aA.w;
  float go = aC.x;
  bool fast = now >= BURST && now < go + 380.0;
  if (t < emit || (uLag > 0.0 && !fast)) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 0.0;
    vHeat = 0.0;
    vAlpha = 0.0;
    return;
  }
  float fl = 0.75 + 0.25 * sin(t * 0.03 + seed * 7.0);
  float size = aC.y;
  float a = outC(seg(t, emit, emit + 120.0));
  float heat;
  vec2 p;
  if (t < BURST) {
    vec3 sp = sphere(t);
    float ek = outC(seg(t, emit, emit + 380.0));
    vec2 ring = vec2(C.x + cos(aA.y) * 100.0, C.y + sin(aA.y) * 108.0);
    p = mix(ring, sp.xy, ek);
    p.y -= 10.0 * sin(t * 0.01 + seed);
    heat = (0.35 + 0.45 * (sp.z - 0.75) * 2.0) * fl;
    size *= sp.z;
    a *= mix(0.35, 1.0, (sp.z - 0.76) * 2.1);
  } else {
    vec3 from = sphere(BURST);
    float bk = outC(seg(t, BURST, BURST + 330.0));
    vec2 b = vec2(from.x + aB.x * bk, from.y + aB.y * bk - 30.0 * bk);
    if (t < go) {
      p = b;
      heat = mix(0.95, 0.55, bk) * fl;
    } else {
      float ck = inOut(seg(t, go, go + 380.0));
      float sw = sin(ck * 3.14159265) * 26.0;
      p = mix(b, aB.zw, ck) + sw * vec2(cos(seed), sin(seed));
      heat = mix(0.6, 1.0, ck) * fl;
      size = mix(size, 2.4, ck);
      a *= 1.0 - seg(t, 1660.0, 1820.0);
    }
  }
  gl_Position = toClip(p);
  gl_PointSize = pointPx(size * 4.4 * uTrail.x);
  vHeat = heat * uTrail.y;
  vAlpha = clamp(a, 0.0, 1.0) * uTrail.z;
}
`;

const FLAME_VS = `
precision highp float;
attribute vec4 aF0; // sx, sy, st, life
attribute vec4 aF1; // rise, size, phase, kind
uniform vec3 uStr;
varying float vHeat;
varying float vAlpha;
${COMMON}
void main() {
  float st = aF0.z;
  float life = aF0.w;
  float kind = aF1.w;
  float age = (uT - st) / life;
  // the name's flames loop, each on its own period, for as long as the intro holds
  if (kind > 1.5 && uT >= st) age = mod(uT - st, life) / life;
  float str = kind < 0.5 ? uStr.x : (kind < 1.5 ? uStr.y : uStr.z);
  if (age < 0.0 || age >= 1.0 || str <= 0.01) {
    gl_Position = vec4(2.0, 2.0, 0.0, 1.0);
    gl_PointSize = 0.0;
    vHeat = 0.0;
    vAlpha = 0.0;
    return;
  }
  float rise = aF1.x * (age + 0.6 * age * age);
  vec2 p = vec2(aF0.x + sin(age * 7.0 + aF1.z * 40.0) * 7.0 * age, aF0.y - rise);
  float sz = aF1.y * (age < 0.25 ? mix(0.45, 1.0, age / 0.25) : mix(1.0, 0.3, (age - 0.25) / 0.75));
  float hb = kind > 0.5 && kind < 1.5 ? 0.9 : 1.0;
  gl_Position = toClip(p);
  // the sprite is 2 wide by 3.6 tall: the point is the tall side, the fragment squeezes x
  gl_PointSize = pointPx(sz * 3.6);
  vHeat = hb * pow(1.0 - age, 1.25) + 0.04;
  vAlpha = str * min(1.0, age / 0.08) * pow(1.0 - age, 0.7) * 0.85;
}
`;

/** Glow sprite coloured by heat, written for additive (ONE, ONE) blending. */
const SPRITE_FS = (squeeze: number) => `
precision mediump float;
varying float vHeat;
varying float vAlpha;
vec3 heatColor(float h) {
  float i = clamp(h, 0.0, 1.0) * 7.0;
  vec3 c0 = vec3(0.227, 0.035, 0.016);
  vec3 c1 = vec3(0.478, 0.078, 0.031);
  vec3 c2 = vec3(0.761, 0.227, 0.133);
  vec3 c3 = vec3(1.0, 0.353, 0.122);
  vec3 c4 = vec3(1.0, 0.541, 0.165);
  vec3 c5 = vec3(1.0, 0.71, 0.278);
  vec3 c6 = vec3(1.0, 0.851, 0.541);
  vec3 c7 = vec3(1.0, 0.957, 0.839);
  if (i < 1.0) return mix(c0, c1, i);
  if (i < 2.0) return mix(c1, c2, i - 1.0);
  if (i < 3.0) return mix(c2, c3, i - 2.0);
  if (i < 4.0) return mix(c3, c4, i - 3.0);
  if (i < 5.0) return mix(c4, c5, i - 4.0);
  if (i < 6.0) return mix(c5, c6, i - 5.0);
  return mix(c6, c7, i - 6.0);
}
void main() {
  if (vAlpha <= 0.004) discard;
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.x *= ${squeeze.toFixed(2)};
  float d = length(c);
  if (d >= 1.0) discard;
  float a = d < 0.18 ? 1.0 : (d < 0.5 ? mix(1.0, 0.333, (d - 0.18) / 0.32) : mix(0.333, 0.0, (d - 0.5) / 0.5));
  vec3 col = heatColor(vHeat);
  if (vHeat * 7.0 > 5.5) col = mix(vec3(1.0), col, smoothstep(0.0, 0.18, d));
  gl_FragColor = vec4(col * a * min(vAlpha, 1.0), 0.0);
}
`;

const QUAD_VS = `
precision highp float;
attribute vec2 aPos;
uniform vec4 uRect; // x, y, w, h in design units
varying vec2 vUV;
${COMMON}
void main() {
  vUV = aPos;
  gl_Position = toClip(uRect.xy + aPos * uRect.zw);
}
`;

const QUAD_FS = `
precision mediump float;
varying vec2 vUV;
uniform sampler2D uTex;
uniform int uMode;   // 0 image, 1 ignition glow, 2 solid, 3 tinted alpha mask
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  if (uMode == 0) {
    vec4 t = texture2D(uTex, vUV);
    gl_FragColor = vec4(t.rgb * t.a * uAlpha, t.a * uAlpha);
  } else if (uMode == 1) {
    // canvas radial gradient: r0 = 20, r1 = 170 inside a 360 square
    float r = length(vUV * 2.0 - 1.0) * 180.0;
    float f = clamp((r - 20.0) / 150.0, 0.0, 1.0);
    vec4 a = vec4(1.0, 0.431, 0.157, 0.0);
    vec4 b = vec4(1.0, 0.314, 0.118, 0.5 * uAlpha);
    vec4 c = vec4(0.471, 0.039, 0.0, 0.0);
    vec4 g = f < 0.55 ? mix(a, b, f / 0.55) : mix(b, c, (f - 0.55) / 0.45);
    gl_FragColor = vec4(g.rgb * g.a, 0.0);
  } else if (uMode == 2) {
    gl_FragColor = vec4(uColor * uAlpha, uAlpha);
  } else {
    float m = texture2D(uTex, vUV).a * uAlpha;
    gl_FragColor = vec4(uColor * m, m);
  }
}
`;

// ---------------------------------------------------------------- renderer

type GL = WebGLRenderingContext & { endFrameEXP?: () => void };
export type TextureSource = { localUri?: string | null; uri?: string; width?: number | null; height?: number | null };

function compile(gl: GL, type: number, src: string) {
  const s = gl.createShader(type);
  if (!s) throw new Error("createShader failed");
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s) ?? "compile failed"}`);
  return s;
}
function program(gl: GL, vs: string, fs: string) {
  const p = gl.createProgram();
  if (!p) throw new Error("createProgram failed");
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(p) ?? "failed"}`);
  return p;
}
function texture(gl: GL, src: TextureSource) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // expo-gl reads `localUri` from the object; on web it is an image element source
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src as unknown as TexImageSource);
  return t;
}

export type FireTextures = { icon: TextureSource; nameMask: TextureSource; nameGlow: TextureSource };

export class FireRenderer {
  private gl: GL;
  private ember: WebGLProgram;
  private flame: WebGLProgram;
  private quad: WebGLProgram;
  private emberBuf: WebGLBuffer | null;
  private flameBuf: WebGLBuffer | null;
  private quadBuf: WebGLBuffer | null;
  private tex: { icon: WebGLTexture | null; mask: WebGLTexture | null; glow: WebGLTexture | null } = { icon: null, mask: null, glow: null };
  private emberCount: number;
  private flameCount: number;
  private maxPoint: number;

  constructor(gl: GL, scene: FireScene) {
    this.gl = gl;
    this.ember = program(gl, EMBER_VS, SPRITE_FS(1));
    this.flame = program(gl, FLAME_VS, SPRITE_FS(1.8));
    this.quad = program(gl, QUAD_VS, QUAD_FS);
    this.emberBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.emberBuf);
    gl.bufferData(gl.ARRAY_BUFFER, scene.embers, gl.STATIC_DRAW);
    this.flameBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.flameBuf);
    gl.bufferData(gl.ARRAY_BUFFER, scene.flames, gl.STATIC_DRAW);
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    this.emberCount = scene.emberCount;
    this.flameCount = scene.flameCount;
    const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array | number[] | null;
    this.maxPoint = range && range[1] ? Number(range[1]) : 64;
  }

  setTextures(t: FireTextures) {
    const gl = this.gl;
    this.tex.icon = texture(gl, t.icon);
    this.tex.mask = texture(gl, t.nameMask);
    this.tex.glow = texture(gl, t.nameGlow);
  }

  private common(p: WebGLProgram, t: number, view: { w: number; h: number; dpr: number }, frame: { u: number; ox: number; oy: number }) {
    const gl = this.gl;
    gl.useProgram(p);
    gl.uniform1f(gl.getUniformLocation(p, "uT"), t);
    gl.uniform3f(gl.getUniformLocation(p, "uFrame"), frame.u, frame.ox, frame.oy);
    gl.uniform2f(gl.getUniformLocation(p, "uView"), view.w, view.h);
    gl.uniform1f(gl.getUniformLocation(p, "uDpr"), view.dpr);
    gl.uniform1f(gl.getUniformLocation(p, "uMaxPoint"), this.maxPoint);
  }

  private attrib(p: WebGLProgram, name: string, size: number, stride: number, offset: number) {
    const gl = this.gl;
    const loc = gl.getAttribLocation(p, name);
    if (loc < 0) return -1;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4);
    return loc;
  }

  private drawQuad(mode: number, rect: [number, number, number, number], alpha: number, color: [number, number, number], tex: WebGLTexture | null, additive: boolean) {
    const gl = this.gl;
    if (alpha <= 0.004) return;
    if (mode !== 1 && mode !== 2 && !tex) return;
    const p = this.quad;
    gl.uniform1i(gl.getUniformLocation(p, "uMode"), mode);
    gl.uniform4f(gl.getUniformLocation(p, "uRect"), rect[0], rect[1], rect[2], rect[3]);
    gl.uniform1f(gl.getUniformLocation(p, "uAlpha"), alpha);
    gl.uniform3f(gl.getUniformLocation(p, "uColor"), color[0], color[1], color[2]);
    if (tex) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(p, "uTex"), 0);
    }
    gl.blendFunc(gl.ONE, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Draw the frame for time t (ms). `view` is the layout size in dp plus pixel ratio. */
  render(t: number, view: { w: number; h: number; dpr: number }) {
    const gl = this.gl;
    const frame = introFrame(view.w, view.h);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // ---- quads: ignition glow, icon, name, bar
    this.common(this.quad, t, view, frame);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    const qLoc = this.attrib(this.quad, "aPos", 2, 2, 0);
    const ign = seg(t, 330, 700) * (1 - seg(t, 850, 1250));
    this.drawQuad(1, [CX - 180, CY - 180, 360, 360], ign, [0, 0, 0], null, true);
    const iconA = 1 - seg(t, 520, 860);
    const s = ICON * lerp(1, 1.08, outCubic(seg(t, 300, 860)));
    const iconRect: [number, number, number, number] = [CX - s / 2, CY - s / 2, s, s];
    this.drawQuad(0, iconRect, iconA, [1, 1, 1], this.tex.icon, true);
    // the leather heats up as it burns
    this.drawQuad(0, iconRect, iconA * seg(t, 380, 700) * 0.55, [1, 1, 1], this.tex.icon, true);

    const land = seg(t, 1560, 1760);
    const cool = seg(t, 1700, 2150);
    const box: [number, number, number, number] = [NAME_BOX.x, NAME_BOX.y, NAME_BOX.w, NAME_BOX.h];
    this.drawQuad(3, box, land * lerp(1.15, 0.6, cool), [1, lerp(90, 60, cool) / 255, 20 / 255], this.tex.glow, true);
    this.drawQuad(3, box, land, [1, lerp(120, 239, cool) / 255, lerp(40, 233, cool) / 255], this.tex.mask, false);
    const bk = outCubic(seg(t, 1780, 1940));
    this.drawQuad(2, [CX - (BAR.w / 2) * bk, BAR.y, BAR.w * bk, BAR.h], bk > 0 ? 1 : 0, [0.761, 0.227, 0.133], null, false);
    if (qLoc >= 0) gl.disableVertexAttribArray(qLoc);

    // ---- flames, then embers on top (additive)
    gl.blendFunc(gl.ONE, gl.ONE);
    const str = flameStrength(t);
    if (str[0] + str[1] + str[2] > 0.01) {
      this.common(this.flame, t, view, frame);
      gl.uniform3f(gl.getUniformLocation(this.flame, "uStr"), str[0], str[1], str[2]);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.flameBuf);
      const l0 = this.attrib(this.flame, "aF0", 4, 8, 0);
      const l1 = this.attrib(this.flame, "aF1", 4, 8, 4);
      gl.drawArrays(gl.POINTS, 0, this.flameCount);
      if (l0 >= 0) gl.disableVertexAttribArray(l0);
      if (l1 >= 0) gl.disableVertexAttribArray(l1);
    }

    if (t < 1830) {
      this.common(this.ember, t, view, frame);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.emberBuf);
      const a = this.attrib(this.ember, "aA", 4, 10, 0);
      const b = this.attrib(this.ember, "aB", 4, 10, 4);
      const c = this.attrib(this.ember, "aC", 2, 10, 8);
      const lag = gl.getUniformLocation(this.ember, "uLag");
      const trail = gl.getUniformLocation(this.ember, "uTrail");
      // fire tails while they fly: three older copies, smaller, cooler, fainter
      const fast = t >= BURST && t < 1460 + 380;
      for (let j = fast ? 3 : 0; j >= 0; j--) {
        gl.uniform1f(lag, 14 * j);
        gl.uniform3f(trail, 1 - j * 0.18, 1 - j * 0.2, 1 - j * 0.26);
        gl.drawArrays(gl.POINTS, 0, this.emberCount);
      }
      [a, b, c].forEach((l) => l >= 0 && gl.disableVertexAttribArray(l));
    }

    gl.flush();
    this.gl.endFrameEXP?.();
  }
}
