
const A = /* wgsl */`
fn EncodeGBufferA(normal: vec3<f32>) -> vec4<f32> {
  return vec4<f32>(0.5 * normal + 0.5, 0.0);
}
`;

const B = /* wgsl */`
fn EncodeGBufferB(metalness: f32, specular: f32, roughness: f32) -> vec4<f32> {
  return vec4<f32>(metalness, specular, roughness, 0.0);
}
`;

const C = /* wgsl */`
fn EncodeGBufferC(baseColor: vec3<f32>) -> vec4<f32> {
  return vec4<f32>(baseColor, 0.0);
}
`;

const EncodeGBuffer = { A, B, C };

export { EncodeGBuffer };