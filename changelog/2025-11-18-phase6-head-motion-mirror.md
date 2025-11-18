# 2025-11-18 Phase 6：点头/摇头视觉镜像

## 变更内容

- 扩展视觉服务：`src/core/vision/visionService.ts`
  - 新增 `MotionCallback` 类型和可选回调 `onMotion`，用于向上层报告头部动作：`'nod' | 'shakeHead'`。
  - 在 FaceMesh 结果处理中：
    - 基于关键点（眼睛、鼻尖、额头、下巴）估算头部朝向的 `yaw` 与 `pitch`。
    - 使用滑动窗口记录最近一段时间的 `yaw`/`pitch` 变化范围：
      - 当 `pitch` 变化幅度超过阈值而 `yaw` 较小，判定为点头 `nod`；
      - 当 `yaw` 变化幅度超过阈值而 `pitch` 较小，判定为摇头 `shakeHead`。
    - 检测到动作后清空历史窗口，避免连续抖动导致多次误触发。
- 扩展视觉镜像面板：`src/components/VisionMirrorPanel.tsx`
  - `VisionMirrorPanelProps` 新增可选 `onHeadMotion(motion)` 回调。
  - 在调用 `visionService.start` 时传入 `onHeadMotion`，将检测到的 `nod` / `shakeHead` 上抛给页面。
- 集成到高级数字人页面：`src/pages/AdvancedDigitalHumanPage.tsx`
  - 在 `vision` 标签页中，为 `VisionMirrorPanel` 传入 `onHeadMotion`：
    - 收到 `nod` 时调用 `digitalHumanEngine.playAnimation('nod')`；
    - 收到 `shakeHead` 时调用 `digitalHumanEngine.playAnimation('shakeHead')`。

## 目的

- 在现有“表情镜像”的基础上，增加基础的“点头/摇头”动作镜像能力：
  - 用户上下点头 → 数字人触发 `nod` 动画；
  - 用户左右摇头 → 数字人触发 `shakeHead` 动画。

## 备注

- 当前实现采用基于人脸关键点的简单阈值和滑动窗口检测策略，适用于 Demo 级别的动作镜像效果；
- 后续可根据实际模型动画与交互体验，进一步调节阈值或引入更鲁棒的头部姿态估计方法。
