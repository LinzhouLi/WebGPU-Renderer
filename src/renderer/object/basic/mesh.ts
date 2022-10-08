import * as THREE from 'three';
import { device, canvasFormat } from '../../renderer';
import type { TypedArray } from '../../base';
import {
  vertexBufferFactory,
  resourceFactory,
  bindGroupFactory
} from '../../base';
import { RenderableObject } from '../renderableObject';
import { createVertexShader } from './vertexShader';
import { createFragmentShader } from './fragmentShader';


class Mesh extends RenderableObject {

  private mesh: THREE.Mesh;

  private renderPipeline: GPURenderPipeline;
  private shadowPipeline: GPURenderPipeline;

  private vertexCount: number;
  private vertexBufferAttributes: string[]; // resource name
  private vertexBufferData: { [x: string]: TypedArray }; // resource in CPU
  private vertexBuffers: { [x: string]: GPUBuffer }; // resource in GPU

  private resourceAttributes: string[]; // resource name
  private resourceCPUData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }; // resource in CPU
  private resource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  constructor(mesh: THREE.Mesh) {

    super();
    this.mesh = mesh;
    
  }

  public initVertexBuffer() {

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

    if (!!this.mesh.geometry.attributes.tangent) {
      this.vertexBufferAttributes.push('tangent');
      this.vertexBufferData.tangent = this.mesh.geometry.attributes.tangent.array as TypedArray;
    }

    this.vertexBuffers = vertexBufferFactory.createResource(this.vertexBufferAttributes, this.vertexBufferData);

  }

  public async initGroupResource() {

    const material = this.mesh.material as THREE.MeshStandardMaterial;

    let normalMat = new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld).toArray();

    this.resourceAttributes = ['transform', 'color'];
    this.resourceCPUData = {
      transform: new Float32Array([
        ...this.mesh.matrixWorld.toArray(),
        ...normalMat.slice(0, 3), 0,          // AlignOf(mat3x3<f32>) in wgsl is 16.
        ...normalMat.slice(3, 6), 0,          // see https://gpuweb.github.io/gpuweb/wgsl/#alignment
        ...normalMat.slice(6, 9), 0
      ]),
      color: new Float32Array( 
        (material.color || new THREE.Color(1, 1, 1)).toArray()
      )
    };

    if (!!material.map) {
      this.resourceAttributes.push('baseMap');
      this.resourceCPUData.baseMap = material.map.source.data;
    }

    if (!!material.normalMap) {
      this.resourceAttributes.push('normalMap');
      this.resourceCPUData.normalMap = material.normalMap.source.data;
    }

    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);

  }

  public async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {
    
    const vertexLayout = vertexBufferFactory.createLayout(this.vertexBufferAttributes);
    const { layout, group } = bindGroupFactory.create(
      [ 'camera', 'pointLight', 'shadowMapSampler', 'textureSampler', 'shadowMap', ...this.resourceAttributes ],
      { ...globalResource, ...this.resource }
    );
    
    this.renderPipeline = await device.createRenderPipelineAsync({
      label: 'Render Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [layout]
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
        targets: [{ format: canvasFormat }]
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

    // set bind group
    bundleEncoder.setBindGroup(0, group);

    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);
    
  }

  public async setShadowBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    let vertexBufferAttributs = ['position'];
    if (this.vertexBufferAttributes.includes('index')) vertexBufferAttributs.push('index');

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const { layout, group } = bindGroupFactory.create(
      [ 'pointLight', 'transform' ],
      { ...globalResource, ...this.resource }
    );
    
    this.shadowPipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [layout] 
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

    // set bind group
    bundleEncoder.setBindGroup(0, group);
    
    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);

  }

  public update() {

    let normalMat = new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld).toArray();
    (this.resourceCPUData.transform as TypedArray).set([
      ...this.mesh.matrixWorld.toArray(),
      ...normalMat.slice(0, 3), 0,
      ...normalMat.slice(3, 6), 0,
      ...normalMat.slice(6, 9), 0
    ]);
    device.queue.writeBuffer( 
      this.resource.transform as GPUBuffer,
      0, this.resourceCPUData.transform as TypedArray
    );

  }

}

export { Mesh };