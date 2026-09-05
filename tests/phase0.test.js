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

test('phase 0 validator confirms every generated signal is represented in markup', () => {
  const semanticUi = compileRoomProject(project);
  const adapterOutput = adaptSemanticUiToCrestronCh5(semanticUi);
  const result = validatePhase0({ project, semanticUi, adapterOutput });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.summary, { screens: 1, controls: 4, contractSignals: 10 });
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
