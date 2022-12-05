// Get vertex slot locations
// used in constructing struct 'VertInput' (vertex input variables)
function getSlotLocations(slotAttributes: string[]) {
  let slotLocations: Record<string, string> = { };
  slotAttributes.forEach( (slotAttribute, slotIndex) => 
    slotLocations[slotAttribute] = `@location(${slotIndex})`
  );
  return slotLocations;
}

// Get indices of bindings resources
function getBindingIndices(bindingAttributes: string[][]) {
  let bindingIndices: Record<string, string> = { };
  bindingAttributes.forEach(
    (group, groupIndex) => group.forEach(
      (binding, bindingIndex) => bindingIndices[binding] = `@group(${groupIndex}) @binding(${bindingIndex})`
    )
  );
  return bindingIndices;
}

export { getSlotLocations, getBindingIndices };