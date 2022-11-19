import * as THREE from 'three';
import { device, canvasFormat } from '../../renderer';
import type { TypedArray } from '../../base';
import { vertexBufferFactory, resourceFactory, bindGroupFactory } from '../../base';
import { RenderableObject } from '../renderableObject';
import { createVertexShader } from './vertexShader';
import { createFragmentShader } from './fragmentShader';
import type { ResourceType, BufferData, TextureData, TextureArrayData } from '../../resource/resuorce';
import { ResourceFactory } from '../../resource/resuorce';
import { InstancedMesh } from './instancedMesh';

class InstancedSkinnedMesh extends InstancedMesh {

  private static _ResourceFormats = {

  }

  protected declare mesh: THREE.SkinnedMesh;

  constructor(mesh: THREE.SkinnedMesh, instanceCount: number) {

    super(mesh, instanceCount);

  }

}