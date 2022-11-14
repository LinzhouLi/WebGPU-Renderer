import * as THREE from 'three';
import { device } from '../../renderer';
import type { TypedArray } from '../../base';
import { vertexBufferFactory, resourceFactory, bindGroupFactory } from '../../base';
import { vertexShaderFactory } from './vertexShader';
import { fragmentShaderFactory } from './fragmentShader';
import { Mesh } from './mesh';

const defaultSpecular = new THREE.Vector3(0.5, 0.5, 0.5);

class SkinnedMesh extends Mesh {

  protected declare mesh: THREE.SkinnedMesh;
  protected boneCount: number;

  constructor(mesh: THREE.SkinnedMesh) {

    super(mesh);
    this.createVertexShader = vertexShaderFactory;
    this.createFragmentShader = fragmentShaderFactory;
    this.boneCount = this.mesh.skeleton.bones.length;

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

  public override async initGroupResource() {

    const material = this.mesh.material as THREE.MeshStandardMaterial;
    
    let normalMat = new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld).toArray();
    
    this.resourceAttributes = ['transform', 'boneMatrices', 'PBRMaterial'];
    this.resourceCPUData = {
      transform: new Float32Array([
        ...this.mesh.matrixWorld.toArray(),
        ...normalMat.slice(0, 3), 0,          // AlignOf(mat3x3<f32>) in wgsl is 16.
        ...normalMat.slice(3, 6), 0,          // see https://gpuweb.github.io/gpuweb/wgsl/#alignment
        ...normalMat.slice(6, 9), 0
      ]),
      boneMatrices: new Float32Array(this.boneCount * 16),
      PBRMaterial: new Float32Array([
        material.roughness,
        material.metalness, 
        0, 0, // for alignment
        ...material.color.toArray(), 0, // @ts-ignore
        ...(material.specular || defaultSpecular).toArray(), 0
      ])
    };
    
    if (!!material.map) {
      this.resourceAttributes.push('baseMap');
      this.resourceCPUData.baseMap = material.map.source.data;
    }

    if (!!material.normalMap) {
      this.resourceAttributes.push('normalMap');
      this.resourceCPUData.normalMap = material.normalMap.source.data;
    }

    if (!!material.metalnessMap) {
      this.resourceAttributes.push('metalnessMap');
      this.resourceCPUData.metalnessMap = material.metalnessMap.source.data;
    }

    if (!!material.roughnessMap) {
      this.resourceAttributes.push('roughnessMap');
      this.resourceCPUData.roughnessMap = material.roughnessMap.source.data;
    }
    
    this.resource = await resourceFactory.createResource(this.resourceAttributes, this.resourceCPUData);
    
  }

  public override async setShadowBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    let vertexBufferAttributs = ['position', 'skinIndex', 'skinWeight'];
    if (this.vertexBufferAttributes.includes('index')) vertexBufferAttributs.push('index');

    const lightType = globalResource.pointLight ? 'pointLight' : 'directionalLight';
    const resourceAttributes = [lightType, 'transform', 'boneMatrices'];

    const vertexLayout = vertexBufferFactory.createLayout(vertexBufferAttributs);
    const Bind = bindGroupFactory.create( resourceAttributes, {...globalResource, ...this.resource} );
    
    this.shadowPipeline = await device.createRenderPipelineAsync({
      label: 'Shadow Pipeline',
      layout: device.createPipelineLayout({ 
        bindGroupLayouts: [Bind.layout] 
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
    bundleEncoder.setBindGroup(0, Bind.group);
    
    // draw
    if (indexed) bundleEncoder.drawIndexed(this.vertexCount);
    else bundleEncoder.draw(this.vertexCount);

  }

  public override update() {

    // transform
    let normalMat = new THREE.Matrix3().getNormalMatrix(this.mesh.matrixWorld).toArray();
    (this.resourceCPUData.transform as TypedArray).set([
      ...this.mesh.matrixWorld.toArray(),
      ...normalMat.slice(0, 3), 0,
      ...normalMat.slice(3, 6), 0,
      ...normalMat.slice(6, 9), 0
    ]);
    device.queue.writeBuffer( 
      this.resource.transform as GPUBuffer,
      0, this.resourceCPUData.transform as TypedArray
    );

    // boneMatrix
    this.mesh.skeleton.update();
    device.queue.writeBuffer( 
      this.resource.boneMatrices as GPUBuffer,
      0, this.mesh.skeleton.boneMatrices as TypedArray, 0, this.boneCount * 16
    );

  }

}

export { SkinnedMesh };