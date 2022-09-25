import { VertexBufferFactory } from './vertexBuffer';
import { ResourceFactory } from './resuorce';
import { BindGroupFactory } from './bindGroup';

type TypedArray = Float64Array | Float32Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array;

const vertexBufferFactory = new VertexBufferFactory();
const resourceFactory = new ResourceFactory();
const bindGroupFactory = new BindGroupFactory();

export type { TypedArray };

export {
  vertexBufferFactory,
  resourceFactory,
  bindGroupFactory
};