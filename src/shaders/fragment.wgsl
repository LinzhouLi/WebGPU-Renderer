@group(0) @binding(1) var<uniform> lightPosition: vec3<f32>;
@group(0) @binding(2) var<uniform> lightColor: vec3<f32>;
@group(0) @binding(3) var<uniform> lightInfo: vec3<f32>;

@group(2) @binding(0) var linearSampler: sampler;
@group(2) @binding(1) var texture: texture_2d<f32>;
@group(2) @binding(2) var normalMap: texture_2d<f32>;
@group(2) @binding(3) var metalnessMap: texture_2d<f32>;

@fragment
fn main(
  @location(0) fragPosition: vec3<f32>,
  @location(1) fragNormal: vec3<f32>,
  @location(2) fragUV: vec2<f32>
) -> @location(0) vec4<f32> {
  let normal_del = textureSample(normalMap, linearSampler, fragUV);
  let metalness = textureSample(metalnessMap, linearSampler, fragUV);
  return textureSample(texture, linearSampler, fragUV);
  // return vec4<f32>(1.0, 1.0, 1.0, 1.0);
}
