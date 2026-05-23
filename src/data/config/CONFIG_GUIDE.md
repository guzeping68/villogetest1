# LingoVille Explorer 配置文件说明文档

## 概述

所有游戏数据配置文件位于 `src/data/config/` 目录下，均为 JSON 格式。通过修改这些文件可以在不改动代码的情况下调整游戏内容。

---

## 文件清单

| 文件名 | 用途 | 路径 |
|--------|------|------|
| `tasks.json` | 任务模块 | `src/data/config/tasks.json` |
| `lessons.json` | 课程模块 | `src/data/config/lessons.json` |
| `pre_lesson_stories.json` | 课前剧情模块 | `src/data/config/pre_lesson_stories.json` |
| `questions.json` | 题目模块 | `src/data/config/questions.json` |
| `buildings.json` | 建筑表 | `src/data/config/buildings.json` |
| `decorations.json` | 装饰表 | `src/data/config/decorations.json` |
| `guide_dialogues.json` | 引导剧情表 | `src/data/config/guide_dialogues.json` |
| `onboarding.json` | 引导（新手流程）模块 | `src/data/config/onboarding.json` |
| `resources.json` | 资源模块 | `src/data/config/resources.json` |

---

## 1. 任务模块 `tasks.json`

定义玩家可以完成的所有任务。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `task_id` | number | 任务唯一ID |
| `title` | string | 任务标题（展示给用户） |
| `subtitle` | string | 学习内容描述，如"+8 words, +2 phrases" |
| `reward_image` | string | 奖励预览图路径 |
| `reward_type` | string | 奖励类型：`furniture` / `decoration` / `building_upgrade` |
| `reward_item_id` | string | 奖励物品ID（关联 decorations.json 或 buildings.json） |
| `linked_lesson_id` | number | 关联的课程ID（通过完成哪节课来完成此任务） |
| `sort_order` | number | 展示顺序（数字越小越靠前） |
| `cost_diamonds` | number | 放置此装饰需要的钻石数（0=免费） |
| `is_tutorial` | boolean | 是否为新手引导任务 |

---

## 2. 课程模块 `lessons.json`

定义课程基本信息，即进入建筑后 START 界面展示的内容。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `outline_title` | string | （全局配置）顶栏课程提纲展示的标题 |
| `lesson_id` | number | 课程唯一ID |
| `title` | string | 课程英文标题 |
| `title_cn` | string | 课程中文标题 |
| `description` | string | 课程简介 |
| `speaker_name` | string | 主要说话人名字 |
| `speaker_avatar` | string | 说话人头像路径 |
| `scene` | string | 场景名称（客厅/阳台/餐厅等） |
| `unit_id` | string | 所属单元ID |
| `total_questions` | number | 本课总题数 |
| `stars_available` | number | 完成后可获得几颗星 |
| `unlock_building` | string\|null | 完成后解锁的建筑ID（null=不解锁） |
| `reward_once` | object | 首次完成奖励 |
| `reward_once.type` | string | 奖励类型 |
| `reward_once.item_id` | string | 奖励物品ID |
| `reward_once.image` | string | 奖励图片路径 |

---

## 3. 课前剧情模块 `pre_lesson_stories.json`

点击 START 按钮后，进入答题前展示的对话流。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `lesson_id` | number | 关联的课程ID |
| `unit_id` | string | 单元ID |
| `scene_name` | string | 场景中文名 |
| `scene_name_en` | string | 场景英文名 |
| `reward_image` | string | 奖励图路径 |
| `dialogues[].speaker` | string | 说话人标识：`grandma` / `player` / `barnaby` |
| `dialogues[].avatar` | string | 头像图片路径 |
| `dialogues[].position` | string | 气泡位置：`left`（NPC）/ `right`（玩家） |
| `dialogues[].text_en` | string | 英文对话内容 |
| `dialogues[].text_cn` | string | 中文对话内容 |
| `dialogues[].delay_ms` | number | 此条对话相对上条的延迟显示时间（毫秒），0=立即显示 |

---

## 4. 题目模块 `questions.json`

所有课程题目配置。按题型（type）分为5类：

### 题型分类

| type 值 | 题型名 | 说明 |
|---------|--------|------|
| `listening_selecting` | 听音选物 | 听音频，选出正确的单词 |
| `situational_response` | 情境选择 | 根据场景描述选择正确答案 |
| `fill_in_blank` | 词汇填空 | 根据句子上下文选词填入空格 |
| `listen_repeat` | 口语跟读 | 听音频后录音跟读，系统评分 |
| `vocabulary_matching` | 图词连线 | 把图片和对应单词配对 |

### 通用字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `lesson_id` | number | 所属课程ID |
| `question_id` | string | 题目唯一ID，如"L01_Q01" |
| `sort_order` | number | 本课内展示顺序 |
| `type` | string | 题型（见上表） |
| `instruction` | string | 题目指令/提问 |
| `scene_media` | string | 场景视频/图片路径 |
| `scene_description` | string | 场景描述（辅助理解） |
| `correct_feedback` | string | 答对时的反馈文案 |
| `wrong_feedback` | string | 答错时的反馈文案 |
| `show_correct_feedback` | boolean | 是否显示正确反馈（可配置单题是否显示） |

### 选择题专用字段（listening_selecting / situational_response / fill_in_blank）

| 字段 | 类型 | 说明 |
|------|------|------|
| `audio_normal` | string\|null | 正常语速听力文件路径 |
| `audio_slow` | string\|null | 慢速听力文件路径 |
| `listening_transcript` | string\|null | 听力原文 |
| `options` | array | 选项数组 |
| `options[].label` | string | 选项标号（A/B/C/D） |
| `options[].content` | string | 选项文本内容 |
| `options[].is_correct` | boolean | 是否为正确答案 |
| `correct_answer` | string | 正确答案（内容或标号） |

### 口语跟读专用字段（listen_repeat）

| 字段 | 类型 | 说明 |
|------|------|------|
| `repeat_text` | string | 需要跟读的文本 |
| `max_record_duration` | number | 最长录音时长（秒） |
| `pass_score` | number | 通过分数（0-100） |
| `max_retries` | number | 最大重试次数 |
| `scoring_dimensions` | array | 评分维度，如["pronunciation","fluency","completeness"] |

### 图词连线专用字段（vocabulary_matching）

| 字段 | 类型 | 说明 |
|------|------|------|
| `pairs` | array | 配对数组 |
| `pairs[].image` | string | 图片路径 |
| `pairs[].word` | string | 对应单词 |

---

## 5. 建筑表 `buildings.json`

定义小镇中所有建筑及其升级体系。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `building_id` | string | 建筑唯一ID |
| `name` | string | 建筑英文名 |
| `name_cn` | string | 建筑中文名 |
| `initial_level` | number | 初始等级（0=未解锁，1=已解锁1级） |
| `position` | object | 建筑在地图上的位置 `{x, y}` (百分比) |
| `levels[].level` | number | 等级编号 |
| `levels[].stars_to_next` | number\|null | 升到下一级需要多少颗星（null=满级） |
| `levels[].exterior_image` | string | 该等级的外观图片 |
| `levels[].interior_image` | string | 该等级的内部图片 |
| `levels[].linked_lessons` | array | 该等级关联的课程ID列表 |

---

## 6. 装饰表 `decorations.json`

定义每个建筑的装饰物。

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `decoration_id` | string | 装饰物唯一ID |
| `building_id` | string | 所属建筑ID |
| `name` | string | 装饰物英文名 |
| `name_cn` | string | 装饰物中文名 |
| `placement` | string | 放置位置：`interior`（建筑内）/ `exterior`（建筑外） |
| `position` | object | 在场景中的位置 `{x, y}` (百分比) |
| `image` | string | 装饰物图片路径 |
| `description` | string | 英文介绍（点击后展示） |
| `description_cn` | string | 中文介绍 |
| `unlocked_by_lesson` | number | 通过哪节课解锁 |

---

## 7. 引导剧情表 `guide_dialogues.json`

游戏中各种事件触发的 NPC 对话。

### 事件类型（event_type）

| event_type | 说明 |
|------------|------|
| `first_enter` | 第一次进入游戏 |
| `npc_intro` | 主界面NPC的随机/阶段性提示对话 |
| `building_unlock` | 解锁建筑后 |
| `building_upgrade` | 建筑升级后 |
| `decoration_placed` | 放置装饰后 |
| `lesson_complete` | 完成课程后 |

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `event_id` | string | 事件唯一ID |
| `event_type` | string | 事件类型（见上表） |
| `trigger` | string | 触发条件描述 |
| `target_decoration_id` | string | （仅decoration_placed）目标装饰物ID |
| `skippable` | boolean | 是否可以跳过此对话 |
| `dialogues[].speaker` | string | 说话人标识 |
| `dialogues[].speaker_name` | string | 说话人显示名 |
| `dialogues[].avatar` | string | 头像路径 |
| `dialogues[].text_en` | string | 英文对话内容（支持`{player_name}`变量） |
| `dialogues[].text_cn` | string | 中文对话内容 |
| `dialogues[].delay_ms` | number | 延迟显示时间（毫秒） |
| `dialogues[].action` | string | 交互动作配置，如`name_input`启动起名弹窗 |
| `dialogues[].is_player` | boolean | 是否代表玩家自身发言 |

---

## 8. 引导（新手流程）模块 `onboarding.json`

定义新用户首次进入游戏的引导流程。

### 步骤类型（type）

| type | 说明 |
|------|------|
| `splash` | 开屏等待页 |
| `carousel` | 轮播图介绍页 |
| `language_selection` | 语言选择页 |
| `native_language` | 母语选择页 |
| `knowledge_level` | 知识水平选择页 |
| `learning_goals` | 学习目标选择页 |
| `loading` | 加载/生成计划页 |
| `summary` | 学习计划总结页 |
| `celebration` | 庆祝/准备开始页 |

### 通用字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `step` | number | 步骤序号 |
| `type` | string | 步骤类型 |
| `title` | string | 标题 |
| `subtitle` | string | 副标题 |
| `background` | string | 背景图路径 |
| `button_text` | string\|null | 底部按钮文案（null=无按钮） |
| `show_progress` | boolean | 是否显示进度条 |

---

## 9. 资源模块 `resources.json`

集中管理所有图片、音频等资源路径。

### 分类

- `characters` - 角色资源（头像、全身像、名字、描述）
- `ui` - UI元素（背景图、按钮、面板）
- `scenes` - 场景资源（外部场景、内部场景）
- `audio` - 音频资源（背景音乐等）

---

## 如何添加新课程

1. 在 `lessons.json` 中添加一条新课程记录
2. 在 `questions.json` 中添加该课程的所有题目（10道）
3. 在 `pre_lesson_stories.json` 中添加对应的课前对话
4. 在 `tasks.json` 中添加关联任务
5. 如有新装饰奖励，在 `decorations.json` 中添加
6. 如有触发对话，在 `guide_dialogues.json` 中添加

## 如何添加新建筑

1. 在 `buildings.json` 中添加建筑配置
2. 在 `decorations.json` 中添加该建筑的装饰物
3. 在 `lessons.json` 中将相关课程的 `unlock_building` 指向该建筑
4. 在 `guide_dialogues.json` 中添加解锁/升级时的对话

## 注意事项

- 所有路径以 `/` 开头，相对于 `public/` 目录
- `delay_ms` 为 0 表示立即显示，用于第一条对话
- `linked_lesson_id` 确保任务与课程的关联关系正确
- 建筑的 `initial_level: 0` 表示初始未解锁，需要通过课程解锁
- 图词连线题的 `pairs` 数组长度建议为 4-6 对
