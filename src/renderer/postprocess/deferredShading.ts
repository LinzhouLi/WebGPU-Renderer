import { PostProcess } from './postprocess';
import { DecodeGBuffer, ColorManagement } from '../shader/shaderChunk';

const fragmentShader = /* wgsl */`

${ColorManagement.sRGB_EOTF}
${ColorManagement.sRGB_OETF}
${DecodeGBuffer.A}
${DecodeGBuffer.B}
${DecodeGBuffer.C}

@group(0) @binding(0) var GBufferA: texture_2d<f32>;
@group(0) @binding(1) var GBufferB: texture_2d<f32>;
@group(0) @binding(2) var GBufferC: texture_2d<f32>;
@group(0) @binding(3) var GBufferDepth: texture_depth_2d;

@fragment
fn main(
  @location(0) @interpolate(linear, center) screenCoord: vec2<f32>,
  @location(1) @interpolate(linear, center) gbufferCoord: vec2<f32>
) -> @location(0) vec4<f32> {

  let coord = vec2<i32>(gbufferCoord);
  let GBufferValueA = DecodeGBufferA(coord);
  let GBufferValueB = DecodeGBufferB(coord);
  let GBufferValueC = DecodeGBufferC(coord);

  let normalWorld = GBufferValueA.xyz;
  let metalness = GBufferValueB.x;
  let specular = GBufferValueB.y;
  let roughness = GBufferValueB.z;
  let baseColor = GBufferValueC.xyz;
  let depthCamera = textureLoad(GBufferDepth, coord, 0);

  return vec4<f32>(sRGBGammaEncode(baseColor), 1.0);
}
`;

class DeferredShading extends PostProcess {

  constructor() {

    super();
    this.fragmentShaderCode = fragmentShader;
    this.inputGBuffers = ['GBufferA', 'GBufferB', 'GBufferC', 'GBufferDepth'];
    this.outputGBuffers = ['canvas'];

  }

}

export { DeferredShading };