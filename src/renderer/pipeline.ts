import { device, canvasFormat } from './renderer';
import { 
  vertexBufferFactory,
  globalGroupFactory,
  objectGroupFactory  
} from './base';
import { createVertexShaderCode } from './vertexShader';
import { createFragmentShaderCode } from './fragmentShader';

class PipelineFactory {

  constructor() {

  }

  async createShadowPipline(
    vertexBufferType: number,
    bindGroupType: number
  ) {

    let globalGroupLayout = globalGroupFactory.createLayout();
    let objectGroup = objectGroupFactory.createLayout(bindGroupType);
    let vertexBufferLayout = vertexBufferFactory.createLayout(vertexBufferType);

    let pipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({bindGroupLayouts: 
        [globalGroupLayout.global, objectGroup.transform]
      }),
      vertex: {
        module: device.createShaderModule({ 
          code: createVertexShaderCode(vertexBufferType, true) // ifSahdowPass = true
        }),
        entryPoint: 'main',
        buffers: vertexBufferLayout
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      }, 
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
      }
    });

    return pipeline;

  }

  async createRenderPipeline(
    vertexBufferType: number,
    bindGroupType: number
  ) {

    let bindGroupLayouts: GPUBindGroupLayout[] = [];

    let globalGroup = globalGroupFactory.createLayout();
    for (let key in globalGroup)
      bindGroupLayouts.push(globalGroup[key]);
    let objectGroup = objectGroupFactory.createLayout(bindGroupType);
    for (let key in objectGroup)
      bindGroupLayouts.push(objectGroup[key]);

    let vertexBufferLayout = vertexBufferFactory.createLayout(vertexBufferType);

    let pipeline = await device.createRenderPipelineAsync({
      label: 'Render Pipeline',
      layout: device.createPipelineLayout({ bindGroupLayouts: bindGroupLayouts }),
      vertex: {
        module: device.createShaderModule({ 
          code: createVertexShaderCode(vertexBufferType, false) // ifSahdowPass = false
        }),
        entryPoint: 'main',
        buffers: vertexBufferLayout
      },
      fragment: {
        module: device.createShaderModule({ code: 
          createFragmentShaderCode(vertexBufferType, bindGroupType, 'Phong') 
        }),
        entryPoint: 'main',
        targets: [{
          format: canvasFormat
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      }, 
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: 'less',
        format: 'depth32float'
      }
    });

    return pipeline;

  }

}

export { PipelineFactory };