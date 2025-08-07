"use node";

import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { Ollama } from "ollama";
import { v4 as uuidv4 } from "uuid";

/**
 * Generate a parser using AI for converting webhook payload to order schema
 */
export const generateParser = action({
  args: {
    payload: v.any(),
    platform: v.optional(v.string()),
    event: v.optional(v.string()),
    language: v.optional(v.string()), // Defaults to "javascript"
  },
  returns: v.object({
    parserId: v.string(),
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    parserId: string;
    success: boolean;
    error?: string;
  }> => {
    try {
      const language = args.language || "javascript";

      // Create Ollama client - use environment variable or fallback
      const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
      const ollama = new Ollama({ host: ollamaHost });

      // Generate parser name
      const parserName = `${args.platform || "unknown"}_${args.event || "webhook"}_parser_${Date.now()}`;

      // Prepare the system prompt with order schema information
      const systemPrompt = `You are an expert developer that creates parsers to convert webhook payloads to a specific database schema.

  TARGET SCHEMA - Convert webhook payload to this exact structure:

  CLIENT SCHEMA:
  {
    email?: string,
    phone?: string,
    firstName?: string,
    lastName?: string,
    platformId: string, // ID from the external platform
    platform: string, // platform name like "tiendanube", "shopify", etc.
    address?: {
      street?: string,
      city?: string,
      state?: string,
      country?: string,
      zipCode?: string,
    },
    storeId?: string,
  }

  ORDER SCHEMA:
  {
    clientId: string, // Will be set after client creation
    platformOrderId: string, // Order ID from external platform
    platform: string, // platform name
    orderNumber?: string,
    status: string, // "pending", "paid", "fulfilled", "cancelled", etc.
    total: number,
    currency: string,
    orderDate: number, // timestamp
    paidDate?: number, // timestamp if paid
    fulfilledDate?: number, // timestamp if fulfilled
    notes?: string,
    paymentMethod?: string,
    storeId?: string,
  }

  SHIPPING SCHEMA (if applicable):
  {
    orderId: string, // Will be set after order creation
    trackingNumber?: string,
    carrier?: string,
    status: string, // "pending", "shipped", "delivered", "returned"
    shippedDate?: number, // timestamp
    deliveredDate?: number, // timestamp
    address: {
      street?: string,
      city?: string,
      state?: string,
      country?: string,
      zipCode?: string,
    },
  }

  ORDER_LINES SCHEMA (if applicable):
  {
    orderId: string, // Will be set after order creation
    productId: string,
    sku?: string,
    name: string,
    quantity: number,
    price: number,
    total: number,
  }

  INSTRUCTIONS:
  1. Create a ${language} function that takes a webhook payload and returns an object with:
    - client: CLIENT_SCHEMA object
    - order: ORDER_SCHEMA object (without clientId)
    - shipping?: SHIPPING_SCHEMA object (without orderId) - only if shipping info exists
    - orderLines?: Array of ORDER_LINES_SCHEMA objects (without orderId) - only if line items exist

  2. Handle missing fields gracefully - use fallback values or undefined
  3. Convert dates to timestamps (milliseconds since epoch)
  4. Ensure required fields are always present with sensible defaults
  5. Make the function robust - handle different payload structures
  6. Return only the function code, no explanations
  7. Function should be named 'exec'
  8. Handle errors gracefully and return null for unparseable data

  Example structure:
  \`\`\`${language}
  function exec(payload) {
    try {
      // Extract and transform data here
      return {
        client: { /* CLIENT_SCHEMA */ },
        order: { /* ORDER_SCHEMA without clientId */ },
        shipping: { /* SHIPPING_SCHEMA without orderId */ }, // optional
        orderLines: [ /* ORDER_LINES_SCHEMA without orderId */ ] // optional
      };
    } catch (error) {
      console.error('Parser error:', error);
      return null;
    }
  }
\`\`\``;

      const userPrompt = `Generate a parser for this webhook payload:

Platform: ${args.platform || "unknown"}
Event: ${args.event || "webhook"}

Payload:
${JSON.stringify(args.payload, null, 2)}

Generate ONLY the function code in ${language}. No explanations, no markdown formatting, just the raw function code.`;

      // Generate parser code using Ollama
      const response = await ollama.chat({
        model: "gpt-oss:20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const generatedCode = response.message.content;

      if (!generatedCode) {
        throw new Error("No parser code generated by AI");
      }

      // Generate UUID for parser
      const parserUuid = uuidv4();

      // Store the parser
      const parserId: string = await ctx.runMutation(internal.procedures.storeParser, {
        uuid: parserUuid,
        name: parserName,
        language: language,
        code: generatedCode,
        payloadSchema: args.payload,
        platform: args.platform,
        event: args.event,
      });

      return {
        parserId: parserId,
        success: true,
      };

    } catch (error) {
      console.error("Error generating parser:", error);
      return {
        parserId: "",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Execute a parser on a given payload
 */
export const executeParser = internalAction({
  args: {
    parserUuid: v.string(),
    payload: v.any(),
  },
  returns: v.union(
    v.object({
      success: v.boolean(),
      result: v.any(),
      error: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args): Promise<{
    success: boolean;
    result: any;
    error?: string;
  } | null> => {
    try {
      // Get parser
      const parser: any = await ctx.runQuery(internal.procedures.getParserByUuidInternal, {
        uuid: args.parserUuid,
      });

      if (!parser || !parser.isActive) {
        return {
          success: false,
          result: null,
          error: "Parser not found or inactive",
        };
      }

      // Execute parser based on language
      let result;
      if (parser.language === "javascript") {
        result = await executeJavaScriptParser(parser.code, args.payload);
      } else {
        return {
          success: false,
          result: null,
          error: `Unsupported parser language: ${parser.language}`,
        };
      }

      // Update parser statistics
      await ctx.runMutation(internal.procedures.updateParserStats, {
        parserId: parser._id,
        success: result !== null,
      });

      return {
        success: result !== null,
        result: result,
        error: result === null ? "Parser execution failed" : undefined,
      };

    } catch (error) {
      console.error("Error executing parser:", error);
      return {
        success: false,
        result: null,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Execute JavaScript parser code safely
 */
async function executeJavaScriptParser(code: string, payload: any): Promise<any> {
  try {
    // Create a safe execution context
    const sandbox = {
      payload,
      console: {
        log: (...args: any[]) => console.log("[Parser]", ...args),
        error: (...args: any[]) => console.error("[Parser]", ...args),
      },
      Date,
      JSON,
      Math,
      parseFloat,
      parseInt,
      String,
      Number,
      Boolean,
      Array,
      Object,
    };

    // Wrap the parser code to make it executable
    const wrappedCode = `
      ${code}
      return exec(payload);
    `;

    // Create a function with limited scope
    const parseFunction = new Function(
      "payload",
      "console",
      "Date",
      "JSON",
      "Math",
      "parseFloat",
      "parseInt",
      "String",
      "Number",
      "Boolean",
      "Array",
      "Object",
      wrappedCode
    );

    // Execute with sandbox
    const result = parseFunction(
      sandbox.payload,
      sandbox.console,
      sandbox.Date,
      sandbox.JSON,
      sandbox.Math,
      sandbox.parseFloat,
      sandbox.parseInt,
      sandbox.String,
      sandbox.Number,
      sandbox.Boolean,
      sandbox.Array,
      sandbox.Object
    );

    return result;
  } catch (error) {
    console.error("JavaScript parser execution error:", error);
    return null;
  }
}
