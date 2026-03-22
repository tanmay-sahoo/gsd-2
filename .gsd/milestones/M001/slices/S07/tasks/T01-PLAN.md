---
estimated_steps: 5
estimated_files: 3
skills_used: []
---

# T01: Implement workflow subcommands and catalog registration

**Slice:** S07 — CLI Surface + Dashboard Integration
**Milestone:** M001

## Description

Add six `/gsd workflow` subcommands (`new`, `run`, `list`, `validate`, `pause`, `resume`) with tab completion. The existing `handleWorkflowCommand` in `commands/handlers/workflow.ts` handles dev workflow commands (queue, discuss, quick, park, etc.) by matching `trimmed` against those keywords. Custom workflow commands use a `"workflow "` prefix — add routing at the top of the function. Register `workflow` in the command catalog with nested completions and definition-name completion for `run` and `validate`.

## Steps

1. **Add custom workflow routing to `commands/handlers/workflow.ts`:**
   - At the **top** of `handleWorkflowCommand`, add `if (trimmed === "workflow" || trimmed.startsWith("workflow "))` block.
   - Parse the subcommand: `const sub = trimmed.slice("workflow".length).trim()`.
   - Route to handler functions based on the subcommand prefix.
   - Import `createRun`, `listRuns` from `../../run-manager.ts`.
   - Import `setActiveEngineId`, `setActiveRunDir` from `../../auto.ts`.
   - Import `loadDefinition`, `validateDefinition` from `../../definition-loader.ts`.
   - Import `startAuto`, `pauseAuto`, `isAutoActive`, `getActiveEngineId` from `../../auto.ts`.
   - Implement each subcommand:
     - `new` → `ctx.ui.notify("Use the create-workflow skill: /skill create-workflow", "info")` and return true.
     - `run <name> [param=value ...]` → Parse name and optional param overrides. Call `createRun(projectRoot(), name, overrides)`. Set `setActiveEngineId("custom")`, `setActiveRunDir(runDir)`. Call `await startAuto(ctx, pi, projectRoot(), false)`. Notify success. Wrap in try/catch for missing definition.
     - `list [name]` → Call `listRuns(projectRoot(), name)`. Format results showing name, timestamp, status, step counts. If empty, notify "No workflow runs found."
     - `validate <name>` → Read YAML from `.gsd/workflow-defs/<name>.yaml`, parse with `yaml.parse()`, call `validateDefinition(parsed)`. Notify valid/errors.
     - `pause` → Check `getActiveEngineId()` is not "dev" and `isAutoActive()`. Call `pauseAuto(ctx, pi)`.
     - `resume` → Call `startAuto(ctx, pi, projectRoot(), false)`.
   - If `sub` is empty (bare `/gsd workflow`), show usage help listing all subcommands.

2. **Register in `commands/catalog.ts`:**
   - Add to `TOP_LEVEL_SUBCOMMANDS`: `{ cmd: "workflow", desc: "Custom workflow lifecycle (new, run, list, validate, pause, resume)" }`.
   - Add `NESTED_COMPLETIONS["workflow"]` with entries for all six subcommands.
   - In `getGsdArgumentCompletions`, add a `command === "workflow"` block for 3-part completions: when `subcommand` is `"run"` or `"validate"` and `parts.length <= 3`, scan `.gsd/workflow-defs/*.yaml` in the project root and return matching definition names. Use the project root from `process.cwd()` (matching the existing pattern in the function).

3. **Write tests in `src/resources/extensions/gsd/tests/commands-workflow-custom.test.ts`:**
   - Use the existing test pattern: `createMockCtx()` and `createMockPi()` helpers (or inline equivalents using `node:test`).
   - Test each subcommand handler produces correct ctx.ui.notify output.
   - Use real temp dirs with actual definition YAML files (like `run-manager.test.ts`).
   - Test `getGsdArgumentCompletions("workflow ")` returns six subcommands.
   - Test `getGsdArgumentCompletions("workflow run ")` returns definition names when `.gsd/workflow-defs/` exists.
   - Test bare `/gsd workflow` shows usage.

## Must-Haves

- [ ] Six subcommands route correctly from `/gsd workflow <sub>`
- [ ] `run` creates a run directory and activates custom engine
- [ ] `list` shows run metadata with step counts and status
- [ ] `validate` reports valid/invalid with error messages
- [ ] `pause` and `resume` control auto-mode for custom workflows
- [ ] `new` stubs with a skill invocation message
- [ ] `workflow` appears in `TOP_LEVEL_SUBCOMMANDS`
- [ ] Tab completion works for subcommands and definition names

## Verification

- `npx tsx --test src/resources/extensions/gsd/tests/commands-workflow-custom.test.ts` passes
- `rg "workflow" src/resources/extensions/gsd/commands/catalog.ts` shows catalog entry and nested completions

## Inputs

- `src/resources/extensions/gsd/commands/handlers/workflow.ts` — existing handler to extend with custom workflow routing
- `src/resources/extensions/gsd/commands/catalog.ts` — command catalog and completion map to add entries to
- `src/resources/extensions/gsd/run-manager.ts` — provides `createRun()` and `listRuns()` APIs
- `src/resources/extensions/gsd/auto.ts` — provides `setActiveEngineId()`, `setActiveRunDir()`, `startAuto()`, `pauseAuto()`, `isAutoActive()`, `getActiveEngineId()`
- `src/resources/extensions/gsd/definition-loader.ts` — provides `loadDefinition()`, `validateDefinition()`
- `src/resources/extensions/gsd/tests/run-manager.test.ts` — reference for test pattern (real temp dirs, actual YAML)
- `src/resources/extensions/gsd/tests/autocomplete-regressions-1675.test.ts` — reference for completion test pattern

## Expected Output

- `src/resources/extensions/gsd/commands/handlers/workflow.ts` — extended with custom workflow subcommand routing
- `src/resources/extensions/gsd/commands/catalog.ts` — updated with workflow entry in TOP_LEVEL_SUBCOMMANDS and NESTED_COMPLETIONS
- `src/resources/extensions/gsd/tests/commands-workflow-custom.test.ts` — new test file for command handlers and completions

## Observability Impact

- **New signals:** Each of the six subcommands produces a `ctx.ui.notify()` call with an appropriate level (info/warning/error), making command outcomes visible in the TUI. Error paths include the underlying exception message.
- **Inspection:** A future agent can verify routing by calling `handleWorkflowCommand("workflow <sub>", mockCtx, mockPi)` and reading `ctx.notifications`. Catalog completions can be verified with `getGsdArgumentCompletions("workflow ")`.
- **Failure visibility:** Missing definitions → error notification with path. Invalid YAML → error with parse message. No custom engine active → warning. Unknown subcommand → warning with full usage text. All failure states are observable through the notification array.
