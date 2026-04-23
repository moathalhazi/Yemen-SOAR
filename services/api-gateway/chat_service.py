"""
AI Chat Service for SOAR Pro
Handles AI chat integration with rate limiting and context awareness
"""

import os
import logging
import httpx
from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Configuration
AI_ML_URL = os.getenv("AI_ML_URL", "http://ai-ml:8003")
CHAT_API_URL = f"{AI_ML_URL}/api/v1/ai/chat"

# Rate limiting config (per user)
RATE_LIMIT_REQUESTS_PER_MINUTE = 15
RATE_LIMIT_REQUESTS_PER_HOUR = 200


class ChatRequest(BaseModel):
    """Request model for chat messages"""
    message: str
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    """Response model for chat messages"""
    response: str
    tokens_used: int = 0


# System prompt logic is now handled entirely within the ai-ml service.
# We just pass the context and message forward.


async def check_rate_limit(redis_client, user_id: str) -> bool:
    """
    Check if user has exceeded rate limits
    Returns True if within limits, False if exceeded
    """
    if not redis_client:
        return True  # Skip rate limiting if Redis is unavailable
    
    try:
        minute_key = f"chat_rate:{user_id}:minute"
        hour_key = f"chat_rate:{user_id}:hour"
        
        # Check minute limit
        minute_count = await redis_client.get(minute_key)
        if minute_count and int(minute_count) >= RATE_LIMIT_REQUESTS_PER_MINUTE:
            return False
        
        # Check hour limit
        hour_count = await redis_client.get(hour_key)
        if hour_count and int(hour_count) >= RATE_LIMIT_REQUESTS_PER_HOUR:
            return False
        
        return True
    except Exception as e:
        logger.error(f"Rate limit check failed: {e}")
        return True  # Allow on error


async def increment_rate_limit(redis_client, user_id: str):
    """Increment rate limit counters"""
    if not redis_client:
        return
    
    try:
        minute_key = f"chat_rate:{user_id}:minute"
        hour_key = f"chat_rate:{user_id}:hour"
        
        # Increment minute counter (expires in 60 seconds)
        pipe = redis_client.pipeline()
        await pipe.incr(minute_key)
        await pipe.expire(minute_key, 60)
        await pipe.incr(hour_key)
        await pipe.expire(hour_key, 3600)
        await pipe.execute()
    except Exception as e:
        logger.error(f"Rate limit increment failed: {e}")


async def get_alert_context(db_pool, alert_id: str) -> Optional[Dict]:
    """Fetch alert details for context"""
    if not db_pool or not alert_id:
        return None
    
    try:
        async with db_pool.acquire() as conn:
            alert = await conn.fetchrow(
                "SELECT id, title, severity, category, source_name, raw_data FROM alerts WHERE id = $1",
                alert_id
            )
            if alert:
                return {
                    "type": "alert",
                    "title": alert['title'],
                    "severity": alert['severity'],
                    "category": alert['category'],
                    "source": alert['source_name']
                }
    except Exception as e:
        logger.error(f"Failed to fetch alert context: {e}")
    return None


async def get_incident_context(db_pool, incident_id: str) -> Optional[Dict]:
    """Fetch incident details for context"""
    if not db_pool or not incident_id:
        return None
    
    try:
        async with db_pool.acquire() as conn:
            incident = await conn.fetchrow(
                "SELECT id, title, severity, status, priority, description FROM incidents WHERE id = $1",
                incident_id
            )
            if incident:
                return {
                    "type": "incident",
                    "title": incident['title'],
                    "severity": incident['severity'],
                    "status": incident['status'],
                    "priority": incident['priority'],
                    "description": incident['description']
                }
    except Exception as e:
        logger.error(f"Failed to fetch incident context: {e}")
    return None


def build_context_message(context: Dict) -> str:
    """Build context string for the AI"""
    if not context:
        return ""
    
    parts = []
    if context.get("type") == "alert":
        parts.append(f"Alert: {context.get('title')}")
        parts.append(f"Severity: {context.get('severity')}")
        parts.append(f"Category: {context.get('category')}")
        parts.append(f"Source: {context.get('source')}")
    elif context.get("type") == "incident":
        parts.append(f"Incident: {context.get('title')}")
        parts.append(f"Severity: {context.get('severity')}")
        parts.append(f"Status: {context.get('status')}")
        parts.append(f"Priority: {context.get('priority')}")
        if context.get('description'):
            parts.append(f"Description: {context.get('description')[:500]}")
    
    return "\n".join(parts)


async def send_chat_message(
    message: str,
    context: Optional[Dict] = None,
    db_pool = None,
    redis_client = None,
    user_id: str = "anonymous"
) -> ChatResponse:
    """
    Send a message to local AI-ML service and get response
    Includes rate limiting and context enrichment
    """
    # Check rate limit
    if not await check_rate_limit(redis_client, user_id):
        return ChatResponse(
            response="You've exceeded the rate limit. Please wait a moment before sending more messages.",
            tokens_used=0
        )
    
    # Build context from alert/incident if provided
    context_str = ""
    if context:
        if context.get("alertId"):
            alert_ctx = await get_alert_context(db_pool, context["alertId"])
            if alert_ctx:
                context_str = build_context_message(alert_ctx)
        elif context.get("incidentId"):
            incident_ctx = await get_incident_context(db_pool, context["incidentId"])
            if incident_ctx:
                context_str = build_context_message(incident_ctx)
    
    request_body = {
        "message": message,
        "context": context_str if context_str else None
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                CHAT_API_URL,
                headers={"Content-Type": "application/json"},
                json=request_body
            )
            
            if response.status_code != 200:
                logger.error(f"Local AI-ML API error: {response.status_code} - {response.text}")
                return ChatResponse(
                    response=f"Sorry, I'm having trouble connecting to the local AI service (Error {response.status_code}). Please try again later.",
                    tokens_used=0
                )
            
            data = response.json()
            
            ai_response = data.get("response", "No response generated.")
            tokens = data.get("tokens_used", 0)
            
            # Increment rate limit counter
            await increment_rate_limit(redis_client, user_id)
            
            return ChatResponse(response=ai_response, tokens_used=tokens)
            
    except httpx.RequestError as e:
        logger.error(f"Local AI-ML service unavailable: {e}")
        # Fallback to mock response if local service is completely unreachable
        return ChatResponse(
            response=generate_mock_response(message),
            tokens_used=0
        )
    except Exception as e:
        logger.error(f"AI Chat call failed: {e}")
        return ChatResponse(
            response="Sorry, I encountered an error processing your request. Please try again.",
            tokens_used=0
        )


def generate_mock_response(message: str) -> str:
    """Professional fallback response when AI service is unreachable."""
    message_lower = message.lower()
    
    # Detect Arabic
    is_arabic = any('\u0600' <= c <= '\u06FF' for c in message)
    
    if is_arabic:
        return (
            "خدمة التحليل الذكي غير متوفرة حالياً.\n"
            "يمكنك:\n"
            "- مراجعة التنبيهات يدوياً من لوحة التحكم\n"
            "- فحص سجلات النظام للتحقق من الأنشطة المشبوهة\n"
            "- التواصل مع فريق SOC للمساعدة الفورية"
        )
    
    if "alert" in message_lower or "incident" in message_lower:
        return (
            "Standard Operating Procedure:\n"
            "1. Isolate the affected endpoint from the network\n"
            "2. Review associated network traffic and DNS logs\n"
            "3. Preserve system logs for forensic analysis\n"
            "4. Cross-reference IOCs against threat intelligence feeds\n"
            "5. Escalate to Tier 3 if compromise is confirmed\n\n"
            "Provide specific alert details for a structured classification."
        )
    
    return (
        "I specialize in security alert analysis, incident response, and threat intelligence.\n\n"
        "Available capabilities:\n"
        "- Alert classification with confidence scoring\n"
        "- Incident root cause analysis with MITRE ATT&CK mapping\n"
        "- IOC analysis and threat intelligence correlation\n"
        "- Response recommendations and containment strategies\n\n"
        "Provide alert or incident details for analysis."
    )

