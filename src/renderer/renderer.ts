import * as THREE from 'three';
import { RenderController } from './controller'
import { RenderableObject } from './object/renderableObject';

let device: GPUDevice;
let canvasFormat: GPUTextureFormat;

class Renderer {

  // basic
  private size: { width: number, height: number };
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext;

  // resource
  private controller: RenderController;
  private shadowMap: GPUTexture;
  private renderDepthMap: GPUTexture;

  constructor(canvas: HTMLCanvasElement) {

    this.canvas = canvas;
    this.controller = new RenderController();

  }

  public async initWebGPU() {

    if(!navigator.gpu) throw new Error('Not Support WebGPU');

    // adapter
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance' // 'low-power'
    });
    if (!adapter) throw new Error('No Adapter Found');
    adapter.features.forEach(feature => console.log(`Support feature: ${feature}`));
    
    // device
    device = await adapter.requestDevice(); // "shader-f16" feature is not supported on my laptop
    console.log(device)
    // context
    const context = this.canvas.getContext('webgpu');
    if (!context) throw new Error('Can Not Get GPUCanvasContext');
    this.context = context;

    // size
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

  public addRenderableObject(obj: RenderableObject) {

    this.controller.addRenderableObject(obj);

  }

  public async initScene(scene: THREE.Scene) {

    this.controller.initScene(scene);
    await this.controller.initResources();
    await this.controller.initRenderPass();
    await this.controller.initShadowPass();

    this.shadowMap = this.controller.globalObject.resource.shadowMap as GPUTexture;
    this.renderDepthMap = device.createTexture({
      label: 'Render Depth Map',
      size: this.size,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
      format: 'depth32float'
    });

  }

  public draw() {

    const commandEncoder = device.createCommandEncoder();

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
    shadowPassEncoder.executeBundles([this.controller.shadowBundle]);
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
    renderPassEncoder.executeBundles([this.controller.renderBundle]);
    renderPassEncoder.end();

    const commandBuffer = commandEncoder.finish();
    device.queue.submit([commandBuffer]);

  }

  public update() {

    this.controller.update();

  }

}

export { Renderer, device, canvasFormat };