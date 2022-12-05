import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { 
  GeometryPassIO, 
  VertexTransformPars, VertexTransform,
  NormalMapPars, NormalMap,
  MaterialPars, MaterialMap,
  ColorManagement, EncodeGBuffer 
} from '../shaderChunk';
import { getSlotLocations, getBindingIndices } from './shaderProgramTool';

// 'Macro Definition' of wgsl shaders
// used to control different situation in constructing shader programs
interface ShaderParam {
  tangent: boolean;
  instancing: boolean;
}

interface VertexShaderParam extends ShaderParam {
  skinning: boolean;
}

interface FragmentShaderParam extends ShaderParam {
  baseMap: boolean;
  normalMap: boolean;
  metalnessMap: boolean;
  specularMap: boolean;
  roughnessMap: boolean;
}


function Vertex(
  slotAttributes: string[],
  bindingAttributes: string[][]
) {

  const slotLocations = getSlotLocations(slotAttributes);
  const bindingIndices = getBindingIndices(bindingAttributes);
  const params: VertexShaderParam = {
    tangent: !!slotLocations['tangent'],
    instancing: false, // todo
    skinning: !!slotLocations['skinIndex'] && !!slotLocations['skinWeight'] && !!bindingIndices['boneMatrices'],
  };

  let code = wgsl
  /* wgsl */`

${VertexTransformPars(params, bindingIndices)}
${GeometryPassIO.VertInput(params, slotLocations)}
${GeometryPassIO.VertOutput(params)}

@vertex
fn main(input: VertInput) -> VertOutput {

  ${VertexTransform.ObjectSpace(params)}
  ${VertexTransform.WorldSpace(params)}
  ${VertexTransform.ScreenSpace(params)}

  return VertOutput(
    positionScreen, 
    normalWorld, 
    input.uv,
#if ${params.tangent}
    tangentWorld, 
    biTangentWorld
#endif
  );

}

  `;
  console.log(code);
  return code;

}


function Fragment(
  slotAttributes: string[],
  bindingAttributes: string[][]
) {

  const bindingIndices = getBindingIndices(bindingAttributes);
  const params: FragmentShaderParam = {
    tangent: slotAttributes.includes('tangent'),
    instancing: false, // todo
    baseMap: !!bindingIndices['baseMap'],
    normalMap: slotAttributes.includes('tangent') && !!bindingIndices['normalMap'],
    metalnessMap: !!bindingIndices['metalnessMap'],
    specularMap: !!bindingIndices['specularMap'],
    roughnessMap: !!bindingIndices['roughnessMap']
  }

  let code = wgsl
  /* wgsl */`

${GeometryPassIO.FragInput(params)}
${GeometryPassIO.FragOutput}

${ColorManagement.sRGB_OETF}
${EncodeGBuffer.A}
${EncodeGBuffer.B}
${EncodeGBuffer.C}

${bindingIndices['linearSampler']} var linearSampler: sampler;
${NormalMapPars(params, bindingIndices)}
${MaterialPars(params, bindingIndices)}

@fragment
fn main(input: FragInput) -> FragOutput {

  ${NormalMap(params)}
  ${MaterialMap(params)}

  let gbufferA = EncodeGBufferA(normal);
  let gbufferB = EncodeGBufferB(metalness, specular, roughness);
  let gbufferC = EncodeGBufferC(baseColor);

  return FragOutput(gbufferA, gbufferB, gbufferC);

}

  `;
  console.log(code);
  return code;

}


const GeometryPassShader = { Vertex, Fragment };

export type { ShaderParam, VertexShaderParam, FragmentShaderParam };
export { GeometryPassShader };