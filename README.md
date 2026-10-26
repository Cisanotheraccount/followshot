# FOLLOW/SHOT · 跟拍学习

一个可操作、可中英切换的非官方产品概念：从参考视频的分享面板进入，确认可编辑的四镜拍摄单，逐镜模拟拍摄、选择 Take、预览、保存草稿并确认模拟发布。

An interactive, bilingual, unofficial product concept: start from a reference video's share sheet, edit a four-shot plan, simulate filming, choose takes, preview a story, save a draft, and confirm simulated publishing.

## 运行 / Run

无需安装依赖。使用 Node.js 18+ 运行测试，使用现有静态服务器预览 `site/`。

No dependencies to install. Run tests with Node.js 18+ and serve `site/` with an existing static server.

```sh
npm test
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000/`.

## 语言与本地草稿 / Language and local drafts

导航栏的中文 / EN 按钮同时切换说明页面与模拟界面；语言选择保存在本浏览器。切换保留当前镜头、进度、Take、弹窗与用户输入。用户输入的标题和提示不自动翻译。草稿与语言使用独立存储键；重置演示不重置语言。清除浏览器站点数据会清除本地草稿。

The 中文 / EN buttons switch both the explanation site and simulator. Language preference stays in this browser. Switching preserves the current shot, progress, takes, dialog, and user input. Creator-written titles and prompts are never automatically translated. Draft and language use separate storage keys; resetting the demo keeps the selected language. Clearing browser site data clears local drafts.

## 真实边界 / Simulation boundaries

参考素材为创作者提供并明确授权公开使用的《摄影最大的遗憾》：38.033 秒竖屏影像，包含原片中文字幕与音轨。网页托管完整 1080×1920 版本，并用完整时长的 540×960 版本作轻量预览。四个示例片段由人工选定（00:00、00:06、00:18、00:33），不是实时 AI 识别的镜头切点。镜头卡里的 3/3/4/3 秒是可编辑的练习建议，不是原片分段长度。

The reference is the creator-owned film “The photographer’s biggest regret”, explicitly authorized for this public concept website and source repository. Its complete 38.033-second portrait video, burned-in Chinese subtitles, and audio are preserved. The site hosts a full 1080×1920 copy and a full-duration 540×960 lightweight preview. The four illustrative windows (00:00, 00:06, 00:18, 00:33) were selected manually, not by live AI or automatic cut detection. The editable 3/3/4/3-second shot durations are practice suggestions, not original cut lengths.

拍摄、Take 和发布仍为模拟。回看与成片界面播放的是原片窗口，不是用户新拍摄的素材。本网页不请求摄像头权限、不上传用户素材、不向 TikTok 发布、不生成新视频文件。与 TikTok / ByteDance 无隶属或背书关系。ShotPAI 原生 App 不属于此仓库。

The camera, takes, and publishing remain simulated. Review and story preview reuse source-footage windows; they are not newly recorded user clips. This page does not access a camera, upload user footage, post to TikTok, or export a new video. It is not affiliated with or endorsed by TikTok / ByteDance. The native ShotPAI app is outside this repository.

## 影像与字体 / Media and typography

- `site/media/reference-manifest.json` records public media metadata and manual reference windows, without private source paths.
- Decorative playback is muted and optional. It pauses off-screen or when the document is hidden, respects reduced-motion settings, and has an explicit pause/play control. The full player exposes standard browser controls and audio.
- TikTok Sans is self-hosted from [the official open-source family](https://github.com/tiktok/TikTokSans), distributed by [Google Fonts](https://github.com/google/fonts/tree/main/ofl/tiktoksans). Its SIL Open Font License is included in `site/media/fonts/OFL-TikTokSans.txt`. System Chinese sans-serif fallbacks preserve bilingual legibility. No TikTok logo is used.
- CSS and script URLs carry a release version so an older cached stylesheet cannot hide the latest guide.

## 部署 / Deployment

目标地址 / Intended URL: **https://galaxci.com/followshot/**

GitHub Pages 使用独立项目仓库，自动部署 `main` 分支中的 `site/`。所有资源使用相对路径，适用于 `/followshot/`。此仓库不设置 CNAME，也不修改主站或 DNS。项目站点继承同一账号用户站点的自定义域名。公开访问与源码仓库可见性是不同设置；是否可用取决于 GitHub 套餐。

GitHub Pages deploys only `site/` from the independent repository's `main` branch. Relative asset paths work under `/followshot/`. This repository has no CNAME and does not change the main site or DNS. A project site inherits the same account's user-site custom domain. Public website access and source repository visibility are separate settings, subject to GitHub plan availability.

[GitHub: custom domains across repositories](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages#using-a-custom-domain-across-multiple-repositories)

## Readability and step guide / 字级与操作引导

Both languages use three text levels: body 18px (mobile 16px), subtitle 24px (22px), and heading 64px (40px). Body weight is 500, controls 600, headings 700.

The simulator keeps an ordinary 390×844 portrait-handset proportion rather than compressing into a wide device on short desktop viewports. Short neutral hints sit beside the actual control; there is no second Next button and no Next badge. Confirmation and reset dialogs contain only their own disclosure and explicit cancel/confirm controls, with no guide overlay. The recording action is explicitly simulated. Hide tips at any time; Start / replay step guide returns to the current step without clearing work. Guide preference uses its own local key `followshot-guide-v1`. Hints use regular layout and readable text, not an outside blue outline that can be clipped.

`npm test` includes state/i18n and guide regressions, legacy-authored-text preservation, real-media playback controls, and relative asset/MP4/JPEG/manifest checks. VM tests use deterministic timers and a stubbed DOM; actual rendering, media decoding, and browser-engine checks are separate. `npm run dev -- --host 0.0.0.0 --port 4173 --strictPort` provides a dependency-free local preview with byte-range video support.
