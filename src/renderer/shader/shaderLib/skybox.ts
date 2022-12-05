import { DataStructure, ColorManagement, GeometryPassIO } from "../shaderChunk";

const Vertex = /* wgsl */`
${DataStructure.Camera}
@group(0) @binding(0) var<uniform> camera: Camera;

struct VertOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) vPosition: vec3<f32>,
};

@vertex
fn main(@location(0) position: vec3<f32>) -> VertOutput {
  let positionCamera = camera.viewMat * vec4<f32>(position, 0.0);
  let positionScreen = camera.projectionMat * vec4<f32>(positionCamera.xyz, 1.0);
  return VertOutput(positionScreen.xyww, position);
}
`;


const Fragment = /* wgsl */`
@group(0) @binding(1) var linearSampler: sampler;
@group(0) @binding(2) var envMap: texture_cube<f32>;

${ColorManagement.sRGB_OETF}
${GeometryPassIO.FragOutput}

@fragment
fn main(
  @builtin(position) position: vec4<f32>,
  @location(0) vPosition: vec3<f32>,
) -> FragOutput {
  let color = textureSampleLevel(envMap, linearSampler, vPosition, 0).xyz;
  let r = vec4<f32>(sRGBGammaEncode(color), 1.0);
  return FragOutput(vec4<f32>(0.0), vec4<f32>(0.0), r);
}
`;


const SkyboxShader = { Vertex, Fragment };

export { SkyboxShader };