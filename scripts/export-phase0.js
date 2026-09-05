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
const csv = (rows, columns) => [
  columns.map(csvCell).join(','),
  ...rows.map((item) => columns.map((column) => csvCell(item[column])).join(','))
].join('\n');

const contractRequirementColumns = ['name', 'direction', 'type', 'controlId', 'description'];
const contractPlanColumns = [
  'name',
  'signalRole',
  'direction',
  'type',
  'joinKind',
  'suggestedJoin',
  'controlId',
  'description',
  'allocationStatus'
];

const contractPlanMarkdown = [
  '# Phase 0 Contract Editor worksheet',
  '',
  'This worksheet is a deterministic implementation aid, **not** a Contract Editor export and not a `.cse2j` file.',
  '',
  'Suggested join numbers are intentionally simple and unique within each Crestron join kind. They may be changed in Contract Editor if the control-system program requires a different allocation.',
  '',
  '| Signal name | Role | Direction | Join kind | Suggested join | Control | Description |',
  '| --- | --- | --- | --- | ---: | --- | --- |',
  ...adapterOutput.contractEditorPlan.map((item) =>
    `| ${item.name} | ${item.signalRole} | ${item.direction} | ${item.joinKind} | ${item.suggestedJoin} | ${item.controlId} | ${item.description} |`
  ),
  '',
  '## Completion gate',
  '',
  'After implementing these rows in Contract Editor, export the real `.cse2j`, replace the Crestron template placeholder contract, and rerun the Phase 0 production build/archive before marking the contract complete.',
  ''
].join('\n');

writeFileSync(resolve(outputDirectory, 'project.json'), json(project));
writeFileSync(resolve(outputDirectory, 'semantic-ui.json'), json(semanticUi));
writeFileSync(resolve(outputDirectory, 'contract-requirements.json'), json(adapterOutput.contractRequirements));
writeFileSync(
  resolve(outputDirectory, 'contract-requirements.csv'),
  `${csv(adapterOutput.contractRequirements, contractRequirementColumns)}\n`
);
writeFileSync(resolve(outputDirectory, 'contract-editor-plan.json'), json(adapterOutput.contractEditorPlan));
writeFileSync(
  resolve(outputDirectory, 'contract-editor-plan.csv'),
  `${csv(adapterOutput.contractEditorPlan, contractPlanColumns)}\n`
);
writeFileSync(resolve(outputDirectory, 'contract-editor-plan.md'), contractPlanMarkdown);
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
    'contract-editor-plan.json',
    'contract-editor-plan.csv',
    'contract-editor-plan.md',
    'page1-emulator.json',
    'page1.html',
    'validation.json'
  ],
  summary: validation.summary
}, null, 2));
