const Matrices = /* wgsl */`
fn getSkinningMatrices(skinIndex: vec4<u32>) -> array<mat4x4<f32>, 4> {
  return array<mat4x4<f32>, 4>(
    boneMatrices[skinIndex.x], boneMatrices[skinIndex.y],
    boneMatrices[skinIndex.z], boneMatrices[skinIndex.w]
  );
}
`;

const InstanceMatrices = /* wgsl */`
fn getSkinningMatrices(
  skinIndex: vec4<u32>, 
  animationIndex: u32,
  frameIndex: u32
) -> array<mat4x4<f32>, 4> {
  let offset = (u32(animationInfo.frameOffsets[animationIndex]) + frameIndex) * u32(animationInfo.boneCount);
  return array<mat4x4<f32>, 4>(
    animationBuffer[skinIndex.x + offset], animationBuffer[skinIndex.y + offset],
    animationBuffer[skinIndex.z + offset], animationBuffer[skinIndex.w + offset]
  );
}
`;

const SkinningPostion = /* wgsl */`
fn skinning(
  position: vec3<f32>,
  skinningMatrices: array<mat4x4<f32>, 4>,
  skinWeight: vec4<f32>,
  bindMat: mat4x4<f32>,
  bindMatInverse: mat4x4<f32>
) -> vec4<f32> {
  let positionSkin = bindMat * vec4<f32>(position, 1.0);
  var result = skinningMatrices[0] * positionSkin * skinWeight[0];
  result = result + skinningMatrices[1] * positionSkin * skinWeight[1];
  result = result + skinningMatrices[2] * positionSkin * skinWeight[2];
  result = result + skinningMatrices[3] * positionSkin * skinWeight[3];
  return bindMatInverse * result;
}
`;

const SkinningNormalMat = /* wgsl */`
fn getSkinningNormalMat(
  skinningMatrices: array<mat4x4<f32>, 4>,
  skinWeight: vec4<f32>,
  bindMat: mat4x4<f32>,
  bindMatInverse: mat4x4<f32>
) -> mat4x4<f32> {
  var result = skinningMatrices[0] * skinWeight[0];
  result = result + skinningMatrices[1] * skinWeight[1];
  result = result + skinningMatrices[2] * skinWeight[2];
  result = result + skinningMatrices[3] * skinWeight[3];
  return bindMatInverse * result * bindMat;
}
`;

const Skinning = { Matrices, SkinningPostion, InstanceMatrices, SkinningNormalMat };