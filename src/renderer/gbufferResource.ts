import * as THREE from 'three';
import { device, canvasSize } from './renderer';
import type { TypedArray } from './base';
import { resourceFactory } from './base';
import type { ResourceType, BufferData, TextureData, TextureArrayData } from './resource/resuorce';
import { ResourceFactory } from './resource/resuorce';

class GBUfferResource {

  public static GBufferFormats: GPUTextureFormat[] = [
    'rgba8unorm'
  ];

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
        size: [canvasSize.width, canvasSize.height, 1],
        dimension: '2d' as GPUTextureDimension,
        format: GBUfferResource.GBufferFormats[0],
        layout: { // for post process
          sampleType: 'unfilterable-float' as GPUTextureSampleType,
          viewDimension: '2d' as GPUTextureViewDimension,
        } as GPUTextureBindingLayout
      }
  
    });
  }

  private resourceAttributes: string[];
  public resource: Record<string, GPUBuffer | GPUTexture | GPUSampler>; // resource in GPU

  constructor() {

  }

  public async initResource() {

    this.resourceAttributes = [
      'GBuffer0'
    ];

    // 4 positions for post processing
    const vertexBuffer = new Float32Array([ 
      -1, -1,    1, -1, 
      -1,  1,    1,  1
    ]);

    this.resource = await resourceFactory.createResource(
      this.resourceAttributes, 
      { postProcessVertexBuffer: { value: vertexBuffer } } 
    );

  }

}

export { GBUfferResource }