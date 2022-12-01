import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { FragmentShaderParam } from '../fragmentShader';

function VaryingFS(
  params: FragmentShaderParam
) {

  return wgsl
/* wgsl */`

struct InputFS {
  @location(0) @interpolate(perspective, center) vNormal: vec3<f32>,
  @location(1) @interpolate(perspective, center) vUv: vec2<f32>,
#if ${params.normalMap}
  @location(2) @interpolate(perspective, center) vTangent: vec3<f32>,
  @location(3) @interpolate(perspective, center) vBiTangent: vec3<f32>
#endif
}

struct OutputFS {
  @location(0) GBufferA: vec4<f32>, // normal
  @location(1) GBufferB: vec4<f32>, // material
  @location(2) GBufferC: vec4<f32>  // base color
}

`;

}

export { VaryingFS };