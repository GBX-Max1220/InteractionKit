import Ajv from 'ajv';
import { validate } from './composition';
import { getPatternSpec } from './specs';
import type {
  Composition,
  PatternInstance,
  PatternOutput,
  SequenceComposition,
} from './types';

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });

function instancesFor(composition: Composition): PatternInstance[] {
  if (composition.kind === 'sequence') return composition.patterns;
  return composition.branches.flatMap((branch) => branch.composition.patterns);
}

function outputInstance(
  output: PatternOutput,
  composition: Composition,
  index: number,
): PatternInstance | undefined {
  if (composition.kind === 'sequence') return composition.patterns[index];
  return instancesFor(composition).find(
    (instance) => instance.pattern === output.patternName,
  );
}

export function serialize(
  trialData: PatternOutput[],
  composition: Composition,
): string {
  const validation = validate(composition);
  if (!validation.valid) {
    throw new Error(`Invalid composition: ${validation.errors.join(' ')}`);
  }

  if (
    composition.kind === 'sequence' &&
    trialData.length !== composition.patterns.length
  ) {
    throw new Error(
      `Expected ${composition.patterns.length} pattern outputs, received ${trialData.length}.`,
    );
  }

  const definitions = Array.from(
    new Set(instancesFor(composition).map((instance) => instance.pattern)),
  ).map((pattern) => getPatternSpec(pattern));

  const header = {
    recordType: 'interactionkit_header',
    formatVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    rowSemantics: 'One subsequent JSON object per pattern instance per trial.',
    composition,
    patternDefinitions: definitions,
    rowSchema: {
      ...validation.derivedSchema,
      properties: {
        recordType: {
          const: 'pattern_output',
          description: 'Distinguishes data rows from the header.',
        },
        patternInstanceId: {
          type: 'string',
          description: 'Composition-local identifier for the emitting instance.',
        },
        ...validation.derivedSchema.properties,
      },
      required: [
        'recordType',
        'patternInstanceId',
        ...validation.derivedSchema.required,
      ],
    },
  };

  const rows = trialData.map((output, index) => {
    const instance = outputInstance(output, composition, index);
    if (!instance || instance.pattern !== output.patternName) {
      throw new Error(
        `Output ${index} does not match a pattern instance in the composition.`,
      );
    }
    const validateOutput = ajv.compile(getPatternSpec(instance.pattern).output);
    if (!validateOutput(output)) {
      throw new Error(
        `Invalid ${instance.pattern} output: ${ajv.errorsText(validateOutput.errors)}.`,
      );
    }
    return {
      recordType: 'pattern_output',
      patternInstanceId: instance.id,
      ...output,
    };
  });

  return [header, ...rows].map((record) => JSON.stringify(record)).join('\n');
}

export function sequence(
  composition: SequenceComposition,
): SequenceComposition {
  return composition;
}
