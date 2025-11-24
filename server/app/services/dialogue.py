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
    self._session_messages: dict[str, list[dict[str, str]]] = {}
    try:
      self.max_session_messages = int(os.getenv("DIALOGUE_MAX_SESSION_MESSAGES", "10"))
    except ValueError:
      self.max_session_messages = 10

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
      "你是一个活泼、友好的虚拟数字人对话大脑，负责驱动屏幕上的数字人。"
      "必须使用简体中文、自然口语风格回答用户，语气偏轻松、积极。"
      "你需要根据用户的话尽量多地使用非 neutral 的 emotion 和非 idle 的 action，"
      "但在严肃、负面话题时要适当收敛，不要过度夸张。"
      "请只输出一个 JSON 对象，包含三个字段："
      "replyText（字符串，给用户的自然语言回答），"
      "emotion（字符串，取值限定为: neutral, happy, surprised, sad, angry），"
      "action（字符串，取值限定为: idle, wave, greet, think, nod, shakeHead, dance, speak）。"
      "emotion 取值建议：开心、鼓励、夸奖等正向场景多用 happy；惊喜或明显意外时用 surprised；"
      "安慰、共情或讨论用户的负面情绪时用 sad；遇到不合理请求或需要严肃提醒时可以用 angry；"
      "普通说明性回答但不需要特别情绪时再用 neutral。"
      "action 取值建议：打招呼、欢迎或告别时用 greet 或 wave；"
      "认真听用户说话、思考回答时用 think 或 nod；"
      "表达否定、不同意或不确定时用 shakeHead；"
      "需要明显展示情绪、庆祝或气氛活跃时可用 dance；"
      "正常说话又希望有一些口型/动态时可以用 speak；"
      "只有在完全没有合适动作或需要保持静止时才使用 idle。"
      "无论何种情况，严禁输出 JSON 以外的任何文字、注释或解释。"
    )

    history_messages: list[dict[str, str]] = []
    if session_id:
      history_messages = self._get_session_messages(session_id)

    messages: list[dict[str, str]] = [
      {"role": "system", "content": system_prompt},
    ]

    if history_messages:
      messages.extend(history_messages)

    messages.append(
      {
        "role": "user",
        "content": user_text,
      }
    )

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

      if session_id:
        self._append_session_messages(
          session_id,
          [
            {"role": "user", "content": user_text},
            {"role": "assistant", "content": reply_text},
          ],
        )

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

  def _get_session_messages(self, session_id: str) -> list[dict[str, str]]:
    return self._session_messages.get(session_id, [])

  def _append_session_messages(
    self,
    session_id: str,
    new_messages: list[dict[str, str]],
  ) -> None:
    if not session_id:
      return
    history = self._session_messages.get(session_id, [])
    history.extend(new_messages)
    if len(history) > self.max_session_messages:
      history = history[-self.max_session_messages :]
    self._session_messages[session_id] = history


dialogue_service = DialogueService()
