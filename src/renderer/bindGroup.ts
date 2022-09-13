import * as THREE from 'three';

// console.info( 'THREE.WebGPURenderer: Modified Matrix4.makePerspective() and Matrix4.makeOrtographic() to work with WebGPU, see https://github.com/mrdoob/three.js/issues/20276.' );

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

const ResourcesForScene: string[][] = [
  ['projectionMatrix', 'viewMatrix', 'cameraPosition', 'lightPosition', 'lightColor', 'lightInfo']
];
const ResourcesForMesh: string[][] = [
  ['modelMatrix', 'meshInfo', 'boneMatrices'],
  ['linearSampler', 'texture', 'normalMap', 'metalnessMap']
];

class BindGroupFactor {

  device: GPUDevice;

  constructor(device: GPUDevice) {

    this.device = device;

  }

  createLayoutScene() {

    // constants for the scene
    const constantBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Bind Group Layout: Contants for Scene',
      entries: [{ // projection matrix
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      },{ // view matrix
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      }, { // camera position
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }, { // light position
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }, { // light color
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }, { // light infomation
        binding: 5,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' }
      }], 
    });

    return [constantBindGroupLayout];

  }

  async createResourceScene(
    camera: THREE.PerspectiveCamera,
    light: THREE.PointLight,
    layouts: GPUBindGroupLayout[]
  ) {

    // projection matrix
    const projectionMatrix = new Float32Array(camera.projectionMatrix.elements);
    const projectionMatrixBuffer = this.device.createBuffer({
      size: projectionMatrix.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(projectionMatrixBuffer, 0, projectionMatrix);

    // projection matrix
    const viewMatrix = new Float32Array(camera.matrixWorldInverse.elements);
    const viewMatrixBuffer = this.device.createBuffer({
      size: viewMatrix.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(viewMatrixBuffer, 0, viewMatrix);

    // camera position
    const cameraPosition = new Float32Array([camera.position.x, camera.position.y, camera.position.z]);
    const cameraPositionBuffer = this.device.createBuffer({
      size: cameraPosition.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(cameraPositionBuffer, 0, cameraPosition);

    // light position
    const lightPosition = new Float32Array([light.position.x, light.position.y, light.position.z]);
    const lightPositionBuffer = this.device.createBuffer({
      size: lightPosition.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(lightPositionBuffer, 0, lightPosition);

    // light color
    const lightColor = new Float32Array([light.color.r, light.color.g, light.color.b]);
    const lightColorBuffer = this.device.createBuffer({
      size: lightColor.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(lightColorBuffer, 0, lightColor);

    // light infomation (intensity, decay, distance)
    const lightInfo = new Float32Array([light.intensity, light.decay, light.distance]);
    const lightInfoBuffer = this.device.createBuffer({
      size: lightInfo.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(lightInfoBuffer, 0, lightInfo);

    const constantBindGroup = this.device.createBindGroup({
      label: 'Bind Group: Constants for Scene',
      layout: layouts[0],
      entries: [{
        binding: 0,
        resource: { buffer: projectionMatrixBuffer }
      }, {
        binding: 1,
        resource: { buffer: viewMatrixBuffer }
      }, {
        binding: 2,
        resource: { buffer: cameraPositionBuffer }
      }, {
        binding: 3,
        resource: { buffer: lightPositionBuffer }
      }, {
        binding: 4,
        resource: { buffer: lightColorBuffer }
      }, {
        binding: 5,
        resource: { buffer: lightInfoBuffer }
      }]
    });

    return {
      updateResources: { projectionMatrixBuffer, viewMatrixBuffer, cameraPositionBuffer },
      groups: [constantBindGroup]
    };

  }

}

class SkinnedStandardMaterialBindGroupFactor extends BindGroupFactor {

  constructor(device: GPUDevice) {

    super(device);

  }

  createLayoutMesh() {

    // constants for the mesh
    const constantBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Bind Group Layout: Contants for Mesh',
      entries: [{ // model matrix
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      }, { // mesh infomation
        binding: 1,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'uniform' }
      }, { // bone matrices
        binding: 2,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: 'read-only-storage' }
      }]
    });

    const materialBindGroupLayout = this.device.createBindGroupLayout({
      label: 'Bind Group Layout: Textures for Mesh Material',
      entries: [{ // sampler
        binding: 0,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: 'filtering' }
      }, { // texture
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' }
      }, { // normal map
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' }
      }, { // metalness map
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: 'float' }
      }]
    });

    return [constantBindGroupLayout, materialBindGroupLayout];

  }

  async createResourceMesh(
    mesh: THREE.SkinnedMesh,
    camera: THREE.PerspectiveCamera,
    layouts: GPUBindGroupLayout[]
  ) {

    if (!(mesh instanceof THREE.SkinnedMesh))
      throw new Error('Not SkinnedMesh');
    if (!(mesh.material instanceof THREE.MeshStandardMaterial))
      throw new Error('Not MeshStandardMaterial');

    camera.updateMatrixWorld();
    mesh.updateMatrixWorld();

    const skeleton = mesh.skeleton as THREE.Skeleton;
    const material = mesh.material as THREE.MeshStandardMaterial;

    // model matrix
    const modelMatrix = new Float32Array(mesh.matrixWorld.elements);
    const modelMatrixBuffer = this.device.createBuffer({
      size: modelMatrix.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(modelMatrixBuffer, 0, modelMatrix);

    // normal matrix
    // const normalMatrix = new Float32Array(
    //   camera.matrixWorldInverse.multiply(mesh.matrixWorld.invert().transpose()).elements
    // );
    // const normalMatrixBuffer = this.device.createBuffer({
    //   size: normalMatrix.byteLength,
    //   usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    // });
    // this.device.queue.writeBuffer(normalMatrixBuffer, 0, normalMatrix);

    // mesh infomation (bone count)
    const meshInfo = new Float32Array([skeleton.bones.length]);
    const meshInfoBuffer = this.device.createBuffer({
      size: meshInfo.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(meshInfoBuffer, 0, meshInfo);

    // bone matrices
    const boneMatrices = new Float32Array(skeleton.boneMatrices);
    const boneMatricesBuffer = this.device.createBuffer({
      size: boneMatrices.byteLength,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(boneMatricesBuffer, 0, boneMatrices);

    const constantBindGroup = this.device.createBindGroup({
      label: 'Bind Group: Constants for Mesh',
      layout: layouts[0],
      entries: [{
        binding: 0,
        resource: { buffer: modelMatrixBuffer }
      }, {
        binding: 1,
        resource: { buffer: meshInfoBuffer }
      }, {
        binding: 2,
        resource: { buffer: boneMatricesBuffer }
      }]
    });

    // sampler
    const sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });

    // texture
    let textureBitmap = material.map.source.data;
    const textureSize = [textureBitmap.width, textureBitmap.height];
    const texture = this.device.createTexture({
      size: textureSize,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.device.queue.copyExternalImageToTexture(
      { source: textureBitmap },
      { texture: texture },
      textureSize
    );

    // normal map
    let normalMapBitmap = await createImageBitmap(material.normalMap.source.data);
    const normalMapSize = [normalMapBitmap.width, normalMapBitmap.height];
    const normalMap = this.device.createTexture({
      size: normalMapSize,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.device.queue.copyExternalImageToTexture(
      { source: normalMapBitmap },
      { texture: normalMap },
      normalMapSize
    );

    // metalness map
    let metalnessMapBitmap = await createImageBitmap(material.metalnessMap.source.data);
    const metalnessMapSize = [metalnessMapBitmap.width, metalnessMapBitmap.height];
    const metalnessMap = this.device.createTexture({
      size: metalnessMapSize,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.device.queue.copyExternalImageToTexture(
      { source: metalnessMapBitmap },
      { texture: metalnessMap },
      metalnessMapSize
    );

    const materialBindGroup = this.device.createBindGroup({
      label: 'Bind Group: Textures for Mesh Material',
      layout: layouts[1],
      entries: [{
        binding: 0,
        resource: sampler
      }, {
        binding: 1,
        resource: texture.createView()
      }, {
        binding: 2,
        resource: normalMap.createView()
      }, {
        binding: 3,
        resource: metalnessMap.createView()
      }]
    });

    return {
      updateResources: { modelMatrixBuffer, boneMatricesBuffer },
      groups: [constantBindGroup, materialBindGroup]
    };

  }

}

export { ResourcesForScene, ResourcesForMesh, BindGroupFactor, SkinnedStandardMaterialBindGroupFactor };