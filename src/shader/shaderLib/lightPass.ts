import { wgsl } from '../../3rd-party/wgsl-preprocessor';
import {
  ColorManagement, DecodeGBuffer, CameraTransform, DataStructure
} from '../shaderChunk';

// VertOutput.coord.xy range from (0, 0) to (1, 1). Used as uv sampling coord
// VertOutput.coord.zw range from (0, 0) to (screenWidth, screenHeight). Used as texture coord for textureLoad()

const Vertex = /* wgsl */`
override screenWidth: f32;
override screenHeight: f32;

struct VertOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(linear, center) coord: vec4<f32>,
  @location(1) @interpolate(linear, center) viewVector: vec3<f32>
};

const coords = array<vec2<f32>, 4>(
  vec2<f32>(-1.0, -1.0), // Bottom Left
  vec2<f32>( 1.0, -1.0), // Bottom Right
  vec2<f32>(-1.0,  1.0), // Top Left
  vec2<f32>( 1.0,  1.0)  // Top Right
);

${DataStructure.Camera}
@group(0) @binding(4) var<uniform> camera: Camera;

@vertex
fn main(@builtin(vertex_index) index: u32) -> VertOutput {
  let coord = coords[index];
  let position = vec4<f32>(coord, 0.0, 1.0);
  let uv = coord * vec2<f32>(0.5, -0.5) + 0.5; // https://www.w3.org/TR/webgpu/#coordinate-systems
  let gbufferCoord = vec4<f32>(uv, uv * vec2<f32>(screenWidth, screenHeight));
  return VertOutput(
    position, gbufferCoord, camera.frustumCorners[index]
  );
}
`;


const Fragment = /* wgsl */`
${DataStructure.Camera}

${DecodeGBuffer.A}
${DecodeGBuffer.B}
${DecodeGBuffer.C}
${ColorManagement.sRGB_EOTF}
${ColorManagement.sRGB_OETF}
${CameraTransform.Linear01Depth}
${CameraTransform.LinearEyeDepth}

@group(0) @binding(0) var GBufferA: texture_2d<f32>;
@group(0) @binding(1) var GBufferB: texture_2d<f32>;
@group(0) @binding(2) var GBufferC: texture_2d<f32>;
@group(0) @binding(3) var GBufferDepth: texture_depth_2d;
@group(0) @binding(4) var<uniform> camera: Camera;

@fragment
fn main(
  @location(0) @interpolate(linear, center) coord: vec4<f32>,
  @location(1) @interpolate(linear, center) viewVector: vec3<f32>
) -> @location(0) vec4<f32> {

  let GBufferCoord = vec2<i32>(coord.zw);
  let GBufferValueA = DecodeGBufferA(GBufferCoord);
  let GBufferValueB = DecodeGBufferB(GBufferCoord);
  let GBufferValueC = DecodeGBufferC(GBufferCoord);
  let GBufferDepthValue = textureLoad(GBufferDepth, GBufferCoord, 0);

  let normalWorld = GBufferValueA.xyz;
  let metalness = GBufferValueB.x;
  let specular = GBufferValueB.y;
  let roughness = GBufferValueB.z;
  let baseColor = GBufferValueC.xyz;

  // sRGBGammaEncode(baseColor)
  // vec3<f32>(depth01)
  let depth01 = linear01Depth(GBufferDepthValue);
  let depthEye = linearEyeDepth(GBufferDepthValue);
  let positionWorld =  camera.position + depthEye * viewVector;

  return vec4<f32>(vec3<f32>(depth01), 1.0);
}
`;


const LightPassShader = { Vertex, Fragment }

export { LightPassShader };