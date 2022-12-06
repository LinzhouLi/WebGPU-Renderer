
const A = /* wgsl */`
fn DecodeGBufferA(coord: vec2<i32>) -> vec4<f32> {
  let value = textureLoad(GBufferA, coord, 0);
  let normal = normalize(2.0 * value.xyz - 1.0);
  return vec4<f32>(normal, value.w);
}
`;

const B = /* wgsl */`
fn DecodeGBufferB(coord: vec2<i32>) -> vec4<f32> {
  let value = textureLoad(GBufferB, coord, 0);
  return value;
}
`;

const C = /* wgsl */`
fn DecodeGBufferC(coord: vec2<i32>) -> vec4<f32> {
  let value = textureLoad(GBufferC, coord, 0);
  let baseColor = sRGBGammaDecode(value.xyz);
  return vec4<f32>(baseColor, value.w);
}
`;

const DecodeGBuffer = { A, B, C };

export { DecodeGBuffer };