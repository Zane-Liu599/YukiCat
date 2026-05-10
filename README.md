# YukiCat

YukiCat 是一个适用于 macOS 的桌面猫咪原型。Yuki 是一只布偶猫风格的小猫，默认处于 idle 状态，蹲在桌面上看着你，可以直接拖动它来改变位置。

## 运行

```bash
npm install
npm start
```

## 打包 macOS 应用

```bash
npm run dist
```

打包产物会出现在 `dist/` 目录中。

## 当前功能

- 透明无边框桌面宠物窗口
- macOS 上隐藏 Dock 图标并保持置顶
- 使用 `src/renderer/assets/yuki-sit-right.png` 作为猫咪形象
- idle 动画：轻微呼吸、眨眼
- 支持通过 `src/renderer/animations.json` 配置逐帧动画
- 行为动画：正面坐姿和侧面坐姿切换、短距离爬行并移动窗口
- 拖动猫咪区域即可移动位置
- 鼠标悬停时右上角会显示退出按钮

## 动画帧接口

把拆分好的 PNG 放到 `src/renderer/assets/frames/` 下面，然后在 `src/renderer/animations.json` 里填入对应序列即可。

建议目录：

```text
src/renderer/assets/frames/idle/
src/renderer/assets/frames/blink/
src/renderer/assets/frames/turn-front-to-side/
src/renderer/assets/frames/turn-side-to-front/
src/renderer/assets/frames/crawl/
```

当前已接入 `src/renderer/assets/frames/sit-right/` 里的 4 张向右坐姿帧。帧图已使用统一透明画布，并按猫身体底部中心点对齐，减少播放时的位置跳动。

当前已接入 `src/renderer/assets/frames/turn-side-to-front/` 里的 6 张侧面转正面帧。应用会按顺序播放侧面到正面，并用同一组帧倒放回到侧面坐姿。

当前已接入 `src/renderer/assets/frames/turn-back-to-side/` 里的 6 张背面转侧面帧。应用会用倒放先从侧面转到背面，再播放背面回侧面。

当前已接入 `src/renderer/assets/frames/turn-front-to-back/` 里的 14 张视频抽帧。视频黑底已移除，水印作为非主体组件被排除；应用会在侧面转正面后播放正面到背面，再停留并反向回来。

转身行为会在目标朝向停留约 5.5 到 9 秒，再转回侧面，不会刚转过去就立刻返回。所有运行时帧统一使用 `483x513` 透明画布。

每个序列支持：

- `fps`：每秒帧数
- `loop`：是否循环
- `frames`：图片路径数组，路径相对 `src/renderer/index.html`
