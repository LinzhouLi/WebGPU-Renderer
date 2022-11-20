import * as THREE from 'three';
import { computeMikkTSpaceTangents } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as MikkTSpace from 'three/examples/jsm/libs/mikktspace.module.js';
import { InstancedMesh } from './renderer/object/instanced/instancedMesh';
import { loader } from './loader';

const baseMapPromises: Promise<THREE.Texture>[] = [
  loader.loadTexture('crowd/business01.jpg'),
  loader.loadTexture('crowd/business02.jpg'),
  loader.loadTexture('crowd/business03.jpg')
];

const normalMapPromises: Promise<THREE.Texture>[] = [
  loader.loadTexture('crowd/business01_normal.jpg'),
  loader.loadTexture('crowd/business02_normal.jpg'),
  loader.loadTexture('crowd/business03_normal.jpg')
]

class CrowdManager {

  private avatarCount: number;
  private avatarParam: {
    position: THREE.Vector3[],
    scale: THREE.Vector3[],
    rotation: THREE.Euler[],
    textureIndex: number[],
    color: THREE.Color[]
  };

  public mesh: THREE.SkinnedMesh;
  public renderableObject: InstancedMesh;

  constructor() { }

  private initParameter() {
    
    const row = 10, col = 10;
    this.avatarCount = row * col;

    this.avatarParam = {
      position: [],
      scale: [],
      rotation: [],
      textureIndex: [],
      color: []
    };

    for(let i = 0; i < row; i++) {
      for (let j = 0; j < col; j++) {
        this.avatarParam.position.push(new THREE.Vector3(1.2 * (i - row / 2), 0, 1.2 * (j - col / 2)));
        this.avatarParam.scale.push(new THREE.Vector3(0.01, 0.01, 0.01));
        this.avatarParam.rotation.push(new THREE.Euler(-0.5 * Math.PI, 0, Math.PI));
        this.avatarParam.textureIndex.push(Math.floor(Math.random() * baseMapPromises.length));
        this.avatarParam.color.push(new THREE.Color(1, 1, 1));
      }
    }

  }

  private initAnimation(animations: THREE.AnimationClip[], rootBone: THREE.Bone) {

    let animationData: Float32Array[][] = [];

    const skeleton = this.mesh.skeleton;
    const boneCount = skeleton.bones.length;
    skeleton.pose();

    animations.forEach(animation => {

      const frameData: Float32Array[] = [];

      const frameCount = animation.tracks[0].times.length;

      const boneBindings = animation.tracks.map(track => THREE.PropertyBinding.create(this.mesh, track.name))
      
      for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {

        animation.tracks.forEach((track, trackIndex) => {
          const boneBinding = boneBindings[trackIndex] as THREE.PropertyBinding;
          if (boneBinding.node.isBone) // except bone nub
            boneBinding.setValue(track.values, frameIndex * track.getValueSize());
        });
        rootBone.updateMatrixWorld(true);
        skeleton.update();

        frameData.push(skeleton.boneMatrices.slice(0, boneCount * 16)); // per frame

      }

      animationData.push(frameData); // per animation

    });
    
    return animationData;

  }

  public async initResource() {

    // load mesh
    const group = await loader.loadFBX('crowd/male_walk.fbx');
    this.mesh = group.children[0] as THREE.SkinnedMesh;
    
    // animation
    const bone = group.children[1];
    this.mesh.bindMode = 'detached';
    const animationData = this.initAnimation(group.animations, bone);
    

    // calculate tangent
    await MikkTSpace.ready;
    const mikkTSpace = {
      wasm: MikkTSpace.wasm,
      isReady: MikkTSpace.isReady,
      generateTangents: MikkTSpace.generateTangents
    }
    computeMikkTSpaceTangents(this.mesh.geometry, mikkTSpace);

    // load textures
    const baseMapArray = await Promise.all(baseMapPromises);
    baseMapArray.forEach(texture => texture.flipY = true);
    const normalMapArray = await Promise.all(normalMapPromises);
    normalMapArray.forEach(texture => texture.flipY = true);

    // init parameters
    this.initParameter();
    
    // set resources
    this.renderableObject = new InstancedMesh(this.mesh, this.avatarCount);
    this.renderableObject.setTransfrom(this.avatarParam.position, this.avatarParam.scale, this.avatarParam.rotation);
    this.renderableObject.setInfo(this.avatarParam.textureIndex);
    this.renderableObject.setColor(this.avatarParam.color);
    this.renderableObject.setTexture(baseMapArray, normalMapArray);

  }


}

export { CrowdManager }