/**
 * Dependency ordering for workflow steps, shared by the client (Puter) and
 * server (AI SDK) runners so the two can never disagree about execution order.
 */
import type { WorkflowStepSpec } from "./types";

export class WorkflowGraphError extends Error {}

/**
 * Kahn's algorithm over `depends_on`. Returns step ids in an order where every
 * dependency precedes its dependents.
 *
 * Validates up front rather than letting a malformed graph surface later as a
 * generic "cycle" — a dangling `depends_on` and a real cycle both stall the
 * queue, but they need completely different fixes, so they get distinct errors.
 */
export function topoSort(steps: WorkflowStepSpec[]): string[] {
  if (!steps.length) return [];

  const seen = new Set<string>();
  for (const s of steps) {
    if (!s.id) throw new WorkflowGraphError("Une étape n'a pas d'identifiant");
    if (seen.has(s.id)) {
      throw new WorkflowGraphError(`Identifiant d'étape en doublon : "${s.id}"`);
    }
    seen.add(s.id);
  }

  for (const s of steps) {
    for (const dep of s.depends_on ?? []) {
      if (!seen.has(dep)) {
        throw new WorkflowGraphError(
          `L'étape "${s.id}" dépend de "${dep}", qui n'existe pas dans ce workflow`,
        );
      }
      if (dep === s.id) {
        throw new WorkflowGraphError(`L'étape "${s.id}" dépend d'elle-même`);
      }
    }
  }

  const pending = new Map<string, Set<string>>();
  for (const s of steps) pending.set(s.id, new Set(s.depends_on ?? []));

  // Dependents index, so releasing a step is O(its dependents) rather than a
  // full scan of every step on each pop.
  const dependents = new Map<string, string[]>();
  for (const s of steps) {
    for (const dep of s.depends_on ?? []) {
      const list = dependents.get(dep) ?? [];
      list.push(s.id);
      dependents.set(dep, list);
    }
  }

  const ready = steps.filter((s) => (pending.get(s.id)?.size ?? 0) === 0).map((s) => s.id);
  const order: string[] = [];

  while (ready.length) {
    const id = ready.shift()!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      const remaining = pending.get(dependent)!;
      remaining.delete(id);
      if (remaining.size === 0) ready.push(dependent);
    }
  }

  if (order.length !== steps.length) {
    const stuck = steps.map((s) => s.id).filter((id) => !order.includes(id));
    throw new WorkflowGraphError(
      `Cycle de dépendances entre les étapes : ${stuck.join(", ")}`,
    );
  }
  return order;
}
