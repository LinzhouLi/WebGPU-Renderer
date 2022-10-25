import { EnvMapResolution } from '../base';
import { device } from '../renderer';
import { Constants, Sampling, PBR, ToolFunction } from '../resource/shaderChunk';

const PixelIndex2Direction = /* wgsl */`
const PixelIndex2DirTransforms = array<mat3x3<f32>, 6>(
  mat3x3<f32>(
    0.0, 0.0, -1.0,
    0.0, -1.0, 0.0,
    1.0, 0.0, 0.0
  ),
  mat3x3<f32>(
    0.0, 0.0, 1.0,
    0.0, -1.0, 0.0,
    -1.0, 0.0, 0.0
  ),
  mat3x3<f32>(
    1.0, 0.0, 0.0,
    0.0, 0.0, 1.0,
    0.0, 1.0, 0.0
  ),
  mat3x3<f32>(
    1.0, 0.0, 0.0,
    0.0, 0.0, -1.0,
    0.0, -1.0, 0.0
  ),
  mat3x3<f32>(
    1.0, 0.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, 0.0, 1.0
  ),
  mat3x3<f32>(
    -1.0, 0.0, 0.0,
    0.0, -1.0, 0.0,
    0.0, 0.0, -1.0
  ),
);

fn pixelIndex2Direction(index: vec3<u32>) -> vec3<f32> {
  let halfWidth = f32(resolution) * 0.5;
  let uv = (vec2<f32>(index.xy) + 0.5 - halfWidth) / halfWidth;
  let dir = PixelIndex2DirTransforms[index.z] * vec3<f32>(uv, 1.0);
  return normalize(dir);
}`

const DiffuseEnvShader = /* wgsl */`
override resolution: u32;
@group(0) @binding(0) var diffuseEnvMap: texture_storage_2d_array<rgba8unorm, write>;
@group(0) @binding(1) var envMap: texture_2d_array<f32>;

${Constants}
${ToolFunction.Lerp}
${ToolFunction.SampleTexture}

${Sampling.RadicalInverse}
${Sampling.Hammersley}
${Sampling.SampleDisk}
${Sampling.HemisphereCosine}

${PixelIndex2Direction}

const SANPLE_COUNT: u32 = 256;

fn integrateLight(N: vec3<f32>) -> vec4<f32> {

  var irradiance = vec4<f32>(0.0);
  var up = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(N.y) < 0.999) { up = vec3<f32>(1.0, 0.0, 0.0); }
  let T = normalize(cross(up, N));
  let B = cross(N, T);
  let TNB = mat3x3<f32>(T, N, B);

  for (var i: u32 = 0; i < SANPLE_COUNT; i = i + 1) {
    let sample2D = Hammersley(i, SANPLE_COUNT);
    let dir = hemisphereSampleCosine(sample2D); // in tangent space
    let L = TNB * dir;

    // 1 / PI * radiance = 1 / PI * Li * NoV
    // pdf = NoV / PI
    // result = radiance / pdf = Li

    irradiance = irradiance + bilinearSampleCubeTexture(envMap, 2048, L);
  }
  return irradiance / f32(SANPLE_COUNT);

}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {
  if(global_index.x >= resolution || global_index.y >= resolution || global_index.z >= 6) { return; }
  let coord3D = pixelIndex2Direction(global_index);
  textureStore(
    diffuseEnvMap, 
    vec2<i32>(global_index.xy),
    i32(global_index.z),
    integrateLight(coord3D)
  );
}
`;

class IBL {

  public static DiffuseEnvMapResulotion = 256;
  public static LutResulotion = 512;

  private DiffuseEnvComputePipeline: GPUComputePipeline;
  private SpecularEnvComputePipeline: GPUComputePipeline;
  private LutComputePipeline: GPUComputePipeline;

  private DiffuseEnvBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };
  private SpecularEnvBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };
  private LutBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };

  constructor() { }

  private async initDiffuseEnvComputePipeline(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) { // @ts-ignore

    this.DiffuseEnvBindGroup = { };
    this.DiffuseEnvBindGroup.layout = device.createBindGroupLayout({
      label: 'Diffuse EnvMap precompute bind group layout',
      entries: [{
        binding: 0, visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'rgba8unorm', viewDimension: '2d-array' }
      }, {
        binding: 1, visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'float', viewDimension: '2d-array' }
      }]
    });
    this.DiffuseEnvBindGroup.group = device.createBindGroup({
      label: 'Diffuse EnvMap precompute bind group',
      layout: this.DiffuseEnvBindGroup.layout,
      entries: [{ 
        binding: 0, 
        resource: (globalResource.diffuseEnvMap as GPUTexture).createView({
          format: 'rgba8unorm', dimension: '2d-array', arrayLayerCount: 6
        }) 
      }, {
        binding: 1, 
        resource: (globalResource.envMap as GPUTexture).createView({
          format: 'rgba8unorm', dimension: '2d-array', arrayLayerCount: 6
        })
      }]
    });

    this.DiffuseEnvComputePipeline = await device.createComputePipelineAsync({
      label: "PreCompute pipeline for IBL (Diffuse EnvMap)",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.DiffuseEnvBindGroup.layout] }),
      compute: {
        module: device.createShaderModule({code: DiffuseEnvShader}),
        entryPoint: 'main',
        constants: {
          resolution: IBL.DiffuseEnvMapResulotion
        }
      }
    })

  }

  public async initComputePipeline(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) { 

    await this.initDiffuseEnvComputePipeline(globalResource);

  }

  public run() {

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.DiffuseEnvComputePipeline);
    passEncoder.setBindGroup(0, this.DiffuseEnvBindGroup.group);
    passEncoder.dispatchWorkgroups(
      Math.ceil(IBL.DiffuseEnvMapResulotion / 16), 
      Math.ceil(IBL.DiffuseEnvMapResulotion / 16),
      6
    );

    passEncoder.end();

    return commandEncoder.finish();

  }

}

export { IBL };