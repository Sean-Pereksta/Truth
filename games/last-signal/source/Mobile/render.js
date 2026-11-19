const TAU = Math.PI * 2;
const PROP_CELL = 26;
const PROP_RANGE = 160;
const clamp = (n, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const mix = (a, b, t) => a + (b - a) * t;
const solid = [1, 1, 1, 1];
const nativeGear = new Set(["arrows", "arrow", "spear", "hatchet", "knife", "bow", "sling"]);
const fieldGear = new Set(["sword", "shield", "crossbow", "bolt", "bolts"]);
const tallLandmarks = new Set(["cornucopia", "watchtower", "aqueduct", "signal_lodge", "sand_arch"]);
const trees = new Set(["tree", "oak", "pine", "birch", "pinon", "snow_fir"]);
const rocks = new Set(["rock", "boulder", "snow_boulder", "ice_teeth", "mesa_rock", "sand_hoodoo", "shore_rocks"]);
const costume = {
  player: [1, 1, 1, 1], hunter: [1, 0.91, 0.81, 1], runner: [0.85, 0.96, 1, 1],
  stalker: [0.76, 0.86, 0.79, 1], fighter: [1, 0.83, 0.74, 1],
};

const vertexSource = `#version 300 es
in vec3 vertex;
in vec3 normal;
in vec2 uv;
in vec3 color;
in mat4 model;
in vec4 tint;
uniform vec3 eye, rightSide, upSide, forwardSide;
uniform vec2 projection;
uniform bool viewModel;
out vec3 world, surfaceNormal, pigment;
out vec2 texcoord;
out vec4 shade;
out float depth;
void main() {
  vec3 p = (model * vec4(vertex, 1.0)).xyz;
  vec3 d = p - eye;
  vec3 n = mat3(model) * normal;
  vec3 view = viewModel ? p : vec3(dot(d, rightSide), dot(d, upSide), dot(d, forwardSide));
  float far = viewModel ? 14.0 : 420.0;
  float near = viewModel ? 0.026 : 0.06;
  gl_Position = vec4(view.xy * projection, view.z * (far + near) / (far - near) - 2.0 * far * near / (far - near), view.z);
  world = p;
  surfaceNormal = normalize(n);
  pigment = color;
  texcoord = uv;
  shade = tint;
  depth = view.z;
}`;

const fragmentSource = `#version 300 es
precision highp float;
in vec3 world, surfaceNormal, pigment;
in vec2 texcoord;
in vec4 shade;
in float depth;
uniform sampler2D paint, ground, soil, pavers;
uniform vec3 fog, sun, waterColor;
uniform vec2 fogRange;
uniform vec4 nearestFire;
uniform float light, clock;
uniform int material;
uniform bool viewModel;
out vec4 outColor;
float hash(vec2 v) { return fract(sin(dot(v, vec2(126.23, 71.71))) * 43758.55); }
void main() {
  vec3 n = normalize(surfaceNormal);
  float facing = max(0.0, dot(n, sun));
  vec3 lighting = mix(vec3(0.30, 0.39, 0.56), vec3(0.67, 0.69, 0.66), light)
    + facing * mix(vec3(0.17, 0.22, 0.35), vec3(0.47, 0.41, 0.29), light);
  vec3 fireDelta = nearestFire.xyz - world;
  float fireDistance = length(fireDelta);
  lighting += vec3(1.0, 0.48, 0.19) * nearestFire.w * max(0.0, 1.0 - fireDistance * 0.09)
    * (0.22 + 0.55 * max(0.0, dot(n, fireDelta / max(fireDistance, 0.01))));
  vec3 c = pigment * shade.rgb;
  float alpha = shade.a;
  if (material == 1) {
    vec2 g = world.xz;
    vec3 base = texture(ground, g / 4.6).rgb;
    vec3 trail = texture(soil, g / 3.6).rgb;
    vec3 plaza = texture(pavers, g / 4.0).rgb;
    float stone = 1.0 - smoothstep(21.4, 21.8, length(g));
    c = mix(pigment * mix(base, trail, texcoord.x), plaza * vec3(0.88, 0.86, 0.79), stone);
    c *= 0.93 + 0.10 * hash(floor(g * 10.0));
  } else if (material == 2) {
    c *= texture(paint, texcoord).rgb;
  } else if (material == 3) {
    float ripples = sin(world.x * 3.1 + world.z * 1.7 + clock * 2.6)
      + 0.48 * cos(world.x * 1.8 - world.z * 5.3 - clock * 1.9);
    float crests = smoothstep(0.8, 1.45, ripples);
    c = waterColor + vec3(0.22, 0.27, 0.25) * (crests * 0.45 + 0.10 * ripples);
    alpha *= mix(0.54, 0.83, texcoord.x);
  } else if (material == 4) {
    lighting = vec3(1.0);
  } else if (material == 5) {
    float folds = 0.63 + 0.37 * sin(world.x * 0.83 + world.z * 0.62 + world.y * 0.78 - clock * 2.2);
    c = pigment;
    alpha *= texcoord.x * folds;
    lighting = vec3(0.88, 0.91, 1.0);
  }
  float fogAmount = viewModel ? 0.0 : smoothstep(fogRange.x, fogRange.y, depth);
  outColor = vec4(mix(c * lighting, fog, fogAmount), alpha);
}`;

const skyVertex = `#version 300 es
out vec2 clip;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2) * 2.0 - 1.0;
  gl_Position = vec4(p, 0.999, 1.0);
  clip = p;
}`;

const skyFragment = `#version 300 es
precision highp float;
in vec2 clip;
uniform sampler2D sky;
uniform bool painted;
uniform vec3 rightSide, upSide, forwardSide, fog, sun, skyTint;
uniform vec2 projection;
uniform float light, rain;
out vec4 outColor;
void main() {
  vec3 ray = normalize(forwardSide + rightSide * clip.x / projection.x + upSide * clip.y / projection.y);
  float elevation = asin(ray.y);
  float azimuth = atan(ray.x, ray.z);
  float uvY = clamp(1.0 - (1.570796 - elevation) / 2.042035, 0.01, 0.99);
  vec2 uv = vec2(fract(azimuth / 6.283185), uvY);
  float horizon = smoothstep(-0.11, 0.42, ray.y);
  vec3 blue = mix(vec3(0.05, 0.09, 0.19), vec3(0.26, 0.48, 0.69) * skyTint, light);
  vec3 paintedSky = texture(sky, uv).rgb * mix(vec3(0.14, 0.22, 0.41), skyTint, light);
  vec3 c = mix(fog, painted ? paintedSky : blue, horizon);
  c = mix(c, fog, rain * 0.45);
  float orb = max(0.0, dot(ray, sun));
  c += mix(vec3(0.42, 0.54, 0.82), vec3(1.0, 0.72, 0.38), light)
    * (pow(orb, 30.0) * 0.21 + pow(orb, 3000.0) * 0.71) * (1.0 - rain * 0.8) * horizon;
  outColor = vec4(c, 1.0);
}`;

function program(gl, vertexSrc, fragmentSrc) {
  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const failure = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(failure || "Could not initialize arena graphics.");
    }
    return shader;
  }
  const vs = compile(gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragmentSrc);
  const result = gl.createProgram();
  gl.attachShader(result, vs);
  gl.attachShader(result, fs);
  gl.linkProgram(result);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
    const failure = gl.getProgramInfoLog(result);
    gl.deleteProgram(result);
    throw new Error(failure || "Could not link arena graphics.");
  }
  return result;
}

function uniforms(gl, shader, names) {
  return Object.fromEntries(names.split(" ").map(name => [name, gl.getUniformLocation(shader, name)]));
}

function pose(x = 0, y = 0, z = 0, yaw = 0, pitch = 0, sx = 1, sy = sx, sz = sx) {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  const a = Math.sin(pitch);
  const b = Math.cos(pitch);
  return [
    c * sx, 0, -s * sx, 0,
    s * a * sy, b * sy, c * a * sy, 0,
    s * b * sz, -a * sz, c * b * sz, 0,
    x, y, z, 1,
  ];
}

function multiply(a, b) {
  const joined = new Array(16);
  for (let column = 0; column < 16; column += 4) {
    for (let row = 0; row < 4; row++) {
      joined[column + row] = a[row] * b[column] + a[row + 4] * b[column + 1]
        + a[row + 8] * b[column + 2] + a[row + 12] * b[column + 3];
    }
  }
  return joined;
}

function readModels(bytes) {
  const data = new DataView(bytes);
  if (data.byteLength < 8 || data.getUint32(0, false) !== 0x4c534d31) {
    throw new Error("The host arena art has an unsupported format.");
  }
  const decode = new TextDecoder("utf-8", { fatal: true });
  let at = 4;
  function integer() {
    const value = data.getInt32(at, true);
    at += 4;
    return value;
  }
  function decimal() {
    const value = data.getFloat32(at, true);
    at += 4;
    return value;
  }
  function string() {
    let size = 0;
    for (let shift = 0; shift < 21; shift += 7) {
      const value = data.getUint8(at++);
      size += (value & 127) << shift;
      if (value < 128) {
        if (size > 512 || at + size > data.byteLength) break;
        const result = decode.decode(new Uint8Array(bytes, at, size));
        at += size;
        return result;
      }
    }
    throw new Error("Invalid arena model name.");
  }
  const count = integer();
  if (count < 1 || count > 1024) throw new Error("Invalid arena model count.");
  const models = new Map();
  for (let i = 0; i < count; i++) {
    const id = string();
    const size = integer();
    if (size < 1 || size > 1024) throw new Error("Invalid arena model rig.");
    const parts = [];
    for (let j = 0; j < size; j++) {
      const name = string();
      const parent = integer();
      const x = decimal();
      const y = decimal();
      const z = decimal();
      const vertices = integer();
      if (parent >= j || parent < -1 || vertices < 0 || vertices > 1000000 || at + vertices * 44 > data.byteLength) {
        throw new Error("Invalid arena model geometry.");
      }
      parts.push({ name, parent, x, y, z, bytes: new Uint8Array(bytes, at, vertices * 44) });
      at += vertices * 44;
    }
    models.set(id, { parts, flattened: null });
  }
  return models;
}

function appendVertex(vertices, p, n, tex = [0, 0], c = [1, 1, 1]) {
  vertices.push(p[0], p[1], p[2], n[0], n[1], n[2], tex[0], tex[1], c[0], c[1], c[2]);
}

function appendFace(vertices, points, n, tex, c) {
  for (const j of [0, 1, 2, 0, 2, 3]) appendVertex(vertices, points[j], n, tex, c);
}

function boxVertices() {
  const vertices = [];
  const a = -0.5;
  const b = 0.5;
  appendFace(vertices, [[a, 0, b], [b, 0, b], [b, 1, b], [a, 1, b]], [0, 0, 1]);
  appendFace(vertices, [[b, 0, a], [a, 0, a], [a, 1, a], [b, 1, a]], [0, 0, -1]);
  appendFace(vertices, [[b, 0, b], [b, 0, a], [b, 1, a], [b, 1, b]], [1, 0, 0]);
  appendFace(vertices, [[a, 0, a], [a, 0, b], [a, 1, b], [a, 1, a]], [-1, 0, 0]);
  appendFace(vertices, [[a, 1, b], [b, 1, b], [b, 1, a], [a, 1, a]], [0, 1, 0]);
  appendFace(vertices, [[a, 0, a], [b, 0, a], [b, 0, b], [a, 0, b]], [0, -1, 0]);
  return new Float32Array(vertices);
}

function transformedPoint(matrix, x, y, z, direction = 0) {
  return [matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12] * direction,
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13] * direction,
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14] * direction];
}

function fitBox(vertices, x, y, z, w, h, d, color, yaw = 0) {
  const shape = boxVertices();
  const matrix = pose(x, y - h / 2, z, yaw, 0, w, h, d);
  const rotation = pose(0, 0, 0, yaw);
  for (let i = 0; i < shape.length; i += 11) {
    appendVertex(vertices, transformedPoint(matrix, shape[i], shape[i + 1], shape[i + 2], 1),
      transformedPoint(rotation, shape[i + 3], shape[i + 4], shape[i + 5]), [0, 0], color);
  }
}

function bladeFace(vertices, a, b, c, color) {
  const u = b.map((n, i) => n - a[i]);
  const v = c.map((n, i) => n - a[i]);
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  for (const point of [a, b, c]) appendVertex(vertices, point, normal, [0, 0], color);
}

function swordVertices() {
  const vertices = [];
  fitBox(vertices, 0, -0.065, 0, 0.059, 0.19, 0.053, [0.27, 0.16, 0.10]);
  fitBox(vertices, 0, -0.17, 0, 0.086, 0.051, 0.075, [0.44, 0.42, 0.34]);
  fitBox(vertices, 0, 0.03, 0, 0.242, 0.041, 0.073, [0.55, 0.49, 0.36]);
  for (const face of [1, -1]) {
    const center = [0, 0.052, face * 0.015];
    const ridge = [0, 0.66, face * 0.013];
    const top = [0, 0.84, 0];
    for (const side of [-1, 1]) {
      const base = [side * 0.054, 0.052, 0];
      const edge = [side * 0.041, 0.66, 0];
      const tint = face * side > 0 ? [0.72, 0.77, 0.77] : [0.46, 0.51, 0.51];
      if (face * side > 0) {
        bladeFace(vertices, center, base, ridge, tint);
        bladeFace(vertices, base, edge, ridge, tint);
        bladeFace(vertices, ridge, edge, top, tint);
      } else {
        bladeFace(vertices, center, ridge, base, tint);
        bladeFace(vertices, base, ridge, edge, tint);
        bladeFace(vertices, ridge, top, edge, tint);
      }
    }
  }
  return new Float32Array(vertices);
}

function shieldVertices() {
  const vertices = [];
  const edges = 12;
  for (let i = 0; i < edges; i++) {
    const a = i * TAU / edges;
    const b = (i + 1) * TAU / edges;
    const rim = (angle, inset, z) => {
      const y = Math.cos(angle);
      return [Math.sin(angle) * (0.36 + 0.042 * y) * inset, y * 0.465 * inset, z];
    };
    bladeFace(vertices, [0, 0, 0.079], rim(b, 0.89, 0.053), rim(a, 0.89, 0.053),
      i % 2 ? [0.42, 0.28, 0.14] : [0.48, 0.32, 0.17]);
    bladeFace(vertices, [0, 0, -0.038], rim(a, 1, -0.04), rim(b, 1, -0.04), [0.35, 0.23, 0.13]);
    appendFace(vertices, [rim(b, 0.89, 0.053), rim(b, 1, 0.032), rim(a, 1, 0.032), rim(a, 0.89, 0.053)],
      [0, 0, 1], [0, 0], [0.43, 0.47, 0.47]);
    appendFace(vertices, [rim(a, 1, 0.032), rim(b, 1, 0.032), rim(b, 1, -0.04), rim(a, 1, -0.04)],
      [Math.sin((a + b) / 2), Math.cos((a + b) / 2), 0], [0, 0], [0.29, 0.32, 0.31]);
    bladeFace(vertices, [0, 0, 0.135], [Math.sin(b) * 0.115, Math.cos(b) * 0.115, 0.078],
      [Math.sin(a) * 0.115, Math.cos(a) * 0.115, 0.078], [0.58, 0.62, 0.59]);
  }
  for (const y of [-0.18, 0.16]) fitBox(vertices, 0, y, -0.062, 0.51, 0.058, 0.042, [0.25, 0.15, 0.08]);
  fitBox(vertices, -0.10, 0, -0.07, 0.082, 0.27, 0.074, [0.18, 0.14, 0.11]);
  return new Float32Array(vertices);
}

function crossbowVertices() {
  const vertices = [];
  const walnut = [0.39, 0.22, 0.12];
  const dark = [0.22, 0.23, 0.23];
  const steel = [0.46, 0.50, 0.49];
  fitBox(vertices, 0, -0.028, 0.105, 0.115, 0.079, 0.71, walnut);
  fitBox(vertices, 0, -0.093, -0.24, 0.11, 0.095, 0.42, walnut);
  fitBox(vertices, 0, -0.087, -0.445, 0.125, 0.118, 0.045, dark);
  fitBox(vertices, 0, 0.017, 0.132, 0.083, 0.021, 0.66, steel);
  fitBox(vertices, 0, -0.10, 0.045, 0.057, 0.13, 0.053, dark);
  for (const side of [-1, 1]) {
    fitBox(vertices, side * 0.11, -0.006, 0.318, 0.059, 0.033, 0.245, dark, side * 1.44);
    fitBox(vertices, side * 0.257, 0.001, 0.298, 0.048, 0.027, 0.116, steel, side * 2.03);
    fitBox(vertices, side * 0.332, 0.01, 0.269, 0.038, 0.038, 0.072, steel, side * 1.9);
    fitBox(vertices, side * 0.066, -0.012, 0.48, 0.026, 0.035, 0.13, dark);
  }
  fitBox(vertices, 0, -0.012, 0.55, 0.15, 0.034, 0.032, dark);
  return new Float32Array(vertices);
}

function boltVertices() {
  const vertices = [];
  const steel = [0.56, 0.60, 0.59];
  fitBox(vertices, 0, 0, -0.225, 0.014, 0.014, 0.39, [0.42, 0.30, 0.18]);
  fitBox(vertices, 0, 0, -0.38, 0.057, 0.003, 0.07, [0.31, 0.20, 0.19]);
  fitBox(vertices, 0, 0.015, -0.38, 0.003, 0.034, 0.07, [0.31, 0.20, 0.19]);
  const top = [0, 0.007, -0.045];
  const bottom = [0, -0.007, -0.045];
  const left = [-0.022, 0, -0.062];
  const right = [0.022, 0, -0.062];
  const tip = [0, 0, 0.014];
  bladeFace(vertices, top, left, tip, steel);
  bladeFace(vertices, top, tip, right, steel);
  bladeFace(vertices, bottom, tip, left, steel);
  bladeFace(vertices, bottom, right, tip, steel);
  return new Float32Array(vertices);
}

function smooth(t) {
  const amount = clamp(t);
  return amount * amount * (3 - 2 * amount);
}

function reloadMotion(progress) {
  return {
    lower: smooth(progress / 0.22) * (1 - smooth((progress - 0.79) / 0.21)),
    cock: smooth((progress - 0.22) / 0.32),
    seat: smooth((progress - 0.54) / 0.25)
  };
}

function coneVertices(sides, taper) {
  const vertices = [];
  for (let j = 0; j < sides; j++) {
    const a = j * TAU / sides;
    const b = (j + 1) * TAU / sides;
    const x = Math.sin(a) * 0.5;
    const z = Math.cos(a) * 0.5;
    const xx = Math.sin(b) * 0.5;
    const zz = Math.cos(b) * 0.5;
    const n = [x + xx, (1 - taper) * 0.28, z + zz];
    appendFace(vertices, [[x, 0, z], [xx, 0, zz], [xx * taper, 1, zz * taper], [x * taper, 1, z * taper]], n);
    for (const p of [[0, 1, 0], [x * taper, 1, z * taper], [xx * taper, 1, zz * taper]]) {
      appendVertex(vertices, p, [0, 1, 0]);
    }
  }
  return new Float32Array(vertices);
}

function terrainTint(arena, x, z, height) {
  const zone = Math.abs(x) > Math.abs(z) ? x < 0 ? 1 : 2 : z < 0 ? 3 : 4;
  const b = 0.93 + 0.043 * Math.sin(x * 0.47 + z * 0.19) + 0.045 * Math.cos(z * 0.24 - x * 0.15);
  if (arena === 1) return [b, b * (zone === 3 ? 0.83 : 0.91), b * 0.80];
  if (arena === 2) return [b * (1 - 0.23 * clamp((height - 13) / 13)), b * 0.96, b];
  return [
    [0.62 * b, 0.77 * b, 0.57 * b], [0.63 * b, 0.82 * b, 0.68 * b],
    [0.95 * b, 0.91 * b, 0.78 * b], [0.82 * b, 0.88 * b, 0.66 * b],
  ][zone - 1];
}

function buildTerrain(info, arena) {
  const { originX, originZ, size, step, heights, paths } = info;
  const vertices = new Float32Array((size - 1) ** 2 * 66);
  const grid = new Array(size ** 2);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const index = j * size + i;
      const x = originX + i * step;
      const z = originZ + j * step;
      const y = heights[index];
      const xn = heights[j * size + Math.max(0, i - 1)] - heights[j * size + Math.min(size - 1, i + 1)];
      const zn = heights[Math.max(0, j - 1) * size + i] - heights[Math.min(size - 1, j + 1) * size + i];
      const color = terrainTint(arena, x, z, y);
      grid[index] = [x, y, z, xn, step * 2, zn, paths?.[index] ?? 0, 0, ...color];
    }
  }
  let index = 0;
  for (let j = 0; j < size - 1; j++) {
    for (let i = 0; i < size - 1; i++) {
      const top = j * size + i;
      for (const corner of [top, top + size, top + size + 1, top, top + size + 1, top + 1]) {
        vertices.set(grid[corner], index);
        index += 11;
      }
    }
  }
  return vertices;
}

function buildWater(info, levels) {
  if (!levels) return null;
  const { originX, originZ, size, step, heights } = info;
  const vertices = [];
  for (let j = 0; j < size - 1; j++) {
    for (let i = 0; i < size - 1; i++) {
      const top = j * size + i;
      const ids = [top, top + size, top + size + 1, top + 1];
      const wet = ids.filter(k => levels[k] != null && levels[k] > heights[k] + 0.005);
      if (!wet.length) continue;
      const mean = wet.reduce((sum, k) => sum + levels[k], 0) / wet.length;
      for (const corner of [0, 1, 2, 0, 2, 3]) {
        const k = ids[corner];
        const x = originX + (k % size) * step;
        const z = originZ + Math.floor(k / size) * step;
        const level = levels[k] ?? mean;
        appendVertex(vertices, [x, level + 0.014, z], [0, 1, 0], [clamp((level - heights[k]) / 1.3), 0]);
      }
    }
  }
  return new Float32Array(vertices);
}

function skyConditions(frame, arena, camera) {
  const day = clamp(frame.daylight ?? 1);
  const storm = frame.storm;
  const outside = storm?.active ? clamp((Math.hypot(camera.x - storm.x, camera.z - storm.z) - storm.radius) / 13) : 0;
  const rain = frame.rain ? 1 : 0;
  const tint = arena === 1 ? [1.02, 0.93, 0.84] : arena === 2 ? [0.89, 0.97, 1.05] : [0.98, 1, 0.98];
  const daylightFog = [0.55, 0.63, 0.61].map((value, i) => value * tint[i]);
  const nightFog = [0.10, 0.14, 0.23];
  const stormFog = [0.27, 0.20, 0.39];
  const fog = daylightFog.map((value, i) => mix(mix(nightFog[i], value, day), stormFog[i], outside * 0.72) * (1 - rain * 0.13));
  const phase = (frame.time ?? frame.clock ?? 0) % 720;
  const angle = phase / 720 * TAU + 1.36 + (day < 0.22 ? Math.PI : 0);
  const arc = (phase + 55) % 720;
  const elevation = arc < 460 ? -0.02 + 0.98 * Math.sin(Math.PI * arc / 460) : -0.02 - 0.64 * Math.sin(Math.PI * (arc - 460) / 260);
  const sunY = clamp(day < 0.22 ? 0.065 - elevation : elevation, 0.16, 0.98);
  const sunScale = Math.sqrt(1 - sunY * sunY);
  const sun = [Math.sin(angle) * sunScale, sunY, Math.cos(angle) * sunScale];
  const wet = [[0.24, 0.48, 0.48], [0.20, 0.67, 0.54], [0.42, 0.66, 0.75]][arena] ?? [0.24, 0.48, 0.48];
  return { day, rain, tint, fog, sun, wet, range: [mix(mix(37, 75, day), 9, outside) - rain * 12,
    mix(mix(163, 270, day), 66, outside) - rain * 23] };
}

export class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      alpha: false, depth: true, antialias: false, powerPreference: "high-performance",
    });
    if (!this.gl) throw new Error("This browser needs WebGL 2 enabled to play Last Signal.");
    this.world = null;
    this.frame = null;
    this.look = null;
    this.props = [];
    this.propGrid = new Map();
    this.propChanges = new Map();
    this.models = new Map();
    this.meshes = new Set();
    this.res = 1;
    this.lastDraw = 0;
    this.avgDraw = 16;
    this.lost = event => {
      event.preventDefault();
      this.assets?.abort();
      this.contextLost = true;
    };
    this.restored = () => {
      this.contextLost = false;
      this.meshes.clear();
      this.init();
      if (this.world) this.uploadTerrain();
    };
    canvas.addEventListener("webglcontextlost", this.lost);
    canvas.addEventListener("webglcontextrestored", this.restored);
    try {
      this.init();
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  init() {
    const gl = this.gl;
    this.assets = new AbortController();
    this.scene = program(gl, vertexSource, fragmentSource);
    this.backdrop = program(gl, skyVertex, skyFragment);
    this.sceneU = uniforms(gl, this.scene, "eye rightSide upSide forwardSide projection viewModel paint ground soil pavers fog sun waterColor fogRange nearestFire light clock material");
    this.skyU = uniforms(gl, this.backdrop, "sky painted rightSide upSide forwardSide fog sun skyTint projection light rain");
    this.attrib = uniformsForAttributes(gl, this.scene);
    this.instanceBuffer = gl.createBuffer();
    this.blankVAO = gl.createVertexArray();
    this.models.clear();
    this.terrainMesh = this.waterMesh = this.floodMesh = null;
    this.stormMeshes = [null, null];
    this.stormKeys = ["", ""];
    this.box = this.makeMesh(boxVertices());
    this.trunk = this.makeMesh(coneVertices(7, 0.66));
    this.canopy = this.makeMesh(coneVertices(8, 0.04));
    this.rock = this.makeMesh(coneVertices(6, 0.47));
    this.flame = this.makeMesh(coneVertices(6, 0));
    this.sword = this.makeMesh(swordVertices());
    this.shield = this.makeMesh(shieldVertices());
    this.crossbow = this.makeMesh(crossbowVertices());
    this.bolt = this.makeMesh(boltVertices());
    this.textures = new Map();
    this.painted = false;
    this.modelRequest = false;
    this.sharedTextureRequest = false;
    this.createTexture("paint", 0, [255, 255, 255]);
    this.createTexture("ground", 1, [130, 126, 112]);
    this.createTexture("soil", 2, [118, 101, 78]);
    this.createTexture("pavers", 3, [123, 121, 112]);
    this.createTexture("sky", 4, [102, 144, 174]);
    if (this.world) this.requestAssets(this.world.arena);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.13, 0.18, 0.16, 1);
  }

  async requestAssets(arena) {
    const signal = this.assets.signal;
    const load = async (name, names, arenaAsset = false) => {
      for (const path of names) {
        const url = new URL("./assets/" + path, import.meta.url);
        try {
          const response = await fetch(url, { signal });
          if (!response.ok) continue;
          const blob = await response.blob();
          const image = await imageFromBlob(blob);
          if (!signal.aborted && (!arenaAsset || (this.world?.arena ?? 0) === arena)) {
            this.updateTexture(name, image);
            return;
          }
        } catch {
          if (signal.aborted) return;
        }
      }
    };
    const loadModels = async () => {
      try {
        const response = await fetch(new URL("./assets/models.bin", import.meta.url), { signal });
        if (!response.ok) return;
        const bytes = await response.arrayBuffer();
        if (!signal.aborted) this.models = readModels(bytes);
      } catch {
        // The arena can still render with its compact scene meshes while art is unavailable.
      }
    };
    if (!this.modelRequest) {
      this.modelRequest = true;
      void loadModels();
    }
    const prefix = arena === 1 ? "gorge_" : arena === 2 ? "frost_" : "";
    await load("ground", prefix ? [prefix + "floor.png", "ground.png"] : ["ground.png"], true);
    if (signal.aborted || this.world?.arena !== arena) return;
    await load("soil", prefix ? [prefix + "path.png", "soil.png"] : ["soil.png"], true);
    if (!this.sharedTextureRequest && !signal.aborted) {
      this.sharedTextureRequest = true;
      await load("paint", ["modelpaint.png", "paint.png"]);
      await load("pavers", ["pavers.png"]);
      await load("sky", ["sky.png"]);
    }
  }

  createTexture(name, unit, color) {
    const gl = this.gl;
    const texture = gl.createTexture();
    this.textures.set(name, { texture, unit });
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([...color, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (name === "sky") gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  updateTexture(name, image) {
    const gl = this.gl;
    const { texture, unit } = this.textures.get(name);
    const limit = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 2048);
    const size = Math.max(image.width, image.height);
    let source = image;
    if (size > limit) {
      source = document.createElement("canvas");
      source.width = Math.max(1, Math.round(image.width * limit / size));
      source.height = Math.max(1, Math.round(image.height * limit / size));
      source.getContext("2d").drawImage(image, 0, 0, source.width, source.height);
    }
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (name === "sky") this.painted = true;
  }

  makeMesh(vertices, material = 0, dynamic = false) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    const buffer = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    const entries = [["vertex", 3, 0], ["normal", 3, 12], ["uv", 2, 24], ["color", 3, 32]];
    for (const [name, size, offset] of entries) {
      const attribute = this.attrib[name];
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 44, offset);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    for (let j = 0; j < 5; j++) {
      const attribute = j === 4 ? this.attrib.tint : this.attrib.model + j;
      gl.enableVertexAttribArray(attribute);
      gl.vertexAttribPointer(attribute, 4, gl.FLOAT, false, 80, j * 16);
      gl.vertexAttribDivisor(attribute, 1);
    }
    gl.bindVertexArray(null);
    const mesh = { vao, buffer, count: vertices.byteLength / 44, material };
    this.meshes.add(mesh);
    return mesh;
  }

  releaseMesh(mesh) {
    if (!mesh || this.contextLost) return;
    this.gl.deleteVertexArray(mesh.vao);
    this.gl.deleteBuffer(mesh.buffer);
    this.meshes.delete(mesh);
  }

  flatModel(id) {
    const model = this.models.get(id);
    if (!model) return null;
    if (model.flattened) return model.flattened;
    const parts = model.parts;
    const root = parts[0];
    if (parts.length === 1 && !root.x && !root.y && !root.z) {
      model.flattened = this.makeMesh(root.bytes, 2);
      return model.flattened;
    }
    const offsets = [];
    const total = parts.reduce((sum, p) => sum + p.bytes.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      const base = offsets[part.parent] ?? [0, 0, 0];
      const shift = [base[0] + part.x, base[1] + part.y, base[2] + part.z];
      offsets.push(shift);
      merged.set(part.bytes, offset);
      if (shift.some(Boolean)) {
        const data = new DataView(merged.buffer, offset, part.bytes.byteLength);
        for (let vertex = 0; vertex < data.byteLength; vertex += 44) {
          for (let axis = 0; axis < 3; axis++) {
            const cursor = vertex + axis * 4;
            data.setFloat32(cursor, data.getFloat32(cursor, true) + shift[axis], true);
          }
        }
      }
      offset += part.bytes.byteLength;
    }
    model.flattened = this.makeMesh(merged, 2);
    return model.flattened;
  }

  rig(batch, id, start, color, move) {
    const model = this.models.get(id);
    if (!model) return false;
    const joints = [];
    for (const part of model.parts) {
      const root = joints[part.parent] ?? start;
      const local = move(part);
      const matrix = multiply(root, local ?? pose(part.x, part.y, part.z));
      joints.push(matrix);
      if (!part.bytes.length) continue;
      part.mesh ||= this.makeMesh(part.bytes, 2);
      this.queue(batch, part.mesh, matrix, color);
    }
    return true;
  }

  queue(batch, mesh, matrix, color = solid) {
    if (!mesh || !mesh.count) return;
    let instances = batch.get(mesh);
    if (!instances) {
      instances = [];
      batch.set(mesh, instances);
    }
    instances.push(...matrix, ...color);
  }

  draw(mesh, instances, material = mesh.material) {
    const gl = this.gl;
    gl.uniform1i(this.sceneU.material, material);
    gl.bindVertexArray(mesh.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(instances), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, mesh.count, instances.length / 20);
  }

  drawBatch(batch, material) {
    for (const [mesh, instances] of batch) this.draw(mesh, instances, material);
  }

  setWorld(world) {
    const info = world?.terrain;
    const size = info?.size;
    if (!Number.isInteger(size) || size < 2 || size > 256 || info.heights?.length !== size * size
      || !Number.isFinite(info.originX) || !Number.isFinite(info.originZ) || !(info.step > 0)) {
      throw new Error("The host sent an unsupported arena map.");
    }
    const previousArena = this.world?.arena;
    this.world = world;
    this.props = [];
    this.propGrid.clear();
    this.propChanges.clear();
    for (const [id, row] of (world.props ?? []).entries()) {
      if (!row) continue;
      const key = propCell(Math.floor(row[1] / PROP_CELL), Math.floor(row[3] / PROP_CELL));
      if (!this.propGrid.has(key)) this.propGrid.set(key, []);
      this.propGrid.get(key).push([id, row]);
    }
    this.frame = null;
    this.lastCamera = null;
    if (!this.contextLost) {
      if (world.arena !== previousArena) this.requestAssets(world.arena);
      this.uploadTerrain();
    }
  }

  uploadTerrain() {
    this.releaseMesh(this.terrainMesh);
    this.releaseMesh(this.waterMesh);
    this.releaseMesh(this.floodMesh);
    const info = this.world.terrain;
    this.terrainMesh = this.makeMesh(buildTerrain(info, this.world.arena), 1);
    const water = buildWater(info, info.waters);
    const flood = buildWater(info, info.floodWaters);
    this.waterMesh = water?.length ? this.makeMesh(water, 3) : null;
    this.floodMesh = flood?.length ? this.makeMesh(flood, 3) : null;
    for (const mesh of this.stormMeshes) this.releaseMesh(mesh);
    this.stormMeshes = [null, null];
    this.stormKeys = ["", ""];
  }

  setFrame(frame) {
    if (frame?.round !== this.world?.round || !frame?.camera) return;
    if (frame.props) this.props = frame.props;
    this.propChanges = new Map(frame.propChanges ?? []);
    this.lastCamera = this.frame?.mode === frame.mode ? this.currentCamera ?? this.frame?.camera : null;
    this.frame = frame;
    this.frameAt = performance.now();
  }

  setLook(yaw, pitch) {
    this.look = { yaw, pitch };
  }

  clearLook() {
    this.look = null;
  }

  *propsNear(camera) {
    if (!this.propGrid.size && !this.propChanges.size) {
      yield* this.props;
      return;
    }
    const lowX = Math.floor((camera.x - PROP_RANGE) / PROP_CELL);
    const highX = Math.floor((camera.x + PROP_RANGE) / PROP_CELL);
    const lowZ = Math.floor((camera.z - PROP_RANGE) / PROP_CELL);
    const highZ = Math.floor((camera.z + PROP_RANGE) / PROP_CELL);
    for (let z = lowZ; z <= highZ; z++) {
      for (let x = lowX; x <= highX; x++) {
        for (const [id, row] of this.propGrid.get(propCell(x, z)) ?? []) {
          if (!this.propChanges.has(id)) yield row;
        }
      }
    }
    for (const row of this.propChanges.values()) if (row) yield row;
  }

  resize(now) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return false;
    if (this.lastDraw && now - this.lastDraw < 160) {
      this.avgDraw = mix(this.avgDraw, now - this.lastDraw, 0.05);
      if (this.avgDraw > 31) this.res = Math.max(0.72, this.res - 0.003);
      if (this.avgDraw < 19) this.res = Math.min(1, this.res + 0.001);
    }
    this.lastDraw = now;
    const density = Math.min(1.65, window.devicePixelRatio || 1, 1620 / Math.max(width, height));
    const realWidth = Math.max(2, Math.round(width * density * this.res / 8) * 8);
    const realHeight = Math.max(2, Math.round(height * density * this.res / 8) * 8);
    if (this.canvas.width !== realWidth) this.canvas.width = realWidth;
    if (this.canvas.height !== realHeight) this.canvas.height = realHeight;
    this.gl.viewport(0, 0, realWidth, realHeight);
    return true;
  }

  cameraAt(now) {
    const incoming = this.frame.camera;
    const previous = this.lastCamera;
    const distance = previous ? Math.hypot(previous.x - incoming.x, previous.y - incoming.y, previous.z - incoming.z) : Infinity;
    const alpha = distance < 9 ? clamp((now - this.frameAt) / 86) : 1;
    const control = this.frame.mode == null || this.frame.mode === "match" ? this.look : null;
    const camera = {
      x: previous ? mix(previous.x, incoming.x, alpha) : incoming.x,
      y: previous ? mix(previous.y, incoming.y, alpha) : incoming.y,
      z: previous ? mix(previous.z, incoming.z, alpha) : incoming.z,
      yaw: control?.yaw ?? incoming.yaw, pitch: control?.pitch ?? incoming.pitch,
    };
    this.currentCamera = camera;
    const yawSin = Math.sin(camera.yaw);
    const yawCos = Math.cos(camera.yaw);
    const pitchSin = Math.sin(camera.pitch);
    const pitchCos = Math.cos(camera.pitch);
    camera.forward = [yawSin * pitchCos, pitchSin, yawCos * pitchCos];
    camera.right = [yawCos, 0, -yawSin];
    camera.up = [-yawSin * pitchSin, pitchCos, -yawCos * pitchSin];
    camera.yawSin = yawSin;
    camera.yawCos = yawCos;
    return camera;
  }

  visible(camera, x, z, distance, aspect, allowance) {
    const dx = x - camera.x;
    const dz = z - camera.z;
    const ahead = dx * camera.yawSin + dz * camera.yawCos;
    return dx * dx + dz * dz < distance * distance && ahead > -allowance
      && Math.abs(dx * camera.yawCos - dz * camera.yawSin) < Math.max(0, ahead) * aspect + allowance * 2 + 2;
  }

  shadeScene(camera, conditions, projection, clock, fire) {
    const gl = this.gl;
    const u = this.sceneU;
    gl.useProgram(this.scene);
    gl.uniform3f(u.eye, camera.x, camera.y, camera.z);
    gl.uniform3fv(u.rightSide, camera.right);
    gl.uniform3fv(u.upSide, camera.up);
    gl.uniform3fv(u.forwardSide, camera.forward);
    gl.uniform2fv(u.projection, projection);
    gl.uniform1i(u.viewModel, 0);
    gl.uniform1i(u.paint, 0);
    gl.uniform1i(u.ground, 1);
    gl.uniform1i(u.soil, 2);
    gl.uniform1i(u.pavers, 3);
    gl.uniform3fv(u.fog, conditions.fog);
    gl.uniform3fv(u.sun, conditions.sun);
    gl.uniform3fv(u.waterColor, conditions.wet);
    gl.uniform2fv(u.fogRange, conditions.range);
    gl.uniform4fv(u.nearestFire, fire);
    gl.uniform1f(u.light, conditions.day);
    gl.uniform1f(u.clock, clock);
  }

  drawSky(camera, conditions, projection) {
    const gl = this.gl;
    const u = this.skyU;
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.backdrop);
    gl.bindVertexArray(this.blankVAO);
    gl.uniform1i(u.sky, 4);
    gl.uniform1i(u.painted, this.painted);
    gl.uniform3fv(u.rightSide, camera.right);
    gl.uniform3fv(u.upSide, camera.up);
    gl.uniform3fv(u.forwardSide, camera.forward);
    gl.uniform2fv(u.projection, projection);
    gl.uniform3fv(u.fog, conditions.fog);
    gl.uniform3fv(u.sun, conditions.sun);
    gl.uniform3fv(u.skyTint, conditions.tint);
    gl.uniform1f(u.light, conditions.day);
    gl.uniform1f(u.rain, conditions.rain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
  }

  groundHeight(x, z) {
    const { originX, originZ, step, size, heights } = this.world.terrain;
    const ix = clamp((x - originX) / step, 0, size - 1.001);
    const iz = clamp((z - originZ) / step, 0, size - 1.001);
    const a = Math.floor(ix);
    const b = Math.floor(iz);
    const i = b * size + a;
    return mix(mix(heights[i], heights[i + 1], ix - a), mix(heights[i + size], heights[i + size + 1], ix - a), iz - b);
  }

  stormMesh(index, x, z, radius) {
    const key = [x, z, radius].map(n => Math.round(n * 3)).join();
    if (this.stormKeys[index] === key) return this.stormMeshes[index];
    this.releaseMesh(this.stormMeshes[index]);
    this.stormKeys[index] = key;
    const vertices = [];
    const heights = index ? [0.03, 0.21, 1.49] : [0.04, 0.44, 5.8, 21, 37];
    const opacity = index ? [0.02, 0.39, 0] : [0.18, 0.57, 0.26, 0.14, 0];
    const shells = [0.03, 0.13, 0.6, 1.78, 4];
    const colors = [[0.35, 0.38, 0.62], [0.68, 0.75, 1], [0.40, 0.45, 0.72], [0.36, 0.39, 0.64], [0.43, 0.46, 0.67]];
    const segments = 96;
    for (let j = 0; j < segments; j++) {
      const a = j * TAU / segments;
      const b = (j + 1) * TAU / segments;
      for (let row = 0; row < heights.length - 1; row++) {
        for (const [angle, i] of [[a, row], [b, row], [b, row + 1], [a, row], [b, row + 1], [a, row + 1]]) {
          const rim = radius + shells[i];
          const xx = x + rim * Math.sin(angle);
          const zz = z + rim * Math.cos(angle);
          const h = this.groundHeight(xx, zz) + heights[i];
          appendVertex(vertices, [xx, h, zz], [0, 1, 0], [opacity[i], 0], colors[i]);
        }
      }
    }
    const mesh = this.makeMesh(new Float32Array(vertices), 5, true);
    this.stormMeshes[index] = mesh;
    return mesh;
  }

  prop(batch, p, elapsed, lowDetail = false, highlight = null) {
    const [id, x, y, z, size, yaw, w, h, d, kind, lit, felledAge, fallYaw, open, damagedMesh] = p;
    const oldTree = felledAge != null && felledAge >= 0;
    let matrix = pose(x, y, z, yaw, 0, size);
    if (oldTree) {
      const age = felledAge + elapsed;
      if (age > 1.65) return;
      const tilt = Math.PI * 0.4833 * clamp(age / 1.18) ** 2;
      const root = pose(x, y - Math.max(0, age - 1.24) * 2.3, z, fallYaw, tilt);
      matrix = multiply(root, pose(0, 0, 0, yaw - fallYaw, 0, size));
    } else if (kind === "pickup" && fieldGear.has(id)) {
      if (id === "crossbow") {
        this.drawCrossbow(batch, pose(x, y + 0.11, z, yaw, 0, size), 0, false);
      } else if (id === "sword") {
        this.queue(batch, this.sword, pose(x, y + 0.15, z, yaw, 1.50, size));
      } else if (id === "shield") {
        this.queue(batch, this.shield, pose(x, y + 0.15, z, yaw, -1.35, size));
      } else {
        const count = id === "bolts" ? 3 : 1;
        for (let i = 0; i < count; i++) {
          this.queue(batch, this.bolt, pose(x + i * 0.045, y + 0.15 + i * 0.015, z, yaw + i * 0.075, 0, size));
        }
      }
      return;
    } else if (kind === "pickup" && nativeGear.has(id)) {
      matrix = pose(x, y + (id === "spear" ? 0.074 : 0.13), z, yaw, 1.50, size);
    }

    const model = damagedMesh || id;
    if (open && id === "gate" && this.rig(batch, model, matrix, highlight ?? solid,
      part => part.name === "leaf" ? pose(part.x, part.y, part.z, Math.PI / 2) : null)) return;
    const mesh = lowDetail ? null : this.flatModel(model) ?? this.flatModel(id);
    if (mesh) {
      this.queue(batch, mesh, matrix, highlight ?? solid);
      return;
    }

    const add = (mesh, ox, oy, oz, width, height, depth, color, angle = 0) => {
      const local = pose(ox / size, oy / size, oz / size, angle, 0, width / size, height / size, depth / size);
      this.queue(batch, mesh, multiply(matrix, local), highlight ?? color);
    };
    if (trees.has(id)) {
      const winter = id === "snow_fir";
      const conifer = ["pine", "pinon", "snow_fir"].includes(id);
      const bark = id === "birch" ? [0.64, 0.58, 0.48, 1] : [0.24, 0.16, 0.10, 1];
      const leaf = winter ? [0.48, 0.60, 0.55, 1] : [0.21, 0.35, 0.21, 1];
      const spread = h * (conifer ? 0.51 : 0.77);
      add(this.trunk, 0, 0, 0, w, h * 0.83, d, bark);
      add(this.canopy, 0, h * 0.38, 0, spread, h * 0.48, spread * 0.83, leaf);
      add(this.canopy, 0, h * 0.64, 0, spread * 0.77, h * 0.42, spread * 0.69, leaf);
    } else if (rocks.has(id)) {
      const color = this.world.arena === 1 ? [0.53, 0.35, 0.24, 1] : this.world.arena === 2 ? [0.60, 0.69, 0.73, 1] : [0.35, 0.39, 0.35, 1];
      add(this.rock, 0, 0, 0, w, h, d, color);
    } else if (kind === "vegetation") {
      add(this.canopy, 0, 0, 0, w, h, d, [0.27, 0.38, 0.18, 1]);
    } else if (id === "cornucopia") {
      const bronze = [0.63, 0.42, 0.19, 1];
      for (let j = 0; j < 11; j++) {
        const a = (j - 5) * Math.PI / 11;
        const taper = 0.48 + 0.52 * Math.cos(a);
        add(this.box, -w * 0.47 * Math.sin(a), h * 0.78 * Math.cos(a) - 0.06,
          -d * 0.26, w * 0.15, h * 0.18, d * taper, bronze);
      }
    } else if (id === "gate" && open) {
      add(this.box, -w * 0.42, 0, 0, w * 0.10, h, d, [0.39, 0.26, 0.14, 1]);
      add(this.box, w * 0.42, 0, 0, w * 0.10, h, d, [0.39, 0.26, 0.14, 1]);
    } else if (kind === "structure" && id === "wall") {
      for (let i = 0; i < 6; i++) {
        add(this.trunk, ((i + 0.5) / 6 - 0.5) * w, 0, 0, w * 0.18, h * (0.94 + (i % 2) * 0.06), d, [0.43, 0.30, 0.18, 1]);
      }
    } else {
      const color = kind === "pickup" ? [0.75, 0.60, 0.35, 1]
        : lit ? [0.44, 0.31, 0.20, 1] : id === "platform" ? [0.48, 0.43, 0.31, 1] : [0.44, 0.38, 0.28, 1];
      add(this.box, 0, 0, 0, w, h, d, color);
    }
  }

  actor(batch, a, clock, nearby) {
    const [x, y, z, yaw, alive, crouch, style, , fallYaw, anim, speed, weapon, shield, guard, guardBlend, reload, loaded, striking] = a;
    const tint = costume[style] ?? solid;
    const gait = alive ? Math.sin(anim ?? clock * 5) * clamp((speed ?? 0) * 0.25) : 0;
    const matrix = alive ? pose(x, y - (crouch ? 0.20 : 0), z, yaw, 0, 1, crouch ? 0.86 : 1, 1)
      : pose(x, y + 0.18, z, fallYaw ?? yaw, -Math.PI / 2);
    if (alive && nearby) {
      const advance = shield ? clamp(Math.max(guard ? 0.85 : 0, guardBlend || 0)) : 0;
      if (shield) this.queue(batch, this.shield, multiply(matrix,
        pose(-0.30 + advance * 0.09, 0.77 + advance * 0.42, 0.14 + advance * 0.42, -0.58 * (1 - advance), 0.05, 0.98)));
      if (weapon === "sword") {
        const swing = Math.sin(clamp((striking || 0) / 0.36) * Math.PI);
        this.queue(batch, this.sword, multiply(matrix, pose(0.31 - 0.28 * swing, 0.85 + swing * 0.28, 0.23,
          0.28 - swing * 0.81, 0.43 + swing * 0.76)));
      } else if (weapon === "crossbow") {
        const movement = reloadMotion(reload || 0);
        this.drawCrossbow(batch, multiply(matrix, pose(0.21, 1.0 - movement.lower * 0.27, 0.27,
          0.3 * movement.lower, 0.2 + movement.lower * 0.45)), reload || 0, loaded);
      }
    }
    if (nearby && this.rig(batch, "contestant", matrix, tint, part => {
      if (!alive) return null;
      if (part.name === "upperarmL" && (shield || weapon === "crossbow")) {
        return pose(part.x, part.y, part.z, 0, guard || weapon === "crossbow" ? 0.82 : 0.26);
      }
      if (part.name === "upperarmR" && weapon === "crossbow") return pose(part.x, part.y, part.z, 0, 0.87);
      const move = part.name === "thighL" || part.name === "upperarmR" ? 0.4 * gait
        : part.name === "thighR" || part.name === "upperarmL" ? -0.4 * gait
        : crouch && part.name === "torso" ? 0.24 : 0;
      return move ? pose(part.x, part.y, part.z, 0, move) : null;
    })) return;
    const mesh = this.flatModel("contestant");
    if (mesh) {
      this.queue(batch, mesh, matrix, tint);
      return;
    }
    const add = (mesh, x2, y2, z2, w, h, d, c, pitch = 0) => {
      this.queue(batch, mesh, multiply(matrix, pose(x2, y2, z2, 0, pitch, w, h, d)), c);
    };
    const cloth = [0.27 * tint[0], 0.34 * tint[1], 0.31 * tint[2], 1];
    add(this.box, 0, 0.80, 0, 0.46, 0.51, 0.27, cloth);
    add(this.rock, 0, 1.28, 0, 0.28, 0.29, 0.25, [0.55, 0.39, 0.29, 1]);
    for (const side of [-1, 1]) {
      add(this.box, side * 0.34, 0.76, 0, 0.15, 0.51, 0.16, cloth, gait * side * 0.34);
      add(this.box, side * 0.14, 0.03, 0, 0.19, 0.77, 0.21, [0.28, 0.25, 0.20, 1], -gait * side * 0.34);
    }
  }

  animal(batch, a, clock, nearby) {
    const [id, x, y, z, yaw, alive, anim] = a;
    const matrix = pose(x, y, z, yaw, alive ? 0 : -1.53);
    if (nearby && alive && this.rig(batch, id, matrix, solid, part => {
      if (!/leg|paw|wing/i.test(part.name)) return null;
      const phase = /r$/i.test(part.name) ? Math.PI : 0;
      return pose(part.x, part.y, part.z, 0, 0.28 * Math.sin((anim ?? clock * 2) + phase));
    })) return;
    const mesh = this.flatModel(id);
    if (mesh) {
      this.queue(batch, mesh, matrix);
      return;
    }
    const scale = id === "grazer" ? 1.1 : id === "wolf" ? 0.76 : 0.40;
    this.queue(batch, this.rock, multiply(matrix, pose(0, scale * 0.22, 0, 0, 0, scale * 0.48, scale * 0.44, scale * 0.88)),
      [0.42, 0.34, 0.26, 1]);
  }

  drawCrossbow(batch, matrix, reload, loaded) {
    this.queue(batch, this.crossbow, matrix);
    const center = loaded ? -0.12 : mix(0.27, -0.12, reloadMotion(reload).cock);
    for (const side of [-1, 1]) {
      const dx = side * 0.333;
      const dz = 0.27 - center;
      this.queue(batch, this.box, multiply(matrix,
        pose(dx / 2, 0.026, center + dz / 2, Math.atan2(dx, dz), 0, 0.009, 0.009, Math.hypot(dx, dz) + 0.01)),
      [0.71, 0.63, 0.48, 1]);
    }
    if (loaded || reload >= 0.79) this.queue(batch, this.bolt, multiply(matrix, pose(0, 0.047, 0.42)));
  }

  forearm(batch, shoulder, hand, cloth, skin) {
    const [x, y, z] = hand.map((n, i) => n - shoulder[i]);
    const length = Math.hypot(x, y, z);
    if (length > 0.001) {
      const horizontal = Math.hypot(x, z);
      const axis = [x / length, y / length, z / length];
      const side = horizontal < 0.01 ? [1, 0, 0] : [z / horizontal, 0, -x / horizontal];
      const depth = [side[1] * axis[2] - side[2] * axis[1], side[2] * axis[0] - side[0] * axis[2],
        side[0] * axis[1] - side[1] * axis[0]];
      const matrix = [...side.map(n => n * 0.14), 0, x, y, z, 0, ...depth.map(n => n * 0.13), 0, ...shoulder, 1];
      this.queue(batch, this.trunk, matrix, cloth);
    }
    this.queue(batch, this.rock, pose(hand[0], hand[1] - 0.042, hand[2], 0, 0.18, 0.105, 0.12, 0.098), skin);
  }

  crossbowHands(batch, frame, clock, bob, cloth, skin) {
    const { player } = frame;
    const reload = player.reload ? clamp(player.reload + (clock - frame.clock) / (player.reloadSeconds || 4)) : 0;
    const motion = reloadMotion(reload);
    const aim = player.aim ? 1 - motion.lower : 0;
    const recoil = Math.sin(clamp((player.swing || 0) / 0.36) * Math.PI);
    const matrix = pose(0.16 - 0.14 * aim + motion.lower * 0.10,
      -0.24 + bob + 0.15 * aim - 0.22 * motion.lower,
      0.58 - 0.09 * motion.lower - 0.075 * recoil, 0.07 + 0.20 * motion.lower, motion.lower * 0.32 - recoil * 0.12, 0.77);
    const right = transformedPoint(matrix, 0, -0.09, -0.015, 1);
    this.forearm(batch, [0.27, -0.46, 0.08], right, cloth, skin);

    const grip = [-0.086, -0.075, 0.28];
    let left = transformedPoint(matrix, ...grip, 1);
    if (reload > 0) {
      const fingertips = [-0.025, 0.054, mix(0.26, -0.12, motion.cock)];
      const start = smooth(reload / 0.22);
      const withdraw = smooth((reload - 0.79) / 0.21);
      const motionWeight = start * (1 - withdraw);
      if (reload >= 0.54 && reload < 0.79) {
        const boltX = mix(-0.34, 0, motion.seat);
        const boltY = mix(0.20, 0.047, motion.seat);
        const boltZ = mix(0.12, 0.42, motion.seat);
        const grabbing = pose(boltX, boltY, boltZ, (1 - motion.seat) * -0.63);
        this.queue(batch, this.bolt, multiply(matrix, grabbing));
        left = transformedPoint(multiply(matrix, grabbing), -0.016, -0.04, -0.15, 1);
      } else {
        left = transformedPoint(matrix, ...grip.map((n, i) => mix(n, fingertips[i], motionWeight)), 1);
      }
    }
    this.forearm(batch, [-0.28, -0.43, 0.10], left, cloth, skin);
    this.drawCrossbow(batch, matrix, reload, player.crossbowLoaded);
  }

  hand(batch, frame, clock) {
    const player = frame.player;
    if (!player || player.alive === false) return;
    const weapon = player.weapon;
    const stride = clamp((player.speed ?? 0) / 7);
    const swing = Math.sin(clamp((player.swing ?? 0) / 0.36) * Math.PI);
    const aiming = player.aim ? 1 : 0;
    const bob = Math.cos(clock * 11.5) * stride * 0.012;
    const left = -0.18 - swing * 0.03;
    const right = 0.24 - aiming * 0.13 - swing * 0.21;
    const cloth = [0.30, 0.35, 0.28, 1];
    const skin = [0.53, 0.40, 0.30, 1];
    if (weapon === "crossbow") {
      this.crossbowHands(batch, frame, clock, bob, cloth, skin);
      return;
    }
    const armY = -0.31 + bob + swing * 0.15 + aiming * 0.10;
    this.queue(batch, this.trunk, pose(right, armY - 0.08, 0.17, -0.63 + swing, 1.32, 0.13, 0.44, 0.11), cloth);
    this.queue(batch, this.rock, pose(right - 0.03, armY + 0.03, 0.50, 0, 0.28, 0.12, 0.14, 0.13), skin);
    if (player.shield) {
      const raised = clamp(Math.max(player.shieldRaised ? 0.84 : 0, player.guardBlend || 0));
      const shield = pose(-0.39 + 0.12 * raised, -0.52 + 0.33 * raised + bob, 0.59 - 0.025 * raised,
        -0.52 * (1 - raised), -0.25 + 0.18 * raised, 0.73);
      this.forearm(batch, [-0.28, -0.46, 0.10], transformedPoint(shield, -0.1, 0, -0.105, 1), cloth, skin);
      this.queue(batch, this.shield, shield);
    } else if (!weapon || weapon === "fists" || weapon === "bow") {
      this.queue(batch, this.trunk, pose(left, armY - 0.10, 0.13, 0.6, 1.36, 0.13, 0.42, 0.11), cloth);
      this.queue(batch, this.rock, pose(left + 0.03, armY + 0.02, 0.46, 0, 0.28, 0.12, 0.14, 0.13), skin);
    }
    if (!weapon || weapon === "fists") return;
    const tilt = weapon === "spear" ? 1.12 : weapon === "bow" ? 0.12 : 0.29;
    const position = pose(right - 0.04, armY + 0.03, 0.49, -0.04 - swing * 0.74, tilt - swing * 0.76, 0.77);
    const mesh = weapon === "sword" ? this.sword
      : this.flatModel(player.aim && weapon === "bow" ? "bow_draw1" : weapon) ?? this.flatModel(weapon);
    if (mesh) this.queue(batch, mesh, position);
    else this.queue(batch, this.box, multiply(position, pose(0, 0.03, 0, 0, 0, 0.06, 0.35, 0.055)), [0.57, 0.54, 0.44, 1]);
  }

  render(now = performance.now()) {
    if (this.disposed || this.contextLost || !this.resize(now)) return;
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.frame || !this.terrainMesh) return;
    const frame = this.frame;
    const camera = this.cameraAt(now);
    const arena = this.world.arena;
    const elapsed = clamp((now - this.frameAt) / 1000, 0, 0.16);
    const clock = (frame.clock ?? 0) + elapsed;
    const conditions = skyConditions(frame, arena, camera);
    const aspect = this.canvas.width / this.canvas.height;
    const fov = clamp(frame.fov ?? 77, 60, 98) * Math.PI / 180;
    const vertical = Math.tan(fov / 2) / Math.min(1, aspect * 1.42);
    const horizontal = vertical * aspect;
    const projection = [1 / horizontal, 1 / vertical];

    const nearby = new Map();
    const fire = [0, 0, 0, 0];
    const flames = new Map();
    let fireDistance = 13;
    for (const p of this.propsNear(camera)) {
      const [id, x, y, z, , , w, h, d, kind, lit] = p;
      const dx = x - camera.x;
      const dz = z - camera.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const limit = tallLandmarks.has(id) ? 160 : kind === "pickup" ? 44 : kind === "vegetation" ? 39 : 124;
      if (lit) {
        const base = y + (id === "stove" ? 0.79 : 0.15);
        const flutter = 0.82 + 0.18 * Math.sin(clock * 18 + x);
        if (distance < fireDistance) {
          fire.splice(0, 4, x, base + 0.58, z, flutter);
          fireDistance = distance;
        }
        if (this.visible(camera, x, z, 100, horizontal, 2)) {
          this.queue(flames, this.flame, pose(x, base, z, clock * 2.3, 0, 0.52, 1.06 * flutter, 0.49), [0.92, 0.29, 0.06, 0.58]);
          this.queue(flames, this.flame, pose(x, base + 0.04, z, -clock * 1.7, 0, 0.30, 0.72 / flutter, 0.29), [1, 0.72, 0.27, 0.82]);
        }
      }
      if (distance > limit || !this.visible(camera, x, z, limit, horizontal, Math.max(2, w * 0.66, d * 0.66, tallLandmarks.has(id) ? h : 0))) continue;
      const lowDetail = distance > (this.res < 0.86 ? 32 : 52) && (trees.has(id) || rocks.has(id) || kind === "vegetation");
      this.prop(nearby, p, elapsed, lowDetail);
    }
    for (const a of frame.actors ?? []) {
      if (!this.visible(camera, a[0], a[2], 108, horizontal, 2)) continue;
      this.actor(nearby, a, clock, Math.hypot(a[0] - camera.x, a[2] - camera.z) < 36);
    }
    for (const a of frame.wildlife ?? []) {
      if (!this.visible(camera, a[1], a[3], 92, horizontal, 2)) continue;
      this.animal(nearby, a, clock, Math.hypot(a[1] - camera.x, a[3] - camera.z) < 27);
    }
    for (const [id, x, y, z, yaw = 0, pitch] of frame.shots ?? []) {
      if (!this.visible(camera, x, z, 120, horizontal, 2)) continue;
      if (id === "bolt") {
        this.queue(nearby, this.bolt, pose(x, y, z, yaw, (pitch ?? Math.PI / 2) - Math.PI / 2));
        continue;
      }
      const mesh = this.flatModel(id) ?? this.rock;
      const scale = id === "stone" ? 0.38 : mesh === this.rock ? 0.12 : 1;
      let transform = pose(x, y, z, yaw, pitch ?? 0, scale);
      if (pitch != null && (id === "spear" || id === "arrow") && mesh !== this.rock) {
        transform = multiply(transform, pose(0, id === "spear" ? -1.355 : -0.432, 0));
      }
      this.queue(nearby, mesh, transform);
    }

    this.drawSky(camera, conditions, projection);
    this.shadeScene(camera, conditions, projection, clock, fire);
    const identity = [...pose(), ...solid];
    this.draw(this.terrainMesh, identity);
    this.drawBatch(nearby);
    gl.enable(gl.BLEND);
    gl.depthMask(false);
    const water = frame.flood ? this.floodMesh ?? this.waterMesh : this.waterMesh;
    if (water) this.draw(water, identity);
    const s = frame.storm;
    if (s?.active && Number.isFinite(s.radius)) this.draw(this.stormMesh(0, s.x, s.z, s.radius), identity);
    if (s?.warning && Number.isFinite(s.nextRadius)) this.draw(this.stormMesh(1, s.x, s.z, s.nextRadius), identity);
    this.drawBatch(flames, 4);

    if (frame.ghost) {
      const batch = new Map();
      const color = frame.ghostFits ? [0.34, 0.92, 0.65, 0.32] : [1, 0.28, 0.18, 0.32];
      this.prop(batch, frame.ghost, 0, false, color);
      this.drawBatch(batch, 4);
    }
    gl.depthMask(true);
    gl.disable(gl.BLEND);
    if (frame.mode === "match") {
      const equipment = new Map();
      this.hand(equipment, frame, clock);
      if (equipment.size) {
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.uniform1i(this.sceneU.viewModel, 1);
        gl.uniform1f(this.sceneU.light, Math.max(0.42, conditions.day));
        this.drawBatch(equipment);
      }
    }
    gl.bindVertexArray(null);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.assets?.abort();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    this.canvas.removeEventListener("webglcontextrestored", this.restored);
    if (this.contextLost) return;
    const gl = this.gl;
    for (const mesh of this.meshes) this.releaseMesh(mesh);
    for (const { texture } of this.textures?.values() ?? []) gl.deleteTexture(texture);
    gl.deleteBuffer(this.instanceBuffer);
    gl.deleteVertexArray(this.blankVAO);
    gl.deleteProgram(this.scene);
    gl.deleteProgram(this.backdrop);
  }
}

function uniformsForAttributes(gl, shader) {
  return Object.fromEntries(["vertex", "normal", "uv", "color", "model", "tint"].map(name => [name, gl.getAttribLocation(shader, name)]));
}

function propCell(x, z) {
  return (x + 64) + (z + 64) * 128;
}

async function imageFromBlob(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
