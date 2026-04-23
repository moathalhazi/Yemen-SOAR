"""
SOAR Pro — API Core (Modular Monolith)
Central service that orchestrates Alert Ingestion, Normalization,
Risk Scoring, Playbook Execution, MITRE Mapping, and Notifications.

Run: uvicorn main:app --host 0.0.0.0 --port 8080
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from database import init_db, get_db
from websocket_manager import ws_manager

# Module routers
from modules.ingestion.router import router as ingestion_router

# ── Logging ──────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, settings.log_level, logging.INFO),
    format='{"ts":"%(asctime)s","level":"%(levelname)s","svc":"api-core","mod":"%(name)s","msg":"%(message)s"}'
)
logger = logging.getLogger(__name__)


# ── Lifespan (startup / shutdown) ────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("API Core starting…")

    # Initialize database (creates tables if not exist)
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.warning(f"Database init skipped (likely already exists): {e}")

    # Start WebSocket Redis subscriber for real-time broadcasting
    ws_manager.start()
    logger.info("WebSocket Redis subscriber started")

    logger.info("API Core ready")
    yield

    # Shutdown
    await ws_manager.stop()
    logger.info("API Core shutting down")


# ── FastAPI App ──────────────────────────────────

app = FastAPI(
    title="SOAR Pro — API Core",
    description=(
        "Modular Monolith core for alert ingestion, normalization, "
        "risk scoring, playbook automation, MITRE mapping, and notifications."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Register Module Routers ─────────────────────

app.include_router(ingestion_router, prefix="/api/v1")


# ── Health Check ─────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "api-core",
        "version": "1.0.0",
        "modules": [
            "ingestion",
            "normalization",
            "risk_engine",
            "playbook_engine",
            "mitre_mapper",
            "notification",
        ],
    }


# ── WebSocket Endpoint ──────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """
    Real-time dashboard WebSocket.
    Clients connect here to receive live events:
    - alert_created
    - incident_created
    - playbook_executed
    - evidence_collected
    - high_risk_alert
    """
    await ws_manager.connect(ws)
    try:
        while True:
            # Keep connection alive — client can send pings
            data = await ws.receive_text()
            if data == "ping":
                await ws.send_json({
                    "type": "system",
                    "action": "pong",
                    "data": {},
                    "timestamp": "",
                })
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


# ── Additional API Endpoints ────────────────────

@app.get("/api/v1/mitre/tactics")
async def mitre_tactics():
    """List all MITRE ATT&CK tactics."""
    from modules.mitre_mapper.mapper import MITREMapper
    mapper = MITREMapper()
    return {"tactics": mapper.get_all_tactics()}


@app.get("/api/v1/mitre/techniques/{tactic_id}")
async def mitre_techniques(tactic_id: str):
    """List techniques under a specific tactic."""
    from modules.mitre_mapper.mapper import MITREMapper
    mapper = MITREMapper()
    return {"tactic": tactic_id, "techniques": mapper.get_techniques_by_tactic(tactic_id)}


@app.get("/api/v1/mitre/technique/{technique_id}")
async def mitre_technique_detail(technique_id: str):
    """Get details for a specific technique."""
    from modules.mitre_mapper.mapper import MITREMapper
    mapper = MITREMapper()
    info = mapper.get_technique_info(technique_id)
    if not info:
        from fastapi import HTTPException
        raise HTTPException(404, "Technique not found")
    return info


@app.get("/api/v1/risk/calculate")
async def risk_calculate_demo(
    severity: str = "high",
    asset_criticality: float = 8,
    threat_confidence: float = 0.9,
):
    """
    Demo endpoint: calculate risk score with given parameters.
    Risk Score = Severity × Asset Criticality × Threat Confidence
    """
    from modules.risk_engine.engine import RiskScoringEngine
    engine = RiskScoringEngine()
    result = engine.calculate(
        severity=severity,
        affected_assets=[{"criticality": asset_criticality}],
        threat_confidence=threat_confidence,
    )
    return result.model_dump()


@app.get("/api/v1/playbooks/builtin")
async def list_builtin_playbooks(db: AsyncSession = Depends(get_db)):
    """List playbook rules directly from the database (previously built-in)."""
    from models import Playbook
    result = await db.execute(select(Playbook).where(Playbook.is_active == True))
    playbooks = result.scalars().all()
    # Serialize to dicts for JSON response
    pb_list = []
    for pb in playbooks:
        pb_list.append({
            "id": str(pb.id),
            "name": pb.name,
            "description": pb.description,
            "category": pb.category,
            "trigger_conditions": pb.trigger_conditions,
            "workflow": pb.workflow,
        })
    return {"playbooks": pb_list}


# ── Entry Point ──────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
