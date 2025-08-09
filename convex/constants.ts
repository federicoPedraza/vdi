export interface BuildSystemPromptSchema {
  name: string;
  schema: string;
  description: string;
}

export const buildSystemPrompt = (schemas: BuildSystemPromptSchema[]) => {

  const targetSchema = schemas.map(schema => `
    ${schema.name}:
    ${schema.schema}
  `).join("\n");

  const targetSchemaDescription = schemas.map(schema => `
    - ${schema.name}: ${schema.description}
  `).join("\n");

  const targetSchemaReturnExample = schemas.map(schema => `
    ${schema.name}:
    "example"
  `).join("\n");

  return `You are an expert developer that creates parsers to convert webhook payloads to a specific database schema.

  TARGET SCHEMA - Convert webhook payload to this exact structure:

  ${targetSchema}

  INSTRUCTIONS:
  1. Create a javascript function that takes a webhook payload and returns an object with:
    ${targetSchemaDescription}

  2. Handle missing fields gracefully - use fallback values or undefined
  3. Convert dates to timestamps (milliseconds since epoch)
  4. Ensure required fields are always present with sensible defaults
  5. Make the function robust - handle different payload structures
  6. Return only the function code, no explanations
  7. Function should be named 'exec'
  8. Handle errors gracefully and return null for unparseable data

  Example return structure:
  \`\`\`javascript
  function exec(payload) {
    try {
      // Extract and transform data here
      return {
        ${targetSchemaReturnExample}
      }
    } catch (error) {
      console.error('Parser error:', error);
      return null;
    }
  }
\`\`\``
};

export const buildUserPrompt = (event: string, payload: any, language: string, schemas: BuildSystemPromptSchema[]) => {
  return `You are generating code. Output ONLY raw ${language} code for a single function named exec with the exact signature: function exec(payload) { /* ... */ }.

  Requirements:
  - The function must be named exactly: exec
  - It must accept one argument named payload
  - It must return an object with at least the fields: ${schemas.map(schema => `{ ${schema.name}: any }`).join(", ")}
  - Do not include any markdown, comments, imports, or surrounding text
  - Do not wrap in backticks

  Context:
  Event: ${event}
  Payload (representative structure):
  ${JSON.stringify(payload)}

  Return only the function code. Nothing else.`
}
