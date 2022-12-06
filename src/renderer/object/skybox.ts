import { device } from '../renderer';
import {
  vertexBufferFactory,
  bindGroupFactory
} from '../base';
import { RenderableObject } from './renderableObject';
import { SkyboxShader } from '../../shader/shaderLib/skybox';


const skyboxFragmentShader = /* wgsl */`
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var envMap: texture_cube<f32>;

@fragment
fn main(
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
) -> @location(0) vec4<f32> {
  return 18000.0 * textureSampleLevel(envMap, linearSampler, fragPosition, 0);
}
`;


class Skybox extends RenderableObject {

  private renderPipeline: GPURenderPipeline;
  private vertexCount: number;
  private vertexBufferAttributes: string[]; // resource name
  private vertexBuffers: { [x: string]: GPUBuffer }; // resource in GPU

  constructor() { super() };

  public initVertexBuffer() {

    const attributes = ['position', 'index'];
    const position = new Float32Array([
      -1.0,  1.0, -1.0,
      -1.0,  1.0,  1.0,
       1.0,  1.0,  1.0,
       1.0,  1.0, -1.0,
  
      -1.0, -1.0, -1.0,
      -1.0, -1.0,  1.0,
       1.0, -1.0,  1.0,
       1.0, -1.0, -1.0
    ]);
    const index = new Uint16Array([
      3, 6, 7,   3, 2, 6, // +x
      0, 5, 1,   0, 4, 5, // -x
      0, 1, 2,   0, 2, 3, // +y
      4, 6, 5,   4, 7, 6, // -y
      1, 5, 6,   1, 6, 2, // +z
      0, 7, 4,   0, 3, 7  // -z
    ]);

    this.renderPipeline = undefined;
    this.vertexCount = 36;
    this.vertexBufferAttributes = attributes;
    this.vertexBuffers = vertexBufferFactory.createResource(attributes, { position, index });

  }

  public async initGroupResource() { }

  public async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    targetStates: Iterable<GPUColorTargetState | null>,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    const vertexBufferLayout = vertexBufferFactory.createLayout(this.vertexBufferAttributes);
    const { layout, group } = bindGroupFactory.create(
      ['camera', 'linearSampler', 'envMap'],
      globalResource
    );
    
    this.renderPipeline = await device.createRenderPipelineAsync({
      label: 'Skybox Render Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: {
        module: device.createShaderModule({ code: SkyboxShader.Vertex }),
        entryPoint: 'main',
        buffers: vertexBufferLayout
      },
      fragment: {
        module: device.createShaderModule({ code: SkyboxShader.Fragment }),
        entryPoint: 'main',
        targets: targetStates
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'front' // 天空盒使用正面剔除
      }, 
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'greater-equal', // 深度比较改为 less-equal
        format: 'depth32float'
      }
    });
    
    bundleEncoder.setPipeline(this.renderPipeline);
    bundleEncoder.setIndexBuffer(this.vertexBuffers.index, 'uint16');
    bundleEncoder.setVertexBuffer(0, this.vertexBuffers.position);
    bundleEncoder.setBindGroup(0, group);
    bundleEncoder.drawIndexed(this.vertexCount);

  }

  public async setShadowBundle() { }
  
  public update() {  };

}

export { Skybox };