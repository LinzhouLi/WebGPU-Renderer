import { wgsl } from '../../3rd-party/wgsl-preprocessor';
import { DataStructure, VaryingFS, EncodeGBuffer, ColorManagement } from './shaderChunk';

interface FragmentShaderParam {
  baseMap: boolean;
  normalMap: boolean;
  metalnessMap: boolean;
  specularMap: boolean;
  roughnessMap: boolean;
}

function fragmentShaderFactory(
  slotAttributes: string[],
  bindingAttributes: string[][], 
  type: ('phong' | 'PBR') = 'PBR'
) {

  let bindingIndices = { };
  bindingAttributes.forEach(
    (group, groupIndex) => group.forEach(
      (binding, bindingIndex) => bindingIndices[binding] = `@group(${groupIndex}) @binding(${bindingIndex})`
    )
  );

  const params: FragmentShaderParam = {
    baseMap: !!bindingIndices['baseMap'],
    normalMap: slotAttributes.includes('tangent') && !!bindingIndices['normalMap'],
    metalnessMap: !!bindingIndices['metalnessMap'],
    specularMap: !!bindingIndices['specularMap'],
    roughnessMap: !!bindingIndices['roughnessMap']
  }

  let code: string;

  code = wgsl
/* wgsl */`

${VaryingFS(params)}

${ColorManagement.sRGB_OETF}
${EncodeGBuffer.A}
${EncodeGBuffer.B}
${EncodeGBuffer.C}

#if ${params.normalMap}
${bindingIndices['normalMap']} var normalMap: texture_2d<f32>;
#endif
#if ${params.baseMap}
${bindingIndices['baseMap']} var baseMap: texture_2d<f32>;
#endif
#if ${params.metalnessMap}
${bindingIndices['metalnessMap']} var metalnessMap: texture_2d<f32>;
#endif
#if ${params.specularMap}
${bindingIndices['specularMap']} var specularMap: texture_2d<f32>;
#endif
#if ${params.roughnessMap}
${bindingIndices['roughnessMap']} var roughnessMap: texture_2d<f32>;
#endif

${DataStructure.Material}
${bindingIndices['material']} var<uniform> material: Material;
${bindingIndices['linearSampler']} var linearSampler: sampler;

@fragment
fn main(input: InputFS) -> OutputFS {

  // normal
#if ${params.normalMap}
  let TBN = mat3x3<f32>(normalize(input.vTangent), normalize(input.vBiTangent), normalize(input.vNormal));
  let mapNormal = 2.0 * textureSample(normalMap, linearSampler, input.vUv).xyz - 1.0;
  let normal = TBN * mapNormal;
#else
  let normal = normalize(input.vNormal);
#endif

  // base color
#if ${params.baseMap}
  let baseColor = textureSample(baseMap, linearSampler, input.vUv).xyz;
#else
  let baseColor = material.baseColor;
#endif

  // metalness
#if ${params.metalnessMap}
  let metalness = textureSample(metalnessMap, linearSampler, input.vUv).x;
#else
  let metalness = material.metalness;
#endif

  // specular
#if ${params.specularMap}
  let specular = textureSample(specularMap, linearSampler, input.vUv).x;
#else
  let specular = material.specular;
#endif

  // roughness
#if ${params.roughnessMap}
  let roughness = textureSample(roughnessMap, linearSampler, input.vUv).x;
#else
  let roughness = material.roughness;
#endif

  let gbufferA = EncodeGBufferA(normal);
  let gbufferB = EncodeGBufferB(metalness, specular, roughness);
  let gbufferC = EncodeGBufferC(baseColor);

  return OutputFS(gbufferA, gbufferB, gbufferC);

}

`;

  return code;

}

export type { FragmentShaderParam };
export { fragmentShaderFactory };