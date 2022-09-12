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
  return textureSample(texture, linearSampler, fragUV);
}
