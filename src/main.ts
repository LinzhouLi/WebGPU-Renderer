import './style.css';
import * as THREE from 'three';
import { computeMikkTSpaceTangents } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as MikkTSpace from 'three/examples/jsm/libs/mikktspace.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Renderer } from './renderer/renderer';

import vertexShaderCode from './shaders/vertex.wgsl?raw'; // vite feature
import fragmentShaderCode from './shaders/fragment.wgsl?raw'; // vite feature

class Main {

  canvas: HTMLCanvasElement;
  renderer: Renderer;

  constructor() {

    this.canvas = document.querySelector('canvas');
    this.renderer = new Renderer(this.canvas);

  }

  async start() {

    const resource = await this.init();

    const render = () => {
      this.renderer.update(resource.updateInfo);
      this.renderer.draw(resource.pipelines);
      requestAnimationFrame(render);
    }

    render();

  }

  async init() {

    await this.renderer.initWebGPU();
    const scene = await this.initScene();
    const sceneResource = await this.renderer.initSceneResource(scene.camera, scene.light);
    const meshResource = await this.renderer.initSkinnedMeshResource(scene.mesh, scene.camera);
    const pipeline = await this.renderer.initSkinnedMeshPipeline({ 
      vertexBuffer: meshResource.vertexBuffer.layouts,
      bindGroup: [...sceneResource.layouts, ...meshResource.bindGroup.layouts]
    }, {
      vertexShader: vertexShaderCode,
      fragmentShader: fragmentShaderCode
    });

    return {
      pipelines: [{
        pipeline: pipeline,
        data: {
          vertexCount: scene.mesh.geometry.attributes.position.count,
          vertexBuffers: meshResource.vertexBuffer.buffers,
          bindGroups: [...sceneResource.groups, ...meshResource.bindGroup.groups]
        }
      }],
      updateInfo: {
        scene: {
          camera: scene.camera,
          updateResources: sceneResource.updateResources
        },
        mesh: [{
          mesh: scene.mesh,
          updateResources: meshResource.bindGroup.updateResources
        }]
      }
    };


  }

  async initScene() {

    // camera
    let camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 5000 );
    camera.position.set( 3, 3, 3 );
    camera.lookAt( 0, 0, 0 );

    // light 
    let light = new THREE.PointLight(0xffffff, 1, 100);
    light.position.set( 0, 5, 5 );

    new OrbitControls(camera, this.canvas);

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
  
    return { camera, light, mesh };

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
    });

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

const main = new Main();
main.start();
