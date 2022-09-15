import * as THREE from 'three';

import { 
  BasicRenderPipelineFactory, SkinnedBasicRenderPipelineFactory, 
  SkinnedStandardRenderPipelineFactory
} from './pipeline';
import { RenderObject, RenderObjects } from './renderObjects';

class Renderer {

  // basic
  adapter: GPUAdapter;
  device: GPUDevice;
  size: { width: number, height: number };
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  canvasTargetFormat: GPUTextureFormat;

  depthView: GPUTextureView;

  // pipelines
  pipelines: {
    basic: GPURenderPipeline | null,
    skinnedBasic: GPURenderPipeline | null,
    skinnedStandard: GPURenderPipeline | null
  }

  // render objects
  renderObjects: RenderObjects;

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

  async initPipeline(scene: THREE.Scene) {

    const depthTexture = this.device.createTexture({
      size: this.size, 
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    this.depthView = depthTexture.createView()

    this.pipelines = {
      basic: null,
      skinnedBasic: null,
      skinnedStandard: null
    };

    this.renderObjects = new RenderObjects(this.device);
    await this.renderObjects.init(scene);
    
    if (this.renderObjects.basic.length > 0) {
      const pipelineFactory = new BasicRenderPipelineFactory(this.device);
      this.pipelines.basic = await pipelineFactory.create(this.canvasTargetFormat);
    }
    
    if (this.renderObjects.skinnedBasic.length > 0) {
      const pipelineFactory = new SkinnedBasicRenderPipelineFactory(this.device);
      this.pipelines.skinnedBasic = await pipelineFactory.create(this.canvasTargetFormat);
    }
    
    if (this.renderObjects.skinnedStandard.length > 0) {
      const pipelineFactory = new SkinnedStandardRenderPipelineFactory(this.device);
      this.pipelines.skinnedStandard = await pipelineFactory.create(this.canvasTargetFormat);
    }
    
  }

  update() {

    this.renderObjects.update();

  }

  draw() {

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

    for (const key in this.pipelines) { // change pipeline

      const pipeline = this.pipelines[key] as GPURenderPipeline;

      if (pipeline) {

        renderPassEncoder.setPipeline(pipeline);

        const renderObjects = this.renderObjects[key] as RenderObject[];

        for (const renderObject of renderObjects) { // change render object (mesh)

          // set vertex buffer slots
          let slotIndex = 0;
          for (const vertexBuffer of renderObject.vertexBuffer.attributes) {
            if (vertexBuffer) {
              renderPassEncoder.setVertexBuffer(slotIndex, vertexBuffer);
            }
            slotIndex++;
          }

          // set bind group
          let groupIndex = 0;
          for (const group of renderObject.groups) {
            renderPassEncoder.setBindGroup(groupIndex, group);
            groupIndex++;
          }

          // set index buffer and draw
          if (renderObject.vertexBuffer.index) {
            renderPassEncoder.setIndexBuffer(renderObject.vertexBuffer.index, 'uint16');
            renderPassEncoder.drawIndexed(renderObject.vertexBuffer.vertexCount);
          }
          else
            renderPassEncoder.draw(renderObject.vertexBuffer.vertexCount);

        }

      }

    }

    renderPassEncoder.end();
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);

  }

}

export { Renderer };