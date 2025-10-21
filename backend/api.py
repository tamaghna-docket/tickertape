"""
FastAPI backend for Customer Intelligence Platform
Provides REST API and WebSocket endpoints for real-time progress streaming
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import Dict, List, Optional, Any
import asyncio
import uuid
import json
from datetime import datetime
from enum import Enum

# Import the platform service
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.platform_service import PlatformService


# ============================================================================
# Data Models
# ============================================================================

class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class OnboardRequest(BaseModel):
    company_name: str
    website: str
    deep_research: bool = True


class MonitorRequest(BaseModel):
    saas_client_name: str
    customer_age_days: int = 90


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus
    message: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: JobStatus
    progress: float
    current_step: Optional[str] = None
    error: Optional[str] = None


class OnboardResult(BaseModel):
    job_id: str
    status: JobStatus
    company_name: str
    customers_discovered: int
    enterprise_customers: int
    products_found: int
    pricing_tiers_found: int
    icps_found: int
    personas_found: int
    completed_at: Optional[str] = None


class SignalSummary(BaseModel):
    ticker: str
    company_name: str
    signal_type: str
    opportunity_type: str
    urgency_score: float
    estimated_value: str
    generated_at: str


class MonitorResult(BaseModel):
    job_id: str
    status: JobStatus
    saas_client: str
    signals_found: int
    signals: List[SignalSummary]
    completed_at: Optional[str] = None


# ============================================================================
# WebSocket Manager
# ============================================================================

class ConnectionManager:
    """Manages WebSocket connections for progress streaming"""

    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, job_id: str, websocket: WebSocket):
        """Accept and register a new WebSocket connection"""
        await websocket.accept()
        if job_id not in self.active_connections:
            self.active_connections[job_id] = []
        self.active_connections[job_id].append(websocket)

    def disconnect(self, job_id: str, websocket: WebSocket):
        """Remove a WebSocket connection"""
        if job_id in self.active_connections:
            self.active_connections[job_id].remove(websocket)
            if not self.active_connections[job_id]:
                del self.active_connections[job_id]

    async def send_progress(self, job_id: str, data: dict):
        """Send progress update to all connected clients for this job"""
        if job_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[job_id]:
                try:
                    await connection.send_json(data)
                except Exception:
                    dead_connections.append(connection)

            # Clean up dead connections
            for dead in dead_connections:
                self.disconnect(job_id, dead)


# ============================================================================
# Job Storage (In-Memory for now, can migrate to Redis/DB later)
# ============================================================================

class JobStore:
    """Stores job metadata and results"""

    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}

    def create_job(self, job_type: str, params: dict) -> str:
        """Create a new job and return job_id"""
        job_id = str(uuid.uuid4())
        self.jobs[job_id] = {
            "job_id": job_id,
            "job_type": job_type,
            "status": JobStatus.PENDING,
            "params": params,
            "progress": 0.0,
            "current_step": None,
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "completed_at": None
        }
        return job_id

    def update_job(self, job_id: str, **kwargs):
        """Update job fields"""
        if job_id in self.jobs:
            self.jobs[job_id].update(kwargs)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve job data"""
        return self.jobs.get(job_id)

    def set_job_status(self, job_id: str, status: JobStatus, error: Optional[str] = None):
        """Update job status"""
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = status
            if error:
                self.jobs[job_id]["error"] = error
            if status in (JobStatus.COMPLETED, JobStatus.FAILED):
                self.jobs[job_id]["completed_at"] = datetime.now().isoformat()


# ============================================================================
# FastAPI App Initialization
# ============================================================================

app = FastAPI(
    title="Customer Intelligence Platform API",
    description="REST API with WebSocket support for SaaS customer intelligence and monitoring",
    version="1.0.0"
)

# CORS middleware for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
ws_manager = ConnectionManager()
job_store = JobStore()

# Initialize platform service (requires OpenAI API key)
# TODO: Load API key from environment variable
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
platform_service = PlatformService(
    openai_api_key=OPENAI_API_KEY,
    db_path="customer_intel.db"
) if OPENAI_API_KEY else None


# ============================================================================
# REST Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Customer Intelligence Platform API",
        "status": "running",
        "version": "1.0.0"
    }


@app.post("/api/onboard", response_model=JobResponse)
async def onboard_company(
    request: OnboardRequest,
    background_tasks: BackgroundTasks
):
    """
    Onboard a new SaaS company with auto-research

    This endpoint:
    1. Creates a background job
    2. Runs company research in parallel (10 queries)
    3. Discovers enterprise customers (3 parallel queries)
    4. Maps customers to stock tickers
    5. Saves everything to database

    Progress can be monitored via WebSocket at /ws/progress/{job_id}
    """
    # Create job
    job_id = job_store.create_job(
        job_type="onboard",
        params={
            "company_name": request.company_name,
            "website": request.website,
            "deep_research": request.deep_research
        }
    )

    # Start background task
    background_tasks.add_task(
        run_onboarding_job,
        job_id,
        request.company_name,
        request.website,
        request.deep_research
    )

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message=f"Onboarding job created for {request.company_name}"
    )


@app.get("/api/onboard/{job_id}/status", response_model=JobStatusResponse)
async def get_onboard_status(job_id: str):
    """Get the current status of an onboarding job"""
    job = job_store.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        current_step=job["current_step"],
        error=job["error"]
    )


@app.get("/api/onboard/{job_id}/result", response_model=OnboardResult)
async def get_onboard_result(job_id: str):
    """Get the final result of a completed onboarding job"""
    job = job_store.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed. Current status: {job['status']}"
        )

    result = job["result"]
    if not result:
        raise HTTPException(status_code=500, detail="Job completed but no result found")

    return OnboardResult(**result)


@app.post("/api/monitor", response_model=JobResponse)
async def monitor_customers(
    request: MonitorRequest,
    background_tasks: BackgroundTasks
):
    """
    Monitor enterprise customers of a SaaS client for buying signals

    This endpoint:
    1. Retrieves customers from database
    2. Fetches SEC 8-K filings for each
    3. Detects buying signals (exec hires, acquisitions, etc.)
    4. Generates persona-specific intelligence reports

    Progress can be monitored via WebSocket at /ws/progress/{job_id}
    """
    job_id = job_store.create_job(
        job_type="monitor",
        params={
            "saas_client_name": request.saas_client_name,
            "customer_age_days": request.customer_age_days
        }
    )

    background_tasks.add_task(
        run_monitoring_job,
        job_id,
        request.saas_client_name,
        request.customer_age_days
    )

    return JobResponse(
        job_id=job_id,
        status=JobStatus.PENDING,
        message=f"Monitoring job created for {request.saas_client_name} customers"
    )


@app.get("/api/monitor/{job_id}/status", response_model=JobStatusResponse)
async def get_monitor_status(job_id: str):
    """Get the current status of a monitoring job"""
    job = job_store.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job["progress"],
        current_step=job["current_step"],
        error=job["error"]
    )


@app.get("/api/monitor/{job_id}/signals", response_model=MonitorResult)
async def get_monitor_signals(job_id: str):
    """Get all intelligence signals from a completed monitoring job"""
    job = job_store.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] != JobStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Job not completed. Current status: {job['status']}"
        )

    result = job["result"]
    if not result:
        raise HTTPException(status_code=500, detail="Job completed but no result found")

    return MonitorResult(**result)


@app.get("/api/signals/{saas_client_name}")
async def get_signals_from_db(saas_client_name: str):
    """Get all intelligence signals directly from database (no job_id needed)"""
    if not platform_service:
        raise HTTPException(status_code=500, detail="Platform service not initialized")

    import sqlite3

    # Query database for all intelligence reports for this SaaS client
    conn = sqlite3.connect(platform_service.platform.db_path)
    c = conn.cursor()

    c.execute('''
        SELECT intelligence FROM intelligence
        WHERE saas_client = ?
        ORDER BY generated_at DESC
    ''', (saas_client_name,))

    rows = c.fetchall()
    conn.close()

    if not rows:
        return {
            "saas_client": saas_client_name,
            "signals_found": 0,
            "signals": []
        }

    # Parse intelligence reports from JSON
    signals = []
    for row in rows:
        intel_data = json.loads(row[0])

        # Extract signal summary with enough detail to differentiate multiple signals
        signal_data = intel_data.get("signal", {})
        signals.append({
            "ticker": intel_data.get("enterprise_customer", {}).get("ticker", "N/A"),
            "company_name": intel_data.get("enterprise_customer", {}).get("company_name", "Unknown"),
            "signal_type": signal_data.get("signal_type", "unknown"),
            "signal_summary": signal_data.get("summary", ""),  # Add summary to distinguish signals
            "filing_date": signal_data.get("filing_date", ""),  # Add filing date
            "opportunity_type": intel_data.get("opportunity_type", "unknown"),
            "urgency_score": intel_data.get("urgency_score", 0.0),
            "estimated_value": intel_data.get("estimated_opportunity_value", "Unknown"),
            "generated_at": intel_data.get("generated_at", datetime.now().isoformat())
        })

    return {
        "saas_client": saas_client_name,
        "signals_found": len(signals),
        "signals": signals
    }


@app.get("/api/intelligence/{ticker}/{saas_client_name}")
async def get_intelligence_report(ticker: str, saas_client_name: str):
    """Get the full intelligence report for a specific customer"""
    if not platform_service:
        raise HTTPException(status_code=500, detail="Platform service not initialized")

    import sqlite3

    conn = sqlite3.connect(platform_service.platform.db_path)
    c = conn.cursor()

    c.execute('''
        SELECT intelligence FROM intelligence
        WHERE ticker = ? AND saas_client = ?
        ORDER BY generated_at DESC
        LIMIT 1
    ''', (ticker, saas_client_name))

    row = c.fetchone()
    conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No intelligence report found for {ticker} and {saas_client_name}"
        )

    # Return the full intelligence data
    return json.loads(row[0])


@app.get("/api/customers/{saas_client_name}")
async def get_customers(saas_client_name: str):
    """Get all enterprise customers for a SaaS client"""
    if not platform_service:
        raise HTTPException(status_code=500, detail="Platform service not initialized")

    import sqlite3

    conn = sqlite3.connect(platform_service.platform.db_path)
    c = conn.cursor()

    # Query enterprise_customers table
    c.execute('''
        SELECT ticker, company_name, config FROM enterprise_customers
        WHERE saas_client = ?
        ORDER BY company_name
    ''', (saas_client_name,))

    rows = c.fetchall()
    conn.close()

    if not rows:
        return {
            "saas_client": saas_client_name,
            "customer_count": 0,
            "customers": []
        }

    # Parse and return customer list
    customer_list = []
    for row in rows:
        ticker, company_name, config_json = row
        config = json.loads(config_json) if config_json else {}

        customer_list.append({
            "ticker": ticker,
            "company_name": company_name,
            "industry": config.get("industry", "Unknown")
        })

    return {
        "saas_client": saas_client_name,
        "customer_count": len(customer_list),
        "customers": customer_list
    }


@app.get("/api/companies")
async def get_all_onboarded_companies():
    """Get all onboarded SaaS companies with their summary statistics"""
    if not platform_service:
        raise HTTPException(status_code=500, detail="Platform service not initialized")

    import sqlite3

    conn = sqlite3.connect(platform_service.platform.db_path)
    c = conn.cursor()

    # Get all SaaS clients with their config
    c.execute('SELECT name, config FROM saas_clients ORDER BY name')
    saas_rows = c.fetchall()

    companies = []
    for name, config_json in saas_rows:
        config = json.loads(config_json) if config_json else {}

        # Count customers for this company
        c.execute('SELECT COUNT(*) FROM enterprise_customers WHERE saas_client = ?', (name,))
        customer_count = c.fetchone()[0]

        # Count signals for this company
        c.execute('SELECT COUNT(*) FROM intelligence WHERE saas_client = ?', (name,))
        signal_count = c.fetchone()[0]

        # Extract stats from config
        products = config.get("products", [])
        pricing_tiers = config.get("pricing_tiers", [])
        icps = config.get("ideal_customer_profiles", [])
        personas = config.get("gtm_personas", [])

        companies.append({
            "name": name,
            "customer_count": customer_count,
            "signal_count": signal_count,
            "products_count": len(products),
            "pricing_tiers_count": len(pricing_tiers),
            "icps_count": len(icps),
            "personas_count": len(personas),
            "website": config.get("website", ""),
            "products": products,
            "pricing_tiers": pricing_tiers,
            "icps": icps,
            "personas": personas
        })

    conn.close()

    return {
        "total_companies": len(companies),
        "companies": companies
    }


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@app.websocket("/ws/progress/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    """
    WebSocket endpoint for real-time progress updates

    Clients connect with job_id and receive progress updates as:
    {
        "type": "progress",
        "task": "products",
        "status": "started" | "completed",
        "progress": 0.0 - 1.0,
        "timestamp": "ISO-8601"
    }
    """
    await ws_manager.connect(job_id, websocket)

    try:
        # Send initial status
        job = job_store.get_job(job_id)
        if job:
            await websocket.send_json({
                "type": "status",
                "job_id": job_id,
                "status": job["status"],
                "progress": job["progress"],
                "current_step": job["current_step"]
            })

        # Keep connection alive and listen for client messages (if needed)
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Handle any client messages if needed
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket.send_json({"type": "ping"})

    except WebSocketDisconnect:
        ws_manager.disconnect(job_id, websocket)
    except Exception as e:
        print(f"WebSocket error for job {job_id}: {e}")
        ws_manager.disconnect(job_id, websocket)


# ============================================================================
# Background Job Runners (to be implemented with platform integration)
# ============================================================================

async def run_onboarding_job(
    job_id: str,
    company_name: str,
    website: str,
    deep_research: bool
):
    """
    Background task for onboarding a company

    Integrates with CustomerIntelligencePlatform via PlatformService
    """
    print(f"\n{'='*80}")
    print(f"[BACKGROUND TASK] Starting onboarding job {job_id} for {company_name}")
    print(f"{'='*80}")

    try:
        # Check platform service is available
        if not platform_service:
            error_msg = "Platform service not initialized. Please set OPENAI_API_KEY environment variable."
            print(f"[ERROR] {error_msg}")
            raise Exception(error_msg)

        print(f"[INFO] Platform service is initialized")

        # Update status
        job_store.set_job_status(job_id, JobStatus.RUNNING)
        await ws_manager.send_progress(job_id, {
            "type": "status",
            "status": "running",
            "message": f"Starting onboarding for {company_name}",
            "timestamp": datetime.now().isoformat()
        })

        print(f"[INFO] Starting onboarding with progress tracking...")

        # Run onboarding with progress tracking
        result = await platform_service.onboard_with_progress(
            company_name=company_name,
            website=website,
            ws_manager=ws_manager,
            job_id=job_id,
            job_store=job_store,
            deep_research=deep_research
        )

        print(f"[SUCCESS] Onboarding completed successfully")
        print(f"[RESULT] {result}")

        # Mark as completed
        result_with_metadata = {
            "job_id": job_id,
            "status": JobStatus.COMPLETED,
            **result,
            "completed_at": datetime.now().isoformat()
        }

        job_store.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=1.0,
            current_step="Completed",
            result=result_with_metadata
        )

        await ws_manager.send_progress(job_id, {
            "type": "status",
            "status": "completed",
            "message": f"Onboarding completed for {company_name}",
            "result_summary": result,
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        print(f"\n[EXCEPTION] Onboarding job {job_id} failed with error:")
        print(f"[EXCEPTION] {type(e).__name__}: {str(e)}")
        import traceback
        print(f"[TRACEBACK]")
        traceback.print_exc()

        job_store.set_job_status(job_id, JobStatus.FAILED, error=str(e))
        await ws_manager.send_progress(job_id, {
            "type": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })


async def run_monitoring_job(
    job_id: str,
    saas_client_name: str,
    customer_age_days: int
):
    """
    Background task for monitoring customers

    Integrates with CustomerIntelligencePlatform via PlatformService
    """
    try:
        # Check platform service is available
        if not platform_service:
            raise Exception("Platform service not initialized. Please set OPENAI_API_KEY environment variable.")

        job_store.set_job_status(job_id, JobStatus.RUNNING)
        await ws_manager.send_progress(job_id, {
            "type": "status",
            "status": "running",
            "message": f"Starting monitoring for {saas_client_name} customers",
            "timestamp": datetime.now().isoformat()
        })

        # Run monitoring with progress tracking
        result = await platform_service.monitor_with_progress(
            saas_client_name=saas_client_name,
            ws_manager=ws_manager,
            job_id=job_id,
            job_store=job_store,
            customer_age_days=customer_age_days
        )

        # Mark as completed
        result_with_metadata = {
            "job_id": job_id,
            "status": JobStatus.COMPLETED,
            **result,
            "completed_at": datetime.now().isoformat()
        }

        job_store.update_job(
            job_id,
            status=JobStatus.COMPLETED,
            progress=1.0,
            result=result_with_metadata
        )

        await ws_manager.send_progress(job_id, {
            "type": "status",
            "status": "completed",
            "message": f"Monitoring completed for {saas_client_name}",
            "result_summary": result,
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        job_store.set_job_status(job_id, JobStatus.FAILED, error=str(e))
        await ws_manager.send_progress(job_id, {
            "type": "error",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        })


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
