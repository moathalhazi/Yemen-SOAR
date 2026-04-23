import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List
from utils.db import get_db

logger = logging.getLogger(__name__)

async def get_time_heatmap_logic(days: int) -> Dict[str, Any]:
    async with get_db().acquire() as conn:
        alerts = await conn.fetch(f"SELECT received_at, severity FROM alerts WHERE received_at >= NOW() - INTERVAL '{days} days'")
        incidents = await conn.fetch(f"SELECT created_at, severity FROM incidents WHERE created_at >= NOW() - INTERVAL '{days} days'")
    
    matrix_alerts = [[0 for _ in range(24)] for _ in range(days)]
    matrix_incidents = [[0 for _ in range(24)] for _ in range(days)]
    sev_matrix = {
        'critical': [[0]*24 for _ in range(days)],
        'high': [[0]*24 for _ in range(days)],
        'medium': [[0]*24 for _ in range(days)],
        'low': [[0]*24 for _ in range(days)]
    }
    
    now = datetime.utcnow()
    day_labels = []
    # Build day_labels so the last one is Today.
    for d in range(days-1, -1, -1):
        dt = now - timedelta(days=d)
        day_labels.append(dt.strftime("%a"))
        
    for a in alerts:
        dt = a['received_at']
        delta_days = (now.date() - dt.date()).days
        if 0 <= delta_days < days:
            idx = days - 1 - delta_days
            hr = dt.hour
            matrix_alerts[idx][hr] += 1
            if a['severity']:
                sev = a['severity'].lower()
                if sev in sev_matrix:
                    sev_matrix[sev][idx][hr] += 1
                
    for i in incidents:
        dt = i['created_at']
        delta_days = (now.date() - dt.date()).days
        if 0 <= delta_days < days:
            idx = days - 1 - delta_days
            hr = dt.hour
            matrix_incidents[idx][hr] += 1

    max_alerts = max([max(row) for row in matrix_alerts]) if matrix_alerts else 0
    max_incidents = max([max(row) for row in matrix_incidents]) if matrix_incidents else 0
    
    return {
        "period_days": days,
        "days": day_labels,
        "hours": list(range(24)),
        "alerts": {
            "matrix": matrix_alerts,
            "max_value": max_alerts,
            "total": len(alerts)
        },
        "incidents": {
            "matrix": matrix_incidents,
            "max_value": max_incidents,
            "total": len(incidents)
        },
        "severity_breakdown": {
            s: {
                "matrix": sev_matrix[s],
                "max_value": max([max(row) for row in sev_matrix[s]]) if sev_matrix[s] else 0
            } for s in sev_matrix
        }
    }

async def get_classification_heatmap_logic(days: int) -> Dict[str, Any]:
    async with get_db().acquire() as conn:
        incidents = await conn.fetch(f"SELECT category as name, severity FROM incidents WHERE created_at >= NOW() - INTERVAL '{days} days'")
        
    classifications = {}
    for i in incidents:
        name = i['name'] or 'Unknown'
        sev = (i['severity'] or 'low').lower()
        
        risk_map = {'critical': 95, 'high': 75, 'medium': 50, 'low': 25}
        calculated_risk = risk_map.get(sev, 25)
        
        if name not in classifications:
            classifications[name] = {"total": 0, "by_severity": {"critical":0, "high":0, "medium":0, "low":0}, "avg_confidence": 0, "avg_priority": 0, "risk_sum": 0.0}
        
        classifications[name]["total"] += 1
        if sev in classifications[name]["by_severity"]:
            classifications[name]["by_severity"][sev] += 1
        classifications[name]["risk_sum"] += calculated_risk
        
    top_threats = []
    for k, v in classifications.items():
        avg_risk = v["risk_sum"] / v["total"]
        top_threats.append({
            "name": k,
            "total": v["total"],
            "by_severity": v["by_severity"],
            "avg_confidence": min(1.0, avg_risk / 100.0)
        })
    
    top_threats.sort(key=lambda x: x["total"], reverse=True)
        
    return {
        "period_days": days,
        "classifications": classifications,
        "top_threats": top_threats
    }

async def get_source_heatmap_logic(days: int) -> Dict[str, Any]:
    async with get_db().acquire() as conn:
        alerts = await conn.fetch(f"SELECT source_name, severity FROM alerts WHERE received_at >= NOW() - INTERVAL '{days} days'")
        
    sources = {}
    for a in alerts:
        src = a['source_name'] or 'Unknown'
        sev = (a['severity'] or 'low').lower()
        if src not in sources:
            sources[src] = {"critical":0, "high":0, "medium":0, "low":0}
        if sev in sources[src]:
            sources[src][sev] += 1
            
    matrix = []
    severities = ['critical', 'high', 'medium', 'low']
    for src, vals in sources.items():
        arr = [vals[s] for s in severities]
        matrix.append({
            "source": src,
            "values": arr,
            "total": sum(arr)
        })
        
    matrix.sort(key=lambda x: x["total"], reverse=True)
    
    return {
        "period_days": days,
        "sources": [m["source"] for m in matrix],
        "severities": severities,
        "matrix": matrix
    }
    
async def get_daily_heatmap_logic(days: int) -> Dict[str, Any]:
    return {"period_days": days, "alerts": {}, "incidents": {}, "summary": { "total_alerts":0, "total_incidents":0, "peak_alerts_date": None, "peak_incidents_date": None}}

async def get_geo_heatmap_logic(days: int) -> Dict[str, Any]:
    return {"period_days": days, "locations": []}
