
const ACESToneMapping = /* wgsl */`
// ACES Tone Mapping, see https://github.com/TheRealMJP/BakingLab/blob/master/BakingLab/ACES.hlsl
// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
const mat3 ACESInputMat = mat3x3<f32>(
  0.59719, 0.07600, 0.02840, // transposed from source
  0.35458, 0.90834, 0.13383,
  0.04823, 0.01566, 0.83777
);

// ODT_SAT => XYZ => D60_2_D65 => sRGB
const mat3 ACESOutputMat = mat3x3<f32>(
   1.60475, -0.10208, -0.00327, // transposed from source
  -0.53108,  1.10813, -0.07276,
  -0.07367, -0.00605,  1.07602
);

// source: https://github.com/selfshadow/ltc_code/blob/master/webgl/shaders/ltc/ltc_blit.fs
fn RRTAndODTFit(v: vec3<f32>) -> vec3<f32> {
  let a = v * (v + 0.0245786) - 0.000090537;
  let b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}

// this implementation of ACES is modified to accommodate a brighter viewing environment.
// the scale factor of 1/0.6 is subjective.
fn ACESToneMapping(vec3<f32> color) -> vec3<f32> {
  var color_: vec3<f32> = color * toneMappingExposure / 0.6; // exposure

  color_ = ACESInputMat * color_;
	color_ = RRTAndODTFit(color_); // Apply RRT and ODT
	color_ = ACESOutputMat * color_;

	return saturate(color_); // Clamp to [0, 1]
}
`;

const sRGB_OETF = /* wgsl */` // encoding
fn sRGBGammaEncode(color: vec3<f32>) -> vec3<f32> {
  return vec4<f32>(
    mix(
      color.rgb * 0.0773993808,                                       // y <= 0.04045
      pow(color.rgb * 0.9478672986 + 0.0521327014, vec3<f32>(2.4)),   // y >  0.04045
      saturate(sign(color.rgb - 0.04045))
    , gl_FragColor.w
  );
}
`;

const sRGB_EOTF = /* wgsl */` // decoding
fn sRGBGammaDecode(color: vec4<f32>) -> vec4<f32> {
  return vec4<f32>( 
    mix(
      color.rgb * 12.92,                                    // x <= 0.0031308
      pow(color.rgb, vec3<f32>(0.41666)) * 1.055 - 0.055,   // x >  0.0031308
      saturate(sign(color.rgb - 0.0031308))
    ),
    color.a 
  );
}
`;

const ColorManagement = { ACESToneMapping, sRGB_OETF, sRGB_EOTF }

export { ColorManagement };