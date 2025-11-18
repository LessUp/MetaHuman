from typing import Any, Dict, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.dialogue import dialogue_service

router = APIRouter()


class ChatRequest(BaseModel):
  sessionId: Optional[str] = None
  userText: str
  meta: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
  replyText: str
  emotion: str = "neutral"
  action: str = "idle"


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
  """对话接口（初版 Mock 实现）。

  后续将接入真实的 LLM 与业务逻辑，目前仅进行简单 echo。"""
  result = await dialogue_service.generate_reply(
    user_text=req.userText,
    session_id=req.sessionId,
    meta=req.meta,
  )
  return ChatResponse(**result)
