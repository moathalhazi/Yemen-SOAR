"""
SOAR Pro — Forensic Evidence Collector
Collects live system telemetry as digital evidence:
  - System information
  - Running processes
  - Active network connections
  - Alert logs from the database

All evidence is stored as JSON files with SHA-256 integrity hashes.
Follows NIST SP 800-86 principles for digital forensic evidence handling.
"""

import os
import json
import socket
import platform
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

import psutil
import asyncpg

logger = logging.getLogger(__name__)


class EvidenceCollector:
    """
    Collects four categories of forensic evidence from the live system.
    Each collection method returns a structured dict that will be
    serialized to a JSON evidence file.
    """

    # ════════════════════════════════════════════
    # 1. System Information
    # ════════════════════════════════════════════

    @staticmethod
    def collect_system_info() -> Dict[str, Any]:
        """
        Collect system-level information: OS, hardware, hostname, boot time.
        Equivalent to running 'systeminfo' or 'uname -a'.
        """
        boot_time = datetime.fromtimestamp(psutil.boot_time(), tz=timezone.utc)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        cpu_freq = psutil.cpu_freq()

        return {
            "evidence_type": "system_information",
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "hostname": socket.gethostname(),
            "fqdn": socket.getfqdn(),
            "platform": {
                "system": platform.system(),
                "release": platform.release(),
                "version": platform.version(),
                "machine": platform.machine(),
                "processor": platform.processor(),
                "architecture": platform.architecture()[0],
                "python_version": platform.python_version(),
            },
            "boot_time": boot_time.isoformat(),
            "uptime_seconds": int((datetime.now(timezone.utc) - boot_time).total_seconds()),
            "cpu": {
                "physical_cores": psutil.cpu_count(logical=False),
                "logical_cores": psutil.cpu_count(logical=True),
                "frequency_mhz": cpu_freq.current if cpu_freq else None,
                "usage_percent": psutil.cpu_percent(interval=0.5),
            },
            "memory": {
                "total_bytes": mem.total,
                "available_bytes": mem.available,
                "used_bytes": mem.used,
                "percent_used": mem.percent,
            },
            "disk": {
                "total_bytes": disk.total,
                "used_bytes": disk.used,
                "free_bytes": disk.free,
                "percent_used": disk.percent,
            },
            "network_interfaces": _get_network_interfaces(),
        }

    # ════════════════════════════════════════════
    # 2. Running Processes
    # ════════════════════════════════════════════

    @staticmethod
    def collect_processes() -> Dict[str, Any]:
        """
        Capture a snapshot of all running processes.
        Records PID, name, user, CPU%, memory%, command-line, and creation time.
        """
        processes = []
        for proc in psutil.process_iter(
            ["pid", "name", "username", "cpu_percent", "memory_percent",
             "status", "create_time", "cmdline", "ppid"]
        ):
            try:
                info = proc.info
                create_time = datetime.fromtimestamp(
                    info["create_time"], tz=timezone.utc
                ).isoformat() if info.get("create_time") else None

                processes.append({
                    "pid": info["pid"],
                    "ppid": info.get("ppid"),
                    "name": info["name"],
                    "username": info.get("username"),
                    "status": info.get("status"),
                    "cpu_percent": info.get("cpu_percent", 0),
                    "memory_percent": round(info.get("memory_percent", 0), 2),
                    "cmdline": " ".join(info.get("cmdline") or []),
                    "create_time": create_time,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        # Sort by memory usage (highest first) for investigator convenience
        processes.sort(key=lambda p: p.get("memory_percent", 0), reverse=True)

        return {
            "evidence_type": "running_processes",
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "hostname": socket.gethostname(),
            "total_processes": len(processes),
            "processes": processes,
        }

    # ════════════════════════════════════════════
    # 3. Network Connections
    # ════════════════════════════════════════════

    @staticmethod
    def collect_network_connections() -> Dict[str, Any]:
        """
        Capture all active network connections (TCP/UDP).
        Critical for identifying C2 callbacks, lateral movement, and data exfiltration.
        """
        connections = []
        for conn in psutil.net_connections(kind="all"):
            try:
                connections.append({
                    "fd": conn.fd,
                    "family": str(conn.family),
                    "type": str(conn.type),
                    "local_address": f"{conn.laddr.ip}:{conn.laddr.port}" if conn.laddr else None,
                    "remote_address": f"{conn.raddr.ip}:{conn.raddr.port}" if conn.raddr else None,
                    "status": conn.status,
                    "pid": conn.pid,
                })
            except (AttributeError, TypeError):
                continue

        # Separate established from listening for quick triage
        established = [c for c in connections if c["status"] == "ESTABLISHED"]
        listening = [c for c in connections if c["status"] == "LISTEN"]

        return {
            "evidence_type": "network_connections",
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "hostname": socket.gethostname(),
            "total_connections": len(connections),
            "established_count": len(established),
            "listening_count": len(listening),
            "connections": connections,
        }

    # ════════════════════════════════════════════
    # 4. Alert Logs from Database
    # ════════════════════════════════════════════

    @staticmethod
    async def collect_alert_logs(
        incident_id: str, db_pool: asyncpg.Pool
    ) -> Dict[str, Any]:
        """
        Pull all alerts associated with the given incident from the database.
        This preserves the original alert data as evidence.
        """
        alerts = []

        try:
            async with db_pool.acquire() as conn:
                # Get alerts linked to this incident
                rows = await conn.fetch("""
                    SELECT id, source_name, severity, status, title,
                           description, risk_score, mitre_techniques,
                           indicators, affected_assets, raw_data,
                           received_at, occurred_at, created_at
                    FROM alerts
                    WHERE incident_id = $1::uuid
                    ORDER BY received_at DESC
                """, incident_id)

                for row in rows:
                    alerts.append({
                        "id": str(row["id"]),
                        "source_name": row["source_name"],
                        "severity": row["severity"],
                        "status": row["status"],
                        "title": row["title"],
                        "description": row["description"],
                        "risk_score": float(row["risk_score"]) if row["risk_score"] else None,
                        "mitre_techniques": row["mitre_techniques"],
                        "indicators": dict(row["indicators"]) if row["indicators"] else None,
                        "affected_assets": dict(row["affected_assets"]) if row["affected_assets"] else None,
                        "raw_data": dict(row["raw_data"]) if row["raw_data"] else None,
                        "received_at": row["received_at"].isoformat() if row["received_at"] else None,
                        "occurred_at": row["occurred_at"].isoformat() if row["occurred_at"] else None,
                    })

                # If no alerts linked via incident_id, try getting recent critical alerts
                if not alerts:
                    rows = await conn.fetch("""
                        SELECT id, source_name, severity, status, title,
                               description, risk_score, received_at, occurred_at
                        FROM alerts
                        WHERE severity IN ('high', 'critical')
                        ORDER BY received_at DESC
                        LIMIT 50
                    """)
                    for row in rows:
                        alerts.append({
                            "id": str(row["id"]),
                            "source_name": row["source_name"],
                            "severity": row["severity"],
                            "status": row["status"],
                            "title": row["title"],
                            "description": row["description"],
                            "risk_score": float(row["risk_score"]) if row["risk_score"] else None,
                            "received_at": row["received_at"].isoformat() if row["received_at"] else None,
                        })

        except Exception as e:
            logger.error(f"Failed to collect alert logs: {e}")
            alerts = [{"error": str(e), "note": "Database query failed — empty evidence preserved"}]

        return {
            "evidence_type": "alert_logs",
            "collected_at": datetime.now(timezone.utc).isoformat(),
            "incident_id": incident_id,
            "total_alerts": len(alerts),
            "alerts": alerts,
        }


# ── Helper ─────────────────────────────────────

def _get_network_interfaces() -> List[Dict]:
    """Get all network interface addresses."""
    interfaces = []
    for name, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family == socket.AF_INET:
                interfaces.append({
                    "name": name,
                    "ip": addr.address,
                    "netmask": addr.netmask,
                    "broadcast": addr.broadcast,
                })
    return interfaces
