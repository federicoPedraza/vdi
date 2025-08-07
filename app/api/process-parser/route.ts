import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { Ollama } from "ollama";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function generateParserCode(platform: string, event: string, payload: any): Promise<string> {
  const startTime = Date.now();
  console.log(`🚀 [${new Date().toISOString()}] Starting parser code generation`);
  console.log(`   Platform: ${platform}`);
  console.log(`   Event: ${event}`);
  console.log(`   Payload size: ${JSON.stringify(payload).length} characters`);

  const ollama = new Ollama({
    host: "http://localhost:11434"
  });
  const language = "javascript";

  console.log(`⚙️  [${new Date().toISOString()}] Ollama client initialized`);
  console.log(`   Host: http://localhost:11434`);

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
  platform: string, // platform name like "vii", "shopify", etc.
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
  trackingNumber?: string,
  carrier?: string,
  status: string, // "pending", "shipped", "delivered", "returned"
  shippedDate?: number, // timestamp
  deliveredDate?: number, // timestamp
  shippingAddress: {
    firstName?: string,
    lastName?: string,
    street?: string,
    city?: string,
    state?: string,
    country?: string,
    zipCode?: string,
    phone?: string,
  },
  platform: string,
}

ORDER_LINES SCHEMA (if applicable):
{
  productId?: string,
  sku?: string,
  productName: string,
  quantity: number,
  unitPrice: number,
  totalPrice: number,
  platform: string,
}

INSTRUCTIONS:
1. Create a ${language} function that takes a webhook payload and returns an object with:
   - client: CLIENT_SCHEMA object
   - order: ORDER_SCHEMA object
   - shipping?: SHIPPING_SCHEMA object - only if shipping info exists
   - orderLines?: Array of ORDER_LINES_SCHEMA objects - only if line items exist

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
      order: { /* ORDER_SCHEMA */ },
      shipping: { /* SHIPPING_SCHEMA */ }, // optional
      orderLines: [ /* ORDER_LINES_SCHEMA */ ] // optional
    };
  } catch (error) {
    console.error('Parser error:', error);
    return null;
  }
}
\`\`\``;

  const userPrompt = `Generate a parser for this webhook payload:

Platform: ${platform}
Event: ${event}

Payload:
${JSON.stringify(payload, null, 2)}

Generate ONLY the function code in ${language}. No explanations, no markdown formatting, just the raw function code.`;

  const promptTime = Date.now();
  console.log(`📝 [${new Date().toISOString()}] Prompts prepared`);
  console.log(`   System prompt length: ${systemPrompt.length} characters`);
  console.log(`   User prompt length: ${userPrompt.length} characters`);
  console.log(`   Preparation time: ${promptTime - startTime}ms`);

  // Generate parser code using Ollama with retry logic
  let response;
  let retryCount = 0;
  const maxRetries = 3;

  console.log(`🔄 [${new Date().toISOString()}] Starting Ollama generation (max ${maxRetries} attempts)`);

  while (retryCount < maxRetries) {
    const attemptStartTime = Date.now();
    try {
      console.log(`🎯 [${new Date().toISOString()}] Attempt ${retryCount + 1}/${maxRetries} - Starting Ollama request`);
      console.log(`   Model: gpt-oss:20b`);
      console.log(`   Temperature: 0.1`);
      console.log(`   Max tokens: 2048`);
      console.log(`   Keep alive: 10m`);

      response = await ollama.chat({
        model: "gpt-oss:20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        options: {
          temperature: 0.1, // Lower temperature for more consistent results
          num_predict: 2048, // Limit response length
        },
        keep_alive: "10m" // Keep model loaded for 10 minutes
      });

      const attemptTime = Date.now() - attemptStartTime;
      console.log(`✅ [${new Date().toISOString()}] Ollama request successful`);
      console.log(`   Attempt duration: ${attemptTime}ms`);
      console.log(`   Response length: ${response?.message?.content?.length || 0} characters`);
      break; // Success, exit retry loop
        } catch (error) {
      retryCount++;
      const attemptTime = Date.now() - attemptStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`❌ [${new Date().toISOString()}] Attempt ${retryCount} failed after ${attemptTime}ms`);
      console.error(`   Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
      console.error(`   Error message: ${errorMessage}`);

      if (retryCount >= maxRetries) {
        const totalTime = Date.now() - startTime;
        console.error(`🚫 [${new Date().toISOString()}] All attempts failed`);
        console.error(`   Total time: ${totalTime}ms`);
        console.error(`   Total attempts: ${maxRetries}`);
        throw new Error(`Failed to generate parser after ${maxRetries} attempts: ${errorMessage}`);
      }

      // Wait before retrying (exponential backoff)
      const waitTime = Math.pow(2, retryCount) * 1000;
      console.log(`⏳ [${new Date().toISOString()}] Retrying in ${waitTime/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  const generatedCode = response?.message?.content;
  const totalTime = Date.now() - startTime;

  console.log(`🔍 [${new Date().toISOString()}] Validating generated code`);

  if (!generatedCode) {
    console.error(`❌ [${new Date().toISOString()}] No code generated`);
    console.error(`   Total time: ${totalTime}ms`);
    throw new Error("No parser code generated by AI");
  }

  console.log(`🎉 [${new Date().toISOString()}] Parser code generation completed successfully`);
  console.log(`   Generated code length: ${generatedCode.length} characters`);
  console.log(`   Total generation time: ${totalTime}ms`);
  console.log(`   Average time per attempt: ${Math.round(totalTime / (retryCount + 1))}ms`);

  return generatedCode;
}

// Configure API route timeout (10 minutes for parser generation)
export const maxDuration = 600; // 10 minutes in seconds

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  console.log(`\n🌟 [${new Date().toISOString()}] =====================================`);
  console.log(`🌟 [${new Date().toISOString()}] NEW PARSER PROCESSING REQUEST`);
  console.log(`🌟 [${new Date().toISOString()}] Request ID: ${requestId}`);
  console.log(`🌟 [${new Date().toISOString()}] =====================================\n`);

  try {
    console.log(`📥 [${new Date().toISOString()}] Parsing request body...`);
    const { parserId } = await request.json();

    if (!parserId) {
      console.error(`❌ [${new Date().toISOString()}] Missing parser ID in request`);
      return NextResponse.json(
        { error: "Parser ID is required" },
        { status: 400 }
      );
    }

    console.log(`🔄 [${new Date().toISOString()}] Processing individual parser: ${parserId}`);

    // Get the specific parser
    console.log(`🔍 [${new Date().toISOString()}] Fetching parser from database...`);
    const buildingParsersStartTime = Date.now();
    const buildingParsers = await convex.query(api.procedures.getBuildingParsers);
    const dbQueryTime = Date.now() - buildingParsersStartTime;

    console.log(`📊 [${new Date().toISOString()}] Database query completed`);
    console.log(`   Query time: ${dbQueryTime}ms`);
    console.log(`   Total building parsers found: ${buildingParsers.length}`);

    const parser = buildingParsers.find((p: any) => p._id === parserId);

    if (!parser) {
      console.error(`❌ [${new Date().toISOString()}] Parser not found`);
      console.error(`   Requested ID: ${parserId}`);
      console.error(`   Available building parsers: ${buildingParsers.map((p: any) => p._id).join(', ')}`);
      return NextResponse.json(
        { error: "Parser not found or not in building state" },
        { status: 404 }
      );
    }

    console.log(`✅ [${new Date().toISOString()}] Parser found successfully`);
    console.log(`   Parser name: ${parser.name}`);
    console.log(`   Parser UUID: ${parser.uuid}`);
    console.log(`   Parser state: ${parser.state}`);
    console.log(`   Platform: ${parser.platform || 'unknown'}`);
    console.log(`   Event: ${parser.event || 'webhook'}`);
    console.log(`   Payload size: ${parser.originalPayload ? JSON.stringify(parser.originalPayload).length : 0} characters`);

    try {
      const processingStartTime = Date.now();
      console.log(`\n🔄 [${new Date().toISOString()}] STARTING PARSER PROCESSING`);
      console.log(`   Parser: ${parser.name} (${parser.uuid})`);

      // Update parser status to indicate code generation is starting
      console.log(`💾 [${new Date().toISOString()}] Updating parser status in database...`);
      const statusUpdateStartTime = Date.now();
      await convex.mutation(api.procedures.updateParserCode, {
        parserId: parser._id,
        code: "// Generating parser code with AI...",
      });
      const statusUpdateTime = Date.now() - statusUpdateStartTime;
      console.log(`✅ [${new Date().toISOString()}] Status update completed in ${statusUpdateTime}ms`);

      // Generate parser code using Ollama
      console.log(`\n🤖 [${new Date().toISOString()}] STARTING AI CODE GENERATION`);
      const codeGenStartTime = Date.now();
      const generatedCode = await generateParserCode(
        parser.platform || "unknown",
        parser.event || "webhook",
        parser.originalPayload
      );
      const codeGenTime = Date.now() - codeGenStartTime;
      console.log(`🎉 [${new Date().toISOString()}] AI code generation completed in ${codeGenTime}ms`);

      console.log(`\n⚙️  [${new Date().toISOString()}] STARTING PARSER EXECUTION`);

      // Execute the parser with the original payload
      console.log(`🔧 [${new Date().toISOString()}] Creating parser function...`);
      const functionCreateStartTime = Date.now();
      const parseFunction = new Function(
        "payload",
        `${generatedCode}\nreturn exec(payload);`
      );
      const functionCreateTime = Date.now() - functionCreateStartTime;
      console.log(`✅ [${new Date().toISOString()}] Parser function created in ${functionCreateTime}ms`);

      console.log(`🚀 [${new Date().toISOString()}] Executing parser function...`);
      const executionStartTime = Date.now();
      const result = parseFunction(parser.originalPayload);
      const executionTime = Date.now() - executionStartTime;
      console.log(`✅ [${new Date().toISOString()}] Parser execution completed in ${executionTime}ms`);

      console.log(`🔍 [${new Date().toISOString()}] Validating parser execution result...`);
      console.log(`   Result type: ${typeof result}`);
      console.log(`   Has client: ${!!(result && result.client)}`);
      console.log(`   Has order: ${!!(result && result.order)}`);

      if (result && result.client && result.order) {
        console.log(`✅ [${new Date().toISOString()}] Parser result validation passed`);

        // Update the parser with the generated code first
        console.log(`💾 [${new Date().toISOString()}] Saving generated code to database...`);
        const codeSaveStartTime = Date.now();
        await convex.mutation(api.procedures.updateParserCode, {
          parserId: parser._id,
          code: generatedCode,
        });
        const codeSaveTime = Date.now() - codeSaveStartTime;
        console.log(`✅ [${new Date().toISOString()}] Code saved in ${codeSaveTime}ms`);

        // Process the parsed data directly since we already executed the parser
        console.log(`\n🏗️  [${new Date().toISOString()}] STARTING FINAL PROCESSING`);
        const finalProcessingStartTime = Date.now();

        console.log(`📊 [${new Date().toISOString()}] Processing parsed data...`);
        console.log(`   Client data: ${JSON.stringify(result.client).substring(0, 200)}...`);
        console.log(`   Order data: ${JSON.stringify(result.order).substring(0, 200)}...`);
        console.log(`   Has shipping: ${!!result.shipping}`);
        console.log(`   Has order lines: ${!!result.orderLines}`);

        // Store the processed data directly
        const processResult = await convex.mutation(api.procedures.processWebhookDataPublic, {
          clientData: result.client,
          orderData: result.order,
          shippingData: result.shipping,
          orderLinesData: result.orderLines,
        });

        // Update parser to success state
        const parserDir = `/parsers/${parser.uuid}`;
        await convex.mutation(api.procedures.updateParserSuccessPublic, {
          parserId: parser._id,
          dir: parserDir,
        });

        const finalProcessingTime = Date.now() - finalProcessingStartTime;
        console.log(`✅ [${new Date().toISOString()}] Final processing completed in ${finalProcessingTime}ms`);

        const totalProcessingTime = Date.now() - processingStartTime;
        const totalRequestTime = Date.now() - requestStartTime;

        console.log(`\n🎉 [${new Date().toISOString()}] PARSER PROCESSING COMPLETED SUCCESSFULLY`);
        console.log(`   Parser: ${parser.name}`);
        console.log(`   UUID: ${parser.uuid}`);
        console.log(`   Processing time: ${totalProcessingTime}ms`);
        console.log(`   Total request time: ${totalRequestTime}ms`);
        console.log(`   Steps breakdown:`);
        console.log(`     - DB query: ${dbQueryTime}ms`);
        console.log(`     - Status update: ${statusUpdateTime}ms`);
        console.log(`     - AI generation: ${codeGenTime}ms`);
        console.log(`     - Function creation: ${functionCreateTime}ms`);
        console.log(`     - Execution: ${executionTime}ms`);
        console.log(`     - Code save: ${codeSaveTime}ms`);
        console.log(`     - Final processing: ${finalProcessingTime}ms`);

        return NextResponse.json({
          message: "Parser processed successfully",
          parserId: parser._id,
          parserName: parser.name,
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
        console.error(`❌ [${new Date().toISOString()}] Parser result validation failed`);
        console.error(`   Expected: result.client and result.order`);
        console.error(`   Got: ${JSON.stringify(result, null, 2)}`);
        throw new Error("Parser execution failed - invalid result structure");
      }
    } catch (error) {
      const totalRequestTime = Date.now() - requestStartTime;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      console.error(`\n💥 [${new Date().toISOString()}] PARSER PROCESSING FAILED`);
      console.error(`   Parser: ${parser.name} (${parser.uuid})`);
      console.error(`   Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
      console.error(`   Error message: ${errorMessage}`);
      console.error(`   Total time before failure: ${totalRequestTime}ms`);
      console.error(`   Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');

      // Update parser to failed state
      console.log(`💾 [${new Date().toISOString()}] Updating parser to failed state...`);
      try {
        const updateStartTime = Date.now();
        await convex.mutation(api.procedures.updateParserFailedPublic, {
          parserId: parser._id,
          error: errorMessage,
        });
        const updateTime = Date.now() - updateStartTime;
        console.log(`✅ [${new Date().toISOString()}] Parser state updated to failed in ${updateTime}ms`);
      } catch (updateError) {
        console.error(`❌ [${new Date().toISOString()}] Failed to update parser state:`, updateError);
      }

      console.log(`\n📤 [${new Date().toISOString()}] Returning error response`);
      return NextResponse.json({
        message: "Parser processing failed",
        parserId: parser._id,
        parserName: parser.name,
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
    console.error(`   Request ID: ${requestId}`);
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
    console.error(`   Error message: ${errorMessage}`);
    console.error(`   Total request time: ${totalRequestTime}ms`);
    console.error(`   Stack trace:`, error instanceof Error ? error.stack : 'No stack trace');

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
