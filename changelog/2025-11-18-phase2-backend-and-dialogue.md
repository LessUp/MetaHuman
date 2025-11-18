# 2025-11-18 Phase 2：FastAPI 后端骨架与前端对话服务

## 变更内容

- 新增后端目录结构（基于 FastAPI）：
  - `server/app/main.py`：
    - 创建 FastAPI 应用 `app`，注册 `/health` 健康检查接口。
    - 挂载 `/v1` 下的 `chat` 路由。
  - `server/app/api/chat.py`：
    - 定义 `POST /v1/chat` 接口，使用 `ChatRequest` / `ChatResponse` Pydantic 模型。
    - 当前通过 `DialogueService` 的 `generate_reply` 方法返回 **Mock 回复**：`replyText`、`emotion`、`action`。
  - `server/app/services/dialogue.py`：
    - 定义 `DialogueService` 类，并导出单例 `dialogue_service`。
    - 目前实现为简单的 echo：`replyText = "（Mock 回复）你刚才说：{user_text}"`，`emotion = neutral`，`action = idle`。
  - `server/app/__init__.py`、`server/app/api/__init__.py`、`server/app/services/__init__.py`：空文件，用于将目录标记为 Python 包。
  - `server/requirements.txt`：声明后端依赖：`fastapi`、`uvicorn`。

- 新增前端对话服务封装：
  - `src/core/dialogue/dialogueService.ts`：
    - 定义 `ChatRequestPayload` / `ChatResponsePayload` TypeScript 接口。
    - 导出 `sendUserInput(payload)`：
      - 从 `import.meta.env.VITE_API_BASE_URL` 读取后端基地址（默认 `http://localhost:8000`）。
      - 调用 `POST /v1/chat`，返回标准化的 `{ replyText, emotion, action }`。

## 目的

- 为数字人项目引入独立的后端对话服务层（FastAPI），与前端进行清晰分层。
- 在不影响现有 UI 的前提下，打通一个最小可用的对话通道（目前为 Mock），为后续接入真实 LLM / 业务逻辑做好接口准备。

## 使用说明（后端）

- 推荐在项目根目录下运行（示例命令）：

  ```bash
  cd server
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```

- 启动后可访问：
  - `GET http://localhost:8000/health` → `{ "status": "ok" }`
  - `POST http://localhost:8000/v1/chat` → 返回 Mock 对话结果。

## 使用说明（前端对话服务）

- 在前端组件或服务中调用：

  ```ts
  import { sendUserInput } from '@/core/dialogue/dialogueService';

  const res = await sendUserInput({
    userText: '你好',
    sessionId: 'demo',
  });

  // res.replyText / res.emotion / res.action
  ```

- 请在前端 `.env` 或 `.env.local` 中配置后端地址（如有需要）：

  ```bash
  VITE_API_BASE_URL=http://localhost:8000
  ```

## 备注

- 当前未对 UI 做任何可见改动，只是为后续在页面上增加对话输入区，以及将 LLM 回答映射到数字人的表情/动作预留了基础设施。
- 后续计划：
  - 在前端某个页面（如 AdvancedDigitalHumanPage）中接入 `sendUserInput`，将回复文本通过 TTS 播放，并根据 `emotion` / `action` 调用 `DigitalHumanEngine`。
