import * as THREE from 'three';
import { device } from '../../renderer';
import type { TypedArray } from '../../base';
import { vertexBufferFactory, bindGroupFactory } from '../../base';
import { vertexShaderFactory } from './vertexShader';
import { fragmentShaderFactory } from './fragmentShader';
import type { ResourceType } from '../../resource/resuorce';
import { ResourceFactory } from '../../resource/resuorce';
import { InstancedMesh } from './instancedMesh';

class InstancedSkinnedMesh extends InstancedMesh {

  private static _ResourceFormats = {
    // animation
    animationBuffer: {
      type: 'buffer' as ResourceType,
      label: 'Skinning Matrices per Frame per Animation (mat4x4)',
      visibility: GPUShaderStage.VERTEX,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      layout: {
        type: 'read-only-storage' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    },
    animationInfo: {
      type: 'buffer' as ResourceType,
      label: 'Animation Info (boneCount, animationCount, frameOffset)',
      visibility: GPUShaderStage.VERTEX,
      usage:  GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      layout: {
        type: 'read-only-storage' as GPUBufferBindingType
      } as GPUBufferBindingLayout
    }
  }

  protected declare mesh: THREE.SkinnedMesh;
  protected boneCount: number;

  constructor(mesh: THREE.SkinnedMesh, instanceCount: number) {

    super(mesh, instanceCount);
    this.createVertexShader = vertexShaderFactory;
    this.createFragmentShader = fragmentShaderFactory;
    this.boneCount = this.mesh.skeleton.bones.length;

  }

  public static RegisterResourceFormats() {
    ResourceFactory.RegisterFormats(InstancedSkinnedMesh._ResourceFormats);
  }

  public override initVertexBuffer() {

    this.vertexBufferAttributes = ['position', 'normal', 'uv', 'skinIndex', 'skinWeight'];
    this.vertexBufferData = {
      position: this.mesh.geometry.attributes.position.array as TypedArray,
      normal: this.mesh.geometry.attributes.normal.array as TypedArray,
      uv: this.mesh.geometry.attributes.uv.array as TypedArray,
      skinIndex: this.mesh.geometry.attributes.skinIndex.array as TypedArray,
      skinWeight: this.mesh.geometry.attributes.skinWeight.array as TypedArray
    };

    if (!!this.mesh.geometry.index) {
      this.vertexBufferAttributes.push('index');
      this.vertexBufferData.index = this.mesh.geometry.index.array as TypedArray;
      this.vertexCount = this.mesh.geometry.index.count;
    }
    else {
      this.vertexCount = this.mesh.geometry.attributes.position.count;
    }

    if (!!this.mesh.geometry.attributes.tangent) {
      this.vertexBufferAttributes.push('tangent');
      this.vertexBufferData.tangent = this.mesh.geometry.attributes.tangent.array as TypedArray;
    }

    this.vertexBuffers = vertexBufferFactory.createResource(this.vertexBufferAttributes, this.vertexBufferData);

  }

  public setAnimation(animationData: Float32Array[][]) {

    this.setResource('animationInfo');
    this.setResource('animationBuffer');

    const animationCount = animationData.length;

    let frameOffset = 0, totalFrameCount = 0;
    let frameOffsets = [];
    animationData.forEach(frameData => {
      frameOffsets.push(frameOffset);
      frameOffset += frameData.length;
      totalFrameCount += frameData.length;
    });

    let animationBuffer = new Float32Array(totalFrameCount * this.boneCount * 16);
    animationData.forEach((frameData, animationIndex) => {
      frameData.forEach((boneMatrices, frameIndex) => {
        animationBuffer.set(
          boneMatrices.slice(0, this.boneCount * 16),
          (frameOffsets[animationIndex] + frameIndex) * this.boneCount * 16
        );
      });
    });
    
    this.resourceCPUData.animationInfo = { 
      value: new Float32Array([
        this.boneCount,
        animationCount,
        0, 0, // implicit member alignment padding. see https://gpuweb.github.io/gpuweb/wgsl/#structure-member-layout
        ...this.mesh.bindMatrix.toArray(),
        ...this.mesh.bindMatrixInverse.toArray(),
        ...frameOffsets
      ])
    };
    this.resourceCPUData.animationBuffer = { value: animationBuffer };

  }

  public async setShadowBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    let vertexBufferAttributs = ['position', 'skinIndex', 'skinWeight'];
    if (this.vertexBufferAttributes.includes('index')) vertexBufferAttributs.push('index');

    const lightType = globalResource.pointLight ? 'pointLight' : 'directionalLight';
    const resourceAttributes = [lightType, 'instancedModelMat', 'animationInfo', 'animationBuffer'];

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const bind = bindGroupFactory.create( resourceAttributes, {...globalResource, ...this.resource}, null, 'shadow' );
    
    this.shadowPipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [bind.layout] 
      }),
      vertex: {
        module: device.createShaderModule({ code: 
          this.createVertexShader(vertexBufferAttributs, [resourceAttributes], 'shadow')
        }),
        entryPoint: 'main',
        buffers: vertexLayout
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
    
    bundleEncoder.setPipeline(this.shadowPipeline);
    
    // set vertex and index buffers
    let loction = 0;
    let indexed = false;
    for (const attribute of vertexBufferAttributs) {
      if (attribute === 'index') {
        bundleEncoder.setIndexBuffer(this.vertexBuffers.index, 'uint16');
        indexed = true;
      }
      else {
        bundleEncoder.setVertexBuffer(loction, this.vertexBuffers[attribute]);
        loction++;
      }
    }

    // set bind group
    bundleEncoder.setBindGroup(0, bind.group);
    
    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount, this.instanceCount);
    else bundleEncoder.draw(this.vertexCount, this.instanceCount);

  }

}

export { InstancedSkinnedMesh }