import { device } from './renderer';
import type { TypedArray } from './base';

type ResourceType = 'buffer' | 'texture' | 'sampler' | 'cube-texture';

const ResourceFormat = {

  // camera
  viewMatCamera: {
    type: 'buffer' as ResourceType,
    label: 'View Matrix From Camera (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  projectionMatCamera: {
    type: 'buffer' as ResourceType,
    label: 'Projection Matrix From Camera (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  cameraPosition: {
    type: 'buffer' as ResourceType,
    label: 'Camera Position (vec3)',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },

  // light
  viewProjectionMatLight: {
    type: 'buffer' as ResourceType,
    label: 'View Projection Matrix From Light (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  lightPosition: {
    type: 'buffer' as ResourceType,
    label: 'Light Position (vec3)',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  shadowMapSampler: {
    type: 'sampler' as ResourceType,
    label: 'Shadow Map Sampler',
    visibility: GPUShaderStage.FRAGMENT,
    compare: 'less' as GPUCompareFunction,
    magFilter: 'nearest' as GPUFilterMode,
    minFilter: 'nearest' as GPUFilterMode,
    sampler: { type: 'comparison' }
  },
  shadowMap: {
    type: 'texture' as ResourceType,
    label: 'Shadow Map',
    visibility: GPUShaderStage.FRAGMENT,
    size: [2048, 2048],
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    format: 'depth32float' as GPUTextureFormat,
    texture: { sampleType: 'depth' }
  },

  // skybox
  skyboxMap: {
    type: 'cube-texture' as ResourceType,
    label: 'Skybox Map',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { 
      sampleType: 'float',
      viewDimension: 'cube'
    }
  },

  // transform
  modelMat: {
    type: 'buffer' as ResourceType,
    label: 'Model Matrix (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  normalMat: {
    type: 'buffer' as ResourceType,
    label: 'Normal Matrix (mat3x3)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  boneMatrices: {
    type: 'buffer' as ResourceType,
    label: 'Skinning Matrices (mat3x3)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    buffer: { type: 'read-only-storage' }
  },

  // material
  color: {
    type: 'buffer' as ResourceType,
    label: 'Color',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  textureSampler: {
    type: 'sampler' as ResourceType,
    label: 'Texture Linear Sampler',
    visibility: GPUShaderStage.FRAGMENT,
    magFilter: 'linear' as GPUFilterMode,
    minFilter: 'linear' as GPUFilterMode,
    sampler: { type: 'filtering' }
  }, 
  baseMap: { // texture
    type: 'texture' as ResourceType,
    label: 'Base Albedo Map ',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { sampleType: 'float' }
  }, 
  normalMap: { // normal map
    type: 'texture' as ResourceType,
    label: 'Normal Map',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { sampleType: 'float' }
  }, 
  metalnessMap: { // metalness map
    type: 'texture' as ResourceType,
    label: 'Metalness Map',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { sampleType: 'float' }
  },
  roughnessMap: { // roughness map
    type: 'texture' as ResourceType,
    label: 'RoughnessMap',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { sampleType: 'float' }
  }

};


class ResourceFactory {

  constructor() {

  }

  async createResource(
    attributes: string[], 
    data: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource | (ImageBitmap | ImageBitmapSource)[] }
  ): Promise<{ [x: string]: GPUBuffer | GPUTexture | GPUSampler }> {

    let result: { [x: string]: GPUBuffer | GPUTexture | GPUSampler } = {  };

    for (const attribute of attributes) {
      if (!ResourceFormat[attribute])
        throw new Error(`Resource Attribute Not Exist: ${attribute}`);

      switch (ResourceFormat[attribute].type) {
        case 'buffer': { // GPU buffer

          if ((ResourceFormat[attribute].usage & GPUBufferUsage.COPY_DST) && !data[attribute])
            throw new Error(`${attribute} Needs Copy Data`);

          let array: TypedArray = null;
          if (data[attribute]) array = data[attribute] as TypedArray;
          const bufferSize = array ? array.byteLength : ResourceFormat[attribute].size;
          const buffer = device.createBuffer({
            label: ResourceFormat[attribute].label,
            size: bufferSize,
            usage: ResourceFormat[attribute].usage
          });
          if (data[attribute]) device.queue.writeBuffer(buffer, 0, array);
          result[attribute] = buffer;

          break;
        }
        case 'sampler': { // GPU sampler

          let sampler = device.createSampler({
            label: ResourceFormat[attribute].label,
            magFilter: ResourceFormat[attribute].magFilter || 'nearest',
            minFilter: ResourceFormat[attribute].minFilter || 'nearest',
            compare: ResourceFormat[attribute].compare || undefined // The provided value 'null' is not a valid enum value of type GPUCompareFunction.
          });
          result[attribute] = sampler;

          break;
        }
        case 'texture': { // GPU texture

          if ((ResourceFormat[attribute].usage & GPUTextureUsage.COPY_DST) && !data[attribute])
            throw new Error(`${attribute} Needs Copy Data`);

          // create bitmap
          let bitmap: ImageBitmap = null;
          if (data[attribute]) {
            if (data[attribute] instanceof ImageBitmap)
              bitmap = data[attribute] as ImageBitmap;
            else
              bitmap = await createImageBitmap(data[attribute] as ImageBitmapSource);
          }
          
          // create GPU texture
          const textureSize = bitmap ? [bitmap.width, bitmap.height] : ResourceFormat[attribute].size;
          let texture = device.createTexture({
            label: ResourceFormat[attribute].label,
            size: textureSize,
            format: ResourceFormat[attribute].format || 'rgba8unorm',
            usage: ResourceFormat[attribute].usage
          });
          if (data[attribute]) {
            device.queue.copyExternalImageToTexture(
              { source: bitmap },
              { texture: texture },
              textureSize
            );
          }
          result[attribute] = texture;

          break;
        }
        case 'cube-texture': { // GPU cube texture

          if ((ResourceFormat[attribute].usage & GPUTextureUsage.COPY_DST)) {
            if (!data[attribute])
              throw new Error(`${attribute} Needs Copy Data`);
            if ((data[attribute] as (ImageBitmap | ImageBitmapSource)[]).length != 6)
              throw new Error(`${attribute} Needs 6 Image Source`);
          }
          
          // create bitmap
          let bitmaps: ImageBitmap[] = [];
          if (data[attribute]) {
            for (const imageData of data[attribute] as (ImageBitmap | ImageBitmapSource)[]) {
              let bitmap: ImageBitmap;
              if (imageData instanceof ImageBitmap)
                bitmap = imageData as ImageBitmap;
              else
                bitmap = await createImageBitmap(imageData as ImageBitmapSource);
              bitmaps.push(bitmap);
            }
          }

          // create
          const textureSize = bitmaps[0] ? [bitmaps[0].width, bitmaps[0].height] : ResourceFormat[attribute].size;
          let texture = device.createTexture({
            label: ResourceFormat[attribute].label,
            size: [...textureSize, 6],
            format: ResourceFormat[attribute].format || 'rgba8unorm',
            usage: ResourceFormat[attribute].usage
          });
          for (let i = 0; i < 6; i++) {
            device.queue.copyExternalImageToTexture(
              { source: bitmaps[i] },
              { 
                texture: texture,      // Defines the origin of the copy - the minimum corner of the texture sub-region to copy to/from.
                origin: [0, 0, i]      // Together with `copySize`, defines the full copy sub-region.
              },
              [ ...textureSize, 1]
            )
          }
          result[attribute] = texture;

          break;
        }
        default: {

        }
      }
      
    }

    return result;

  }

}

export { ResourceFormat, ResourceFactory };
