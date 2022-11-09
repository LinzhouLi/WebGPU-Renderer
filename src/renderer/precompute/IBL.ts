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

fn pixelIndex2Direction(index: vec3<u32>, width: u32) -> vec3<f32> {
  let halfWidth = f32(width) * 0.5;
  let uv = (vec2<f32>(index.xy) + 0.5 - halfWidth) / halfWidth;
  let dir = PixelIndex2DirTransforms[index.z] * vec3<f32>(uv, 1.0);
  return normalize(dir);
}
`;

const DiffuseEnvShader = /* wgsl */`
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

  var irradiance = vec3<f32>(0.0);
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

    irradiance = irradiance + bilinearSampleCubeTexture(envMap, L).xyz;
  }
  return vec4<f32>(irradiance / f32(SANPLE_COUNT), 1.0);

}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {

  let resolution = u32(textureDimensions(diffuseEnvMap).x);
  if(global_index.x >= resolution || global_index.y >= resolution || global_index.z >= 6) { return; }
  
  let coord3D = pixelIndex2Direction(global_index, resolution);
  textureStore(
    diffuseEnvMap, 
    vec2<i32>(global_index.xy),
    i32(global_index.z),
    integrateLight(coord3D)
  );

}
`;

const specularEnvShader = /* wgsl */`
@group(0) @binding(0) var specularEnvMap: texture_storage_2d_array<rgba8unorm, write>;
@group(0) @binding(1) var envMap: texture_2d_array<f32>;

${Constants}
${ToolFunction.Lerp}
${ToolFunction.SampleTexture}

${Sampling.RadicalInverse}
${Sampling.Hammersley}
${Sampling.GGXImportance}

${PixelIndex2Direction}

fn mipMapStore(
  texture: texture_storage_2d_array<rgba8unorm, write>,
  uv: vec2<u32>, face: u32, mip: u32, val: vec4<f32>
) {

  let size = vec2<i32>(textureDimensions(texture));
  var uv_ = vec2<i32>(uv);
  if (mip > 1) { uv_.y = uv_.y + size.x; }
  if (mip > 2) { 
    uv_.x = uv_.x + i32(f32(size.x) * (1.0 - pow(0.5, f32(mip - 2))));
  }

  textureStore( texture, uv_, i32(face), val );

}

const SANPLE_COUNT: u32 = 512;

fn integrateLight(N: vec3<f32>, roughness: f32) -> vec4<f32> {

  var irradiance = vec3<f32>(0.0);
  var weight = f32(0.0);
  var up = vec3<f32>(0.0, 1.0, 0.0);
  if (abs(N.y) < 0.999) { up = vec3<f32>(1.0, 0.0, 0.0); }
  let T = normalize(cross(up, N));
  let B = cross(N, T);
  let TNB = mat3x3<f32>(T, N, B);

  let V = N;
  for (var i: u32 = 0; i < SANPLE_COUNT; i = i + 1) {
    let sample2D = Hammersley(i, SANPLE_COUNT);
    let dir = GGXImportanceSample(sample2D, roughness * roughness); // in tangent space
    let H = TNB * dir;
    let L = reflect(-V, H);
    let NoL = saturate(dot(N, L));

    if (NoL > 0) {
      irradiance = irradiance + NoL * bilinearSampleCubeTexture(envMap, L).xyz;
      weight = weight + NoL;
    }
  }
  return vec4(irradiance / weight, 1.0);

}

@compute @workgroup_size(16, 16, 1)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {

  let mip = floor(f32(global_index.z) / 6.0) + 1.0;
  let mipCount = f32(textureNumLevels(envMap) - 1);
  let resolution = u32(textureDimensions(envMap, u32(mip)).x);
  if(
    global_index.x >= resolution || 
    global_index.y >= resolution || 
    global_index.z >= u32(mipCount) * 6
  ) { return; }

  let face = global_index.z % 6;
  let coord3D = pixelIndex2Direction(vec3<u32>(global_index.xy, face), resolution);
  let roughness = mip / mipCount;
  let val = integrateLight(coord3D, roughness);
  mipMapStore(specularEnvMap, global_index.xy, face, u32(mip), val);

}
`;

const LutShader = /* wgsl */`
@group(0) @binding(0) var Lut: texture_storage_2d<rg32float, write>;

${Constants}

${ToolFunction.Lerp}
${ToolFunction.SampleTexture}

${Sampling.RadicalInverse}
${Sampling.Hammersley}
${Sampling.GGXImportance}

${PBR.Geometry}
${PBR.Fresnel}

const SANPLE_COUNT: u32 = 512;

fn integrateBRDF(roughness: f32, NoV: f32) -> vec2<f32> {

  let alpha = roughness * roughness;
  var integrateEnergy = vec2<f32>(0.0);
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

      let G = G2_Smith_approx(alpha, NoL, NoV);
      let Gv = G * VoH * NoL / NoH;
      let Fc = computeFc_approx(VoH);

      integrateEnergy.x = integrateEnergy.x + Fc * Gv;
      integrateEnergy.y = integrateEnergy.y + Gv;
    }
  }

  return integrateEnergy * 4.0 / f32(SANPLE_COUNT);

}

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_index : vec3<u32>) {

  let resolution = u32(textureDimensions(Lut).x);
  if(global_index.x >= resolution || global_index.y >= resolution) { return; }

  let roughness = (f32(global_index.x) + 0.5) / f32(resolution);  // x: roughness
  let NoV = (f32(global_index.y) + 0.5) / f32(resolution);        // y: cosine

  let result = saturate(integrateBRDF(roughness, NoV));
  textureStore(Lut, vec2<i32>(global_index.xy), vec4<f32>(result, 0.0, 1.0));

}
`;

class IBL {

  public static DiffuseEnvMapResulotion = 256;
  public static LutResulotion = 64;
  public static EnvMapMipLevelCount = 5;

  private DiffuseEnvComputePipeline: GPUComputePipeline;
  private SpecularEnvComputePipeline: GPUComputePipeline;
  private LutComputePipeline: GPUComputePipeline;

  private DiffuseEnvBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };
  private SpecularEnvBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };
  private LutBindGroup: { layout: GPUBindGroupLayout, group: GPUBindGroup };

  private specularTempTexture: GPUTexture;
  private EnvMap: GPUTexture;

  constructor() { }

  private async initDiffuseEnvComputePipeline(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) {  // @ts-ignore

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
        entryPoint: 'main'
      }
    })

  }

  public async initSpecularEnvComputePipeline(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) { 
    
    this.specularTempTexture = device.createTexture({
      label: 'Specular Temp Texture for IBL precompute',
      size: [EnvMapResolution * 0.5, EnvMapResolution * 0.75, 6],
      dimension: '2d', format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC
    });// @ts-ignore

    this.SpecularEnvBindGroup = { };
    this.SpecularEnvBindGroup.layout = device.createBindGroupLayout({
      label: 'Specular EnvMap precompute bind group layout',
      entries: [{
        binding: 0, visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'rgba8unorm', viewDimension: '2d-array' }
      }, {
        binding: 1, visibility: GPUShaderStage.COMPUTE,
        texture: { sampleType: 'float', viewDimension: '2d-array' }
      }]
    });
    this.SpecularEnvBindGroup.group = device.createBindGroup({
      label: 'Specular EnvMap precompute bind group',
      layout: this.SpecularEnvBindGroup.layout,
      entries: [{ 
        binding: 0, 
        resource: this.specularTempTexture.createView({
          format: 'rgba8unorm', dimension: '2d-array', arrayLayerCount: 6
        }) 
      }, {
        binding: 1, 
        resource: (globalResource.envMap as GPUTexture).createView({
          format: 'rgba8unorm', dimension: '2d-array', 
          arrayLayerCount: 6, mipLevelCount: IBL.EnvMapMipLevelCount
        })
      }]
    });

    this.SpecularEnvComputePipeline = await device.createComputePipelineAsync({
      label: "PreCompute pipeline for IBL (Specular EnvMap)",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.SpecularEnvBindGroup.layout] }),
      compute: {
        module: device.createShaderModule({code: specularEnvShader}),
        entryPoint: 'main'
      }
    })

  }

  public async initLutComputePipeline(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) { // @ts-ignore

    this.LutBindGroup = { };
    this.LutBindGroup.layout = device.createBindGroupLayout({
      label: 'Lut precompute bind group layout',
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        storageTexture: { access: 'write-only', format: 'rg32float', viewDimension: '2d' }
      }]
    });
    this.LutBindGroup.group = device.createBindGroup({
      label: 'Lut precompute bind group',
      layout: this.LutBindGroup.layout,
      entries: [{ 
        binding: 0, 
        resource: (globalResource.Lut as GPUTexture).createView() 
      }]
    });

    this.LutComputePipeline = await device.createComputePipelineAsync({
      label: "PreCompute pipeline for IBL (Lut)",
      layout: device.createPipelineLayout({ bindGroupLayouts: [this.LutBindGroup.layout] }),
      compute: {
        module: device.createShaderModule({code: LutShader}),
        entryPoint: 'main'
      }
    });

  }

  public async initComputePipeline(
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ) { 

    this.EnvMap = globalResource.envMap as GPUTexture;
    await this.initLutComputePipeline(globalResource);
    await this.initDiffuseEnvComputePipeline(globalResource);
    await this.initSpecularEnvComputePipeline(globalResource);

  }

  public run() {

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();

    // LUT
    passEncoder.setPipeline(this.LutComputePipeline);
    passEncoder.setBindGroup(0, this.LutBindGroup.group);
    passEncoder.dispatchWorkgroups(
      Math.ceil(IBL.LutResulotion / 16), 
      Math.ceil(IBL.LutResulotion / 16)
    );

    // Diffuse Env
    passEncoder.setPipeline(this.DiffuseEnvComputePipeline);
    passEncoder.setBindGroup(0, this.DiffuseEnvBindGroup.group);
    passEncoder.dispatchWorkgroups(
      Math.ceil(IBL.DiffuseEnvMapResulotion / 16), 
      Math.ceil(IBL.DiffuseEnvMapResulotion / 16),
      6
    );

    // Specular Env
    passEncoder.setPipeline(this.SpecularEnvComputePipeline);
    passEncoder.setBindGroup(0, this.SpecularEnvBindGroup.group);
    passEncoder.dispatchWorkgroups(
      Math.ceil(EnvMapResolution / 2 / 16), 
      Math.ceil(EnvMapResolution / 2 / 16),
      6 * (IBL.EnvMapMipLevelCount - 1)
    );

    passEncoder.end();

    let mipWidth = EnvMapResolution / 2;
    for (let mip = 1; mip < IBL.EnvMapMipLevelCount; mip++) {
      let origin = [0, 0];
      if (mip > 1) {
        origin = [
          EnvMapResolution / 2 * (1 - Math.pow(0.5, mip - 2)),
          EnvMapResolution / 2
        ];
      }
      commandEncoder.copyTextureToTexture(
        { // source
          texture: this.specularTempTexture,
          origin: [ ...origin, 0 ]
        }, { // destination
          texture: this.EnvMap,
          origin: [ 0, 0, 0 ],
          mipLevel: mip
        },
        [ mipWidth, mipWidth, 6 ] // copySize
      );
      mipWidth /= 2;
    }

    return commandEncoder.finish();

  }

  public finish() {

    this.specularTempTexture.destroy();

  }

}

export { IBL };