import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { Definitions } from '../../resource/shaderChunk';

export function vertexShaderFactory(
  slotAttributes: string[],
  bindingAttributes: string[][], 
  pass: ('render' | 'shadow')
) {

  let slotLocations = { }, bindingIndices = { };
  slotAttributes.forEach( (slotAttribute, slotIndex) => 
    slotLocations[slotAttribute] = `@location(${slotIndex})`
  );
  bindingAttributes.forEach(
    (group, groupIndex) => group.forEach(
      (binding, bindingIndex) => bindingIndices[binding] = `@group(${groupIndex}) @binding(${bindingIndex})`
    )
  );

  const tangent = slotLocations['tangent'] && bindingIndices['normalMap'];
  const skinned = slotLocations['skinIndex'] && slotLocations['skinWeight'] && bindingIndices['boneMatrices'];
  const pointLight = bindingIndices['pointLight'];
  const directionalLight = bindingIndices['directionalLight'];

  let code: string;

  if (pass === 'render') { // render pass
    code = wgsl
/* wgsl */`
${Definitions.Camera}
${Definitions.PointLight}
${Definitions.DirectionalLight}
${Definitions.Transform}

${bindingIndices['camera']} var<uniform> camera: Camera;
#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif

${bindingIndices['transform']} var<uniform> transform : Transform;
#if ${skinned}
${bindingIndices['boneMatrices']} var<storage, read> boneMatrices : array<mat4x4<f32>>;
#endif

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) fragPosition: vec3<f32>,
  @location(1) fragNormal: vec3<f32>,
  @location(2) fragUV: vec2<f32>,
  @location(3) shadowPos: vec4<f32>,
#if ${tangent}
  @location(4) tangent: vec3<f32>,
  @location(5) biTangent: vec3<f32>
#endif
};

@vertex
fn main(
  ${slotLocations['position']} position : vec3<f32>,
  ${slotLocations['normal']} normal : vec3<f32>,
  ${slotLocations['uv']} uv : vec2<f32>,
#if ${skinned}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
#if ${tangent}
  ${slotLocations['tangent']} tangent: vec4<f32>
#endif
) -> VertexOutput {
  
  let pos = vec4<f32>(position, 1.0);
  let outNormal = normalize(transform.normalMat * normal);
  
  var output: VertexOutput;
  output.position = camera.projectionMat * camera.viewMat * transform.modelMat * pos;
  output.fragPosition = (transform.modelMat * pos).xyz;
  output.fragNormal = outNormal;
  output.fragUV = uv;
  output.shadowPos = light.viewProjectionMat * transform.modelMat * pos; // 在fragment shader中进行透视除法, 否则插值出错

#if ${tangent}
  let outTangent = normalize(transform.normalMat * tangent.xyz);
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

struct DirectionalLight {
  direction: vec3<f32>,
  color: vec3<f32>,
  viewProjectionMat: mat4x4<f32>
}

struct Transform {
  modelMat: mat4x4<f32>,
  normalMat : mat3x3<f32>
};

#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif
${bindingIndices['transform']} var<uniform> transform: Transform;

@vertex
fn main( 
  ${slotLocations['position']} position : vec3<f32>, 
) -> @builtin(position) vec4<f32> {
  
  let pos = vec4<f32>(position, 1.0);
  return light.viewProjectionMat * transform.modelMat * pos;

}
`
  }
  
  return code;

}