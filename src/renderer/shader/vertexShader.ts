import { wgsl } from '../../3rd-party/wgsl-preprocessor';

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

@vertex
fn main(input: VertexInput) -> VertexOutput {

}

`;
  }
  else if (pass === 'shadow') { // shadow pass
    code = wgsl
/* wgsl */`

@vertex
fn main( 
  ${slotLocations['position']} position : vec3<f32>,
#if ${params.skinning}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
) -> @builtin(position) vec4<f32> {



}

`;
  }

  return code;

}

export type { VertexShaderParam };
export { vertexShaderFactory };