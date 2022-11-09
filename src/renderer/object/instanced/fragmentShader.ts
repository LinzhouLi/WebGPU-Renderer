import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { 
  Definitions, Constants, ToolFunction, Shadow, PBR, ACESToneMapping
} from '../../resource/shaderChunk';

export function createFragmentShader(attributes: string[], type: string = 'phong') {
  
  const normalMapArray = attributes.includes('tangent') && attributes.includes('normalMapArray');
  const baseMapArray = attributes.includes('baseMapArray');

  const pointLight = attributes.includes('pointLight');

  let code: string;

  if (type === 'phong') {
    code = wgsl
/* wgsl */`
${Definitions.Camera}
${Definitions.PointLight}
${Definitions.DirectionalLight}
${Definitions.PBRMaterial}

struct InstanceInfo {
  textureIndex: u32
};

@group(0) @binding(0) var<uniform> camera: Camera;
#if ${pointLight}
@group(0) @binding(1) var<uniform> light: PointLight;
#else
@group(0) @binding(1) var<uniform> light: DirectionalLight;
#endif

@group(0) @binding(2) var shadowMap: texture_depth_2d;
@group(0) @binding(3) var envMap: texture_cube<f32>;
@group(0) @binding(4) var diffuseEnvMap: texture_cube<f32>;

@group(0) @binding(5) var compareSampler: sampler_comparison;
@group(0) @binding(6) var linearSampler: sampler;

@group(0) @binding(7) var Lut: texture_2d<f32>;

@group(1) @binding(1) var<storage, read> instanceColors: array<vec3<f32>>;
@group(1) @binding(2) var<storage, read> instanceInfos: array<InstanceInfo>;
#if ${baseMapArray}
@group(1) @binding(3) var baseMap: texture_2d_array<f32>;
#endif
#if ${normalMapArray}
@group(1) @binding(4) var normalMap: texture_2d_array<f32>;
#endif

${Constants}

${ToolFunction.Random}
${ToolFunction.Lerp}
${ToolFunction.SampleTexture}

${Shadow.hardShadow}
${Shadow.PCF}

${PBR.NDF}
${PBR.Geometry}
${PBR.Fresnel}
${PBR.Shading}
${PBR.EnvironmentShading}

${ACESToneMapping}


@fragment
fn main(
  @builtin(position) position: vec4<f32>,
  @location(0) fragPosition: vec3<f32>,
  @location(1) fragNormal: vec3<f32>,
  @location(2) fragUV: vec2<f32>,
  @location(3) shadowPos: vec4<f32>,
  @location(4) @interpolate(flat) index: u32,
#if ${normalMapArray}
  @location(5) tangent: vec3<f32>,
  @location(6) biTangent: vec3<f32>
#endif
) -> @location(0) vec4<f32> {

  let info = instanceInfos[index];
  // normal
#if ${normalMapArray}
  let tbn: mat3x3<f32> = mat3x3<f32>(tangent, biTangent, fragNormal);
  let normal_del: vec3<f32> = normalize( // transform texture array index from u32 to i32
    textureSample(normalMap, linearSampler, fragUV, i32(info.textureIndex)).xyz - vec3<f32>(0.5, 0.5, 0.5)
  );
  let normal = normalize(tbn * normal_del.xyz);
#else
  let normal = fragNormal;
#endif

  // material
  var localMaterial: PBRMaterial;
  localMaterial.roughness = 0.5;
  localMaterial.metalness = 0.0;
#if ${baseMapArray}
  localMaterial.albedo = textureSample(baseMap, linearSampler, fragUV, i32(info.textureIndex)).xyz * instanceColors[index];
#else
  localMaterial.albedo = instanceColors[index];
#endif

  // shadow
  let shadowCoords: vec3<f32> = vec3<f32>(
    shadowPos.xy / shadowPos.w * vec2<f32>(0.5, -0.5) + 0.5, // Convert shadowPos XY to (0, 1) to fit texture UV
    shadowPos.z / shadowPos.w
  );
  // let visibility = textureSampleCompare(
  //   shadowMap, shadowMapSampler, 
  //   shadowCoords.xy, shadowCoords.z - bias
  // );
  // let visibility = PCF(5.0, shadowCoords);
  let visibility = 1.0;

  // Blinn-Phong shading
  // let shadingColor: vec3<f32> = blinnPhong(fragPosition, normal, albedo);

  // PBR shading
  let viewDir = normalize(camera.position - fragPosition);
  let lightDir = normalize(light.direction);
  let directShading = PBRShading(
    normal, viewDir, lightDir,
    localMaterial, light.color
  );
  let envShading = PBREnvShading(
    normal, viewDir, localMaterial
  );

  var color: vec3<f32> = (0.7 * directShading * visibility + 0.6 * envShading);
  // var color: vec3<f32> = envShading;

  // tone mapping
  color = ACESToneMapping(color);

  return vec4<f32>(color, 1.0);

}
`
  }
  
  return code;
  
}