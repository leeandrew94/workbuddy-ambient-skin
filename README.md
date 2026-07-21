# WorkBuddy Ambient Skin

WorkBuddy 不必一直是一块灰色的工作面板。

Ambient Skin 让首页留住一张你喜欢的画面；进入对话、任务或详情后，背景会自动安静下来。侧栏、输入框和菜单仍是 WorkBuddy 原来的样子，变化的只是工作空间的光线、颜色和气氛。

> 非腾讯官方产品。目前支持 macOS，不修改 `WorkBuddy.app`、`app.asar` 或应用签名。

## 它改变什么

- **改空间，不改控件**：保留原生交互，用 Material Layer 分别处理顶栏、侧栏、卡片、输入框和详情区。
- **知道什么时候收敛**：首页完整呈现，工作页降低对比度，详情页进一步淡出。
- **看得懂你的图片**：用 OKLCH 感知色彩提取主色与差异化辅色，并判断明暗、视觉焦点和文字安全区。
- **随时换，也随时退**：右上角切换主题；暂停或完整恢复都不碰官方安装文件。

## 一分钟开始

如果你在支持 Skill 的 AI 中使用它，直接说：

> 使用 `$workbuddy-ambient-skin` 给我的 WorkBuddy 换一个安静的皮肤。

AI 会按 [SKILL.md](SKILL.md) 检查环境、推荐主题，并在需要重启 WorkBuddy 前征得确认。

手动使用只需要三步：

```bash
scripts/workbuddy-ambient.sh doctor
scripts/workbuddy-ambient.sh list
scripts/workbuddy-ambient.sh apply --theme paper-aurora --restart confirmed
```

`apply` 会重启 WorkBuddy。请先保存未完成的输入或任务。完成后可运行：

首次应用会先返回 `handoff: true, status: pending`，然后由独立的 Graceful Handoff 正常退出并重新打开 WorkBuddy。它不会使用 `pkill`；如果应用拒绝正常退出，流程会安全停止。

```bash
scripts/workbuddy-ambient.sh verify
```

## 把自己的图片带进来

应用皮肤后，WorkBuddy 右上角会出现 `◐`。点击它，可以切换内置主题、选择本地图片，或暂时回到“原生界面”。

选择图片后，Ambient Skin 会在本机完成分析：

- 根据感知亮度中位数选择深色或浅色界面；
- 在 OKLCH 空间提取主色，并选择有足够色相距离的辅色；
- 自动校正强调色与文字色的对比度；
- 避开主体区域放置内容，并保留合适的背景焦点；
- 将图片缩放为最大边 1600px 的 WebP，减少常驻开销。

菜单最多保留最近 8 张图片。每张图片右侧的 `✎` 可以直接展开名称编辑器，`×` 会展开删除确认；两者都在菜单内完成，不依赖系统弹窗。重命名不会重新分析图片。

如果想通过命令长期管理图片主题：

```bash
scripts/workbuddy-ambient.sh create \
  --image "/absolute/path/background.webp" \
  --name "My Theme"
scripts/workbuddy-ambient.sh rename --theme THEME_ID --name "新名称"
scripts/workbuddy-ambient.sh delete --theme THEME_ID --confirm yes
```

命令行删除采用可恢复移除，文件会转移到本机的 `deleted-themes` 目录。内置主题不能删除或重命名。

支持 PNG、JPEG、WebP，单张不超过 15 MB、5000 万像素。纯背景图通常比带文字、按钮或界面截图的图片更自然。

## 内置主题

以下预览均为 WorkBuddy 实际应用主题后的界面效果。

### 晨雾极光 / Paper Aurora

浅灰与冰蓝组成的通透办公主题。背景由原创 CSS 渐变生成，聊天区保持克制，适合文档与日常工作。

<p align="center">
  <img src="assets/images/preview-paper-aurora.png" alt="晨雾极光主题预览" width="900"><br>
  <sub>浅色 · 原创渐变 · 真实 WorkBuddy 注入效果</sub>
</p>

```bash
scripts/workbuddy-ambient.sh apply --theme paper-aurora --restart confirmed
```

### 初音未来 · 猫咪女仆 / Miku Neko Maid

青色、柔白与轻粉构成的明亮主题。OKLCH 引擎会从图片自动生成界面配色，适合首页展示与轻松工作。

<p align="center">
  <img src="assets/images/preview-miku-neko-maid.png" alt="初音未来猫咪女仆主题预览" width="900"><br>
  <sub>青色明亮 · 自动取色 · 真实 WorkBuddy 注入效果</sub>
</p>

```bash
scripts/workbuddy-ambient.sh apply --theme miku-neko-maid --restart confirmed
```

### 哆啦A梦 · 瑞雪迎福 / Doraemon Snow Fortune

冰雪蓝、灯笼红与暖金光线构成的节日主题。工作页和详情页会自动降低壁纸强度，兼顾氛围与阅读。

<p align="center">
  <img src="assets/images/preview-doraemon-snow-fortune.png" alt="哆啦A梦瑞雪迎福主题预览" width="900"><br>
  <sub>冬日暖金 · 自动取色 · 真实 WorkBuddy 注入效果</sub>
</p>

```bash
scripts/workbuddy-ambient.sh apply --theme doraemon-snow-fortune --restart confirmed
```

两套角色主题使用项目维护者提供的图片。角色及素材相关权利归相应权利方所有；公开分发前请确认素材授权范围。

## 日常动作

| 想做什么 | 命令 |
|---|---|
| 查看主题 | `scripts/workbuddy-ambient.sh list` |
| 重命名图片主题 | `scripts/workbuddy-ambient.sh rename --theme THEME_ID --name "新名称"` |
| 删除图片主题 | `scripts/workbuddy-ambient.sh delete --theme THEME_ID --confirm yes` |
| 即时切换 | `scripts/workbuddy-ambient.sh switch --theme THEME_ID` |
| 查看状态 | `scripts/workbuddy-ambient.sh status` |
| 暂停皮肤 | `scripts/workbuddy-ambient.sh pause` |
| 完整恢复 | `scripts/workbuddy-ambient.sh restore --restart confirmed` |

`switch` 和 `pause` 需要当前皮肤会话仍在运行。WorkBuddy 完全退出后，再次执行 `apply` 即可。

## 保持原生的边界

Ambient Skin 通过仅绑定 `127.0.0.1` 的 Chrome DevTools Protocol 找到 WorkBuddy 渲染页，注入主题变量、背景样式和一个隔离的 Shadow DOM 菜单。它不重写页面业务逻辑，也没有 npm 运行时依赖。

这套方式有意保持轻量，但也有明确边界：

- 皮肤会话开启时，不要运行来源不明的本地程序；
- 当前只支持 macOS；
- WorkBuddy 若调整关键 DOM 或 `--cb-*` 变量，适配层可能需要更新；
- “完整恢复”会重启 WorkBuddy，并关闭用于皮肤会话的 CDP。

开发验证使用 `npm test` 和 `npm run check`。自定义主题格式见 [references/theme-schema.md](references/theme-schema.md)。

## 感谢

本项目参考了 [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) 的换肤设计理念，感谢其提供的创意启发。
