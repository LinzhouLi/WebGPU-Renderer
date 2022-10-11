import './style.css';
import * as THREE from 'three';
import { computeMikkTSpaceTangents } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as MikkTSpace from 'three/examples/jsm/libs/mikktspace.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { loader } from './loader';
import { Renderer } from './renderer/renderer';
import { CrowdManager } from './crowdManager'

class Main {

  canvas: HTMLCanvasElement;
  renderer: Renderer;
  mixer: THREE.AnimationMixer;
  clock: THREE.Clock;
  scene: THREE.Scene;
  crowdManager: CrowdManager;

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
    this.renderer.addRenderableObject(this.crowdManager.renderableObject);
    await this.renderer.initScene(this.scene);

  }

  async initScene() {

    // scene
    this.scene = new THREE.Scene();
    this.scene.background = await loader.loadCubeTexture([
      "skybox/right.jpg", "skybox/left.jpg", // px nx
      "skybox/top.jpg", "skybox/bottom.jpg", // py ny
      "skybox/front.jpg", "skybox/back.jpg"  // pz nz
    ]);

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
      const glb = await loader.loadGLTF('crowd/male.glb');
      const mesh = glb.scene.children[2] as THREE.SkinnedMesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.map = await loader.loadTexture('crowd/business03.jpg');
      material.normalMap = await loader.loadTexture('crowd/business03_normal.jpg');

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
      mesh.rotation.set(0, -0.75 * Math.PI, 0)
      // this.scene.add( mesh );
    }

    {
      const glb = await loader.loadGLTF('genshin/ying.gltf');
      const mesh = glb.scene.children[0].children[1];
      const material = new THREE.MeshPhongMaterial();
      material.map = mesh.material.map;
      mesh.material = material;
      mesh.rotation.set(0, -0.75 * Math.PI, 0)
      // console.log(mesh);
      // this.scene.add(mesh);
    }

    {
      const geometry = new THREE.PlaneGeometry( 30, 30 );
      const material = new THREE.MeshBasicMaterial({color: 0xffffff});
      const mesh = new THREE.Mesh( geometry, material );
      mesh.rotation.set(-Math.PI / 2, 0, 0);
      // mesh.position.set(1, 0, 1);
      this.scene.add( mesh );
    }

    this.crowdManager = new CrowdManager();
    await this.crowdManager.initResource();
    
  }

}

const main = new Main();
main.init().then(() => main.start());
