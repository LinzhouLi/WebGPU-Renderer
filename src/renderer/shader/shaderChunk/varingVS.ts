import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { VertexShaderParam } from '../vertexShader';

function VaryingVS(
  params: VertexShaderParam,
  slotLocations: Record<string, string>
) {

  return wgsl
/* wgsl */`

struct InputVS {
  ${slotLocations['position']} position : vec3<f32>,
  ${slotLocations['normal']} normal : vec3<f32>,
  ${slotLocations['uv']} uv : vec2<f32>,
#if ${params.skinning}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
#if ${params.tangent}
  ${slotLocations['tangent']} tangent: vec4<f32>
#endif
};

struct OutputVS {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(perspective, center) vNormal: vec3<f32>,
  @location(1) @interpolate(perspective, center) vUv: vec2<f32>,
#if ${params.tangent}
  @location(2) @interpolate(perspective, center) vTangent: vec3<f32>,
  @location(3) @interpolate(perspective, center) vBiTangent: vec3<f32>
#endif
};

`;

}

export { VaryingVS };