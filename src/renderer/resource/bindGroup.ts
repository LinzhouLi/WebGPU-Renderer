import { ResourceFormat } from './resuorce';
import { device } from '../renderer';


class BindGroupFactory {

  constructor() {

  }

  createLayout(attributes: string[]) {

    let entries: GPUBindGroupLayoutEntry[] = [];

    let bindIndex = 0;
    for (const attribute of attributes) {

      if (!ResourceFormat[attribute])
        throw new Error(`Resource Attribute Not Exist: ${attribute}`);

      switch(ResourceFormat[attribute].type) {
        case 'buffer': { // GPU buffer
          entries.push({
            binding: bindIndex,
            visibility: ResourceFormat[attribute].visibility,
            buffer: ResourceFormat[attribute].layout
          });
          break;
        }
        case 'sampler': { // GPU sampler
          entries.push({
            binding: bindIndex,
            visibility: ResourceFormat[attribute].visibility,
            sampler: ResourceFormat[attribute].layout
          });
          break;
        }
        case 'texture': // GPU texture
        case 'texture-array': // GPU texture array
        case 'cube-texture': { // GPU cube texture
          entries.push({
            binding: bindIndex,
            visibility: ResourceFormat[attribute].visibility,
            texture: ResourceFormat[attribute].layout
          });
          break;
        }
        default: {
          throw new Error('Resource Type Not Support');
        }
      }

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


      switch(ResourceFormat[attribute].type) {
        case 'buffer': { // GPU buffer
          entries.push({
            binding: bindIndex,
            resource: { buffer: data[attribute] as GPUBuffer }
          });
          break;
        }
        case 'sampler': { // GPU sampler
          entries.push({
            binding: bindIndex,
            resource: data[attribute] as GPUSampler
          });
          break;
        }
        case 'texture': // GPU texture
        case 'texture-array': // GPU texture array
        case 'cube-texture': { // GPU cube texture
          entries.push({
            binding: bindIndex,
            resource: (data[attribute] as GPUTexture).createView({ 
              dimension: ResourceFormat[attribute].layout.viewDimension || '2d'
            })
          });
          break;
        }
        default: {
          throw new Error('Resource Type Not Support');
        }
      }
      bindIndex++;

    }

    let group = device.createBindGroup({ layout, entries });
    
    return { layout, group };

  }

}

export { BindGroupFactory }