import { readFileSync } from 'node:fs';
import { compileRoomProject } from '../packages/core/src/index.js';
import { adaptSemanticUiToCrestronCh5 } from '../packages/adapter-crestron-ch5/src/index.js';
import { validatePhase0 } from '../packages/validator/src/index.js';

const project = JSON.parse(readFileSync(new URL('../examples/meeting-room/project.json', import.meta.url), 'utf8'));
const semanticUi = compileRoomProject(project);
const adapterOutput = adaptSemanticUiToCrestronCh5(semanticUi);
const validation = validatePhase0({ project, semanticUi, adapterOutput });

console.log(JSON.stringify({ project, semanticUi, adapterOutput, validation }, null, 2));

if (!validation.ok) process.exitCode = 1;
