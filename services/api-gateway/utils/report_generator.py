import io
import json
import logging
from datetime import datetime, timedelta
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Image, Table, TableStyle, PageBreak, Flowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import inch

import glob

logger = logging.getLogger(__name__)

# --- Color Theme matching SOAR Pro Dashboard ---
PRIMARY_COLOR = colors.HexColor('#3b82f6')
SECONDARY_COLOR = colors.HexColor('#0f172a')
ACCENT_COLOR = colors.HexColor('#f97316')
BG_LIGHT = colors.HexColor('#f8fafc')
TEXT_DARK = colors.HexColor('#1e293b')
TEXT_MUTED = colors.HexColor('#64748b')

SEVERITY_COLORS = {
    'critical': '#ef4444',
    'high': '#f97316',
    'medium': '#eab308',
    'low': '#22c55e'
}

# --- Fonts Setup ---
FONT_NAME = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'

def reshape_text(text: str) -> str:
    """Pass-through for backward compatibility during refactor."""
    if not text: return ""
    return str(text)


# --- Chart Generators ---

def create_pie_chart(data: dict, title: str) -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(6, 4))
    if not data or sum(data.values()) == 0:
        ax.text(0.5, 0.5, "No Data", ha='center', va='center')
        ax.axis('off')
    else:
        labels = list(data.keys())
        sizes = list(data.values())
        pie_colors = [SEVERITY_COLORS.get(str(l).lower(), '#94a3b8') for l in labels]
        display_labels = [str(l).title() for l in labels]
        
        ax.pie(sizes, labels=display_labels, colors=pie_colors, autopct='%1.1f%%', startangle=140, 
               wedgeprops={'edgecolor': 'white', 'linewidth': 1.5})
    
    ax.set_title(title, pad=20, fontsize=12, fontweight='bold', color='#1e293b')
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150, facecolor='#f8fafc')
    plt.close()
    buf.seek(0)
    return buf

def create_doughnut_chart(data: dict, title: str) -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(6, 4))
    if not data or sum(data.values()) == 0:
        ax.text(0.5, 0.5, "No Data", ha='center', va='center')
        ax.axis('off')
    else:
        labels = list(data.keys())
        sizes = list(data.values())
        
        # Color specific for status
        status_colors = {
            'open': '#ef4444',
            'investigating': '#eab308',
            'resolved': '#3b82f6',
            'closed': '#22c55e'
        }
        pie_colors = [status_colors.get(str(l).lower(), '#94a3b8') for l in labels]
        display_labels = [str(l).title() for l in labels]
        
        ax.pie(sizes, labels=display_labels, colors=pie_colors, autopct='%1.1f%%', startangle=140, 
               wedgeprops={'width': 0.4, 'edgecolor': 'white', 'linewidth': 1.5})
    
    ax.set_title(title, pad=20, fontsize=12, fontweight='bold', color='#1e293b')
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150, facecolor='#f8fafc')
    plt.close()
    buf.seek(0)
    return buf

def create_bar_chart(data: dict, title: str, ylabel: str) -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(8, 4))
    if not data:
        ax.text(0.5, 0.5, "No Data", ha='center', va='center')
        ax.axis('off')
    else:
        labels = [str(l) for l in data.keys()]
        values = list(data.values())
        
        ax.bar(labels, values, color='#3b82f6', edgecolor='none')
        ax.set_ylabel(ylabel, color='#64748b', fontsize=10)
        ax.tick_params(axis='x', rotation=45, colors='#475569', labelsize=9)
        ax.tick_params(axis='y', colors='#475569')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#cbd5e1')
        ax.spines['bottom'].set_color('#cbd5e1')
        ax.grid(axis='y', linestyle='--', alpha=0.5)
        
    ax.set_title(title, pad=20, fontsize=12, fontweight='bold', color='#1e293b')
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150, facecolor='#f8fafc')
    plt.close()
    buf.seek(0)
    return buf

def create_line_chart(dates: list, series_dict: dict, title: str) -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(8, 4))
    if not dates or not series_dict:
        ax.text(0.5, 0.5, "No Data", ha='center', va='center')
        ax.axis('off')
    else:
        colors_list = ['#ef4444', '#f97316', '#3b82f6', '#10b981']
        colors_iter = iter(colors_list)
        
        display_dates = [str(d) for d in dates]
        for label, values in series_dict.items():
            c = next(colors_iter, '#64748b')
            ax.plot(display_dates, values, marker='o', label=str(label), color=c, linewidth=2)
            
        ax.tick_params(axis='x', rotation=45, colors='#475569', labelsize=9)
        ax.tick_params(axis='y', colors='#475569')
        ax.legend(frameon=False, loc='upper center', bbox_to_anchor=(0.5, -0.15), ncol=len(series_dict))
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.grid(axis='y', linestyle='--', alpha=0.5)
        
    ax.set_title(title, pad=20, fontsize=12, fontweight='bold', color='#1e293b')
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150, facecolor='#f8fafc')
    plt.close()
    buf.seek(0)
    return buf

def create_heatmap_chart(matrix: list, x_labels: list, y_labels: list, title: str) -> io.BytesIO:
    fig, ax = plt.subplots(figsize=(8, 4))
    if not matrix or sum(sum(r) for r in matrix) == 0:
        ax.text(0.5, 0.5, "No Data", ha='center', va='center')
        ax.axis('off')
    else:
        im = ax.imshow(matrix, cmap='YlOrRd', aspect='auto')
        
        # We want X to be hours (0-23) and Y to be days
        ax.set_xticks(np.arange(len(x_labels)))
        ax.set_yticks(np.arange(len(y_labels)))
        ax.set_xticklabels([str(x) for x in x_labels], color='#475569', fontsize=8)
        ax.set_yticklabels([str(y) for y in y_labels], color='#475569', fontsize=8)
        
        cbar = ax.figure.colorbar(im, ax=ax)
        cbar.ax.tick_params(colors='#475569')
        
    ax.set_title(title, pad=20, fontsize=12, fontweight='bold', color='#1e293b')
    plt.tight_layout()
    buf = io.BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight', dpi=150, facecolor='#f8fafc')
    plt.close()
    buf.seek(0)
    return buf


# --- Data Aggregation ---

async def gather_report_data(conn, filters: dict) -> dict:
    """Fetch all necessary data from Postgres based on filters."""
    # Build WHERE clauses based on filters
    inc_where = []
    alt_where = []
    params = []
    idx = 1
    
    if filters.get('date_from'):
        inc_where.append(f"created_at >= ${idx}")
        alt_where.append(f"received_at >= ${idx}")
        params.append(filters['date_from'])
        idx += 1
    if filters.get('date_to'):
        inc_where.append(f"created_at <= ${idx}")
        alt_where.append(f"received_at <= ${idx}")
        params.append(filters['date_to'])
        idx += 1
    if filters.get('severity'):
        inc_where.append(f"severity = ${idx}")
        alt_where.append(f"severity = ${idx}")
        params.append(filters['severity'])
        idx += 1
    if filters.get('status'):
        inc_where.append(f"status = ${idx}")
        alt_where.append(f"status = ${idx}")
        params.append(filters['status'])
        idx += 1
    if filters.get('category'):
        inc_where.append(f"category = ${idx}")
        params.append(filters['category'])
        idx += 1
    if filters.get('assigned_to'):
        inc_where.append(f"assigned_to = ${idx}")
        params.append(filters['assigned_to'])
        idx += 1

    inc_where_sql = "WHERE " + " AND ".join(inc_where) if inc_where else ""
    alt_where_sql = "WHERE " + " AND ".join(alt_where) if alt_where else ""

    total_alerts = await conn.fetchval(f"SELECT COUNT(*) FROM alerts {alt_where_sql}", *params) or 0
    total_incidents = await conn.fetchval(f"SELECT COUNT(*) FROM incidents {inc_where_sql}", *params) or 0
    
    cond_op = "AND" if inc_where else "WHERE"
    open_incidents = await conn.fetchval(f"SELECT COUNT(*) FROM incidents {inc_where_sql} {cond_op} status IN ('open', 'investigating')", *params) or 0
    closed_incidents = await conn.fetchval(f"SELECT COUNT(*) FROM incidents {inc_where_sql} {cond_op} status = 'closed'", *params) or 0
    resolved_incidents = await conn.fetchval(f"SELECT COUNT(*) FROM incidents {inc_where_sql} {cond_op} status = 'resolved'", *params) or 0
    
    cond_alt = "AND" if alt_where else "WHERE"
    critical_alerts = await conn.fetchval(f"SELECT COUNT(*) FROM alerts {alt_where_sql} {cond_alt} severity = 'critical'", *params) or 0
    
    total_playbooks = await conn.fetchval("SELECT COUNT(*) FROM playbooks") or 0
    
    totals = {
        "total_alerts": total_alerts,
        "total_incidents": total_incidents,
        "open_incidents": open_incidents,
        "closed_incidents": closed_incidents,
        "resolved_incidents": resolved_incidents,
        "critical_alerts": critical_alerts,
        "total_playbooks": total_playbooks
    }

    # Risk Calculation
    alerts_severity = await conn.fetch(f"SELECT severity, COUNT(*) FROM alerts {alt_where_sql} GROUP BY severity", *params)
    dist_severity = {r['severity'] or 'unknown': r['count'] for r in alerts_severity}
    
    risk_score = 0
    if total_alerts > 0:
        risk_score = round(
            ((dist_severity.get('critical', 0) * 95) +
             (dist_severity.get('high', 0) * 78) +
             (dist_severity.get('medium', 0) * 55) +
             (dist_severity.get('low', 0) * 25)) / total_alerts
        )
    totals['avg_risk'] = risk_score
    
    # Attack Activity (Top Categories)
    attack_categories = await conn.fetch(f"SELECT category, COUNT(*) FROM incidents {inc_where_sql} {'AND' if inc_where else 'WHERE'} category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 5", *params)
    dist_categories = {r['category']: r['count'] for r in attack_categories}
    
    # Incidents Status
    inc_status = await conn.fetch(f"SELECT status, COUNT(*) FROM incidents {inc_where_sql} GROUP BY status", *params)
    dist_inc_status = {r['status'] or 'unknown': r['count'] for r in inc_status}
    
    # Automation Metrics
    total_executions = await conn.fetchval("SELECT COUNT(*) FROM audit_logs WHERE action_type LIKE '%PLAYBOOK%'") or 0
    auto_stats = {
        "playbooks_active": await conn.fetchval("SELECT COUNT(*) FROM playbooks WHERE is_active = true") or 0,
        "total_executions": total_executions,
    }
    
    # Timeline data (last 7 days line chart)
    days = 7
    timeline_alerts = await conn.fetch(f"SELECT received_at::date as date, COUNT(*) FROM alerts {alt_where_sql} {'AND' if alt_where else 'WHERE'} received_at >= NOW() - INTERVAL '{days} days' GROUP BY date ORDER BY date", *params)
    timeline_incidents = await conn.fetch(f"SELECT created_at::date as date, COUNT(*) FROM incidents {inc_where_sql} {'AND' if inc_where else 'WHERE'} created_at >= NOW() - INTERVAL '{days} days' GROUP BY date ORDER BY date", *params)
    
    timeline_dates = [(datetime.now() - timedelta(days=i)).strftime('%m-%d') for i in range(days-1, -1, -1)]
    timeline_data = {
        "dates": timeline_dates,
        "Alerts": [0]*days,
        "Incidents": [0]*days
    }
    
    full_dates = [(datetime.now() - timedelta(days=i)).strftime('%Y-%m-%d') for i in range(days-1, -1, -1)]
    for row in timeline_alerts:
        d_str = row['date'].strftime('%Y-%m-%d')
        if d_str in full_dates:
            timeline_data['Alerts'][full_dates.index(d_str)] = row['count']
            
    for row in timeline_incidents:
        d_str = row['date'].strftime('%Y-%m-%d')
        if d_str in full_dates:
            timeline_data['Incidents'][full_dates.index(d_str)] = row['count']

    # Heatmap Data (Alerts by Day/Hour)
    alerts_raw = await conn.fetch(f"SELECT received_at FROM alerts {alt_where_sql} {'AND' if alt_where else 'WHERE'} received_at >= NOW() - INTERVAL '{days} days'", *params)
    hm_matrix = [[0]*24 for _ in range(days)]
    hm_y_labels = timeline_dates
    hm_x_labels = [f"{h:02d}" for h in range(24)]
    now = datetime.now()
    for row in alerts_raw:
        dt = row['received_at']
        delta_days = (now.date() - dt.date()).days
        if 0 <= delta_days < days:
            idx = days - 1 - delta_days
            hr = dt.hour
            hm_matrix[idx][hr] += 1

    # MTTD and MTTR
    metrics = await conn.fetchrow(f"SELECT AVG(mttd_seconds) as mttd_avg, AVG(mttr_seconds) as mttr_avg FROM incidents {inc_where_sql}", *params)
    mttd_avg = float(metrics['mttd_avg'] or 0) if metrics else 0.0
    mttr_avg = float(metrics['mttr_avg'] or 0) if metrics else 0.0

    # Analyst Activity
    analysts_raw = await conn.fetch(f"""
        SELECT assigned_to, COUNT(*) as count
        FROM incidents 
        {inc_where_sql} {'AND' if inc_where else 'WHERE'} assigned_to IS NOT NULL 
        GROUP BY assigned_to
    """, *params)
    
    users = await conn.fetch("SELECT id, username FROM users")
    user_map = {str(u['id']): u['username'] for u in users}
    dist_analysts = {user_map.get(str(r['assigned_to']), 'Unknown'): r['count'] for r in analysts_raw}

    # Incident Details List
    incidents_list = await conn.fetch(f"""
        SELECT title, severity, status, category, created_at 
        FROM incidents 
        {inc_where_sql} 
        ORDER BY created_at DESC LIMIT 100
    """, *params)
    incidents_data = [dict(r) for r in incidents_list]

    return {
        "totals": totals,
        "dist_severity": dist_severity,
        "dist_categories": dist_categories,
        "dist_inc_status": dist_inc_status,
        "auto_stats": auto_stats,
        "timeline_data": timeline_data,
        "hm": {"matrix": hm_matrix, "x": hm_x_labels, "y": hm_y_labels},
        "mttd_avg": mttd_avg,
        "mttr_avg": mttr_avg,
        "dist_analysts": dist_analysts,
        "incidents_list": incidents_data
    }


# --- PDF Layout Engine ---

class ReportDocTemplate(BaseDocTemplate):
    """Custom Document Template with Footer containing Page Numbers and System Name."""
    def __init__(self, filename, generated_by, **kw):
        super().__init__(filename, **kw)
        self.generated_by = generated_by
        
        frame = Frame(self.leftMargin, self.bottomMargin + 20, self.width, self.height - 20, id='normal')
        
        # Define the Cover Template (No header/footer decoration)
        cover_template = PageTemplate(id='Cover', frames=frame)
        
        # Define the Standard Data Template
        std_template = PageTemplate(id='Standard', frames=frame, onPage=self.footer_stamp)
        
        self.addPageTemplates([cover_template, std_template])
        
    def footer_stamp(self, canvas, doc):
        canvas.saveState()
        canvas.setFont(FONT_NAME, 9)
        canvas.setFillColor(TEXT_MUTED)
        
        footer_y = doc.bottomMargin - 10
        # Left side
        canvas.drawString(doc.leftMargin, footer_y, "Generated by SOAR Platform")
        # Right side
        page_num = f"Page {doc.page}"
        canvas.drawRightString(doc.pagesize[0] - doc.rightMargin, footer_y, page_num)
        
        # Line separator
        canvas.setStrokeColor(colors.HexColor('#e2e8f0'))
        canvas.setLineWidth(1)
        canvas.line(doc.leftMargin, footer_y + 12, doc.pagesize[0] - doc.rightMargin, footer_y + 12)
        
        canvas.restoreState()


class HeaderBox(Flowable):
    """Draws a professional SOAR Pro colored header box shape on the cover page."""
    def __init__(self, width, height):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        self.canv.saveState()
        self.canv.setFillColor(SECONDARY_COLOR)
        # Draw a sleek rect behind the title area
        self.canv.rect(-50, -20, self.width + 100, self.height, fill=1, stroke=0)
        self.canv.restoreState()


async def generate_pdf_report(conn, report_name: str, generated_by_name: str, filters: dict) -> bytes:
    """Generates a professional SOC level PDF report."""
    
    data = await gather_report_data(conn, filters)
    totals = data['totals']
    
    buffer = io.BytesIO()
    doc = ReportDocTemplate(buffer, generated_by_name, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=50)
    
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle('ReportTitle',
                                 fontName=FONT_BOLD,
                                 fontSize=26,
                                 textColor=colors.white,
                                 alignment=0, # Left
                                 spaceAfter=10)
    
    subtitle_style = ParagraphStyle('ReportSub',
                                 fontName=FONT_NAME,
                                 fontSize=14,
                                 textColor=colors.HexColor('#94a3b8'),
                                 alignment=0, # Left
                                 spaceAfter=40)
                                 
    heading1_style = ParagraphStyle('Heading1',
                                    fontName=FONT_BOLD,
                                    fontSize=18,
                                    textColor=PRIMARY_COLOR,
                                    spaceAfter=15,
                                    spaceBefore=25)
                                    
    normal_style = ParagraphStyle('Normal_Arabic',
                                  fontName=FONT_NAME,
                                  fontSize=11,
                                  textColor=TEXT_DARK,
                                  spaceAfter=12,
                                  leading=18)

    elements = []
    
    # --- 1. COVER PAGE ---
    # We overlay the HeaderBox to create a dark top band
    elements.append(HeaderBox(doc.width, 150))
    elements.append(Spacer(1, -110)) # Move cursor back up into the box
    elements.append(Paragraph("SOAR PRO", ParagraphStyle('Logo', fontName=FONT_BOLD, fontSize=32, textColor=PRIMARY_COLOR, spaceAfter=20)))
    elements.append(Paragraph("Security Operations Report", title_style))
    elements.append(Paragraph("Comprehensive Incident Analysis & Operations Review", subtitle_style))
    
    elements.append(Spacer(1, 100))
    
    # Metadata Block on Cover
    meta_data = [
        [Paragraph("<b>Report Details</b>", normal_style), ""],
        ["System Version:", "v2.4.0-Enterprise"],
        ["Date Generated:", datetime.now().strftime("%Y-%m-%d %H:%M Local Time")],
        ["Generated By:", generated_by_name],
        ["Report Scope:", "Global SOC Abstract"],
    ]
    
    meta_table = Table(meta_data, colWidths=[200, 300])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
        ('FONTSIZE', (0,0), (-1,-1), 12),
        ('TEXTCOLOR', (0,0), (-1,-1), TEXT_DARK),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ('LINEBELOW', (0,0), (-1,0), 1, PRIMARY_COLOR), # Header underline
    ]))
    elements.append(meta_table)
    
    # Transition to Standard Page Template
    elements.append(PageBreak())
    from reportlab.platypus import NextPageTemplate
    elements.insert(0, NextPageTemplate('Cover'))
    elements.append(NextPageTemplate('Standard'))
    
    # --- 2. EXECUTIVE SUMMARY ---
    elements.append(Paragraph("Executive Summary", heading1_style))
    exec_summary = f"""
    This document presents an automated operational summary derived from live data metrics. The platform is currently tracking 
    <b>{totals.get('total_alerts', 0)}</b> total security alerts and actively managing <b>{totals.get('total_incidents', 0)}</b> incident cases.
    The enterprise risk score stands at <b>{totals.get('avg_risk', 0)}/100</b>, driven by critical and high-severity threat detections.
    """
    elements.append(Paragraph(exec_summary, normal_style))
    elements.append(Spacer(1, 10))
    
    # Statistics Table
    metrics_data = [
        ["Metric", "Value"],
        ["Total Alerts", str(totals.get('total_alerts', 0))],
        ["Critical Alerts", str(totals.get('critical_alerts', 0))],
        ["Total Incidents", str(totals.get('total_incidents', 0))],
        ["Open Incidents", str(totals.get('open_incidents', 0))],
        ["Automation Executions", str(data['auto_stats'].get('total_executions', 0))],
    ]
    
    m_table = Table(metrics_data, colWidths=[350, 150])
    m_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
        ('FONTSIZE', (0,0), (-1,-1), 11),
        ('BACKGROUND', (0,0), (-1,0), SECONDARY_COLOR),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT])
    ]))
    elements.append(m_table)
    elements.append(Spacer(1, 20))

    # --- 3. SEVERITY & STATUS (Charts) ---
    elements.append(Paragraph("Distribution Analysis", heading1_style))
    
    dist_table_data = []
    
    # Pie Charts
    pie_sev = create_pie_chart(data['dist_severity'], "Alerts by Severity")
    pie_inc = create_doughnut_chart(data['dist_inc_status'], "Incidents by Status")
    
    dist_table_data.append([Image(pie_sev, width=240, height=160), Image(pie_inc, width=240, height=160)])
    
    ctable = Table(dist_table_data, colWidths=[260, 260])
    ctable.setStyle(TableStyle([('ALIGN', (0,0), (-1,-1), 'CENTER'), ('VALIGN', (0,0), (-1,-1), 'MIDDLE')]))
    elements.append(ctable)
    elements.append(Spacer(1, 20))

    # --- 4. ADVANCED CHARTS (Attack Timeline & Categories) ---
    elements.append(PageBreak())
    elements.append(Paragraph("Threat Analytics", heading1_style))
    
    # Line Chart: Alerts & Incidents over last 7 days
    elements.append(Paragraph("7-Day Operational Timeline", normal_style))
    line_buf = create_line_chart(data['timeline_data']['dates'], 
                                 {k: data['timeline_data'][k] for k in ["Alerts", "Incidents"]}, 
                                 "Volume Timeline")
    elements.append(Image(line_buf, width=500, height=250))
    elements.append(Spacer(1, 20))
    
    # Bar Chart: Attack Categories
    if data['dist_categories']:
        elements.append(Paragraph("Top Attack Categories", normal_style))
        bar_buf = create_bar_chart(data['dist_categories'], "Incident Categories", "Volume")
        elements.append(Image(bar_buf, width=500, height=250))
        elements.append(Spacer(1, 20))

    # --- 5. ATTACK HEATMAP ---
    elements.append(PageBreak())
    elements.append(Paragraph("Attack Heatmap", heading1_style))
    elements.append(Paragraph("This heatmap highlights the density of incoming security alerts distributed across hours and operational days.", normal_style))
    
    hm_data = data['hm']
    hm_buf = create_heatmap_chart(hm_data['matrix'], hm_data['x'], hm_data['y'], "Alert Density Heatmap")
    elements.append(Image(hm_buf, width=500, height=250))

    # --- 6. SOC PERFORMANCE METRICS ---
    elements.append(PageBreak())
    elements.append(Paragraph("SOC Performance", heading1_style))
    
    mttd = data.get('mttd_avg', 0)
    mttr = data.get('mttr_avg', 0)
    perf_text = f"""
    Mean Time to Detect (MTTD): <b>{mttd:.1f} seconds</b><br/>
    Mean Time to Respond (MTTR): <b>{mttr:.1f} seconds</b>
    """
    elements.append(Paragraph(perf_text, normal_style))
    elements.append(Spacer(1, 20))
    
    if data.get('dist_analysts'):
        elements.append(Paragraph("Analyst Workload", normal_style))
        analyst_buf = create_bar_chart(data['dist_analysts'], "Incidents per Analyst", "Incidents")
        elements.append(Image(analyst_buf, width=400, height=200))
        elements.append(Spacer(1, 20))

    # --- 7. DETAILED INCIDENT TABLE ---
    elements.append(PageBreak())
    elements.append(Paragraph("Detailed Incidents", heading1_style))
    
    inc_list = data.get('incidents_list', [])
    if inc_list:
        table_data = [[
            "Date",
            "Title",
            "Severity",
            "Status",
            "Category"
        ]]
        for inc in inc_list:
            dt_str = inc['created_at'].strftime("%Y-%m-%d %H:%M") if inc.get('created_at') else "N/A"
            table_title = str(inc.get('title', ''))
            if len(table_title) > 30:
                table_title = table_title[:27] + '...'
            table_data.append([
                dt_str,
                table_title,
                str(inc.get('severity', '')),
                str(inc.get('status', '')),
                str(inc.get('category', ''))
            ])
            
        incident_table = Table(table_data, colWidths=[100, 160, 60, 80, 100], repeatRows=1)
        incident_table.setStyle(TableStyle([
            ('FONTNAME', (0,0), (-1,-1), FONT_NAME),
            ('FONTSIZE', (0,0), (-1,-1), 10),
            ('BACKGROUND', (0,0), (-1,0), SECONDARY_COLOR),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('ALIGN', (0,0), (-1,-1), 'LEFT'),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('PADDING', (0,0), (-1,-1), 6),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, BG_LIGHT])
        ]))
        elements.append(incident_table)
    else:
        elements.append(Paragraph("No incidents found for the selected filters.", normal_style))

    # Build PDF
    doc.build(elements)
    
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
