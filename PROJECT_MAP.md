# LingoVille Project Map

这份文档用于统一我们后续沟通时的功能叫法。当前工程是 **React + Vite + Capacitor**，不是 Cocos 工程；它已经包含 `ios/` 和 `android/` 原生壳，适合继续在这个基础上做移动 App。

## 推荐叫法

| 我们沟通时的叫法 | 代码里的主要位置 | 说明 |
| --- | --- | --- |
| 新手引导 | `src/App.tsx` 的 `onboardingStep`；配置：`src/data/config/onboarding.json` | 首次进入的开屏、语言选择、目标选择、加载、开始前流程。 |
| 小镇主页 | `src/App.tsx` 的 `activeTab === "town"` 且 `scene === "exterior"` | 户外小镇场景，可横向拖拽，点击建筑进入室内/课程入口。 |
| 建筑室内 | `src/App.tsx` 的 `scene === "interior"` | 进入建筑后的室内页，包含 START、课程星星、退出建筑等。 |
| 顶部任务卡 | `src/App.tsx` 的 `showTopCard` / `dismissedCardPhase`；配置：`tasks.json` | 主界面上方展示当前任务和完成动画。 |
| 任务列表弹窗 | `src/App.tsx` 的 `showTasks`；配置：`tasks.json` | 点任务入口后的任务清单。 |
| 课程信息卡 / START 弹窗 | `src/App.tsx` 的 `showLevelConfirm`；配置：`lessons.json` | 点击 START 前展示课程标题、简介、奖励。 |
| 课前剧情 | `src/App.tsx` 的 `showDialogueFlow`；配置：`pre_lesson_stories.json` | START 后、正式答题前的人物对话。 |
| 主线剧情答题 | `src/UnifiedQuiz.tsx`；数据：`episode_1.json` ~ `episode_4.json` | 微信聊天式剧情 + 题目。当前主线实际走这套 episode 数据。 |
| 主线题目步骤 | `episode_N.json` 的 `steps[]` | `type` 可以是 `narrator`、`dialogue`、`question`。 |
| 胜利界面 | `src/App.tsx` 的 `showVictory` | 答完主线后的奖励结算页。 |
| 连胜界面 | `src/App.tsx` 的 `showWinStreak` / `showWinStreak2` / `showStreakDraw` / `showStreakReward` | 类似 Duolingo 连胜、抽奖、奖励流程。 |
| 建筑升级 | `src/App.tsx` 的 `showBuildingUpgrade`、`houseImage`、`townEventStep`；配置：`buildings.json` | 完课后建筑外观变化、落下动画等。 |
| 装饰 / 家具 | `src/App.tsx` 的 `furniture`；配置：`decorations.json` | 完成课程获得并展示的装饰物。 |
| 朋友圈 | `src/App.tsx` 的 `showSocial` / `showSocialCreate` / `socialPosts` | 假朋友圈功能，发动态、点赞评论、引导流程。 |
| 错题本 | `src/App.tsx` 的 `userMistakes`；入口：`showReview` | 主线答错后记录，传给复习页。 |
| 错题复习 | `src/ReviewScreen.tsx` | 基于错题生成阅读复习，也能查看错题记录。 |
| AI 定制答题 | `src/AiCustomQuizScreen.tsx`；接口：`/api/review/generate/custom` | 语音/文本输入需求，AI 生成一段聊天式练习。 |
| AI 口语陪练 | `src/AiSpeakingPractice.tsx` | 目前是本地模拟口语任务，还没接真实语音识别评分。 |
| 用户进度 | `src/App.tsx` 加载/保存 `/api/progress/:userId`；后端：`server.ts` | 当前用 `localStorage` 保存用户 ID，用服务端 PostgreSQL 保存进度。 |

## 数据文件分工

| 文件 | 当前用途 |
| --- | --- |
| `src/data/config/tasks.json` | 任务卡、任务列表、任务奖励。 |
| `src/data/config/lessons.json` | 课程标题、简介、星星、奖励信息、课程大纲。 |
| `src/data/config/pre_lesson_stories.json` | 每课 START 后进入答题前的剧情对话。 |
| `src/data/config/episode_1.json` ~ `episode_4.json` | 当前主线剧情答题真正使用的数据。 |
| `src/data/config/questions.json` | 另一套题库结构，资源完整但当前主线没有直接接入。后续要么接入，要么标记为备用题库。 |
| `src/data/config/buildings.json` | 建筑定义、等级、外观、关联课程。 |
| `src/data/config/decorations.json` | 装饰物定义、位置、解锁课程。 |
| `src/data/config/guide_dialogues.json` | 游戏内事件触发的 NPC 引导对话。 |
| `src/data/config/resources.json` | 角色、UI、场景、音频的资源索引。当前代码仍有大量直接写死的 `/assets/...`。 |

## 资源命名现状

目前资源在 `public/assets/` 和 `public/media/`。

| 命名类型 | 示例 | 备注 |
| --- | --- | --- |
| 拼音资源名 | `renwukapian.png`、`shenglibg.png`、`jianzhushengj.png` | 美术资产常见命名，后续可以保留，但建议新资源加英文别名。 |
| 角色表情 | `jackhappy.png`、`jackanger.png`、`MrsHendersonhappy.png` | 命名规律是 `角色 + 情绪`。 |
| 课程媒体 | `L01_Q01.png`、`L01_Q01_listen.mp3`、`L02_Q03.mp4` | 适合作为题目媒体标准命名。 |
| UI / 背景 | `BG2.png`、`datibg.png`、`fuxibg.png`、`lianshengjiemian.png` | 大量在 `App.tsx` 中直接引用。 |

建议新资源以后统一：

```text
public/assets/
  town_*.png
  building_*.png
  character_{name}_{emotion}.png
  ui_{feature}_{state}.png
  reward_{item}.png

public/media/
  L{lesson}_Q{question}.png
  L{lesson}_Q{question}_listen.mp3
  L{lesson}_Q{question}_listen_slow.mp3
```

## 技术路线判断

当前更推荐继续用这个 React + Capacitor 工程，而不是切到 Cocos：

- 已有完整 UI、剧情、任务、AI、复习、iOS/Android 壳。
- React 调细节快，适合你现在大量调文案、布局、动效、引导流程。
- Capacitor 可以打 iOS 包，用户进度可以用本地 `localStorage`、SQLite 插件或服务端 API。
- Cocos 更适合强游戏玩法、复杂 2D/物理/动画编辑器流程；但把现有工程迁过去成本很高。

后续如果只是调小镇、剧情答题、任务、错题、AI 定制、存档，建议继续这条路线。

## 近期需要重点梳理的风险

1. `server.ts` 里有明文数据库连接信息，上线前必须改成环境变量。
2. 进度现在依赖远程 `/api/progress/:userId`，离线时会失败；需要决定是否改成本地优先。
3. `questions.json` 和 `episode_N.json` 是两套题目体系，目前主线用 `episode_N.json`。
4. `App.tsx` 太大，后续修改细节容易互相影响，建议逐步拆成模块。
