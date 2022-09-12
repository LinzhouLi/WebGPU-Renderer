import './style.css'
import * as THREE from 'three';
import WebGPU from 'three/examples/jsm/capabilities/WebGPU';
import WebGPURenderer from './webgpuRenderer/WebGPURenderer';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class Main {

  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: WebGPURenderer;
  clock: THREE.Clock;
  mixer: THREE.AnimationMixer;
  controls: OrbitControls;

  constructor() {

  }

  async init() {

    if ( WebGPU.isAvailable() === false ) {
      document.body.appendChild( WebGPU.getErrorMessage() );
      throw new Error( 'No WebGPU support' );
    }

    this.clock = new THREE.Clock();

    // camera
    this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 5000 );
    this.camera.position.set( 4, 4, 4 );
    this.camera.lookAt( 0, 0, 0 );

    this.scene = new THREE.Scene();

    // lights
    const light = new THREE.PointLight( 0xffffff, 5, 100 );
    light.position.set( 4, 4, 4 );
    this.scene.add( light );

    let testObject = await this.loadGLB('test/male.glb');
    testObject.scene.children[2].material.normalMap = await this.loadTexture('test/normal_map.jpg');
    testObject.scene.children[2].material.metalnessMap = await this.loadTexture('test/spec_map.jpg');
    console.log(testObject);
    this.scene.add(testObject.scene);

    const axesHelper = new THREE.AxesHelper( 50 );
    this.scene.add( axesHelper );

    // renderer setting
    this.renderer = new WebGPURenderer();
    // this.renderer = new THREE.WebGLRenderer();
    this.renderer.setPixelRatio( window.devicePixelRatio );
    this.renderer.setSize( window.innerWidth, window.innerHeight );
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    // this.renderer.toneMapping = THREE.LinearToneMapping;

    this.controls = new OrbitControls( this.camera, this.renderer.domElement );

    document.body.appendChild( this.renderer.domElement );
    window.addEventListener( 'resize', () => { this.onWindowResize(); } );

    return this.renderer.init();

  }

  onWindowResize() {

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize( window.innerWidth, window.innerHeight );

  }

  render() {

    const delta = this.clock.getDelta();
    if ( this.mixer ) this.mixer.update( delta );

    this.renderer.render( this.scene, this.camera );
    requestAnimationFrame( () => { this.render(); } );

  }

  loadGLB( path: string ) {

    return new Promise((
      resolve: (gltf: GLTF) => void, 
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

let main = new Main();
main.init().then(() => { main.render(); });