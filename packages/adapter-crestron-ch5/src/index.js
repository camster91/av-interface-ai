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

export function adaptSemanticUiToCrestronCh5(semanticUi) {
  const contractRequirements = [];
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
        markup.push(`  <label>${escapeAttr(control.label)}</label>`);
        markup.push(`  <ch5-slider min="${control.min}" max="${control.max}" step="${control.step}" sendEventOnChange="${eventName}" receiveStateValue="${stateName}"></ch5-slider>`);
        continue;
      }

      if (control.kind === 'choice') {
        markup.push(`  <div class="av-choice" aria-label="${escapeAttr(control.label)}">`);
        for (const option of control.options ?? []) {
          const optionName = pascal(option.id);
          const eventName = `${base}.Select${optionName}`;
          const stateName = `${base}.${optionName}Selected`;
          contractRequirements.push(
            requirement(eventName, 'ui-to-control', 'boolean', control.id, `Select ${option.label}`),
            requirement(stateName, 'control-to-ui', 'boolean', control.id, `${option.label} selected state`)
          );
          markup.push(`    <ch5-button label="${escapeAttr(option.label)}" sendEventOnClick="${eventName}" receiveStateSelected="${stateName}"></ch5-button>`);
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
    html: markup.join('\n')
  };
}
