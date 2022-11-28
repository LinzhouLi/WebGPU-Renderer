import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { VertexShaderParam } from '../vertexShader';

export function VertexShaderInOut(
  params: VertexShaderParam,
  slotLocations: Record<string, string>
) {

  return wgsl
/* wgsl */`

struct VertexInput {
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

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(perspective, center) vPosition: vec3<f32>,
  @location(1) @interpolate(perspective, center) vNormal: vec3<f32>,
  @location(2) @interpolate(perspective, center) uv: vec2<f32>,
  @location(3) @interpolate(perspective, center) vShadowPos: vec4<f32>,
#if ${params.tangent}
  @location(4) @interpolate(perspective, center) vTangent: vec3<f32>,
  @location(5) @interpolate(perspective, center) vBiTangent: vec3<f32>
#endif
};

`;

}