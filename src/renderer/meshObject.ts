import * as THREE from 'three';
import { device, canvasFormat } from './renderer';
import type { TypedArray } from './base';
import {
  vertexBufferFactory,
  resourceFactory,
  bindGroupFactory
} from './base';
import { createVertexShader } from './vertexShader';
import { createFragmentShader } from './fragmentShader';


class MeshObject {

  mesh: THREE.Mesh;

  renderPipeline: GPURenderPipeline;
  shadowPipeline: GPURenderPipeline;

  vertexCount: number;
  vertexBufferAttributes: string[]; // resource name
  vertexBufferData: { [x: string]: TypedArray }; // resource in CPU
  vertexBuffers: { [x: string]: GPUBuffer }; // resource in GPU

  resourceAttributes: string[]; // resource name
  resourceData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }; // resource in CPU
  resources: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  constructor(mesh: THREE.Mesh) {

    this.mesh = mesh;
    
  }

  initVertexBuffer() {

    this.vertexBufferAttributes = ['position', 'normal', 'uv'];
    this.vertexBufferData = {
      position: this.mesh.geometry.attributes.position.array as TypedArray,
      normal: this.mesh.geometry.attributes.normal.array as TypedArray,
      uv: this.mesh.geometry.attributes.uv.array as TypedArray,
    };

    if (!!this.mesh.geometry.index) {
      this.vertexBufferAttributes.push('index');
      this.vertexBufferData.index = this.mesh.geometry.index.array as TypedArray;
      this.vertexCount = this.mesh.geometry.index.count;
    }
    else {
      this.vertexCount = this.mesh.geometry.attributes.position.count;
    }

    this.vertexBuffers = vertexBufferFactory.createResource(this.vertexBufferAttributes, this.vertexBufferData);

  }

  async initGroupResource() {

    const material = this.mesh.material as THREE.MeshStandardMaterial;

    this.resourceAttributes = ['modelMat', 'normalMat', 'color', 'textureSampler'];
    this.resourceData = {
      modelMat: new Float32Array( 
        this.mesh.matrixWorld.toArray() 
      ),
      normalMat: new Float32Array( 
        new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld).toArray() 
      ),
      color: new Float32Array( 
        (material.color || new THREE.Color(1, 1, 1)).toArray()
      )
    }

    if (!!material.map) {
      this.resourceAttributes.push('baseMap');
      this.resourceData.baseMap = material.map.source.data;
    }

    this.resources = await resourceFactory.createResource(this.resourceAttributes, this.resourceData);

  }

  async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalGroupLayouts: GPUBindGroupLayout[],
    globalGroups: GPUBindGroup[]
  ) {
    
    const vertexLayout = vertexBufferFactory.createLayout(this.vertexBufferAttributes);
    const { layout, group } = bindGroupFactory.create(this.resourceAttributes, this.resources);
    
    this.renderPipeline = await device.createRenderPipelineAsync({
      label: 'Render Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [...globalGroupLayouts, layout] 
      }),
      vertex: {
        module: device.createShaderModule({ code: 
          createVertexShader([...this.vertexBufferAttributes, ...this.resourceAttributes], 'render')
        }),
        entryPoint: 'main',
        buffers: vertexLayout
      },
      fragment: {
        module: device.createShaderModule({ code: 
          createFragmentShader([...this.vertexBufferAttributes, ...this.resourceAttributes], 'phong')
        }),
        entryPoint: 'main',
        targets: [{
          format: canvasFormat
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      }, 
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
      }
    });
    
    bundleEncoder.setPipeline(this.renderPipeline);

    // set vertex and index buffers
    let loction = 0;
    let indexed = false;
    for (const attribute of this.vertexBufferAttributes) {
      if (attribute === 'index') {
        bundleEncoder.setIndexBuffer(this.vertexBuffers.index, 'uint16');
        indexed = true;
      }
      else {
        bundleEncoder.setVertexBuffer(loction, this.vertexBuffers[attribute]);
        loction++;
      }
    }

    // set bind groups
    loction = 0;
    for (const globalGroup of globalGroups) { // global group
      bundleEncoder.setBindGroup(loction, globalGroup);
      loction++;
    }
    bundleEncoder.setBindGroup(loction, group); // local group

    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);
    
  }

  async setShadowBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalGroupLayouts: GPUBindGroupLayout[],
    globalGroups: GPUBindGroup[]
  ) {

    let vertexBufferAttributs = ['position'];
    if (this.vertexBufferAttributes.includes('index')) vertexBufferAttributs.push('index');
    let resourceAttributes = ['modelMat'];

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const { layout, group } = bindGroupFactory.create(resourceAttributes, this.resources);
    
    this.shadowPipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [...globalGroupLayouts, layout] 
      }),
      vertex: {
        module: device.createShaderModule({ code: 
          createVertexShader([...this.vertexBufferAttributes, ...this.resourceAttributes], 'shadow')
        }),
        entryPoint: 'main',
        buffers: vertexLayout
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      }, 
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
      }
    });
    
    bundleEncoder.setPipeline(this.shadowPipeline);
    
    // set vertex and index buffers
    let loction = 0;
    let indexed = false;
    for (const attribute of vertexBufferAttributs) {
      if (attribute === 'index') {
        bundleEncoder.setIndexBuffer(this.vertexBuffers.index, 'uint16');
        indexed = true;
      }
      else {
        bundleEncoder.setVertexBuffer(loction, this.vertexBuffers[attribute]);
        loction++;
      }
    }

    // set bind groups
    loction = 0;
    for (const globalGroup of globalGroups) { // global group
      bundleEncoder.setBindGroup(loction, globalGroup);
      loction++;
    }
    bundleEncoder.setBindGroup(loction, group); // local group
    
    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);

  }

  update() {

    // model matrix
    (this.resourceData.modelMat as TypedArray).set(
      this.mesh.matrixWorld.toArray()
    );
    device.queue.writeBuffer( 
      this.resources.modelMat as GPUBuffer,
      0, this.resourceData.modelMat as TypedArray
    );

    // normal matrix
    (this.resourceData.normalMat as TypedArray).set(
      new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld).toArray()
    );
    device.queue.writeBuffer( 
      this.resources.normalMat as GPUBuffer,
      0, this.resourceData.normalMat as TypedArray
    );

  }

}

export { MeshObject };