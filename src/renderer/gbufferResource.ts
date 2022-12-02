import { canvasSize, canvasFormat } from './renderer';
import { resourceFactory } from './base';
import type { ResourceType } from './resource/resuorce';
import { ResourceFactory } from './resource/resuorce';

class GBUfferResource {

  public static Formats: Record<string, GPUTextureFormat>;

  public static RegisterResourceFormats() {
    GBUfferResource.Formats = {
      GBufferA: 'rgb10a2unorm',
      GBufferB: 'rgba8unorm',
      GBufferC: 'rgba8unorm',
      GBufferDepth: 'depth32float',
      canvas: canvasFormat
    }

    ResourceFactory.RegisterFormats({

      // for post processing (no binding)
      postProcessVertexBuffer: {
        type: 'buffer' as ResourceType,
        label: 'Coords for Post Processing',
        usage:  GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      },
  
      // GBuffer
      GBufferA: {
        type: 'texture' as ResourceType,
        label: 'GBufferA: Normal',
        visibility: GPUShaderStage.FRAGMENT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        size: [canvasSize.width, canvasSize.height],
        dimension: '2d' as GPUTextureDimension,
        format: GBUfferResource.Formats.GBufferA as GPUTextureFormat,
        layout: { // for post process
          sampleType: 'float' as GPUTextureSampleType,
          viewDimension: '2d' as GPUTextureViewDimension,
        } as GPUTextureBindingLayout
      },
      GBufferB: {
        type: 'texture' as ResourceType,
        label: 'GBufferB: Metalness, Specular, Roughness',
        visibility: GPUShaderStage.FRAGMENT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        size: [canvasSize.width, canvasSize.height],
        dimension: '2d' as GPUTextureDimension,
        format: GBUfferResource.Formats.GBufferB as GPUTextureFormat,
        layout: { // for post process
          sampleType: 'float' as GPUTextureSampleType,
          viewDimension: '2d' as GPUTextureViewDimension,
        } as GPUTextureBindingLayout
      },
      GBufferC: {
        type: 'texture' as ResourceType,
        label: 'GBufferC: BaseColor',
        visibility: GPUShaderStage.FRAGMENT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        size: [canvasSize.width, canvasSize.height],
        dimension: '2d' as GPUTextureDimension,
        format: GBUfferResource.Formats.GBufferC as GPUTextureFormat,
        layout: { // for post process
          sampleType: 'float' as GPUTextureSampleType,
          viewDimension: '2d' as GPUTextureViewDimension,
        } as GPUTextureBindingLayout
      },
      GBufferDepth: {
        type: 'texture' as ResourceType,
        label: 'GBufferDepth: Depth in camera coordinate',
        visibility: GPUShaderStage.FRAGMENT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        size: [canvasSize.width, canvasSize.height],
        dimension: '2d' as GPUTextureDimension,
        format: GBUfferResource.Formats.GBufferDepth as GPUTextureFormat,
        layout: { // for post process
          sampleType: 'depth' as GPUTextureSampleType,
          viewDimension: '2d' as GPUTextureViewDimension,
        } as GPUTextureBindingLayout
      },
  
    });
  }

  private resourceAttributes: string[];
  public resource: Record<string, GPUBuffer | GPUTexture | GPUSampler>;
  public views: Record<string, GPUTextureView>;

  constructor() {

  }

  public async initResource() {

    this.resourceAttributes = [
      'GBufferA', 'GBufferB', 'GBufferC', 'GBufferDepth'
    ];

    this.resource = await resourceFactory.createResource(this.resourceAttributes, { });
    this.views = {
      GBufferA: (this.resource.GBufferA as GPUTexture).createView(),
      GBufferB: (this.resource.GBufferB as GPUTexture).createView(),
      GBufferC: (this.resource.GBufferC as GPUTexture).createView(),
      GBufferDepth: (this.resource.GBufferDepth as GPUTexture).createView(),
      canvas: null
    }

  }

}

export { GBUfferResource }