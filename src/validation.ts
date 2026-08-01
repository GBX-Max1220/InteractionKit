import Ajv, { type ValidateFunction } from 'ajv';
import { getPatternSpec } from './specs';
import type { PatternName } from './types';

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
const validators = new Map<PatternName, ValidateFunction>();

export function validatePatternOutput(
  pattern: PatternName,
  output: unknown,
): boolean {
  let validator = validators.get(pattern);
  if (!validator) {
    validator = ajv.compile(getPatternSpec(pattern).output);
    validators.set(pattern, validator);
  }
  return validator(output);
}
