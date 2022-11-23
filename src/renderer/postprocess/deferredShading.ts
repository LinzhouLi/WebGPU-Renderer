import { PostProcess } from './postprocess';

const fragmentShader = /* wgsl */`
@group(0) @binding(0) var gbuffer0: texture_2d<f32>;

@fragment
fn main(@location(0) @interpolate(linear, center) gbufferCoord: vec2<f32>) -> @location(0) vec4<f32> {
  let coord = vec2<i32>(gbufferCoord);
  return textureLoad(gbuffer0, coord, 0);
}
`;

class DeferredShading extends PostProcess {

  constructor() {

    super();
    this.fragmentShaderCode = fragmentShader;
    this.inputGBuffers = ['GBuffer0'];
    this.outputGBuffers = ['canvas'];

  }

}

export { DeferredShading };