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
