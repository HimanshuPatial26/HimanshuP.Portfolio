import * as THREE from "three";
import { BOUNCE_DIR, COLORS, DEBRIS_VERT, FILL_DIR, KEY_DIR, LIGHT_GLSL, NOISE_GLSL, OUT_GLSL, ROCK_FRAG, buildDebrisGeometry } from "./husk";

/*
 * Molten rock: every 3D shape after the hero, in the husk's stone. A formed shape is charred
 * basalt with thin blue cracks. As it hands over it heats: glowing lava breaks through between
 * cooling crust plates until the whole thing is molten, melts into the shared blob (the scene's
 * existing melt), and the next shape forms from the lava and cools to stone. The vertex stage is
 * the scene's own liquid melt (passed in); the blob itself is the husk's molten core.
 */

/** Shapes are modelled about 1.45× the husk's unit radius: sample the stone at the husk's scale. */
const STONE_SCALE = 0.69;

const SHAPE_FRAG = /* glsl */ `
varying vec3 vRest;
varying vec3 vN;
varying vec3 vW;
uniform float uMelt;
uniform float uTime;
uniform vec3 uRockColor;
uniform float uWeathering;
uniform vec3 uHotColor;
uniform float uHeat;
uniform float uPale;
${NOISE_GLSL}
${LIGHT_GLSL}
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  vec3 p = vRest * ${STONE_SCALE.toFixed(3)};

  // stone: grain, a bump from it, and weathered grey plates over char
  float grain = fbm(p * 9.0);
  float coarse = fbm(p * 1.9 + 11.0);
  #ifndef HUSK_LOW
  float e = 0.035;
  vec3 g = vec3(
    fbm(p * 9.0 + vec3(e, 0.0, 0.0)) - grain,
    fbm(p * 9.0 + vec3(0.0, e, 0.0)) - grain,
    fbm(p * 9.0 + vec3(0.0, 0.0, e)) - grain
  );
  N = normalize(N - (g - N * dot(g, N)) * 5.5);
  #endif
  float region = vnoise(p * 0.8 + 5.0);
  float plate = smoothstep(0.44 + (0.5 - region) * 0.28, 0.74, coarse + grain * 0.14);
  vec3 albedo = mix(uRockColor, uRockColor + vec3(0.34, 0.335, 0.325), clamp(plate * uWeathering + uPale * 0.35, 0.0, 1.0));
  albedo *= (0.86 + grain * 0.38) * (0.62 + region * 0.85 + uPale * 0.4);
  vec3 stone = shade(vW, N, V, albedo, 0.05, 26.0, 1.0);

  // thin cracks with the melt behind them, painted on the stone
  float fis = vnoise(p * 1.6 + 3.7);
  float ridge = 1.0 - abs(fis - 0.5) * 22.0;
  float mask = smoothstep(0.44, 0.74, fbm(p * 0.9 + 9.1));
  float line = smoothstep(0.5, 1.0, ridge) * mask;
  float skirt = smoothstep(-1.6, 1.0, ridge) * mask;
  stone += mix(uLavaColor, uHotColor, line * 0.8) * (line * 2.6 + skirt * skirt * 0.22) * uHeat * 0.35;

  // heat: lava breaks through between crust plates as the shape melts, and cools back
  // (saturated blue with white-hot veins; even fully molten, dark crust islands float on it)
  float heat = smoothstep(0.02, 0.8, uMelt);
  float vein = smoothstep(0.34, 0.78, fbm(p * 5.0 + vec3(0.0, uTime * 0.35, 0.0)));
  vec3 lava = mix(uLavaColor * 0.65, uHotColor, vein * vein * 0.75) * (0.55 + 1.25 * heat) * uHeat * 0.3;
  float crustN = fbm(p * 2.6 + vec3(0.0, uTime * 0.12, 0.0));
  float t = mix(-0.05, 0.58, heat); // cold: all crust; molten: about a quarter left
  float crust = smoothstep(t - 0.04, t + 0.05, crustN);
  float edge = (1.0 - crust) * smoothstep(t - 0.14, t, crustN);
  vec3 cooled = stone * mix(1.0, 0.55, heat); // crust floating on the melt is darker, still hot underneath
  vec3 col = mix(lava, cooled, crust) + mix(uLavaColor, uHotColor, 0.6) * edge * uHeat * 0.35;

  gl_FragColor = vec4(col, 1.0);
  ${OUT_GLSL}
}
`;

const rockLight = () => ({
  uKeyDir: { value: KEY_DIR.clone() },
  uFillDir: { value: FILL_DIR.clone() },
  uBounceDir: { value: BOUNCE_DIR.clone() },
  uGroundColor: { value: new THREE.Color(COLORS.dark.ground) },
  uLavaColor: { value: new THREE.Color(COLORS.dark.lava) },
  uLavaPower: { value: 0.25 },
  uCenter: { value: new THREE.Vector3() },
  uUnit: { value: 1.45 },
  uRockColor: { value: new THREE.Color(COLORS.dark.rock) },
  uWeathering: { value: 0.5 },
  uHotColor: { value: new THREE.Color(COLORS.dark.hot) },
  uHeat: { value: 0.4 + 0.6 * 5.2 },
});

type Light = ReturnType<typeof rockLight>;
const theme = (u: Light, light: boolean) => {
  const c = light ? COLORS.light : COLORS.dark;
  u.uRockColor.value.set(c.rock);
  u.uLavaColor.value.set(c.lava);
  u.uHotColor.value.set(c.hot);
  u.uGroundColor.value.set(c.ground);
};

export type RockMat = { mat: THREE.ShaderMaterial; setTheme: (light: boolean) => void; setLow: (low: boolean) => void };

const detail = (mat: THREE.ShaderMaterial) => (low: boolean) => {
  const has = "HUSK_LOW" in mat.defines;
  if (has === low) return;
  mat.defines = low ? { HUSK_LOW: "" } : {};
  mat.needsUpdate = true;
};

/**
 * A shape's molten-rock material. `liquid` is the scene's melt (its noise and blob, and the vertex
 * code that moves each vertex onto the blob); `uniforms` its shared liquid uniforms plus this
 * shape's uMelt and uWobble. `pale` lifts the stone for shapes that carry words (the Impact numbers).
 */
export function rockShapeMaterial(liquid: { noise: string; vertex: string }, uniforms: Record<string, THREE.IUniform>, pale = 0): RockMat {
  const own = { ...rockLight(), uPale: { value: pale } };
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, ...own },
    vertexShader: /* glsl */ `
      ${liquid.noise}
      varying vec3 vRest;
      varying vec3 vN;
      varying vec3 vW;
      void main() {
        ${liquid.vertex}
        vRest = position;
        vec4 wp = modelMatrix * vec4(lqPos, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * lqNrm);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: SHAPE_FRAG,
  });
  return { mat, setTheme: (light: boolean) => theme(own, light), setLow: detail(mat) };
}

/** Rock pebbles that orbit the shapes (in place of the glass bubbles). */
export function createPebbles(count: number) {
  const geo = buildDebrisGeometry();
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) values[i] = 0.45 + ((((Math.sin(i * 91.7) * 43758.5453) % 1) + 1) % 1) * 0.55;
  geo.setAttribute("aSlab", new THREE.InstancedBufferAttribute(values, 1));
  const u = { ...rockLight(), uInner: { value: 0.45 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({ uniforms: u, vertexShader: DEBRIS_VERT, fragmentShader: ROCK_FRAG });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.frustumCulled = false;
  return {
    mesh,
    setTheme: (light: boolean) => theme(u, light),
    dispose: () => {
      geo.dispose();
      mat.dispose();
      mesh.dispose();
    },
  };
}
