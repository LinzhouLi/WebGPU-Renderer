import { wgsl } from '../../../../3rd-party/wgsl-preprocessor';
import { VertexShaderParam } from '../../shaderLib/geometryPass';

function WorldSpace(params: VertexShaderParam) {
  return wgsl
  /* wgsl */`

  let normalWorld = transform.normalMat * normalObject;
#if ${params.tangent}
  let tangentWorld = transform.normalMat * tangentObject;
  let biTangentWorld = cross(normalWorld, tangentWorld) * input.tangent.w;
#endif

  `;
}

export { WorldSpace }