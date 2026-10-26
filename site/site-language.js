/* Local-only language preference. Never rewrites a creator's draft or input. */
(() => {
  'use strict';
  const key = 'followshot-language-v1';
  let language = 'zh';
  try { language = localStorage.getItem(key) === 'en' ? 'en' : 'zh'; } catch (_) {}
  const copy = {
    '跟拍学习': 'Followshot',
    '为什么': 'Why',
    '如何工作': 'How it works',
    '设计思考': 'Design notes',
    '体验原型 <svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg>': 'Try it <svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg>',
    '<span></span> TIKTOK 功能探索 · 非官方概念演示': '<span></span> TIKTOK FEATURE EXPLORATION · UNOFFICIAL CONCEPT',
    '不止看懂。<br>开始<span class="underline">拍懂。</span>': 'See the story.<br><span class="underline">Make it yours.</span>',
    '把「我也想拍」变成下一步。<br>从一条灵感视频，拆出你能完成的拍摄步骤。': 'Turn “I want to try that” into a next step.<br>Break an inspiring video into shots you can make.',
    '亲手拍一个故事 <span><svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg></span>': 'Make your own story <span><svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg></span>',
    '无需登录 · 2–3 分钟体验 · 全程模拟': 'No sign-in · 2–3 minutes · Fully simulated',
    '喜欢这个镜头？<b>从这里开始拍。</b>': 'Love that shot?<b>Start making it here.</b>',
    '灵感不是终点。': 'Inspiration is just the start.',
    '收藏了很多。<br>还是不知道<br>第一镜怎么拍。': 'So many saves.<br>Still unsure<br>where to start.',
    '为有表达欲、还没有镜头语言的新手创作者，补上「看」与「拍」之间的一步。': 'A bridge from watching to making, for new creators with something to say and a visual language still taking shape.',
    '现在 / WATCH': 'TODAY / WATCH',
    '反复回看 → 自己猜镜头<br>切换相机 → 忘记动作<br>拍完才发现 → 素材不够': 'Watch again → guess the shot<br>Open the camera → forget the move<br>Finish filming → find missing footage',
    '我们希望 / MAKE': 'THE GOAL / MAKE',
    '看懂结构 → 调整拍摄单<br>一镜一提示 → 边拍边确认<br>保留自己的素材 → 完成故事': 'See the structure → adapt the plan<br>One prompt per shot → check as you go<br>Keep your own footage → finish a story',
    '设计假设，不是已验证的增长结论。目标是帮助学习拍摄，而不是复制他人内容。': 'A design hypothesis, not a proven growth claim. The goal is to learn how to film, rather than copy someone else’s content.',
    '你来拍。<br>每一镜，<br>有个方向。': 'Your camera.<br>A clear next step.<br>Every shot.',
    '试着把「一杯手冲的早晨」<br>变成你自己的四镜小故事。': 'Take “A pour-over morning”<br>and make your own four-shot story.',
    '这是可操作的高保真模拟，不是 TikTok。<br>AI 分析使用预设；相机和发布均为模拟。<br>不读取摄像头，不上传素材，不发布到平台。': 'An interactive concept, not TikTok.<br>Analysis is preset; camera and publishing are simulated.<br>No camera access, uploads, or platform posts.',
    '↺ 重新开始演示': '↺ Restart the demo',
    'LIVE PROTOTYPE <span>•</span> 点击手机内的按钮开始': 'LIVE PROTOTYPE <span>•</span> Tap inside the phone to begin',
    '交互可操作 / 草稿留在本浏览器': 'Interactive / Drafts stay in this browser',
    '一个故事。<br>四个可执行的镜头。': 'One story.<br>Four shots you can make.',
    '参考视频保留在旁边，<br>拍什么、怎么拍、拍多久，清清楚楚。': 'Keep the reference close.<br>Know what to film, how to frame it, and how long to hold.',
    '先交代环境': 'Set the scene',
    '全景 · 固定机位 · 3 秒<br>让观众知道故事在哪里开始。': 'Wide · Static camera · 3 seconds<br>Show where the story begins.',
    '让细节说话': 'Let the details speak',
    '特写 · 缓慢推进 · 3 秒<br>靠近咖啡粉，抓住质感。': 'Close-up · Slow push-in · 3 seconds<br>Get close to the coffee grounds and their texture.',
    '拍下关键动作': 'Capture the key action',
    '近景 · 侧上方 · 4 秒<br>跟随水流，留完整动作。': 'Close shot · High side angle · 4 seconds<br>Follow the pour from start to finish.',
    '给故事一个结尾': 'Give the story an ending',
    '中景 · 轻微拉远 · 3 秒<br>用成品收束，让作品完整。': 'Medium · Gentle pull-back · 3 seconds<br>Close the story with the finished cup.',
    '学的是拍法。<br>作品，仍然是你的。': 'Learn the technique.<br>The story stays yours.',
    '入口不打断灵感': 'Start where inspiration happens',
    '从视频的分享面板进入「跟拍学习」，不另建一个需要寻找的工作台。': 'Open Followshot from a video’s share sheet, right where the idea catches your attention.',
    'AI 建议，不替你决定': 'AI suggests. You decide.',
    '镜头顺序、时长和拍摄提示可编辑。原片始终能回看；分析失败可以重试或使用预设。': 'Edit the shot order, duration, and prompts. Revisit the reference anytime, or retry analysis and use a preset when needed.',
    '重拍不是从头再来': 'Retake without starting over',
    '旧版本先保留，新版本确认后才替换。每个镜头独立完成，离开也能恢复本地草稿。': 'Keep earlier takes until you choose a new one. Finish each shot independently and return to your local draft later.',
    '查看 User Flow 与低保真结构 <span>+</span>': 'Explore the user flow and wireframes <span>+</span>',
    '刷到参考 <b>→</b> 分享 / 跟拍学习 <b>→</b> 分析与确认 <b>→</b> 编辑镜头卡 <b>→</b> 逐镜拍摄 <b>→</b> 回看重拍 <b>→</b> 预览 / 模拟发布': 'Find a reference <b>→</b> Share / Followshot <b>→</b> Analyze and review <b>→</b> Edit shot cards <b>→</b> Film each shot <b>→</b> Review and retake <b>→</b> Preview / simulate publishing',
    '参考画面': 'Reference frame',
    '分享 → 跟拍学习': 'Share → Followshot',
    '01 镜头卡 / 时长': '01 Shot card / duration',
    '02 镜头卡 / 提示': '02 Shot card / prompt',
    '03 镜头卡 / 排序': '03 Shot card / order',
    '开始拍摄': 'Start filming',
    '取景 / 构图辅助': 'Viewfinder / framing guide',
    '拍摄提示 + 录制': 'Shot prompt + record',
    '预览成片': 'Preview the story',
    '草稿 / 明确确认': 'Draft / explicit confirmation',
    '与已有创作能力，如何区分？ <span>+</span>': 'How does this relate to existing tools? <span>+</span>',
    '已有方向': 'Existing approach',
    '主要关注': 'Main focus',
    '本概念的探索边界': 'What this concept explores',
    '与现有内容互动、接续或参与话题': 'Responding to content, continuing it, or joining a trend',
    '参考 → 可编辑的现实拍摄步骤 → 用自己的素材完成独立作品。<br><br>能力存在重叠；不是「市场空白」声明。': 'Reference → editable real-world filming steps → an independent story made with your own footage.<br><br>These capabilities overlap; this is not a claim of an unserved market.',
    'Studio AutoCut / 剪辑模板': 'Studio AutoCut / editing templates',
    '组织、编辑已有素材': 'Organizing and editing existing footage',
    'CapCut Storyboards / AI 创意工具': 'CapCut Storyboards / AI creative tools',
    '计划、脚本与创作辅助': 'Planning, scripting, and creative assistance',
    '技术复用、真实边界与下一步验证 <span>+</span>': 'Technical reuse, limitations, and what to test next <span>+</span>',
    '可以复用什么': 'What could be reused',
    'ShotPAI 中 TransNetV2 / Core ML 的镜头切分思路可用于候选边界。切分≠理解拍摄意图；语义提示仍需要独立模型与人工确认。': 'ShotPAI’s TransNetV2 / Core ML approach can suggest shot boundaries. Detecting cuts does not reveal filming intent; semantic prompts still need a separate model and human review.',
    '当前做到哪里': 'What works today',
    '此页面为独立前端模拟。使用自制 SVG 参考、预设分析及模拟 Take；没有接入 TikTok、AI 推理或真实摄像头。原有 App 未在此修改。': 'This is an independent frontend simulation with original SVG references, preset analysis, and simulated takes. It does not connect to TikTok, AI inference, or a real camera. The existing app is unchanged.',
    '怎样判断是否有用': 'How to test its value',
    '下一轮邀请新手完成相同拍摄任务，观察首次开拍时间、独立完成率、提示理解和成片结构。先验证行为，再讨论增长。': 'Ask beginners to complete the same filming task. Observe time to first shot, independent completion, prompt comprehension, and story structure. Validate behavior before discussing growth.',
    '下一个好故事，<br>从你的第一镜开始。': 'Your next good story<br>starts with one shot.',
    '开始我的第一镜 <svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg>': 'Make my first shot <svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg>',
    '跟拍学习 · 非官方概念演示<br>与 TikTok / ByteDance 无隶属或背书关系。所有演示影像为自制插画。': 'Followshot · Unofficial concept demo<br>Not affiliated with or endorsed by TikTok / ByteDance. All demo imagery is original illustration.',
    '视觉研究：TikTok About <svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg>': 'Visual reference: TikTok About <svg class="ui-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" fill="none" stroke="currentColor" stroke-width="2"></path></svg>'
  };
  const attributes = {
    '原创咖啡场景插画': 'Original coffee scene illustration',
    '注水动作插画': 'Pouring action illustration',
    '建立场景镜头': 'Establishing shot',
    '特写镜头': 'Detail shot',
    '动作镜头': 'Action shot',
    '成果镜头': 'Final result shot'
  };
  // Capture the original static elements before the simulator is rendered.
  const elements = [...document.querySelectorAll('body *')]
    .filter(el => Object.prototype.hasOwnProperty.call(copy, el.innerHTML))
    .map(el => ({el, zh:el.innerHTML, en:copy[el.innerHTML]}));
  const images = [...document.querySelectorAll('img[alt]')]
    .filter(el => attributes[el.alt])
    .map(el => ({el, zh:el.alt, en:attributes[el.alt]}));
  window.FollowshotLocale = {get language() { return language; }, t:(zh,en) => language === 'en' ? en : zh};
  function apply() {
    document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    document.title = language === 'en' ? 'Followshot — From watching to making.' : '跟拍学习 — From watching to making.';
    document.querySelector('meta[name="description"]').content = language === 'en'
      ? 'Followshot: turn an inspiring video into a story of your own. An interactive, unofficial product concept.'
      : '跟拍学习：从喜欢一个视频，到拍出自己的故事。可操作的非官方产品概念。';
    elements.forEach(({el,zh,en}) => { el.innerHTML = language === 'en' ? en : zh; });
    images.forEach(({el,zh,en}) => { el.alt = language === 'en' ? en : zh; });
    document.querySelectorAll('[data-language]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.language === language));
    });
    document.getElementById('language-switch').setAttribute('aria-label', language === 'en' ? 'Website and demo language' : '网站和演示语言');
  }
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.language === language) return;
    const device = document.querySelector('.device-wrap');
    const before = device.getBoundingClientRect();
    const keepDeviceInView = before.top < innerHeight && before.bottom > 88;
    language = button.dataset.language;
    try { localStorage.setItem(key, language); } catch (_) {}
    apply();
    window.dispatchEvent(new Event('followshot-language-change'));
    if (keepDeviceInView) window.scrollTo({top:scrollY + device.getBoundingClientRect().top - before.top, behavior:'instant'});
  }));
  apply();
})();
