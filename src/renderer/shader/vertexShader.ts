import { wgsl } from '../../3rd-party/wgsl-preprocessor';
import { DataStructure, VaryingVS } from './shaderChunk';

interface VertexShaderParam {
  tangent: boolean;
  skinning: boolean;
}

function vertexShaderFactory(
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

  const params: VertexShaderParam = {
    tangent: !!slotLocations['tangent'] && !!bindingIndices['normalMap'],
    skinning: !!slotLocations['skinIndex'] && !!slotLocations['skinWeight'] && !!bindingIndices['boneMatrices']
  };

  let code: string;

  if (pass === 'render') { // render pass
    code = wgsl
/* wgsl */`

${DataStructure.Camera}
${DataStructure.Transform}
${VaryingVS}

${bindingIndices['camera']} var<uniform> camera: Camera;
${bindingIndices['transform']} var<uniform> transform : Transform;

@vertex
fn main(input: VSInput) -> VSOutput {

  // object space
  let positionObject = vec4<f32>(input.position, 1.0);
  let normalObject = input.normal;
#if ${params.tangent}
  let tangentObject = input.tangent.xyz;
#endif

  // world space
  let normalWorld = transform.normalMat * normalObject;
#if ${params.tangent}
  let tangentWorld = transform.normalMat * tangentObject;
  let biTangentWorld = cross(normalWorld, tangentWorld) * tangent.w;
#endif

  // camera space

  // screen space
  let positionScreen = camera.projectionMat * transform.modelViewMat * positionObject;

  // output
  return OutputVS(
    positionScreen, normalWorld, input.uv,
#if ${params.tangent}
    tangentWorld, biTangentWorld
#endif
  );

}

`;
  }
  else if (pass === 'shadow') { // shadow pass
    code = wgsl
/* wgsl */`

${bindingIndices['shadowMat']} var<uniform> shadowMat: mat4x4<f32>;
${bindingIndices['transform']} var<uniform> transform: Transform;

@vertex
fn main( 
  ${slotLocations['position']} position : vec3<f32>,
#if ${params.skinning}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
) -> @builtin(position) vec4<f32> {

  let positionObject = vec4<f32>(input.position, 1.0);
  return shadowMat * transform.modelMat * positionObject;

}

`;
  }

  return code;

}

export type { VertexShaderParam };
export { vertexShaderFactory };