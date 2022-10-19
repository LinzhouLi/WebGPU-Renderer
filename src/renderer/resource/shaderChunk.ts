
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
const bias = 1e-4;
const eps = 1e-5;

const PI: f32 = 3.141592653589793;
const SMAPLE_NUM: i32 = 16;
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
  return a * (1.0 - s) + b * s;
}

fn lerp_vec3(a: vec3<f32>, b: vec3<f32>, s: f32) -> vec3<f32> {
  return vec3<f32>(lerp(a.x, b.x, s), lerp(a.y, b.y, s), lerp(a.z, b.z, s));
}

fn pow5(x: f32) -> f32 { // an approximation of pow5, see https://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
  let y = 1.0 - x;
  return pow(2, (-5.55473 * y - 6.98316) * y);
}
`;


// shadow

const hardShadow = /* wgsl */`
fn hardShadow(
  uv: vec2<f32>, depth: f32, 
  shadowMap: texture_depth_2d, 
  shadowMapSampler: sampler_comparison
) -> f32 {

  var visibility = textureSampleCompare( // Must only be invoked in uniform control flow.
    shadowMap,
    shadowMapSampler,
    uv,
    depth - bias
  );
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { visibility = 1.0; }
  return visibility;

}
`;

const PCF = /* wgsl */`
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
  for (var i : i32 = 0 ; i < SMAPLE_NUM ; i = i + 1) {
    sum = sum + hardShadow(
      uv + radius_tex * rot_mat * POISSON_DISK_SAMPLES[i], depth,
      shadowMap, shadowMapSampler
    );
  }
  return sum / f32(SMAPLE_NUM);

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
fn Fresnel(F0: vec3<f32>, VoH: f32) -> vec3<f32> { // Fresnel reflectance (Schlick approximation)
  let VoH_ = saturate(VoH);
  let Fc = pow5(1 - VoH_);
  return saturate(50.0 * F0.g) * Fc + (1.0 - Fc) * F0; // Anything less than 2% is physically impossible 
}                                                      // and is instead considered to be shadowing
`;

const Geometry = /* wgsl */`
fn G2_with_denom(alpha: f32, NoL: f32, NoV: f32) -> f32 { // an approximation of (the height-correlated Smith G2 function
  let NoL_ = abs(NoL);                                    // combined with the denominator of specular BRDF)
  let NoV_ = abs(NoV);
  return 0.5 / (lerp(2 * NoL_ * NoV_, NoL_ + NoV_, alpha) + eps);
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

  let G = G2_with_denom(alpha, NoL, NoV);
  let D = NDF_GGX(alpha, NoH);
  let F = Fresnel(F0, VoH);
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


export { Definitions, Constants, ToolFunctions, Shadow, PBR, ACESToneMapping };