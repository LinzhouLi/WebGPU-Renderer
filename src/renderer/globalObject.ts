import * as THREE from 'three';
import { device } from './renderer';
import type { TypedArray } from './base';
import {
  resourceFactory,
  bindGroupFactory
} from './base';


class GlobalObject {

  camera: THREE.PerspectiveCamera;
  light: THREE.PointLight;

  bindGroupAttributes: string[]; // resource name
  bindGroupData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }; // resource in CPU
  bindGroupResources: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  constructor(camera: THREE.PerspectiveCamera, light: THREE.PointLight) {

    this.camera = camera;
    this.light = light;

  }

  async initGroupResource() {

    this.bindGroupAttributes = [
      'viewMatCamera', 'projectionMatCamera', 'cameraPosition',
      'viewProjectionMatLight', 'lightPosition', 'shadowMapSampler', 'shadowMap'
    ];

    this.bindGroupData = {
      viewMatCamera: new Float32Array(
        this.camera.matrixWorldInverse.toArray()
      ),
      projectionMatCamera: new Float32Array(
        this.camera.projectionMatrix.toArray()
      ),
      cameraPosition: new Float32Array(
        this.camera.position.toArray()
      ),
      viewProjectionMatLight: new Float32Array(
        this.light.shadow.camera.projectionMatrix.multiply(this.light.shadow.camera.matrixWorldInverse).toArray()
      ),
      lightPosition: new Float32Array(
        this.light.position.toArray()
      )
    }

    this.bindGroupResources = await resourceFactory.createResource(this.bindGroupAttributes, this.bindGroupData);

  }

  createRenderBindGroup() {

    return bindGroupFactory.create(
      [
        'viewMatCamera', 'projectionMatCamera', 'cameraPosition',
        'viewProjectionMatLight', 'lightPosition', 'shadowMapSampler', 'shadowMap'
      ],
      this.bindGroupResources
    );

  }

  createShadowBindGroup() {

    return bindGroupFactory.create(
      [ 'viewProjectionMatLight' ],
      this.bindGroupResources
    );

  }

  update() {

    // view matrix from camera
    (this.bindGroupData.viewMatCamera as TypedArray).set(
      this.camera.matrixWorldInverse.toArray()
    );
    device.queue.writeBuffer(
      this.bindGroupResources.viewMatCamera as GPUBuffer,
      0, this.bindGroupData.viewMatCamera as TypedArray
    );

    // camera position
    (this.bindGroupData.cameraPosition as TypedArray).set(
      this.camera.position.toArray()
    );
    device.queue.writeBuffer(
      this.bindGroupResources.cameraPosition as GPUBuffer,
      0, this.bindGroupData.cameraPosition as TypedArray
    );

  }

}

export { GlobalObject }