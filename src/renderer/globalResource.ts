import * as THREE from 'three';
import { device, canvasSize } from './renderer';
import type { TypedArray } from './base';
import { resourceFactory } from './base';
import type { ResourceType, BufferData, TextureData, TextureArrayData } from './resource/resuorce';
import { ResourceFactory } from './resource/resuorce';


class GlobalResource {

  private camera: THREE.PerspectiveCamera;
  private light: THREE.PointLight | THREE.DirectionalLight;
  private lightType: 'pointLight' | 'directionalLight';
  private scene: THREE.Scene;

  private resourceAttributes: string[]; // resource name
  private resourceCPUData: Record<string, BufferData | TextureData | TextureArrayData>; // resource in CPU
  
  public resource: Record<string, GPUBuffer | GPUTexture | GPUSampler>; // resource in GPU

  constructor(camera: THREE.PerspectiveCamera, light: THREE.PointLight | THREE.DirectionalLight, scene: THREE.Scene) {

    this.camera = camera;
    this.light = light;
    this.scene = scene;
    this.lightType = light instanceof THREE.PointLight ? 'pointLight' : 'directionalLight';

  }

  public static RegisterResourceFormats() {
    ResourceFactory.RegisterFormats({

      // render attachment // no binding
      renderDepthMap: {
        type: 'texture' as ResourceType,
        label: 'Render Depth Map',
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        size: [canvasSize.width, canvasSize.height],
        dimension: '2d' as GPUTextureDimension,
        format: 'depth32float' as GPUTextureFormat,
      },
  
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
      shadowMat: {
        type: 'buffer' as ResourceType,
        label: 'ViewProjection Matrix for shadow',
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        usage:  GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        layout: { 
          type: 'uniform' as GPUBufferBindingType
        } as GPUBufferBindingLayout
      },
  
      // sampler
      compareSampler: {
        type: 'sampler' as ResourceType,
        label: 'Compare Sampler',
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
        label: 'Linear Sampler',
        visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.COMPUTE,
        magFilter: 'linear' as GPUFilterMode,
        minFilter: 'linear' as GPUFilterMode,
        layout: { 
          type: 'filtering' as GPUSamplerBindingType 
        } as GPUSamplerBindingLayout
      }, 
      nonFilterSampler: {
        type: 'sampler' as ResourceType,
        label: 'Non Filter Sampler',
        visibility: GPUShaderStage.FRAGMENT,
        magFilter: 'nearest' as GPUFilterMode,
        minFilter: 'nearest' as GPUFilterMode,
        layout: { 
          type: 'non-filtering' as GPUSamplerBindingType 
        } as GPUSamplerBindingLayout
      },
  
    });
  }

  public async initResource() {

    this.resourceAttributes = [
      'renderDepthMap',
      'camera', this.lightType, 'shadowMat',
      'shadowMap', 'envMap', 'diffuseEnvMap',
      'compareSampler', 'linearSampler', 'nonFilterSampler',
      'DFG',
    ];

    let lightPosOrDir;
    if (this.lightType === 'pointLight') {
      this.light.position.setFromMatrixPosition(this.light.matrixWorld);
      lightPosOrDir = this.light.position;
    }
    else if (this.lightType === 'directionalLight') {
      const light = this.light as THREE.DirectionalLight;
      light.position.setFromMatrixPosition(light.matrixWorld);
      light.target.position.setFromMatrixPosition(light.target.matrixWorld);
      lightPosOrDir = light.position.clone().sub(light.target.position).normalize();
    }

    let lightColor = new THREE.Vector3(...this.light.color.toArray()).setScalar(this.light.intensity);
    let shadowMat = this.light.shadow.camera.projectionMatrix.multiply(this.light.shadow.camera.matrixWorldInverse);

    const background = this.scene.background as THREE.CubeTexture;
    this.resourceCPUData = {
      camera: { value: new Float32Array(4 + 16 + 16) }, // update per frame
      shadowMat: { value: new Float32Array(shadowMat.toArray()) },
      [this.lightType]: { 
        value: new Float32Array([
          ...lightPosOrDir.toArray(), 0,
          ...lightColor.toArray(), 0,
          ...shadowMat.toArray()
        ])
      },
      envMap: { 
        value: await resourceFactory.toBitmaps(background.image),
        flipY: new Array(6).fill(background.flipY)
      }
    }
    
    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);

  }

  public update() {

    // camera (position, view matrix, projection matrix)
    this.camera.position.setFromMatrixPosition(this.camera.matrixWorld);
    const cameraBufferData = this.resourceCPUData.camera as BufferData;
    cameraBufferData.value.set([
      ...this.camera.position.toArray(), 0,
      ...this.camera.matrixWorldInverse.toArray(),
      ...this.camera.projectionMatrix.toArray()
    ]);

    device.queue.writeBuffer(
      this.resource.camera as GPUBuffer, 0, 
      cameraBufferData.value as TypedArray, 0
    );

  }

}

export { GlobalResource }