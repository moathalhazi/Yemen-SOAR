import asyncio
import logging
from datetime import datetime, timedelta
import json
import uuid

from utils.db import get_db

logger = logging.getLogger(__name__)

async def _generate_scheduled_report(conn, schedule):
    # Generates a report entry based on the schedule
    report_id = await conn.fetchval("SELECT uuid_generate_v4()")
    name = f"{schedule['name']} - {datetime.utcnow().strftime('%Y-%m-%d')}"
    
    await conn.execute("""
        INSERT INTO reports (id, name, type, format, created_by, status, filters)
        VALUES ($1, $2, $3, $4, $5, 'completed', $6)
    """, report_id, name, 'scheduled', schedule['format'], schedule['created_by'], schedule['filters'])
    
    # Calculate next run time
    now = datetime.utcnow()
    next_run = now
    if schedule['schedule_type'] == 'daily':
        next_run = now + timedelta(days=1)
    elif schedule['schedule_type'] == 'weekly':
        next_run = now + timedelta(weeks=1)
    elif schedule['schedule_type'] == 'monthly':
        next_run = now + timedelta(days=30)
    else:
        next_run = now + timedelta(days=1)
        
    await conn.execute("""
        UPDATE report_schedules 
        SET last_run_at = $1, next_run_at = $2, updated_at = $1
        WHERE id = $3
    """, now, next_run, schedule['id'])

async def run_scheduler():
    logger.info("Report Scheduler started.")
    while True:
        try:
            pool = get_db()
            if pool:
                async with pool.acquire() as conn:
                    now = datetime.utcnow()
                    rows = await conn.fetch("""
                        SELECT * FROM report_schedules 
                        WHERE is_active = TRUE AND next_run_at <= $1
                    """, now)
                    
                    for row in rows:
                        logger.info(f"Running scheduled report: {row['name']}")
                        await _generate_scheduled_report(conn, dict(row))
                        
        except asyncio.CancelledError:
            logger.info("Scheduler task cancelled.")
            break
        except Exception as e:
            logger.error(f"Scheduler error: {e}")
            
        await asyncio.sleep(60) # Check every minute
