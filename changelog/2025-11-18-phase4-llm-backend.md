# 2025-11-18 Phase 4：DialogueService 接入 LLM

## 变更内容

- 更新 `server/app/services/dialogue.py`：
  - 引入 `httpx`、`os`、`json`、`logging` 依赖。
  - 为 `DialogueService` 增加构造函数，从环境变量读取：
    - `OPENAI_API_KEY`：OpenAI API 密钥。
    - `OPENAI_MODEL`：可选，默认 `gpt-3.5-turbo`。
  - 在 `generate_reply` 中：
    - 当未配置 `OPENAI_API_KEY` 时，记录 warning 日志并回退到本地 Mock 回复（保持原有行为）。
    - 当有 API Key 时，通过 OpenAI Chat Completions API 调用 LLM：
      - 构造包含 system + user（+ 可选 meta）的消息列表，要求模型只输出包含 `replyText` / `emotion` / `action` 字段的 JSON。
      - 解析模型返回内容：
        - 尝试 `json.loads`，若解析失败则将原始内容作为 `replyText` 返回，`emotion`/`action` 使用默认值。
        - 对 `emotion` 和 `action` 做白名单校验，不在允许集合内时回退为 `neutral` / `idle`。
      - 支持异常降级：任意异常将返回带提示的降级回复，不影响前端整体流程。
- 更新 `server/requirements.txt`：
  - 新增 `httpx>=0.24.0,<1.0.0` 依赖，用于调用 OpenAI HTTP 接口。

## 目的

- 将对话大脑从纯 Mock 升级为可接入真实 LLM 的实现，同时保证：
  - 无 API Key 或调用失败时，系统仍能给出可用的降级回复；
  - 后端统一返回结构化的 `{ replyText, emotion, action }`，便于前端驱动数字人的表情与动作。

## 配置说明

- 在运行 FastAPI 后端前，需要在环境中配置：
  - `OPENAI_API_KEY`：你的 OpenAI API Key（请勿提交到代码仓库）。
  - 可选 `OPENAI_MODEL`：模型名称，例如 `gpt-3.5-turbo` 或其他兼容 Chat Completions 的模型。

## 备注

- 当前实现依赖 OpenAI 的 Chat Completions 接口，后续如需切换到其他模型供应商，可在 `DialogueService` 内更换 HTTP 调用与 prompt 约定而无需修改前端。
