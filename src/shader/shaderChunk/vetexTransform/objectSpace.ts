import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { VertexShaderParam } from '../../shaderLib/geometryPass';

function ObjectSpace(params: VertexShaderParam) {
  return wgsl
  /* wgsl */`

  let positionObject = vec4<f32>(input.position, 1.0);
  let normalObject = input.normal;
#if ${params.tangent}
  let tangentObject = input.tangent.xyz;
#endif

  `;
}

export { ObjectSpace }