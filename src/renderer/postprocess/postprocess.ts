import { device, canvasSize, canvasFormat } from '../renderer';
import { resourceFactory, bindGroupFactory } from '../base';
import type { ResourceType, BufferData, TextureData, TextureArrayData } from '../resource/resuorce';
import { ResourceFactory } from '../resource/resuorce';

const vertexShader = /* wgsl */`
override screenWidth: f32;
override screenHeight: f32;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(linear, center) gbufferCoord: vec2<f32>
};

@vertex
fn main(@location(0) coord: vec2<f32>) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4<f32>(coord, 0.0, 1.0);
  output.gbufferCoord = (coord + 1.0) * vec2<f32>(screenWidth, screenHeight) * 0.5;
  return output
}
`;

const fragmentShader = /* wgsl */`
@group(0) @binding(0) var gbuffer0: texture_2d<f32>;

@fragment
fn main(@location(0) @interpolate(linear, center) gbufferCoord: vec2<f32>) -> @location(0) vec4<f32> {
  let coord = vec2<i32>(gbufferCoord);
  return textureLoad(gbuffer0, coord, 0);
}
`;

class PostProcess {

  protected 
  protected vertexShaderCode: string;
  protected fragmentShaderCode: string;

  protected renderPipeline: GPURenderPipeline;
  protected vertexPositionBuffer: GPUBuffer;

  constructor() {

    this.vertexShaderCode = vertexShader;

  }

  public async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>,
    gbufferResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>
  ) {

    // bind group (GBuffer)
    const { layout, group } = bindGroupFactory.create(
      ['GBuffer0'],
      gbufferResource
    );
    
    
    this.renderPipeline = await device.createRenderPipelineAsync({
      label: 'Render Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [layout]
      }),
      vertex: {
        module: device.createShaderModule({ code: this.vertexShaderCode }),
        constants: {
          screenWidth: canvasSize.width,
          screenHeight: canvasSize.height
        },
        entryPoint: 'main',
        buffers: [{
          arrayStride: 2 * 4,
          attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
        }]
      },
      fragment: {
        module: device.createShaderModule({ code: this.fragmentShaderCode }),
        entryPoint: 'main',
        targets: [{ format: canvasFormat }]
      },
      primitive: {
        topology: 'triangle-strip',
        cullMode: 'none'
      }
    });
    
    bundleEncoder.setPipeline(this.renderPipeline);
    bundleEncoder.setVertexBuffer(0, gbufferResource.postProcessVertexBuffer as GPUBuffer);
    bundleEncoder.setBindGroup(0, group);
    bundleEncoder.draw(6);
    
  }

}

export { PostProcess };