import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { Definitions, Skinning } from '../../resource/shaderChunk';

export function vertexShaderFactory(
  slotAttributes: string[],
  bindingAttributes: string[][], 
  pass: ('render' | 'shadow')
) {

  let slotLocations = { }, bindingIndices = { };
  slotAttributes.forEach( (slotAttribute, slotIndex) => 
    slotLocations[slotAttribute] = `@location(${slotIndex})`
  );
  bindingAttributes.forEach(
    (group, groupIndex) => group.forEach(
      (binding, bindingIndex) => bindingIndices[binding] = `@group(${groupIndex}) @binding(${bindingIndex})`
    )
  );

  const tangent = !!slotLocations['tangent'] && !!bindingIndices['normalMap'];
  const skinned = !!slotLocations['skinIndex'] && !!slotLocations['skinWeight'] && !!bindingIndices['boneMatrices'];
  const pointLight = !!bindingIndices['pointLight'];
  const directionalLight = !!bindingIndices['directionalLight'];

  let code: string;

  if (pass === 'render') { // render pass
    code = wgsl
/* wgsl */`
${Definitions.Camera}
#if ${pointLight}
${Definitions.PointLight}
#endif
#if ${directionalLight}
${Definitions.DirectionalLight}
#endif
#if ${skinned}
${Definitions.SkinnedTransform}
#else
${Definitions.Transform}
#endif

${bindingIndices['camera']} var<uniform> camera: Camera;
#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif

#if ${skinned} 
${bindingIndices['skinnedTransform']} var<uniform> transform : SkinnedTransform;
${bindingIndices['boneMatrices']} var<storage, read> boneMatrices : array<mat4x4<f32>>;
#else
${bindingIndices['transform']} var<uniform> transform : Transform;
#endif

#if ${skinned}
${Skinning.Matrices}
#endif

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(perspective, center) vPosition: vec3<f32>,
  @location(1) @interpolate(perspective, center) vNormal: vec3<f32>,
  @location(2) @interpolate(perspective, center) uv: vec2<f32>,
  @location(3) @interpolate(perspective, center) vShadowPos: vec4<f32>,
#if ${tangent}
  @location(4) @interpolate(perspective, center) vTangent: vec3<f32>,
  @location(5) @interpolate(perspective, center) vBiTangent: vec3<f32>
#endif
};

@vertex
fn main(
  ${slotLocations['position']} position : vec3<f32>,
  ${slotLocations['normal']} normal : vec3<f32>,
  ${slotLocations['uv']} uv : vec2<f32>,
#if ${skinned}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
#if ${tangent}
  ${slotLocations['tangent']} tangent: vec4<f32>
#endif
) -> VertexOutput {
  
  // object space
#if ${skinned}
  let skinningMatrices = getSkinningMatrices(skinIndex);
  ${Skinning.SkinningPostion}
  ${Skinning.NormalSkinningMat}
  let normalObject = (normalSkinningMat * vec4<f32>(normal, 0.0)).xyz;
  #if ${tangent}
    let tangentObject = (normalSkinningMat * vec4<f32>(tangent.xyz, 0.0)).xyz;
  #endif
#endif
#if ${!skinned}
  let positionObject = vec4<f32>(position, 1.0);
  let normalObject = normal;
  #if ${tangent}
    let tangentObject = tangent.xyz;
  #endif
#endif

  // world space
  let positionWorld = transform.modelMat * positionObject;
  let normalWorld = transform.normalMat * normalObject;
#if ${tangent}
  let tangentWorld = transform.normalMat * tangentObject;
#endif
  
  var output: VertexOutput;
  output.position = camera.projectionMat * camera.viewMat * positionWorld;
  output.vPosition = positionWorld.xyz;
  output.vNormal = normalWorld;
  output.uv = uv;
  output.vShadowPos = light.viewProjectionMat * positionWorld; // @interpolate(perspective, center)

#if ${tangent}
  output.vTangent = tangentWorld;
  output.vBiTangent = cross(normalWorld, tangentWorld) * tangent.w; // tangent.w indicates the direction of biTangent
#endif

  return output;

}
`
  }

  else if (pass === 'shadow') { // shadow pass
    code = wgsl
/* wgsl */`
#if ${pointLight}
${Definitions.PointLight}
#endif
#if ${directionalLight}
${Definitions.DirectionalLight}
#endif
#if ${skinned}
${Definitions.SkinnedTransform}
#else
${Definitions.Transform}
#endif

#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif
#if ${skinned}
${bindingIndices['skinnedTransform']} var<uniform> transform : SkinnedTransform;
${bindingIndices['boneMatrices']} var<storage, read> boneMatrices : array<mat4x4<f32>>;
#else
${bindingIndices['transform']} var<uniform> transform : Transform;
#endif

#if ${skinned}
${Skinning.Matrices}
#endif

@vertex
fn main( 
  ${slotLocations['position']} position : vec3<f32>,
#if ${skinned}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
) -> @builtin(position) vec4<f32> {

#if ${skinned}
  let skinningMatrices = getSkinningMatrices(skinIndex);
  ${Skinning.SkinningPostion}
#else
  let positionObject = vec4<f32>(position, 1.0);
#endif
  
  return light.viewProjectionMat * transform.modelMat * positionObject;

}
`
  }

  return code;

}