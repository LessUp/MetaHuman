from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator

from app.services.dialogue import dialogue_service

router = APIRouter()


class ChatRequest(BaseModel):
    sessionId: Optional[str] = None
    userText: str
    meta: Optional[Dict[str, Any]] = None

    @field_validator('userText')
    @classmethod
    def validate_user_text(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('userText 不能为空')
        # 限制最大长度
        if len(v) > 2000:
            raise ValueError('userText 长度不能超过 2000 字符')
        return v.strip()


class ChatResponse(BaseModel):
    replyText: str
    emotion: str = "neutral"
    action: str = "idle"


class ErrorResponse(BaseModel):
    detail: str
    code: str = "VALIDATION_ERROR"


@router.post(
    "/chat",
    response_model=ChatResponse,
    responses={
        400: {"model": ErrorResponse, "description": "请求参数错误"},
        500: {"model": ErrorResponse, "description": "服务器内部错误"},
    }
)
async def chat(req: ChatRequest) -> ChatResponse:
    """对话接口
    
    接收用户输入，返回数字人的回复、情感和动作。
    
    - **sessionId**: 可选的会话ID，用于维护对话上下文
    - **userText**: 用户输入的文本（必填，最大2000字符）
    - **meta**: 可选的附加元数据
    
    返回:
    - **replyText**: 数字人的回复文本
    - **emotion**: 情感状态 (neutral, happy, surprised, sad, angry)
    - **action**: 动作 (idle, wave, greet, think, nod, shakeHead, dance, speak)
    """
    try:
        result = await dialogue_service.generate_reply(
            user_text=req.userText,
            session_id=req.sessionId,
            meta=req.meta,
        )
        return ChatResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        # 记录错误但返回友好的错误信息
        import logging
        logging.exception("Chat API error: %s", e)
        raise HTTPException(
            status_code=500,
            detail="服务暂时不可用，请稍后重试"
        )


@router.delete("/chat/session/{session_id}")
async def clear_session(session_id: str) -> Dict[str, Any]:
    """清除指定会话的历史记录
    
    - **session_id**: 要清除的会话ID
    """
    success = dialogue_service.clear_session(session_id)
    return {
        "success": success,
        "message": "会话已清除" if success else "会话不存在"
    }


@router.get("/chat/session/{session_id}/history")
async def get_session_history(session_id: str) -> Dict[str, Any]:
    """获取指定会话的历史记录
    
    - **session_id**: 会话ID
    """
    history = dialogue_service.get_session_history(session_id)
    return {
        "sessionId": session_id,
        "history": history,
        "count": len(history)
    }
