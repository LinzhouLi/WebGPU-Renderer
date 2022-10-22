// Pre compute for multi-bounce energy compensation specular BRDF use Kulla-Conty approximation
// see https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_slides_v2.pdf

import { device } from '../renderer';
import { bindGroupFactory } from '../base';
import { Constants, Sampling, PBR, ToolFunctions } from '../resource/shaderChunk';

const EmuComputeShader = /* wgsl */`
override resolution: u32 = 32;
@group(0) @binding(0) var<storage, read_write> Emu: array<f32>;

${Constants}
${ToolFunctions}

${Sampling.RadicalInverse}
${Sampling.Hammersley}
${Sampling.GGXImportance}

${PBR.Fresnel}
${PBR.Geometry}
${PBR.NDF}

const SANPLE_COUNT: u32 = 1024;

fn energyloss(roughness: f32, NoV: f32) -> f32 {
  // compute energyloss when F0 = 1, that is (1 - cosine-weighted BRDF integration)

  var integrateEnergy: f32 = 0.0;
  let alpha = roughness * roughness;
  let N = vec3<f32>(0.0, 0.0, 1.0);
  let V = vec3<f32>(sqrt(1.0 - NoV * NoV), 0.0, NoV);

  for (var i: u32 = 0; i < SANPLE_COUNT; i = i + 1) {
    let sample2D = Hammersley(i, SANPLE_COUNT);
    let H = GGXImportanceSample(sample2D, alpha);
    let L = reflect(-V, H);

    let NoL = L.z;
    let NoH = H.z;
    let VoH = dot(V, H);

    // BRDF = D * F * G = D * G   (F0 = 1.0 => F = 1.0)
    // pdf = D * NoH / (4 * VoH)
    // result = BRDF / pdf
    //        = D * G * NoL / (D * NoH / (4 * VoH))
    //        = 4 * G * VoH * NoL / NoH

    let G = G2_Smith(alpha, NoL, NoV);
    integrateEnergy = integrateEnergy + (G * saturate(VoH) * saturate(NoL)) / saturate(NoH); // saturate!!!!
  }

  integrateEnergy = integrateEnergy * 4.0 / f32(SANPLE_COUNT);

  return (1.0 - integrateEnergy);
  // return integrateEnergy;

}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {

  if(global_index.x >= resolution || global_index.y >= resolution) { return; }

  let roughness = (f32(global_index.x) + 0.5) / f32(resolution);  // x: roughness
  // let roughness = 0.07;
  let NoV = (f32(global_index.y) + 0.5) / f32(resolution);        // y: cosine
  // let NoV = 0.05;
  let result = energyloss(roughness, NoV);
  Emu[global_index.x * resolution + global_index.y] =  result;
  return;

  // let sample2D = Hammersley(global_index.x * 16 + global_index.y, 256);
  // Emu[u32(64.0*sample2D.x) * 64 + u32(64.0*sample2D.y)] = 1;

}
`;

const EavgComputeShader = /* wgsl */`
override resolution: u32 = 32;
@group(0) @binding(0) var<storage, read_write> Emu: array<f32>;
@group(0) @binding(1) var<storage, read_write> Eavg: array<f32>;

@compute @workgroup_size(16)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {

  if(global_index.x >= resolution) { return; }

  var result: f32 = 0.0;
  for (var i: u32 = 0; i < resolution; i = i + 1) {
    result = result + Emu[global_index.x * resolution + i];
  }

  Eavg[global_index.x] = result / f32(resolution);
  return;

}

`;

class MultiBounceBRDF {

  public static EmuResolution = 64;

  private EmuComputePipeline: GPUComputePipeline;
  private EavgComputePipeline: GPUComputePipeline;

  private EmuBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };
  private EavgBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };

  constructor() { }

  public async initComputePipeline(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    this.EmuBindGroup = bindGroupFactory.create(['EmuBuffer'], globalResource);
    this.EavgBindGroup = bindGroupFactory.create(['EmuBuffer', 'EavgBuffer'], globalResource);

    this.EmuComputePipeline = await device.createComputePipelineAsync({
      label: "PreCompute pipeline for Multi Bounce BRDF (Emu)",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.EmuBindGroup.layout] }),
      compute: {
        module: device.createShaderModule({code: EmuComputeShader}),
        entryPoint: 'main',
        constants: {
          resolution: MultiBounceBRDF.EmuResolution
        }
      }
    });

    this.EavgComputePipeline = await device.createComputePipelineAsync({
      label: "PreCompute pipeline for Multi Bounce BRDF (Eavg)",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.EavgBindGroup.layout] }),
      compute: {
        module: device.createShaderModule({code: EavgComputeShader}),
        entryPoint: 'main',
        constants: {
          resolution: MultiBounceBRDF.EmuResolution
        }
      }
    });

  }

  public run(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.EmuComputePipeline);
    passEncoder.setBindGroup(0, this.EmuBindGroup.group);
    passEncoder.dispatchWorkgroups(
      Math.ceil(MultiBounceBRDF.EmuResolution / 16), 
      Math.ceil(MultiBounceBRDF.EmuResolution / 16)
    );

    passEncoder.setPipeline(this.EavgComputePipeline);
    passEncoder.setBindGroup(0, this.EavgBindGroup.group);
    passEncoder.dispatchWorkgroups(
      Math.ceil(MultiBounceBRDF.EmuResolution / 16)
    );

    passEncoder.end();

    commandEncoder.copyBufferToTexture({ // source
      buffer: globalResource.EmuBuffer as GPUBuffer,
      bytesPerRow: MultiBounceBRDF.EmuResolution * 4
    }, { // destination
      texture: globalResource.Emu as GPUTexture,
    }, [ // copy size
      MultiBounceBRDF.EmuResolution, MultiBounceBRDF.EmuResolution
    ]);

    commandEncoder.copyBufferToTexture({ // source
      buffer: globalResource.EavgBuffer as GPUBuffer,
      bytesPerRow: MultiBounceBRDF.EmuResolution * 4
    }, { // destination
      texture: globalResource.Eavg as GPUTexture
    }, [ // copy size
      MultiBounceBRDF.EmuResolution
    ]);

    return commandEncoder.finish();

  }

}

export { MultiBounceBRDF };