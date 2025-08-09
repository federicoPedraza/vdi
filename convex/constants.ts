export interface BuildSystemPromptSchema {
  name: string;
  schema: string;
  description: string;
  // When true, the output field for this schema must be an array (empty arrays are valid)
  asArray?: boolean;
  // Preferred output key name for the returned object (e.g., "client", "orderLines")
  key?: string;
}

export const buildSystemPrompt = (schemas: BuildSystemPromptSchema[]) => {
  const toKey = (s: BuildSystemPromptSchema) => s.key || s.name;

  const targetSchema = schemas
    .map(
      (schema) => `
    ${schema.name} (${schema.asArray ? "array" : "object"}):
    ${schema.schema}
  `,
    )
    .join("\n");

  const targetSchemaDescription = schemas
    .map((schema) => `
    - ${toKey(schema)} (${schema.name}): ${schema.description}${schema.asArray ? " (MUST be an array)" : ""}
  `)
    .join("\n");

  const targetSchemaReturnExample = schemas
    .map((schema) => `
    ${toKey(schema)}: ${schema.asArray ? "[]" : "{}"}
  `)
    .join("\n");

  const arrayFields = schemas.filter((s) => s.asArray).map((s) => toKey(s));
  const singleFields = schemas.filter((s) => !s.asArray).map((s) => toKey(s));

  return `You are an expert developer that creates parsers to convert webhook payloads to a specific database schema.

  TARGET SCHEMA - Convert webhook payload to this exact structure:

  ${targetSchema}

  OUTPUT FIELDS AND CARDINALITY:
  - Output object MUST contain the following top-level fields with exact keys:
    ${schemas.map((s) => `- ${toKey(s)}`).join("\n    ")}
  - Fields that MUST be arrays: ${arrayFields.length > 0 ? arrayFields.join(", ") : "<none>"}
  - Fields that MUST be single objects: ${singleFields.length > 0 ? singleFields.join(", ") : "<none>"}

  STRICT RULES TO AVOID HALLUCINATIONS:
  - Do NOT fabricate or invent values. Only map data that is present in the payload and can be considered as a valid value for any of the target schema fields.
  - If a value is missing or cannot be determined, set it to undefined or omit the optional field.
  - Empty arrays are allowed; do NOT create placeholder or fake items.
  - Prefer direct field mapping. Apply simple transformations only when clearly derivable (e.g., date string to timestamp).

  INSTRUCTIONS:
  1. Create a JavaScript function named 'exec' that takes a webhook payload and returns an object with:
    ${targetSchemaDescription}
  2. Convert dates to timestamps (milliseconds since epoch) where applicable.
  3. Handle missing fields gracefully; never make up data.
  4. Be robust to minor variations in payload structure.
  5. Return only the function code, no explanations or markdown.
  6. If parsing fails entirely, return null.
  7. If a 'callbacks' object is provided as the second argument, invoke callbacks.success(result) on success and callbacks.fail(error) on failure.

  Example return structure (shape only):
  \`\`\`javascript
  function exec(payload, callbacks) {
    try {
      // Extract and transform data here
      const result = {
        ${targetSchemaReturnExample}
      };
      if (callbacks && typeof callbacks.success === 'function') callbacks.success(result);
      return result;
    } catch (error) {
      if (callbacks && typeof callbacks.fail === 'function') callbacks.fail(error);
      return null;
    }
  }
\`\`\``;
};

export const buildUserPrompt = (
  event: string,
  payload: any,
  language: string,
  schemas: BuildSystemPromptSchema[],
) => {
  const toKey = (s: BuildSystemPromptSchema) => s.key || s.name;
  const requiredFields = schemas.map((s) => `{ ${toKey(s)}: ${s.asArray ? "Array<any>" : "any"} }`).join(", ");
  const arrayFields = schemas.filter((s) => s.asArray).map((s) => toKey(s));
  return `You are generating code. Output ONLY raw ${language} code for a single function named exec with the signature: function exec(payload, callbacks) { /* ... */ }.

  Requirements:
  - The function must be named exactly: exec
  - It must accept arguments: (payload, callbacks?) where callbacks is optional and may include { success?: (result) => void; fail?: (error) => void }
  - It must return an object with at least the fields: ${requiredFields}
  - The following fields MUST be arrays (empty arrays allowed): ${arrayFields.length > 0 ? arrayFields.join(", ") : "<none>"}
  - Do NOT fabricate data. If a value is missing, set it to undefined or omit the optional field
  - Do not include any markdown, comments, imports, or surrounding text
  - Do not wrap in backticks
  - If callbacks is provided, call callbacks.success(result) on success; call callbacks.fail(error) upon failure

  Context:
  Event: ${event}
  Payload (representative structure):
  ${JSON.stringify(payload)}

  Return only the function code. Nothing else.`;
};
