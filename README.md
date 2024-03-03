# Learning WebGPU

Implement a rendering framework with WebGPU API.

try: https://linzhouli.github.io/WebGPU-Renderer/

To do:

- [x] build framework
- [x] Blinn-Phong Shading
- [x] PCF shadow
- [ ] PCSS shadow
- [ ] TAA
- [x] Normal Map
- [x] Skybox
- [x] Instanced Mesh
- [x] Physically Based Shading
- [x] ACES Tone Mapping
- [x] Image Based Lighting
- [ ] Deferred Shading Pipleline
- [ ] Cascaded Shadow Map
- [ ] SubSurface Scattering
- [ ] GPU LoD
- [x] Animation
- [ ] GPU Driven Rendering

## Rendering

Blinn-Phong + PCF shadow + skybox:

![man](img/man.png)

Normal map:

![normalMap](img/normalMap.png)

Raiden Shogun of Genshin Impact:

![ying](img/ying.png)

Instance:

![instance](img/instance.png)

kulla-conty precompute:

![kulla_conty_percompute](img/kulla_conty_percompute.png)

DFG Texture:

![DFG](img/DFG.png)

Image Based Lighting

![IBL](img/IBL.png)

Phsically Lighting:

![physicalLight](img/physicalLight.png)

Linear Depth (compute from Reverse Depth Buffer)

![linearDepth](img/linearDepth.png)

World Position (compute from Reverse Depth Buffer)

![worldPos](img/worldPos.png)