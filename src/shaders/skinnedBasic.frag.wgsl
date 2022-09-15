@group(0) @binding(2) var<uniform> cameraPosition: vec3<f32>;
@group(0) @binding(3) var<uniform> lightPosition: vec3<f32>;
@group(0) @binding(4) var<uniform> lightColor: vec3<f32>;
@group(0) @binding(5) var<uniform> lightInfo: vec3<f32>;

@group(2) @binding(0) var linearSampler: sampler;
@group(2) @binding(1) var texture: texture_2d<f32>;

@fragment
fn main(
  @location(0) fragPosition: vec3<f32>,
  @location(1) fragNormal: vec3<f32>,
  @location(2) fragUV: vec2<f32>
) -> @location(0) vec4<f32> {

  let normal = fragNormal;
  let albedo = textureSample(texture, linearSampler, fragUV).xyz;

  let lightDir = normalize(lightPosition - fragPosition);
  let viewDir = normalize(cameraPosition - fragPosition);
  let halfVec = normalize(lightDir + viewDir);

  let ambient = albedo * lightColor * 0.2;

  let diff = max(dot(lightDir, normal), 0.0);
  let diffuse = diff * lightColor * albedo;

  let spec = pow(max(dot(normal, halfVec), 0.0), 32);
  let specular = spec * lightColor * albedo;

  return vec4<f32>(ambient + diffuse + specular,1.0);

}
