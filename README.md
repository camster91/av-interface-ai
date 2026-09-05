# AV Interface AI

AI-assisted visual design and export tooling for professional AV control interfaces. Crestron HTML5 (CH5) is the first platform adapter.

## Phase 0

Prove one narrow end-to-end path:

`structured room project -> semantic UI model -> Crestron CH5 adapter -> contract requirements -> generated CH5 markup -> validation`

The Phase 0 proof deliberately does **not** invent or reverse-engineer Crestron's Contract Editor output format. It generates a contract-requirements manifest that can be implemented in Contract Editor and then points the CH5 archive workflow at the resulting `.cse2j` file.

## Repository layout

- `apps/studio` — future visual/AI authoring shell
- `packages/core` — vendor-neutral room/project and semantic UI model
- `packages/adapter-crestron-ch5` — CH5 markup and contract requirement generation
- `packages/validator` — deterministic Phase 0 validation
- `examples` — reference room inputs and expected outputs
- `docs` — architecture, validation and platform notes

## Current target

A simple meeting room with display power, source selection, volume and mute controls. The same structured input must deterministically produce a semantic UI and Crestron-specific binding plan.

## Crestron references

Phase 0 follows the current Crestron HTML5 documentation:

- CH5 projects can use descriptive event/state names mapped through Contract Editor.
- Contract Editor produces the `.cse2j` file consumed by CH5 archive tooling.
- `ch5-cli archive` packages the built web project and can include a contract file with `-c`.
- `@crestron/ch5-webxpanel` supports custom non-template Web XPanel projects, although Crestron recommends its template project for supported CH5 development.

Official documentation: https://sdkcon78221.crestron.com/sdk/Crestron_HTML5UI/

## Status

Phase 0 implementation is in progress. No production deployment is part of this phase.
