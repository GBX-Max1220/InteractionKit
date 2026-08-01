import Ajv from 'ajv';
import { getPatternSpec } from './specs';
import type {
  ChoiceComposition,
  Composition,
  DerivedSchema,
  JsonSchema,
  PatternInstance,
  SequenceComposition,
  ValidationResult,
} from './types';

const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });

function emptyDerived(composition: Composition): DerivedSchema {
  return {
    type: 'object',
    properties: {},
    required: [],
    additionalProperties: false,
    'x-interactionkit-composition': {
      id: composition.id,
      kind: composition.kind,
      version: composition.version,
    },
  };
}

function valueTypes(schema: JsonSchema): Set<string> {
  if (schema.const !== undefined) return new Set([typeof schema.const]);
  if (schema.enum) return new Set(schema.enum.map((value) => typeof value));
  const values = Array.isArray(schema.type)
    ? schema.type
    : schema.type
      ? [schema.type]
      : [];
  return new Set(values.map((value) => (value === 'integer' ? 'number' : value)));
}

function schemasCompatible(produced: JsonSchema, required: JsonSchema): boolean {
  const producedTypes = valueTypes(produced);
  const requiredTypes = valueTypes(required);
  if (producedTypes.size === 0 || requiredTypes.size === 0) return true;
  return [...producedTypes].every((type) => requiredTypes.has(type));
}

function origin(instance: PatternInstance): string {
  return `${instance.pattern}@${instance.version}#${instance.id}`;
}

function withOrigin(schema: JsonSchema, instanceOrigin: string): JsonSchema {
  return {
    ...schema,
    'x-interactionkit-origin': [instanceOrigin],
  };
}

function withoutOrigin(schema: JsonSchema): JsonSchema {
  const copy = { ...schema };
  delete copy['x-interactionkit-origin'];
  return copy;
}

function mergeColumn(
  current: JsonSchema,
  incoming: JsonSchema,
  incomingOrigin: string,
): { schema?: JsonSchema; conflict?: string } {
  const currentOrigins = (current['x-interactionkit-origin'] as string[]) ?? [];
  const left = withoutOrigin(current);
  const right = withoutOrigin(incoming);

  if (JSON.stringify(left) === JSON.stringify(right)) {
    return {
      schema: {
        ...current,
        'x-interactionkit-origin': [...currentOrigins, incomingOrigin],
      },
    };
  }

  const leftValues =
    left.const !== undefined ? [left.const] : (left.enum ?? undefined);
  const rightValues =
    right.const !== undefined ? [right.const] : (right.enum ?? undefined);
  if (leftValues && rightValues) {
    return {
      schema: {
        enum: Array.from(new Set([...leftValues, ...rightValues])),
        description: left.description ?? right.description,
        'x-interactionkit-origin': [...currentOrigins, incomingOrigin],
      },
    };
  }

  if (schemasCompatible(left, right) && schemasCompatible(right, left)) {
    return {
      schema: {
        ...left,
        description: left.description ?? right.description,
        'x-interactionkit-origin': [...currentOrigins, incomingOrigin],
      },
    };
  }

  return {
    conflict: `incompatible definitions (${JSON.stringify(left)} vs ${JSON.stringify(right)})`,
  };
}

function validateInstance(
  instance: PatternInstance,
  index: number,
  errors: string[],
): void {
  const spec = getPatternSpec(instance.pattern);
  if (instance.version !== spec.version) {
    errors.push(
      `patterns[${index}] requests ${instance.pattern}@${instance.version}, but registry provides ${spec.version}.`,
    );
  }
  const validateParams = ajv.compile(spec.params);
  if (!validateParams(instance.params)) {
    const detail = ajv.errorsText(validateParams.errors, { separator: '; ' });
    errors.push(`patterns[${index}] has invalid params: ${detail}.`);
  }
}

function validateSequence(composition: SequenceComposition): ValidationResult {
  const errors: string[] = [];
  const derivedSchema = emptyDerived(composition);
  let commonRequired: Set<string> | undefined;
  const available = new Map<string, JsonSchema>(
    Object.entries(composition.initialInput.properties ?? {}),
  );

  composition.patterns.forEach((instance, index) => {
    validateInstance(instance, index, errors);
    const spec = getPatternSpec(instance.pattern);
    const previous = composition.patterns[index - 1];
    const next = composition.patterns[index + 1];

    if (previous && !spec.composition.allowedAfter.includes(previous.pattern)) {
      errors.push(
        `${instance.pattern} is not allowed after ${previous.pattern} at patterns[${index}].`,
      );
    }
    if (next && !spec.composition.allowedBefore.includes(next.pattern)) {
      errors.push(
        `${instance.pattern} is not allowed before ${next.pattern} at patterns[${index}].`,
      );
    }

    for (const field of spec.input.required ?? []) {
      const produced = available.get(field);
      const expected = spec.input.properties?.[field];
      if (!produced) {
        errors.push(
          `${instance.pattern} requires input "${field}", but no initial input or prior pattern produces it.`,
        );
      } else if (expected && !schemasCompatible(produced, expected)) {
        errors.push(
          `${instance.pattern} input "${field}" is incompatible with the available schema.`,
        );
      }
    }

    for (const [column, columnSchema] of Object.entries(
      spec.output.properties ?? {},
    )) {
      available.set(column, columnSchema);
      const current = derivedSchema.properties[column];
      if (!current) {
        derivedSchema.properties[column] = withOrigin(
          columnSchema,
          origin(instance),
        );
      } else {
        const merged = mergeColumn(current, columnSchema, origin(instance));
        if (merged.conflict) {
          errors.push(`Output column "${column}" has ${merged.conflict}.`);
        } else if (merged.schema) {
          derivedSchema.properties[column] = merged.schema;
        }
      }
    }

    const patternRequired = new Set(spec.output.required ?? []);
    commonRequired =
      commonRequired === undefined
        ? patternRequired
        : new Set(
            [...commonRequired].filter((field) => patternRequired.has(field)),
          );
  });

  derivedSchema.required = [...(commonRequired ?? [])];
  return { valid: errors.length === 0, errors, derivedSchema };
}

function validateChoice(composition: ChoiceComposition): ValidationResult {
  const errors: string[] = [];
  const derivedSchema = emptyDerived(composition);

  if (composition.branches.length < 2) {
    errors.push('Choice requires at least two branches.');
    return { valid: false, errors, derivedSchema };
  }

  const branchResults = composition.branches.map((branch) => {
    const result = validateSequence(branch.composition);
    errors.push(
      ...result.errors.map((error) => `Branch "${branch.id}": ${error}`),
    );
    return { id: branch.id, result };
  });

  const referenceColumns = Object.keys(
    branchResults[0].result.derivedSchema.properties,
  ).sort();

  for (const branch of branchResults.slice(1)) {
    const columns = Object.keys(branch.result.derivedSchema.properties).sort();
    if (JSON.stringify(columns) !== JSON.stringify(referenceColumns)) {
      errors.push(
        `Choice branch "${branch.id}" emits different output columns from branch "${branchResults[0].id}".`,
      );
    }
  }

  for (const column of referenceColumns) {
    const reference =
      branchResults[0].result.derivedSchema.properties[column];
    const origins: string[] = [];
    let compatible = true;
    for (const branch of branchResults) {
      const candidate = branch.result.derivedSchema.properties[column];
      if (!candidate || !schemasCompatible(reference, candidate)) {
        compatible = false;
        break;
      }
      origins.push(
        ...((candidate['x-interactionkit-origin'] as string[]) ?? []),
      );
    }
    if (!compatible) {
      errors.push(`Choice branches define incompatible column "${column}".`);
    } else {
      derivedSchema.properties[column] = {
        ...withoutOrigin(reference),
        'x-interactionkit-origin': Array.from(new Set(origins)),
      };
    }
  }

  derivedSchema.properties.choiceBranch = {
    type: 'string',
    enum: composition.branches.map((branch) => branch.id),
    description: 'Choice branch selected for this pattern row.',
    'x-interactionkit-origin': [`Choice#${composition.id}`],
  };
  derivedSchema.required = [
    ...branchResults[0].result.derivedSchema.required.filter((field) =>
      branchResults.every((branch) =>
        branch.result.derivedSchema.required.includes(field),
      ),
    ),
    'choiceBranch',
  ];

  return { valid: errors.length === 0, errors, derivedSchema };
}

export function validate(composition: Composition): ValidationResult {
  return composition.kind === 'sequence'
    ? validateSequence(composition)
    : validateChoice(composition);
}
