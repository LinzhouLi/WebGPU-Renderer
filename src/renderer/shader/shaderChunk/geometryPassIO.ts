import { wgsl } from '../../../3rd-party/wgsl-preprocessor';
import { ShaderParam, VertexShaderParam, FragmentShaderParam } from '../shaderLib/geometryPass';

// geometry pass

// Varing values are the variables that transferred from vertex shader to fragment shader
// acting as both the output of vertex shader and the input of fragment shader.
// The arrange order of varing values are as follow:
// 1. vNormal         -- must exist
// 2. vUv             -- must exist
// 3. vTangent        -- exist if {ShaderParam.tangent} is true
// 4. vBiTangent      -- exist if {ShaderParam.tangent} is true
// todo

const VaringValueConfigs = {
  vNormal: '@interpolate(perspective, center) vNormal: vec3<f32>',
  vUv: '@interpolate(perspective, center) vUv: vec2<f32>',
  vTangent: '@interpolate(perspective, center) vTangent: vec3<f32>',
  vBiTangent: '@interpolate(perspective, center) vBiTangent: vec3<f32>'
}

function getVaringValues(
  params: ShaderParam
) {
  let code = '', location = 0;
  let addVaringValue = (attribute: string) => {
    code += `  @location(${location}) ${VaringValueConfigs[attribute]},\n`;
    location++;
  };
  addVaringValue('vNormal');
  addVaringValue('vUv');
  if (params.tangent) {
    addVaringValue('vTangent');
    addVaringValue('vBiTangent');
  }
  return code;
}


function VertInput(
  params: VertexShaderParam,
  slotLocations: Record<string, string>
) {
  return wgsl
  /* wgsl */`
  
struct VertInput {
  ${slotLocations['position']} position : vec3<f32>,
  ${slotLocations['normal']} normal : vec3<f32>,
  ${slotLocations['uv']} uv : vec2<f32>,
#if ${params.skinning}
  ${slotLocations['skinIndex']} skinIndex: vec4<u32>,
  ${slotLocations['skinWeight']} skinWeight: vec4<f32>,
#endif
#if ${params.tangent}
  ${slotLocations['tangent']} tangent: vec4<f32>
#endif
}

  `;
}

function VertOutput(params: VertexShaderParam) {
  let varings = getVaringValues(params);
  return wgsl
  /* wgsl */`

struct VertOutput {
  @builtin(position) position: vec4<f32>,
  ${varings}
}

  `;
}


function FragInput (params: FragmentShaderParam) {
  let varings = getVaringValues(params);
  return wgsl
  /* wgsl */`

struct FragInput {
  ${varings}
}

`;
}

function FragOutput (params: FragmentShaderParam) {
  return wgsl
  /* wgsl */`

struct FragOutput {
  @location(0) GBufferA: vec4<f32>, // normal
  @location(1) GBufferB: vec4<f32>, // material
  @location(2) GBufferC: vec4<f32>  // base color
}
  
`;
}

const GeometryPassIO = { VertInput, VertOutput, FragInput, FragOutput };

export { GeometryPassIO };