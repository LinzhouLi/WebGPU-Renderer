import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { Definitions } from '../../resource/shaderChunk';

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

  const tangent = !!slotLocations['tangent'] && !!bindingIndices['normalMapArray'];
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

${bindingIndices['instancedModelMat']} var<storage, read> modelMats: array<mat4x4<f32>>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) @interpolate(perspective, center) vPosition: vec3<f32>,
  @location(1) @interpolate(perspective, center) vNormal: vec3<f32>,
  @location(2) @interpolate(perspective, center) uv: vec2<f32>,
  @location(3) @interpolate(perspective, center) vShadowPos: vec4<f32>,
  @location(4) @interpolate(flat) instanceIndex: u32,
#if ${tangent}
  @location(5) @interpolate(perspective, center) vTangent: vec3<f32>,
  @location(6) @interpolate(perspective, center) vBiTangent: vec3<f32>
#endif
};

@vertex
fn main(
  @builtin(instance_index) instanceIndex: u32,
  ${slotLocations['position']} position : vec3<f32>,
  ${slotLocations['normal']} normal : vec3<f32>,
  ${slotLocations['uv']} uv : vec2<f32>,
#if ${tangent}
  ${slotLocations['tangent']} tangent: vec4<f32>
#endif
) -> VertexOutput {
  
  // object space
  let modelMat = modelMats[instanceIndex];
  let positionObject = vec4<f32>(position, 1.0);
  let normalObject = normal;
  #if ${tangent}
    let tangentObject = tangent.xyz;
  #endif

  // world space
  let positionWorld = modelMat * positionObject;
  let normalWorld = (modelMat * vec4<f32>(normalObject, 0.0)).xyz;
  #if ${tangent}
    let tangentWorld = (modelMat * vec4<f32>(tangentObject, 0.0)).xyz;
  #endif
  
  var output: VertexOutput;
  output.position = camera.projectionMat * camera.viewMat * positionWorld;
  output.vPosition = positionWorld.xyz;
  output.vNormal = normalWorld;
  output.uv = uv;
  output.vShadowPos = light.viewProjectionMat * positionWorld; // @interpolate(perspective, center)
  output.instanceIndex = instanceIndex;

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

#if ${pointLight}
${bindingIndices['pointLight']} var<uniform> light: PointLight;
#endif
#if ${directionalLight}
${bindingIndices['directionalLight']} var<uniform> light: DirectionalLight;
#endif
${bindingIndices['instancedModelMat']} var<storage, read> modelMats: array<mat4x4<f32>>;

@vertex
fn main(
  @builtin(instance_index) instanceIndex: u32,
  ${slotLocations['position']} position : vec3<f32>,
) -> @builtin(position) vec4<f32> {
  
  let positionObject = vec4<f32>(position, 1.0);

  return light.viewProjectionMat * modelMats[instanceIndex] * positionObject;

}
`
  }
  
  return code;

}