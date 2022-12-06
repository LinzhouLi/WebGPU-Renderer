const Camera = `
struct Camera {
  position: vec3<f32>,
  viewMat: mat4x4<f32>,
  projectionMat: mat4x4<f32>
}
`;

const Transform = `
struct Transform {
  modelMat: mat4x4<f32>,
  normalMat : mat3x3<f32>
}
`;

const PhysicalMaterial = `
struct PhysicalMaterial {
  roughness: f32,             // [0, 1]
  specularF90: f32,
  diffuseColor: vec3<f32>,    // diffuse color 
  specularColor: vec3<f32>,   // F0: normal-incidence Fresnel reflectance
}
`;

const Material = `
struct Material {
  metalness: f32,
  specular: f32,
  roughness: f32,
  baseColor: vec3<f32>,
}
`;

const DataStructure = {
  Camera, Transform, 
  PhysicalMaterial, Material
};

export { DataStructure };