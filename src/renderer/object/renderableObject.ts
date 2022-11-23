
abstract class RenderableObject {

  constructor() {  }

  public abstract initVertexBuffer(): void;
  public abstract initGroupResource(): Promise<void>;

  public abstract setRenderBundle(
    bundleEncoder: GPURenderBundleEncoder,
    targetStates: Iterable<GPUColorTargetState | null>,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ): Promise<void>;

  public abstract setShadowBundle(
    bundleEncoder: GPURenderBundleEncoder,
    globalResource: { [x: string]: GPUBuffer | GPUTexture | GPUSampler }
  ): Promise<void>;

  public abstract update(): void;

}

export { RenderableObject };