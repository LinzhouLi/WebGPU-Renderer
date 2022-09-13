import * as THREE from 'three';

const VertexBufferFormat = {
  position: {
    cpuFormat: '[object Float32Array]',
    gpuFormat: 'float32x3' as GPUVertexFormat,
    stride: 3 * 4
  },
  normal: {
    cpuFormat: '[object Float32Array]',
    gpuFormat: 'float32x3' as GPUVertexFormat,
    stride: 3 * 4
  },
  color: {
    cpuFormat: '[object Float32Array]',
    gpuFormat: 'float32x4' as GPUVertexFormat,
    stride: 4 * 4
  },
  uv: {
    cpuFormat: '[object Float32Array]',
    gpuFormat: 'float32x2' as GPUVertexFormat,
    stride: 2 * 4
  },
  tangent: {
    cpuFormat: '[object Float32Array]',
    gpuFormat: 'float32x4' as GPUVertexFormat,
    stride: 4 * 4
  },
  skinIndex: {
    cpuFormat: '[object Uint16Array]',
    gpuFormat: 'uint16x4' as GPUVertexFormat,
    stride: 4 * 2
  },
  skinWeight: {
    cpuFormat: '[object Float32Array]',
    gpuFormat: 'float32x4' as GPUVertexFormat,
    stride: 4 * 4
  },
}

type TypedArray = Float64Array | Float32Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array;

const VertexBufferType = {
  COLOR: 1,
  TANGENT: 2,
  SKINNED: 4
};

class VertexBufferFactory {

  device: GPUDevice;
  bufferOrder: string[];

  constructor(device: GPUDevice, type: number) {

    this.device = device;

    this.bufferOrder = ['position', 'normal', 'uv'];

    if (type & VertexBufferType.COLOR) this.bufferOrder.push('color');
    if (type & VertexBufferType.TANGENT) this.bufferOrder.push('tangent');
    if (type & VertexBufferType.SKINNED) this.bufferOrder.push('skinIndex', 'skinWeight');

  }

  createLayout() {

    let vertexBufferLayouts: GPUVertexBufferLayout[] = [];
    let shaderLocation = 0;

    for (let attributeName of this.bufferOrder) {

      // set buffer layout
      vertexBufferLayouts.push({ // GPUVertexBufferLayout
        arrayStride: VertexBufferFormat[attributeName].stride,
        attributes: [{
          shaderLocation: shaderLocation,
          offset: 0,
          format: VertexBufferFormat[attributeName].gpuFormat
        }]
      });

      shaderLocation++;

    }

    return vertexBufferLayouts;

  }

  async createBuffer(geometry: THREE.BufferGeometry) {

    let vertexBuffers: GPUBuffer[] = [];

    for (let attributeName of this.bufferOrder) {

      const bufferAttribute = geometry.attributes[attributeName];
      if (!bufferAttribute) 
        throw new Error(`Not Found Buffer Attribute: ${attributeName}`);
      if (Object.prototype.toString.call(bufferAttribute.array) != VertexBufferFormat[attributeName].cpuFormat) 
        throw new Error(`Invalid Array Type of Buffer Attribute: ${attributeName}`)
      
      // get buffer data
      const bufferDataArray = bufferAttribute.array as TypedArray;
        
      // create buffer
      const vertexBuffer = this.device.createBuffer({
        size: bufferDataArray.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.device.queue.writeBuffer(vertexBuffer, 0, bufferDataArray);
      vertexBuffers.push(vertexBuffer);
      
    }

    return vertexBuffers;

  }

}

export { VertexBufferType, VertexBufferFactory };