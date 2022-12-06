import { wgsl } from '../../3rd-party/wgsl-preprocessor';
import { FragmentShaderParam } from '../shaderLib/geometryPass';

function NormalMapPars(
  params: FragmentShaderParam,
  bindingIndices: Record<string, string>
) {
  return wgsl
  /* wgsl */`

#if ${params.normalMap}
${bindingIndices['normalMap']} var normalMap: texture_2d<f32>;
#endif

  `;
}

function NormalMap(params: FragmentShaderParam) {
  return wgsl
  /* wgsl */`

#if ${params.normalMap}
  let TBN = mat3x3<f32>(normalize(input.vTangent), normalize(input.vBiTangent), normalize(input.vNormal));
  let mapNormal = 2.0 * textureSample(normalMap, linearSampler, input.vUv).xyz - 1.0;
  let normal = TBN * mapNormal;
#else
  let normal = normalize(input.vNormal);
#endif

  `;
}

export { NormalMapPars, NormalMap };