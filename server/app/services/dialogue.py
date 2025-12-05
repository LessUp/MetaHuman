from typing import Any, Dict, List, Optional
import json
import logging
import os
import random
from datetime import datetime
from collections import defaultdict

import httpx


logger = logging.getLogger(__name__)


# 会话历史存储（生产环境应使用 Redis 等持久化存储）
session_histories: Dict[str, List[Dict[str, str]]] = defaultdict(list)
MAX_HISTORY_LENGTH = 20  # 最大保留的历史对话轮数


class DialogueService:
  def __init__(self) -> None:
    self.api_key = os.getenv("OPENAI_API_KEY")
    self.model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
    self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1/chat/completions")
    self.provider = os.getenv("LLM_PROVIDER", "openai").lower()
    self._session_messages: dict[str, list[dict[str, str]]] = {}
    try:
      self.max_session_messages = int(os.getenv("DIALOGUE_MAX_SESSION_MESSAGES", "10"))
    except ValueError:
      self.max_session_messages = 10

  def _get_smart_mock_reply(self, user_text: str) -> Dict[str, Any]:
    """智能本地 Mock 回复，根据用户输入生成合理的响应"""
    text_lower = user_text.lower()
    
    greetings = ['你好', '您好', 'hello', 'hi', '嗨', '早上好', '下午好', '晚上好']
    if any(g in text_lower for g in greetings):
      replies = [
        ("您好！很高兴见到您，有什么可以帮助您的吗？", "happy", "wave"),
        ("你好呀！今天心情怎么样？", "happy", "greet"),
        ("嗨！欢迎来到数字人交互系统！", "happy", "wave"),
      ]
      return dict(zip(["replyText", "emotion", "action"], random.choice(replies)))
    
    if '你是谁' in user_text or '介绍' in user_text or '什么' in user_text:
      return {"replyText": "我是一个数字人助手，可以和您进行对话交流，展示各种表情和动作。", "emotion": "happy", "action": "greet"}
    if '谢谢' in user_text or '感谢' in user_text:
      return {"replyText": "不客气！能帮到您我很开心。", "emotion": "happy", "action": "nod"}
    if '再见' in user_text or '拜拜' in user_text or 'bye' in text_lower:
      return {"replyText": "再见！期待下次与您交流！", "emotion": "happy", "action": "wave"}
    if '天气' in user_text:
      return {"replyText": "今天天气看起来不错呢！", "emotion": "happy", "action": "think"}
    if '跳舞' in user_text or '舞' in user_text:
      return {"replyText": "好的，让我来给您跳一段舞！", "emotion": "happy", "action": "dance"}
    if '?' in user_text or '？' in user_text or '吗' in user_text:
      return {"replyText": "这是个好问题！让我想想...", "emotion": "neutral", "action": "think"}
    
    default_replies = [("我明白了，请继续说。", "neutral", "nod"), ("好的，我在听。", "neutral", "idle")]
    return dict(zip(["replyText", "emotion", "action"], random.choice(default_replies)))

  async def generate_reply(
    self,
    user_text: str,
    session_id: Optional[str] = None,
    meta: Optional[Dict[str, Any]] = None,
  ) -> Dict[str, Any]:
    """生成对话回复
    
    支持会话历史管理和 LLM 调用，当 API Key 未配置时使用智能 Mock 回复。
    """
    # 记录用户消息到会话历史
    if session_id:
      session_histories[session_id].append({
        "role": "user",
        "content": user_text,
        "timestamp": datetime.now().isoformat(),
      })
      # 限制历史长度
      if len(session_histories[session_id]) > MAX_HISTORY_LENGTH * 2:
        session_histories[session_id] = session_histories[session_id][-MAX_HISTORY_LENGTH * 2:]

    if not self.api_key:
      logger.info("OPENAI_API_KEY 未配置，使用智能 Mock 回复")
      result = self._get_smart_mock_reply(user_text)
      # 记录助手回复到历史
      if session_id:
        session_histories[session_id].append({
          "role": "assistant",
          "content": result["replyText"],
          "timestamp": datetime.now().isoformat(),
        })
      return result

    system_prompt = (
      "你是一个活泼、友好的虚拟数字人对话大脑，负责驱动屏幕上的数字人。"
      "必须使用简体中文、自然口语风格回答用户，语气偏轻松、积极。"
      "你需要根据用户的话尽量多地使用非 neutral 的 emotion 和非 idle 的 action，"
      "但在严肃、负面话题时要适当收敛，不要过度夸张。"
      "请只输出一个 JSON 对象，包含三个字段："
      "replyText（字符串，给用户的自然语言回答，要友好自然），"
      "emotion（字符串，取值限定为: neutral, happy, surprised, sad, angry），"
      "action（字符串，取值限定为: idle, wave, greet, think, nod, shakeHead, dance, speak）。"
      "emotion 取值建议：正向场景多用 happy；惊喜时用 surprised；负面情绪时用 sad；严肃提醒时用 angry；普通回答用 neutral。"
      "action 取值建议：招呼告别用 greet/wave；思考用 think/nod；否定用 shakeHead；庆祝用 dance；说话用 speak；静止用 idle。"
      "严禁输出 JSON 以外的任何文字。"
    )

    history_messages: list[dict[str, str]] = []
    if session_id:
      history_messages = self._get_session_messages(session_id)

    messages: list[dict[str, str]] = [
      {"role": "system", "content": system_prompt},
    ]

    # 添加会话历史
    if history_messages:
      messages.extend(history_messages)
    elif session_id and session_id in session_histories:
      history = session_histories[session_id][-10:]
      for msg in history:
        if msg["role"] in ("user", "assistant"):
          messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({"role": "user", "content": user_text})

    if meta:
      messages.append(
        {
          "role": "system",
          "content": f"附加上下文信息（可选）：{json.dumps(meta, ensure_ascii=False)}",
        }
      )

    try:
      data = await self._call_llm(messages)
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

      # 记录消息到会话历史
      if session_id:
        session_histories[session_id].append({
          "role": "assistant",
          "content": reply_text,
          "timestamp": datetime.now().isoformat(),
        })
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
    except httpx.TimeoutException:
      logger.warning("LLM 请求超时，使用智能 Mock 回复")
      return self._get_smart_mock_reply(user_text)
    except Exception as exc:
      logger.exception("调用 LLM 失败，将使用智能 Mock 回复: %s", exc)
      return self._get_smart_mock_reply(user_text)

  def clear_session(self, session_id: str) -> bool:
    """清除指定会话的历史记录"""
    if session_id in session_histories:
      del session_histories[session_id]
      return True
    return False

  def get_session_history(self, session_id: str) -> List[Dict[str, str]]:
    """获取指定会话的历史记录"""
    return session_histories.get(session_id, [])

  async def _call_llm(self, messages: list[dict[str, str]]) -> Dict[str, Any]:
    provider = (self.provider or "openai").lower()
    logger.debug("Calling LLM provider=%s model=%s messages=%d", provider, self.model, len(messages))

    if provider != "openai":
      logger.warning("LLM_PROVIDER=%s 未实现，暂时使用 openai 作为回退", provider)

    url = self.base_url or "https://api.openai.com/v1/chat/completions"
    headers = {
      "Authorization": f"Bearer {self.api_key}",
      "Content-Type": "application/json",
    }
    payload = {
      "model": self.model,
      "messages": messages,
      "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=20.0) as client:
      resp = await client.post(url, headers=headers, json=payload)
    resp.raise_for_status()
    return resp.json()

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
    truncated = False
    if len(history) > self.max_session_messages:
      history = history[-self.max_session_messages :]
      truncated = True
    self._session_messages[session_id] = history
    logger.debug(
      "Session %s history size=%d%s",
      session_id,
      len(history),
      " (truncated)" if truncated else "",
    )


dialogue_service = DialogueService()
