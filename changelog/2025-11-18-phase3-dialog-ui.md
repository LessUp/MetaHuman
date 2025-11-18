# 2025-11-18 Phase 3：AdvancedDigitalHumanPage 对话 UI 接入

## 变更内容

- 在 `AdvancedDigitalHumanPage.tsx` 中：
  - 引入 `sendUserInput`，使用前端 `dialogueService` 调用后端 `/v1/chat` 接口。
  - 新增本地状态：
    - `chatInput`：当前输入框文本。
    - `chatMessages`：对话消息列表（用户 / 数字人）。
    - `isChatLoading`：对话请求进行中的标记。
  - 新增 `handleChatSend` 方法：
    - 将用户输入追加到 `chatMessages`。
    - 调用 `sendUserInput` 获取后端回复。
    - 根据返回的 `emotion` 与 `action` 调用 `digitalHumanEngine.setEmotion` / `setExpression` / `playAnimation` 驱动数字人表现。
    - 使用 `ttsService.speak` 让数字人朗读回复内容。
  - 将语音识别结果 `handleTranscript` 接入对话链路：
    - 不再直接调用 `handleVoiceCommand`，改为 `handleChatSend(text)`，实现“语音 → 文本 → 对话服务 → 数字人回复”的闭环。
  - 扩展标签页：
    - 在原有 `basic` / `voice` / `expression` / `behavior` 之外新增 `chat` 标签页。
    - 在 `chat` 标签页中添加：
      - 对话消息列表（区分用户与助手气泡样式）。
      - 文本输入框与发送按钮（支持 Enter 快捷发送、loading 状态显示）。

## 目的

- 在不破坏现有交互体验的前提下，为数字人增加一个完整的“文本/语音驱动的对话 UI”：
  - 用户可以在对话标签页输入文本，与数字人进行多轮对话；
  - 或通过语音识别直接将语音内容提交给对话服务；
  - 数字人会根据对话结果改变表情/动作并朗读回复。

## 备注

- 当前后端仍为 Mock 实现，返回固定格式的回复文本与情绪/动作占位字段。
- 后续接入真实 LLM 时，只需在后端 `DialogueService` 中替换生成逻辑，即可复用本对话 UI 与驱动链路。
