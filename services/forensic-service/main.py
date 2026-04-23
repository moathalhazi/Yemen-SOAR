"""
SOAR Pro — Forensic Service
Lightweight digital forensic evidence collection and integrity verification.

Endpoints:
  POST /api/v1/forensic/collect?incident_id={id}   — Collect evidence
  POST /api/v1/forensic/verify/{incident_id}        — Verify integrity
  GET  /api/v1/forensic/evidence/{incident_id}       — List evidence
  GET  /health                                       — Health check

Architecture (NIST SP 800-86 Aligned):
──────────────────────────────────────
  ┌─────────────┐     ┌────────────────┐     ┌──────────────────┐
  │  Collect     │ ──► │  SHA-256 Hash  │ ──► │  metadata.json   │
  │  (4 types)   │     │  each file     │     │  + hash chain    │
  └─────────────┘     └────────────────┘     └──────────────────┘
       │                                            │
       ▼                                            ▼
  evidence/incident_{id}/                   Chain of Custody Record
    ├── system_info.json                    (who, when, what, hash)
    ├── processes.json
    ├── network_connections.json
    ├── alert_logs.json
    └── metadata.json
"""

import os
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import asyncpg
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from collector import EvidenceCollector
from integrity import (
    save_evidence_file,
    build_metadata,
    verify_evidence,
    compute_file_hash,
)

# ── Configuration ────────────────────────────────

EVIDENCE_DIR = os.getenv("EVIDENCE_DIR", "/app/evidence")
DB_HOST = os.getenv("POSTGRES_HOST", "postgres")
DB_PORT = int(os.getenv("POSTGRES_PORT", "5432"))
DB_NAME = os.getenv("POSTGRES_DB", "soar_db")
DB_USER = os.getenv("POSTGRES_USER", "soar_user")
DB_PASS = os.getenv("POSTGRES_PASSWORD", "")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# ── Logging ──────────────────────────────────────

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format='{"ts":"%(asctime)s","level":"%(levelname)s","svc":"forensic-service","msg":"%(message)s"}'
)
logger = logging.getLogger(__name__)

# ── Globals ──────────────────────────────────────

db_pool: asyncpg.Pool = None
collector = EvidenceCollector()


class ForensicCollectionRequest(BaseModel):
    incident_id: str | None = None
    alert_id: str | None = None
    collected_by: str = "forensic-service"
    metadata: dict | None = None


# ── Lifespan ─────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    global db_pool
    logger.info("Forensic Service starting…")

    # Create evidence root directory
    os.makedirs(EVIDENCE_DIR, exist_ok=True)

    # Database connection pool
    try:
        db_pool = await asyncpg.create_pool(
            host=DB_HOST, port=DB_PORT, database=DB_NAME,
            user=DB_USER, password=DB_PASS,
            min_size=2, max_size=5,
        )
        logger.info("Database pool created")
    except Exception as e:
        logger.warning(f"Database pool creation failed (non-fatal): {e}")

    logger.info("Forensic Service ready")
    yield

    if db_pool:
        await db_pool.close()
    logger.info("Forensic Service stopped")


# ── FastAPI App ──────────────────────────────────

app = FastAPI(
    title="SOAR Pro — Forensic Service",
    description="Lightweight digital forensic evidence collection and integrity verification",
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
# POST /collect — Evidence Collection
# ════════════════════════════════════════════════

@app.post("/api/v1/forensic/collect")
async def collect_evidence(
    request: ForensicCollectionRequest | None = None,
    incident_id: str | None = Query(default=None, description="Incident ID to collect evidence for"),
    alert_id: str | None = Query(default=None, description="Alert ID fallback for alert-scoped collection"),
    collected_by: str = Query(default="forensic-service", description="Collector identifier"),
):
    """
    Collect forensic evidence for an incident.

    Collects 4 types of evidence:
      1. System information (OS, CPU, memory, disk)
      2. Running processes (PID, name, cmd, memory usage)
      3. Network connections (TCP/UDP, local/remote, status)
      4. Alert logs (from PostgreSQL database)

    Each file is SHA-256 hashed and linked in a hash chain.
    Results are stored under evidence/incident_{id}/.
    """

    incident_id = request.incident_id if request and request.incident_id else incident_id
    alert_id = request.alert_id if request and request.alert_id else alert_id
    collected_by = request.collected_by if request and request.collected_by else collected_by
    metadata_payload = request.metadata if request else None

    case_id = incident_id or alert_id
    if not case_id:
        raise HTTPException(400, "incident_id or alert_id is required")

    incident_dir = os.path.join(EVIDENCE_DIR, f"incident_{case_id}")
    os.makedirs(incident_dir, exist_ok=True)

    logger.info(f"Starting evidence collection for case {case_id}")

    evidence_files = []

    # ── 1. System Information ────────────────────
    try:
        sys_info = collector.collect_system_info()
        ef = save_evidence_file(incident_dir, "system_info.json", sys_info)
        evidence_files.append(ef)
    except Exception as e:
        logger.error(f"System info collection failed: {e}")

    # ── 2. Running Processes ─────────────────────
    try:
        processes = collector.collect_processes()
        ef = save_evidence_file(incident_dir, "processes.json", processes)
        evidence_files.append(ef)
    except Exception as e:
        logger.error(f"Process collection failed: {e}")

    # ── 3. Network Connections ───────────────────
    try:
        network = collector.collect_network_connections()
        ef = save_evidence_file(incident_dir, "network_connections.json", network)
        evidence_files.append(ef)
    except Exception as e:
        logger.error(f"Network collection failed: {e}")

    # ── 4. Alert Logs ────────────────────────────
    try:
        if db_pool:
            alert_logs = await collector.collect_alert_logs(case_id, db_pool)
        else:
            alert_logs = {
                "evidence_type": "alert_logs",
                "collected_at": datetime.now(timezone.utc).isoformat(),
                "incident_id": incident_id,
                "alert_id": alert_id,
                "total_alerts": 0,
                "alerts": [],
                "note": "Database unavailable — empty evidence preserved",
            }
        ef = save_evidence_file(incident_dir, "alert_logs.json", alert_logs)
        evidence_files.append(ef)
    except Exception as e:
        logger.error(f"Alert log collection failed: {e}")

    if not evidence_files:
        raise HTTPException(500, "All evidence collection methods failed")

    # ── 5. Build metadata.json (chain of custody) ─
    metadata = build_metadata(
        incident_id=case_id,
        evidence_files=evidence_files,
        collected_by=collected_by,
    )
    if metadata_payload:
        metadata["request_metadata"] = metadata_payload
    meta_path = os.path.join(incident_dir, "metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(
        f"Evidence collection complete: {len(evidence_files)} files | "
        f"chain_hash={metadata['chain_hash'][:16]}…"
    )

    # ── 6. Log custody event in database ─────────
    if db_pool and incident_id:
        try:
            async with db_pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO chain_of_custody (
                        evidence_id, action, actor_name, system,
                        hash_after, integrity_verified, purpose, metadata
                    ) VALUES (
                        (SELECT id FROM evidence WHERE incident_id = $1::uuid LIMIT 1),
                        'collected',
                        $2,
                        'forensic-service',
                        $3,
                        true,
                        'Automated evidence collection triggered by risk threshold',
                        $4::jsonb
                    )
                """, incident_id, collected_by, metadata["chain_hash"],
                json.dumps({"files": [ef["filename"] for ef in evidence_files]}))
        except Exception as e:
            logger.warning(f"Custody DB logging failed (non-fatal): {e}")

    return {
        "status": "success",
        "incident_id": incident_id,
        "alert_id": alert_id,
        "case_id": case_id,
        "evidence_directory": incident_dir,
        "files_collected": len(evidence_files),
        "evidence": [
            {
                "file": ef["filename"],
                "sha256": ef["sha256"],
                "size_bytes": ef["size_bytes"],
            }
            for ef in evidence_files
        ],
        "chain_hash": metadata["chain_hash"],
        "collected_at": metadata["collected_at"],
        "collected_by": collected_by,
    }


# ════════════════════════════════════════════════
# POST /verify — Integrity Verification
# ════════════════════════════════════════════════

@app.post("/api/v1/forensic/verify/{incident_id}")
async def verify_integrity(incident_id: str):
    """
    Verify integrity of all evidence files for an incident.

    Re-hashes every evidence file and compares against the stored
    SHA-256 hashes in metadata.json. Also validates the hash chain
    links (previous_hash → current_hash) and the root chain_hash.

    Returns VERIFIED or TAMPERED status for each file.
    """
    incident_dir = os.path.join(EVIDENCE_DIR, f"incident_{incident_id}")

    if not os.path.exists(incident_dir):
        raise HTTPException(404, f"No evidence found for incident {incident_id}")

    result = verify_evidence(incident_dir)

    logger.info(
        f"Verification for incident {incident_id}: {result['status']} | "
        f"integrity={result['overall_integrity']}"
    )

    return result


# ════════════════════════════════════════════════
# GET /evidence — List Collected Evidence
# ════════════════════════════════════════════════

@app.get("/api/v1/forensic/evidence/{incident_id}")
async def get_evidence(incident_id: str):
    """List all evidence files and metadata for an incident."""
    incident_dir = os.path.join(EVIDENCE_DIR, f"incident_{incident_id}")

    if not os.path.exists(incident_dir):
        raise HTTPException(404, f"No evidence found for incident {incident_id}")

    # Load metadata
    meta_path = os.path.join(incident_dir, "metadata.json")
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            metadata = json.load(f)
    else:
        metadata = {"error": "metadata.json missing"}

    # List files with current hashes
    files = []
    for fname in sorted(os.listdir(incident_dir)):
        if fname == "metadata.json":
            continue
        fpath = os.path.join(incident_dir, fname)
        files.append({
            "filename": fname,
            "size_bytes": os.path.getsize(fpath),
            "current_sha256": compute_file_hash(fpath),
        })

    return {
        "incident_id": incident_id,
        "evidence_directory": incident_dir,
        "metadata": metadata,
        "files": files,
    }


# ════════════════════════════════════════════════
# GET /evidence — List All Incidents with Evidence
# ════════════════════════════════════════════════

@app.get("/api/v1/forensic/evidence")
async def list_all_evidence():
    """List all incidents that have evidence collected."""
    incidents = []
    if os.path.exists(EVIDENCE_DIR):
        for entry in sorted(os.listdir(EVIDENCE_DIR)):
            if entry.startswith("incident_"):
                incident_id = entry.replace("incident_", "")
                incident_dir = os.path.join(EVIDENCE_DIR, entry)
                meta_path = os.path.join(incident_dir, "metadata.json")

                meta = {}
                if os.path.exists(meta_path):
                    with open(meta_path, "r") as f:
                        meta = json.load(f)

                incidents.append({
                    "incident_id": incident_id,
                    "collected_at": meta.get("collected_at"),
                    "evidence_count": meta.get("evidence_count", 0),
                    "chain_hash": meta.get("chain_hash", "")[:16] + "…" if meta.get("chain_hash") else None,
                })

    return {"total_incidents": len(incidents), "incidents": incidents}


# ════════════════════════════════════════════════
# Health Check
# ════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "forensic-service",
        "version": "1.0.0",
        "evidence_directory": EVIDENCE_DIR,
        "database_connected": db_pool is not None,
    }


# ── Entry Point ──────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8005)
