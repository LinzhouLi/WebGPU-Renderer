import * as THREE from 'three';

import { RenderComponentBase } from './base';
import type {
  SceneUpdateResource, BasicUpdateResource, SkinnedUpdateResource
} from './bindGroup';
import {
  GlobalBindGroupFactory, BasicBindGroupFactory, 
  SkinnedBasicBindGroupFactory, SkinnedStandardBindGroupFactory
} from './bindGroup';
import { VertexBuffer, VertexBufferFactory, VertexBufferType } from './vertexBuffer';


// console.info( 'THREE.WebGPURenderer: Modified Matrix4.makePerspective() and Matrix4.makeOrtographic() to work with WebGPU, see https://github.com/mrdoob/three.js/issues/20276.' );

THREE.Matrix4.prototype.makePerspective = function ( left, right, top, bottom, near, far ) : THREE.Matrix4 {
  
	const te = this.elements;
	const x = 2 * near / ( right - left );
	const y = 2 * near / ( top - bottom );

	const a = ( right + left ) / ( right - left );
	const b = ( top + bottom ) / ( top - bottom );
	const c = - far / ( far - near );
	const d = - far * near / ( far - near );

	te[ 0 ] = x;	te[ 4 ] = 0;	te[ 8 ] = a;	te[ 12 ] = 0;
	te[ 1 ] = 0;	te[ 5 ] = y;	te[ 9 ] = b;	te[ 13 ] = 0;
	te[ 2 ] = 0;	te[ 6 ] = 0;	te[ 10 ] = c;	te[ 14 ] = d;
	te[ 3 ] = 0;	te[ 7 ] = 0;	te[ 11 ] = - 1;	te[ 15 ] = 0;

	return this;

};

THREE.Matrix4.prototype.makeOrthographic = function ( left, right, top, bottom, near, far ) {

	const te = this.elements;
	const w = 1.0 / ( right - left );
	const h = 1.0 / ( top - bottom );
	const p = 1.0 / ( far - near );

	const x = ( right + left ) * w;
	const y = ( top + bottom ) * h;
	const z = near * p;

	te[ 0 ] = 2 * w;	te[ 4 ] = 0;		te[ 8 ] = 0;		te[ 12 ] = - x;
	te[ 1 ] = 0;		te[ 5 ] = 2 * h;	te[ 9 ] = 0;		te[ 13 ] = - y;
	te[ 2 ] = 0;		te[ 6 ] = 0;		te[ 10 ] = - 1 * p;	te[ 14 ] = - z;
	te[ 3 ] = 0;		te[ 7 ] = 0;		te[ 11 ] = 0;		te[ 15 ] = 1;

	return this;

};

THREE.Frustum.prototype.setFromProjectionMatrix = function ( m ) {

	const planes = this.planes;
	const me = m.elements;
	const me0 = me[ 0 ], me1 = me[ 1 ], me2 = me[ 2 ], me3 = me[ 3 ];
	const me4 = me[ 4 ], me5 = me[ 5 ], me6 = me[ 6 ], me7 = me[ 7 ];
	const me8 = me[ 8 ], me9 = me[ 9 ], me10 = me[ 10 ], me11 = me[ 11 ];
	const me12 = me[ 12 ], me13 = me[ 13 ], me14 = me[ 14 ], me15 = me[ 15 ];

	planes[ 0 ].setComponents( me3 - me0, me7 - me4, me11 - me8, me15 - me12 ).normalize();
	planes[ 1 ].setComponents( me3 + me0, me7 + me4, me11 + me8, me15 + me12 ).normalize();
	planes[ 2 ].setComponents( me3 + me1, me7 + me5, me11 + me9, me15 + me13 ).normalize();
	planes[ 3 ].setComponents( me3 - me1, me7 - me5, me11 - me9, me15 - me13 ).normalize();
	planes[ 4 ].setComponents( me3 - me2, me7 - me6, me11 - me10, me15 - me14 ).normalize();
	planes[ 5 ].setComponents( me2, me6, me10, me14 ).normalize();

	return this;

};

const SupportMeshType = ['basic', 'skinnedBasic', 'skinnedStandard'];

class GlobalRenderObject extends RenderComponentBase {

  camera: THREE.PerspectiveCamera | null;
  light: THREE.PointLight | null;

  groups: GPUBindGroup[];
  updateResource: SceneUpdateResource | null;

  private static resourceFactory: GlobalBindGroupFactory;
  public static bindGroupLayouts: GPUBindGroupLayout[];

  constructor(device: GPUDevice) {

    super(device);

    this.camera = null;
    this.light = null;
    this.updateResource = null;

    GlobalRenderObject.resourceFactory = new GlobalBindGroupFactory(device);
    GlobalRenderObject.bindGroupLayouts = GlobalRenderObject.resourceFactory.createLayout();

  }

  async init() {

    const resource = await GlobalRenderObject.resourceFactory.createResource(this.light, this.camera);
    this.groups = resource.groups;
    this.updateResource = resource.updateResources;

  }

  update(): void {
    
    const camera = this.camera;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    this.device.queue.writeBuffer(
      this.updateResource.projectionMatrixBuffer, 0,
      new Float32Array(camera.projectionMatrix.elements)
    );
    this.device.queue.writeBuffer(
      this.updateResource.viewMatrixBuffer, 0,
      new Float32Array(camera.matrixWorldInverse.elements)
    );
    this.device.queue.writeBuffer(
      this.updateResource.cameraPositionBuffer, 0,
      new Float32Array([camera.position.x, camera.position.y, camera.position.z])
    );

  }

}


abstract class RenderObject extends RenderComponentBase {

  mesh: THREE.Mesh | null;

  groups: GPUBindGroup[];
  vertexBuffer: VertexBuffer;
  updateResource: any; // fix

  constructor(device: GPUDevice) {

    super(device);

  }

  abstract update(): void

  abstract init(globalRenderObject: GlobalRenderObject): Promise<void>;

}

class BasicRenderObject extends RenderObject {

  declare updateResource: BasicUpdateResource | null;

  private static resourceFactory: BasicBindGroupFactory;
  private static vertexBufferFactory: VertexBufferFactory;
  
  public static bindGroupLayouts: GPUBindGroupLayout[];
  public static vertexBufferLayouts: GPUVertexBufferLayout[];

  constructor(device: GPUDevice) {

    super(device);
    
    this.mesh = null;
    this.updateResource = null;

    BasicRenderObject.resourceFactory = new BasicBindGroupFactory(device);
    BasicRenderObject.vertexBufferFactory = new VertexBufferFactory(
      device, 
      VertexBufferType.NONE
    );

    BasicRenderObject.bindGroupLayouts = [
      ...GlobalRenderObject.bindGroupLayouts,
      ...BasicRenderObject.resourceFactory.createLayout()
    ];
    BasicRenderObject.vertexBufferLayouts = BasicRenderObject.vertexBufferFactory.createLayout();

  }

  async init(globalRenderObject: GlobalRenderObject) {

    const resource = await BasicRenderObject.resourceFactory.createResource(
      this.mesh,
      globalRenderObject.camera
    );
    this.groups = [...globalRenderObject.groups, ...resource.groups];
    this.updateResource = resource.updateResources;
    this.vertexBuffer = await BasicRenderObject.vertexBufferFactory.createBuffer(this.mesh.geometry);

  }

  update(): void {
    
    this.mesh.updateMatrixWorld();
    this.device.queue.writeBuffer(
      this.updateResource.modelMatrixBuffer, 0,
      new Float32Array(
        this.mesh.matrixWorld.elements
      )
    );

  }

}

class SkinnedBasicRenderObject extends RenderObject {

  declare mesh: THREE.SkinnedMesh | null;
  declare updateResource: SkinnedUpdateResource | null;

  private static resourceFactory: SkinnedBasicBindGroupFactory;
  private static vertexBufferFactory: VertexBufferFactory;
  
  public static bindGroupLayouts: GPUBindGroupLayout[];
  public static vertexBufferLayouts: GPUVertexBufferLayout[];

  constructor(device: GPUDevice) {

    super(device);
    
    this.mesh = null;
    this.updateResource = null;

    SkinnedBasicRenderObject.resourceFactory = new SkinnedBasicBindGroupFactory(device);
    SkinnedBasicRenderObject.vertexBufferFactory = new VertexBufferFactory(
      device, 
      VertexBufferType.UV | VertexBufferType.SKINNED
    );

    SkinnedBasicRenderObject.bindGroupLayouts = [
      ...GlobalRenderObject.bindGroupLayouts,
      ...SkinnedBasicRenderObject.resourceFactory.createLayout()
    ];
    SkinnedBasicRenderObject.vertexBufferLayouts = SkinnedBasicRenderObject.vertexBufferFactory.createLayout();

  }

  async init(globalRenderObject: GlobalRenderObject) {

    const resource = await SkinnedBasicRenderObject.resourceFactory.createResource(
      this.mesh,
      globalRenderObject.camera
    );
    this.groups = [...globalRenderObject.groups, ...resource.groups];
    this.updateResource = resource.updateResources;
    this.vertexBuffer = await SkinnedBasicRenderObject.vertexBufferFactory.createBuffer(this.mesh.geometry);

  }

  update(): void {
    
    this.mesh.updateMatrixWorld();
    this.device.queue.writeBuffer(
      this.updateResource.modelMatrixBuffer, 0,
      new Float32Array(
        this.mesh.matrixWorld.elements
      )
    );
    this.device.queue.writeBuffer(
      this.updateResource.boneMatricesBuffer, 0,
      new Float32Array(this.mesh.skeleton.boneMatrices)
    );

  }

}

class SkinnedStandardRenderObject extends RenderObject {

  declare mesh: THREE.SkinnedMesh | null;
  declare updateResource: SkinnedUpdateResource | null;

  private static resourceFactory: SkinnedStandardBindGroupFactory;
  private static vertexBufferFactory: VertexBufferFactory;

  public static bindGroupLayouts: GPUBindGroupLayout[];
  public static vertexBufferLayouts: GPUVertexBufferLayout[];

  constructor(device: GPUDevice) {

    super(device);
    
    this.mesh = null;
    this.updateResource = null;

    SkinnedStandardRenderObject.resourceFactory = new SkinnedStandardBindGroupFactory(device);
    SkinnedStandardRenderObject.vertexBufferFactory = new VertexBufferFactory(
      device, 
      VertexBufferType.UV | VertexBufferType.SKINNED | VertexBufferType.TANGENT
    );

    SkinnedStandardRenderObject.bindGroupLayouts = [
      ...GlobalRenderObject.bindGroupLayouts,
      ...SkinnedStandardRenderObject.resourceFactory.createLayout()
    ];
    SkinnedStandardRenderObject.vertexBufferLayouts = SkinnedStandardRenderObject.vertexBufferFactory.createLayout();

  }

  async init(globalRenderObject: GlobalRenderObject) {

    const resource = await SkinnedStandardRenderObject.resourceFactory.createResource(
      this.mesh,
      globalRenderObject.camera
    );
    this.groups = [...globalRenderObject.groups, ...resource.groups];
    this.updateResource = resource.updateResources;
    this.vertexBuffer = await SkinnedStandardRenderObject.vertexBufferFactory.createBuffer(this.mesh.geometry);

  }

  update(): void {
    
    this.mesh.updateMatrixWorld();
    this.device.queue.writeBuffer(
      this.updateResource.modelMatrixBuffer, 0,
      new Float32Array(
        this.mesh.matrixWorld.elements
      )
    );
    this.device.queue.writeBuffer(
      this.updateResource.boneMatricesBuffer, 0,
      new Float32Array(this.mesh.skeleton.boneMatrices)
    );

  }

}

class RenderObjects extends RenderComponentBase {

  global: GlobalRenderObject;

  basic: BasicRenderObject[];

  skinnedBasic: SkinnedBasicRenderObject[];

  skinnedStandard: SkinnedStandardRenderObject[];

  constructor(device: GPUDevice) {

    super(device);

    this.global = new GlobalRenderObject(device);
    this.global.camera = null;
    this.global.light = null;

    this.basic = [];
    this.skinnedBasic = [];
    this.skinnedStandard = [];

  }

  async init(scene: THREE.Scene) {

    this.global.camera = null;
    this.global.light = null;
    this.basic = [];
    this.skinnedBasic = [];
    this.skinnedStandard = [];

    scene.traverse(obj => {

      if (obj instanceof THREE.PerspectiveCamera) {
        if (this.global.camera === null) 
          this.global.camera = obj;
        else 
          throw new Error('More Than One Camera');
      }
      else if (obj instanceof THREE.PointLight) {
        if (this.global.light === null) 
          this.global.light = obj;
        else 
          throw new Error('More Than One PointLight');
      }
      else if (obj instanceof THREE.SkinnedMesh) {
        if (obj.material instanceof THREE.MeshStandardMaterial) {
          let object = new SkinnedStandardRenderObject(this.device);
          object.mesh = obj;
          this.skinnedStandard.push(object);
        }
        else {
          let object = new SkinnedBasicRenderObject(this.device);
          object.mesh = obj;
          this.skinnedBasic.push(object);
        }
      }
      else if (obj instanceof THREE.Mesh) {
        let object = new BasicRenderObject(this.device);
        object.mesh = obj;
        this.basic.push(object);
      }

    });

    if (this.global.camera === null) throw new Error('No Camera');
    if (this.global.light === null) throw new Error('No Light');
    
    await this.global.init();
    for (let object of this.basic) await object.init(this.global);
    for (let object of this.skinnedBasic) await object.init(this.global);
    for (let object of this.skinnedStandard) await object.init(this.global);

  }

  update() {

    // update global resources
    this.global.update();

    // update basic mesh resources
    for (const object of this.basic) {
      object.update();
    }

    // update skinnedBasic mesh resources
    for (const object of this.skinnedBasic) {
      object.update();
    }

    // update skinnedStandard mesh resources
    for (const object of this.skinnedStandard) {
      object.update();
    }

  }

}

export { 
  SupportMeshType, GlobalRenderObject, RenderObject, BasicRenderObject,
  SkinnedBasicRenderObject, SkinnedStandardRenderObject, RenderObjects 
};