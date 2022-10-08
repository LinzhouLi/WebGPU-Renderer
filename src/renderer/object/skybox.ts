import { canvasFormat, device } from '../renderer';
import type { TypedArray } from '../base';
import {
  vertexBufferFactory,
  bindGroupFactory
} from '../base';
import { RenderableObject } from './RenderableObject';


// skybox shader code
const skyboxVertexShader = /* wgsl */`
struct Camera {
  position: vec3<f32>,
  viewMat: mat4x4<f32>,
  projectionMat: mat4x4<f32>
};

@group(0) @binding(0) var<uniform> camera: Camera;

struct VertexOutput {
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
};

@vertex
fn main( @location(0) position : vec3<f32>, ) -> VertexOutput {
  let posView = camera.viewMat * vec4<f32>(position, 0.0);
  let posProj = camera.projectionMat * vec4<f32>(posView.xyz, 1.0);
  var output: VertexOutput;
  output.fragPosition = position;
  output.position = vec4<f32>(posProj.xy, posProj.w - 1e-6, posProj.w); // 深度添加bias, 否则显示不出来
  return output;
}
`;


const skyboxFragmentShader = /* wgsl */`
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var skyboxMap: texture_cube<f32>;

@fragment
fn main(
  @builtin(position) position : vec4<f32>,
  @location(0) fragPosition : vec3<f32>,
) -> @location(0) vec4<f32> {
  return textureSample(skyboxMap, texSampler, fragPosition);
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
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    const vertexBufferLayout = vertexBufferFactory.createLayout(this.vertexBufferAttributes);
    const { layout, group } = bindGroupFactory.create(
      ['camera', 'textureSampler', 'skyboxMap'],
      globalResource
    );

    this.renderPipeline = await device.createRenderPipelineAsync({
      label: 'Skybox Render Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: {
        module: device.createShaderModule({ code: skyboxVertexShader }),
        entryPoint: 'main',
        buffers: vertexBufferLayout
      },
      fragment: {
        module: device.createShaderModule({ code: skyboxFragmentShader }),
        entryPoint: 'main',
        targets: [{ format: canvasFormat }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'front' // 天空盒使用正面剔除
      }, 
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
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