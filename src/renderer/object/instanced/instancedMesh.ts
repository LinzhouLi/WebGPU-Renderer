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

class InstancedMesh extends RenderableObject {

  private mesh: THREE.Mesh;

  private renderPipeline: GPURenderPipeline;
  private shadowPipeline: GPURenderPipeline;

  private instanceCount: number;
  private vertexCount: number;
  private vertexBufferAttributes: string[]; // resource name
  private vertexBufferData: { [x: string]: TypedArray }; // resource in CPU
  private vertexBuffers: { [x: string]: GPUBuffer }; // resource in GPU

  private resourceAttributes: string[]; // resource name
  private resourceCPUData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource | (ImageBitmap | ImageBitmapSource)[] }; // resource in CPU
  private resource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  constructor(mesh: THREE.Mesh, instanceCount: number) {

    super();
    this.mesh = mesh;
    this.instanceCount = instanceCount;
    this.resourceCPUData = { };

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

  public setTransfrom(
    positions: THREE.Vector3[],
    scales: THREE.Vector3[],
    rotations: THREE.Euler[]
  ) {

    let transformElements = [];
    for (let i = 0; i < this.instanceCount; i++) {
      let modelMat = new THREE.Matrix4().compose(
        positions[i], 
        new THREE.Quaternion().setFromEuler(rotations[i]),
        scales[i]
      );
      let normalMatElements = new THREE.Matrix3().getNormalMatrix(modelMat).toArray();
      transformElements.push(
        ...modelMat.toArray(),
        ...normalMatElements.slice(0, 3), 0,        // AlignOf(mat3x3<f32>) in wgsl is 16.
        ...normalMatElements.slice(3, 6), 0,        // see https://gpuweb.github.io/gpuweb/wgsl/#alignment
        ...normalMatElements.slice(6, 9), 0
      );
    }
    this.resourceCPUData.instancedTransform = new Float32Array(transformElements);

  }

  public setInfo(textureIndices: number[]) {

    this.resourceCPUData.instanceInfo = new Uint32Array(textureIndices);

  }

  public setColor(colors: THREE.Color[]) {

    let colorElements = [];
    for (let i = 0; i < this.instanceCount; i++) colorElements.push(...colors[i].toArray());
    this.resourceCPUData.instancedColor = new Float32Array(colorElements);

  }

  public setTexture(
    baseMapArray: THREE.Texture[],
    normalMapArray: THREE.Texture[]
  ) {

    if (baseMapArray.length != normalMapArray.length) throw new Error('Count of normal maps Should be equal to the count of base maps')
    this.resourceCPUData.baseMapArray = baseMapArray.map(texture => texture.source.data);
    this.resourceCPUData.normalMapArray = normalMapArray.map(texture => texture.source.data);

  }

  public async initGroupResource() {

    this.resourceAttributes = ['instancedTransform', 'instanceInfo', 'instancedColor', 'baseMapArray', 'normalMapArray'];
    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);

  }

  public async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    const lightType = globalResource.pointLight ? 'pointLight' : 'directionalLight';

    const vertexLayout = vertexBufferFactory.createLayout(this.vertexBufferAttributes);
    const { layout, group } = bindGroupFactory.create(
      [ lightType, 'pointLight', 'shadowMapSampler', 'textureSampler', 'shadowMap', ...this.resourceAttributes ],
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
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount, this.instanceCount);
    else bundleEncoder.draw(this.vertexCount, this.instanceCount);

  }

  public async setShadowBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    let vertexBufferAttributs = ['position'];
    if (this.vertexBufferAttributes.includes('index')) vertexBufferAttributs.push('index');

    const lightType = globalResource.pointLight ? 'pointLight' : 'directionalLight';

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const { layout, group } = bindGroupFactory.create(
      [ lightType, 'instancedTransform' ],
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
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount, this.instanceCount);
    else bundleEncoder.draw(this.vertexCount, this.instanceCount);

  }

  public update() {
    
  }

}

export { InstancedMesh };