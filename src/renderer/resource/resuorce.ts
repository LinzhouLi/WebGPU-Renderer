import { device } from '../renderer';
import type { TypedArray } from '../base';
import { MultiBounceBRDF } from '../precompute/multiBounceBRDF';
import { IBL } from '../precompute/IBL';

type ResourceType = 'buffer' | 'sampler' | 'texture' | 'cube-texture' | 'texture-array';

const ResourceFormat = {

  // camera
  camera: {
    type: 'buffer' as ResourceType,
    label: 'Camera Structure', // position(vec3), view matrix(mat4x4), projection matrix(mat4x4)
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  viewMatCamera: {
    type: 'buffer' as ResourceType,
    label: 'View Matrix From Camera (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  projectionMatCamera: {
    type: 'buffer' as ResourceType,
    label: 'Projection Matrix From Camera (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  cameraPosition: {
    type: 'buffer' as ResourceType,
    label: 'Camera Position (vec3)',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },

  // light
  pointLight: {
    type: 'buffer' as ResourceType,
    label: 'Point Light Structure', // position(vec3<f32>), color(vec3<f32>), view projection matrix(mat4x4<f32>)
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  directionalLight: {
    type: 'buffer' as ResourceType,
    label: 'Directional Light Structure', // direction(vec3<f32>), color(vec3<f32>), view projection matrix(mat4x4<f32>)
    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  viewProjectionMatLight: {
    type: 'buffer' as ResourceType,
    label: 'View Projection Matrix From Light (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  lightPosition: {
    type: 'buffer' as ResourceType,
    label: 'Light Position (vec3)',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  shadowMap: {
    type: 'texture' as ResourceType,
    label: 'Shadow Map',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    size: [2048, 2048],
    dimension: '2d' as GPUTextureDimension,
    format: 'depth32float' as GPUTextureFormat,
    layout: { 
      sampleType: 'depth' as GPUTextureSampleType,
      viewDimension: '2d' as GPUTextureViewDimension
    } as GPUTextureBindingLayout
  },

  // sampler
  compareSampler: {
    type: 'sampler' as ResourceType,
    label: 'Shadow Map Sampler',
    visibility: GPUShaderStage.FRAGMENT,
    compare: 'less' as GPUCompareFunction,
    magFilter: 'nearest' as GPUFilterMode,
    minFilter: 'nearest' as GPUFilterMode,
    layout: { 
      type: 'comparison' as GPUSamplerBindingType 
    } as GPUSamplerBindingLayout
  },
  linearSampler: {
    type: 'sampler' as ResourceType,
    label: 'Texture Linear Sampler',
    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
    magFilter: 'linear' as GPUFilterMode,
    minFilter: 'linear' as GPUFilterMode,
    layout: { 
      type: 'filtering' as GPUSamplerBindingType 
    } as GPUSamplerBindingLayout
  }, 
  nonFilterSampler: {
    type: 'sampler' as ResourceType,
    label: 'Texture Linear Sampler',
    visibility: GPUShaderStage.FRAGMENT,
    magFilter: 'nearest' as GPUFilterMode,
    minFilter: 'nearest' as GPUFilterMode,
    layout: { 
      type: 'non-filtering' as GPUSamplerBindingType 
    } as GPUSamplerBindingLayout
  }, 

  // Environment
  envMap: {
    type: 'cube-texture' as ResourceType,
    label: 'Skybox Map',
    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    size: [],
    dimension: '2d' as GPUTextureDimension,
    mipLevelCount: IBL.EnvMapMipLevelCount,
    format: 'rgba8unorm' as GPUTextureFormat,
    layout: { 
      sampleType: 'float' as GPUTextureSampleType,
      viewDimension: 'cube' as GPUTextureViewDimension
    } as GPUTextureBindingLayout
  },
  diffuseEnvMap: {
    type: 'cube-texture' as ResourceType,
    label: 'Skybox Map',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    size: [IBL.DiffuseEnvMapResulotion, IBL.DiffuseEnvMapResulotion],
    dimension: '2d' as GPUTextureDimension,
    format: 'rgba8unorm' as GPUTextureFormat,
    layout: { 
      sampleType: 'float' as GPUTextureSampleType,
      viewDimension: 'cube' as GPUTextureViewDimension
    } as GPUTextureBindingLayout
  },
  Emu: {
    type: 'texture' as ResourceType,
    labal: 'Emu Texture',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    size: [MultiBounceBRDF.EmuResolution, MultiBounceBRDF.EmuResolution],
    dimension: '2d' as GPUTextureDimension,
    format: 'r32float' as GPUTextureFormat,
    layout: {
      sampleType: 'unfilterable-float' as GPUTextureSampleType,
      viewDimension: '2d' as GPUTextureViewDimension
    } as GPUTextureBindingLayout
  },
  Eavg: {
    type: 'texture' as ResourceType,
    labal: 'Eavg Texture',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    size: [MultiBounceBRDF.EmuResolution],
    dimension: '1d' as GPUTextureDimension,
    format: 'r32float' as GPUTextureFormat,
    layout: {
      sampleType: 'unfilterable-float' as GPUTextureSampleType,
      viewDimension: '1d' as GPUTextureViewDimension
    } as GPUTextureBindingLayout
  },
  Lut: {
    type: 'texture' as ResourceType,
    labal: 'Lut Texture',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
    size: [IBL.LutResulotion, IBL.LutResulotion],
    dimension: '2d' as GPUTextureDimension,
    format: 'rg32float' as GPUTextureFormat,
    layout: {
      sampleType: 'unfilterable-float' as GPUTextureSampleType,
      viewDimension: '2d' as GPUTextureViewDimension
    } as GPUTextureBindingLayout
  },

  // transform
  transform: {
    type: 'buffer' as ResourceType,
    label: 'Model Matrix (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  modelMat: {
    type: 'buffer' as ResourceType,
    label: 'Model Matrix (mat4x4)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  normalMat: {
    type: 'buffer' as ResourceType,
    label: 'Normal Matrix (mat3x3)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  boneMatrices: {
    type: 'buffer' as ResourceType,
    label: 'Skinning Matrices (mat3x3)',
    visibility: GPUShaderStage.VERTEX,
    usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'read-only-storage' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },

  // material
  color: {
    type: 'buffer' as ResourceType,
    label: 'Color (vec3)',
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  PBRMaterial: {
    type: 'buffer' as ResourceType,
    label: 'PBR Material Structure', // roughness(f32), metalness(f32), albedo(vec3<f32>), specular(vec3<f32>)
    visibility: GPUShaderStage.FRAGMENT,
    usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    layout: { 
      type: 'uniform' as GPUBufferBindingType
    } as GPUBufferBindingLayout
  },
  baseMap: { // texture
    type: 'texture' as ResourceType,
    label: 'Base Albedo Map ',
    visibility: GPUShaderStage.FRAGMENT,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    dimension: '2d' as GPUTextureDimension,
    format: 'rgba8unorm' as GPUTextureFormat,
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

  // for instanced mesh
  instanceInfo: {
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
          // if ((ResourceFormat[attribute].usage & GPUTextureUsage.COPY_DST) && !data[attribute])
          //   throw new Error(`${attribute} Needs Copy Data`);

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
            mipLevelCount: ResourceFormat[attribute].mipLevelCount || 1,
            dimension: ResourceFormat[attribute].dimension || '2d',
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
          if (ResourceFormat[attribute].usage & GPUTextureUsage.COPY_DST) {
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
          const textureSize = bitmaps.length === 6 ? [bitmaps[0].width, bitmaps[0].height] : ResourceFormat[attribute].size;
          let texture = device.createTexture({
            label: ResourceFormat[attribute].label,
            size: [...textureSize, 6],
            mipLevelCount: ResourceFormat[attribute].mipLevelCount || 1,
            dimension: ResourceFormat[attribute].dimension || '2d',
            format: ResourceFormat[attribute].format || 'rgba8unorm',
            usage: ResourceFormat[attribute].usage
          });

          if (bitmaps.length === 6) {
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
          }
          result[attribute] = texture;
          break;
        }

        case 'texture-array': {
          if ((ResourceFormat[attribute].usage & GPUTextureUsage.COPY_DST) && !data[attribute]) {
            throw new Error(`${attribute} Needs Copy Data`);
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
            size: [...textureSize, bitmaps.length],
            mipLevelCount: ResourceFormat[attribute].mipLevelCount || 1,
            dimension: ResourceFormat[attribute].dimension || '2d',
            format: ResourceFormat[attribute].format || 'rgba8unorm',
            usage: ResourceFormat[attribute].usage
          });
          for (let i = 0; i < bitmaps.length; i++) {
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
          throw new Error('Resource Type Not Support');
        }
      }
      
    }

    return result;

  }

}

export { ResourceFormat, ResourceFactory };
