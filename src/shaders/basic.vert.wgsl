@group(0) @binding(0) var<uniform> projectionMatrix : mat4x4<f32>;
@group(0) @binding(1) var<uniform> viewMatrix : mat4x4<f32>;

@group(1) @binding(0) var<uniform> modelMatrix : mat4x4<f32>;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
  @location(1) fragNormal : vec3<f32>
};

@vertex
fn main(
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>
) -> VertexOutput {
  
  let mvp = projectionMatrix * viewMatrix * modelMatrix;
  let pos = vec4<f32>(position, 1.0);
  
  var output : VertexOutput;
  output.position = mvp * pos;
  output.fragPosition = (modelMatrix * pos).xyz;
  output.fragNormal = (modelMatrix * vec4<f32>(normal, 0.0)).xyz;

  return output;

}

