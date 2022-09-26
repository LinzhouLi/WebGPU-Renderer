import * as THREE from 'three';
import { canvasFormat, device } from './renderer';
import type { TypedArray } from './base';
import {
  vertexBufferFactory,
  resourceFactory,
  bindGroupFactory
} from './base';
import { createVertexShader } from './vertexShader';
import { createFragmentShader } from './fragmentShader';


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
      'viewMatCamera', 'projectionMatCamera', 'cameraPosition',
      'viewProjectionMatLight', 'lightPosition', 'shadowMapSampler', 'shadowMap',
      'textureSampler', 'skyboxMap'
    ];

    this.bindGroupData = {
      viewMatCamera: new Float32Array(
        this.camera.matrixWorldInverse.toArray()
      ),
      projectionMatCamera: new Float32Array(
        this.camera.projectionMatrix.toArray()
      ),
      cameraPosition: new Float32Array(
        this.camera.position.toArray()
      ),
      viewProjectionMatLight: new Float32Array(
        this.light.shadow.camera.projectionMatrix.multiply(this.light.shadow.camera.matrixWorldInverse).toArray()
      ),
      lightPosition: new Float32Array(
        this.light.position.toArray()
      ),
      skyboxMap: (this.scene.background as THREE.CubeTexture).source.data
    }

    this.bindGroupResources = await resourceFactory.createResource(this.bindGroupAttributes, this.bindGroupData);

  }

  createRenderBindGroup() {

    return bindGroupFactory.create(
      [
        'viewMatCamera', 'projectionMatCamera', 'cameraPosition',
        'viewProjectionMatLight', 'lightPosition', 'shadowMapSampler', 'shadowMap'
      ],
      this.bindGroupResources
    );

  }

  createShadowBindGroup() {

    return bindGroupFactory.create(
      [ 'viewProjectionMatLight' ],
      this.bindGroupResources
    );

  }

  async setRenderBundle(bundleEncoder: GPURenderBundleEncoder) {

    const vertexBufferLayout = vertexBufferFactory.createLayout(this.skybox.vertexBufferAttributes);
    const { layout, group } = bindGroupFactory.create(
      ['viewMatCamera', 'projectionMatCamera', 'textureSampler', 'skyboxMap'],
      this.bindGroupResources
    );

    this.skybox.renderPipeline = await device.createRenderPipelineAsync({
      label: 'Skybox Render Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
      vertex: {
        module: device.createShaderModule({ code: createVertexShader([], 'skybox') }),
        entryPoint: 'main',
        buffers: vertexBufferLayout
      },
      fragment: {
        module: device.createShaderModule({ code: createFragmentShader([], 'skybox') }),
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

    // view matrix from camera
    (this.bindGroupData.viewMatCamera as TypedArray).set(
      this.camera.matrixWorldInverse.toArray()
    );
    device.queue.writeBuffer(
      this.bindGroupResources.viewMatCamera as GPUBuffer,
      0, this.bindGroupData.viewMatCamera as TypedArray
    );

    // camera position
    (this.bindGroupData.cameraPosition as TypedArray).set(
      this.camera.position.toArray()
    );
    device.queue.writeBuffer(
      this.bindGroupResources.cameraPosition as GPUBuffer,
      0, this.bindGroupData.cameraPosition as TypedArray
    );

  }

}

export { GlobalObject }