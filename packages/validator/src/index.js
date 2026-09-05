export function validatePhase0({ project, semanticUi, adapterOutput }) {
  const errors = [];
  const warnings = [];

  if (!project?.id || !project?.name) errors.push('Project must include id and name.');
  if (!semanticUi?.screens?.length) errors.push('Semantic UI must contain at least one screen.');
  if (adapterOutput?.adapter !== 'crestron-ch5') errors.push('Expected Crestron CH5 adapter output.');

  const controls = (semanticUi?.screens ?? []).flatMap((screen) => screen.controls ?? []);
  const controlIds = controls.map((control) => control.id);
  const duplicateControlIds = controlIds.filter((id, index) => controlIds.indexOf(id) !== index);
  if (duplicateControlIds.length) errors.push(`Duplicate semantic control ids: ${[...new Set(duplicateControlIds)].join(', ')}`);

  const requirements = adapterOutput?.contractRequirements ?? [];
  const signalNames = requirements.map((item) => item.name);
  const duplicateSignals = signalNames.filter((name, index) => signalNames.indexOf(name) !== index);
  if (duplicateSignals.length) errors.push(`Duplicate contract signal names: ${[...new Set(duplicateSignals)].join(', ')}`);

  const validDirections = new Set(['ui-to-control', 'control-to-ui']);
  const validTypes = new Set(['boolean', 'number', 'string']);
  for (const item of requirements) {
    if (!validDirections.has(item.direction)) errors.push(`Invalid direction for ${item.name}: ${item.direction}`);
    if (!validTypes.has(item.type)) errors.push(`Invalid signal type for ${item.name}: ${item.type}`);
    if (!adapterOutput.html?.includes(item.name)) errors.push(`Generated CH5 markup does not reference contract signal: ${item.name}`);
  }

  for (const control of controls) {
    const related = requirements.filter((item) => item.controlId === control.id);
    if (!related.length) errors.push(`No Crestron contract requirements generated for control: ${control.id}`);
    if (!related.some((item) => item.direction === 'ui-to-control')) warnings.push(`Control has no outbound event: ${control.id}`);
    if (!related.some((item) => item.direction === 'control-to-ui')) warnings.push(`Control has no inbound state: ${control.id}`);
  }

  if (!requirements.length) errors.push('Crestron adapter generated no contract requirements.');
  if (!adapterOutput?.html?.includes('<ch5-')) errors.push('Crestron adapter generated no CH5 components.');

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      screens: semanticUi?.screens?.length ?? 0,
      controls: controls.length,
      contractSignals: requirements.length
    }
  };
}
