
const Constants = /* wgsl */`

const PI: f32 = 3.141592653589793;
const PI2: f32 = 6.283185307179586;
const PI_HALF: f32 = 1.5707963267948966;
const RECIPROCAL_PI: f32 = 0.3183098861837907;
const RECIPROCAL_PI2: f32 = 0.15915494309189535;
const EPSILON: f32 = 1e-6;

`;


const DataStructures = /* wgsl */`

struct Camera {
  position: vec3<f32>,
  viewMat: mat4x4<f32>,
  projectionMat: mat4x4<f32>
}

struct IncidentLight {
	color: vec3<f32>,
	direction: vec3<f32>,
	visible: bool
}

struct ReflectedLight {
	directDiffuse: vec3<f32>,
	directSpecular: vec3<f32>,
	indirectDiffuse: vec3<f32>,
	indirectSpecular: vec3<f32>
}

struct GeometricContext {
	position: vec3<f32>,
	normal: vec3<f32>,
	viewDir: vec3<f32>
}

`;

export { Constants, DataStructures };