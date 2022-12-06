import { device, canvasSize } from '../renderer';
import { bindGroupFactory } from '../base';
import { GBUfferResource } from '../gbufferResource';


// VertOutput.coord.xy range from (0, 0) to (1, 1). Used as uv sampling coord
// VertOutput.coord.zw range from (0, 0) to (screenWidth, screenHeight). Used as texture coord for textureLoad()

const vertexShader = /* wgsl */`
override screenWidth: f32;
override screenHeight: f32;

struct VertOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(linear, center) coord: vec4<f32>,
};

const coords = array<vec2<f32>, 4>(
  vec2<f32>(-1.0, -1.0), // Bottom Left
  vec2<f32>( 1.0, -1.0), // Bottom Right
  vec2<f32>(-1.0,  1.0), // Top Left
  vec2<f32>( 1.0,  1.0)  // Top Right
);

@vertex
fn main(@builtin(vertex_index) index: u32) -> VertOutput {
  let coord = coords[index];
  let position = vec4<f32>(coord, 0.0, 1.0);
  let uv = coord * vec2<f32>(0.5, -0.5) + 0.5; // https://www.w3.org/TR/webgpu/#coordinate-systems
  let gbufferCoord = vec4<f32>(uv, uv * vec2<f32>(screenWidth, screenHeight));
  return VertOutput(
    position, gbufferCoord
  );
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
        topology: 'triangle-strip',
        cullMode: 'none'
      }
    });
    
    bundleEncoder.setPipeline(this.pipeline);
    bundleEncoder.setBindGroup(0, group);
    bundleEncoder.draw(4);

    this.bundle = bundleEncoder.finish();
    
  }

  public update(gbufferResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>) {

  }

}

export { PostProcess };