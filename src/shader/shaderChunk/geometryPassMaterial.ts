import { wgsl } from '../../3rd-party/wgsl-preprocessor';
import { FragmentShaderParam } from '../shaderLib/geometryPass';
import { DataStructure } from '../shaderChunk';

function MaterialPars(
  params: FragmentShaderParam,
  bindingIndices: Record<string, string>
) {
  return wgsl
  /* wgsl */`

${DataStructure.Material}
${bindingIndices['material']} var<uniform> material: Material;

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

`;
}

function MaterialMap(params: FragmentShaderParam) {
  return wgsl
  /* wgsl */`

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

  `;
}

export { MaterialPars, MaterialMap };