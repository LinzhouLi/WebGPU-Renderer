import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { 
  Definitions, Constants, ToolFunction, Shadow, PBR, ACESToneMapping
} from '../../resource/shaderChunk';

export function fragmentShaderFactory(
  slotAttributes: string[],
  bindingAttributes: string[][], 
  type: ('phong' | 'PBR') = 'PBR'
) {

  let bindingIndices = { };
  bindingAttributes.forEach(
    (group, groupIndex) => group.forEach(
      (binding, bindingIndex) => bindingIndices[binding] = `@group(${groupIndex}) @binding(${bindingIndex})`
    )
  );
  
  const baseMap = !!bindingIndices['baseMap'];
  const normalMap = slotAttributes.includes('tangent') && !!bindingIndices['normalMap'];
  const roughnessMap = !!bindingIndices['roughnessMap'];
  const metalnessMap = !!bindingIndices['metalnessMap'];
  const specularMap = !!bindingIndices['specularMap'];
  const pointLight = !!bindingIndices['pointLight'];
  const directionalLight = !!bindingIndices['directionalLight'];

  let code: string;

  if (type === 'PBR') {
    code = wgsl
/* wgsl */`
${Definitions.Camera}
${Definitions.PointLight}
${Definitions.DirectionalLight}
${Definitions.PBRMaterial}

${bindingIndices['camera']} var<uniform> camera: Camera;
#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif

${bindingIndices['shadowMap']} var shadowMap: texture_depth_2d;
${bindingIndices['envMap']} var envMap: texture_cube<f32>;
${bindingIndices['diffuseEnvMap']} var diffuseEnvMap: texture_cube<f32>;

${bindingIndices['compareSampler']} var compareSampler: sampler_comparison;
${bindingIndices['linearSampler']} var linearSampler: sampler;

${bindingIndices['Lut']} var Lut: texture_2d<f32>;

${bindingIndices['PBRMaterial']} var<uniform> material: PBRMaterial;
#if ${baseMap}
${bindingIndices['baseMap']} var baseMap: texture_2d<f32>;
#endif
#if ${normalMap}
${bindingIndices['normalMap']} var normalMap: texture_2d<f32>;
#endif
#if ${metalnessMap}
${bindingIndices['metalnessMap']} var metalnessMap: texture_2d<f32>;
#endif
#if ${roughnessMap}
${bindingIndices['roughnessMap']} var roughnessMap: texture_2d<f32>;
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
${PBR.PBRShading}
${PBR.PBREnvShading}

${ACESToneMapping}


@fragment
fn main(
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(perspective, center) vPosition: vec3<f32>,
  @location(1) @interpolate(perspective, center) vNormal: vec3<f32>,
  @location(2) @interpolate(perspective, center) uv: vec2<f32>,
  @location(3) @interpolate(perspective, center) vShadowPos: vec4<f32>,
#if ${normalMap}
  @location(4) @interpolate(perspective, center) vTangent: vec3<f32>,
  @location(5) @interpolate(perspective, center) vBiTangent: vec3<f32>
#endif
) -> @location(0) vec4<f32> {

  // normal
#if ${normalMap}
  let TBN = mat3x3<f32>(normalize(vTangent), normalize(vBiTangent), normalize(vNormal));
  let mapNormal = 2.0 * textureSample(normalMap, linearSampler, uv).xyz - 1.0;
  let normal = TBN * mapNormal;
#else
  let normal = normalize(vNormal);
#endif

  // material
  var localMaterial: PBRMaterial;
#if ${roughnessMap}
  localMaterial.roughness = textureSample(roughnessMap, linearSampler, uv).x;
#else
  localMaterial.roughness = material.roughness;
#endif

#if ${metalnessMap}
  localMaterial.metalness = textureSample(metalnessMap, linearSampler, uv).x;
#else
  localMaterial.metalness = material.metalness;
#endif
  
#if ${baseMap} // blbedo
  localMaterial.albedo = textureSample(baseMap, linearSampler, uv).xyz;
#else
  localMaterial.albedo = material.albedo;
#endif

#if ${specularMap}
  localMaterial.specular = textureSample(specularMap, linearSampler, uv).xyz;
#else
  localMaterial.specular = material.specular;
#endif

  // shadow
  let shadowUV = vShadowPos.xy / vShadowPos.w * vec2<f32>(0.5, -0.5) + 0.5;
  let shadowDepth = vShadowPos.z / vShadowPos.w;
  // let visibility = 1.0;
  // let visibility = hardShadow(shadowUV, shadowDepth, shadowMap, compareSampler);
  let visibility = PCF(shadowUV, shadowDepth, 5.0, shadowMap, compareSampler);

  let viewDir = normalize(camera.position - vPosition);
  let lightDir = normalize(light.direction);

  // Blinn-Phong shading
  // let directShading = PhongShading(
  //   normal, viewDir, lightDir,
  //   localMaterial, light.color
  // );
  // let envShading = PhongEnvShading(
  //   normal, viewDir, localMaterial
  // );

  // PBR shading
  let directShading = PBRShading(
    normal, viewDir, lightDir,
    localMaterial, light.color
  );
  let envShading = PBREnvShading(
    normal, viewDir, localMaterial
  );

  var color: vec3<f32> = (0.7 * directShading * visibility + 0.3 * envShading);

  // tone mapping
  color = ACESToneMapping(color);

  return vec4<f32>(color, 1.0);


}
`
  }
  
  return code;
  
}