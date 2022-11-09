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
    // this.renderer.addRenderableObject(this.crowdManager.renderableObject);
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
    camera.position.set( 0, 4, 0 );
    camera.lookAt( 0, 0, 0 );
    this.scene.add(camera)
    new OrbitControls(camera, this.canvas); // controls

    // point light 
    // let pointLight = new THREE.PointLight(0xffffff, 1, 100);
    // pointLight.shadow.camera = new THREE.PerspectiveCamera(50, 1, 1, 15);
    // pointLight.shadow.camera.position.set( -3, 4, -3 );
    // pointLight.shadow.camera.lookAt( 0, 0, 0 );
    // pointLight.position.set( -3, 4, -3 );
    // this.scene.add(pointLight);

    // directional light
    let height = 10, width = 10;
    let directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.shadow.camera = new THREE.OrthographicCamera(width / - 2, width / 2, height / 2, height / - 2, 1, 1000);
    directionalLight.shadow.camera.position.set( -10, 20, -10 );
    directionalLight.shadow.camera.lookAt( 0, 0, 0 );
    directionalLight.position.set( -10, 20, -10 );
    this.scene.add(directionalLight);

    // mesh
    {
      const glb = await loader.loadGLTF('crowd/male.glb');
      const mesh = glb.scene.children[2] as THREE.SkinnedMesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.map = await loader.loadTexture('crowd/business02.jpg');
      material.normalMap = await loader.loadTexture('crowd/business02_normal.jpg');

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
      const material = new THREE.MeshStandardMaterial();
      material.map = mesh.material.map;
      mesh.material = material;
      mesh.rotation.set(0, -0.75 * Math.PI, 0)
      // console.log(mesh);
      // this.scene.add(mesh);
    }

    {
      const glb = await loader.loadGLTF('Cerberus/Cerberus.glb');
      const mesh = glb.scene.children[0];
      const material = new THREE.MeshStandardMaterial();
      material.map = await loader.loadTexture('Cerberus/baseColor.jpg');
      material.normalMap = await loader.loadTexture('Cerberus/normal.jpg');
      material.metalnessMap = await loader.loadTexture('Cerberus/metalness.jpg');
      material.roughnessMap = await loader.loadTexture('Cerberus/roughness.jpg');
      mesh.material = material;
      mesh.position.set(0, 0.5, 0);

      // calculate tangent
      await MikkTSpace.ready;
      const mikkTSpace = {
        wasm: MikkTSpace.wasm,
        isReady: MikkTSpace.isReady,
        generateTangents: MikkTSpace.generateTangents
      }
      computeMikkTSpaceTangents(mesh.geometry, mikkTSpace);
      // console.log(mesh);
      this.scene.add(mesh);
    }

    {
      const geometry = new THREE.PlaneGeometry( 3, 3 );
      const material = new THREE.MeshStandardMaterial();
      material.color = new THREE.Color(0.972, 0.960, 0.915);
      material.roughness = 0.1;
      material.metalness = 0.0;
      const mesh = new THREE.Mesh( geometry, material );
      mesh.rotation.set(-Math.PI / 2, 0, 0);
      // mesh.position.set(1, 0, 1);
      this.scene.add( mesh );
    }

    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial({color: 0xffffff});
    //   material.color = new THREE.Color(1,1,1);
    //   material.roughness = 0.01;
    //   material.metalness = 0.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 3.2, 0);
    //   this.scene.add( mesh );
    // }
    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial({color: 0xffffff});
    //   material.color = new THREE.Color(1,1,1);
    //   material.roughness = 0.1;
    //   material.metalness = 0.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 3.2, 0.5);
    //   this.scene.add( mesh );
    // }
    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial({color: 0xffffff});
    //   material.color = new THREE.Color(1,1,1);
    //   material.roughness = 0.3;
    //   material.metalness = 0.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 3.2, 1);
    //   this.scene.add( mesh );
    // }
    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial({color: 0xffffff});
    //   material.color = new THREE.Color(1,1,1);
    //   material.roughness = 0.5;
    //   material.metalness = 0.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 3.2, 1.5);
    //   this.scene.add( mesh );
    // }

    {
      const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
      const material = new THREE.MeshStandardMaterial();
      material.color = new THREE.Color(1,0.782,0.344);
      material.roughness = 0.1;
      material.metalness = 1.0;
      const mesh = new THREE.Mesh( geometry, material );
      mesh.position.set(0, 2.5, 0);
      this.scene.add( mesh );
    }
    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial();
    //   material.color = new THREE.Color(1,0.782,0.344);
    //   material.roughness = 0.1;
    //   material.metalness = 1.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 2.5, 0.5);
    //   this.scene.add( mesh );
    // }
    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial();
    //   material.color = new THREE.Color(1,0.782,0.344);
    //   material.roughness = 0.3;
    //   material.metalness = 1.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 2.5, 1);
    //   this.scene.add( mesh );
    // }
    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial();
    //   material.color = new THREE.Color(1,0.782,0.344);
    //   material.roughness = 0.5;
    //   material.metalness = 1.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 2.5, 1.5);
    //   this.scene.add( mesh );
    // }

    // this.crowdManager = new CrowdManager();
    // await this.crowdManager.initResource();
    
  }

}

const main = new Main();
main.init().then(() => main.start());
