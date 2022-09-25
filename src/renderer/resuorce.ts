import { device } from './renderer';
import type { TypedArray } from './base';

const ResourceFormat = {

  // camera
  viewMatCamera: {
    label: 'View Matrix From Camera (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  projectionMatCamera: {
    label: 'Projection Matrix From Camera (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  cameraPosition: {
    label: 'Camera Position (vec3)',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },

  // light
  viewProjectionMatLight: {
    label: 'View Projection Matrix From Light (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  lightPosition: {
    label: 'Light Position (vec3)',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  shadowMapSampler: {
    label: 'Shadow Map Sampler',
    visibility: GPUShaderStage.FRAGMENT,
    compare: 'less' as GPUCompareFunction,
    magFilter: 'nearest' as GPUFilterMode,
    minFilter: 'nearest' as GPUFilterMode,
    sampler: { type: 'comparison' }
  },
  shadowMap: {
    label: 'Shadow Map',
    visibility: GPUShaderStage.FRAGMENT,
    size: [2048, 2048],
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    format: 'depth32float',
    texture: { sampleType: 'depth' }
  },

  // transform
  modelMat: {
    label: 'Model Matrix (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  normalMat: {
    label: 'Normal Matrix (mat3x3)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  boneMatrices: {
    label: 'Skinning Matrices (mat3x3)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    buffer: { type: 'read-only-storage' }
  },

  // material
  color: {
    label: 'Color',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    buffer: { type: 'uniform' }
  },
  textureSampler: {
    label: 'Texture Linear Sampler',
    visibility: GPUShaderStage.FRAGMENT,
    magFilter: 'linear' as GPUFilterMode,
    minFilter: 'linear' as GPUFilterMode,
    sampler: { type: 'filtering' }
  }, 
  baseMap: { // texture
    label: 'Base Albedo Map ',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { sampleType: 'float' }
  }, 
  normalMap: { // normal map
    label: 'Normal Map',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { sampleType: 'float' }
  }, 
  metalnessMap: { // metalness map
    label: 'Metalness Map',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    format: 'rgba8unorm' as GPUTextureFormat,
    texture: { sampleType: 'float' }
  },
  roughnessMap: { // roughness map
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
    data: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }
  ): Promise<{ [x: string]: GPUBuffer | GPUTexture | GPUSampler }> {

    let result: { [x: string]: GPUBuffer | GPUTexture | GPUSampler } = {  };

    for (const attribute of attributes) {
      if (!ResourceFormat[attribute])
        throw new Error(`Resource Attribute Not Exist: ${attribute}`);
      
      if (ResourceFormat[attribute].buffer) { // GPU buffer

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

      }
      else if (ResourceFormat[attribute].sampler) { // GPU sampler

        let sampler = device.createSampler({
          label: ResourceFormat[attribute].label,
          magFilter: ResourceFormat[attribute].magFilter || 'nearest',
          minFilter: ResourceFormat[attribute].minFilter || 'nearest',
          compare: ResourceFormat[attribute].compare || undefined // The provided value 'null' is not a valid enum value of type GPUCompareFunction.
        });
        result[attribute] = sampler;

      }
      else if (ResourceFormat[attribute].texture) { // GPU texture

        if ((ResourceFormat[attribute].usage & GPUTextureUsage.COPY_DST) && !data[attribute])
          throw new Error(`${attribute} Needs Copy Data`);

        // create bitmap
        let bitmap: ImageBitmap = null;
        if (data[attribute]) {
          if (data[attribute] instanceof ImageBitmap)
            bitmap = data[attribute] as ImageBitmap;
          else (data[attribute])
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

      }
    }

    return result;

  }

}

export { ResourceFormat, ResourceFactory };
