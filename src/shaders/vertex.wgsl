@group(0) @binding(0) var<uniform> projectionMatrix : mat4x4<f32>;

@group(1) @binding(0) var<uniform> modelViewMatrix : mat4x4<f32>;
@group(1) @binding(1) var<uniform> meshInfo : f32;
@group(1) @binding(2) var<storage, read> boneMatrices : array<mat4x4<f32>>;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
  @location(1) fragNormal : vec3<f32>,
  @location(2) fragUV: vec2<f32>
};

@vertex
fn main(
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) uv : vec2<f32>,
  @location(3) tangent : vec4<f32>,
  @location(4) skinIndex : vec4<u32>,
  @location(5) skinWeight : vec4<f32>,
) -> VertexOutput {

  let boneCount = meshInfo;
  
  let mvp = projectionMatrix * modelViewMatrix;
  let transformMatrix = boneMatrices[skinIndex[0]];
  let pos = vec4<f32>(position, 1.0);
  
  var output : VertexOutput;
  output.position = mvp * pos;
  output.fragPosition = (modelViewMatrix * pos).xyz;
  output.fragNormal = (modelViewMatrix * vec4<f32>(normal, 0.0)).xyz;
  output.fragUV = uv;

  return output;

}
// 'position', 'normal', 'uv', 'tangent', 'skinIndex', 'skinWeight'

