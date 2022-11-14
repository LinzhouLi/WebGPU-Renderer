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
${Definitions.Transform}

${bindingIndices['camera']} var<uniform> camera: Camera;
#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif

${bindingIndices['transform']} var<uniform> transform : Transform;
#if ${skinned}
${bindingIndices['boneMatrices']} var<storage, read> boneMatrices : array<mat4x4<f32>>;
#endif

#if ${skinned}
${Skinning.SingleSkinning}
${Skinning.BlendSkinning}
#endif

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(linear, center) fragPosition: vec3<f32>,
  @location(1) @interpolate(linear, center) fragNormal: vec3<f32>,
  @location(2) @interpolate(linear, center) fragUV: vec2<f32>,
  @location(3) @interpolate(perspective, center) shadowPos: vec4<f32>,
#if ${tangent}
  @location(4) @interpolate(linear, center) tangent: vec3<f32>,
  @location(5) @interpolate(linear, center) biTangent: vec3<f32>
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
  
#if ${skinned}
  let positionObject = blendSkinning(vec4<f32>(position, 1.0), skinIndex, skinWeight);
  let positionWorld = transform.modelMat * positionObject;
  let normalObject = blendSkinning(vec4<f32>(normal, 0.0), skinIndex, skinWeight).xyz;
  let normalWorld = normalize(transform.normalMat * normalObject);
#else
  let positionWorld = transform.modelMat * vec4<f32>(position, 1.0);
  let normalWorld = normalize(transform.normalMat * normal);
#endif
  
  var output: VertexOutput;
  output.position = camera.projectionMat * camera.viewMat * positionWorld;
  output.fragPosition = positionWorld.xyz;
  output.fragNormal = normalWorld;
  output.fragUV = uv;
  output.shadowPos = light.viewProjectionMat * positionWorld; // @interpolate(perspective, center)

#if ${tangent}
  let tangentWorld = normalize(transform.normalMat * tangent.xyz);
  output.tangent = tangentWorld;
  output.biTangent = cross(normalWorld, tangentWorld) * tangent.w; // tangent.w indicates the direction of biTangent
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
${Definitions.Transform}

#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif
${bindingIndices['transform']} var<uniform> transform: Transform;
#if ${skinned}
${bindingIndices['boneMatrices']} var<storage, read> boneMatrices : array<mat4x4<f32>>;
#endif

#if ${skinned}
${Skinning.SingleSkinning}
${Skinning.BlendSkinning}
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
  let positionObject = blendSkinning(vec4<f32>(position, 1.0), skinIndex, skinWeight);
#else
  let positionObject = vec4<f32>(position, 1.0);
#endif
  
  return light.viewProjectionMat * transform.modelMat * positionObject;

}
`
  }
  
  return code;

}