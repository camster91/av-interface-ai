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
7. Validation for duplicate controls/signals, unsupported signal metadata and unbound contract requirements.
8. Automated Node tests and a deterministic demo script.

Local verification on September 4, 2026:

- 4 tests passed.
- 0 tests failed.
- 1 semantic screen generated.
- 4 semantic controls generated.
- 10 Crestron contract signals generated.
- Validator returned 0 errors and 0 warnings.

## Crestron facts used by the proof

Current official Crestron HTML5 documentation confirms:

- CH5 2.19.1 was released September 1, 2026.
- CH5 components use `receiveState...` attributes for values from the control system and `sendEventOn...` attributes for UI events sent to the control system.
- Descriptive state/event names can be mapped to joins with Contract Editor; raw join numbers are also supported.
- Contract Editor exports a `.cse2j` file for CH5 projects.
- `ch5-cli archive` can include a Contract Editor `.cse2j` file with the `-c` option and produces a `.ch5z` archive.
- Crestron supports custom non-template HTML5 Web XPanel projects but recommends its provided template project for supported CH5 development.

Official references:

- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/Whats-New.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/UI-QS-States-Events.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/Template-Project/Tasks/Add-Contract.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/UI-CH5-Archives.htm
- https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/Content/Topics/Platforms/X-Custom.htm

## Deliberate boundary

The product does not currently generate `.cse2j` directly. That file is treated as Contract Editor output rather than an undocumented format to reverse-engineer.

The adapter instead generates the semantic contract requirements that a Contract Editor integration must satisfy. This keeps the core model portable and makes the Crestron-specific dependency explicit.

## Remaining Phase 0 proof

The next checkpoint is a genuine Crestron build artifact:

1. Obtain/use the current Crestron Template Project and required CLI tooling in a compatible workstation environment.
2. Create the minimum Contract Editor contract matching the generated requirements.
3. Export its `.cse2j` file.
4. Place the generated CH5 markup into the template integration surface.
5. Run the production build.
6. Run `ch5-cli archive` with the exported contract.
7. Confirm a `.ch5z` archive is produced and inspect its contents.
8. Run the UI with the Crestron control-system emulator or Web XPanel path and verify all four controls round-trip state/events.

No production deployment is required for Phase 0.

## Exit criteria

Phase 0 is complete only when all of the following are evidenced:

- structured room input is deterministic;
- semantic UI output is deterministic;
- CH5 bindings are deterministic;
- contract requirements are deterministic;
- automated validation passes;
- real Crestron production build succeeds;
- real `.ch5z` archive succeeds;
- the four reference controls can be exercised against an emulator or compatible Crestron runtime.
