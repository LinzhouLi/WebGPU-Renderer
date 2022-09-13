import * as THREE from 'three';
import { VertexBufferType, VertexBufferFactory } from './vertexBuffer';
import { SkinnedStandardMaterialBindGroupFactor, BindGroupFactor } from './bindGroup';

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

type BindGroupResources = GPUSampler | GPUTexture | GPUBuffer;

type RenderPipelineWithData = {
  pipeline: GPURenderPipeline,
  data: {
    vertexCount: number,
    vertexBuffers: GPUBuffer[],
    bindGroups: GPUBindGroup[]
  }
};

class Renderer {

  // basic
  adapter: GPUAdapter;
  device: GPUDevice;
  size: { width: number, height: number };
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  canvasTargetFormat: GPUTextureFormat;

  depthView: GPUTextureView;

  constructor(canvas: HTMLCanvasElement) {

    this.canvas = canvas;

  }

  async initWebGPU() {

    if(!navigator.gpu) throw new Error('Not Support WebGPU');

    // adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance' // 'low-power'
    });
    if (!adapter) throw new Error('No Adapter Found');
    this.adapter = adapter;

    // device
    this.device = await adapter.requestDevice();

    // context
    const context = this.canvas.getContext('webgpu');
    if (!context) throw new Error('Can Not Get GPUCanvasContext');
    this.context = context;

    // size
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    this.size = { width: this.canvas.width, height: this.canvas.height };

    // format
    this.canvasTargetFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: this.device, 
      format: this.canvasTargetFormat,
      alphaMode: 'opaque' // prevent chrome warning
    })

  }

  async initSceneResource(
    camera: THREE.PerspectiveCamera,
    light: THREE.PointLight
  ) {

    // create depthTexture for renderPass
    const depthTexture = this.device.createTexture({
      size: this.size, 
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthView = depthTexture.createView();

    // bind group for the scene
    const resourceFactory = new BindGroupFactor(this.device);
    const layouts = resourceFactory.createLayoutScene();
    const resources = await resourceFactory.createResourceScene(camera, light, layouts);
    return { 
      layouts: layouts,
      groups: resources.groups,
      updateResources: resources.updateResources,
    };

  }

  async initSkinnedMeshResource(
    mesh: THREE.SkinnedMesh,
    camera: THREE.PerspectiveCamera
  ) {

    const bufferFactory = new VertexBufferFactory(this.device, VertexBufferType.SKINNED | VertexBufferType.TANGENT);
    const resourceFactory = new SkinnedStandardMaterialBindGroupFactor(this.device);

    const vertexBufferLayouts = bufferFactory.createLayout();
    const vertexBuffers = await bufferFactory.createBuffer(mesh.geometry);

    const bindGroupLayouts = resourceFactory.createLayoutMesh();
    const bindGroupResources = await resourceFactory.createResourceMesh(mesh, camera, bindGroupLayouts);

    return {
      vertexBuffer: {
        layouts: vertexBufferLayouts,
        buffers: vertexBuffers
      },
      bindGroup: {
        layouts: bindGroupLayouts,
        groups: bindGroupResources.groups,
        updateResources: bindGroupResources.updateResources,
      }
    };

  }

  async initSkinnedMeshPipeline(
    layouts: {
      vertexBuffer: GPUVertexBufferLayout[],
      bindGroup: GPUBindGroupLayout[]
    },
    code: {
      vertexShader: string,
      fragmentShader: string,
    }
  ) {

    const pipeline = await this.device.createRenderPipelineAsync({
      label: 'Render Pipeline',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: layouts.bindGroup
      }),
      vertex: {
        module: this.device.createShaderModule({ code: code.vertexShader }),
        entryPoint: 'main',
        buffers: layouts.vertexBuffer
      },
      fragment: {
        module: this.device.createShaderModule({ code: code.fragmentShader }),
        entryPoint: 'main',
        targets: [{
          format: this.canvasTargetFormat
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth24plus',
      }
    });

    return pipeline;

  }

  update(updateInfo: {
    scene: {
      camera: THREE.PerspectiveCamera,
      updateResources: { projectionMatrixBuffer: GPUBuffer }
    },
    mesh: {
      mesh: THREE.SkinnedMesh,
      updateResources: {
        modelViewMatrixBuffer: GPUBuffer,
        boneMatricesBuffer: GPUBuffer
      }
    }[]
  }) {

    const camera = updateInfo.scene.camera;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    this.device.queue.writeBuffer(
      updateInfo.scene.updateResources.projectionMatrixBuffer, 0,
      new Float32Array(updateInfo.scene.camera.projectionMatrix.elements)
    );

    for (const meshInfo of updateInfo.mesh) {
      meshInfo.mesh.updateMatrixWorld();
      this.device.queue.writeBuffer(
        meshInfo.updateResources.modelViewMatrixBuffer, 0,
        new Float32Array(
          camera.matrixWorldInverse.multiply(meshInfo.mesh.matrixWorld).elements
        )
      );
      this.device.queue.writeBuffer(
        meshInfo.updateResources.boneMatricesBuffer, 0,
        new Float32Array(meshInfo.mesh.skeleton.boneMatrices)
      );
    }

  }

  draw(pipelines: RenderPipelineWithData[]) {

    const commandEncoder = this.device.createCommandEncoder();
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(), // output view buffer
        loadOp: 'clear', // operation to view before drawing: clear/load
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, // color to clear
        storeOp: 'store' // operation to view after drawing: discard/store
      }],
      depthStencilAttachment: {
        view: this.depthView,
        depthLoadOp: 'clear',
        depthClearValue: 1.0,
        depthStoreOp: 'store'
      }
    });

    for (const pipelineWithData of pipelines) {

      renderPassEncoder.setPipeline(pipelineWithData.pipeline);

      let slotIndex = 0;
      for (const vertexBuffer of pipelineWithData.data.vertexBuffers) {
        renderPassEncoder.setVertexBuffer(slotIndex, vertexBuffer);
        slotIndex++;
      }
      
      let groupIndex = 0;
      for (const group of pipelineWithData.data.bindGroups) {
        renderPassEncoder.setBindGroup(groupIndex, group);
        groupIndex++;
      }

      renderPassEncoder.draw(pipelineWithData.data.vertexCount);

    }

    renderPassEncoder.end();
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);

  }

}

export { Renderer };