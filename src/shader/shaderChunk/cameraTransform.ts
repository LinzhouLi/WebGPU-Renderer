
const Linear01Depth = /* wgsl */`
fn linear01Depth(z: f32) -> f32 {
  return 1.0 / (camera.params.x * z + camera.params.y);
}
`;

const LinearEyeDepth = /* wgsl */`
fn linearEyeDepth(z: f32) -> f32 {
  return 1.0 / (camera.params.z * z + camera.params.w);
}
`;

const CameraTransform = { Linear01Depth, LinearEyeDepth };

export { CameraTransform };