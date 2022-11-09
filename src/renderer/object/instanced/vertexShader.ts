import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { Definitions } from '../../resource/shaderChunk';

export function createVertexShader(attributes: string[], pass: ('render' | 'shadow' | 'skybox') = 'render') {

  const tangent = attributes.includes('tangent') && attributes.includes('normalMapArray');
  const pointLight = attributes.includes('pointLight');

  let code: string;

  if (pass === 'render') { // render pass
    code = wgsl
/* wgsl */`
${Definitions.Camera}
${Definitions.PointLight}
${Definitions.DirectionalLight}
${Definitions.Transform}

@group(0) @binding(0) var<uniform> camera: Camera;
#if ${pointLight}
@group(0) @binding(1) var<uniform> light: PointLight;
#else
@group(0) @binding(1) var<uniform> light: DirectionalLight;
#endif

@group(1) @binding(0) var<storage, read> transforms: array<Transform>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) fragPosition: vec3<f32>,
  @location(1) fragNormal: vec3<f32>,
  @location(2) fragUV: vec2<f32>,
  @location(3) shadowPos: vec4<f32>,
  @location(4) @interpolate(flat) index: u32,
#if ${tangent}
  @location(5) tangent: vec3<f32>,
  @location(6) biTangent: vec3<f32>
#endif
};

@vertex
fn main(
  @builtin(instance_index) index: u32,
  @location(0) position : vec3<f32>,
  @location(1) normal : vec3<f32>,
  @location(2) uv : vec2<f32>,
#if ${tangent}
  @location(3) tangent: vec4<f32>
#endif
) -> VertexOutput {
  
  let pos = vec4<f32>(position, 1.0);
  let transform = transforms[index];
  let outNormal = transform.normalMat * normal;
  
  var output: VertexOutput;
  output.position = camera.projectionMat * camera.viewMat * transform.modelMat * pos;
  output.fragPosition = (transform.modelMat * pos).xyz;
  output.fragNormal = outNormal;
  output.fragUV = uv;
  output.shadowPos = light.viewProjectionMat * transform.modelMat * pos; // 在fragment shader中进行透视除法, 否则插值出错
  output.index = index;

#if ${tangent}
  let outTangent = transform.normalMat * tangent.xyz;
  output.tangent = outTangent;
  output.biTangent = cross(outNormal, outTangent) * tangent.w; // tangent.w indicates the direction of biTangent
#endif

  return output;

}
`
  }

  else if (pass === 'shadow') { // shadow pass
    code = wgsl
/* wgsl */`
struct PointLight {
  position: vec3<f32>,
  color: vec3<f32>,
  viewProjectionMat: mat4x4<f32>
};

struct Transform {
  modelMat: mat4x4<f32>,
  normalMat : mat3x3<f32>
};

@group(0) @binding(0) var<uniform> pointLight: PointLight;
@group(0) @binding(1) var<storage> transforms: array<Transform>;

@vertex
fn main(
  @builtin(instance_index) index: u32,
  @location(0) position: vec3<f32> 
) -> @builtin(position) vec4<f32> {
  
  let pos = vec4<f32>(position, 1.0);
  return pointLight.viewProjectionMat * transforms[index].modelMat * pos;

}
`
  }
  
  return code;

}