import { MultiBounceBRDF } from '../precompute/multiBounceBRDF';

// structue definition

const Camera = /* wgsl */`
struct Camera {
  position: vec3<f32>,
  viewMat: mat4x4<f32>,
  projectionMat: mat4x4<f32>
}
`;

const PointLight = /* wgsl */`
struct PointLight {
  position: vec3<f32>,
  color: vec3<f32>,
  viewProjectionMat: mat4x4<f32>
}
`;

const DirectionalLight = /* wgsl */`
struct DirectionalLight {
  direction: vec3<f32>,
  color: vec3<f32>,
  viewProjectionMat: mat4x4<f32>
}
`;

const PBRMaterial = /* wgsl */`
struct PBRMaterial {
  roughness: f32,       // [0, 1]
  metalness: f32,       // {0, 1}
  albedo: vec3<f32>,    // diffuse color 
  specular: vec3<f32>   // F0: normal-incidence Fresnel reflectance
}
`;

const Transform = /* wgsl */`
struct Transform {
  modelMat: mat4x4<f32>,
  normalMat : mat3x3<f32>
};
`;

const Definitions = { Camera, PointLight, DirectionalLight, PBRMaterial, Transform };


// constants

const Constants = /* wgsl */`
const EPS = 1e-5;
const PI = 3.141592653589793;
const PI_twice = 6.283185307179586;
`;


// tool functions

const ToolFunctions = /* wgsl */`
fn rand(uv: vec2<f32>) -> f32 {  // 0 - 1
	const a: f32 = 12.9898; const b: f32 = 78.233; const c: f32 = 43758.5453;
	let dt: f32 = dot( uv, vec2<f32>(a, b) ); 
  let sn: f32 = dt - PI * floor(dt / PI); // mod
	return fract(sin(sn) * c);
}

fn lerp(a: f32, b: f32, s: f32) -> f32 {
  return fma(a, 1.0 - s, b * s);
}

fn lerp_vec3(a: vec3<f32>, b: vec3<f32>, s: f32) -> vec3<f32> {
  return fma(a, vec3<f32>(1.0 - s), b * s);
}

fn lerp_vec4(a: vec4<f32>, b: vec4<f32>, s: f32) -> vec4<f32> {
  return fma(a, vec4<f32>(1.0 - s), b * s);
}

fn pow5(x: f32) -> f32 { // an approximation of pow5, see https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
  let y = 1.0 - x;
  return pow(2, (-5.55473 * y - 6.98316) * y);
}

fn get_mod(x: f32, y:f32) -> f32 {
  return (x - y * floor(x / y));
}

fn bilinearSampleTexture(texture: texture_2d<f32>, textureSize: vec2<u32>, uv: vec2<f32>) -> vec4<f32> {
  let coord = clamp(
    uv * vec2<f32>(textureSize),
    vec2<f32>(0.0), vec2<f32>(textureSize - 1)
  );
  var x: vec4<f32>; var y: vec4<f32>;
  x = textureLoad(texture, vec2<i32>(coord) + vec2<i32>(0, 0), 0);
  y = textureLoad(texture, vec2<i32>(coord) + vec2<i32>(0, 1), 0);
  let p = lerp_vec4(x, y, fract(coord.y));
  x = textureLoad(texture, vec2<i32>(coord) + vec2<i32>(1, 0), 0);
  y = textureLoad(texture, vec2<i32>(coord) + vec2<i32>(1, 1), 0);
  let q = lerp_vec4(x, y, fract(coord.y));
  return lerp_vec4(p, q, fract(coord.x));
}

fn linearSampleTexture(texture: texture_1d<f32>, textureSize: u32, u: f32) -> vec4<f32> {
  let coord = clamp(u * f32(textureSize), 0.0, f32(textureSize - 1));
  let x = textureLoad(texture, i32(coord) + 0, 0);
  let y = textureLoad(texture, i32(coord) + 1, 0);
  return lerp_vec4(x, y, fract(coord));
}
`;


// sampling

const RadicalInverse = /* wgsl */`
fn RadicalInverse(x: u32, base: u32) -> f32 {
  // var bits_ = (bits << 16u) | (bits >> 16u);
  // bits_ = ((bits_ & 0x55555555) << 1u) | ((bits_ & 0xAAAAAAAA) >> 1u);
  // bits_ = ((bits_ & 0x33333333) << 2u) | ((bits_ & 0xCCCCCCCC) >> 2u);
  // bits_ = ((bits_ & 0x0F0F0F0F) << 4u) | ((bits_ & 0xF0F0F0F0) >> 4u);
  // bits_ = ((bits_ & 0x00FF00FF) << 8u) | ((bits_ & 0xFF00FF00) >> 8u);
  // return f32(bits) * 2.3283064365386963e-10;

  // var invBase: f32 = 1.0 / f32(base);
  // var denom: f32 = 1.0;
  // var result: f32 = 0.0;
  // var n: u32 = x;
  // for(var i: u32 = 0; i < 32u; i = i + 1){
  //   if(n <= 0) { break; }
  //   denom   = get_mod(f32(n), 2.0);
  //   result += denom * invBase;
  //   invBase = invBase / 2.0;
  //   n       = u32(f32(n) / 2.0);
  // }
  // return result;
  var numPoints: f32 = 1.0;
  var inverse: u32;
  var i: u32 = x;
	for(inverse = 0; i > 0; i = i / base) {
		inverse = inverse * base + (i % base);
		numPoints = numPoints * f32(base);
	}
	return f32(inverse) / numPoints;
}
`;

const Hammersley = /* wgsl */`
fn Hammersley(i: u32, N: u32) -> vec2<f32> { // return the i-th uniform 2D sample while the sample count is N
  return vec2<f32>(f32(i) / f32(N), RadicalInverse(i, 2)); // result in [0, 1]^2
}
`;

const HemisphereUniform = /* wgsl */`
fn hemisphereSample(sample2D: vec2<f32>) -> vec3<f32> {
  let phi = sample2D.x * PI_twice;
  let cosTheta = 1.0 - sample2D.y;
  let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  return vec3<f32>(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta);
}
`;

const GGXImportance = /* wgsl */`
fn GGXImportanceSample(sample2D: vec2<f32>, alpha: f32) -> vec3<f32> {
  let alpha2 = clamp(alpha * alpha, 0.00002, 1.0); // a strange bug
  let phi = sample2D.x * PI_twice;
  let cosTheta = sqrt((1.0 - sample2D.y) / (sample2D.y * (alpha2 - 1.0) + 1.0));
  let sinTheta = sqrt(1.0 - cosTheta * cosTheta);
  return normalize(vec3<f32>(cos(phi) * sinTheta, sin(phi) * sinTheta, cosTheta));
}
`;

const Sampling = { RadicalInverse, Hammersley, HemisphereUniform, GGXImportance };


// shadow

const hardShadow = /* wgsl */`
const SHADOW_BIAS = 1e-4;

fn hardShadow(
  uv: vec2<f32>, depth: f32, 
  shadowMap: texture_depth_2d, 
  shadowMapSampler: sampler_comparison
) -> f32 {

  var visibility = textureSampleCompare( // Must only be invoked in uniform control flow.
    shadowMap,
    shadowMapSampler,
    uv,
    depth - SHADOW_BIAS
  );
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { visibility = 1.0; }
  return visibility;

}
`;

const PCF = /* wgsl */`
const PCF_SMAPLE_NUM: i32 = 16;
const POISSON_DISK_SAMPLES: array<vec2<f32>, 16> = array(
  vec2<f32>(-0.94201624, -0.39906216),  vec2<f32>(0.94558609, -0.76890725),
  vec2<f32>(-0.094184101, -0.92938870), vec2<f32>(0.34495938, 0.29387760),
  vec2<f32>(-0.91588581, 0.45771432),   vec2<f32>(-0.81544232, -0.87912464),
  vec2<f32>(-0.38277543, 0.27676845),   vec2<f32>(0.97484398, 0.75648379),
  vec2<f32>(0.44323325, -0.97511554),   vec2<f32>(0.53742981, -0.47373420),
  vec2<f32>(-0.26496911, -0.41893023),  vec2<f32>(0.79197514, 0.19090188),
  vec2<f32>(-0.24188840, 0.99706507),   vec2<f32>(-0.81409955, 0.91437590),
  vec2<f32>(0.19984126, 0.78641367),    vec2<f32>(0.14383161, -0.14100790)
);

fn PCF(
  uv: vec2<f32>, depth: f32,
  radius: f32, 
  shadowMap: texture_depth_2d, 
  shadowMapSampler: sampler_comparison
) -> f32 {

  let rot_theta: f32 = rand(uv);
  let sin_theta: f32 = sin(rot_theta); let cos_theta: f32 = cos(rot_theta);
  let rot_mat: mat2x2<f32> = mat2x2<f32>(cos_theta, sin_theta, -sin_theta, cos_theta);

  var sum: f32 = 0;
  let radius_tex: f32 = radius / f32(textureDimensions(shadowMap).x);
  for (var i : i32 = 0 ; i < PCF_SMAPLE_NUM ; i = i + 1) {
    sum = sum + hardShadow(
      uv + radius_tex * rot_mat * POISSON_DISK_SAMPLES[i], depth,
      shadowMap, shadowMapSampler
    );
  }
  return sum / f32(PCF_SMAPLE_NUM);

}
`;

const Shadow = { hardShadow, PCF };


// PBR Shading

const NDF = /* wgsl */`
fn NDF_GGX(alpha: f32, NoH: f32) -> f32 { // normal distribution function (GGX)
  let NoH_ = saturate(NoH);
  let alpha2 = alpha * alpha;
  let d = NoH_ * NoH_ * (alpha2 - 1.0) + 1.0;
  return alpha2 / (PI * d * d);
}
`;

const Fresnel = /* wgsl */`
fn Fresnel_Schlick(F0: vec3<f32>, VoH: f32) -> vec3<f32> { // Fresnel reflectance (Schlick approximation)
  let VoH_ = saturate(VoH);
  let Fc = pow5(1 - VoH_);
  return saturate(50.0 * F0.g) * Fc + (1.0 - Fc) * F0; // Anything less than 2% is physically impossible 
}                                                      // and is instead considered to be shadowing
`;

const Geometry = /* wgsl */`
fn G2_Smith(alpha: f32, NoL: f32, NoV: f32) -> f32 { // an approximation of (the height-correlated Smith G2 function
  let NoL_ = abs(NoL);                               // combined with the denominator of specular BRDF)
  let NoV_ = abs(NoV);
  return 0.5 / (lerp(2 * NoL_ * NoV_, NoL_ + NoV_, alpha) + EPS);

  // let NoL_ = saturate(NoL);
  // let NoV_ = saturate(NoV);
  // let alpha2 = alpha * alpha;
  // let GGXL = NoV_ * sqrt((-NoL_ * alpha2 + NoL_) * NoL_ + alpha2);
  // let GGXV = NoL_ * sqrt((-NoV_ * alpha2 + NoV_) * NoV_ + alpha2);
  // return 0.5 / (GGXV + GGXL + EPS);

  // let NoL_ = saturate(NoL);
  // let NoV_ = saturate(NoV);
  // let k = (roughness + 1.0) * (roughness + 1.0) / 8.0;
  // let ggx1 = NoV / (NoV * (1.0 - k) + k + EPS);
  // let ggx2 = NoL / (NoL * (1.0 - k) + k + EPS);
  // return ggx1 * ggx2;
}
`;

const Shading = /* wgsl */`
fn PBRShading(
  N: vec3<f32>, V: vec3<f32>, L: vec3<f32>, 
  material: PBRMaterial, 
  radiance: vec3<f32>
) -> vec3<f32> {

  let H = normalize(V + L);
  let NoV = dot(N, V);
  let NoL = dot(N, L);
  let NoH = dot(N, H);
  let VoH = dot(V, H);
  let alpha = material.roughness * material.roughness;

  let F0 = lerp_vec3(vec3<f32>(0.04), material.albedo, material.metalness);

  let G = G2_Smith(alpha, NoL, NoV);
  let D = NDF_GGX(alpha, NoH);
  let F = Fresnel_Schlick(F0, VoH);
  let specular = G * D * F;

  let diffuse = material.albedo / PI * (1.0 - F) * (1.0 - material.metalness);

  return PI * (specular + diffuse) * radiance * saturate(NoL);

}
`;

const PBR = { NDF, Geometry, Fresnel, Shading };


// tone mapping

const ACESToneMapping = /* wgsl */`
// ACES Tone Mapping, see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
const ACESInputMat = mat3x3<f32>(
  0.59719, 0.07600, 0.02840,
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777
);

const ACESOutputMat = mat3x3<f32>(
  1.604750, -0.10208, -0.00327,
  -0.53108, 1.108130, -0.07276,
  -0.07367, -0.00605, 1.076020
);

fn RRTAndODTFit(v: vec3<f32>) -> vec3<f32> {
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

fn ACESToneMapping(color: vec3<f32>) -> vec3<f32> {
  var color_: vec3<f32> = ACESInputMat * color;   // sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
  color_ = RRTAndODTFit(color_);                  // Apply RRT and ODT
  color_ = ACESOutputMat * color_;                // ODT_SAT => XYZ => D60_2_D65 => sRGB
  return saturate(color_);
}
`;


export { 
  Definitions, Constants, 
  ToolFunctions, Sampling,
  Shadow, PBR, ACESToneMapping 
};