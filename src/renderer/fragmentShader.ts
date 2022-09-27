import { wgsl } from './wgsl-preprocessor';;

export function createFragmentShader(attributes: string[], type: string = 'phong') {

  const textureMap = attributes.includes('baseMap');

  let code: string;

  if (type === 'phong') {
    code = wgsl
/* wgsl */`
@group(0) @binding(2) var<uniform> cameraPosition: vec3<f32>;

@group(0) @binding(4) var<uniform> lightPosition: vec3<f32>;
@group(0) @binding(5) var shadowSampler: sampler_comparison;
@group(0) @binding(6) var shadowMap: texture_depth_2d;

@group(1) @binding(2) var<uniform> color: vec3<f32>;
@group(1) @binding(3) var texSampler: sampler;
#if ${textureMap}
@group(1) @binding(4) var textureMap: texture_2d<f32>;
#endif

const lightColor = vec3<f32>(1.0, 1.0, 1.0);
const bias = 0.002;

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


fn rand(uv: vec2<f32>) -> f32 {  // 0 - 1
	const a: f32 = 12.9898; const b: f32 = 78.233; const c: f32 = 43758.5453;
	let dt: f32 = dot( uv, vec2<f32>(a, b) ); 
  let sn: f32 = dt - PI * floor(dt / PI); // mod
	return fract(sin(sn) * c);
}


fn PCF(radius: f32, shadowCoords: vec3<f32>) -> f32 {

  let rot_theta: f32 = rand(shadowCoords.xy);
  let sin_theta: f32 = sin(rot_theta); let cos_theta: f32 = cos(rot_theta);
  let rot_mat: mat2x2<f32> = mat2x2<f32>(cos_theta, sin_theta, -sin_theta, cos_theta);

  var sum: f32 = 0;
  let radius_tex: f32 = radius / f32(textureDimensions(shadowMap).x);
  for (var i : i32 = 0 ; i < SMAPLE_NUM ; i = i + 1) {
    sum = sum + textureSampleCompare(
      shadowMap,
      shadowSampler,
      shadowCoords.xy + radius_tex * rot_mat * POISSON_DISK_SAMPLES[i],
      shadowCoords.z - bias
    );
  }
  return sum / f32(SMAPLE_NUM);

}


@fragment
fn main(
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
  @location(1) fragNormal : vec3<f32>,
  @location(2) fragUV: vec2<f32>,
  @location(3) shadowPos: vec4<f32>
) -> @location(0) vec4<f32> {

  // let biNormal = normalize(cross(fragNormal, fragTangent));
  // let tbn = mat3x3<f32>(fragTangent, biNormal, fragNormal);
  // let normal_del = textureSample(normalMap, texSampler, fragUV);
  // let normal = normalize(tbn * normal_del.xyz);

  let normal = fragNormal;

#if ${textureMap}
  let albedo = textureSample(textureMap, texSampler, fragUV).xyz * color;
#else
  let albedo = color;
#endif

  // shadow
  // let shadow = textureSampleCompare(
  //   shadowMap, 
  //   shadowSampler, 
  //   shadowPos.xy / shadowPos.w * vec2<f32>(0.5, -0.5) + 0.5,  // Convert shadowPos XY to (0, 1) to fit texture UV
  //   shadowPos.z / shadowPos.w - bias
  // );
  let shadowCoords: vec3<f32> = vec3<f32>(
    shadowPos.xy / shadowPos.w * vec2<f32>(0.5, -0.5) + 0.5, // Convert shadowPos XY to (0, 1) to fit texture UV
    shadowPos.z / shadowPos.w
  );
  let shadow = PCF(5.0, shadowCoords);

  // Blinn-Phong
  let lightDir = normalize(lightPosition - fragPosition);
  let viewDir = normalize(cameraPosition - fragPosition);
  let halfVec = normalize(lightDir + viewDir);

  let ambient = albedo * lightColor * 0.2;

  let diff = max(dot(lightDir, normal), 0.0);
  let diffuse = diff * lightColor * albedo;

  let spec = pow(max(dot(normal, halfVec), 0.0), 32);
  let specular = spec * lightColor * albedo;

  return vec4<f32>(shadow * (ambient + diffuse + specular), 1.0);

  // let metalness = textureSample(metalnessMap, texSampler, fragUV);
  // return textureSample(texture, linearSampler, fragUV);

}
`
  }
  else if (type === 'skybox') {
    code = wgsl
/* wgsl */`
@group(0) @binding(2) var texSampler: sampler;
@group(0) @binding(3) var skyboxMap: texture_cube<f32>;

@fragment
fn main(
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
) -> @location(0) vec4<f32> {

  return textureSample(skyboxMap, texSampler, fragPosition);

}
`
  }
  // console.log(code);
  return code;
  
}