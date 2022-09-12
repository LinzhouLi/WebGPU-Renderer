import './style.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';


import { computeMikkTSpaceTangents } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as MikkTSpace from 'three/examples/jsm/libs/mikktspace.module.js'

import vertexShaderCode from './shaders/vertex.wgsl?raw'; // vite feature
import fragmentShaderCode from './shaders/fragment.wgsl?raw'; // vite feature


// Utils

const attributeOrder: string[] = ['position', 'normal', 'uv', 'tangent', 'skinIndex', 'skinWeight'];

const GPUVertexFormats: Map<string, string> = new Map();
GPUVertexFormats.set('[object Float64Array]', 'float32');
GPUVertexFormats.set('[object Float32Array]', 'float32');
GPUVertexFormats.set('[object Int32Array]', 'sint32');
GPUVertexFormats.set('[object Uint32Array]', 'uint32');
GPUVertexFormats.set('[object Int16Array]', 'sint16');
GPUVertexFormats.set('[object Uint16Array]', 'uint16');
GPUVertexFormats.set('[object Int8Array]', 'sint8');
GPUVertexFormats.set('[object UInt8Array]', 'uint8');

function Array2GPUFormat(array: ArrayLike<number>): string | undefined {
  return GPUVertexFormats.get(Object.prototype.toString.call(array));
}

type TypedArray = Float64Array | Float32Array | Int32Array | Uint32Array | Int16Array | Uint16Array | Int8Array | Uint8Array;


// 

console.info( 'THREE.WebGPURenderer: Modified Matrix4.makePerspective() and Matrix4.makeOrtographic() to work with WebGPU, see https://github.com/mrdoob/three.js/issues/20276.' );

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


class Main {

  adapter: GPUAdapter;
  device: GPUDevice;
  canvas: HTMLCanvasElement;
  context: GPUCanvasContext;
  canvasTargetFormat: GPUTextureFormat;
  size: { width: Number, height: Number };

  renderPipeline: GPURenderPipeline;

  camera: THREE.PerspectiveCamera;

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
    canvas.width = canvas.clientWidth * devicePixelRatio;
    canvas.height = canvas.clientHeight * devicePixelRatio;
    this.size = { width: canvas.width, height: canvas.height };

    // format
    this.canvasTargetFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device: this.device, 
      format: this.canvasTargetFormat,
      alphaMode: 'opaque' // prevent chrome warning
    })

  }

  createVertexBuffer(geometry: THREE.BufferGeometry) {

    let vertexBufferLayouts: GPUVertexBufferLayout[] = [];
    let vertexBuffers: GPUBuffer[] = [];
    let shaderLocation = 0;

    for (let attributeName of attributeOrder) {

      const bufferAttribute = geometry.attributes[attributeName];
      
      if (bufferAttribute && Array2GPUFormat(bufferAttribute.array)) {

        // get buffer data
        const bufferDataArray = bufferAttribute.array as TypedArray;

        // create buffer
        const vertexBuffer = this.device.createBuffer({
          // GPUBufferDescriptor
          size: bufferDataArray.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.device.queue.writeBuffer(vertexBuffer, 0, bufferDataArray);
        vertexBuffers.push(vertexBuffer);

        // set buffer layout
        vertexBufferLayouts.push({
          // GPUVertexBufferLayout
          arrayStride: bufferAttribute.itemSize * bufferDataArray.BYTES_PER_ELEMENT,
          attributes: [{
            shaderLocation: shaderLocation,
            offset: 0,
            format: bufferAttribute.itemSize > 1 ? 
              `${Array2GPUFormat(bufferDataArray)}x${bufferAttribute.itemSize}` as GPUVertexFormat :
              Array2GPUFormat(bufferDataArray)  as GPUVertexFormat
          }]
        });

        shaderLocation++;

      }

    }
    console.log(vertexBufferLayouts)
    return { 
      vertexCount: geometry.attributes.position.count,
      buffers: vertexBuffers, 
      layouts: vertexBufferLayouts 
    };

  }

  async createBindGroup(mesh: THREE.SkinnedMesh) {

    const skeleton = mesh.skeleton as THREE.Skeleton;
    const material = mesh.material as THREE.MeshStandardMaterial;

    // camera position: vec3
    const cameraPosition = new Float32Array([this.camera.position.x, this.camera.position.y, this.camera.position.z]);
    const cameraPositionBuffer = this.device.createBuffer({
      // GPUBufferDescriptor
      size: cameraPosition.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(cameraPositionBuffer, 0, cameraPosition);

    // camera projection matrix: mat4x4
    const projectionMatrix = new Float32Array(this.camera.projectionMatrix.elements);
    const projectionMatrixBuffer = this.device.createBuffer({
      // GPUBufferDescriptor
      size: projectionMatrix.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(projectionMatrixBuffer, 0, projectionMatrix);

    // constants (boneCount)
    const constants = new Float32Array([skeleton.bones.length]);
    const constantsBuffer = this.device.createBuffer({
      // GPUBufferDescriptor
      size: constants.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(constantsBuffer, 0, constants);

    // model view matrix: mat4x4
    const modelViewMatrix = new Float32Array(this.camera.matrixWorldInverse.multiply(mesh.matrixWorld).elements);
    const modelViewMatrixBuffer = this.device.createBuffer({
      // GPUBufferDescriptor
      size: modelViewMatrix.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(modelViewMatrixBuffer, 0, modelViewMatrix);

    // bone matrices: array<mat4x4>
    const boneMatrices = new Float32Array(skeleton.boneMatrices);
    const boneMatricesBuffer = this.device.createBuffer({
      // GPUBufferDescriptor
      size: boneMatrices.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(boneMatricesBuffer, 0, boneMatrices);

    // textures
    const textureNames = ['map', 'normalMap', 'metalnessMap'];
    let textures: GPUTexture[] = [];

    for (const textureName of textureNames) {

      let textureBitmap: ImageBitmap;
      if (material[textureName].source.data instanceof ImageBitmap)
        textureBitmap = material[textureName].source.data;
      else if (material[textureName].source.data instanceof HTMLImageElement)
        textureBitmap = await createImageBitmap(material[textureName].source.data);
      else
        throw new Error(`Invalid ${textureName}`);
      
      const textureSize = [textureBitmap.width, textureBitmap.height];
      const texture = this.device.createTexture({ // create
        // GPUTextureDescriptor
        size: textureSize,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
      });

      this.device.queue.copyExternalImageToTexture( // write texture data from CPU to GPU
        { source: textureBitmap },
        { texture: texture },
        textureSize
      );
      textures.push(texture);

    }

    // sampler
    const sampler = this.device.createSampler({
      // addressModeU: 'repeat',
      // addressModeV: 'repeat',
      magFilter: 'linear',
      minFilter: 'linear'
    });
    
    return { 
      buffers: {
        cameraPositionBuffer, projectionMatrixBuffer, constantsBuffer,
        modelViewMatrixBuffer, boneMatricesBuffer
      },
      textures,
      sampler
    };

  }

  async initPipeline(mesh: THREE.SkinnedMesh) {

    // for buffer attributes
    const vertexBufferInfo = this.createVertexBuffer(mesh.geometry);

    // shaders
    const vertexShader = this.device.createShaderModule({
      code: vertexShaderCode
    });
    const fragmentShader = this.device.createShaderModule({
      code: fragmentShaderCode
    });
    
    // create pipeline
    this.renderPipeline = await this.device.createRenderPipelineAsync({
      // GPURenderPipelineDescriptor
      layout: 'auto',
      vertex: {
        module: vertexShader,
        entryPoint: 'main',
        buffers: vertexBufferInfo.layouts
      },
      fragment: {
        module: fragmentShader,
        entryPoint: 'main',
        targets: [{
          format: this.canvasTargetFormat
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
    },
    });
    
    // bind group (uniform and storage)
    const bindGroupData = await this.createBindGroup(mesh);
    
    const cameraGroup = this.device.createBindGroup({
      // GPUBindGroupDescriptor
      label: 'Uniform Group For Camera Info',
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: bindGroupData.buffers.cameraPositionBuffer } // GPUBufferBinding
      }, {
        binding: 1,
        resource: { buffer: bindGroupData.buffers.projectionMatrixBuffer }
      }, {
        binding: 2,
        resource: { buffer: bindGroupData.buffers.constantsBuffer }
      }]
    });
    
    const transformGroup = this.device.createBindGroup({
      // GPUBindGroupDescriptor
      label: 'Uniform Group For transform Info',
      layout: this.renderPipeline.getBindGroupLayout(1),
      entries: [{
        binding: 0,
        resource: { buffer: bindGroupData.buffers.modelViewMatrixBuffer }
      }, {
        binding: 1,
        resource: { buffer: bindGroupData.buffers.boneMatricesBuffer }
      }]
    });

    let textureGroupEntries: GPUBindGroupEntry[] = [{
      binding: 0,
      resource: bindGroupData.sampler
    }];
    let entryIndex = 1;
    for (const texture of bindGroupData.textures) {
      textureGroupEntries.push({
        binding: entryIndex,
        resource: texture.createView()
      });
      entryIndex++;
    }
    console.log(textureGroupEntries)
    const textureGroup = this.device.createBindGroup({
      // GPUBindGroupDescriptor
      label: 'Texture Group',
      layout: this.renderPipeline.getBindGroupLayout(2),
      entries: textureGroupEntries
    });
    
    return { 
      vertexCount: vertexBufferInfo.vertexCount,
      vertexBuffers: vertexBufferInfo.buffers, 
      groups: [cameraGroup, transformGroup, textureGroup]
    };

  }

  draw(data: { 
    vertexCount: number, 
    vertexBuffers: GPUBuffer[], 
    groups: GPUBindGroup[] 
  }) {

    const commandEncoder = this.device.createCommandEncoder();
    const renderPassEncoder = commandEncoder.beginRenderPass({
      // GPURenderPassDescriptor
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(), // output view buffer
        loadOp: 'clear', // operation to view before drawing: clear/load
        clearValue: { r: 0, g: 0, b: 0, a: 1 }, // color to clear
        storeOp: 'store' // operation to view after drawing: discard/store
      }]
    });

    renderPassEncoder.setPipeline(this.renderPipeline);

    let slotIndex = 0;
    for (const vertexBuffer of data.vertexBuffers) {
      renderPassEncoder.setVertexBuffer(slotIndex, vertexBuffer);
      slotIndex++;
    }

    let groupIndex = 0;
    for (const group of data.groups) {
      renderPassEncoder.setBindGroup(groupIndex, group);
      groupIndex++;
    }

    renderPassEncoder.draw(data.vertexCount);
    renderPassEncoder.end();
    const commandBuffer = commandEncoder.finish();
    this.device.queue.submit([commandBuffer]);

  }

  async initScene() {

    // camera
    this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 5000 );
    this.camera.position.set( 3, 3, 3 );
    this.camera.lookAt( 0, 0, 0 );

    const glb = await this.loadGLB('test/male.glb');
    const mesh = glb.scene.children[2] as THREE.SkinnedMesh;
    const material = mesh.material as THREE.MeshStandardMaterial;
    material.normalMap = await this.loadTexture('test/normal_map.jpg');
    material.metalnessMap = await this.loadTexture('test/spec_map.jpg');

    // calculate tangent
    await MikkTSpace.ready;
    const mikkTSpace = {
      wasm: MikkTSpace.wasm,
      isReady: MikkTSpace.isReady,
      generateTangents: MikkTSpace.generateTangents
    }
    computeMikkTSpaceTangents(mesh.geometry, mikkTSpace);
    console.log(mesh) //
    const data = await this.initPipeline(mesh);
    
    return data;

  }



  loadGLB( path: string ) {

    return new Promise((
      resolve: (gltf: any) => void, 
      reject: (event: ErrorEvent) => void
    ) => { 
      const modelLoader = new GLTFLoader();
      modelLoader.load( 
        path, 
        gltf => { resolve( gltf ); }, // onLoad
        null, // onProgress
        error => reject(error) // onError
      );
    } );

  }

  loadTexture( path: string ) {

    return new Promise((
      resolve: (texture: THREE.Texture) => void, 
      reject: (event: ErrorEvent) => void
    )=> {
      new THREE.TextureLoader().load(
        path,
        texture => { // onLoad
          texture.flipY = false;
          resolve(texture);
        }, 
        null, // onProgress
        error => reject(error) // onError
      )
    });
    
  }

}

const canvas = document.querySelector('canvas');
let main = new Main(canvas);
main.initWebGPU().then(() => { main.initScene() })
// main.initScene();