import './style.css';
import * as THREE from 'three';
import { computeMikkTSpaceTangents } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as MikkTSpace from 'three/examples/jsm/libs/mikktspace.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Renderer } from './renderer/renderer';

class Main {

  canvas: HTMLCanvasElement;
  renderer: Renderer;
  mixer: THREE.AnimationMixer;
  clock: THREE.Clock;
  scene: THREE.Scene;

  constructor() {

    this.canvas = document.querySelector('canvas');
    this.renderer = new Renderer(this.canvas);

  }

  start() {
    
    const render = () => {
      this.renderer.update();
      this.renderer.draw();
      requestAnimationFrame(render);
    }

    render();

  }

  async init() {

    await this.renderer.initWebGPU();
    await this.initScene();
    await this.renderer.initScene(this.scene);

  }

  async initScene() {

    // scene
    this.scene = new THREE.Scene();
    this.scene.background = await this.loadCubeTexture([
      "skybox/right.jpg", "skybox/left.jpg", // px nx
      "skybox/top.jpg", "skybox/bottom.jpg", // py ny
      "skybox/front.jpg", "skybox/back.jpg"  // pz nz
    ]);
    console.log(this.scene)

    // clock
    this.clock = new THREE.Clock();

    // camera
    let camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 5000 );
    camera.position.set( 3, 3, 3 );
    camera.lookAt( 0, 0, 0 );
    this.scene.add(camera)
    new OrbitControls(camera, this.canvas); // controls

    // light 
    let light = new THREE.PointLight(0xffffff, 1, 100);
    light.shadow.camera = new THREE.PerspectiveCamera(50, 1, 1, 10);
    light.shadow.camera.position.set( -3, 4, -3 );
    light.shadow.camera.lookAt( 0, 0, 0 );
    light.position.set( -3, 4, -3 );
    this.scene.add(light);

    // mesh
    {
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

      // animation
      this.mixer = new THREE.AnimationMixer(mesh);
    }

    {
      const glb = await this.loadGLB('genshin/ying.gltf');
      const mesh = glb.scene.children[0].children[1];
      const material = new THREE.MeshPhongMaterial();
      material.map = mesh.material.map;
      mesh.material = material;
      mesh.rotation.set(0, -0.75 * Math.PI, 0)
      // console.log(mesh);
      this.scene.add(mesh);
    }

    {
      const geometry = new THREE.BoxGeometry( 0.5, 0.5, 0.5 );
      const material = new THREE.MeshBasicMaterial({color: 0xffffff});
      const mesh = new THREE.Mesh( geometry, material );
      mesh.position.set(0, 5, 5);
      // this.scene.add(mesh);
    }

    {
      const geometry = new THREE.PlaneGeometry( 6, 6 );
      const material = new THREE.MeshBasicMaterial({color: 0xffffff});
      const mesh = new THREE.Mesh( geometry, material );
      mesh.rotation.set(-Math.PI / 2, 0, 0);
      mesh.position.set(1, 0, 1);
      this.scene.add( mesh );
    }
    
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

  loadFBX( path: string ) {

    return new Promise((
      resolve: (gltf: any) => void, 
      reject: (event: ErrorEvent) => void
    ) => { 
      const modelLoader = new FBXLoader();
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
    ) => {
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

  loadCubeTexture( paths: string[] ) {

    return new Promise((
      resolve: (cubeTexture: THREE.CubeTexture) => void,
      reject: (event: ErrorEvent) => void
    ) => {
      new THREE.CubeTextureLoader().load(
        paths,
        texture => resolve(texture),  // onLoad
        null, // onProgress
        error => reject(error) // onError
      )
    });

  }

}

const main = new Main();
main.init().then(() => main.start());
