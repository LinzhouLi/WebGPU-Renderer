import * as THREE from 'three';
import { device, canvasFormat } from '../../renderer';
import type { TypedArray } from '../../base';
import { vertexBufferFactory, resourceFactory, bindGroupFactory } from '../../base';
import { RenderableObject } from '../renderableObject';
import { vertexShaderFactory } from './vertexShader';
import { fragmentShaderFactory } from './fragmentShader';

const defaultSpecular = new THREE.Vector3(0.5, 0.5, 0.5);

class Mesh extends RenderableObject {

  protected mesh: THREE.Mesh;

  protected renderPipeline: GPURenderPipeline;
  protected shadowPipeline: GPURenderPipeline;

  protected vertexCount: number;
  protected vertexBufferAttributes: string[]; // resource name
  protected vertexBufferData: { [x: string]: TypedArray }; // resource in CPU
  protected vertexBuffers: { [x: string]: GPUBuffer }; // resource in GPU

  protected resourceAttributes: string[]; // resource name
  protected resourceCPUData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }; // resource in CPU
  protected resource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  protected createVertexShader: (slotAttributes: string[], attributes: string[][], pass: ('render' | 'shadow')) => string;
  protected createFragmentShader: (slotAttributes: string[], attributes: string[][], type: ('phong' | 'PBR')) => string;

  constructor(mesh: THREE.Mesh) {

    super();
    this.mesh = mesh;
    this.createVertexShader = vertexShaderFactory;
    this.createFragmentShader = fragmentShaderFactory;
    
  }

  public initVertexBuffer() {

    this.vertexBufferAttributes = ['position', 'normal', 'uv'];
    this.vertexBufferData = {
      position: this.mesh.geometry.attributes.position.array as TypedArray,
      normal: this.mesh.geometry.attributes.normal.array as TypedArray,
      uv: this.mesh.geometry.attributes.uv.array as TypedArray,
    };

    if (!!this.mesh.geometry.attributes.tangent) {
      this.vertexBufferAttributes.push('tangent');
      this.vertexBufferData.tangent = this.mesh.geometry.attributes.tangent.array as TypedArray;
    }

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

  public async initGroupResource() {

    const material = this.mesh.material as THREE.MeshStandardMaterial;

    this.resourceAttributes = ['transform', 'PBRMaterial'];
    this.resourceCPUData = {
      transform: new Float32Array(16 + 12), // update per frame
      PBRMaterial: new Float32Array([
        material.roughness,
        material.metalness, 
        0, 0, // for alignment
        ...material.color.toArray(), 0, // @ts-ignore
        ...(material.specular || defaultSpecular).toArray(), 0
      ])
    };
    
    if (!!material.map) {
      this.resourceAttributes.push('baseMap');
      this.resourceCPUData.baseMap = material.map.source.data;
    }

    if (!!material.normalMap) {
      this.resourceAttributes.push('normalMap');
      this.resourceCPUData.normalMap = material.normalMap.source.data;
    }

    if (!!material.metalnessMap) {
      this.resourceAttributes.push('metalnessMap');
      this.resourceCPUData.metalnessMap = material.metalnessMap.source.data;
    }

    if (!!material.roughnessMap) {
      this.resourceAttributes.push('roughnessMap');
      this.resourceCPUData.roughnessMap = material.roughnessMap.source.data;
    }
    
    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);
    
  }

  public async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    const lightType = globalResource.pointLight ? 'pointLight' : 'directionalLight';
    const globalResourceAttributes = [ 
      'camera', lightType,
      'shadowMap', 'envMap', 'diffuseEnvMap',
      'compareSampler', 'linearSampler',
      'Lut'
    ];
    
    const vertexLayout = vertexBufferFactory.createLayout(this.vertexBufferAttributes);
    const gloablBind = bindGroupFactory.create( globalResourceAttributes, globalResource );
    const localBind = bindGroupFactory.create( this.resourceAttributes, this.resource );
    
    this.renderPipeline = await device.createRenderPipelineAsync({
      label: 'Render Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [gloablBind.layout, localBind.layout]
      }),
      vertex: {
        module: device.createShaderModule({ code: 
          this.createVertexShader(this.vertexBufferAttributes, [globalResourceAttributes, this.resourceAttributes], 'render')
        }),
        entryPoint: 'main',
        buffers: vertexLayout
      },
      fragment: {
        module: device.createShaderModule({ code: 
          this.createFragmentShader(this.vertexBufferAttributes, [globalResourceAttributes, this.resourceAttributes], 'PBR')
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
    bundleEncoder.setBindGroup(0, gloablBind.group);
    bundleEncoder.setBindGroup(1, localBind.group);

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

    const lightType = globalResource.pointLight ? 'pointLight' : 'directionalLight';
    const resourceAttributes = [lightType, 'transform'];

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const Bind = bindGroupFactory.create( resourceAttributes, {...globalResource, ...this.resource} );
    
    this.shadowPipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [Bind.layout] 
      }),
      vertex: {
        module: device.createShaderModule({ code: 
          this.createVertexShader(vertexBufferAttributs, [resourceAttributes], 'shadow')
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
    bundleEncoder.setBindGroup(0, Bind.group);
    
    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);

  }

  public update() {

    this.mesh.normalMatrix.getNormalMatrix(this.mesh.matrixWorld);
    let normalMatArray = this.mesh.normalMatrix.toArray();

    (this.resourceCPUData.transform as TypedArray).set([
      ...this.mesh.matrixWorld.toArray(),
      ...normalMatArray.slice(0, 3), 0,
      ...normalMatArray.slice(3, 6), 0,
      ...normalMatArray.slice(6, 9), 0
    ]);
    device.queue.writeBuffer( 
      this.resource.transform as GPUBuffer, 0, 
      this.resourceCPUData.transform as TypedArray, 0
    );

  }

}

export { Mesh };