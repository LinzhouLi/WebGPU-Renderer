import { ResourceFormat } from './resuorce';
import { device } from './renderer';


class BindGroupFactory {

  constructor() {

  }

  createLayout(attributes: string[]) {

    let entries: GPUBindGroupLayoutEntry[] = [];

    let bindIndex = 0;
    for (const attribute of attributes) {

      if (!ResourceFormat[attribute])
        throw new Error(`Resource Attribute Not Exist: ${attribute}`);

      if (ResourceFormat[attribute].buffer) // GPU buffer
        entries.push({
          binding: bindIndex,
          visibility: ResourceFormat[attribute].visibility,
          buffer: ResourceFormat[attribute].buffer
        });
      else if (ResourceFormat[attribute].sampler) // GPU sampler
        entries.push({
          binding: bindIndex,
          visibility: ResourceFormat[attribute].visibility,
          sampler: ResourceFormat[attribute].sampler
        });
      else if (ResourceFormat[attribute].texture) // GPU texture
        entries.push({
          binding: bindIndex,
          visibility: ResourceFormat[attribute].visibility,
          texture: ResourceFormat[attribute].texture
        });
      bindIndex++;

    }
    
    return device.createBindGroupLayout({ entries });
    
  }

  create(
    attributes: string[], 
    data: { [x: string]: GPUBuffer | GPUTexture | GPUSampler },
    groupLayout: GPUBindGroupLayout | null = null
  ) {

    let layout: GPUBindGroupLayout;
    if (groupLayout) layout = groupLayout;
    else layout = this.createLayout(attributes);

    let entries: GPUBindGroupEntry[] = [];

    let bindIndex = 0;
    for (const attribute of attributes) {

      if (!ResourceFormat[attribute])
        throw new Error(`Resource Attribute Not Exist: ${attribute}`);
      if (!data[attribute])
        throw new Error(`Resource '${attribute}' Not Exist`);

      if (ResourceFormat[attribute].buffer) { // GPU buffer
        entries.push({
          binding: bindIndex,
          resource: { buffer: data[attribute] as GPUBuffer }
        });
      }
      else if (ResourceFormat[attribute].sampler) { // GPU sampler
        entries.push({
          binding: bindIndex,
          resource: data[attribute] as GPUSampler
        });
      }
      else if (ResourceFormat[attribute].texture) { // GPU texture
        entries.push({
          binding: bindIndex,
          resource: (data[attribute] as GPUTexture).createView()
        });
      }
      bindIndex++;

    }

    let group = device.createBindGroup({ layout, entries });

    return { layout, group };

  }

}

export { BindGroupFactory }