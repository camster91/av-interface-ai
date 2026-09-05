const slug = (value) => String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function compileRoomProject(project) {
  if (!project || !project.id || !project.name) {
    throw new Error('Room project requires id and name');
  }

  const controls = [];

  for (const display of project.displays ?? []) {
    const baseId = slug(display.id);
    if (display.power) {
      controls.push({
        id: `${baseId}-power`,
        kind: 'toggle',
        label: `${display.name} Power`,
        intent: 'display.power',
        targetId: display.id
      });
    }

    if ((display.sources ?? []).length) {
      controls.push({
        id: `${baseId}-source`,
        kind: 'choice',
        label: `${display.name} Source`,
        intent: 'display.source',
        targetId: display.id,
        options: display.sources.map((source) => ({ id: source.id, label: source.name }))
      });
    }
  }

  for (const zone of project.audioZones ?? []) {
    const baseId = slug(zone.id);
    controls.push({
      id: `${baseId}-volume`,
      kind: 'level',
      label: `${zone.name} Volume`,
      intent: 'audio.volume',
      targetId: zone.id,
      min: zone.min ?? 0,
      max: zone.max ?? 100,
      step: zone.step ?? 1
    });
    controls.push({
      id: `${baseId}-mute`,
      kind: 'toggle',
      label: `${zone.name} Mute`,
      intent: 'audio.mute',
      targetId: zone.id
    });
  }

  return {
    schemaVersion: 1,
    projectId: project.id,
    title: project.name,
    screens: [
      {
        id: 'main',
        title: project.name,
        controls
      }
    ]
  };
}
