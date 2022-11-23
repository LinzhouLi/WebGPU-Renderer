import * as THREE from 'three';
import { device } from '../../renderer';
import type { TypedArray } from '../../base';
import { vertexBufferFactory, resourceFactory, bindGroupFactory } from '../../base';
import { RenderableObject } from '../renderableObject';
import { vertexShaderFactory } from './vertexShader';
import { fragmentShaderFactory } from './fragmentShader';
import type { ResourceType, BufferData, TextureData, TextureArrayData } from '../../resource/resuorce';
import { ResourceFactory } from '../../resource/resuorce';

class InstancedMesh extends RenderableObject {

  private static ResourceFormats = {
    instancedInfo: {
      type: 'buffer' as ResourceType,
      label: 'Instance Infomation',
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      layout: { 
        type: 'read-only-storage' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },
  
    // transform
    instancedTransform: {
      type: 'buffer' as ResourceType,
      label: 'Transform Structure for Instanced Mesh',
      visibility: GPUShaderStage.VERTEX,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      layout: { 
        type: 'read-only-storage' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },
    instancedModelMat: {
      type: 'buffer' as ResourceType,
      label: 'Model Matrix for Instanced Mesh (mat4x4xn)',
      visibility: GPUShaderStage.VERTEX,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      layout: { 
        type: 'read-only-storage' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },
    instancedNormalMat: {
      type: 'buffer' as ResourceType,
      label: 'Normal Matrix for Instanced Mesh (mat3x3xn)',
      visibility: GPUShaderStage.VERTEX,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      layout: { 
        type: 'read-only-storage' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },
  
    // material
    instancedColor: {
      type: 'buffer' as ResourceType,
      label: 'Color for Instanced Mesh (vec3)',
      visibility: GPUShaderStage.FRAGMENT,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      layout: { 
        type: 'read-only-storage' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },
    baseMapArray: {
      type: 'texture-array' as ResourceType,
      label: 'Base Albedo Map Array for Instanced Mesh',
      visibility: GPUShaderStage.FRAGMENT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d' as GPUTextureDimension,
      format: 'rgba8unorm' as GPUTextureFormat,
      layout: { 
        sampleType: 'float' as GPUTextureSampleType,
        viewDimension: '2d-array' as GPUTextureViewDimension
      } as GPUTextureBindingLayout
    },
    normalMapArray: {
      type: 'texture-array' as ResourceType,
      label: 'Normal Map Array for Instanced Mesh',
      visibility: GPUShaderStage.FRAGMENT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d' as GPUTextureDimension,
      format: 'rgba8unorm' as GPUTextureFormat,
      layout: { 
        sampleType: 'float' as GPUTextureSampleType,
        viewDimension: '2d-array' as GPUTextureViewDimension
      } as GPUTextureBindingLayout
    },
  };

  protected mesh: THREE.Mesh;

  protected renderPipeline: GPURenderPipeline;
  protected shadowPipeline: GPURenderPipeline;

  protected instanceCount: number;
  protected vertexCount: number;
  protected vertexBufferAttributes: string[]; // resource name
  protected vertexBufferData: Record<string, TypedArray>; // resource in CPU
  protected vertexBuffers: Record<string, GPUBuffer>; // resource in GPU

  protected resourceAttributes: string[]; // resource name
  protected resourceCPUData: Record<string, BufferData | TextureData | TextureArrayData>; // resource in CPU
  protected resource: Record<string, GPUBuffer | GPUTexture | GPUSampler>; // resource in GPU

  protected createVertexShader: (slotAttributes: string[], attributes: string[][], pass: ('render' | 'shadow')) => string;
  protected createFragmentShader: (slotAttributes: string[], attributes: string[][], type: ('phong' | 'PBR')) => string;

  constructor(mesh: THREE.Mesh, instanceCount: number) {

    super();
    this.mesh = mesh;
    this.instanceCount = instanceCount;
    this.resourceAttributes = [];
    this.resourceCPUData = { };
    this.resource = { };
    this.createVertexShader = vertexShaderFactory;
    this.createFragmentShader = fragmentShaderFactory;

  }

  public static RegisterResourceFormats() {
    ResourceFactory.RegisterFormats(InstancedMesh.ResourceFormats);
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

  protected setResource(attribute: string) {

    // @ts-ignore
    if (this.resource[attribute] && this.resource[attribute]?.destroy) // @ts-ignore
      this.resource[attribute].destroy();
    
    if (!this.resourceAttributes.includes(attribute))
      this.resourceAttributes.push(attribute);

  }

  public setTransfrom(
    positions: THREE.Vector3[],
    scales: THREE.Vector3[],
    rotations: THREE.Euler[]
  ) {

    this.setResource('instancedModelMat');

    let transformElements = [];
    for (let i = 0; i < this.instanceCount; i++) {
      let modelMat = new THREE.Matrix4().compose(
        positions[i], 
        new THREE.Quaternion().setFromEuler(rotations[i]),
        scales[i]
      );
      transformElements.push( ...modelMat.toArray() );
    }
    this.resourceCPUData.instancedModelMat = { value: new Float32Array(transformElements) };

  }

  public setInfo(textureIndices: number[]) {

    this.setResource('instancedInfo');

    this.resourceCPUData.instancedInfo = { value: new Uint32Array(textureIndices) };

  }

  public setColor(colors: THREE.Color[]) {

    this.setResource('instancedColor');

    let colorElements = [];
    for (let i = 0; i < this.instanceCount; i++) colorElements.push(...colors[i].toArray());
    this.resourceCPUData.instancedColor = { value: new Float32Array(colorElements) };

  }

  public async setTexture(
    baseMapArray: THREE.Texture[],
    normalMapArray: THREE.Texture[] = []
  ) {

    this.setResource('baseMapArray');
    this.setResource('normalMapArray');

    if (normalMapArray.length > 0 && baseMapArray.length != normalMapArray.length) 
      throw new Error('Count of normal maps Should be equal to the count of base maps')
    this.resourceCPUData.baseMapArray = { 
      value: await resourceFactory.toBitmaps(baseMapArray.map(texture => texture.image)),
      flipY: baseMapArray.map(texture => texture.flipY)
    };
    this.resourceCPUData.normalMapArray = { 
      value: await resourceFactory.toBitmaps(normalMapArray.map(texture => texture.image)),
      flipY: normalMapArray.map(texture => texture.flipY)
    };

  }

  public async initGroupResource() {

    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);

  }

  public async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    targetStates: Iterable<GPUColorTargetState | null>,
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
    const gloablBind = bindGroupFactory.create(
      globalResourceAttributes, globalResource, null, 'global'
    );
    const localBind = bindGroupFactory.create(
      this.resourceAttributes, this.resource, null, 'local'
    );
    
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
        targets: targetStates,
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
    const resourceAttributes = [lightType, 'instancedModelMat'];

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const bind = bindGroupFactory.create( resourceAttributes, {...globalResource, ...this.resource} );
    
    this.shadowPipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [bind.layout] 
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
    bundleEncoder.setBindGroup(0, bind.group);
    
    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount, this.instanceCount);
    else bundleEncoder.draw(this.vertexCount, this.instanceCount);

  }

  public update() {
    
  }

}

export { InstancedMesh };