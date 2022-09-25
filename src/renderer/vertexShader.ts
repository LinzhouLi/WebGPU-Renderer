import { wgsl } from './wgsl-preprocessor.js';

export function createVertexShader(attributes: string[], pass: ('render' | 'shadow') = 'render') {


  let code: string;

  if (pass === 'render') { // render pass
    code = wgsl
/* wgsl */`
@group(0) @binding(0) var<uniform> viewMatCamera: mat4x4<f32>;
@group(0) @binding(1) var<uniform> projectionMatCamera: mat4x4<f32>;
@group(0) @binding(3) var<uniform> viewProjectionMatLight: mat4x4<f32>;

@group(1) @binding(0) var<uniform> modelMat : mat4x4<f32>;
@group(1) @binding(1) var<uniform> normalMat : mat3x3<f32>;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
  @location(1) fragNormal : vec3<f32>,
  @location(2) fragUV: vec2<f32>,
};

@vertex
fn main(
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) uv : vec2<f32>,
) -> VertexOutput {
  
  let pos = vec4<f32>(position, 1.0);
  
  var output : VertexOutput;
  output.position = projectionMatCamera * viewMatCamera * modelMat * pos;
  output.fragPosition = (modelMat * pos).xyz;
  output.fragNormal =( modelMat * vec4<f32>(normal,0.0)).xyz;
  output.fragUV = uv;

  return output;

}
`
  }

  else { // shadow pass
    code = wgsl
/* wgsl */`
@group(0) @binding(0) var<uniform> viewProjectionMatLight: mat4x4<f32>;

@group(1) @binding(0) var<uniform> modelMat : mat4x4<f32>;

@vertex
fn main(
  @location(0) position : vec3<f32>,
) -> @builtin(position) vec4<f32> {
  
  let pos = vec4<f32>(position, 1.0);

  return viewProjectionMatLight * modelMat * pos;

}
`
  }
  // console.log(code);
  return code;

}