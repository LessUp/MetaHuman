# 数字人系统架构设计（含后端与视觉镜像）

## 1. 设计目标

- 提供一个基于 Web 的 3D 数字人客户端（现有 Vite + React + TS 项目）。
- 引入后端服务，承载对话大脑、业务逻辑和可选的云端语音能力。
- 支持视觉镜像能力：用户表情和动作驱动数字人（“我笑它也笑，我怎么动，它也怎么动”）。
- 目前按“只有少量基础动画 clip”进行设计，保证实现简单可落地（KISS）。
- 整体架构前后端分层清晰，支持后续渐进式扩展。

---

## 2. 系统总体架构

### 2.1 组件划分

- 前端 Web 客户端（本仓库现有项目）
  - UI / 页面 / 控制面板
  - 数字人引擎：3D 模型、动画、表情、嘴型驱动
  - 语音交互：ASR / TTS 调用与状态管理
  - 视觉感知：摄像头采集 + 表情 / 姿态识别 + 映射

- 后端 Digital Human Service（后续在本仓库新增 `server/`）
  - 对话大脑：对接 LLM / 规则引擎 / 知识库
  - 会话管理：session 管理、多轮上下文
  - 语音服务代理（可选）：对接云 TTS / ASR
  - 业务集成：不同场景（客服、导览等）的配置与逻辑

- 外部服务
  - LLM 提供商：OpenAI / Kimi 等
  - 语音能力：云 TTS / ASR（可选）

### 2.2 核心数据流

1. **语音/文本对话链路**
   - 用户语音 → 前端 `audioService` → 文本 → 后端 `/v1/chat` → LLM → 回复文本 + 意图/情绪/动作 → 前端 `DigitalHumanEngine` + UI 展示。

2. **视觉镜像链路**
   - 用户视频（摄像头）→ 前端 `visionService`（关键点/姿态）→ `visionMapper`（表情/动作分类）→ `DigitalHumanEngine`（表情/动画指令）→ Three.js 数字人表现。

3. **状态同步**
   - 所有可视状态（播放、表情、情绪、录音、说话、摄像头开启等）统一收敛到 `digitalHumanStore`，UI 只绑定 store，不直接控制底层服务。

---

## 3. 前端架构设计

### 3.1 目标目录结构

```text
src/
  core/
    avatar/
      DigitalHumanEngine.ts      # 数字人引擎，统一驱动 3D 模型的表情 / 动画 / 嘴型
    audio/
      audioService.ts            # ASR / TTS 封装，负责音频相关逻辑
    dialogue/
      dialogueService.ts         # 对话大脑封装，负责与后端 /v1/chat 交互
    vision/
      visionService.ts           # 摄像头 + 视觉模型（表情 / 姿态关键点）
      visionMapper.ts            # 关键点 → emotion / pose / action 的规则映射

  store/
    digitalHumanStore.ts         # 数字人整体 UI / 引擎状态

  modules/
    interactive-demo/
      pages/
      components/

  pages/
  components/
```

### 3.2 模块职责说明

- `core/avatar/DigitalHumanEngine.ts`
  - 对外暴露统一控制接口：
    - 播放控制：`play()`, `pause()`, `reset()`
    - 表情控制：`setExpression(expression)`, `setEmotion(emotion)`
    - 动画控制：`playAnimation(name)`（基于有限动画 clip）
    - 语音驱动：`onSpeakStart(text)`, `onSpeakEnd()`
    - 视觉驱动：`applyVisualEmotion(emotion)`, `applyVisualPose(pose)`, `applyVisualAction(action)`
  - 内部与 3D Viewer 组件（`DigitalHumanViewer`）交互，更新模型的动画和参数。

- `core/audio/audioService.ts`
  - 封装当前的 `TTSService` / `ASRService`，不再直接放在 store 内。
  - 对外接口示例：
    - `startListening()` / `stopListening()` → 控制 ASR
    - `speak(text, options?)` → 控制 TTS（可选由后端返回音频 URL）
  - 通过回调或事件通知：录音状态、说话状态、错误信息，并更新 `digitalHumanStore`。

- `core/dialogue/dialogueService.ts`
  - 封装与后端 `/v1/chat` 的交互：
    - `sendUserInput({ text, context }) → { replyText, intent, emotion, action }`
  - 将 LLM 输出转换为数字人可理解的高层指令：
    - 文本回复（给 UI 显示/朗读）
    - 目标情绪（`happy/neutral/...`）
    - 目标动作（`wave`, `greet`, `think` 等）

- `core/vision/visionService.ts`
  - 管理摄像头：请求权限、打开/关闭视频流。
  - 初始化 Web 端视觉模型（如 MediaPipe Face Landmarker / Pose Landmarker）。
  - 每帧或每 N 帧输出原始视觉特征：
    - 人脸关键点（嘴角、眼睛、眉毛等）
    - 姿态关键点（头部朝向、肩膀、手的位置等）

- `core/vision/visionMapper.ts`
  - 将原始关键点转换为简化状态：
    - `userEmotion`: `happy | neutral | surprised | sad | angry`（可以从中选择子集）
    - `facePose`: `{ yaw, pitch, roll }`（头的左右 / 上下 / 倾斜）
    - `userActions`: `headNod | headShake | raiseHand | waveHand | none` 等
  - 做简单平滑与去抖动，避免数字人表情/动作频繁抖动。
  - 调用 `DigitalHumanEngine` 的视觉驱动接口进行更新。

- `store/digitalHumanStore.ts`
  - 保持 KISS，只存状态，不直接调用浏览器 API：
    - 播放相关：`isPlaying`, `currentAnimation`
    - 语音相关：`isRecording`, `isMuted`, `isSpeaking`
    - 表情/情绪：`currentEmotion`, `currentExpression`
    - 系统状态：`isConnected`, `isLoading`, `error`
    - 视觉相关（新增）：`isCameraOn`, `userEmotion`, `userPose`, `lastAction`
  - 提供 setter 和简单动作（不包含底层实现细节）。

UI 层（`pages` / `components`）只依赖 store 和各 Service 暴露的高层接口，不直接与 Web API / 三方 SDK 打交道。

---

## 4. 后端架构设计（Digital Human Service）

### 4.1 目录和角色

后端计划放在本仓库 `server/` 目录（技术栈可选 Node.js + Express / NestJS 或 Python + FastAPI，这里只做架构抽象）：

```text
server/
  src/
    api/
      chat.controller.ts      # /v1/chat
      asr.controller.ts       # /v1/asr （可选）
      tts.controller.ts       # /v1/tts （可选）
    services/
      dialogue.service.ts     # LLM 调用与对话管理
      intent.service.ts       # 意图识别与动作/情绪决策
      session.service.ts      # 会话状态管理
      tts.service.ts          # 云 TTS 代理（可选）
      asr.service.ts          # 云 ASR 代理（可选）
```

后端主要职责：

- 封装对 LLM 服务的调用（prompt 管理、重试与限流）。
- 根据 LLM 输出和简单规则生成：
  - `replyText`：数字人要说的话
  - `emotion`：`happy/neutral/...`
  - `action`：`wave/greet/think/...`
- 管理会话 session（多轮对话上下文）。
- 作为 TTS / ASR 代理（如果前端不直接调用云服务）。

### 4.2 API 设计（初版）

- `POST /v1/chat`
  - 请求：
    - `sessionId`: string
    - `userText`: string
    - `meta`（可选）：用户情绪、视觉状态、场景 ID 等
  - 响应：
    - `replyText`: string
    - `emotion`: `happy | neutral | ...`
    - `action`: `wave | greet | idle | ...`
    - `extra`（可选）：LLM 原始信息等

- `POST /v1/asr`（可选）
  - 前端上传音频片段，后端调用云 ASR，返回文本。

- `POST /v1/tts`（可选）
  - 前端上传文本，后端调用云 TTS，返回音频 URL 或二进制数据。

初期可以只实现 `/v1/chat`，语音仍基于浏览器原生 Web Speech API，后续再迁移到云服务。

---

## 5. 视觉镜像设计（按有限动画设计）

### 5.1 前提假设

- 现有 3D 模型只提供有限动画 clip，例如：
  - `idle`：待机
  - `wave`：挥手
  - `greet`：打招呼
  - `nod`：点头
  - `shakeHead`：摇头
  - `smile`：微笑表情动画（或通过 blendshape 实现）
- 没有完整骨骼驱动的一比一动作复制，采用“事件触发预制动画”的方式实现“我怎么动，它也怎么动”的近似体验。

### 5.2 表情镜像：我笑它也笑

1. `visionService` 使用人脸关键点模型（如 MediaPipe Face Landmarker）。
2. `visionMapper` 按关键点几何特征进行简单分类：
   - `happy`：嘴角上扬、眼睛轻微弯曲
   - `surprised`：嘴巴大幅张开、眉毛上抬
   - `neutral`：关键点处于中性位置
3. 对识别结果做时间平滑：连续若干帧都判定为同一情绪才切换。
4. 将结果映射到数字人表情：
   - `happy` → `setExpression('smile')`, `setEmotion('happy')`
   - `surprised` → `setExpression('surprise')`, `setEmotion('surprised')`
   - `neutral` → `setExpression('neutral')`, `setEmotion('neutral')`

### 5.3 头部动作镜像：点头 / 摇头

1. 从人脸关键点或 3D 姿态中估计头部欧拉角 `{ yaw, pitch, roll }`。
2. 计算短时间内角度变化：
   - `pitch` 上下往返 → `headNod`
   - `yaw` 左右往返 → `headShake`
3. 映射到数字人：
   - `headNod` → 触发 `playAnimation('nod')`
   - `headShake` → 触发 `playAnimation('shakeHead')`

### 5.4 上半身动作镜像：举手 / 挥手（后续阶段）

1. 使用 Pose 模型获取肩膀、手腕关键点。
2. 简单规则：
   - 手腕高度 > 肩膀高度 → `raiseHand`
   - 手在脸附近左右快速移动 → `waveHand`
3. 映射到数字人：
   - `raiseHand` 或 `waveHand` → `playAnimation('wave')` 或类似动画。

整个视觉链路保持在前端完成，后端只需要知道用户高层状态（例如作为 LLM 提示的补充信息），不处理视频流。

---

## 6. 渐进式重构路线图

### 阶段 1：前端分层与服务抽取（不依赖后端）

目标：
- 把当前 `digitalHumanStore.ts` 中的 TTS/ASR 逻辑迁移到 `core/audio/audioService.ts`。
- 设计并实现 `DigitalHumanEngine`，统一管理 3D 模型的动画和表情。
- 页面和组件不再直接使用浏览器语音 API，而是通过 `audioService` / store。

主要任务：
- 新增 `core/avatar/DigitalHumanEngine.ts`，将播放/表情/动画相关控制集中在此文件。
- 新增 `core/audio/audioService.ts`，封装现有 `TTSService` / `ASRService`，改为事件驱动更新 store。
- 调整 `DigitalHumanPage`、`AdvancedDigitalHumanPage`，改用新的 service 接口。

### 阶段 2：引入后端对话服务

目标：
- 在仓库中新建 `server/` 后端工程，至少实现 `/v1/chat` 接口。
- 创建前端 `dialogueService`，将所有对话请求指向后端。

主要任务：
- 设计 `/v1/chat` 请求/响应结构，集成 LLM 服务。
- 后端根据业务场景，为每个场景配置不同 Prompt / 行为风格。
- 前端 `dialogueService`：
  - 发送用户输入（文本）和上下文（如场景 ID、用户情绪）。
  - 接收 `replyText`、`emotion`、`action`，驱动 `DigitalHumanEngine` 和 `audioService`（TTS）。

### 阶段 3：实现视觉镜像 V1（表情 + 点头/摇头）

目标：
- 前端实现 `visionService` + `visionMapper`，完成“我笑它也笑”和“点头/摇头”映射。

主要任务：
- 新增 `core/vision/visionService.ts`：对接摄像头与视觉模型。
- 新增 `core/vision/visionMapper.ts`：实现简单表情/动作规则与平滑逻辑。
- 扩展 `digitalHumanStore` 加入摄像头与视觉相关状态。
- 控制面板新增“开启/关闭摄像头”控制项。

### 阶段 4：扩展上半身动作与体验优化

目标：
- 支持举手/挥手等上半身动作的识别与映射。
- 优化视觉与语音/对话的协同体验（例如根据用户情绪调整说话语气或回复内容）。

主要任务：
- 在 `visionMapper` 中增加上半身动作规则。
- 在后端 `/v1/chat` 增加视觉状态输入（如用户情绪、动作），让 LLM 根据视觉信息调整回复。

---

## 7. 说明

- 本设计文档遵循 KISS 原则：优先使用前端 Web 能力和简单规则实现“足够好”的体验，再在此基础上迭代增强。
- 当前所有设计均以“有限动画 clip” 为前提，后续如果更换为复杂的骨骼动画 / 全身驱动，可以在 `DigitalHumanEngine` 中扩展接口，而无需大改 UI / Service 层。
