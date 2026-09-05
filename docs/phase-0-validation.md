# Phase 0 validation

## Goal

Prove that a structured AV room definition can become a deterministic semantic UI and then a Crestron CH5-specific binding/export plan without coupling the product core to Crestron.

## Verified in repository code

The current proof contains:

1. A structured meeting-room input.
2. A vendor-neutral semantic UI compiler.
3. A Crestron CH5 adapter.
4. Deterministic descriptive event/state naming.
5. CH5 markup using documented binding attributes.
6. A contract-requirements manifest for Contract Editor implementation.
7. A Crestron emulator scenario generated from the same semantic controls.
8. Validation for duplicate controls/signals, unsupported signal metadata, unbound contract requirements and emulator coverage.
9. A deterministic export bundle for Crestron integration.
10. Automated Node tests plus current Crestron shell-template build/archive CI.

The reference room deterministically generates:

- 1 semantic screen;
- 4 semantic controls: display power, source selection, program volume and mute;
- 10 Crestron contract signals;
- 5 Crestron emulator cues.

`npm run export:phase0` emits:

- `project.json`;
- `semantic-ui.json`;
- `contract-requirements.json`;
- `contract-requirements.csv`;
- `page1-emulator.json`;
- `page1.html`;
- `validation.json`.

## Verified with the current Crestron toolchain

GitHub Actions run `33936458442` on September 4, 2026 verified the generated AV Interface AI output against a clean Crestron environment rather than only testing repository-local code.

The CI proof used:

- Node `24.18.0`;
- npm `11.16.0`;
- `@crestron/ch5-shell-utilities-cli@2.19.1`;
- `@crestron/ch5-utilities-cli@2.19.0`;
- a fresh shell-template project created by `ch5-shell-cli create:project`;
- the template's `@crestron/ch5-crcomlib@2.19.1` dependency.

Verified results:

- 5 AV Interface AI tests passed.
- The deterministic export bundle was generated successfully.
- A fresh Crestron shell-template project was created successfully.
- The generated `page1.html` and `page1-emulator.json` replaced the fresh template's reference page files.
- Crestron's project-config validation passed.
- `npm run build:prod` succeeded.
- The generated power and volume signal names were found in the built production output.
- `npm run build:archive` succeeded.
- `dist/prod/phase0-shell.ch5z` was produced.
- The archive contained `phase0-shell.ch5` and `phase0-shell_manifest.json`.

This proves that AV Interface AI's generated Phase 0 CH5 markup and emulator scenario are accepted by the current supported Crestron shell-template build/archive path.

## Crestron facts used by the proof

Current official Crestron HTML5 documentation confirms:

- CH5 2.19.1 was released September 1, 2026.
- Current CH5 shell projects are created with `ch5-shell-cli create:project`.
- The current shell CLI requires Node 24.18.0 and npm 11.16.0.
- CH5 components use `receiveState...` attributes for values from the control system and `sendEventOn...` attributes for UI events sent to the control system.
- Descriptive state/event names can be mapped to joins with Contract Editor; raw join numbers are also supported.
- Contract Editor exports the `.cse2j` mapping consumed by CH5 archive workflows.
- Crestron's emulator scenario format uses `cues` plus optional `onStart` actions and supports named events/states for development without a completed control program.
- `ch5-cli archive` can include a Contract Editor `.cse2j` file with the `-c` option and produces a `.ch5z` archive.

Official references:

- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/Whats-New.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/Setup.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/System-Requirements.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/UI-QS-States-Events.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/Template-Project/Tasks/Add-Contract.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/UI-CH5-Archives.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/Template-Project/Emulator.htm

## Deliberate Contract Editor boundary

The product does not currently generate `.cse2j` directly. That file remains Contract Editor output rather than an undocumented format to reverse-engineer.

The adapter generates a deterministic Contract Editor handoff instead: JSON and CSV signal requirements containing the names, directions, types, owning controls and descriptions that the real contract must implement.

The successful CI archive currently uses the fresh Crestron template's supplied `config/contract.cse2j`. It proves build/archive compatibility, but it does **not** prove that AV Interface AI's 10 generated signal names have been mapped by Contract Editor. That distinction is required before Phase 0 can be called complete.

## Upstream toolchain observations

The fresh Crestron 2.19.1 shell-template dependency install reported 29 npm audit findings: 1 low, 10 moderate and 18 high. Installing the two current Crestron CLI packages in the repository job separately reported 3 high-severity findings. The generated template also emits dependency deprecation warnings and webpack performance/deprecation warnings, including a 5.08 MiB Material Symbols font asset.

These observations are recorded as current upstream/template evidence. They are not failures in the AV Interface AI core or adapter, and Phase 0 should not apply blind `npm audit fix --force` changes to Crestron's generated dependency graph. They should be re-evaluated when the product decides how much of the vendor template to vendor, wrap or isolate.

## Remaining Phase 0 proof

Only the vendor contract/runtime boundary remains:

1. Recreate the 10 generated signal requirements in Contract Editor.
2. Export the real Contract Editor `.cse2j`.
3. Replace the fresh template placeholder contract with that exported file.
4. Re-run the production build/archive and confirm the resulting `.ch5z` succeeds with the real contract.
5. Load the generated page with `page1-emulator.json` and exercise display power, both source choices, program volume and mute.
6. Verify each event produces the expected returned state, including exclusive source selection.
7. If a compatible Crestron control-system runtime is available, repeat the same four-control proof against that runtime after the emulator proof.

No production deployment is required for Phase 0.

## Exit criteria

Phase 0 is complete only when all of the following are evidenced:

- [x] structured room input is deterministic;
- [x] semantic UI output is deterministic;
- [x] CH5 bindings are deterministic;
- [x] contract requirements are deterministic;
- [x] emulator cues are deterministic and cover every generated contract event/state;
- [x] automated repository validation passes;
- [x] generated AV Interface AI markup survives the current Crestron production build;
- [x] generated AV Interface AI markup/emulator survive the current Crestron archive path using the template placeholder contract;
- [ ] a real Contract Editor `.cse2j` implements all 10 generated requirements;
- [ ] the archive succeeds with that real contract;
- [ ] all four reference controls round-trip correctly in the Crestron emulator;
- [ ] compatible-runtime verification is completed when a runtime is available.
