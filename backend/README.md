# Customer Intelligence Platform - Backend API

FastAPI backend with REST endpoints and WebSocket support for real-time progress streaming.

## Features

- **REST API**: Job submission and result retrieval
- **WebSocket**: Real-time progress updates during long-running tasks
- **Background Jobs**: Async task processing for onboarding and monitoring
- **Progress Tracking**: Custom progress tracker replacing tqdm.gather() for frontend integration
- **Structured Responses**: Pydantic models for type-safe data exchange

## Architecture

```
┌─────────────┐
│   Frontend  │
│ (React/Next)│
└──────┬──────┘
       │ HTTP/WS
       ▼
┌─────────────────────────────────────┐
│         FastAPI Backend             │
├─────────────────────────────────────┤
│  • REST Endpoints                   │
│  • WebSocket Manager                │
│  • Background Job Queue             │
│  • Progress Tracker                 │
└──────┬──────────────────────┬───────┘
       │                      │
       ▼                      ▼
┌──────────────┐    ┌─────────────────┐
│ Platform     │    │  SQLite DB      │
│ Service      │◄───┤ customer_intel  │
└──────┬───────┘    └─────────────────┘
       │
       ▼
┌──────────────────────────────┐
│  CustomerIntelligencePlatform│
│  (researcher.py)             │
└──────────────────────────────┘
```

## Setup

### 1. Install Dependencies

Using uv:
```bash
uv sync
```

Or using pip:
```bash
pip install -e .
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:
```env
OPENAI_API_KEY=sk-your-key-here
```

### 3. Run the Server

Using uv:
```bash
uv run python backend/api.py
```

Or directly:
```bash
python backend/api.py
```

The server will start at `http://localhost:8000`

### 4. View API Documentation

FastAPI provides interactive API documentation:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### Health Check

```http
GET /
```

**Response:**
```json
{
  "service": "Customer Intelligence Platform API",
  "status": "running",
  "version": "1.0.0"
}
```

---

### Onboard Company

```http
POST /api/onboard
```

Onboard a new SaaS company with automatic research.

**Request Body:**
```json
{
  "company_name": "Salesforce",
  "website": "salesforce.com",
  "deep_research": true
}
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Onboarding job created for Salesforce"
}
```

**What Happens:**
1. Creates background job
2. Runs 10 parallel web searches for company research
3. Discovers enterprise customers (3 parallel queries)
4. Maps customers to stock tickers
5. Saves to database

**Progress Monitoring:** Connect to WebSocket `/ws/progress/{job_id}`

---

### Get Onboarding Status

```http
GET /api/onboard/{job_id}/status
```

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "progress": 0.45,
  "current_step": "research: pricing - completed",
  "error": null
}
```

**Status Values:**
- `pending`: Job created, not started
- `running`: Job in progress
- `completed`: Job finished successfully
- `failed`: Job encountered an error

---

### Get Onboarding Result

```http
GET /api/onboard/{job_id}/result
```

Returns final results after job completion.

**Response:**
```json
{
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "company_name": "Salesforce",
  "customers_discovered": 50,
  "enterprise_customers": 47,
  "products_found": 8,
  "pricing_tiers_found": 4,
  "icps_found": 3,
  "personas_found": 5,
  "completed_at": "2025-01-15T10:30:00.000Z"
}
```

---

### Monitor Customers

```http
POST /api/monitor
```

Monitor enterprise customers for buying signals.

**Request Body:**
```json
{
  "saas_client_name": "Salesforce",
  "customer_age_days": 90
}
```

**Response:**
```json
{
  "job_id": "660e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Monitoring job created for Salesforce customers"
}
```

**What Happens:**
1. Retrieves customers from database (seen in last N days)
2. Fetches SEC 8-K filings for each
3. Detects buying signals (exec hires, acquisitions, etc.)
4. Generates persona-specific intelligence reports

---

### Get Monitoring Status

```http
GET /api/monitor/{job_id}/status
```

Same format as onboarding status.

---

### Get Intelligence Signals

```http
GET /api/monitor/{job_id}/signals
```

Returns all detected signals with intelligence analysis.

**Response:**
```json
{
  "job_id": "660e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "saas_client": "Salesforce",
  "signals_found": 12,
  "signals": [
    {
      "ticker": "TSLA",
      "company_name": "Tesla Inc",
      "signal_type": "EXECUTIVE_HIRE",
      "opportunity_type": "Expansion",
      "urgency_score": 0.85,
      "estimated_value": "$250k-$500k ARR",
      "generated_at": "2025-01-15T10:35:00.000Z"
    }
  ],
  "completed_at": "2025-01-15T10:35:00.000Z"
}
```

---

### WebSocket: Progress Updates

```
WS /ws/progress/{job_id}
```

Connect to receive real-time progress updates.

**Client Example (JavaScript):**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/progress/' + jobId);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Message Types:**

**1. Initial Status**
```json
{
  "type": "status",
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "progress": 0.0,
  "current_step": null
}
```

**2. Progress Update**
```json
{
  "type": "progress",
  "stage": "research",
  "task": "products",
  "status": "started",
  "progress": 0.1,
  "completed": 1,
  "total": 10,
  "failed": 0,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**3. Task Completion**
```json
{
  "type": "progress",
  "stage": "research",
  "task": "products",
  "status": "completed",
  "progress": 0.2,
  "completed": 2,
  "total": 10,
  "failed": 0,
  "timestamp": "2025-01-15T10:30:15.000Z"
}
```

**4. Stage Start**
```json
{
  "type": "stage_start",
  "stage": "research",
  "message": "Starting deep research for Salesforce",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**5. Stage Complete**
```json
{
  "type": "stage_complete",
  "stage": "research",
  "message": "Research completed for Salesforce",
  "timestamp": "2025-01-15T10:32:00.000Z"
}
```

**6. Final Completion**
```json
{
  "type": "status",
  "status": "completed",
  "message": "Onboarding completed for Salesforce",
  "result_summary": {
    "company_name": "Salesforce",
    "customers_discovered": 50,
    "enterprise_customers": 47
  },
  "timestamp": "2025-01-15T10:35:00.000Z"
}
```

**7. Error**
```json
{
  "type": "error",
  "error": "API rate limit exceeded",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**8. Keepalive Ping**
```json
{
  "type": "ping"
}
```

## Usage Examples

### Using cURL

**1. Onboard a company:**
```bash
curl -X POST http://localhost:8000/api/onboard \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Salesforce",
    "website": "salesforce.com",
    "deep_research": true
  }'
```

**2. Check status:**
```bash
curl http://localhost:8000/api/onboard/{job_id}/status
```

**3. Get results:**
```bash
curl http://localhost:8000/api/onboard/{job_id}/result
```

### Using Python

```python
import httpx
import asyncio
import websockets
import json

async def onboard_company():
    # Submit job
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "http://localhost:8000/api/onboard",
            json={
                "company_name": "Salesforce",
                "website": "salesforce.com",
                "deep_research": True
            }
        )
        job_data = response.json()
        job_id = job_data["job_id"]
        print(f"Job created: {job_id}")

    # Monitor progress via WebSocket
    async with websockets.connect(f"ws://localhost:8000/ws/progress/{job_id}") as ws:
        async for message in ws:
            data = json.loads(message)
            print(f"Progress: {data}")

            if data.get("type") == "status" and data.get("status") == "completed":
                break

    # Get final result
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"http://localhost:8000/api/onboard/{job_id}/result"
        )
        result = response.json()
        print(f"Result: {result}")

asyncio.run(onboard_company())
```

## Development

### Project Structure

```
backend/
├── api.py                 # FastAPI application and endpoints
├── platform_service.py    # Service layer wrapping researcher.py
├── progress_tracker.py    # Progress tracking replacing tqdm.gather()
└── README.md             # This file

researcher.py             # Core intelligence platform
customer_intel.db         # SQLite database
```

### Adding New Endpoints

1. Define Pydantic models in `api.py` (request/response schemas)
2. Create endpoint handler with `@app.post()` or `@app.get()`
3. Add background job runner if async processing needed
4. Update documentation

### Testing

Run the test suite:
```bash
uv run pytest
```

### Code Quality

Format code with Black:
```bash
uv run black backend/
```

## Production Deployment

### Environment Variables

Update `.env` for production:
```env
OPENAI_API_KEY=sk-prod-key
ALLOWED_ORIGINS=https://yourdomain.com
API_HOST=0.0.0.0
API_PORT=8000
```

### CORS Configuration

Update `api.py` line 188-189:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    ...
)
```

### Running with Gunicorn

```bash
gunicorn backend.api:app \
  --workers 4 \
  --worker-class uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000
```

### Docker (Optional)

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY . .

RUN pip install -e .

CMD ["uvicorn", "backend.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

## Troubleshooting

### "Platform service not initialized"

**Error:** `Platform service not initialized. Please set OPENAI_API_KEY environment variable.`

**Solution:**
1. Create `.env` file from `.env.example`
2. Add your OpenAI API key
3. Restart the server

### WebSocket Connection Failed

**Issue:** Frontend can't connect to WebSocket

**Solution:**
1. Check CORS settings allow your frontend origin
2. Ensure WebSocket URL uses correct protocol (`ws://` or `wss://`)
3. Verify job_id exists before connecting

### Job Stuck in "pending"

**Issue:** Job never moves to "running" status

**Solution:**
1. Check server logs for errors
2. Verify OpenAI API key is valid
3. Check database permissions

## Next Steps

See the main README for:
- Frontend setup (Phase 2)
- Progress tracking integration (Phase 3)
- Full system deployment
