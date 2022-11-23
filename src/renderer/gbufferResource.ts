import { device, canvasSize, canvasFormat } from './renderer';
import { resourceFactory } from './base';
import type { ResourceType } from './resource/resuorce';
import { ResourceFactory } from './resource/resuorce';

class GBUfferResource {

  public static Formats: Record<string, GPUTextureFormat> = {
    GBuffer0: 'rgba8unorm',
    canvas: canvasFormat
  };

  public static RegisterResourceFormats() {
    ResourceFactory.RegisterFormats({

      // for post processing (no binding)
      postProcessVertexBuffer: {
        type: 'buffer' as ResourceType,
        label: 'Coords for Post Processing',
        usage:  GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      },
  
      // GBuffer
      GBuffer0: {
        type: 'texture' as ResourceType,
        label: 'GBuffer1: ',
        visibility: GPUShaderStage.FRAGMENT,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        size: [canvasSize.width, canvasSize.height],
        dimension: '2d' as GPUTextureDimension,
        format: GBUfferResource.Formats[0],
        layout: { // for post process
          sampleType: 'unfilterable-float' as GPUTextureSampleType,
          viewDimension: '2d' as GPUTextureViewDimension,
        } as GPUTextureBindingLayout
      }
  
    });
  }

  private resourceAttributes: string[];
  public resource: Record<string, GPUBuffer | GPUTexture | GPUSampler>;
  public views: Record<string, GPUTextureView>;

  constructor() {

  }

  public async initResource() {

    this.resourceAttributes = [
      'GBuffer0'
    ];

    this.resource = await resourceFactory.createResource(this.resourceAttributes, { });
    this.views = {
      GBuffer0: (this.resource.GBuffer0 as GPUTexture).createView(),
      canvas: null
    }

  }

}

export { GBUfferResource }