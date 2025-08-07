# Comprehensive Timeout & Logging Solution

## Issues Solved

### ✅ 1. Fixed EvalError in Convex Actions
**Problem**: `EvalError: Code generation from strings disallowed for this context`
**Root Cause**: Convex actions have security restrictions preventing dynamic code execution with `new Function()` or `eval()`
**Solution**:
- Execute parser code in the API route (Node.js environment) where dynamic code execution is allowed
- Process parsed data directly in Convex mutations instead of re-executing in actions
- Created public versions of internal mutations for API route access

### ✅ 2. Added Comprehensive Logging System
**Features**:
- **Request tracking**: Unique request ID for each parser processing
- **Step-by-step timing**: Detailed timing for each major operation
- **Error tracking**: Comprehensive error logging with stack traces
- **Progress indicators**: Clear visual indicators for each processing stage
- **Database timing**: Track query and mutation performance
- **AI generation monitoring**: Detailed Ollama request/response logging

### ✅ 3. Enhanced Timeout Handling
**Improvements**:
- Extended API route timeout to 10 minutes (`maxDuration = 600`)
- Added retry logic with exponential backoff (3 attempts)
- Better error recovery and state management
- Proper timeout configuration for Ollama requests

## Current Performance Metrics

Based on the latest logs:
- **Total Request Time**: ~249 seconds (4+ minutes)
- **AI Generation Time**: ~247 seconds (97% of total time)
- **Database Operations**: <1 second each
- **Parser Execution**: <1ms (very fast)

## Detailed Logging Output

```
🌟 NEW PARSER PROCESSING REQUEST
🌟 Request ID: otell
📥 Parsing request body...
🔄 Processing individual parser: ks73e3zvth62jsdy5s05wrqeph7n62rz
🔍 Fetching parser from database...
📊 Database query completed (Query time: 551ms)
✅ Parser found successfully
🔄 STARTING PARSER PROCESSING
💾 Updating parser status in database... (267ms)
🤖 STARTING AI CODE GENERATION
🚀 Starting parser code generation
⚙️ Ollama client initialized
📝 Prompts prepared (System: 2778 chars, User: 1881 chars)
🔄 Starting Ollama generation (max 3 attempts)
🎯 Attempt 1/3 - Starting Ollama request
✅ Ollama request successful (247,598ms)
🎉 AI code generation completed (247,600ms)
⚙️ STARTING PARSER EXECUTION
🔧 Creating parser function... (0ms)
🚀 Executing parser function... (0ms)
🔍 Validating parser execution result...
✅ Parser result validation passed
💾 Saving generated code to database... (543ms)
🏗️ STARTING FINAL PROCESSING
📊 Processing parsed data...
✅ Final processing completed (560ms)
🎉 PARSER PROCESSING COMPLETED SUCCESSFULLY
```

## Architecture Changes

### Before
```
API Route → Convex Action (processBuildingParser) → Dynamic Code Execution ❌
```

### After
```
API Route → Execute Parser Code → Convex Mutation (processWebhookDataPublic) ✅
```

### New Flow
1. **API Route** (`/api/process-parser`)
   - Receives parser ID
   - Fetches parser from database
   - Generates code with Ollama (with retry logic)
   - Executes parser code safely in Node.js
   - Processes parsed data via public Convex mutations
   - Updates parser status to success

2. **Convex Functions**
   - `processWebhookDataPublic`: Stores parsed client/order/shipping data
   - `updateParserSuccessPublic`: Updates parser state to success
   - `resetFailedParser`: Resets failed parsers for retry

## Performance Optimization Opportunities

### 🎯 Next Steps to Improve AI Generation Time

1. **Model Optimization**
   ```javascript
   // Current: gpt-oss:20b (20B parameters - slow but accurate)
   // Consider: smaller models for faster generation
   model: "qwen2.5-coder:7b"  // Faster, still good for code generation
   ```

2. **Prompt Optimization**
   - Reduce system prompt length (currently 2,778 chars)
   - Use more focused examples
   - Implement prompt templates

3. **Parallel Processing**
   - Process multiple parsers simultaneously
   - Implement queue system for high load

4. **Caching Strategy**
   - Cache generated parsers for similar payloads
   - Implement parser template system

## Error Recovery

### Reset Functionality
Failed parsers can now be reset and retried:
```javascript
// Reset a failed parser
await resetFailedParser({ parserId })

// This will:
// 1. Change state from "failed" to "building"
// 2. Clear error message
// 3. Clear failed code
// 4. Allow retry of the entire process
```

### Retry Logic
- **Automatic retries**: Up to 3 attempts with exponential backoff
- **Manual retries**: Reset button in UI for failed parsers
- **Graceful degradation**: Proper error states and user feedback

## Monitoring & Debugging

### Log Analysis
Monitor these key metrics:
- AI generation time (should be <3 minutes ideally)
- Database query performance (<1 second)
- Parser execution time (<100ms)
- Overall success rate (>95%)

### Alerting
Set up alerts for:
- Requests taking >6 minutes total
- AI generation failing >2 times in a row
- Database queries taking >2 seconds
- Parser execution errors

## Usage Examples

### Reset a Failed Parser (UI)
1. Go to Parsers table
2. Find failed parser (red "Failed" badge)
3. Click "Reset" button
4. Confirm reset
5. Click "Retry Build" to rebuild

### Monitor Processing (Logs)
```bash
# Watch logs during parser processing
tail -f logs/parser-processing.log | grep "Request ID: [id]"
```

### Performance Tuning
```javascript
// Adjust Ollama parameters for speed vs quality tradeoff
{
  temperature: 0.1,        // Lower = more consistent, faster
  num_predict: 1024,       // Lower = faster generation
  model: "qwen2.5-coder:7b" // Smaller model = faster
}
```

## Success Criteria

✅ **Eliminated EvalError**: No more code execution errors in Convex
✅ **Comprehensive Logging**: Full visibility into processing pipeline
✅ **Timeout Handling**: 10-minute timeout with retry logic
✅ **Error Recovery**: Reset and retry functionality for failed parsers
✅ **Performance Tracking**: Detailed timing for optimization

🎯 **Next Goal**: Reduce AI generation time from 4+ minutes to <2 minutes
