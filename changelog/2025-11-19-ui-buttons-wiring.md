# 2025-11-19 前端控制面板按钮逻辑接线

## 变更内容

- 更新 `DigitalHumanViewer`：
  - 引入 `useDigitalHumanStore`，根据 store 中的状态驱动占位数字人模型：
    - 使用简单几何（身体、头部、双臂）和旋转/缩放来模拟：
      - 表情（`currentExpression`）：微笑/大笑/惊讶/悲伤/愤怒等通过头部大小、位置、轻微倾斜体现；
      - 动画（`currentAnimation`）：
        - `nod` / `shakeHead`：头部上下/左右点头、摇头；
        - `raiseHand` / `waveHand`：右手抬起或挥动；
        - `greeting`：等价于挥手动画；
        - `excited`：双臂大幅摆动；
        - `listening` / `thinking` / `speaking`：通过头部轻微倾斜、点头表达当前状态；
      - 播放状态（`isPlaying`）：仅在播放状态下启用全局摇摆和时间驱动动画；
      - 说话状态（`isSpeaking`）：在说话时叠加轻微的头部点动效果。
  - 这样一来，基础控制面板、行为面板、表情面板等更新 store 的操作，都能在 3D 视图中有直观反馈。

- 更新 `DigitalHumanEngine.playAnimation`：
  - 调用时除了设置 `currentAnimation`，还会自动将 `isPlaying` 置为 `true`：
    - 确保通过行为面板、视觉识别（点头/摇头/举手/挥手）或 LLM 动作触发动画时，数字人不会停留在暂停状态，看起来“点了没反应”。

- 更新 `AdvancedDigitalHumanPage`：
  - 在 `handleBehaviorChange` 中增加对 `digitalHumanEngine.playAnimation(behavior)` 的调用：
    - 行为控制面板选择的行为（`idle`/`greeting`/`listening`/`thinking`/`speaking`/`excited`）会对应到 `currentAnimation`，由 `DigitalHumanViewer` 中的占位模型做出相应动作反馈。

## 效果

- **基础控制面板**：
  - 播放/暂停按钮现在会明显控制数字人整体是否在“动”（全局摇摆与呼吸效果）。
- **表情控制面板**：
  - 点击不同表情按钮会立即改变头部的大小、位置或轻微姿态，用户可以直观看到表情变化。
- **行为控制面板**：
  - 选择“打招呼”“兴奋”“倾听”“思考”“说话”等行为时，占位数字人会通过头部和手臂的动作表现对应状态，不再只是文字提示。

## 备注

- 目前仍然使用简化的占位模型（盒子 + 球 + 手臂）来模拟数字人行为，遵循 KISS 原则，仅用最小可行的几何变化提供按钮点击反馈。
- 后续如果替换为真实 MetaHuman / VRM 模型，只需要在新的 3D 驱动层中同样根据 `currentExpression` 和 `currentAnimation` 做映射，无需修改控制面板和 store 逻辑。
