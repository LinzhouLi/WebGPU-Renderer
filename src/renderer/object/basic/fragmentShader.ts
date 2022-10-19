import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { 
  Definitions, Constants, ToolFunctions, Shadow, PBR, ACESToneMapping
} from '../../resource/shaderChunk';

export function createFragmentShader(attributes: string[], type: string = 'phong') {

  const normalMap = attributes.includes('tangent') && attributes.includes('normalMap');

  const baseMap = attributes.includes('baseMap');
  const roughnessMap = attributes.includes('roughnessMap');
  const metalnessMap = attributes.includes('metalnessMap');
  const specularMap = attributes.includes('specularMap');

  const pointLight = attributes.includes('pointLight');

  let code: string;

  if (type === 'phong') {
    code = wgsl
/* wgsl */`
${Definitions.Camera}
${Definitions.PointLight}
${Definitions.DirectionalLight}
${Definitions.PBRMaterial}

@group(0) @binding(0) var<uniform> camera: Camera;
#if ${pointLight}
@group(0) @binding(1) var<uniform> light: PointLight;
#else
@group(0) @binding(1) var<uniform> light: DirectionalLight;
#endif
@group(0) @binding(2) var shadowMapSampler: sampler_comparison;
@group(0) @binding(3) var textureSampler: sampler;
@group(0) @binding(4) var shadowMap: texture_depth_2d;

@group(0) @binding(6) var<uniform> material: PBRMaterial;
#if ${baseMap}
@group(0) @binding(7) var baseMap: texture_2d<f32>;
#endif
#if ${normalMap}
@group(0) @binding(8) var normalMap: texture_2d<f32>;
#endif

${Constants}
${ToolFunctions}

${Shadow.hardShadow}
${Shadow.PCF}

${PBR.NDF}
${PBR.Geometry}
${PBR.Fresnel}
${PBR.Shading}

${ACESToneMapping}

fn blinnPhong(position: vec3<f32>, normal: vec3<f32>, albedo: vec3<f32>) -> vec3<f32> {

#if ${pointLight}
  let lightDir = normalize(light.position - position);
#else
  let lightDir = normalize(light.direction);
#endif
  let viewDir = normalize(camera.position - position);
  let halfVec = normalize(lightDir + viewDir);

  let ambient = albedo * light.color * 0.2;

  let diff = max(dot(lightDir, normal), 0.0);
  let diffuse = diff * light.color * albedo;

  let spec = pow(max(dot(normal, halfVec), 0.0), 32);
  let specular = spec * light.color * albedo;

  return ambient + diffuse + specular;

}


@fragment
fn main(
  @builtin(position) position: vec4<f32>,
  @location(0) fragPosition: vec3<f32>,
  @location(1) fragNormal: vec3<f32>,
  @location(2) fragUV: vec2<f32>,
  @location(3) shadowPos: vec4<f32>,
#if ${normalMap}
  @location(4) tangent: vec3<f32>,
  @location(5) biTangent: vec3<f32>
#endif
) -> @location(0) vec4<f32> {

  // normal
#if ${normalMap}
  let tbn: mat3x3<f32> = mat3x3<f32>(tangent, biTangent, fragNormal);
  let normal_del: vec3<f32> = normalize(
    textureSample(normalMap, textureSampler, fragUV).xyz - vec3<f32>(0.5, 0.5, 0.5)
  );
  let normal = normalize(tbn * normal_del.xyz);
#else
  let normal = fragNormal;
#endif

  // material
  var localMaterial: PBRMaterial;
#if ${roughnessMap}
  localMaterial.roughness = textureSample(roughnessMap, textureSampler, fragUV).x * material.roughness;
#else
  localMaterial.roughness = material.roughness;
#endif

#if ${metalnessMap}
  localMaterial.metalness = textureSample(metalnessMap, textureSampler, fragUV).x * material.metalness;
#else
  localMaterial.metalness = material.metalness;
#endif
  
#if ${baseMap} // blbedo
  localMaterial.albedo = textureSample(baseMap, textureSampler, fragUV).xyz * material.albedo;
#else
  localMaterial.albedo = material.albedo;
#endif

#if ${specularMap}
  localMaterial.specular = textureSample(specularMap, textureSampler, fragUV).xyz * material.specular;
#else
  localMaterial.specular = material.specular;
#endif

  // shadow
  let shadowCoords: vec3<f32> = vec3<f32>(
    shadowPos.xy / shadowPos.w * vec2<f32>(0.5, -0.5) + 0.5, // Convert shadowPos XY to (0, 1) to fit texture UV
    shadowPos.z / shadowPos.w
  );
  // let visibility = hardShadow(shadowCoords.xy, shadowCoords.z);
  let visibility = PCF(5.0, shadowCoords);
  // let visibility = 1.0;

  // Blinn-Phong shading
  // let shadingColor = blinnPhong(fragPosition, normal, albedo);

  // PBR shading
  let shadingColor = PBRShading(
    normal, normalize(camera.position - fragPosition), normalize(light.direction),
    localMaterial, light.color
  );

  let ambient = 0.2 * localMaterial.albedo; // * ao
  var color: vec3<f32> = 0.8 * shadingColor * visibility + ambient;

  // tone mapping
  color = ACESToneMapping(color);

  return vec4<f32>(color, 1.0);

}
`
  }

  return code;
  
}