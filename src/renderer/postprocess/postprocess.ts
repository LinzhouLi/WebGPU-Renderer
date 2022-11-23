import { device, canvasSize } from '../renderer';
import { bindGroupFactory } from '../base';
import { GBUfferResource } from '../gbufferResource';

const vertexShader = /* wgsl */`
override screenWidth: f32;
override screenHeight: f32;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(linear, center) gbufferCoord: vec2<f32>
};

const coords = array<vec2<f32>, 6>(
  vec2<f32>(-1.0, -1.0), vec2<f32>( 1.0, -1.0),
  vec2<f32>(-1.0,  1.0), vec2<f32>(-1.0,  1.0),
  vec2<f32>( 1.0, -1.0), vec2<f32>( 1.0,  1.0)
);

@vertex
fn main(@builtin(vertex_index) index: u32) -> VertexOutput {
  let coord = coords[index];
  var output: VertexOutput;
  output.position = vec4<f32>(coord, 0.0, 1.0);
  output.gbufferCoord = (coord + 1.0) * vec2<f32>(screenWidth, screenHeight) * 0.5;
  return output
}
`;

class PostProcess {

  public inputGBuffers: string[];
  public outputGBuffers: string[];

  protected vertexShaderCode: string;
  protected fragmentShaderCode: string;

  protected pipeline: GPURenderPipeline;
  protected bundle: GPURenderBundle;

  constructor() {

    this.vertexShaderCode = vertexShader;

  }

  public execute (
    commandEncoder: GPUCommandEncoder,
    gbufferViews: Record<string, GPUTextureView>
  ) {

    const targetAttachments = this.outputGBuffers.map(attribute => {
      return {
        view: gbufferViews[attribute],
        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      } as GPURenderPassColorAttachment
    })

    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: targetAttachments
    });

    renderPassEncoder.executeBundles([this.bundle]);
    renderPassEncoder.end();

  }

  protected setBindGroup(
    globalResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>,
    gbufferResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>
  ) {
    return bindGroupFactory.create( this.inputGBuffers, gbufferResource );
  }

  public async setRenderBundle(
    globalResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>,
    gbufferResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>
  ) {

    const targetFormats = this.outputGBuffers.map(
      attribute => GBUfferResource.Formats[attribute] as GPUTextureFormat
    );
    const targetStates = targetFormats.map(targetFormat => { 
      return { format: targetFormat } as GPUColorTargetState
    });

    const bundleEncoder = device.createRenderBundleEncoder({ colorFormats: targetFormats });

    // bind group (GBuffer)
    const { layout, group } = this.setBindGroup(globalResource, gbufferResource);
    
    this.pipeline = await device.createRenderPipelineAsync({
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
        entryPoint: 'main'
      },
      fragment: {
        module: device.createShaderModule({ code: this.fragmentShaderCode }),
        entryPoint: 'main',
        targets: targetStates
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      }
    });
    
    bundleEncoder.setPipeline(this.pipeline);
    bundleEncoder.setBindGroup(0, group);
    bundleEncoder.draw(6);

    this.bundle = bundleEncoder.finish();
    
  }

  public update(gbufferResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>) {

  }

}

export { PostProcess };