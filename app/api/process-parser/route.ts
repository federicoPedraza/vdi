import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Ollama } from "ollama";
import { buildSystemPrompt } from "@/convex/constants";
import { clientSchema, orderSchema, shippingSchema, orderLinesSchema } from "@/convex/schema";
import { v4 as uuidv4 } from 'uuid';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type ProcessLogger = {
  setStep: (step: number) => void;
  log: (message: string) => Promise<void> | void;
  error: (message: string) => Promise<void> | void;
};

async function generateParserCode(event: string, payload: any, logger: ProcessLogger): Promise<string> {
  const startTime = Date.now();
  logger.setStep(4);
  await logger.log(`🚀 [${new Date().toISOString()}] Starting parser code generation`);
  await logger.log(`Event: ${event}`);
  await logger.log(`Payload size: ${JSON.stringify(payload).length} characters`);
  const transformedPayload = simplifyPayload(payload);
  await logger.log(`Payload simplified size: ${JSON.stringify(transformedPayload).length} characters`);

  const ollama = new Ollama({
    host: "http://localhost:11434"
  });
  const language = "javascript";

  await logger.log(`⚙️  [${new Date().toISOString()}] Ollama client initialized`);
  await logger.log(`Host: http://localhost:11434`);

  const userPrompt = `You are generating code. Output ONLY raw ${language} code for a single function named exec with the exact signature: function exec(payload) { /* ... */ }.

  Requirements:
  - The function must be named exactly: exec
  - It must accept one argument named payload
  - It must return an object with at least the fields: { client: any, order: any }
  - Do not include any markdown, comments, imports, or surrounding text
  - Do not wrap in backticks

  Context:
  Event: ${event}
  Payload (representative structure):
  ${JSON.stringify(transformedPayload)}

  Return only the function code. Nothing else.`;

  const systemPrompt = buildSystemPrompt(JSON.stringify(clientSchema), JSON.stringify(orderSchema), JSON.stringify(shippingSchema), JSON.stringify(orderLinesSchema));

  const promptTime = Date.now();
  await logger.log(`📝 [${new Date().toISOString()}] Prompts prepared`);
  await logger.log(`System prompt length: ${systemPrompt.length} characters`);
  await logger.log(`User prompt length: ${userPrompt.length} characters`);
  await logger.log(`Preparation time: ${promptTime - startTime}ms`);

  // Generate parser code using Ollama with retry logic
  let response;
  let retryCount = 0;
  const maxRetries = 3;
  let generatedCode = "";

  await logger.log(`🔄 [${new Date().toISOString()}] Starting Ollama generation (max ${maxRetries} attempts)`);

  while (retryCount < maxRetries) {
    const attemptStartTime = Date.now();
    generatedCode = "";

    try {
      await logger.log(`🎯 [${new Date().toISOString()}] Attempt ${retryCount + 1}/${maxRetries} - Starting Ollama request`);
      await logger.log(`Model: codellama:13b-instruct`);
      await logger.log(`Temperature: 0.1`);
      await logger.log(`Keep alive: 10m`);

      response = await ollama.chat({
        model: "codellama:13b-instruct",
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        options: {
          temperature: 0.1, // Lower temperature for more consistent results
        },
        keep_alive: "10m" // Keep model loaded for 10 minutes
      });

      let firstChunk = true;

      for await (const chunk of response) {
        if (firstChunk && !chunk?.message?.content?.trim())
          break; // fallback early
        generatedCode += chunk.message.content;
      }

      const attemptTime = Date.now() - attemptStartTime;
      await logger.log(`✅ [${new Date().toISOString()}] Ollama request successful`);
      await logger.log(`Attempt duration: ${attemptTime}ms`);
      await logger.log(`Response length: ${generatedCode.length} characters`);
      break; // Success, exit retry loop
    } catch (error) {
      retryCount++;
      const attemptTime = Date.now() - attemptStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await logger.error(`❌ [${new Date().toISOString()}] Attempt ${retryCount} failed after ${attemptTime}ms`);
      await logger.error(`Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
      await logger.error(`Error message: ${errorMessage}`);

      if (retryCount >= maxRetries) {
        const totalTime = Date.now() - startTime;
        await logger.error(`🚫 [${new Date().toISOString()}] All attempts failed`);
        await logger.error(`Total time: ${totalTime}ms`);
        await logger.error(`Total attempts: ${maxRetries}`);
        throw new Error(`Failed to generate parser after ${maxRetries} attempts: ${errorMessage}`);
      }

      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, retryCount) * 1000;
      await logger.log(`⏳ [${new Date().toISOString()}] Retrying in ${waitTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  const totalTime = Date.now() - startTime;

  await logger.log(`🔍 [${new Date().toISOString()}] Validating generated code`);

  // Fallback 1: If streaming result was empty/whitespace, try non-streaming chat
  if (!generatedCode || generatedCode.trim().length === 0) {
    await logger.error(`❌ [${new Date().toISOString()}] Empty streamed response, attempting non-streaming chat fallback`);
    try {
      const nonStream = await ollama.chat({
        model: "gpt-oss:20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        options: { temperature: 0.1, num_predict: 2048 },
        keep_alive: "10m",
      });
      generatedCode = (nonStream?.message?.content || "").trim();
      await logger.log(`🧰 Non-stream chat fallback length: ${generatedCode.length}`);
    } catch (e) {
      await logger.error(`❌ Non-stream chat fallback failed: ${(e as Error).message}`);
    }
  }

  // Fallback 2: If still empty, attempt a plain generate with combined prompt
  if (!generatedCode || generatedCode.trim().length === 0) {
    try {
      await logger.log(`🧪 Trying plain generate fallback`);
      const combined = `${systemPrompt}\n\n${userPrompt}`;
      // @ts-ignore - generate is available on Ollama client in many versions
      const genResp = await (ollama as any).generate?.({ model: "gpt-oss:20b", prompt: combined, options: { temperature: 0.1, num_predict: 2048 } });
      const content = genResp?.response || genResp?.message?.content || "";
      generatedCode = (content as string).trim();
      await logger.log(`🧰 Plain generate fallback length: ${generatedCode.length}`);
    } catch (e) {
      await logger.error(`❌ Plain generate fallback failed: ${(e as Error).message}`);
    }
  }

  if (!generatedCode || generatedCode.trim().length === 0) {
    await logger.error(`❌ [${new Date().toISOString()}] No code generated`);
    await logger.error(`Total time: ${totalTime}ms`);
    throw new Error("No parser code generated by AI");
  }

  await logger.log(`🎉 [${new Date().toISOString()}] Parser code generation completed successfully`);
  await logger.log(`Generated code length: ${generatedCode.length} characters`);
  await logger.log(`Total generation time: ${totalTime}ms`);
  await logger.log(`Average time per attempt: ${Math.round(totalTime / (retryCount + 1))}ms`);

  return generatedCode;
}

// Configure API route timeout (10 minutes for parser generation)
export const maxDuration = 600; // 10 minutes in seconds

export async function POST(request: NextRequest) {
  const requestId = uuidv4();
  const requestStartTime = Date.now();
  let currentStep = 1;
  let processingId: string | null = null;
  let preProcessingLogBuffer = "";

  const bufferLog = (message: string) => {
    console.log(message);
    preProcessingLogBuffer += (preProcessingLogBuffer ? "\n" : "") + message;
  };

  const makeLiveLogger = () => ({
    setStep: (step: number) => { currentStep = step; },
    log: async (message: string) => {
      console.log(message);
      if (processingId) {
        await convex.mutation(api.procedures.appendProcessingLog, { processingId: processingId as any, step: currentStep, message });
      }
    },
    error: async (message: string) => {
      console.error(message);
      if (processingId) {
        await convex.mutation(api.procedures.appendProcessingLog, { processingId: processingId as any, step: currentStep, message });
      }
    }
  } as ProcessLogger);
  let logger: ProcessLogger | null = null;

  try {
    bufferLog(`📥 [${new Date().toISOString()}] Parsing request body...`);
    const { parserId } = await request.json();

    if (!parserId) {
      console.error(`❌ [${new Date().toISOString()}] Missing parser ID in request`);
      return NextResponse.json(
        { error: "Parser ID is required" },
        { status: 400 }
      );
    }

    bufferLog(`🪪 Request ID: ${requestId}`);
    bufferLog(`Step 1: Validated request and parserId`);
    bufferLog(`🔄 Processing individual parser: ${parserId}`);

    // Get the specific parser (allow idle or building)
    bufferLog(`Step 2: Fetching parser from database...`);
    const dbStart = Date.now();
    const parser = await convex.query(api.procedures.getParserByIdPublic, { parserId });
    const dbQueryTime = Date.now() - dbStart;

    if (!parser) {
      console.error(`❌ [${new Date().toISOString()}] Parser not found`);
      console.error(`Requested ID: ${parserId}`);
      return NextResponse.json(
        { error: "Parser not found or not in building state" },
        { status: 404 }
      );
    }

    // Create processing row now that we have a parser ID
    const createdProcessingId = await convex.mutation(api.procedures.startParserProcessing, {
      parserId: parser._id,
      requestId,
      initialStep: currentStep,
      initialLogs: preProcessingLogBuffer,
    });
    processingId = createdProcessingId as any;
    logger = makeLiveLogger();

    await logger.log(`✅ Parser found successfully (db: ${dbQueryTime}ms)`);
    await logger.log(`Parser UUID: ${parser.uuid}`);
    await logger.log(`Parser state: ${parser.state}`);
    await logger.log(`Event: ${parser.event || 'webhook'}`);

    try {
      const processingStartTime = Date.now();
      logger.setStep(3);
      await logger.log(`\n🔄 [${new Date().toISOString()}] STARTING PARSER PROCESSING`);
      await logger.log(`Parser: ${parser.uuid}`);

      // Mark parser as building and add placeholder code
      await logger.log(`💾 Marking parser as building...`);
      const statusUpdateStartTime = Date.now();
      await convex.mutation(api.procedures.startParserBuild, { parserId: parser._id });
      await convex.mutation(api.procedures.updateParserCode, {
        parserId: parser._id,
        code: "// Generating parser code with AI...",
      });
      const statusUpdateTime = Date.now() - statusUpdateStartTime;
      await logger.log(`✅ Status update completed in ${statusUpdateTime}ms`);

      // Generate parser code using Ollama
      await logger.log(`\n🤖 STARTING AI CODE GENERATION`);
      const codeGenStartTime = Date.now();
      // Parse original payload for generation/execution (fallback to raw string if invalid JSON)
      let originalPayload: any;
      try {
        originalPayload = JSON.parse(parser.payload);
      } catch (e) {
        await logger.log(`⚠️  Invalid JSON in stored payload, using raw string for generation/execution`);
        originalPayload = parser.payload;
      }
      const generatedCode = await generateParserCode(
        parser.event,
        originalPayload,
        logger!
      );
      const codeGenTime = Date.now() - codeGenStartTime;
      await logger.log(`🎉 AI code generation completed in ${codeGenTime}ms`);

      logger.setStep(5);
      await logger.log(`\n⚙️  STARTING PARSER EXECUTION`);

      // Execute the parser with the original payload
      await logger.log(`🔧 Creating parser function...`);
      const functionCreateStartTime = Date.now();
      const parseFunction = new Function(
        "payload",
        `${generatedCode}\nreturn exec(payload);`
      );
      const functionCreateTime = Date.now() - functionCreateStartTime;
      await logger.log(`✅ Parser function created in ${functionCreateTime}ms`);

      logger.setStep(6);
      await logger.log(`🚀 Executing parser function...`);
      const executionStartTime = Date.now();
      const result = parseFunction(originalPayload);
      const executionTime = Date.now() - executionStartTime;
      await logger.log(`✅ Parser execution completed in ${executionTime}ms`);

      logger.setStep(7);
      await logger.log(`🔍 Validating parser execution result...`);
      await logger.log(`Result type: ${typeof result}`);
      await logger.log(`Has client: ${!!(result && result.client)}`);
      await logger.log(`Has order: ${!!(result && result.order)}`);

      if (result && result.client && result.order) {
        await logger.log(`✅ Parser result validation passed`);

        // Update the parser with the generated code first
        logger.setStep(8);
        await logger.log(`💾 Saving generated code to database...`);
        const codeSaveStartTime = Date.now();
        await convex.mutation(api.procedures.updateParserCode, {
          parserId: parser._id,
          code: generatedCode,
        });
        const codeSaveTime = Date.now() - codeSaveStartTime;
        await logger.log(`✅ Code saved in ${codeSaveTime}ms`);

        // Process the parsed data directly since we already executed the parser
        logger.setStep(9);
        await logger.log(`\n🏗️  STARTING FINAL PROCESSING`);
        const finalProcessingStartTime = Date.now();

        await logger.log(`📊 Processing parsed data...`);
        await logger.log(`Client data: ${JSON.stringify(result.client).substring(0, 200)}...`);
        await logger.log(`Order data: ${JSON.stringify(result.order).substring(0, 200)}...`);
        await logger.log(`Has shipping: ${!!result.shipping}`);
        await logger.log(`Has order lines: ${!!result.orderLines}`);

        // Store the processed data directly (filter out null values)
        await convex.mutation(api.procedures.processWebhookDataPublic, {
          clientData: filterNullValues(result.client),
          orderData: filterNullValues(result.order),
          shippingData: result.shipping ? filterNullValues(result.shipping) : undefined,
          orderLinesData: result.orderLines ? result.orderLines.map(filterNullValues) : undefined,
        });

        // Update parser to success state
        await convex.mutation(api.procedures.updateParserSuccessPublic, {
          parserId: parser._id,
        });

        const finalProcessingTime = Date.now() - finalProcessingStartTime;
        await logger.log(`✅ Final processing completed in ${finalProcessingTime}ms`);

        const totalProcessingTime = Date.now() - processingStartTime;
        const totalRequestTime = Date.now() - requestStartTime;

        await logger.log(`\n🎉 PARSER PROCESSING COMPLETED SUCCESSFULLY`);
        await logger.log(`Parser: ${parser.uuid}`);
        await logger.log(`Processing time: ${totalProcessingTime}ms`);
        await logger.log(`Total request time: ${totalRequestTime}ms`);
        await logger.log(`Steps breakdown:`);
        await logger.log(`- DB query: ${dbQueryTime}ms`);
        await logger.log(`- Status update: ${statusUpdateTime}ms`);
        await logger.log(`- AI generation: ${codeGenTime}ms`);
        await logger.log(`- Function creation: ${functionCreateTime}ms`);
        await logger.log(`- Execution: ${executionTime}ms`);
        await logger.log(`- Code save: ${codeSaveTime}ms`);
        await logger.log(`- Final processing: ${finalProcessingTime}ms`);

        await convex.mutation(api.procedures.markProcessingSuccess, { processingId: processingId as any });

        return NextResponse.json({
          message: "Parser processed successfully",
          parserId: parser._id,
          parserUuid: parser.uuid,
          status: "success",
          timing: {
            totalTime: totalRequestTime,
            processingTime: totalProcessingTime,
            aiGenerationTime: codeGenTime,
            executionTime: executionTime
          }
        });
      } else {
        await logger.error(`❌ Parser result validation failed`);
        await logger.error(`Expected: result.client and result.order`);
        await logger.error(`Got: ${JSON.stringify(result, null, 2)}`);
        throw new Error("Parser execution failed - invalid result structure");
      }
    } catch (error) {
      const totalRequestTime = Date.now() - requestStartTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await logger?.error(`\n💥 PARSER PROCESSING FAILED`);
      await logger?.error(`Parser: ${parser.uuid}`);
      await logger?.error(`Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
      await logger?.error(`Error message: ${errorMessage}`);
      await logger?.error(`Total time before failure: ${totalRequestTime}ms`);
      await logger?.error(`Stack trace: ${(error instanceof Error ? error.stack : 'No stack trace') as string}`);

      // Update parser to failed state
      await logger?.log(`💾 Updating parser to failed state...`);
      try {
        const updateStartTime = Date.now();
        await convex.mutation(api.procedures.updateParserFailedPublic, {
          parserId: parser._id,
        });
        const updateTime = Date.now() - updateStartTime;
        await logger?.log(`✅ Parser state updated to failed in ${updateTime}ms`);
      } catch (updateError) {
        await logger?.error(`❌ Failed to update parser state: ${(updateError as Error)?.message}`);
      }

      if (processingId) {
        await convex.mutation(api.procedures.markProcessingFailed, { processingId: processingId as any, error: errorMessage });
      }

      await logger?.log(`\n📤 Returning error response`);
      return NextResponse.json({
        message: "Parser processing failed",
        parserId: parser._id,
        parserUuid: parser.uuid,
        status: "failed",
        error: errorMessage,
        timing: {
          totalTime: totalRequestTime,
          failedAt: new Date().toISOString()
        }
      });
    }

  } catch (error) {
    const totalRequestTime = Date.now() - requestStartTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    console.error(`\n💥💥 [${new Date().toISOString()}] CRITICAL REQUEST FAILURE`);
    console.error(`Request ID: ${requestId}`);
    console.error(`Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
    console.error(`Error message: ${errorMessage}`);
    console.error(`Total request time: ${totalRequestTime}ms`);
    console.error(`Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');

    return NextResponse.json(
      {
        error: "Failed to process parser",
        details: errorMessage,
        requestId: requestId,
        timing: {
          totalTime: totalRequestTime,
          failedAt: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}


function generateFingerprint(payload: any): string {
  return Object
    .keys(payload || {})
    .sort()
    .join('|');
}

function filterNullValues(obj: any): any {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(filterNullValues);

  const filtered: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) {
      filtered[key] = filterNullValues(value);
    }
  }
  return filtered;
}

function simplifyPayload(payload: any, {
  arraySampleSize = 1,
  maxStringLength = 100,
}: {
  arraySampleSize?: number;
  maxStringLength?: number;
} = {}): any {
  if (Array.isArray(payload)) {
    // Keep only the first `arraySampleSize` items
    const sampled = payload.slice(0, arraySampleSize).map(item =>
      simplifyPayload(item, { arraySampleSize, maxStringLength })
    );
    if (payload.length > arraySampleSize) {
      sampled.push(`… ${payload.length - arraySampleSize} more items …`);
    }
    return sampled;
  }
  if (payload !== null && typeof payload === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(payload)) {
      (result as any)[key] = simplifyPayload(val, {
        arraySampleSize,
        maxStringLength,
      });
    }
    return result;
  }
  if (typeof payload === 'string') {
    // Truncate long strings
    if (payload.length > maxStringLength) {
      return payload.slice(0, maxStringLength) + '…';
    }
    return payload;
  }
  // numbers, booleans, null
  return payload;
}
