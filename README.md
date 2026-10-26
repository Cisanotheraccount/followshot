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

参考素材为原创 SVG 咖啡插画。分析结果为预设；相机、Take 和发布均为模拟。本网页不请求摄像头权限、不上传素材、不向 TikTok 发布、不生成视频文件。与 TikTok / ByteDance 无隶属或背书关系。ShotPAI 原生 App 不属于此仓库。

Reference imagery consists of original coffee-themed SVG illustrations. Analysis is preset; the camera, takes, and publishing are simulated. This site does not request camera access, upload footage, publish to TikTok, or export a video file. It is not affiliated with or endorsed by TikTok / ByteDance. The native ShotPAI app is not part of this repository.

## 部署 / Deployment

目标地址 / Intended URL: **https://galaxci.com/followshot/**

GitHub Pages 使用独立项目仓库，自动部署 `main` 分支中的 `site/`。所有资源使用相对路径，适用于 `/followshot/`。此仓库不设置 CNAME，也不修改主站或 DNS。项目站点继承同一账号用户站点的自定义域名。公开访问与源码仓库可见性是不同设置；是否可用取决于 GitHub 套餐。

GitHub Pages deploys only `site/` from the independent repository's `main` branch. Relative asset paths work under `/followshot/`. This repository has no CNAME and does not change the main site or DNS. A project site inherits the same account's user-site custom domain. Public website access and source repository visibility are separate settings, subject to GitHub plan availability.

[GitHub: custom domains across repositories](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages#using-a-custom-domain-across-multiple-repositories)
