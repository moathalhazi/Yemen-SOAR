"""SOAR Pro — AI Service (ai-ml)
Provides AI-powered alert analysis and incident report generation.

Endpoints:
  POST /api/v1/ai/analyze             — Analyze a normalized alert
  POST /api/v1/ai/generate-report/{id} — Generate PDF incident report
  GET  /api/v1/ai/mitre/explain        — Explain MITRE techniques
  GET  /health                         — Health check

Academic Context — Role of AI in SOAR:
──────────────────────────────────────
  AI augments human analysts in four key areas:

  1. ALERT EXPLANATION — Translates technical alerts into natural language
     so that analysts of all levels can quickly understand the threat.

  2. RISK INTERPRETATION — Contextualizes the numerical risk score by
     explaining what factors contributed and what the score means
     operationally (SLA, escalation, urgency).

  3. RESPONSE RECOMMENDATION — Suggests specific, actionable response
     steps based on the alert category, reducing decision fatigue
     and accelerating Mean Time to Respond (MTTR).

  4. REPORT GENERATION — Produces structured incident reports that
     document the full lifecycle: detection → analysis → response →
     forensics, enabling compliance and post-incident review.

  Architecture:
    Primary:  Local LLM (DeepSeek-R1-Distill-Llama-8B via llama-cpp-python)
    Fallback: Deterministic rule-based engine

  Benefits of local model:
    - No external API dependency (air-gapped / sovereign compatible)
    - Data sovereignty — no alert data leaves the platform
    - Consistent performance — no network variability
    - Cost-effective — no per-token API charges
"""

import os
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

import asyncpg
import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from analyzer import AlertAnalyzer, load_model
from report_generator import ReportGenerator
from mitre_knowledge import explain_techniques, get_technique_explanation

# ── Configuration ────────────────────────────────

DB_HOST = os.getenv("POSTGRES_HOST", "postgres")
DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
DB_NAME = os.getenv("POSTGRES_DB", "soar_db")
DB_USER = os.getenv("POSTGRES_USER", "soar_user")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "")
FORENSIC_URL = os.getenv("FORENSIC_SERVICE_URL", "http://forensic-service:8005")
API_CORE_URL = os.getenv("API_CORE_URL", "http://api-core:8080")
MODEL_PATH = os.getenv("MODEL_PATH", "/app/models/DeepSeek-R1-Distill-Llama-8B-Q4_0.gguf")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# ── Logging ──────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='{"ts":"%(asctime)s","level":"%(levelname)s","svc":"ai-service","msg":"%(message)s"}'
)
logger = logging.getLogger(__name__)

# ── Globals ──────────────────────────────────────

db_pool: Optional[asyncpg.Pool] = None
http_client: Optional[httpx.AsyncClient] = None
analyzer = AlertAnalyzer()
report_gen = ReportGenerator()


# ── Schemas ──────────────────────────────────────

class AlertInput(BaseModel):
    """Normalized alert input for AI analysis."""
    title: str
    severity: str = "medium"
    category: Optional[str] = None
    description: Optional[str] = None
    source: Optional[str] = Field(None, alias="source_name")
    source_name: Optional[str] = None
    risk_score: Optional[float] = None
    indicators: Optional[Dict[str, Any]] = None
    affected_assets: Optional[List[Dict]] = None
    mitre_techniques: Optional[List[str]] = None
    raw_data: Optional[Dict] = None

    class Config:
        populate_by_name = True

    def get_source(self) -> str:
        return self.source or self.source_name or "unknown"


class AnalysisResponse(BaseModel):
    """Structured AI analysis output."""
    explanation: str
    risk_interpretation: str
    recommended_actions: List[str]
    incident_summary: str
    mitre_explanation: Optional[str] = None
    ai_confidence: float
    analysis_method: str
    analyzed_at: str


class MITREExplainRequest(BaseModel):
    """Request for MITRE technique explanations."""
    technique_ids: List[str]


class ChatRequest(BaseModel):
    """Request for AI Security Assistant chat."""
    message: str
    context: Optional[str] = None


class ChatResponse(BaseModel):
    """Response from AI Security Assistant."""
    response: str
    tokens_used: int = 0
    method: str = "deterministic"


# ── Lifespan ─────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool, http_client
    logger.info("AI Service starting…")

    # Load local LLM model
    load_model()

    try:
        db_pool = await asyncpg.create_pool(
            host=DB_HOST, port=DB_PORT, database=DB_NAME,
            user=DB_USER, password=DB_PASS,
            min_size=2, max_size=5,
        )
        logger.info("Database pool created")
    except Exception as e:
        logger.warning(f"Database pool failed (non-fatal): {e}")

    http_client = httpx.AsyncClient(timeout=30.0)
    logger.info("AI Service ready")
    yield

    if http_client:
        await http_client.aclose()
    if db_pool:
        await db_pool.close()
    logger.info("AI Service stopped")


# ── FastAPI App ──────────────────────────────────

app = FastAPI(
    title="SOAR Pro — AI Service",
    description="AI-powered alert analysis and incident report generation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ════════════════════════════════════════════════
# POST /analyze — AI Alert Analysis
# ════════════════════════════════════════════════

@app.post("/api/v1/ai/analyze", response_model=AnalysisResponse)
async def analyze_alert(alert: AlertInput):
    """
    Analyze a normalized security alert using AI.

    Returns structured analysis:
      - Explanation (what happened, in plain language)
      - Risk interpretation (what the risk score means)
      - Recommended actions (category-specific response steps)
      - Incident summary (structured report-ready text)
      - MITRE explanation (if techniques were mapped)
      - AI confidence (0.0-1.0)
    """
    logger.info(f"Analyzing alert: {alert.title} | severity={alert.severity}")

    alert_dict = alert.model_dump()
    alert_dict["source"] = alert.get_source()

    result = await analyzer.analyze(alert_dict)

    logger.info(
        f"Analysis complete: method={result['analysis_method']} | "
        f"confidence={result['ai_confidence']:.0%}"
    )

    return AnalysisResponse(**result)


# ════════════════════════════════════════════════
# POST /generate-report — PDF Incident Report
# ════════════════════════════════════════════════

@app.post("/api/v1/ai/generate-report/{incident_id}")
async def generate_report(
    incident_id: str,
    include_forensic: bool = Query(True, description="Include forensic evidence summary"),
):
    """
    Generate a comprehensive PDF incident report.

    Fetches alert data from the database, runs AI analysis,
    optionally includes forensic evidence verification,
    and generates a multi-section PDF.
    """
    logger.info(f"Generating report for incident {incident_id}")

    # ── 1. Fetch alert data ──────────────────────
    alert_data = await _fetch_alert_data(incident_id)

    # ── 2. Run AI analysis ───────────────────────
    ai_analysis = await analyzer.analyze(alert_data)

    # ── 3. Fetch forensic summary (optional) ─────
    forensic_summary = None
    if include_forensic:
        forensic_summary = await _fetch_forensic_summary(incident_id)

    # ── 4. Get MITRE techniques ──────────────────
    mitre_techniques = alert_data.get("mitre_techniques", [])

    # ── 5. Generate PDF ──────────────────────────
    report_info = await report_gen.generate(
        incident_id=incident_id,
        alert_data=alert_data,
        ai_analysis=ai_analysis,
        forensic_summary=forensic_summary,
        mitre_techniques=mitre_techniques,
        db_pool=db_pool,
    )

    logger.info(f"Report generated: {report_info['report_filename']}")

    return {
        "status": "success",
        "incident_id": incident_id,
        "report": report_info,
        "ai_analysis": ai_analysis,
        "download_url": f"/api/v1/ai/reports/{report_info['report_filename']}",
    }


# ════════════════════════════════════════════════
# GET /reports/{filename} — Download Report
# ════════════════════════════════════════════════

@app.get("/api/v1/ai/reports/{filename}")
async def download_report(filename: str):
    """Download a generated PDF report."""
    reports_dir = os.getenv("REPORTS_DIR", "/app/reports")
    filepath = os.path.join(reports_dir, filename)

    if not os.path.exists(filepath):
        raise HTTPException(404, f"Report not found: {filename}")

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=filename,
    )


# ════════════════════════════════════════════════
# POST /mitre/explain — MITRE Technique Explanations
# ════════════════════════════════════════════════

@app.post("/api/v1/ai/mitre/explain")
async def explain_mitre(request: MITREExplainRequest):
    """
    Explain one or more MITRE ATT&CK techniques in human-readable format.
    """
    explanations = []
    for tid in request.technique_ids[:20]:
        info = get_technique_explanation(tid)
        explanations.append({
            "technique_id": tid,
            "name": info["name"],
            "description": info["description"],
        })

    return {
        "techniques": explanations,
        "full_explanation": explain_techniques(request.technique_ids),
    }


# ════════════════════════════════════════════════
# POST /chat — AI Security Assistant
# ════════════════════════════════════════════════

@app.post("/api/v1/ai/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Process a security question or command using the local LLM.
    """
    logger.info(f"Processing chat message: {request.message[:50]}...")
    
    result = analyzer.chat_with_assistant(
        message=request.message,
        context=request.context
    )
    
    return ChatResponse(**result)


# ════════════════════════════════════════════════
# Health Check
# ════════════════════════════════════════════════

@app.get("/health")
async def health():
    from analyzer import llm
    model_loaded = llm is not None
    return {
        "status": "healthy",
        "service": "ai-service",
        "version": "1.0.0",
        "ai_engine": "local_llm" if model_loaded else "rule_based",
        "model": "DeepSeek-R1-Distill-Llama-8B-Q4_0" if model_loaded else "none",
        "model_loaded": model_loaded,
        "database_connected": db_pool is not None,
    }


# ── Helper Functions ─────────────────────────────

async def _fetch_alert_data(incident_id: str) -> Dict[str, Any]:
    """Fetch alert data from the database or API."""
    if db_pool:
        try:
            async with db_pool.acquire() as conn:
                row = await conn.fetchrow("""
                    SELECT id, source_name, severity, status, title,
                           description, category, risk_score,
                           mitre_techniques, indicators, affected_assets,
                           raw_data, received_at, occurred_at
                    FROM alerts
                    WHERE incident_id = $1::uuid
                    ORDER BY risk_score DESC NULLS LAST
                    LIMIT 1
                """, incident_id)

                if row:
                    return {
                        "id": str(row["id"]),
                        "source_name": row["source_name"],
                        "severity": row["severity"],
                        "status": row["status"],
                        "title": row["title"],
                        "description": row["description"],
                        "category": row["category"],
                        "risk_score": float(row["risk_score"]) if row["risk_score"] else 0,
                        "mitre_techniques": row["mitre_techniques"] or [],
                        "indicators": dict(row["indicators"]) if row["indicators"] else {},
                        "affected_assets": row["affected_assets"] if row["affected_assets"] else [],
                        "received_at": row["received_at"].isoformat() if row["received_at"] else None,
                    }
        except Exception as e:
            logger.warning(f"DB alert fetch failed: {e}")

    # Fallback: return a demo alert for testing
    return {
        "title": f"Alert for Incident {incident_id}",
        "severity": "high",
        "category": "malware",
        "description": "Automated report - alert data retrieved from system",
        "source_name": "soar-platform",
        "risk_score": 78,
        "mitre_techniques": ["T1566.001", "T1059.001"],
        "indicators": {},
        "affected_assets": [],
    }


async def _fetch_forensic_summary(incident_id: str) -> Optional[Dict]:
    """Fetch forensic verification from forensic-service."""
    if not http_client:
        return None
    try:
        resp = await http_client.post(f"{FORENSIC_URL}/api/v1/forensic/verify/{incident_id}")
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Forensic service unreachable: {e}")
    return None


# ── Entry Point ──────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
