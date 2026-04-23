import csv
from datetime import datetime
import io
import json
import logging
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response

from dependencies import require_permission, TokenData
from models import *
from utils.db import get_db
from utils.report_generator import gather_report_data, generate_pdf_report
from utils.serializers import serialize_row, serialize_rows

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/api/v1/reports/generate", response_model=Report)
async def generate_report(
    request: ReportGenerateRequest,
    current_user: TokenData = Depends(require_permission("reports.generate"))
):
    async with get_db().acquire() as conn:
        report_id = await conn.fetchval("SELECT uuid_generate_v4()")
        name = f"Security Report - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"

        await conn.execute("""
            INSERT INTO reports (id, name, type, format, created_by, status, filters)
            VALUES ($1, $2, $3, $4, $5, 'completed', $6)
        """, report_id, name, 'executive', request.format, current_user.user_id,
           json.dumps({
               "date_from": request.date_from,
               "date_to": request.date_to,
               "severity": request.severity,
               "status": request.status,
               "category": request.category,
               "assigned_to": request.assigned_to,
               "include_alerts": request.include_alerts,
               "include_incidents": request.include_incidents,
               "include_audit_logs": request.include_audit_logs,
           }))

        row = await conn.fetchrow("SELECT * FROM reports WHERE id = $1", report_id)
        return serialize_row(row)


@router.get("/api/v1/reports")
async def list_reports(
    page: int = 1,
    page_size: int = 20,
    date_from: Optional[str] = None,
    current_user: TokenData = Depends(require_permission("reports.read"))
):
    async with get_db().acquire() as conn:
        where_clauses = []
        params = []
        param_idx = 1

        if date_from:
            where_clauses.append(f"generated_at >= ${param_idx}")
            params.append(datetime.fromisoformat(date_from.replace('Z', '+00:00')))
            param_idx += 1

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        total = await conn.fetchval(f"SELECT COUNT(*) FROM reports {where_sql}", *params)

        offset = (page - 1) * page_size
        query = f"""
            SELECT * FROM reports
            {where_sql}
            ORDER BY generated_at DESC
            LIMIT ${param_idx} OFFSET ${param_idx + 1}
        """
        params.extend([page_size, offset])
        rows = await conn.fetch(query, *params)

        return {
            "items": serialize_rows(rows),
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }


@router.get("/api/v1/reports/{id}")
async def get_report(id: str, current_user: TokenData = Depends(require_permission("reports.read"))):
    async with get_db().acquire() as conn:
        try:
            val = UUID(id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Report ID format")

        row = await conn.fetchrow("SELECT * FROM reports WHERE id = $1", val)
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")

        return serialize_row(row)


@router.delete("/api/v1/reports/{id}")
async def delete_report(id: str, current_user: TokenData = Depends(require_permission("reports.generate"))):
    async with get_db().acquire() as conn:
        result = await conn.execute("DELETE FROM reports WHERE id = $1", UUID(id))
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Report not found")
    return {"message": "Report deleted"}


@router.get("/api/v1/reports/{id}/download")
async def download_report(id: str, current_user: TokenData = Depends(require_permission("reports.export"))):
    async with get_db().acquire() as conn:
        report = await conn.fetchrow("SELECT * FROM reports WHERE id = $1", UUID(id))
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        report_format = report["format"]
        filters = json.loads(report["filters"]) if report["filters"] else {}
        report_name = report["name"]

        user_info = await conn.fetchrow("SELECT username FROM users WHERE id = $1", report["created_by"])
        username = user_info["username"] if user_info else str(report["created_by"])

        if report_format == 'html':
            data = await gather_report_data(conn, filters)
            html_rows = "".join([
                f"<tr><td>{item.get('created_at', '')}</td><td>{item.get('title', '')}</td><td>{item.get('severity', '')}</td><td>{item.get('status', '')}</td><td>{item.get('category', '')}</td></tr>"
                for item in data.get("incidents_list", [])
            ])
            content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>{report_name}</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 40px; color: #1e293b; direction: rtl; text-align: right; }}
                    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
                    th, td {{ border: 1px solid #e2e8f0; padding: 12px; }}
                    th {{ background-color: #f8fafc; color: #475569; }}
                    .header {{ border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 30px; }}
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>{report_name}</h1>
                    <p><strong>تاريخ الإنشاء:</strong> {report['generated_at']}</p>
                    <p><strong>بواسطة:</strong> {username}</p>
                </div>
                <h2>تفاصيل الحوادث</h2>
                <table>
                    <thead>
                        <tr>
                            <th>التاريخ</th>
                            <th>العنوان</th>
                            <th>الخطورة</th>
                            <th>الحالة</th>
                            <th>التصنيف</th>
                        </tr>
                    </thead>
                    <tbody>
                        {html_rows if html_rows else "<tr><td colspan='5'>لا توجد حوادث</td></tr>"}
                    </tbody>
                </table>
            </body>
            </html>
            """
            return Response(content=content, media_type="text/html", headers={
                "Content-Disposition": f"attachment; filename={report_name}.html"
            })

        if report_format == 'csv':
            data = await gather_report_data(conn, filters)
            output = io.StringIO()
            writer = csv.writer(output)
            output.write('\ufeff')
            writer.writerow(['التاريخ', 'العنوان', 'الخطورة', 'الحالة', 'التصنيف'])

            for incident in data.get('incidents_list', []):
                dt_str = incident['created_at'].strftime("%Y-%m-%d %H:%M") if incident.get('created_at') else "N/A"
                writer.writerow([
                    dt_str,
                    incident.get('title', ''),
                    incident.get('severity', ''),
                    incident.get('status', ''),
                    incident.get('category', '')
                ])

            return Response(content=output.getvalue(), media_type="text/csv", headers={
                "Content-Disposition": f"attachment; filename={report_name}.csv"
            })

        if report_format == 'pdf':
            try:
                pdf_bytes = await generate_pdf_report(conn, report_name, username, filters)
                return Response(content=pdf_bytes, media_type="application/pdf", headers={
                    "Content-Disposition": f"attachment; filename={report_name}.pdf"
                })
            except Exception as exc:
                logger.error(f"Error generating PDF: {exc}")
                raise HTTPException(status_code=500, detail="Failed to generate PDF report")

        if report_format == 'json':
            data = await gather_report_data(conn, filters)
            json_content = json.dumps(data, indent=2, default=lambda obj: obj.isoformat() if isinstance(obj, datetime) else str(obj))
            return Response(content=json_content, media_type="application/json", headers={
                "Content-Disposition": f"attachment; filename={report_name}.json"
            })

        return Response(
            content=f"Report: {report_name}",
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename={report_name}.txt"},
        )


@router.post("/api/v1/reports/analytics", response_model=ReportAnalyticsResponse)
async def get_report_analytics(
    request: ReportGenerateRequest,
    current_user: TokenData = Depends(require_permission("reports.read"))
):
    async with get_db().acquire() as conn:
        filters = request.model_dump()
        data = await gather_report_data(conn, filters)

        metrics = await conn.fetchrow("""
            SELECT AVG(mttd_seconds) as mttd_avg, AVG(mttr_seconds) as mttr_avg
            FROM incidents WHERE mttd_seconds IS NOT NULL
        """)

        timeline = data.get("timeline_data", {})
        trend = []
        dates = timeline.get("dates", [])
        alerts = timeline.get("Alerts (إنذارات)", [])
        incidents = timeline.get("Incidents (حوادث)", [])
        for index, current_date in enumerate(dates):
            trend.append({
                "date": current_date,
                "alerts": alerts[index] if index < len(alerts) else 0,
                "incidents": incidents[index] if index < len(incidents) else 0,
            })

        return {
            "mttd_avg": float(metrics["mttd_avg"] or 0) if metrics else 0,
            "mttr_avg": float(metrics["mttr_avg"] or 0) if metrics else 0,
            "incidents_trend": trend,
            "severity_distribution": data.get("dist_severity", {}),
        }


@router.get("/api/v1/reports/executive-summary")
async def get_executive_summary(
    current_user: TokenData = Depends(require_permission("reports.read"))
):
    async with get_db().acquire() as conn:
        data = await gather_report_data(conn, {})
        totals = data.get("totals", {})

        return {
            "total_incidents": totals.get("total_incidents", 0),
            "response_performance": f"Risk Score: {totals.get('avg_risk', 0)}/100",
            "top_attack_types": data.get("dist_categories", {}),
            "security_posture_metrics": {
                "critical_alerts": totals.get("critical_alerts", 0),
                "open_incidents": totals.get("open_incidents", 0),
                "active_playbooks": data.get("auto_stats", {}).get("playbooks_active", 0),
            }
        }


@router.post("/api/v1/reports/schedules", response_model=ReportSchedule)
async def create_schedule(
    schedule: ReportScheduleCreate,
    current_user: TokenData = Depends(require_permission("reports.generate"))
):
    async with get_db().acquire() as conn:
        schedule_id = await conn.fetchval("SELECT uuid_generate_v4()")
        next_run_at = datetime.utcnow()

        await conn.execute("""
            INSERT INTO report_schedules
            (id, name, description, schedule_type, format, filters, created_by, is_active, next_run_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
        """, schedule_id, schedule.name, schedule.description, schedule.schedule_type,
             schedule.format, json.dumps(schedule.filters), current_user.user_id,
             schedule.is_active, next_run_at)

        row = await conn.fetchrow("SELECT * FROM report_schedules WHERE id = $1", schedule_id)
        item = serialize_row(row)
        if isinstance(item.get("filters"), str):
            item["filters"] = json.loads(item["filters"])
        return item


@router.get("/api/v1/reports/schedules")
async def list_schedules(current_user: TokenData = Depends(require_permission("reports.read"))):
    async with get_db().acquire() as conn:
        rows = await conn.fetch("SELECT * FROM report_schedules ORDER BY created_at DESC")
        items = serialize_rows(rows)
        for item in items:
            if isinstance(item.get("filters"), str):
                item["filters"] = json.loads(item["filters"])
        return items


@router.delete("/api/v1/reports/schedules/{id}")
async def delete_schedule(id: str, current_user: TokenData = Depends(require_permission("reports.generate"))):
    async with get_db().acquire() as conn:
        result = await conn.execute("DELETE FROM report_schedules WHERE id = $1", UUID(id))
        if result == "DELETE 0":
            raise HTTPException(status_code=404, detail="Schedule not found")
    return {"message": "Schedule deleted"}
