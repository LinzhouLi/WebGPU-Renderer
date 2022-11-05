// Pre compute for multi-bounce energy compensation specular BRDF use Kulla-Conty approximation
// see https://blog.selfshadow.com/publications/s2017-shading-course/imageworks/s2017_pbs_imageworks_slides_v2.pdf

import { device } from '../renderer';
import { Constants, Sampling, PBR, ToolFunction } from '../resource/shaderChunk';

const EmuComputeShader = /* wgsl */`
@group(0) @binding(0) var Emu: texture_storage_2d<r32float, write>;

${Constants}

${ToolFunction.Lerp}
${ToolFunction.SampleTexture}

${Sampling.RadicalInverse}
${Sampling.Hammersley}
${Sampling.GGXImportance}

${PBR.Geometry}

const SANPLE_COUNT: u32 = 256;

fn integrateBRDF(roughness: f32, NoV: f32) -> f32 {
  // compute energyloss when F0 = 1, that is (1 - cosine-weighted BRDF integration)

  var integrateEnergy: f32 = 0.0;
  let alpha = roughness * roughness;
  let N = vec3<f32>(0.0, 1.0, 0.0);
  let V = vec3<f32>(sqrt(1.0 - NoV * NoV), NoV, 0.0);

  for (var i: u32 = 0; i < SANPLE_COUNT; i = i + 1) {
    let sample2D = Hammersley(i, SANPLE_COUNT);
    let H = GGXImportanceSample(sample2D, alpha);
    let L = reflect(-V, H);

    if (L.y > 0) {
      let NoL = saturate(L.y);
      let NoH = saturate(H.y);
      let VoH = saturate(dot(V, H));

      // BRDF = D * F * G = D * G   (F0 = 1.0 => F = 1.0)
      // pdf = D * NoH / (4 * VoH)
      // result = BRDF / pdf
      //        = D * G * NoL / (D * NoH / (4 * VoH))
      //        = 4 * G * VoH * NoL / NoH

      let G = G2_Smith(alpha, NoL, NoV);
      integrateEnergy = integrateEnergy + (G * VoH * NoL) / NoH; // saturate!!!!
    }
  }

  integrateEnergy = integrateEnergy * 4.0 / f32(SANPLE_COUNT);

  return integrateEnergy;

}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {

  let resolution = u32(textureDimensions(Emu).x);
  if(global_index.x >= resolution || global_index.y >= resolution) { return; }

  let roughness = (f32(global_index.x) + 0.5) / f32(resolution);  // x: roughness
  let NoV = (f32(global_index.y) + 0.5) / f32(resolution);        // y: cosine
  
  let result = saturate(integrateBRDF(roughness, NoV));
  textureStore(Emu, vec2<i32>(global_index.xy), vec4<f32>(result, 0.0, 0.0, 1.0));

  // let sample2D = Hammersley(global_index.x * 16 + global_index.y, 256);
  // Emu[u32(64.0*sample2D.x) * 64 + u32(64.0*sample2D.y)] = 1;

}
`;

const EavgComputeShader = /* wgsl */`
@group(0) @binding(0) var Emu: texture_2d<f32>;
@group(0) @binding(1) var Eavg: texture_storage_1d<r32float, write>;

@compute @workgroup_size(16)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {

  let resolution = u32(textureDimensions(Emu).x);
  if(global_index.x >= resolution) { return; }

  var result: f32 = 0.0;
  for (var i: u32 = 0; i < resolution; i = i + 1) {
    let NoL = (f32(i) + 0.5) / f32(resolution);
    result = result + NoL * textureLoad(Emu, vec2<i32>(i32(global_index.x), i32(i)), 0).x;
  }
  result = 2 * result / f32(resolution);
  
  textureStore(Eavg, i32(global_index.x), vec4<f32>(result, 0.0, 0.0, 1.0));
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
  ) { // @ts-ignore

    this.EmuBindGroup = { };
    this.EmuBindGroup.layout = device.createBindGroupLayout({
      label: 'Emu precompute bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'r32float', viewDimension: '2d' }
      }]
    });
    this.EmuBindGroup.group = device.createBindGroup({
      label: 'Emu precompute bind group',
      layout: this.EmuBindGroup.layout,
      entries: [{ 
        binding: 0, 
        resource: (globalResource.Emu as GPUTexture).createView() 
      }]
    }); // @ts-ignore
    
    this.EavgBindGroup = { };
    this.EavgBindGroup.layout = device.createBindGroupLayout({
      label: 'Eavg precompute bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'unfilterable-float', viewDimension: '2d' }
      }, {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'r32float', viewDimension: '1d' }
      }]
    });
    this.EavgBindGroup.group = device.createBindGroup({
      label: 'Eavg precompute bind group',
      layout: this.EavgBindGroup.layout,
      entries: [{ 
        binding: 0, 
        resource: (globalResource.Emu as GPUTexture).createView() 
      }, {
        binding: 1, 
        resource: (globalResource.Eavg as GPUTexture).createView() 
      }]
    });

    this.EmuComputePipeline = await device.createComputePipelineAsync({
      label: "PreCompute pipeline for Multi Bounce BRDF (Emu)",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.EmuBindGroup.layout] }),
      compute: {
        module: device.createShaderModule({code: EmuComputeShader}),
        entryPoint: 'main'
      }
    });
    
    this.EavgComputePipeline = await device.createComputePipelineAsync({
      label: "PreCompute pipeline for Multi Bounce BRDF (Eavg)",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.EavgBindGroup.layout] }),
      compute: {
        module: device.createShaderModule({code: EavgComputeShader}),
        entryPoint: 'main'
      }
    });

  }

  public run() {

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

    return commandEncoder.finish();

  }

}

export { MultiBounceBRDF };