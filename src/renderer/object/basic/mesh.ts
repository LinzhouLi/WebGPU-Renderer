import * as THREE from 'three';
import { device } from '../../renderer';
import type { TypedArray } from '../../base';
import { vertexBufferFactory, resourceFactory, bindGroupFactory } from '../../base';
import { RenderableObject } from '../renderableObject';
import { GeometryPassShader } from '../../shader/shaderLib/geometryPass';
import { ShadowPassShader } from '../../shader/shaderLib/shadowPass';
import type { ResourceType, BufferData, TextureData, TextureArrayData } from '../../resource/resuorce';
import { ResourceFactory } from '../../resource/resuorce';

class Mesh extends RenderableObject {

  private static ResourceFormats = {

    // transform
    transform: {
      type: 'buffer' as ResourceType,
      label: 'Transform Matrices (mat4x4)',
      visibility: GPUShaderStage.VERTEX ,
      usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      layout: { 
        type: 'uniform' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },

    // material
    material: {
      type: 'buffer' as ResourceType,
      label: 'Material Structure', 
      visibility: GPUShaderStage.FRAGMENT,
      usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      layout: { 
        type: 'uniform' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },
    baseMap: { // texture
      type: 'texture' as ResourceType,
      label: 'Base Albedo Map',
      visibility: GPUShaderStage.FRAGMENT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d' as GPUTextureDimension,
      format: 'rgba8unorm-srgb' as GPUTextureFormat, // with GPU Gamma decoding
      layout: { 
        sampleType: 'float' as GPUTextureSampleType,
        viewDimension: '2d' as GPUTextureViewDimension
      } as GPUTextureBindingLayout
    }, 
    normalMap: { // normal map
      type: 'texture' as ResourceType,
      label: 'Normal Map',
      visibility: GPUShaderStage.FRAGMENT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d' as GPUTextureDimension,
      format: 'rgba8unorm' as GPUTextureFormat,
      layout: { 
        sampleType: 'float' as GPUTextureSampleType,
        viewDimension: '2d' as GPUTextureViewDimension
      } as GPUTextureBindingLayout
    }, 
    metalnessMap: { // metalness map
      type: 'texture' as ResourceType,
      label: 'Metalness Map',
      visibility: GPUShaderStage.FRAGMENT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d' as GPUTextureDimension,
      format: 'rgba8unorm' as GPUTextureFormat,
      layout: { 
        sampleType: 'float' as GPUTextureSampleType,
        viewDimension: '2d' as GPUTextureViewDimension
      } as GPUTextureBindingLayout
    },
    roughnessMap: { // roughness map
      type: 'texture' as ResourceType,
      label: 'RoughnessMap',
      visibility: GPUShaderStage.FRAGMENT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d' as GPUTextureDimension,
      format: 'rgba8unorm' as GPUTextureFormat,
      layout: { 
        sampleType: 'float' as GPUTextureSampleType,
        viewDimension: '2d' as GPUTextureViewDimension
      } as GPUTextureBindingLayout
    },
    specularMap: { // specular map
      type: 'texture' as ResourceType,
      label: 'SpecularMap',
      visibility: GPUShaderStage.FRAGMENT,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      dimension: '2d' as GPUTextureDimension,
      format: 'rgba8unorm' as GPUTextureFormat,
      layout: { 
        sampleType: 'float' as GPUTextureSampleType,
        viewDimension: '2d' as GPUTextureViewDimension
      } as GPUTextureBindingLayout
    },

  };

  protected mesh: THREE.Mesh;

  protected renderPipeline: GPURenderPipeline;
  protected shadowPipeline: GPURenderPipeline;

  protected vertexCount: number;
  protected vertexBufferAttributes: string[]; // resource name
  protected vertexBufferData: Record<string, TypedArray>; // resource in CPU
  protected vertexBuffers: Record<string, GPUBuffer>; // resource in GPU

  protected resourceAttributes: string[]; // resource name
  protected resourceCPUData: Record<string, BufferData | TextureData | TextureArrayData>; // resource in CPU
  protected resource: Record<string, GPUBuffer | GPUTexture | GPUSampler>; // resource in GPU

  protected geometryPassShader: {
    Vertex: (slotAttributes: string[], bindingAttributes: string[][]) => string,
    Fragment: (slotAttributes: string[], bindingAttributes: string[][]) => string
  }
  protected shadowPassShader: (slotAttributes: string[], bindingAttributes: string[][]) => string

  constructor(mesh: THREE.Mesh) {

    super();
    this.mesh = mesh;
    this.geometryPassShader = GeometryPassShader;
    this.shadowPassShader = ShadowPassShader;
    
  }

  public static RegisterResourceFormats() {
    ResourceFactory.RegisterFormats(Mesh.ResourceFormats);
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

    const material = this.mesh.material as THREE.MeshPhysicalMaterial;

    this.resourceAttributes = ['transform', 'material'];
    this.resourceCPUData = {
      transform: { value: new Float32Array(16 + 16 + 12) }, // update per frame
      material: { 
        value: new Float32Array([
          material.metalness, 
          material.specularIntensity, 
          material.roughness,
          0, // for alignment
          ...material.color.toArray(),
        ])
      }
    };
    
    if (!!material.map) {
      this.resourceAttributes.push('baseMap');
      this.resourceCPUData.baseMap = { 
        value: await resourceFactory.toBitmap(material.map.image), 
        flipY: material.map.flipY 
      };
    }

    if (!!material.normalMap) {
      this.resourceAttributes.push('normalMap');
      this.resourceCPUData.normalMap = { 
        value: await resourceFactory.toBitmap(material.normalMap.image), 
        flipY: material.map.flipY 
      };
    }

    if (!!material.metalnessMap) {
      this.resourceAttributes.push('metalnessMap');
      this.resourceCPUData.metalnessMap = { 
        value: await resourceFactory.toBitmap(material.metalnessMap.image), 
        flipY: material.map.flipY 
      };
    }

    if (!!material.roughnessMap) {
      this.resourceAttributes.push('roughnessMap');
      this.resourceCPUData.roughnessMap = { 
        value: await resourceFactory.toBitmap(material.roughnessMap.image), 
        flipY: material.map.flipY
      };
    }

    if (!!material.specularIntensityMap) {
      this.resourceAttributes.push('specularMap');
      this.resourceCPUData.specularMap = { 
        value: await resourceFactory.toBitmap(material.specularIntensityMap.image), 
        flipY: material.map.flipY
      };
    }
    
    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);
    
  }

  public async setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    targetStates: Iterable<GPUColorTargetState | null>,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    const lightType = globalResource.pointLight ? 'pointLight' : 'directionalLight';
    // const globalResourceAttributes = [ 
    //   'camera', lightType,
    //   'shadowMap', 'envMap', 'diffuseEnvMap',
    //   'compareSampler', 'linearSampler',
    //   'DFG'
    // ];
    const globalResourceAttributes = [ 
      'camera', 'linearSampler'
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
          this.geometryPassShader.Vertex(this.vertexBufferAttributes, [globalResourceAttributes, this.resourceAttributes])
        }),
        entryPoint: 'main',
        buffers: vertexLayout
      },
      fragment: {
        module: device.createShaderModule({ code: 
          this.geometryPassShader.Fragment(this.vertexBufferAttributes, [globalResourceAttributes, this.resourceAttributes])
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
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);
    
  }

  public async setShadowBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    let vertexBufferAttributs = ['position'];
    if (this.vertexBufferAttributes.includes('index')) vertexBufferAttributs.push('index');

    const resourceAttributes = ['shadowMat', 'transform'];

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const bind = bindGroupFactory.create( resourceAttributes, {...globalResource, ...this.resource} );
    
    this.shadowPipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [bind.layout] 
      }),
      vertex: {
        module: device.createShaderModule({ code: 
          this.shadowPassShader(vertexBufferAttributs, [resourceAttributes])
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
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);

  }

  public update() {

    this.mesh.normalMatrix.getNormalMatrix(this.mesh.matrixWorld);
    let normalMatArray = this.mesh.normalMatrix.toArray();

    const transformBufferData = this.resourceCPUData.transform as BufferData;
    transformBufferData.value.set([
      ...this.mesh.matrixWorld.toArray(),
      ...normalMatArray.slice(0, 3), 0,
      ...normalMatArray.slice(3, 6), 0,
      ...normalMatArray.slice(6, 9), 0
    ]);
    device.queue.writeBuffer( 
      this.resource.transform as GPUBuffer, 0, 
      transformBufferData.value, 0
    );

  }

}

export { Mesh };