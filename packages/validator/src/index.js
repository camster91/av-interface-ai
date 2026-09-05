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

  const contractEditorPlan = adapterOutput?.contractEditorPlan ?? [];
  const validJoinKinds = new Set(['digital', 'analog', 'serial']);
  const validSignalRoles = new Set(['event', 'state']);
  const plannedNames = new Set(contractEditorPlan.map((item) => item.name));
  const joinKeys = contractEditorPlan.map((item) => `${item.joinKind}:${item.suggestedJoin}`);
  const duplicateJoinKeys = joinKeys.filter((key, index) => joinKeys.indexOf(key) !== index);

  if (contractEditorPlan.length !== requirements.length) {
    errors.push(`Contract Editor plan count (${contractEditorPlan.length}) does not match contract requirement count (${requirements.length}).`);
  }
  if (duplicateJoinKeys.length) {
    errors.push(`Duplicate suggested Contract Editor joins: ${[...new Set(duplicateJoinKeys)].join(', ')}`);
  }

  for (const requirement of requirements) {
    if (!plannedNames.has(requirement.name)) {
      errors.push(`Contract Editor plan is missing signal: ${requirement.name}`);
    }
  }

  for (const item of contractEditorPlan) {
    if (!signalNames.includes(item.name)) errors.push(`Contract Editor plan contains unknown signal: ${item.name}`);
    if (!validJoinKinds.has(item.joinKind)) errors.push(`Invalid Contract Editor join kind for ${item.name}: ${item.joinKind}`);
    if (!validSignalRoles.has(item.signalRole)) errors.push(`Invalid Contract Editor signal role for ${item.name}: ${item.signalRole}`);
    if (!Number.isInteger(item.suggestedJoin) || item.suggestedJoin < 1) {
      errors.push(`Invalid suggested Contract Editor join for ${item.name}: ${item.suggestedJoin}`);
    }
    if (item.allocationStatus !== 'suggested-not-exported') {
      errors.push(`Contract Editor allocation status must remain suggested-not-exported before real export: ${item.name}`);
    }
  }

  const emulatorCues = adapterOutput?.emulator?.cues ?? [];
  const emulatorEvents = new Set(emulatorCues.map((cue) => cue.event));
  const emulatorStates = new Set(
    emulatorCues.flatMap((cue) => (cue.actions ?? []).map((action) => action.state))
  );

  for (const item of requirements) {
    if (item.direction === 'ui-to-control' && !emulatorEvents.has(item.name)) {
      errors.push(`Crestron emulator does not cover outbound event: ${item.name}`);
    }
    if (item.direction === 'control-to-ui' && !emulatorStates.has(item.name)) {
      errors.push(`Crestron emulator does not produce inbound state: ${item.name}`);
    }
  }

  for (const cue of emulatorCues) {
    if (!validTypes.has(cue.type)) errors.push(`Invalid emulator event type for ${cue.event}: ${cue.type}`);
    if (!Array.isArray(cue.actions) || cue.actions.length === 0) errors.push(`Emulator cue has no actions: ${cue.event}`);
    for (const action of cue.actions ?? []) {
      if (!validTypes.has(action.type)) errors.push(`Invalid emulator action type for ${action.state}: ${action.type}`);
      if (!['link', 'set', 'toggle', 'pulse', 'increment', 'decrement'].includes(action.logic)) {
        errors.push(`Unsupported emulator action logic for ${action.state}: ${action.logic}`);
      }
    }
  }

  if (!requirements.length) errors.push('Crestron adapter generated no contract requirements.');
  if (!contractEditorPlan.length) errors.push('Crestron adapter generated no Contract Editor worksheet.');
  if (!emulatorCues.length) errors.push('Crestron adapter generated no emulator cues.');
  if (!adapterOutput?.html?.includes('<ch5-')) errors.push('Crestron adapter generated no CH5 components.');

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    summary: {
      screens: semanticUi?.screens?.length ?? 0,
      controls: controls.length,
      contractSignals: requirements.length,
      contractEditorRows: contractEditorPlan.length,
      emulatorCues: emulatorCues.length
    }
  };
}
