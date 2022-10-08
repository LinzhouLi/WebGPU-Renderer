import * as THREE from 'three';
import { canvasFormat, device } from '../renderer';
import type { TypedArray } from '../base';
import {
  vertexBufferFactory,
  resourceFactory,
  bindGroupFactory
} from '../base';


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



class GlobalObject {

  camera: THREE.PerspectiveCamera;
  light: THREE.PointLight;
  scene: THREE.Scene;

  skybox: {
    renderPipeline: GPURenderPipeline,
    vertexCount: number,
    vertexBufferAttributes: string[], // resource name
    vertexBufferData: { [x: string]: TypedArray }, // resource in CPU
    vertexBuffers: { [x: string]: GPUBuffer } // resource in GPU
  }

  bindGroupAttributes: string[]; // resource name
  bindGroupData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }; // resource in CPU
  bindGroupResources: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  constructor(camera: THREE.PerspectiveCamera, light: THREE.PointLight, scene: THREE.Scene) {

    this.camera = camera;
    this.light = light;
    this.scene = scene;

  }

  initVertexBuffer() { // for skybox

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

    this.skybox = {
      renderPipeline: undefined,
      vertexCount: 36,
      vertexBufferAttributes: attributes,
      vertexBufferData: { position, index },
      vertexBuffers: vertexBufferFactory.createResource(attributes, { position, index })
    };

  }

  async initGroupResource() {

    this.bindGroupAttributes = [
      'camera', 'pointLight', 
      'shadowMapSampler', 'shadowMap',
      'textureSampler', 'skyboxMap'
    ];

    this.bindGroupData = {
      camera: new Float32Array([
        ...this.camera.position.toArray(), 0, // AlignOf(vec3<f32>) in wgsl is 16. see https://gpuweb.github.io/gpuweb/wgsl/#alignment
        ...this.camera.matrixWorldInverse.toArray(),
        ...this.camera.projectionMatrix.toArray()
      ]),
      pointLight : new Float32Array([
        ...this.light.position.toArray(), 0,
        ...this.light.color.toArray(), 0,
        ...this.light.shadow.camera.projectionMatrix.multiply(this.light.shadow.camera.matrixWorldInverse).toArray()
      ]),
      skyboxMap: (this.scene.background as THREE.CubeTexture).source.data
    }

    this.bindGroupResources = await resourceFactory.createResource(this.bindGroupAttributes, this.bindGroupData);
    
  }

  createRenderBindGroup() {
    
    return bindGroupFactory.create(
      [ 'camera', 'pointLight', 'shadowMapSampler', 'shadowMap' ],
      this.bindGroupResources
    );

  }

  createShadowBindGroup() {

    return bindGroupFactory.create(
      [ 'pointLight' ],
      this.bindGroupResources
    );

  }

  async setRenderBundle(bundleEncoder: GPURenderBundleEncoder) { // for skybox

    const vertexBufferLayout = vertexBufferFactory.createLayout(this.skybox.vertexBufferAttributes);
    const { layout, group } = bindGroupFactory.create(
      ['camera', 'textureSampler', 'skyboxMap'],
      this.bindGroupResources
    );

    this.skybox.renderPipeline = await device.createRenderPipelineAsync({
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
    
    bundleEncoder.setPipeline(this.skybox.renderPipeline);
    bundleEncoder.setIndexBuffer(this.skybox.vertexBuffers.index, 'uint16');
    bundleEncoder.setVertexBuffer(0, this.skybox.vertexBuffers.position);
    bundleEncoder.setBindGroup(0, group);
    bundleEncoder.drawIndexed(this.skybox.vertexCount);

  }

  update() {

    // camera (position, view matrix, projection matrix)
    (this.bindGroupData.camera as TypedArray).set([
      ...this.camera.position.toArray(), 0,
      ...this.camera.matrixWorldInverse.toArray(),
      ...this.camera.projectionMatrix.toArray()
    ]);

    device.queue.writeBuffer(
      this.bindGroupResources.camera as GPUBuffer,
      0, this.bindGroupData.camera as TypedArray
    );

  }

}

export { GlobalObject }