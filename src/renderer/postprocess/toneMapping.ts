import { PostProcess } from './postprocess';
import { ColorManagement } from '../resource/shaderChunk';

const fragmentShader = /* wgsl */`
@group(0) @binding(0) var gbuffer0: texture_2d<f32>;

${ColorManagement.sRGBGammaEncode}
${ColorManagement.ACESToneMapping}

@fragment
fn main(@location(0) @interpolate(linear, center) gbufferCoord: vec2<f32>) -> @location(0) vec4<f32> {
  let coord = vec2<i32>(gbufferCoord);
  let pixelColor = textureLoad(gbuffer0, coord, 0);
  var encodedColor = pixelColor.xyz * 0.0001; // exposure
  encodedColor = ACESToneMapping(encodedColor);
  encodedColor = sRGBGammaEncode(encodedColor);
  return vec4<f32>(encodedColor, pixelColor.w);
}
`;

class ToneMapping extends PostProcess {

  constructor() {

    super();
    this.fragmentShaderCode = fragmentShader;
    this.inputGBuffers = ['GBuffer0'];
    this.outputGBuffers = ['canvas'];

  }

}

export { ToneMapping };