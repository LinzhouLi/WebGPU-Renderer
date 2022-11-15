import './style.css';
import * as THREE from 'three';
import { computeMikkTSpaceTangents } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as MikkTSpace from 'three/examples/jsm/libs/mikktspace.module.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'stats.js/src/Stats.js';

import { loader } from './loader';
import { Renderer } from './renderer/renderer';
import { CrowdManager } from './crowdManager';

class Main {

  canvas: HTMLCanvasElement;
  renderer: Renderer;
  webglRenderer: THREE.WebGLRenderer;
  mixer: THREE.AnimationMixer;
  clock: THREE.Clock;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  crowdManager: CrowdManager;
  stats: Stats;

  constructor() {

    this.canvas = document.querySelector('canvas');
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * devicePixelRatio;
    this.renderer = new Renderer(this.canvas);
    // this.webglRenderer = new THREE.WebGLRenderer({ canvas: this.canvas });
    this.stats = new Stats();
    this.stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild( this.stats.dom );


  }

  start() {
    
    const render = () => {
      this.stats.begin();

      // this.webglRenderer.render(this.scene, this.camera);
      this.renderer.update();
      this.renderer.draw();
      const delta = this.clock.getDelta();
      this.mixer.update(delta);

      this.stats.end();
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
    this.camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 5000 );
    this.camera.position.set( 0, 4, 0 );
    this.camera.lookAt( 0, 0, 0 );
    this.scene.add(this.camera)
    new OrbitControls(this.camera, this.canvas); // controls

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
      const fbx = await loader.loadFBX('crowd/male_walk.fbx');
      // console.log(fbx)
      const bone = fbx.children[1];
      const mesh = fbx.children[0] as THREE.SkinnedMesh;
      mesh.bindMode = 'detached';
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color = new THREE.Color(1, 1, 1);
      material.map = await loader.loadTexture('crowd/business02.jpg');
      material.normalMap = await loader.loadTexture('crowd/business02_normal.jpg');
      material.roughness = 0.5;
      material.metalness = 0.0;
      // let binding = THREE.PropertyBinding.create(mesh, fbx.animations[0].tracks[0].name, false)

      // calculate tangent
      await MikkTSpace.ready;
      const mikkTSpace = {
        wasm: MikkTSpace.wasm,
        isReady: MikkTSpace.isReady,
        generateTangents: MikkTSpace.generateTangents
      }
      computeMikkTSpaceTangents(mesh.geometry, mikkTSpace);

      // animation
      this.mixer = new THREE.AnimationMixer(fbx);
      const action = this.mixer.clipAction(fbx.animations[0]);
      action.play();
      mesh.scale.set(0.01, 0.01, 0.01)
      mesh.rotation.set(-0.5 * Math.PI, 0, Math.PI)
      mesh.skeleton.pose()
      mesh.skeleton.update()
      console.log(mesh.skeleton)
      this.scene.add( mesh, bone );
    }

    {
      // const fbx = await loader.loadFBX('crowd/3.fbx');
      // console.log(fbx);
      // this.scene.add( fbx );
    }

    {
      // const glb = await loader.loadGLTF('genshin/ying.gltf');
      // const mesh = glb.scene.children[0].children[1];
      // const material = new THREE.MeshStandardMaterial();
      // material.map = mesh.material.map;
      // mesh.material = material;
      // mesh.rotation.set(0, -0.75 * Math.PI, 0)
      // console.log(mesh);
      // this.scene.add(mesh);
    }

    {
      // const glb = await loader.loadGLTF('Cerberus/Cerberus.glb');
      // const mesh = glb.scene.children[0];
      // const material = new THREE.MeshStandardMaterial();
      // material.map = await loader.loadTexture('Cerberus/baseColor.jpg');
      // material.normalMap = await loader.loadTexture('Cerberus/normal.jpg');
      // material.metalnessMap = await loader.loadTexture('Cerberus/metalness.jpg');
      // material.roughnessMap = await loader.loadTexture('Cerberus/roughness.jpg');
      // mesh.material = material;
      // mesh.position.set(0, 0.5, 0);

      // // calculate tangent
      // await MikkTSpace.ready;
      // const mikkTSpace = {
      //   wasm: MikkTSpace.wasm,
      //   isReady: MikkTSpace.isReady,
      //   generateTangents: MikkTSpace.generateTangents
      // }
      // computeMikkTSpaceTangents(mesh.geometry, mikkTSpace);
      // this.scene.add(mesh);
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
    //   material.roughness = 0.1;
    //   material.metalness = 0.0;
    //   const mesh = new THREE.Mesh( geometry, material );
    //   mesh.position.set(0, 3.2, 0);
    //   this.scene.add( mesh );
    // }
    // {
    //   const geometry = new THREE.SphereGeometry( 0.2, 64, 32 );
    //   const material = new THREE.MeshStandardMaterial({color: 0xffffff});
    //   material.color = new THREE.Color(1,1,1);
    //   material.roughness = 0.15;
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
    //   material.roughness = 0.15;
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
