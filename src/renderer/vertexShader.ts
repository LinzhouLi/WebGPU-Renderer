import { wgsl } from './wgsl-preprocessor.js';

export function createVertexShader(attributes: string[], pass: ('render' | 'shadow' | 'skybox') = 'render') {

  const tangent = attributes.includes('tangent') && attributes.includes('normalMap');

  let code: string;

  if (pass === 'render') { // render pass
    code = wgsl
/* wgsl */`
@group(0) @binding(0) var<uniform> viewMatCamera: mat4x4<f32>;
@group(0) @binding(1) var<uniform> projectionMatCamera: mat4x4<f32>;
@group(0) @binding(3) var<uniform> viewProjectionMatLight: mat4x4<f32>;

@group(1) @binding(0) var<uniform> modelMat : mat4x4<f32>;
@group(1) @binding(1) var<uniform> normalMat : mat3x3<f32>; // Binding sizes are too small for bind group [BindGroup] at index 1

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
  @location(1) fragNormal : vec3<f32>,
  @location(2) fragUV: vec2<f32>,
  @location(3) shadowPos: vec4<f32>,
#if ${tangent}
  @location(4) tangent: vec3<f32>,
  @location(5) biTangent: vec3<f32>
#endif
};

@vertex
fn main(
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) uv : vec2<f32>,
#if ${tangent}
  @location(3) tangent: vec4<f32>
#endif
) -> VertexOutput {
  
  let pos = vec4<f32>(position, 1.0);
  let outNormal = (modelMat * vec4<f32>(normal, 0.0)).xyz;
  
  var output: VertexOutput;
  output.position = projectionMatCamera * viewMatCamera * modelMat * pos;
  output.fragPosition = (modelMat * pos).xyz;
  output.fragNormal = outNormal;
  output.fragUV = uv;
  output.shadowPos = viewProjectionMatLight * modelMat * pos; // 在fragment shader中进行透视除法, 否则插值出错

#if ${tangent}
  let outTangent = (modelMat * vec4<f32>(tangent.xyz, 0.0)).xyz;
  output.tangent = outTangent;
  output.biTangent = cross(outNormal, outTangent) * tangent.w;
#endif

  return output;

}
`
  }

  else if (pass === 'shadow') { // shadow pass
    code = wgsl
/* wgsl */`
@group(0) @binding(0) var<uniform> viewProjectionMatLight: mat4x4<f32>;

@group(1) @binding(0) var<uniform> modelMat : mat4x4<f32>;

@vertex
fn main( @location(0) position : vec3<f32>, ) -> @builtin(position) vec4<f32> {
  
  let pos = vec4<f32>(position, 1.0);

  return viewProjectionMatLight * modelMat * pos;

}
`
  }
  else if (pass === 'skybox') { // skybox
    code = wgsl
/* wgsl */`
@group(0) @binding(0) var<uniform> viewMatCamera: mat4x4<f32>;
@group(0) @binding(1) var<uniform> projectionMatCamera: mat4x4<f32>;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
};

@vertex
fn main( @location(0) position : vec3<f32>, ) -> VertexOutput {
  
  let posView = viewMatCamera * vec4<f32>(position, 0.0);
  let posProj = projectionMatCamera * vec4<f32>(posView.xyz, 1.0);

  var output: VertexOutput;
  output.fragPosition = position;
  output.position = vec4<f32>(posProj.xy, posProj.w - 1e-6, posProj.w); // 深度添加bias, 否则显示不出来

  return output;

}
`

  }
  
  return code;

}