# 2025-11-24 行为与语音管线集成

## 前端行为状态与引擎

- 在 `digitalHumanStore` 中新增行为状态字段：
  - `currentBehavior: string`
  - `setBehavior(behavior: string)`
  - 在 `reset()` 时将 `currentBehavior` 重置为 `"idle"`。
- 更新 `DigitalHumanEngine`：
  - 新增 `setBehavior(behavior: string, params?: any)` 方法，用于根据行为语义驱动动画与全局状态：
    - `greeting → waveHand`
    - `listening → nod`
    - `thinking → shakeHead`
    - `speaking → nod`
    - `excited → excited`
    - 其他行为回退到 `idle`。
  - 保留 `playAnimation(name: string)` 作为底层动画控制接口。
- 更新 `AdvancedDigitalHumanPage`：
  - 现在从 store 中正确读取 `currentBehavior`。
  - 将 `BehaviorControlPanel` 的 `onBehaviorChange` 直接接到 `digitalHumanEngine.setBehavior`，行为面板操作会真实更新全局行为状态和动画。

## 语音服务统一（Web Speech API 管线）

- 扩展 `core/audio/audioService.ts`：
  - `TTSService`：
    - 新增 `getVoices()`，用于前端 UI 获取可用语音列表。
    - 新增 `speakWithOptions(text, { lang, rate, pitch, volume, voiceName })`，支持自定义语速、音高、音量和具体 voice name。
    - 原 `speak(text, lang)` 现在内部委托给 `speakWithOptions`。
  - `ASRService`：
    - 新增回调和模式控制：`onResultCallback` 与 `mode: 'command' | 'dictation'`。
    - `start(options)` 支持传入 `onResult` 与 `mode`，在识别结果时：
      - 回调 UI 层 `onResult`。
      - 当处于 `command` 模式时仍会走内建的 `processVoiceCommand` 语音指令逻辑。
    - `stop()` 时会清理回调并恢复模式为 `command`。
- 重构 `VoiceInteractionPanel` 组件：
  - 不再直接 new `SpeechRecognition`/`SpeechSynthesis`，改为统一调用：
    - 语音识别：使用单例 `asrService.start({ mode: 'dictation', onResult })` / `asrService.stop()`。
    - 语音合成：使用单例 `ttsService.speakWithOptions(...)`。
  - 仍然对外暴露：
    - `onTranscript(text)`：将识别结果上报给上层（例如对话系统）。
    - `onSpeak(text)`：在触发 TTS 时通知上层（可用于记录对话日志）。
  - 语音设置（音量/音调/语速/voice 选择）直接作用于 `ttsService` 的参数。

## 影响与兼容性

- 现有基于 `ttsService`/`asrService` 的调用保持兼容；
- `VoiceInteractionPanel` 现在作为统一语音 UI 层，可以在页面中按需挂载，不会再与全局语音状态产生冲突；
- 行为状态 `currentBehavior` 与 `BehaviorControlPanel`、`DigitalHumanEngine` 已经贯通，为后续接入 LLM 决策（根据对话内容自动切换行为）打下基础。
- 在高级页面中新增 `voice` 控制 Tab，将 `VoiceInteractionPanel` 的语音识别结果通过 `onTranscript` 直接接入对话链路（调用同一个 `handleChatSend`），实现“语音→文本→LLM→表情/行为”的统一管线。

## 后端对话大脑增强（OpenAI + 会话记忆）

- `server/app/services/dialogue.py` 中的 `DialogueService` 新增会话级内存：
  - 在实例上维护 `_session_messages: dict[str, list[dict[str, str]]]`。
  - 通过环境变量 `DIALOGUE_MAX_SESSION_MESSAGES` 控制每个会话保留的历史消息条数（默认 10），超出时仅保留最近若干条。
- `generate_reply` 调用 LLM 时现在会：
  - 在 system prompt 之后拼接当前 `session_id` 的历史消息，再追加本轮用户输入。
  - 若传入 `meta`，继续以额外的 system 消息形式附加在最后。
- 在成功解析 LLM 返回并通过校验后：
  - 将本轮 `{role: 'user', content: user_text}` 与 `{role: 'assistant', content: replyText}` 追加写入对应 `session_id` 的会话历史。
- 行为保持：
  - 当环境变量 `OPENAI_API_KEY` 缺失时仍然走本地 Mock 回退逻辑，不写入会话历史；
  - 当调用 LLM 发生异常时仍然返回降级提示文本，并且不会污染原有会话历史。

## Prompt 精调：活泼人格与表情/动作策略

- 更新 `DialogueService` 中的 `system_prompt`：
  - 设定数字人为**活泼、友好**的对话风格，使用简体中文的自然口语，语气偏轻松、积极。
  - 明确要求：在合适情况下尽量多用非 `neutral` 的 `emotion` 和非 `idle` 的 `action`，
    但在严肃、负面话题下要适当收敛，不要过度夸张。
  - 对 `emotion` 给出具体使用建议：
    - 正向/开心场景多用 `happy`；
    - 明显意外或惊喜时用 `surprised`；
    - 安慰、共情或讨论负面情绪时用 `sad`；
    - 不合理请求或需要严肃提醒时可用 `angry`；
    - 普通说明性回答无特别情绪时用 `neutral`。
  - 对 `action` 给出具体使用建议：
    - 问候/欢迎/告别时用 `greet` 或 `wave`；
    - 认真倾听或思考时用 `think` 或 `nod`；
    - 否定、不赞同或不确定时用 `shakeHead`；
    - 需要明显展现情绪或庆祝氛围时用 `dance`；
    - 一般说话但希望有一定口型/动态时用 `speak`；
    - 只有在没有合适动作或需要静止时才用 `idle`。
  - 强调：**无论何种情况严禁输出 JSON 以外的任何文字、注释或解释**，确保前端解析稳定。

## 多 LLM Provider 抽象（预留扩展点）

- 在 `DialogueService` 中引入轻量级 Provider 抽象：
  - 新增环境变量：
    - `LLM_PROVIDER`：当前使用的 LLM 提供方标识，默认 `openai`；
    - `LLM_BASE_URL`：可选，覆盖默认的 OpenAI Chat Completions URL，方便对接 OpenAI 兼容网关。
  - 新增私有方法 `_call_llm(messages)`：
    - 统一封装 HTTP 请求逻辑，当前实现为调用 OpenAI Chat Completions 接口；
    - 记录调试日志：`provider`、`model`、`messages` 数量等；
    - 当 `LLM_PROVIDER` 不是 `openai` 时，会输出告警日志并暂时回退到 OpenAI，实现“先有接口，再慢慢接其他 Provider”的策略。

## 前端交互与调试体验微调

- 高级页面 Chat Dock：
  - 输入框回车发送逻辑增加防抖：在 `isChatLoading` 或 `isRecording` 时禁止再次触发 `handleChatSend`，避免重复请求。
  - 输入框占位文案根据状态切换：
    - 录音中：显示 `Listening... press mic again to stop`；
    - 加载中：显示 `Thinking...`；
    - 其他情况：保持原有 `Type a message to interact...`。
  - 发送按钮：
    - 在 `isChatLoading` 为 `true` 时禁用按钮，防止重复发送；
    - 同时保留加载态的圆形 spinner。
  - 录音按钮：
    - 在 `isChatLoading` 时禁用，避免在模型回复过程中开启新的录音；
    - 增加 `disabled` 的视觉反馈（透明度和光标样式）。
- 调试日志：
  - 在前端 `AdvancedDigitalHumanPage` 中：
    - 对每次 LLM 返回的 `emotion`/`action` 输出 `console.debug`，便于在 DevTools 中观察映射效果；
    - 在切换录音状态时输出 `console.debug`，方便排查麦克风交互问题。
  - 在后端 `DialogueService` 中：
    - 每次调用 LLM 时输出 provider、model 与消息数量；
    - 在会话历史被截断时输出包含 `session_id` 和最终长度的调试日志，便于观察内存行为。
