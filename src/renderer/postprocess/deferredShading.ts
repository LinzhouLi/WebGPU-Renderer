import { bindGroupFactory } from '../base';
import { PostProcess } from './postprocess';
import { LightPassShader } from '../../shader/shaderLib/lightPass'

class DeferredShading extends PostProcess {

  private resourceAttributes: string[];

  constructor() {

    super();
    this.vertexShaderCode = LightPassShader.Vertex;
    this.fragmentShaderCode = LightPassShader.Fragment;
    this.inputGBuffers = ['GBufferA', 'GBufferB', 'GBufferC', 'GBufferDepth'];
    this.outputGBuffers = ['canvas'];
    this.resourceAttributes = [...this.inputGBuffers, 'camera']

  }

  protected override setBindGroup(
    globalResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>,
    gbufferResource: Record<string, GPUBuffer | GPUTexture | GPUSampler>
  ) {
    return bindGroupFactory.create(
      this.resourceAttributes,
      { ...globalResource, ...gbufferResource }
    );
  }

}

export { DeferredShading };