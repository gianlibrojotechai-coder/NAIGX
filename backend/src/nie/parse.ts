/**
 * Structured-output parsing and validation for model-assisted stages.
 *
 * `AI §10.2`: when a provider cannot guarantee structured-output conformance,
 * the layer degrades to "schema-instructed generation plus stricter
 * validation". This module is that stricter validation — it runs regardless of
 * the provider's declared capability, so a stage never trusts a shape it has
 * not checked.
 *
 * A parse or shape failure is a `StageError`, not a provider failure. The
 * provider answered; the answer was unusable. Conflating the two would let a
 * reasoning defect consume the provider retry budget (`AI §10.4`).
 */

import { StageError } from "./contracts.js";

/** Extracts the JSON object from a response, tolerating a fenced code block. */
export function parseStructured(
  stageNumber: number,
  stageKey: string,
  text: string,
): Record<string, unknown> {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = (fenced?.[1] ?? text).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new StageError(
      stageNumber,
      stageKey,
      "Model output was not valid JSON",
      { cause: error },
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new StageError(
      stageNumber,
      stageKey,
      "Model output was not a JSON object",
    );
  }

  return parsed as Record<string, unknown>;
}

export interface FieldContext {
  readonly stageNumber: number;
  readonly stageKey: string;
}

export function requireString(
  ctx: FieldContext,
  record: Record<string, unknown>,
  field: string,
): string {
  const value = record[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new StageError(
      ctx.stageNumber,
      ctx.stageKey,
      `Field "${field}" must be a non-empty string`,
    );
  }
  return value;
}

export function optionalString(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = record[field];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export function requireNumber(
  ctx: FieldContext,
  record: Record<string, unknown>,
  field: string,
  range?: { readonly min: number; readonly max: number },
): number {
  const value = record[field];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new StageError(
      ctx.stageNumber,
      ctx.stageKey,
      `Field "${field}" must be a finite number`,
    );
  }
  if (range && (value < range.min || value > range.max)) {
    throw new StageError(
      ctx.stageNumber,
      ctx.stageKey,
      `Field "${field}" must be within [${String(range.min)}, ${String(range.max)}] (received ${String(value)})`,
    );
  }
  return value;
}

export function requireMember<T extends string>(
  ctx: FieldContext,
  record: Record<string, unknown>,
  field: string,
  allowed: readonly T[],
): T {
  const value = record[field];
  if (
    typeof value !== "string" ||
    !(allowed as readonly string[]).includes(value)
  ) {
    throw new StageError(
      ctx.stageNumber,
      ctx.stageKey,
      `Field "${field}" must be one of ${allowed.join(", ")} (received ${JSON.stringify(value)})`,
    );
  }
  return value as T;
}

export function requireArray(
  ctx: FieldContext,
  record: Record<string, unknown>,
  field: string,
): readonly unknown[] {
  const value = record[field];
  if (!Array.isArray(value)) {
    throw new StageError(
      ctx.stageNumber,
      ctx.stageKey,
      `Field "${field}" must be an array`,
    );
  }
  return value;
}

export function asRecord(
  ctx: FieldContext,
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new StageError(
      ctx.stageNumber,
      ctx.stageKey,
      `${label} must be an object`,
    );
  }
  return value as Record<string, unknown>;
}
