import { wgsl } from './wgsl-preprocessor';;

export function createFragmentShader(attributes: string[], type: string = 'phong') {

  const textureMap = attributes.includes('baseMap');

  let code: string;

  if (type === 'phong') {
    code = wgsl
/* wgsl */`
@group(0) @binding(2) var<uniform> cameraPosition: vec3<f32>;

@group(0) @binding(4) var<uniform> lightPosition: vec3<f32>;
// @group(0) @binding(5) var shadowSampler: sampler_comparison;
// @group(0) @binding(6) var shadowMap: texture_depth_2d;

@group(1) @binding(2) var<uniform> color: vec3<f32>;
@group(1) @binding(3) var texSampler: sampler;
#if ${textureMap}
@group(1) @binding(4) var textureMap: texture_2d<f32>;
#endif

const lightColor = vec3<f32>(1.0, 1.0, 1.0);

@fragment
fn main(
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
  @location(1) fragNormal : vec3<f32>,
  @location(2) fragUV: vec2<f32>,
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

  let lightDir = normalize(lightPosition - fragPosition);
  let viewDir = normalize(cameraPosition - fragPosition);
  let halfVec = normalize(lightDir + viewDir);

  let ambient = albedo * lightColor * 0.2;

  let diff = max(dot(lightDir, normal), 0.0);
  let diffuse = diff * lightColor * albedo;

  let spec = pow(max(dot(normal, halfVec), 0.0), 32);
  let specular = spec * lightColor * albedo;

  return vec4<f32>(ambient + diffuse + specular,1.0);

  // let metalness = textureSample(metalnessMap, texSampler, fragUV);
  // return textureSample(texture, linearSampler, fragUV);

}
`
  }
  // console.log(code);
  return code;
  
}