import { wgsl } from '../../../../3rd-party/wgsl-preprocessor';
import { VertexShaderParam } from '../../shaderLib/geometryPass';

function ScreenSpace(params: VertexShaderParam) {
  return wgsl
  /* wgsl */`

  let positionScreen = camera.projectionMat * camera.viewMat * transform.modelMat * positionObject;

  `;
}

export { ScreenSpace }