# Parser Timeout Fix Implementation

## Problem
The parser processing was experiencing timeout errors when communicating with Ollama:
```
❌ Failed to process parser vii_order-created_parser_1754529198650: TypeError: fetch failed
Headers Timeout Error (UND_ERR_HEADERS_TIMEOUT)
```

## Solution Implemented

### 1. Enhanced Ollama Configuration
- Removed invalid timeout configuration (not supported by ollama npm package)
- Added `keep_alive: "10m"` to keep the model loaded longer
- Used proper Ollama configuration options

### 2. Retry Logic with Exponential Backoff
- Added retry mechanism with up to 3 attempts
- Exponential backoff: 2s, 4s, 8s between retries
- Better error handling and logging

### 3. API Route Timeout Configuration
- Set `maxDuration = 600` (10 minutes) for the API route
- Added status updates during processing
- Improved error reporting

### 4. Request Optimization
- Added `temperature: 0.1` for more consistent results
- Limited response with `num_predict: 2048`
- Better prompt structuring

## Files Modified

1. **`app/api/process-parser/route.ts`**
   - Enhanced Ollama client configuration
   - Added retry logic with exponential backoff
   - Improved error handling
   - Added API route timeout configuration
   - Added status updates during processing

2. **`next.config.ts`**
   - Added experimental package configuration for Ollama
   - Configured cache headers for parser routes

## Configuration Options

### Environment Variables (Optional)
These can be set if running Ollama on non-default settings:

```bash
# If Ollama is running on a different host/port
OLLAMA_HOST=http://localhost:11434

# Ollama keep alive duration (default is good)
OLLAMA_KEEP_ALIVE=10m

# Model load timeout
OLLAMA_LOAD_TIMEOUT=5m
```

### Deployment Considerations

#### For Local Development
- Ensure Ollama is running: `ollama serve`
- Check if model is available: `ollama list`
- Pull the model if needed: `ollama pull gpt-oss:20b`

#### For Production Deployment
- Configure sufficient memory for the deployment platform
- Ensure timeout limits are appropriate:
  - Vercel: 10 minute maximum for Pro plans
  - Railway: Configure timeout in service settings
  - Docker: Adjust health check timeouts

#### Load Balancer Configuration
If using a load balancer, ensure:
- Request timeout > 10 minutes
- Keep-alive timeout > 10 minutes
- Proper health check configuration

## Testing the Fix

1. **Test Parser Processing**:
   ```bash
   curl -X POST http://localhost:3000/api/process-parser \
     -H "Content-Type: application/json" \
     -d '{"parserId": "your-parser-id"}'
   ```

2. **Monitor Logs**:
   - Check for retry attempts
   - Verify successful model loading
   - Monitor processing times

3. **Verify Timeout Handling**:
   - Test with large payloads
   - Check error recovery
   - Validate status updates

## Performance Improvements

### Before
- No retry mechanism
- No timeout configuration
- 5+ minute processing time often failed
- Headers timeout errors

### After
- 3-attempt retry with exponential backoff
- 10-minute API route timeout
- Model keep-alive optimization
- Better error handling and recovery
- Status updates during processing

## Monitoring

Monitor these metrics:
- Parser success rate
- Processing time per parser
- Retry frequency
- Error types and frequencies

Expected improvements:
- ✅ Reduced timeout errors
- ✅ Better error recovery
- ✅ More reliable parser generation
- ✅ Improved user feedback
