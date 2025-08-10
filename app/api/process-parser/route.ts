import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Ollama } from "ollama";
import OpenAI from "openai";
import { createDecipheriv, createHash } from "crypto";
import { buildSystemPrompt, buildUserPrompt, BuildSystemPromptSchema } from "@/convex/constants";
import { v4 as uuidv4 } from 'uuid';

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type ProcessLogger = {
  setStep: (step: number) => void;
  log: (message: string) => Promise<void> | void;
  error: (message: string) => Promise<void> | void;
};

type ModelProvider = "ollama" | "openai";
// Reserved for future explicit options typing
// type GenerationOptions = {
//   provider?: ModelProvider;
//   openaiModel?: string;
//   ollamaModel?: string;
//   openaiApiKey?: string;
// };

// (helper removed; prompts built inline in POST handler)

async function generateWithOllama(args: {
  systemPrompt: string;
  userPrompt: string;
  logger: ProcessLogger;
  preferredModel?: string;
}): Promise<{ code: string; metaLogs?: string[] }> {
  const { systemPrompt, userPrompt, logger, preferredModel } = args;

  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
  const ollama = new Ollama({ host: ollamaHost });

  await logger.log(`⚙️  [${new Date().toISOString()}] Ollama client initialized`);
  await logger.log(`Host: ${ollamaHost}`);

  const desiredModelFromEnv = preferredModel || process.env.OLLAMA_MODEL;
  const preferredModels = [
    "qwen2.5-coder:7b",
    "qwen2.5-coder:14b",
    "codellama:13b-instruct",
    "codellama:7b-instruct",
    "llama3.1:8b-instruct",
    "llama3.1:8b-instruct-q4_1",
    "mistral:7b-instruct",
  ];

  async function listInstalledModels(): Promise<string[]> {
    try {
      const list = await ollama.list();
      return (list?.models || []).map((m: { model: string }) => m.model);
    } catch {
      return [];
    }
  }

  async function selectModel(): Promise<{ model: string; tried: string[]; installed: string[] }> {
    const installed = await listInstalledModels();
    const tried: string[] = [];
    if (desiredModelFromEnv) {
      tried.push(desiredModelFromEnv);
      if (installed.includes(desiredModelFromEnv)) return { model: desiredModelFromEnv, tried, installed };
    }
    for (const m of preferredModels) {
      tried.push(m);
      if (installed.includes(m)) return { model: m, tried, installed };
    }
    if (installed.length > 0) return { model: installed[0], tried, installed };
    return { model: desiredModelFromEnv || "codellama:13b-instruct", tried, installed };
  }

  const { model: selectedModel, tried: triedModels, installed: installedModels } = await selectModel();
  await logger.log(`🧠 Selected Ollama model: ${selectedModel}`);
  await logger.log(`🧩 Installed models: ${installedModels.join(", ") || "<none>"}`);

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
      await logger.log(`Model: ${selectedModel}`);
      await logger.log(`Temperature: 0.1`);
      await logger.log(`Keep alive: 10m`);

      response = await ollama.chat({
        model: selectedModel,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        options: { temperature: 0.1 },
        keep_alive: "10m"
      });

      for await (const chunk of response) {
        const content = chunk?.message?.content ?? "";
        if (content) generatedCode += content;
      }

      const attemptTime = Date.now() - attemptStartTime;
      await logger.log(`✅ [${new Date().toISOString()}] Ollama request successful`);
      await logger.log(`Attempt duration: ${attemptTime}ms`);
      await logger.log(`Response length: ${generatedCode.length} characters`);
      break;
    } catch (error) {
      retryCount++;
      const attemptTime = Date.now() - attemptStartTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      await logger.error(`❌ [${new Date().toISOString()}] Attempt ${retryCount} failed after ${attemptTime}ms`);
      await logger.error(`Error type: ${error instanceof Error ? error.constructor.name : 'Unknown'}`);
      await logger.error(`Error message: ${errorMessage}`);
      if (retryCount >= maxRetries) {
        throw new Error(`Failed to generate parser after ${maxRetries} attempts: ${errorMessage}`);
      }
      const waitTime = Math.pow(2, retryCount) * 1000;
      await logger.log(`⏳ [${new Date().toISOString()}] Retrying in ${waitTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  await logger.log(`🔍 [${new Date().toISOString()}] Validating generated code`);
  if (!generatedCode || generatedCode.trim().length === 0) {
    await logger.error(`❌ [${new Date().toISOString()}] Empty streamed response, attempting non-streaming chat fallback`);
    try {
      const nonStream = await ollama.chat({
        model: selectedModel,
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

  if (!generatedCode || generatedCode.trim().length === 0) {
    await logger.log(`🧪 Trying plain generate fallback(s)`);
    const combined = `${systemPrompt}\n\n${userPrompt}`;
    const modelsToTry = [selectedModel, ...preferredModels.filter((m) => m !== selectedModel)].filter((m, idx, arr) => arr.indexOf(m) === idx);
    for (const m of modelsToTry) {
      try {
        const genResp = await (ollama as unknown as { generate?: (args: { model: string; prompt: string; options?: Record<string, unknown> }) => Promise<{ response?: string; message?: { content?: string } }> }).generate?.({ model: m, prompt: combined, options: { temperature: 0.1, num_predict: 2048 } });
        const content = genResp?.response || genResp?.message?.content || "";
        const candidate = (content as string).trim();
        await logger.log(`🧰 Plain generate with ${m} length: ${candidate.length}`);
        if (candidate) {
          generatedCode = candidate;
          break;
        }
      } catch (e) {
        await logger.error(`❌ Plain generate with ${m} failed: ${(e as Error).message}`);
        continue;
      }
    }
  }

  if (!generatedCode || generatedCode.trim().length === 0) {
    await logger.error(`❌ [${new Date().toISOString()}] No code generated`);
    await logger.error(`Installed models: ${installedModels.join(", ") || "<none>"}`);
    await logger.error(`Tried models (in order): ${triedModels.join(", ") || selectedModel}`);
    throw new Error("No parser code generated by AI");
  }

  return { code: generatedCode };
}

async function generateWithOpenAI(args: {
  systemPrompt: string;
  userPrompt: string;
  logger: ProcessLogger;
  model?: string;
  apiKey: string;
}): Promise<{ code: string; metaLogs?: string[] }> {
  const { systemPrompt, userPrompt, logger, model, apiKey } = args;
  if (!apiKey) {
    throw new Error("OpenAI API key is not set");
  }
  const openai = new OpenAI({ apiKey });
  const chosenModel = model || "gpt-4o-mini";

  await logger.log(`🧠 Selected OpenAI model: ${chosenModel}`);
  let generatedCode = "";
  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await logger.log(`🎯 OpenAI attempt ${attempt}/${maxRetries}`);
      const resp = await openai.chat.completions.create({
        model: chosenModel,
        temperature: 0.1,
        messages,
      });
      generatedCode = (resp.choices?.[0]?.message?.content || "").trim();
      if (generatedCode) break;
    } catch (e) {
      await logger.error(`❌ OpenAI attempt ${attempt} failed: ${(e as Error).message}`);
      if (attempt === maxRetries) throw e;
      const waitMs = 500 * attempt;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  if (!generatedCode) {
    throw new Error("OpenAI returned empty content");
  }
  return { code: generatedCode };
}

async function generateSummaryWithOpenAIConversation(args: {
  systemPrompt: string;
  userPrompt: string;
  followupPrompt: string;
  logger: ProcessLogger;
  model?: string;
  apiKey: string;
}): Promise<{ summary: string; firstAnswer: string }> {
  const { systemPrompt, userPrompt, followupPrompt, logger, model, apiKey } = args;
  if (!apiKey) {
    throw new Error("OpenAI API key is not set");
  }
  const openai = new OpenAI({ apiKey });
  const chosenModel = model || "gpt-4o-mini";

  await logger.log(`🧠 Selected OpenAI model (summary convo): ${chosenModel}`);
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  // First turn
  await logger.log("🗣️ Generating initial summary (turn 1)");
  const resp1 = await openai.chat.completions.create({
    model: chosenModel,
    temperature: 0.1,
    messages,
  });
  const firstAnswer = (resp1.choices?.[0]?.message?.content || "").trim();
  if (!firstAnswer) throw new Error("Empty summary from first turn");
  messages.push({ role: "assistant", content: firstAnswer });

  // Follow-up turn to refine
  messages.push({ role: "user", content: followupPrompt });
  await logger.log("🔁 Refining summary (turn 2 with conversation context)");
  const resp2 = await openai.chat.completions.create({
    model: chosenModel,
    temperature: 0.1,
    messages,
  });
  const secondAnswer = (resp2.choices?.[0]?.message?.content || "").trim();
  if (!secondAnswer) throw new Error("Empty summary from second turn");

  return { summary: secondAnswer, firstAnswer };
}

async function generateSummaryWithOllamaConversation(args: {
  systemPrompt: string;
  userPrompt: string;
  followupPrompt: string;
  logger: ProcessLogger;
  preferredModel?: string;
}): Promise<{ summary: string; firstAnswer: string }> {
  const { systemPrompt, userPrompt, followupPrompt, logger, preferredModel } = args;

  const ollamaHost = process.env.OLLAMA_HOST || "http://localhost:11434";
  const ollama = new Ollama({ host: ollamaHost });
  const model = preferredModel || process.env.OLLAMA_MODEL || "qwen2.5-coder:7b";

  await logger.log(`🧠 Selected Ollama model (summary convo): ${model}`);

  const baseMessages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userPrompt },
  ];

  await logger.log("🗣️ Generating initial summary (turn 1, ollama)");
  const resp1 = await ollama.chat({ model, messages: baseMessages, options: { temperature: 0.1 } });
  const firstAnswer = (resp1?.message?.content || "").trim();
  if (!firstAnswer) throw new Error("Empty summary from first turn (ollama)");

  const messages2 = [
    ...baseMessages,
    { role: "assistant" as const, content: firstAnswer },
    { role: "user" as const, content: followupPrompt },
  ];

  await logger.log("🔁 Refining summary (turn 2 with conversation context, ollama)");
  const resp2 = await ollama.chat({ model, messages: messages2, options: { temperature: 0.1 } });
  const secondAnswer = (resp2?.message?.content || "").trim();
  if (!secondAnswer) throw new Error("Empty summary from second turn (ollama)");

  return { summary: secondAnswer, firstAnswer };
}

// Configure API route timeout (10 minutes for parser generation)
export const maxDuration = 600; // 10 minutes in seconds

export async function POST(request: NextRequest) {
  const requestId = uuidv4();
  const requestStartTime = Date.now();
  let currentStep = 1;
  let processingId: string | null = null;
  let preProcessingLogBuffer = "";

  let convexParserId: string | null = null;
  let failureMarked = false;

  const markFailed = async (reason: string) => {
    if (failureMarked) return;
    failureMarked = true;
    try {
      const idToFail = convexParserId;
      if (idToFail) {
        await convex.mutation(api.procedures.updateParserFailedPublic, { parserId: (idToFail as unknown as Id<"parsers">) });
      }
    } catch (e) {
      console.error("Failed to mark parser failed:", (e as Error)?.message);
    }
    try {
      if (processingId) {
        await convex.mutation(api.procedures.markProcessingFailed, {
          processingId: (processingId as unknown as Id<"parser_processings">),
          error: reason || "Request aborted",
        });
      }
    } catch (e) {
      console.error("Failed to mark processing failed:", (e as Error)?.message);
    }
  };

  const abortHandler = () => {
    console.warn(`🔌 [${new Date().toISOString()}] Request aborted`);
    markFailed("Request aborted or endpoint crashed").catch((e) =>
      console.error("Failed to mark failed on abort:", (e as Error)?.message),
    );
  };
  // Best-effort: catch client disconnects/timeouts
  try {
    request.signal.addEventListener("abort", abortHandler);
  } catch { }

  const bufferLog = (message: string) => {
    console.log(message);
    preProcessingLogBuffer += (preProcessingLogBuffer ? "\n" : "") + message;
  };

  const makeLiveLogger = () => ({
    setStep: (step: number) => { currentStep = step; },
    log: async (message: string) => {
      console.log(message);
      if (processingId) {
        await convex.mutation(api.procedures.appendProcessingLog, { processingId: (processingId as unknown as Id<"parser_processings">), step: currentStep, message });
      }
    },
    error: async (message: string) => {
      console.error(message);
      if (processingId) {
        await convex.mutation(api.procedures.appendProcessingLog, { processingId: (processingId as unknown as Id<"parser_processings">), step: currentStep, message });
      }
    }
  } as ProcessLogger);
  let logger: ProcessLogger | null = null;
  let summarizeWithAI = false;

  try {
    bufferLog(`📥 [${new Date().toISOString()}] Parsing request body...`);
    const { parserId, provider: providerOverride, openaiModel, ollamaModel } = await request.json();

    if (!parserId) {
      console.error(`❌ [${new Date().toISOString()}] Missing parser ID in request`);
      try { request.signal.removeEventListener("abort", abortHandler); } catch { }
      return NextResponse.json(
        { error: "Parser ID is required" },
        { status: 400 }
      );
    }

    bufferLog(`🪪 Request ID: ${requestId}`);
    bufferLog(`Step 1: Validated request and parserId`);
    bufferLog(`🔄 Processing individual parser: ${parserId}`);

    // Determine partner via session for settings
    const sessionToken = request.cookies.get("octos_session")?.value;
    let partnerProvider: ModelProvider | null = null;
    let partnerOpenAIApiKey: string | null = null;
    if (sessionToken) {
      try {
        const settings = await convex.query(api.authDb.getPartnerSettingsBySession, { token: sessionToken });
        if (settings?.provider === "openai" || settings?.provider === "ollama") {
          partnerProvider = settings.provider as ModelProvider;
        }
        summarizeWithAI = settings?.summarizeProcessesWithAI === true;
        // If provider is OpenAI and encrypted key fields are present, decrypt with server key
        if (settings?.provider === "openai" && settings?.openaiKeyCiphertext && settings?.openaiKeyIv && settings?.openaiKeyAuthTag) {
          const secret = process.env.ENCRYPTION_KEY;
          if (secret) {
            const key = createHash("sha256").update(secret).digest();
            const iv = Buffer.from(settings.openaiKeyIv, "base64");
            const authTag = Buffer.from(settings.openaiKeyAuthTag, "base64");
            const decipher = createDecipheriv("aes-256-gcm", key, iv);
            decipher.setAuthTag(authTag);
            const plaintext = Buffer.concat([
              decipher.update(Buffer.from(settings.openaiKeyCiphertext, "base64")),
              decipher.final(),
            ]);
            partnerOpenAIApiKey = plaintext.toString("utf8");
          }
        }
      } catch { }
    }

    // Get the specific parser (allow idle or building)
    bufferLog(`Step 2: Fetching parser from database...`);
    const dbStart = Date.now();
    const parser = await convex.query(api.procedures.getParserByIdPublic, { parserId });
    const dbQueryTime = Date.now() - dbStart;

    if (!parser) {
      console.error(`❌ [${new Date().toISOString()}] Parser not found`);
      console.error(`Requested ID: ${parserId}`);
      try { request.signal.removeEventListener("abort", abortHandler); } catch { }
      return NextResponse.json(
        { error: "Parser not found or not in building state" },
        { status: 404 }
      );
    }

    // Disallow re-processing successful parsers
    if (parser.state === "success") {
      try { request.signal.removeEventListener("abort", abortHandler); } catch { }
      return NextResponse.json(
        { error: "Parser is already in success state and cannot be processed again" },
        { status: 400 }
      );
    }

    // Create processing row now that we have a parser ID
    // Compute total steps dynamically: base + 1 if summary is enabled
    const baseSteps = 9;
    const totalSteps = baseSteps + (summarizeWithAI ? 1 : 0);
    const createdProcessingId = await convex.mutation(api.procedures.startParserProcessing, {
      parserId: parser._id,
      requestId,
      initialStep: currentStep,
      totalSteps,
      initialLogs: preProcessingLogBuffer,
    });
    processingId = createdProcessingId;
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
      convexParserId = parser._id;

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
      let originalPayload: unknown;
      try {
        originalPayload = JSON.parse(parser.payload);
      } catch {
        await logger.log(`⚠️  Invalid JSON in stored payload, using raw string for generation/execution`);
        originalPayload = parser.payload;
      }
      // Fetch assigned schemas for this parser to steer generation
      let schemasForPrompt: BuildSystemPromptSchema[] = [];
      try {
        const items = await convex.query(api.authDb.getAssignedSchemasForParser, { parserId: parser._id as unknown as Id<"parsers"> });
        if (Array.isArray(items)) {
          schemasForPrompt = items.map((s: { name: string; schema: string; description: string; asArray?: boolean; key?: string }) => ({
            name: s.name,
            schema: s.schema,
            description: s.description,
            asArray: !!s.asArray,
            key: s.key,
          }));
        }
      } catch { /* ignore */ }

      const startTime = Date.now();
      logger!.setStep(4);
      // Rebuild prompts with schemas, if available
      const buildSchemas: BuildSystemPromptSchema[] = schemasForPrompt;
      const systemPrompt = buildSystemPrompt(buildSchemas);
      const userPrompt = buildUserPrompt(parser.event, simplifyPayload(originalPayload), "javascript", buildSchemas);
      await logger!.log(`📝 [${new Date().toISOString()}] Prompts prepared with ${buildSchemas.length} schema(s)`);
      await logger!.log(`System prompt length: ${systemPrompt.length} characters`);
      await logger!.log(`User prompt length: ${userPrompt.length} characters`);
      await logger!.log(`Preparation time: ${Date.now() - startTime}ms`);
      const generatedResp = await (async () => {
        const provider: ModelProvider = (providerOverride as ModelProvider) || partnerProvider || "ollama";
        return provider === "openai"
          ? await generateWithOpenAI({ systemPrompt, userPrompt, logger: logger!, model: openaiModel, apiKey: partnerOpenAIApiKey || "" })
          : await generateWithOllama({ systemPrompt, userPrompt, logger: logger!, preferredModel: ollamaModel });
      })();
      const generatedCode = generatedResp.code;
      const codeGenTime = Date.now() - codeGenStartTime;
      await logger.log(`🎉 AI code generation completed in ${codeGenTime}ms`);

      // Persist prompts used during generation for this processing run
      if (processingId) {
        try {
          await convex.mutation(api.procedures.setProcessingPrompts, {
            processingId: (processingId as unknown as Id<"parser_processings">),
            systemPrompt,
            userPrompt,
          });
        } catch (e) {
          // Non-fatal
          console.warn("Failed to persist prompts:", (e as Error)?.message);
        }
      }

      logger.setStep(5);
      await logger.log(`\n⚙️  STARTING PARSER EXECUTION`);

      // Execute the parser with the original payload
      await logger.log(`🔧 Creating parser function...`);
      const functionCreateStartTime = Date.now();
      const parseFunction = new Function(
        "payload",
        "callbacks",
        `${generatedCode}\nreturn exec(payload, callbacks);`
      );
      const functionCreateTime = Date.now() - functionCreateStartTime;
      await logger.log(`✅ Parser function created in ${functionCreateTime}ms`);

      logger.setStep(6);
      await logger.log(`🚀 Executing parser function...`);
      const executionStartTime = Date.now();
      const result = parseFunction(originalPayload, {
        success: () => {
          try { void logger?.log(`✅ exec.success callback invoked`); } catch {}
        },
        fail: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          try { void logger?.error(`⚠️ exec.fail callback invoked: ${msg}`); } catch {}
        },
      });
      const executionTime = Date.now() - executionStartTime;
      await logger.log(`✅ Parser execution completed in ${executionTime}ms`);

      logger.setStep(7);
      await logger.log(`🔍 Validating parser execution result...`);
      await logger.log(`Result type: ${typeof result}`);

      if (result) {
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

        await convex.mutation(api.procedures.markProcessingSuccess, { processingId: (processingId as unknown as Id<"parser_processings">) });

        // Optionally run a second AI pass to summarize the generated parser's return fields
        if (summarizeWithAI) {
          logger.setStep(10);
          await logger.log(`\n🧾 Generating AI summary of return fields...`);
          try {
            // Prepare summarization prompts
            const summarySystemPrompt = [
              "You are a senior integrations engineer.",
              "Given parser code and its execution result for a webhook payload, explain clearly:",
              "1) What the return fields represent and what they are based on in the original payload or schemas.",
              "2) Which rule/logic was used to derive each field (mapping, transformation, defaulting), if applicable.",
              "Keep it concise and helpful for business stakeholders.",
            ].join(" ");

            const safeResult = (() => {
              try { return JSON.stringify(filterNullValues(result), null, 2); } catch { return "<unserializable>"; }
            })();
            const safePayload = (() => {
              try { return JSON.stringify(simplifyPayload(originalPayload), null, 2); } catch { return "<unserializable>"; }
            })();
            const summaryUserPrompt = [
              "Parser generated code:",
              "```javascript\n" + sanitizeGeneratedCode(generatedCode) + "\n```",
              "\nOriginal simplified payload sample:",
              "```json\n" + safePayload + "\n```",
              "\nExecution result from the parser (the fields to explain):",
              "```json\n" + safeResult + "\n```",
              "\nExplain each top-level field's origin and rule.",
            ].join("\n");

            const provider: ModelProvider = (providerOverride as ModelProvider) || partnerProvider || "ollama";
            let summaryText = "";
            const followupPrompt = [
              "Please refine the previous explanation:",
              "- Make it concise and business-friendly.",
              "- Use bullet points, one per top-level field.",
              "- For each field include: 'from:' the payload/source and 'rule:' the mapping/transformation.",
              "- Avoid code blocks unless strictly needed.",
            ].join("\n");
            if (provider === "openai") {
              const resp = await generateSummaryWithOpenAIConversation({
                systemPrompt: summarySystemPrompt,
                userPrompt: summaryUserPrompt,
                followupPrompt,
                logger: logger!,
                model: openaiModel,
                apiKey: partnerOpenAIApiKey || "",
              });
              summaryText = stripCodeFences(resp.summary).trim();
            } else {
              const resp = await generateSummaryWithOllamaConversation({
                systemPrompt: summarySystemPrompt,
                userPrompt: summaryUserPrompt,
                followupPrompt,
                logger: logger!,
                preferredModel: ollamaModel,
              });
              summaryText = stripCodeFences(resp.summary).trim();
            }

            if (processingId && summaryText) {
              await convex.mutation(api.procedures.setProcessingSummary, {
                processingId: (processingId as unknown as Id<"parser_processings">),
                summary: summaryText,
                systemPrompt: summarySystemPrompt,
                userPrompt: summaryUserPrompt,
              });
              await logger.log(`✅ Summary saved (${summaryText.length} chars)`);
            }
          } catch (e) {
            await logger.error(`⚠️ Failed to generate summary: ${(e as Error)?.message}`);
          }
        }

        try {
          request.signal.removeEventListener("abort", abortHandler);
        } catch { }

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

      await markFailed(errorMessage);

      await logger?.log(`\n📤 Returning error response`);
      try {
        request.signal.removeEventListener("abort", abortHandler);
      } catch { }
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

    await markFailed(errorMessage);

    try {
      request.signal.removeEventListener("abort", abortHandler);
    } catch { }

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

function filterNullValues(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(filterNullValues);

  const input = obj as Record<string, unknown>;
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== null) {
      filtered[key] = filterNullValues(value);
    }
  }
  return filtered as unknown;
}

function simplifyPayload(payload: unknown, {
  arraySampleSize = 1,
  maxStringLength = 100,
}: {
  arraySampleSize?: number;
  maxStringLength?: number;
} = {}): unknown {
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
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(payload as Record<string, unknown>)) {
      result[key] = simplifyPayload(val, {
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

function sanitizeGeneratedCode(raw: string): string {
  // Remove common markdown code fences
  let code = raw.trim();
  if (code.startsWith("```")) {
    code = code.replace(/^```[a-zA-Z0-9]*\n?/, "");
  }
  if (code.endsWith("```")) {
    code = code.replace(/\n?```$/, "");
  }
  // If the model produced some preamble text, try to slice from the function declaration
  const idx = code.indexOf("function exec(");
  if (idx > -1) {
    code = code.slice(idx);
  }
  return code.trim();
}

function stripCodeFences(text: string): string {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z0-9]*\n?/, "");
  }
  if (t.endsWith("```")) {
    t = t.replace(/\n?```$/, "");
  }
  return t.trim();
}
