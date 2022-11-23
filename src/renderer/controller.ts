import * as THREE from 'three';
import { device, canvasFormat } from './renderer';
import { RenderableObject } from './object/renderableObject';
import { GlobalResource } from './globalResource';
import { Mesh } from './object/basic/mesh';
import { SkinnedMesh } from './object/basic/skinnedMesh';
import { InstancedMesh } from './object/instanced/instancedMesh';
import { InstancedSkinnedMesh } from './object/instanced/InstancedSkinnedMesh';
import { Skybox } from './object/skybox';
import { IBL } from './precompute/IBL';
import { GBUfferResource } from './gbufferResource';
import { DeferredShading } from './postprocess/deferredShading';
import { PostProcess } from './postprocess/postprocess';

// console.info( 'THREE.WebGPURenderer: Modified Matrix4.makePerspective() and Matrix4.makeOrtographic() to work with WebGPU, see https://github.com/mrdoob/three.js/issues/20276.' );
// @ts-ignore
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


class RenderController {

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private light: THREE.PointLight | THREE.DirectionalLight;

  private renderDepthMapView: GPUTextureView;
  private shadowMapView: GPUTextureView;

  public globalResource: GlobalResource;
  public gbufferResource: GBUfferResource;

  public objectList: RenderableObject[];
  
  public iBL: IBL;

  public postprocesses: PostProcess[];

  public shadowBundle: GPURenderBundle;
  public renderBundle: GPURenderBundle;

  constructor() {

    this.objectList = [];

  }

  private RegisterResourceFormats() {
    IBL.RegisterResourceFormats();
    GlobalResource.RegisterResourceFormats();
    GBUfferResource.RegisterResourceFormats();
    Mesh.RegisterResourceFormats();
    SkinnedMesh.RegisterResourceFormats();
    InstancedMesh.RegisterResourceFormats();
    InstancedSkinnedMesh.RegisterResourceFormats();
  }

  public addRenderableObject(obj: RenderableObject) {

    this.objectList.push(obj);

  }

  public initScene(scene: THREE.Scene) {

    this.scene = scene;
    this.camera = null;
    this.light = null;
    
    scene.traverse(obj => {
      if (obj instanceof THREE.PerspectiveCamera) {
        if (this.camera === null) 
          this.camera = obj;
        else 
          throw new Error('More Than One Camera');
      }
      else if (obj instanceof THREE.PointLight || obj instanceof THREE.DirectionalLight) {
        if (this.light === null) 
          this.light = obj;
        else 
          throw new Error('More Than One Light');
      } // @ts-ignore
      else if (obj.isSkinnedMesh) {
        this.objectList.push(new SkinnedMesh(obj as THREE.SkinnedMesh));
      } // @ts-ignore
      else if (obj.isMesh) {
        this.objectList.push(new Mesh(obj as THREE.Mesh));
      }
    });
    
    if (this.camera === null) throw new Error('No Camera');
    if (this.light === null) throw new Error('No Light');

    this.globalResource = new GlobalResource(this.camera, this.light, this.scene);
    this.gbufferResource = new GBUfferResource();

    // pre compute
    this.iBL = new IBL();

    // post process
    this.postprocesses = [
      new DeferredShading()
    ];

  }

  public async initResources() {
    
    this.RegisterResourceFormats();

    // update information
    this.updateMatrix();

    // global and gbuffer resources
    await this.globalResource.initResource();
    await this.gbufferResource.initResource();

    // per object resources
    this.objectList.push(new Skybox()); // render skybox at last
    for (const meshObject of this.objectList) {
      meshObject.initVertexBuffer();
      await meshObject.initGroupResource();
    }

    // render attachments (render pass and shadow pass)
    this.renderDepthMapView = (this.globalResource.resource.renderDepthMap as GPUTexture).createView();
    this.shadowMapView = (this.globalResource.resource.shadowMap as GPUTexture).createView();

    // pre compute resource
    await this.precompute();

  }

  public async precompute() {
    
    await this.iBL.initComputePipeline(this.globalResource.resource);
    device.queue.submit([
      this.iBL.run()
    ]);
    await device.queue.onSubmittedWorkDone();
    this.iBL.finish();
    
  }

  public async initRenderPass() {

    const targetFormats = this.postprocesses[0].inputGBuffers.map(
      attribute => GBUfferResource.Formats[attribute] as GPUTextureFormat
    );
    const targetStates = targetFormats.map(targetFormat => {
      return { format: targetFormat } as GPUColorTargetState
    });

    const renderBundleEncoder = device.createRenderBundleEncoder({
      label: 'Render Pass',
      colorFormats: targetFormats,
      depthStencilFormat: 'depth32float'
    });

    for (const meshObject of this.objectList) {
      await meshObject.setRenderBundle(
        renderBundleEncoder, 
        targetStates,
        this.globalResource.resource
      );
    }

    this.renderBundle = renderBundleEncoder.finish();

  }

  public async initShadowPass() {

    const shadowBundleEncoder = device.createRenderBundleEncoder({
      label: 'Shadow Pass',
      colorFormats: [],
      depthStencilFormat: 'depth32float'
    });

    for (const meshObject of this.objectList) {
      await meshObject.setShadowBundle(shadowBundleEncoder, this.globalResource.resource);
    }

    this.shadowBundle = shadowBundleEncoder.finish();

  }

  public async initPostProcessPasses() {

    let promises = this.postprocesses.map(postprocess => 
      postprocess.setRenderBundle(this.globalResource.resource, this.gbufferResource.resource)
    );

    return Promise.all(promises);

  }

  public draw(contextView: GPUTextureView) {

    this.gbufferResource.views.canvas = contextView; // update canvas texture view

    const commandEncoder = device.createCommandEncoder();

    // shadow pass
    const shadowPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowMapView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });
    shadowPassEncoder.executeBundles([this.shadowBundle]);
    shadowPassEncoder.end();

    // render pass
    const targetAttachments = this.postprocesses[0].inputGBuffers.map(attribute => {
      return {
        view: this.gbufferResource.views[attribute],
        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      } as GPURenderPassColorAttachment
    });

    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: targetAttachments,
      depthStencilAttachment: {
        view: this.renderDepthMapView,
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });
    renderPassEncoder.executeBundles([this.renderBundle]);
    renderPassEncoder.end();

    // post process
    this.postprocesses.forEach(postprocess => {
      postprocess.execute(commandEncoder, this.gbufferResource.views);
      postprocess.update(this.gbufferResource.resource);
    })

    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

  }

  private updateMatrix() {

    this.scene.updateMatrixWorld();
    this.camera.updateProjectionMatrix();

    this.light.shadow.camera.position.setFromMatrixPosition( this.light.matrixWorld );
    this.light.shadow.camera.updateMatrixWorld();
    this.light.shadow.camera.updateProjectionMatrix();
    
  }

  public update() {

    this.updateMatrix();
    this.globalResource.update();
    for (const meshObject of this.objectList) meshObject.update();

  }

}

export { RenderController };