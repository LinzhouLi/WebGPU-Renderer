import * as THREE from 'three';
import { device } from '../renderer';
import type { TypedArray } from '../base';
import {
  resourceFactory
} from '../base';


class GlobalObject {

  private camera: THREE.PerspectiveCamera;
  private light: THREE.PointLight;
  private scene: THREE.Scene;

  private resourceAttributes: string[]; // resource name
  private resourceCPUData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }; // resource in CPU
  public resource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  constructor(camera: THREE.PerspectiveCamera, light: THREE.PointLight, scene: THREE.Scene) {

    this.camera = camera;
    this.light = light;
    this.scene = scene;

  }

  public async initResource() {

    this.resourceAttributes = [
      'camera', 'pointLight', 
      'shadowMapSampler', 'shadowMap',
      'textureSampler', 'skyboxMap'
    ];

    this.resourceCPUData = {
      camera: new Float32Array([
        ...this.camera.position.toArray(), 0, // AlignOf(vec3<f32>) in wgsl is 16. see https://gpuweb.github.io/gpuweb/wgsl/#alignment
        ...this.camera.matrixWorldInverse.toArray(),
        ...this.camera.projectionMatrix.toArray()
      ]),
      pointLight : new Float32Array([
        ...this.light.position.toArray(), 0,
        ...this.light.color.toArray(), 0,
        ...this.light.shadow.camera.projectionMatrix.multiply(this.light.shadow.camera.matrixWorldInverse).toArray()
      ]),
      skyboxMap: (this.scene.background as THREE.CubeTexture).source.data
    }

    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);

  }

  public update() {

    // camera (position, view matrix, projection matrix)
    (this.resourceCPUData.camera as TypedArray).set([
      ...this.camera.position.toArray(), 0,
      ...this.camera.matrixWorldInverse.toArray(),
      ...this.camera.projectionMatrix.toArray()
    ]);

    device.queue.writeBuffer(
      this.resource.camera as GPUBuffer,
      0, this.resourceCPUData.camera as TypedArray
    );

  }

}

export { GlobalObject }