import { RenderComponentBase } from './base';

import {
  BasicRenderObject, SkinnedBasicRenderObject, 
  SkinnedStandardRenderObject 
} from './renderObjects';

import BasicVertShader from '../shaders/basic.vert.wgsl?raw'; // vite feature
import BasicFragShader from '../shaders/basic.frag.wgsl?raw';
import SkinnedBasicVertShader from '../shaders/skinnedBasic.vert.wgsl?raw';
import SkinnedBasicFragShader from '../shaders/skinnedBasic.frag.wgsl?raw';
import SkinnedStandardVertShader from '../shaders/skinnedStandard.vert.wgsl?raw';
import SkinnedStandardFragShader from '../shaders/skinnedStandard.frag.wgsl?raw';


abstract class PipelineFactory extends RenderComponentBase {

  pipeline: GPUPipelineBase | null;

  constructor(device: GPUDevice) {

    super(device);

    this.pipeline = null;

  }

}

abstract class RenderPipelineFactory extends PipelineFactory {

  declare pipeline: GPURenderPipeline;

  constructor(device: GPUDevice) {

    super(device);

  }

  abstract create(targetFormat: GPUTextureFormat): Promise<GPURenderPipeline>;

}


class BasicRenderPipelineFactory extends RenderPipelineFactory {


  constructor(device: GPUDevice) {

    super(device);

  }

  async create(targetFormat: GPUTextureFormat) {

    if (this.pipeline) return this.pipeline;

    this.pipeline = await this.device.createRenderPipelineAsync({
      label: 'Render Pipeline (Basic)',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: BasicRenderObject.bindGroupLayouts
      }),
      vertex: {
        module: this.device.createShaderModule({ code: BasicVertShader }),
        entryPoint: 'main',
        buffers: BasicRenderObject.vertexBufferLayouts
      },
      fragment: {
        module: this.device.createShaderModule({ code: BasicFragShader }),
        entryPoint: 'main',
        targets: [{
          format: targetFormat
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

    return this.pipeline;

  }

}


class SkinnedBasicRenderPipelineFactory extends RenderPipelineFactory {


  constructor(device: GPUDevice) {

    super(device);

  }

  async create(targetFormat: GPUTextureFormat) {

    if (this.pipeline) return this.pipeline;

    this.pipeline = await this.device.createRenderPipelineAsync({
      label: 'Render Pipeline (SkinnedBasic)',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: SkinnedBasicRenderObject.bindGroupLayouts
      }),
      vertex: {
        module: this.device.createShaderModule({ code: SkinnedBasicVertShader }),
        entryPoint: 'main',
        buffers: SkinnedBasicRenderObject.vertexBufferLayouts
      },
      fragment: {
        module: this.device.createShaderModule({ code: SkinnedBasicFragShader }),
        entryPoint: 'main',
        targets: [{
          format: targetFormat
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

    return this.pipeline;

  }

}


class SkinnedStandardRenderPipelineFactory extends RenderPipelineFactory {


  constructor(device: GPUDevice) {

    super(device);

  }

  async create(targetFormat: GPUTextureFormat) {

    if (this.pipeline) return this.pipeline;

    this.pipeline = await this.device.createRenderPipelineAsync({
      label: 'Render Pipeline (SkinnedStandard)',
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: SkinnedStandardRenderObject.bindGroupLayouts
      }),
      vertex: {
        module: this.device.createShaderModule({ code: SkinnedStandardVertShader }),
        entryPoint: 'main',
        buffers: SkinnedStandardRenderObject.vertexBufferLayouts
      },
      fragment: {
        module: this.device.createShaderModule({ code: SkinnedStandardFragShader }),
        entryPoint: 'main',
        targets: [{
          format: targetFormat
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

    return this.pipeline;

  }
  
}

export { 
  BasicRenderPipelineFactory, SkinnedBasicRenderPipelineFactory, 
  SkinnedStandardRenderPipelineFactory 
};