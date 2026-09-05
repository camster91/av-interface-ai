const pascal = (value) => String(value)
  .split(/[^a-zA-Z0-9]+/)
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join('');

const escapeAttr = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('"', '&quot;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function signalBase(control) {
  const target = pascal(control.targetId);
  switch (control.intent) {
    case 'display.power': return `Room.${target}.Display.Power`;
    case 'display.source': return `Room.${target}.Display.Source`;
    case 'audio.volume': return `Room.${target}.Audio.Volume`;
    case 'audio.mute': return `Room.${target}.Audio.Mute`;
    default: return `Room.${target}.${pascal(control.intent)}`;
  }
}

function requirement(name, direction, type, controlId, description) {
  return { name, direction, type, controlId, description };
}

export function planCrestronContractEditor(contractRequirements) {
  const counters = { digital: 0, analog: 0, serial: 0 };
  const joinKindByType = {
    boolean: 'digital',
    number: 'analog',
    string: 'serial'
  };

  return contractRequirements.map((item) => {
    const joinKind = joinKindByType[item.type];
    if (!joinKind) throw new Error(`Unsupported Contract Editor signal type: ${item.type}`);

    counters[joinKind] += 1;
    return {
      ...item,
      signalRole: item.direction === 'ui-to-control' ? 'event' : 'state',
      joinKind,
      suggestedJoin: counters[joinKind],
      allocationStatus: 'suggested-not-exported'
    };
  });
}

export function adaptSemanticUiToCrestronCh5(semanticUi) {
  const contractRequirements = [];
  const emulatorCues = [];
  const markup = [];

  for (const screen of semanticUi.screens ?? []) {
    markup.push(`<section class="av-screen" data-screen-id="${escapeAttr(screen.id)}">`);
    markup.push(`  <h1>${escapeAttr(screen.title)}</h1>`);

    for (const control of screen.controls ?? []) {
      const base = signalBase(control);

      if (control.kind === 'toggle') {
        const eventName = `${base}.Toggle`;
        const stateName = `${base}.IsActive`;
        contractRequirements.push(
          requirement(eventName, 'ui-to-control', 'boolean', control.id, `Toggle ${control.label}`),
          requirement(stateName, 'control-to-ui', 'boolean', control.id, `Selected state for ${control.label}`)
        );
        emulatorCues.push({
          type: 'boolean',
          event: eventName,
          trigger: true,
          actions: [{ state: stateName, type: 'boolean', logic: 'toggle' }]
        });
        markup.push(`  <ch5-button label="${escapeAttr(control.label)}" sendEventOnClick="${eventName}" receiveStateSelected="${stateName}"></ch5-button>`);
        continue;
      }

      if (control.kind === 'level') {
        const eventName = `${base}.Set`;
        const stateName = `${base}.Value`;
        contractRequirements.push(
          requirement(eventName, 'ui-to-control', 'number', control.id, `Set ${control.label}`),
          requirement(stateName, 'control-to-ui', 'number', control.id, `Current ${control.label}`)
        );
        emulatorCues.push({
          type: 'number',
          event: eventName,
          trigger: '&change',
          actions: [{ state: stateName, type: 'number', logic: 'link' }]
        });
        markup.push(`  <label>${escapeAttr(control.label)}</label>`);
        markup.push(`  <ch5-slider aria-label="${escapeAttr(control.label)}" min="${control.min}" max="${control.max}" step="${control.step}" sendEventOnChange="${eventName}" receiveStateValue="${stateName}"></ch5-slider>`);
        continue;
      }

      if (control.kind === 'choice') {
        const optionsWithSignals = (control.options ?? []).map((option) => {
          const optionName = pascal(option.id);
          return {
            ...option,
            eventName: `${base}.Select${optionName}`,
            stateName: `${base}.${optionName}Selected`
          };
        });

        markup.push(`  <div class="av-choice" role="group" aria-label="${escapeAttr(control.label)}">`);
        for (const option of optionsWithSignals) {
          contractRequirements.push(
            requirement(option.eventName, 'ui-to-control', 'boolean', control.id, `Select ${option.label}`),
            requirement(option.stateName, 'control-to-ui', 'boolean', control.id, `${option.label} selected state`)
          );
          emulatorCues.push({
            type: 'boolean',
            event: option.eventName,
            trigger: true,
            actions: optionsWithSignals.map((candidate) => ({
              state: candidate.stateName,
              type: 'boolean',
              logic: 'set',
              value: candidate.id === option.id
            }))
          });
          markup.push(`    <ch5-button label="${escapeAttr(option.label)}" sendEventOnClick="${option.eventName}" receiveStateSelected="${option.stateName}"></ch5-button>`);
        }
        markup.push('  </div>');
        continue;
      }

      throw new Error(`Unsupported semantic control kind: ${control.kind}`);
    }

    markup.push('</section>');
  }

  return {
    adapter: 'crestron-ch5',
    adapterVersion: 1,
    projectId: semanticUi.projectId,
    contractRequirements,
    contractEditorPlan: planCrestronContractEditor(contractRequirements),
    emulator: {
      cues: emulatorCues,
      onStart: []
    },
    html: markup.join('\n')
  };
}
