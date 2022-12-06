import { wgsl } from '../../3rd-party/wgsl-preprocessor';
import { DataStructure } from '../shaderChunk';
import { getSlotLocations, getBindingIndices } from './shaderProgramTool';

interface ShaderParam {
  skinning: boolean;
  instancing: boolean;
}

function ShadowPassShader(
  slotAttributes: string[],
  bindingAttributes: string[][]
) {

  const slotLocations = getSlotLocations(slotAttributes);
  const bindingIndices = getBindingIndices(bindingAttributes);
  const params: ShaderParam = {
    skinning: false, // todo
    instancing: false // todo
  }

  let code = wgsl
  /* wgsl */`

${bindingIndices['shadowMat']} var<uniform> shadowMat: mat4x4<f32>;

${DataStructure.Transform}
${bindingIndices['transform']} var<uniform> transform: Transform;

@vertex
fn main( 
  ${slotLocations['position']} position : vec3<f32>,
#if ${params.skinning}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
) -> @builtin(position) vec4<f32> {

  let positionObject = vec4<f32>(position, 1.0);
  return shadowMat * transform.modelMat * positionObject;

}

  `;
  return code;

}

export { ShadowPassShader };