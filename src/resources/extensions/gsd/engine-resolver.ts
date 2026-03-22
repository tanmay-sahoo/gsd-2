/**
 * engine-resolver.ts — Route sessions to engine/policy pairs.
 *
 * S01 stub: throws for any input. S02 will register DevWorkflowEngine.
 */

import type { WorkflowEngine } from "./workflow-engine.js";
import type { ExecutionPolicy } from "./execution-policy.js";

/** A resolved engine + policy pair ready for the auto-loop. */
export interface ResolvedEngine {
  engine: WorkflowEngine;
  policy: ExecutionPolicy;
}

/**
 * Resolve an engine/policy pair for the given session.
 *
 * @throws Always — no engines are registered until S02.
 */
export function resolveEngine(
  _session: { activeEngineId: string | null },
): ResolvedEngine {
  throw new Error(
    "No engines registered — S02 provides DevWorkflowEngine",
  );
}
