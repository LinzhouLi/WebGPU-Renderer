import * as THREE from 'three';
import { device, canvasFormat } from '../../renderer';
import type { TypedArray } from '../../base';
import {
  vertexBufferFactory,
  resourceFactory,
  bindGroupFactory
} from '../../base';

class InstancedMesh {

  mesh: THREE.Mesh;

  renderPipeline: GPURenderPipeline;
  shadowPipeline: GPURenderPipeline;

  instanceCount: number;
  vertexCount: number;
  vertexBufferAttributes: string[]; // resource name
  vertexBufferData: { [x: string]: TypedArray }; // resource in CPU
  vertexBuffers: { [x: string]: GPUBuffer }; // resource in GPU

  resourceAttributes: string[]; // resource name
  resourceData: { [x: string]: TypedArray | ImageBitmap | ImageBitmapSource }; // resource in CPU
  resources: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }; // resource in GPU

  constructor(mesh: THREE.Mesh) {

    this.mesh = mesh;

  }

  initVertexBuffer() {

    this.vertexBufferAttributes = ['position', 'normal', 'uv'];
    this.vertexBufferData = {
      position: this.mesh.geometry.attributes.position.array as TypedArray,
      normal: this.mesh.geometry.attributes.normal.array as TypedArray,
      uv: this.mesh.geometry.attributes.uv.array as TypedArray,
    };

    if (!!this.mesh.geometry.index) {
      this.vertexBufferAttributes.push('index');
      this.vertexBufferData.index = this.mesh.geometry.index.array as TypedArray;
      this.vertexCount = this.mesh.geometry.index.count;
    }
    else {
      this.vertexCount = this.mesh.geometry.attributes.position.count;
    }

    if (!!this.mesh.geometry.attributes.tangent) {
      this.vertexBufferAttributes.push('tangent');
      this.vertexBufferData.tangent = this.mesh.geometry.attributes.tangent.array as TypedArray;
    }

    this.vertexBuffers = vertexBufferFactory.createResource(this.vertexBufferAttributes, this.vertexBufferData);

  }



}

export { InstancedMesh };