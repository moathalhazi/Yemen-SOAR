from fastapi import APIRouter, Depends, Request
from typing import Optional, Dict, Any
from pydantic import BaseModel

from dependencies import get_current_user, TokenData
from utils.db import get_db, get_redis
from chat_service import send_chat_message, ChatResponse

router = APIRouter()


class ChatMessageRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None


@router.post("/api/v1/chat/message")
async def chat_message(
    request: Request,
    body: ChatMessageRequest,
    current_user: TokenData = Depends(get_current_user),
):
    """Send a message to the AI Security Assistant."""
    result = await send_chat_message(
        message=body.message,
        context=body.context,
        db_pool=get_db(),
        redis_client=get_redis(),
        user_id=str(current_user.user_id),
    )
    return {"response": result.response, "tokens_used": result.tokens_used}
