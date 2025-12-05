# MetaHuman 项目缺陷修复路线（Bugfix Roadmap）

> 本文聚焦当前代码审查中已发现的问题，给出一个**可落地的修复顺序与检查项**，与 `digital-human-roadmap.md` 的长期功能路线互补。

---

## 1. 修复目标与范围

- **目标**：
  - 解决会导致 `npm run build` / 运行时报错的关键问题。
  - 保证在有 / 无 `OPENAI_API_KEY` 的情况下，对话链路都能稳定工作。
  - 统一前端交互逻辑，减少行为不一致和易错点。
- **范围**：
  - 前端：`src/pages/AdvancedDigitalHumanPage.tsx`、`src/core/audio/audioService.ts`、`src/core/dialogue/dialogueService.ts`、`src/store/digitalHumanStore.ts` 等。
  - 后端：`server/app/services/dialogue.py`、`server/app/api/chat.py`。

---

## 2. 当前主要问题分级

### 2.1 P0：会导致构建失败或 LLM 不可用的问题

1. **浏览器项目中使用 `NodeJS.Timeout` 类型**  
   - 文件：`src/pages/AdvancedDigitalHumanPage.tsx`  
   - 现状：`const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);`  
   - 风险：在未引入 `@types/node` 的前端项目中，`tsc` 会报 `Cannot find namespace 'NodeJS'`，阻塞构建。  
   - 目标：改为浏览器安全写法，例如 `useRef<ReturnType<typeof setTimeout> | null>(null)` 或 `useRef<number | null>(null)`。

2. **`TTSService` 内重复定义 `getVoices` 方法**  
   - 文件：`src/core/audio/audioService.ts`  
   - 现状：同一类中出现两次 `getVoices()` 实现，会带来类型检查或维护上的混乱。  
   - 风险：在严格模式或未来重构时容易引起意外行为。  
   - 目标：仅保留一份带类型标注的 `getVoices(): SpeechSynthesisVoice[]` 实现。

3. **后端 OpenAI 调用的默认 URL 配置不合理**  
   - 文件：`server/app/services/dialogue.py`  
   - 现状：
     - `self.base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")`
     - `_call_llm` 中：`url = self.base_url or "https://api.openai.com/v1/chat/completions"`
   - 风险：默认情况下会 `POST https://api.openai.com/v1`，而不是 `/v1/chat/completions`，导致 LLM 调用长期失败，只能走本地 Mock。  
   - 目标：确保默认情况下 URL 即为 `https://api.openai.com/v1/chat/completions`，或者在 `base_url` 上追加 `/chat/completions`。

### 2.2 P1：行为一致性与体验问题

4. **键盘快捷键 `useEffect` 依赖不完整，存在旧闭包风险**  
   - 文件：`src/pages/AdvancedDigitalHumanPage.tsx`  
   - 现状：`useEffect` 中使用了 `handlePlayPause / handleReset / handleVoiceCommand`，依赖数组仅有 `[isMuted, toggleMute]`。  
   - 风险：监听到的 handler 可能是旧版本闭包，表现与 UI 状态不一致。  
   - 目标：补全依赖，或改写为从 store / engine 直接读取实时状态。

5. **聊天逻辑在页面与 `audioService` 中重复且风格不一致**  
   - 文件：
     - 页面：`AdvancedDigitalHumanPage.handleChatSend`
     - 服务：`ASRService.sendToDialogueService`
   - 现状：
     - 一条链路直接调用 `digitalHumanEngine` 更新表情和动作。
     - 另一条链路主要通过 `store` 更新状态，再间接驱动 UI。  
   - 风险：文本输入与语音输入路径对数字人行为的控制不一致，长期演进后容易出同步问题。  
   - 目标：抽象出统一的 `applyDialogueResponse(res)` 工具函数，集中完成：
     - 更新聊天记录；
     - 设置 emotion / expression / animation / behavior；
     - 视需要驱动 `digitalHumanEngine` 与 `ttsService`。

6. **会话管理 API 未真正接入 UI**  
   - 文件：`src/store/digitalHumanStore.ts`、`src/pages/AdvancedDigitalHumanPage.tsx`  
   - 现状：store 中有 `initSession()`，页面里也解构了该方法，但没有任何地方调用。  
   - 风险：会话实际长期复用同一个 `sessionId`，虽然有长度裁剪，但不利于测试和场景切换。  
   - 目标：在 UI 中提供“开始新会话 / 清空历史”的入口（如设置面板按钮），调用 `initSession()`。

7. **错误提示重复（Toast + 底部 Banner）**  
   - 文件：`src/pages/AdvancedDigitalHumanPage.tsx`  
   - 现状：
     - `useEffect` 中 `error` 一变化就 `toast.error(error)`，5s 后 `clearError()`；
     - 同时底部固定 Banner 也展示同一个 `error`。  
   - 风险：同一错误信息多处出现，显得噪音较大。  
   - 目标：
     - 明确：全局错误使用 Toast 还是底部 Banner；
     - 或将 store 中错误拆为“一次性错误消息”和“持续状态”。

### 2.3 P2：扩展性与技术债

8. **TypeScript 严格性较低，隐藏潜在问题**  
   - 文件：`tsconfig.json`  
   - 现状：`strict: false`，`noUnusedLocals` / `noUnusedParameters` 等关闭。  
   - 风险：类型问题与死代码不易暴露；长期演进后维护成本高。  
   - 目标：在核心问题修复后，逐步打开关键检查，至少在 `src/core` 和 `src/store` 目录维持较高严格度。

9. **`localStorage` 在 store 初始化期直接访问**  
   - 文件：`src/store/digitalHumanStore.ts`  
   - 现状：`getOrCreateSessionId` 在模块初始化时直接调用 `localStorage`。  
   - 风险：目前浏览器环境上没问题，但一旦引入 SSR / 某些测试环境，会在 import 阶段抛错。  
   - 目标：未来可考虑在运行时（组件挂载后）懒加载 sessionId 或做 `typeof window !== 'undefined'` 防护。

10. **流式对话接口仅为 TODO**  
    - 文件：`src/core/dialogue/dialogueService.ts` 的 `streamUserInput`  
    - 现状：实现只是简单包装 `sendUserInput`，并留有 `TODO: 实现流式响应`。  
    - 目标：在需要“逐字输出”体验时，配合后端 SSE / WebSocket 再做系统性设计，目前可以暂缓。

---

## 3. 迭代修复路线

### 3.1 Iteration 0：环境与基线

**目标**：确保本地环境一致、基础命令可用。  
**任务**：
- 确认 Node.js / npm 版本符合 `package.json` 要求（Node >= 18, npm >= 9）。
- 前端：`npm install` 后尝试：
  - `npm run lint`
  - `npm run test`
  - `npm run build`
- 后端：在 `server/` 目录创建虚拟环境，安装 `requirements.txt`，运行 FastAPI：
  - `uvicorn app.main:app --reload --port 8000`

**验收标准**：
- 在未修改代码前记录一版“当前失败点”（例如 build 报错、对话请求返回错误等），作为后续修复前后的对比基线。

---

### 3.2 Iteration 1：P0 问题修复（构建 & LLM 调用）

**目标**：保证前端构建通过，后端在配置了 OpenAI Key 时可以正常走 LLM 路径。  

**任务 1：修复前端类型/编译错误**

- 修改 `AdvancedDigitalHumanPage.tsx`：
  - 将 `errorTimeoutRef` 从 `NodeJS.Timeout` 改为 `ReturnType<typeof setTimeout>` 或 `number`。
- 修改 `audioService.ts`：
  - 删除重复的 `getVoices` 定义，仅保留一份带返回类型的实现。
- 重新运行 `npm run build` 验证不再有 TS 相关错误。

**任务 2：修复后端 OpenAI URL 配置**

- 修改 `DialogueService.__init__` 或 `_call_llm`：
  - 默认 URL 指向 `https://api.openai.com/v1/chat/completions`；
  - 若仍希望使用 `OPENAI_BASE_URL`，则应在该值基础上 append `/chat/completions`。  
- 本地设置 `OPENAI_API_KEY` 后：
  - 启动 FastAPI；
  - 手动调用 `/v1/chat`（例如用 `curl` 或 VS Code REST Client）；
  - 确认能得到非 Mock 的 LLM 回复（可通过日志 `OPENAI_API_KEY 未配置` 消息是否消失来确认）。

**验收标准**：
- `npm run build` 能稳定通过；
- `OPENAI_API_KEY` 配置后，`/v1/chat` 能成功返回 LLM 生成的 JSON；
- 未配置 Key 时，仍能走智能 Mock 分支，前端体验不崩溃。

---

### 3.3 Iteration 2：P1 行为一致性与体验优化

**目标**：统一文本/语音两条对话链路的行为，并改善键盘快捷键与错误提示体验。  

**任务 3：统一对话响应处理逻辑**

- 在前端新增一个工具函数（例如位于 `core/dialogue` 或 `core/avatar`）：
  - 接收 `ChatResponsePayload` + 一些上下文（如 `isMuted`），内部负责：
    - 更新 `chatHistory`；
    - 更新 `emotion / expression / behavior / currentAnimation`（通过 store 或 `digitalHumanEngine`）；
    - 决定是否调用 `ttsService.speak`。  
- 调整：
  - `AdvancedDigitalHumanPage.handleChatSend` 改为调用该统一函数；
  - `ASRService.sendToDialogueService` 也改为调用同一处逻辑，避免重复。

**任务 4：修复键盘快捷键依赖问题**

- 为 `AdvancedDigitalHumanPage` 中负责添加 `keydown` 监听的 `useEffect`：
  - 补全依赖数组，使其覆盖使用到的 handler；
  - 或将 handler 改为从 store/engine 读取当前值，减少对闭包的依赖。  
- 手动测试：空格播放/暂停、`R` 重置、`1`~`4` 快捷命令在不同状态下行为正确。

**任务 5：优化错误提示 UX**

- 设计规则，例如：
  - 全局错误仅走 Toast，不再显示底部 Banner；或
  - Toast 只用于“提示”，底部 Banner 用于“严重错误”。  
- 修改 `AdvancedDigitalHumanPage`：
  - 按新规则保留/删除对应 UI 元素。  
- 验证在网络断开、OpenAI 调用失败、语音/摄像头错误时，提示不显得过度打扰。

**验收标准**：
- 文本输入和语音输入对同一问题的回复，在情绪/动作上表现一致；
- 键盘快捷键行为与 UI 状态一致，不出现“按键无效”但无错误提示的情况；
- 错误提示既能及时暴露问题，又不会重复轰炸用户。

---

### 3.4 Iteration 3：P2 技术债与中长期演进

**目标**：在不影响当前功能的前提下，逐步提升类型安全和可维护性，为后续 Roadmap 阶段打基础。  

**任务 6：逐步提高 TypeScript 严格性**

- 从 `core/` 和 `store/` 开始：
  - 开启 `noUnusedLocals`, `noUnusedParameters`；
  - 评估开启 `strict` 的影响。  
- 对新增/修改代码遵循更严格的类型约束，老代码按需渐进改造。

**任务 7：改善 `localStorage` 访问方式（可选）**

- 为未来 SSR 或桌面版（Tauri/Electron）预留空间：
  - 在访问 `localStorage` 前做 `typeof window !== 'undefined'` 判断；
  - 或在组件挂载后再初始化 `sessionId`。  

**任务 8：规划流式对话实现（非必须）**

- 明确是否需要“流式打字机”效果：
  - 若需要，则：
    - 后端设计 SSE / WebSocket 接口；
    - 实现真正的 `streamUserInput`，在 UI 侧以增量形式更新最后一条 assistant 消息。
  - 若短期内不需要，可在文档中注明当前为占位实现。

**验收标准**：
- 关键目录在开启更严格 TS 规则后仍能编译通过；
- 新增代码默认在更严格规则下开发；
- 流式对话若被启用，有清晰的协议与前后端分工文档支撑。

---

## 4. 与现有文档的关系

- `docs/digital-human-architecture.md`：侧重**架构分层设计**与模块职责，本文件可视为其“稳定性提升”补充。  
- `docs/digital-human-roadmap.md`：描述长期功能演进（视觉 V2、Provider 抽象、记忆系统等），而本文件关注的是**当前代码基础上的缺陷修复与质量提升路线**。  
- `docs/development-process.md`：描述通用开发流程（迭代、测试、发布等），本文件的每个 Iteration 可直接映射到一个或多个开发迭代。

---

## 5. 建议执行顺序小结

1. **先完成 Iteration 1（P0 问题）**：确保前后端构建和 LLM 调用稳定，是后续迭代的前提。  
2. 然后推进 **Iteration 2（交互与体验统一）**：集中解决行为不一致和 UX 噪音问题。  
3. 在上述稳定后，再根据 `digital-human-roadmap.md` 中的长期规划，有选择地执行 Iteration 3 中的技术债优化与新能力扩展。
