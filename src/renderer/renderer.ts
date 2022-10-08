import * as THREE from 'three';
import { RenderableObject } from './object/renderableObject'

let device: GPUDevice;
let canvasFormat: GPUTextureFormat;

class Renderer {

  // basic
  adapter: GPUAdapter;
  size: { width: number, height: number };
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;

  // resource
  renderableObj: RenderableObject;
  shadowMap: GPUTexture;
  renderDepthMap: GPUTexture;

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
    console.log(adapter)
    // device
    device = await adapter.requestDevice();

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
    canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: device, 
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      format: canvasFormat,
      alphaMode: 'opaque' // prevent chrome warning
    })

  }

  async initScene(scene: THREE.Scene) {

    this.renderableObj = new RenderableObject();

    this.renderableObj.initScene(scene);
    await this.renderableObj.initResources();
    await this.renderableObj.initRenderPass();
    await this.renderableObj.initShadowPass();

    this.shadowMap = this.renderableObj.globalObject.bindGroupResources.shadowMap as GPUTexture;
    this.renderDepthMap = device.createTexture({
      label: 'Render Depth Map',
      size: this.size,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      format: 'depth32float'
    });

  }

  draw() {

    const commandEncoder = device.createCommandEncoder()

    // shadow pass
    const shadowPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: this.shadowMap.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });
    shadowPassEncoder.executeBundles([this.renderableObj.shadowBundle]);
    shadowPassEncoder.end();

    // render pass
    const renderPassEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(), // getCurrentTexture(): Destroyed texture [Texture] used in a submit
        clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }],
      depthStencilAttachment: {
        view: this.renderDepthMap.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      }
    });
    renderPassEncoder.executeBundles([this.renderableObj.renderBundle]);
    renderPassEncoder.end();

    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

  }

  update() {

    this.renderableObj.update();

  }

}

export { Renderer, device, canvasFormat };