---
estimated_steps: 5
estimated_files: 4
skills_used: []
---

# T01: Create engine type contracts and interface files

**Slice:** S01 — Engine Abstraction Layer
**Milestone:** M001

## Description

Create the four foundational files for the engine abstraction layer. These are pure type definitions (interfaces and type aliases) with no runtime behavior except the resolver's stub function. Port from the `feat/declarative-workflow-engine-v2` branch with one modification: the resolver must not import implementation classes that don't exist yet on main.

The build order matters: `engine-types.ts` is the leaf node (no GSD imports), `workflow-engine.ts` and `execution-policy.ts` import only from `engine-types.ts`, and `engine-resolver.ts` imports from both interface files.

## Steps

1. Create `src/resources/extensions/gsd/engine-types.ts` with these exported types:
   - `EngineState` — fields: `phase: string`, `currentMilestoneId: string | null`, `activeSliceId: string | null`, `activeTaskId: string | null`, `isComplete: boolean`, `raw: unknown`
   - `StepContract` — fields: `unitType: string`, `unitId: string`, `prompt: string`
   - `DisplayMetadata` — fields: `engineLabel: string`, `currentPhase: string`, `progressSummary: string`, `stepCount: { completed: number; total: number } | null`
   - `EngineDispatchAction` — discriminated union: `{ action: "dispatch"; step: StepContract }` | `{ action: "stop"; reason: string; level: "info" | "warning" | "error" }` | `{ action: "skip" }`
   - `ReconcileResult` — fields: `outcome: "continue" | "milestone-complete" | "pause" | "stop"`, `reason?: string`
   - `RecoveryAction` — fields: `outcome: "retry" | "skip" | "stop" | "pause"`, `reason?: string`
   - `CloseoutResult` — fields: `committed: boolean`, `artifacts: string[]`
   - `CompletedStep` — fields: `unitType: string`, `unitId: string`, `startedAt: number`, `finishedAt: number`
   - **CRITICAL**: This file must have ZERO imports from any `../` or `./` GSD path. Only `node:` imports are allowed. This is the leaf-node constraint.

2. Create `src/resources/extensions/gsd/workflow-engine.ts` with the `WorkflowEngine` interface:
   - Import only from `./engine-types.js`
   - `readonly engineId: string`
   - `deriveState(basePath: string): Promise<EngineState>`
   - `resolveDispatch(state: EngineState, context: { basePath: string }): Promise<EngineDispatchAction>`
   - `reconcile(state: EngineState, completedStep: CompletedStep): Promise<ReconcileResult>`
   - `getDisplayMetadata(state: EngineState): DisplayMetadata`

3. Create `src/resources/extensions/gsd/execution-policy.ts` with the `ExecutionPolicy` interface:
   - Import only from `./engine-types.js`
   - `prepareWorkspace(basePath: string, milestoneId: string): Promise<void>`
   - `selectModel(unitType: string, unitId: string, context: { basePath: string }): Promise<{ tier: string; modelDowngraded: boolean } | null>`
   - `verify(unitType: string, unitId: string, context: { basePath: string }): Promise<"continue" | "retry" | "pause">`
   - `recover(unitType: string, unitId: string, context: { basePath: string }): Promise<RecoveryAction>`
   - `closeout(unitType: string, unitId: string, context: { basePath: string; startedAt: number }): Promise<CloseoutResult>`

4. Create `src/resources/extensions/gsd/engine-resolver.ts`:
   - Import `WorkflowEngine` from `./workflow-engine.js` and `ExecutionPolicy` from `./execution-policy.js` (type-only imports)
   - Export `ResolvedEngine` interface: `{ engine: WorkflowEngine; policy: ExecutionPolicy }`
   - Export `resolveEngine(session: { activeEngineId: string | null }): ResolvedEngine` function
   - The function body must **throw** `new Error("No engines registered — S02 provides DevWorkflowEngine")` for any input
   - Do NOT import `DevWorkflowEngine`, `DevExecutionPolicy`, `CustomWorkflowEngine`, or `CustomExecutionPolicy` — these don't exist yet

5. Verify all four files parse cleanly: `node --experimental-strip-types -e "import('./src/resources/extensions/gsd/engine-types.ts'); import('./src/resources/extensions/gsd/workflow-engine.ts'); import('./src/resources/extensions/gsd/execution-policy.ts'); import('./src/resources/extensions/gsd/engine-resolver.ts')"`

## Must-Haves

- [ ] `engine-types.ts` has zero imports from GSD modules (leaf-node constraint)
- [ ] `EngineState.raw` is typed `unknown` (not `GSDState` or any GSD-specific type)
- [ ] `EngineDispatchAction` is a discriminated union with `dispatch`, `stop`, `skip` variants
- [ ] `WorkflowEngine` interface has `engineId` + 4 methods
- [ ] `ExecutionPolicy` interface has 5 methods
- [ ] `engine-resolver.ts` throws for any input (no implementation imports)
- [ ] All files use `.js` extensions in import paths (ESM convention)

## Verification

- `grep -c "^import" src/resources/extensions/gsd/engine-types.ts` returns 0 (no imports)
- `grep -q "raw: unknown" src/resources/extensions/gsd/engine-types.ts` succeeds
- `grep -q "resolveEngine" src/resources/extensions/gsd/engine-resolver.ts` succeeds
- `grep -q "No engines registered" src/resources/extensions/gsd/engine-resolver.ts` succeeds
- `node --experimental-strip-types -e "import('./src/resources/extensions/gsd/engine-resolver.ts').then(m => { try { m.resolveEngine({ activeEngineId: null }); process.exit(1) } catch(e) { process.exit(0) } })"` exits 0 (resolver throws)

## Inputs

- `src/resources/extensions/gsd/auto/loop-deps.ts` — reference for existing `LoopDeps` interface shape (what the engine abstraction replaces)
- `src/resources/extensions/gsd/auto-dispatch.ts` — reference for existing `DispatchAction` type that `EngineDispatchAction` mirrors
- `src/resources/extensions/gsd/auto-verification.ts` — reference for existing verification flow that `ExecutionPolicy.verify()` mirrors

## Expected Output

- `src/resources/extensions/gsd/engine-types.ts` — new file with all engine-polymorphic types
- `src/resources/extensions/gsd/workflow-engine.ts` — new file with `WorkflowEngine` interface
- `src/resources/extensions/gsd/execution-policy.ts` — new file with `ExecutionPolicy` interface
- `src/resources/extensions/gsd/engine-resolver.ts` — new file with `ResolvedEngine` type and stub `resolveEngine()` function

## Observability Impact

- **New signal**: `resolveEngine()` throws a descriptive error (`"No engines registered — S02 provides DevWorkflowEngine"`) when called before implementations are registered. Any caller in the auto-loop that invokes this function will get a clear, actionable error message rather than a silent null or undefined.
- **Inspection**: Future agents can verify the engine abstraction layer exists by importing `engine-resolver.ts` and calling `resolveEngine()` — a throw confirms S01 is in place but S02 hasn't landed yet. A successful return confirms an engine is registered.
- **Failure visibility**: The leaf-node constraint on `engine-types.ts` (zero GSD imports) is enforced by contract tests in T02. If violated, the test names the exact constraint that broke.
- **No runtime state changes**: This task creates only type declarations and a stub function. No existing runtime behavior is affected.
