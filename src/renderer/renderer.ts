import * as THREE from 'three';
import { RenderController } from './controller'
import { RenderableObject } from './object/renderableObject';

let device: GPUDevice;
let canvasFormat: GPUTextureFormat;
let canvasSize: { width: number, height: number };

class Renderer {

  // basic
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext;

  // resource
  private controller: RenderController;

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
    canvasSize = { width: this.canvas.width, height: this.canvas.height };

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
    await this.controller.initPostProcessPasses();

  }

  public draw() {

    this.controller.draw(this.context.getCurrentTexture().createView());

  }

  public update() {

    this.controller.update();

  }

}

export { Renderer, device, canvasFormat, canvasSize };