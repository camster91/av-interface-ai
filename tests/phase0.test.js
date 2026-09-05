import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRoomProject } from '../packages/core/src/index.js';
import { adaptSemanticUiToCrestronCh5 } from '../packages/adapter-crestron-ch5/src/index.js';
import { validatePhase0 } from '../packages/validator/src/index.js';

const project = JSON.parse(readFileSync(new URL('../examples/meeting-room/project.json', import.meta.url), 'utf8'));

test('meeting room compiles into a stable semantic UI', () => {
  const semanticUi = compileRoomProject(project);
  assert.equal(semanticUi.projectId, 'meeting-room-101');
  assert.equal(semanticUi.screens.length, 1);
  assert.equal(semanticUi.screens[0].controls.length, 4);
  assert.deepEqual(
    semanticUi.screens[0].controls.map((control) => control.id),
    ['front-display-power', 'front-display-source', 'program-audio-volume', 'program-audio-mute']
  );
});

test('Crestron adapter produces CH5 bindings and contract requirements', () => {
  const semanticUi = compileRoomProject(project);
  const output = adaptSemanticUiToCrestronCh5(semanticUi);

  assert.equal(output.adapter, 'crestron-ch5');
  assert.equal(output.contractRequirements.length, 10);
  assert.match(output.html, /<ch5-button/);
  assert.match(output.html, /<ch5-slider/);
  assert.match(output.html, /sendEventOnClick="Room\.FrontDisplay\.Display\.Power\.Toggle"/);
  assert.match(output.html, /receiveStateValue="Room\.ProgramAudio\.Audio\.Volume\.Value"/);
});

test('Crestron adapter produces deterministic Contract Editor join suggestions', () => {
  const semanticUi = compileRoomProject(project);
  const output = adaptSemanticUiToCrestronCh5(semanticUi);

  assert.equal(output.contractEditorPlan.length, 10);
  assert.equal(output.contractEditorPlan.filter((item) => item.joinKind === 'digital').length, 8);
  assert.equal(output.contractEditorPlan.filter((item) => item.joinKind === 'analog').length, 2);

  const powerEvent = output.contractEditorPlan.find((item) => item.name === 'Room.FrontDisplay.Display.Power.Toggle');
  assert.deepEqual(
    {
      signalRole: powerEvent.signalRole,
      joinKind: powerEvent.joinKind,
      suggestedJoin: powerEvent.suggestedJoin,
      allocationStatus: powerEvent.allocationStatus
    },
    {
      signalRole: 'event',
      joinKind: 'digital',
      suggestedJoin: 1,
      allocationStatus: 'suggested-not-exported'
    }
  );

  const volumePlan = output.contractEditorPlan.filter((item) => item.joinKind === 'analog');
  assert.deepEqual(
    volumePlan.map(({ signalRole, suggestedJoin }) => ({ signalRole, suggestedJoin })),
    [
      { signalRole: 'event', suggestedJoin: 1 },
      { signalRole: 'state', suggestedJoin: 2 }
    ]
  );
});

test('Crestron adapter produces deterministic emulator cues', () => {
  const semanticUi = compileRoomProject(project);
  const output = adaptSemanticUiToCrestronCh5(semanticUi);

  assert.equal(output.emulator.cues.length, 5);

  const powerCue = output.emulator.cues.find((cue) => cue.event === 'Room.FrontDisplay.Display.Power.Toggle');
  assert.deepEqual(powerCue, {
    type: 'boolean',
    event: 'Room.FrontDisplay.Display.Power.Toggle',
    trigger: true,
    actions: [
      {
        state: 'Room.FrontDisplay.Display.Power.IsActive',
        type: 'boolean',
        logic: 'toggle'
      }
    ]
  });

  const volumeCue = output.emulator.cues.find((cue) => cue.event === 'Room.ProgramAudio.Audio.Volume.Set');
  assert.deepEqual(volumeCue, {
    type: 'number',
    event: 'Room.ProgramAudio.Audio.Volume.Set',
    trigger: '&change',
    actions: [
      {
        state: 'Room.ProgramAudio.Audio.Volume.Value',
        type: 'number',
        logic: 'link'
      }
    ]
  });

  const wirelessCue = output.emulator.cues.find((cue) => cue.event === 'Room.FrontDisplay.Display.Source.SelectWireless');
  assert.deepEqual(
    wirelessCue.actions.map(({ state, logic, value }) => ({ state, logic, value })),
    [
      { state: 'Room.FrontDisplay.Display.Source.TableHdmiSelected', logic: 'set', value: false },
      { state: 'Room.FrontDisplay.Display.Source.WirelessSelected', logic: 'set', value: true }
    ]
  );
});

test('phase 0 validator confirms markup contract and emulator coverage', () => {
  const semanticUi = compileRoomProject(project);
  const adapterOutput = adaptSemanticUiToCrestronCh5(semanticUi);
  const result = validatePhase0({ project, semanticUi, adapterOutput });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.summary, {
    screens: 1,
    controls: 4,
    contractSignals: 10,
    contractEditorRows: 10,
    emulatorCues: 5
  });
});

test('phase 0 validator rejects an unbound generated signal', () => {
  const semanticUi = compileRoomProject(project);
  const adapterOutput = adaptSemanticUiToCrestronCh5(semanticUi);
  adapterOutput.contractRequirements.push({
    name: 'Room.Orphan.Signal',
    direction: 'ui-to-control',
    type: 'boolean',
    controlId: 'front-display-power',
    description: 'Intentional test failure'
  });

  const result = validatePhase0({ project, semanticUi, adapterOutput });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Room.Orphan.Signal')));
});
