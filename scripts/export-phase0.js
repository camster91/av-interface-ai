import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileRoomProject } from '../packages/core/src/index.js';
import { adaptSemanticUiToCrestronCh5 } from '../packages/adapter-crestron-ch5/src/index.js';
import { validatePhase0 } from '../packages/validator/src/index.js';

const project = JSON.parse(
  readFileSync(new URL('../examples/meeting-room/project.json', import.meta.url), 'utf8')
);
const semanticUi = compileRoomProject(project);
const adapterOutput = adaptSemanticUiToCrestronCh5(semanticUi);
const validation = validatePhase0({ project, semanticUi, adapterOutput });

if (!validation.ok) {
  throw new Error(`Phase 0 export validation failed:\n${validation.errors.join('\n')}`);
}

const outputDirectory = resolve(process.argv[2] ?? 'generated/phase0');
mkdirSync(outputDirectory, { recursive: true });

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const csvCell = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [
  ['name', 'direction', 'type', 'controlId', 'description'].map(csvCell).join(','),
  ...adapterOutput.contractRequirements.map((item) =>
    [item.name, item.direction, item.type, item.controlId, item.description].map(csvCell).join(',')
  )
].join('\n');

writeFileSync(resolve(outputDirectory, 'project.json'), json(project));
writeFileSync(resolve(outputDirectory, 'semantic-ui.json'), json(semanticUi));
writeFileSync(resolve(outputDirectory, 'contract-requirements.json'), json(adapterOutput.contractRequirements));
writeFileSync(resolve(outputDirectory, 'contract-requirements.csv'), `${csv}\n`);
writeFileSync(resolve(outputDirectory, 'page1-emulator.json'), json(adapterOutput.emulator));
writeFileSync(resolve(outputDirectory, 'page1.html'), `${adapterOutput.html}\n`);
writeFileSync(resolve(outputDirectory, 'validation.json'), json(validation));

console.log(JSON.stringify({
  outputDirectory,
  files: [
    'project.json',
    'semantic-ui.json',
    'contract-requirements.json',
    'contract-requirements.csv',
    'page1-emulator.json',
    'page1.html',
    'validation.json'
  ],
  summary: validation.summary
}, null, 2));
