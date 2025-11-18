from typing import Any, Dict, Optional
import json
import logging
import os

import httpx


logger = logging.getLogger(__name__)


class DialogueService:
  def __init__(self) -> None:
    self.api_key = os.getenv("OPENAI_API_KEY")
    self.model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

  async def generate_reply(
    self,
    user_text: str,
    session_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
  ) -> Dict[str, Any]:
    """对话服务的初版 Mock 实现。

    目前只做简单回声，后续将接入真实的 LLM / 知识库，并利用 session 与 meta。"""
    # TODO: 后续基于 user_text、session_id、meta 调用真实 LLM

    if not self.api_key:
      logger.warning("OPENAI_API_KEY 未配置，使用本地 Mock 回复")
      reply_text = f"（本地 Mock 回复）你刚才说：{user_text}"
      return {
        "replyText": reply_text,
        "emotion": "neutral",
        "action": "idle",
      }

    system_prompt = (
      "你是一个驱动虚拟数字人的对话大脑。"
      "必须使用简体中文回答用户。"
      "请只输出一个 JSON 对象，包含三个字段："
      "replyText（字符串，给用户的自然语言回答），"
      "emotion（字符串，取值限定为: neutral, happy, surprised, sad, angry），"
      "action（字符串，取值限定为: idle, wave, greet, think, nod, shakeHead, dance, speak）。"
      "不要输出 JSON 以外的任何文字。"
    )

    messages: list[dict[str, str]] = [
      {"role": "system", "content": system_prompt},
      {
        "role": "user",
        "content": user_text,
      },
    ]

    if meta:
      messages.append(
        {
          "role": "system",
          "content": f"附加上下文信息（可选）：{json.dumps(meta, ensure_ascii=False)}",
        }
      )

    try:
      async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(
          "https://api.openai.com/v1/chat/completions",
          headers={
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
          },
          json={
            "model": self.model,
            "messages": messages,
            "temperature": 0.7,
          },
        )
      resp.raise_for_status()
      data = resp.json()
      content = data["choices"][0]["message"]["content"]

      try:
        parsed = json.loads(content)
      except json.JSONDecodeError:
        logger.warning("LLM 返回内容不是合法 JSON，将内容作为 replyText 使用: %s", content)
        return {
          "replyText": content,
          "emotion": "neutral",
          "action": "idle",
        }

      reply_text = str(parsed.get("replyText", "")).strip() or f"你刚才说：{user_text}"
      emotion = str(parsed.get("emotion", "neutral")).strip() or "neutral"
      action = str(parsed.get("action", "idle")).strip() or "idle"

      if emotion not in {"neutral", "happy", "surprised", "sad", "angry"}:
        emotion = "neutral"
      if action not in {"idle", "wave", "greet", "think", "nod", "shakeHead", "dance", "speak"}:
        action = "idle"

      return {
        "replyText": reply_text,
        "emotion": emotion,
        "action": action,
      }
    except Exception as exc:
      logger.exception("调用 LLM 失败，将使用降级回复: %s", exc)
      reply_text = f"（对话服务暂时不可用）你刚才说：{user_text}"
      return {
        "replyText": reply_text,
        "emotion": "neutral",
        "action": "idle",
      }


dialogue_service = DialogueService()
