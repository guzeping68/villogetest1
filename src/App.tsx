/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { motion, AnimatePresence, animate, useMotionValue } from "motion/react";
import { UnifiedQuiz, UnifiedQuizRef } from "./UnifiedQuiz";
import { getApiUrl } from "./utils/api";
import { ReviewScreen } from "./ReviewScreen";
import { ConfigBubble } from "./components/ConfigBubble";
import { SpeechProgressText } from "./components/SpeechProgressText";
import tasksConfig from "./data/config/tasks.json";
import lessonsConfig from "./data/config/lessons.json";
import preLessonStoriesConfig from "./data/config/pre_lesson_stories.json";
import buildingsConfig from "./data/config/buildings.json";
import decorationsConfig from "./data/config/decorations.json";
import guideDialoguesConfig from "./data/config/guide_dialogues.json";
import onboardingConfig from "./data/config/onboarding.json";
import resourcesConfig from "./data/config/resources.json";
import socialTermsConfig from "./data/config/social_terms.json";
import preludeTutorialConfig from "./data/config/prelude_tutorial.json";
import townEditorAssetsConfig from "./data/config/town_editor_assets.json";
import { AiSpeakingPractice } from "./AiSpeakingPractice";
import { speakText, stopSpeech, type SpeechRole } from "./utils/speech";
import {
  playButtonClickSound,
  playDialogueAppearSound,
  playQuestionAppearSound,
  playSceneSwipeSound,
  playSoftErrorSound,
  playVictoryCelebrationFeedback,
  triggerHaptic,
} from "./utils/feedback";
import {
  createTownBgmController,
  type TownBgmController,
} from "./utils/townBgm";
import {
  ArrowBigDown,
  ArrowDown,
  ShoppingBag,
  Lamp,
  Sofa,
  Table,
  Apple,
  Banana,
  Tv,
  Coffee,
  Gamepad,
  Book,
  Sun,
  Cake,
  Car,
  Plus,
  Image as ImageIcon,
  Map as MapIcon,
  Armchair,
  BotMessageSquare,
  BrainCircuit,
  CircleUserRound,
  Flame,
  Gift,
  HelpCircle,
  House,
  ListChecks,
  MapPinned,
  Newspaper,
  NotebookTabs,
  Settings,
  Store,
  Timer,
  Trophy,
  User,
  Users,
  ChevronDown,
  ChevronLeft,
  ChevronsDown,
  ChevronRight,
  Plane,
  Home,
  GraduationCap,
  Briefcase,
  Smile,
  MoreHorizontal,
  ArrowRight,
  Circle,
  CheckCircle2,
  ArrowRightLeft,
  Mic,
  Minus,
  Volume2,
  RotateCcw,
  Zap,
  Box,
  Layers,
  Palette,
  Clock,
  Wrench,
  Heart,
  MessageCircle,
  Aperture,
  Camera,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { AiCustomQuizScreen } from "./AiCustomQuizScreen";

const isDraggingSceneGlobalRef = { current: false };

type ImageHitCanvasCacheEntry = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  width: number;
  height: number;
  ready: boolean;
};

const imageHitCanvasCache = new Map<string, ImageHitCanvasCacheEntry>();

const primeImageHitCanvas = (src: string, image: HTMLImageElement) => {
  if (
    typeof document === "undefined" ||
    image.naturalWidth <= 0 ||
    image.naturalHeight <= 0
  ) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  try {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    imageHitCanvasCache.set(src, {
      canvas,
      ctx,
      width: image.naturalWidth,
      height: image.naturalHeight,
      ready: true,
    });
  } catch {
    imageHitCanvasCache.delete(src);
  }
};

const ensureImageHitCanvas = (src: string) => {
  const cached = imageHitCanvasCache.get(src);
  if (cached?.ready) return cached;
  if (
    cached ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return null;
  }

  const image = new Image();
  image.onload = () => primeImageHitCanvas(src, image);
  imageHitCanvasCache.set(src, {
    canvas: document.createElement("canvas"),
    ctx: null,
    width: 0,
    height: 0,
    ready: false,
  });
  image.src = src;
  return null;
};

const isPointOnVisibleImagePixel = (
  src: string,
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  alphaThreshold = 12,
) => {
  const hitCanvas = ensureImageHitCanvas(src);
  if (
    !hitCanvas?.ready ||
    !hitCanvas.ctx ||
    hitCanvas.width <= 0 ||
    hitCanvas.height <= 0
  ) {
    return true;
  }

  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  if (
    localX < 0 ||
    localY < 0 ||
    localX > containerRect.width ||
    localY > containerRect.height
  ) {
    return false;
  }

  const scale = Math.min(
    containerRect.width / hitCanvas.width,
    containerRect.height / hitCanvas.height,
  );
  const renderedWidth = hitCanvas.width * scale;
  const renderedHeight = hitCanvas.height * scale;
  const renderedLeft = (containerRect.width - renderedWidth) / 2;
  const renderedTop = (containerRect.height - renderedHeight) / 2;
  const imageX = localX - renderedLeft;
  const imageY = localY - renderedTop;

  if (
    imageX < 0 ||
    imageY < 0 ||
    imageX > renderedWidth ||
    imageY > renderedHeight
  ) {
    return false;
  }

  const pixelX = Math.max(
    0,
    Math.min(hitCanvas.width - 1, Math.floor(imageX / scale)),
  );
  const pixelY = Math.max(
    0,
    Math.min(hitCanvas.height - 1, Math.floor(imageY / scale)),
  );

  try {
    return (
      hitCanvas.ctx.getImageData(pixelX, pixelY, 1, 1).data[3] >
      alphaThreshold
    );
  } catch {
    return true;
  }
};

const EXTERIOR_TASKS = tasksConfig.tasks
  .sort((a, b) => a.sort_order - b.sort_order)
  .map((t) => ({
    title: t.title,
    taskId: t.task_id,
    linkedLessonId: t.linked_lesson_id,
    ...t,
  }));

type SocialTerm = {
  id: string;
  text: string;
  translation: string;
  lessonId: number;
  tag: string;
};

type SocialComment = {
  author: string;
  content: string;
};

type SocialPost = {
  id: number;
  author: string;
  avatar: string;
  content: string;
  likes: number;
  isLiked: boolean;
  comments: SocialComment[];
  timestamp: string;
  terms?: string[];
};

const SOCIAL_LESSON_TERMS: SocialTerm[] = socialTermsConfig.terms;

const formatSocialTermList = (terms: SocialTerm[]) =>
  terms
    .map((term) => `“${term.text}”`)
    .reduce((sentence, term, index, list) => {
      if (index === 0) return term;
      if (index === list.length - 1) return `${sentence} and ${term}`;
      return `${sentence}, ${term}`;
    }, "");

const buildSocialPostContent = (terms: SocialTerm[]) => {
  if (terms.length === 0) {
    return "I practiced real-life English in LingoVille today.";
  }

  if (terms.length <= 2) {
    return `Today I practiced ${formatSocialTermList(terms)}. Small words, real life.`;
  }

  return `Today I practiced: ${formatSocialTermList(terms)}. These lines feel useful in real life.`;
};

const buildSocialComments = (terms: SocialTerm[]): SocialComment[] => {
  const firstTerm = terms[0]?.text || "that phrase";
  return [
    {
      author: "Bun",
      content: `Nice! "${firstTerm}" sounds very natural.`,
    },
    {
      author: "Mia",
      content: "已加入你的复习动态，明天再看会更熟。",
    },
  ];
};

const PLAYER_ID_PATTERN = /^[A-Z]{4}$/;
const OPENING_FLOW_COMPLETE_STORAGE_KEY =
  "lingoville_opening_flow_complete_v1";
const TEST_PLAYER_IDS_STORAGE_KEY = "lingoville_test_player_ids";
const MAX_STAMINA = 25;
const TOWN_CAMERA_ZOOM_STORAGE_KEY = "lingoville_town_camera_zoom";
const TOWN_CAMERA_PAN_SPEED_STORAGE_KEY = "lingoville_town_camera_pan_speed";
const TOWN_CAMERA_ZOOM_MIN = 0.65;
const TOWN_CAMERA_ZOOM_MAX = 1.4;
const TOWN_CAMERA_ZOOM_STEP = 0.1;
const TOWN_CAMERA_ZOOM_DEFAULT = 0.9;
const TOWN_CAMERA_PAN_SPEED_MIN = 0.75;
const TOWN_CAMERA_PAN_SPEED_MAX = 2.6;
const TOWN_CAMERA_PAN_SPEED_STEP = 0.15;
const TOWN_CAMERA_PAN_SPEED_DEFAULT = 2;
const STREAK_CALENDAR_DAYS = Array.from({ length: 30 }, (_, index) => index + 1);
const STREAK_WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const TOWN_BACKGROUND_IMAGE = "/assets/Maple_Town_bg.jpg";
const MIA_PORTRAIT_IMAGE = "/assets/mia_portrait_trimmed.png";
const MIA_AVATAR_IMAGE = "/assets/mia_avatar.png";
const PLAYER_COURSE_AVATAR_IMAGE = "/assets/youhappy.png";
const PRELUDE_GUARD_GREETING_IMAGE = "/assets/prelude_guard_greeting.png";
const PRELUDE_GUARD_POINTING_IMAGE = "/assets/prelude_guard_pointing.png";
const BUILDING_RESIDENT_IMAGE = "/assets/building_resident.png";
const LOCKED_BUILDING_OVERLAY_IMAGE = "/assets/locked_building_overlay.png";
const HOME_RESIDENT_IDLE_LEFT = "56%";
const HOME_RESIDENT_IDLE_TOP = "58%";
const HOME_RESIDENT_IDLE_FLIP = -1;
const DEFAULT_SCENE_WIDTH = 900;
const TOWN_MAP_BASE_SCALE = 1.5;
const TOWN_SCENE_WORLD_SIZE = DEFAULT_SCENE_WIDTH * TOWN_MAP_BASE_SCALE;
const TOWN_BACKGROUND_WORLD_SIZE = TOWN_SCENE_WORLD_SIZE * 1.5;
const TOWN_LAYOUT_REFERENCE_WIDTH = 390;
const PHONE_FRAME_ASPECT_WIDTH = 390;
const PHONE_FRAME_ASPECT_HEIGHT = 844;
const PHONE_FRAME_MAX_WIDTH = 450;
const PHONE_FRAME_MAX_HEIGHT =
  (PHONE_FRAME_MAX_WIDTH * PHONE_FRAME_ASPECT_HEIGHT) /
  PHONE_FRAME_ASPECT_WIDTH;
const MAX_MAIN_LESSON_ID = Math.max(
  0,
  ...lessonsConfig.lessons.map((lesson) => Number(lesson.lesson_id) || 0),
);
// The full prelude is one merged tutorial unit, even though it has two story beats.
const PRELUDE_DECOR_LESSON_COUNT = 1;
const PRELUDE_TUTORIAL_VERSION = 2;
const PRELUDE_TUTORIAL_STORAGE_KEY = "lingoville_prelude_tutorial_seen_v2";
const PRELUDE_QUESTION_PROMPT_LINE_IDS = new Set([
  "q1_prompt",
  "q2_prompt",
  "turn_left_prompt",
  "q4_prompt",
]);
const TOWN_DECOR_UNLOCKS_PER_BUILDING = 8;
const TOWN_DECOR_UNLOCK_STORAGE_KEY =
  "lingoville_seen_town_decor_unlock_count_v2";
const TOWN_BUILDING_UPGRADE_SEEN_STORAGE_KEY =
  "lingoville_seen_town_building_upgrade_count_v1";
const TOWN_DECOR_PENDING_UNLOCK_STORAGE_KEY =
  "lingoville_pending_town_decor_unlock_counts";
const TOWN_EARLY_UNLOCKED_BUILDINGS_STORAGE_KEY =
  "lingoville_early_unlocked_town_buildings";
const TOWN_DECORATION_UNLOCK_ORDER_STORAGE_KEY =
  "lingoville_town_decoration_unlock_order_overrides";
const TOWN_MANUAL_UNLOCKED_DECORATIONS_STORAGE_KEY =
  "lingoville_manual_unlocked_town_decorations";
const TOWN_DIRECT_DECOR_PENDING_STORAGE_KEY =
  "lingoville_pending_direct_town_decor_unlocks";
const TOWN_GARBAGE_STORAGE_KEY = "lingoville_town_garbage_items_v2";
const TOWN_GARBAGE_DAILY_REWARD_STORAGE_KEY =
  "lingoville_town_garbage_daily_reward_v1";
const REVIEW_STAMINA_REWARD_DATE_STORAGE_KEY =
  "lingoville_review_stamina_reward_date_v1";
const TOWN_GARBAGE_MAX_ITEMS = 3;
const TOWN_GARBAGE_DAILY_REWARD_LIMIT = 3;
const TOWN_GARBAGE_RELOCATE_DELAY_MS = 24000;
const TOWN_DECORATION_LONG_PRESS_MS = 220;
const TOWN_DECORATION_LONG_PRESS_MOVE_TOLERANCE = 32;
const isMobileLikeDevice = () => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(pointer: coarse)")?.matches ||
    window.innerWidth <= 760 ||
    /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)
  );
};
const TOWN_DUST_PARTICLES = [
  { x1: "12%", x2: "34%", duration: 18, delay: 0 },
  { x1: "28%", x2: "18%", duration: 22, delay: 2 },
  { x1: "44%", x2: "66%", duration: 20, delay: 4 },
  { x1: "58%", x2: "47%", duration: 24, delay: 6 },
  { x1: "72%", x2: "84%", duration: 19, delay: 8 },
  { x1: "86%", x2: "62%", duration: 23, delay: 10 },
];
const TOWN_EDITOR_DECORATION_SIZE_READY_STORAGE_KEY =
  "lingoville_town_editor_decoration_size_ready_v2";
const TOWN_EDITOR_DECORATION_WIDTH_MIN = 3;
const TOWN_EDITOR_DECORATION_WIDTH_MAX = 58;
const TOWN_EDITOR_DECORATION_WIDTH_STEP = 1;
const LESSON_STREAK_PANEL_DATE_STORAGE_KEY =
  "lingoville_lesson_streak_panel_date";
const POST_LESSON_ONE_FRAMEWORK_GUIDE_STORAGE_KEY =
  "lingoville_post_lesson_one_framework_guide_seen";
const POST_LESSON_ONE_FRAMEWORK_GUIDE_PENDING_STORAGE_KEY =
  "lingoville_post_lesson_one_framework_guide_pending";

const getStoredOpeningFlowComplete = () => {
  try {
    return (
      localStorage.getItem(OPENING_FLOW_COMPLETE_STORAGE_KEY) === "true" ||
      localStorage.getItem("lingoville_home_intro_seen") === "true" ||
      localStorage.getItem(PRELUDE_TUTORIAL_STORAGE_KEY) === "true" ||
      localStorage.getItem("lingoville_prelude_tutorial_seen") === "true" ||
      localStorage.getItem(POST_LESSON_ONE_FRAMEWORK_GUIDE_STORAGE_KEY) ===
        "true"
    );
  } catch {
    return false;
  }
};

const persistOpeningFlowComplete = () => {
  try {
    localStorage.setItem(OPENING_FLOW_COMPLETE_STORAGE_KEY, "true");
  } catch (e) {
    console.error(e);
  }
};

const normalizeStoredPlayerIds = (ids: unknown[]) =>
  Array.from(
    new Set(
      ids
        .map((id) => String(id || "").trim().toUpperCase())
        .filter((id) => PLAYER_ID_PATTERN.test(id)),
    ),
  );

const getStoredTestPlayerIds = (currentId?: string | null) => {
  try {
    const stored = localStorage.getItem(TEST_PLAYER_IDS_STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    const ids = Array.isArray(parsed) ? parsed : [];
    return normalizeStoredPlayerIds([
      currentId,
      localStorage.getItem("app_user_id"),
      ...ids,
    ]);
  } catch {
    return normalizeStoredPlayerIds([currentId]);
  }
};

const saveStoredTestPlayerIds = (ids: string[]) => {
  try {
    localStorage.setItem(
      TEST_PLAYER_IDS_STORAGE_KEY,
      JSON.stringify(normalizeStoredPlayerIds(ids)),
    );
  } catch (e) {
    console.error(e);
  }
};

const clearLocalPlayerSessionStorage = () => {
  try {
    localStorage.removeItem("app_user_id");
    localStorage.removeItem(OPENING_FLOW_COMPLETE_STORAGE_KEY);
    localStorage.removeItem("lingoville_home_intro_seen");
    localStorage.removeItem("lingoville_prelude_tutorial_seen");
    localStorage.removeItem(PRELUDE_TUTORIAL_STORAGE_KEY);
    localStorage.removeItem(POST_LESSON_ONE_FRAMEWORK_GUIDE_STORAGE_KEY);
    localStorage.removeItem(POST_LESSON_ONE_FRAMEWORK_GUIDE_PENDING_STORAGE_KEY);
    localStorage.removeItem(TOWN_EARLY_UNLOCKED_BUILDINGS_STORAGE_KEY);
    localStorage.removeItem(TOWN_DECORATION_UNLOCK_ORDER_STORAGE_KEY);
    localStorage.removeItem(TOWN_MANUAL_UNLOCKED_DECORATIONS_STORAGE_KEY);
    localStorage.removeItem(TOWN_DIRECT_DECOR_PENDING_STORAGE_KEY);
  } catch (e) {
    console.error(e);
  }
};

const ONBOARDING_DIALOGUE_AUDIO: Record<
  | "step1Intro"
  | "step2Barista"
  | "step2Me"
  | "step3TownGrowth"
  | "step4Welcome"
  | "step4NamePrompt"
  | "step4Ready",
  { text: string; audioSrc: string; role: SpeechRole }
> = {
  step1Intro: {
    text: "Start your language adventure now!",
    audioSrc: "/audio/onboarding/001_intro_fun.mp3",
    role: "female",
  },
  step2Barista: {
    text: "Hey! What can I get for you?",
    audioSrc: "/audio/onboarding/002_barista_question.mp3",
    role: "female",
  },
  step2Me: {
    text: "I'd like a latte, please.",
    audioSrc: "/audio/onboarding/002_me_latte.mp3",
    role: "you",
  },
  step3TownGrowth: {
    text: "Every lesson grows your town.",
    audioSrc: "/audio/onboarding/003_town_growth.mp3",
    role: "female",
  },
  step4Welcome: {
    text: "Hi, welcome to LingoVille! I'm Mia, your learning buddy.",
    audioSrc: "/audio/onboarding/004_mia_welcome.mp3",
    role: "female",
  },
  step4NamePrompt: {
    text: "Before we get started, let's get to know each other. What's your name?",
    audioSrc: "/audio/onboarding/004_mia_name_prompt.mp3",
    role: "female",
  },
  step4Ready: {
    text: "Everything's set! Your town will grow as you learn. Let's get started!",
    audioSrc: "/audio/onboarding/004_mia_ready.mp3",
    role: "female",
  },
};
const DECOR_GUIDE_AUDIO: Record<
  1 | 2,
  { text: string; audioSrc: string; role: SpeechRole }
> = {
  1: {
    text: "Look, your apartment has its first decoration. Already feeling more like home!",
    audioSrc: "/audio/guides/001_first_decoration.mp3",
    role: "female",
  },
  2: {
    text: "Here's how it works. Every unit you finish equals one new decoration. Your apartment will keep growing as you learn.",
    audioSrc: "/audio/guides/002_decoration_system.mp3",
    role: "female",
  },
};
const FRAMEWORK_GUIDE_AUDIO: Record<
  1 | 2 | 3 | 4,
  { text: string; audioSrc: string; role: SpeechRole }
> = {
  1: {
    text: "Eight buildings. Eight real-life situations. Every place teaches you English you'll actually use.",
    audioSrc: "/audio/guides/101_framework_overview.mp3",
    role: "female",
  },
  2: {
    text: "This is your Mistake Book. Every tricky one is saved here for review!",
    audioSrc: "/audio/guides/102_mistake_book.mp3",
    role: "female",
  },
  3: {
    text: "Tell me what you want to learn. I'll create a lesson just for you.",
    audioSrc: "/audio/guides/103_ai_custom.mp3",
    role: "female",
  },
  4: {
    text: "Need to practice speaking? Tap here whenever you want to chat!",
    audioSrc: "/audio/guides/104_ai_speaking.mp3",
    role: "female",
  },
};
const HOME_BUILDING_IMAGE = "/assets/xinhome.png";
const HOME_DECORATIONS = [
  {
    id: "home_sofa",
    name: "Sofa",
    src: "/assets/shafa1.png",
    unlockAfterCompletions: 1,
    x: 30,
    y: 52,
    width: 14,
    heightRatio: 1.41,
  },
  {
    id: "home_bathtub",
    name: "Bathtub",
    src: "/assets/yugang1.png",
    unlockAfterCompletions: 2,
    x: 39,
    y: 38,
    width: 11,
    heightRatio: 1.3,
  },
  {
    id: "home_table",
    name: "Coffee Table",
    src: "/assets/zhuozi1.png",
    unlockAfterCompletions: 3,
    x: 41,
    y: 50,
    width: 10,
    heightRatio: 1.41,
  },
] as const;
type HomeDecorationId = (typeof HOME_DECORATIONS)[number]["id"];
type HomeDecorationPosition = { x: number; y: number; width: number };

type TownEditorDecorationAsset = {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  order: number;
};

type TownEditorBuildingAsset = {
  id: number;
  name: string;
  slug: string;
  src: string;
  decorations: TownEditorDecorationAsset[];
};

type TownEditorPosition = { x: number; y: number; width: number };
type TownDecorUnlockAnimation = {
  key: number;
  buildingId: number;
  decorationIds: string[];
};
type TownDecorRewardReveal = {
  key: number;
  buildingId: number;
  decorationId: string;
  src: string;
  targetX: number;
  targetY: number;
  phase: "showcase" | "fly";
  items?: {
    decorationId: string;
    src: string;
    targetX: number;
    targetY: number;
  }[];
};
type TownDecorProgressParticles = {
  key: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  count: number;
};
type PendingDirectTownDecorUnlock = {
  buildingId: number;
  decorationId: string;
  unlockCount?: number;
};
type TownGarbageItem = {
  id: string;
  x: number;
  y: number;
  variant: number;
  challengeId: string;
};
type TownGarbageChallenge = {
  id: string;
  word: string;
  meaning: string;
  hint: string;
};
type GarbageLetterTile = {
  id: string;
  char: string;
};
type TownGarbagePrompt = {
  key: number;
  garbageId: string;
  challenge: TownGarbageChallenge;
  available: GarbageLetterTile[];
  selected: GarbageLetterTile[];
  wrong: boolean;
};
type TownGarbageSmokeEffect = {
  key: number;
  x: number;
  y: number;
};
type TownGarbageEnergyFlight = {
  key: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
};

const TOWN_EDITOR_BUILDINGS = (
  townEditorAssetsConfig as { buildings: TownEditorBuildingAsset[] }
).buildings;

const TOWN_GARBAGE_CHALLENGES: TownGarbageChallenge[] = [
  {
    id: "apartment",
    word: "apartment",
    meaning: "公寓",
    hint: "Mia 刚搬进来的新家。",
  },
  {
    id: "neighbor",
    word: "neighbor",
    meaning: "邻居",
    hint: "住在你旁边的人。",
  },
  {
    id: "hallway",
    word: "hallway",
    meaning: "走廊",
    hint: "去房间前要经过的地方。",
  },
  {
    id: "straight",
    word: "straight",
    meaning: "直走",
    hint: "问路时很常用。",
  },
  {
    id: "delivery",
    word: "delivery",
    meaning: "配送",
    hint: "外卖、包裹都可能用到。",
  },
  {
    id: "laundry",
    word: "laundry",
    meaning: "洗衣",
    hint: "生活区高频词。",
  },
  {
    id: "appointment",
    word: "appointment",
    meaning: "预约",
    hint: "医院、理发、见面都能用。",
  },
  {
    id: "delicious",
    word: "delicious",
    meaning: "美味的",
    hint: "评价食物很好用。",
  },
  {
    id: "receipt",
    word: "receipt",
    meaning: "收据",
    hint: "购物后可能会问要不要它。",
  },
  {
    id: "medicine",
    word: "medicine",
    meaning: "药",
    hint: "身体不舒服时常见。",
  },
];

const TOWN_BUILDING_SIGN_NAMES: Record<string, string> = {
  home: "Apartment 4B",
  food_street: "Food Street",
  shopping_center: "Shopping Center",
  transit_hub: "Transit Hub",
  health_center: "Health Center",
  academy: "Academy",
  stage: "Theater",
  company: "Company",
};

const getTownBuildingSignName = (building: TownEditorBuildingAsset) =>
  TOWN_BUILDING_SIGN_NAMES[building.slug] ||
  building.slug
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getTownBuildingUnlockRequiredLesson = (buildingId: number) =>
  buildingId <= 1 ? 0 : (buildingId - 1) * TOWN_DECOR_UNLOCKS_PER_BUILDING;

const getTownBuildingForUnlockCount = (unlockCount: number) =>
  TOWN_EDITOR_BUILDINGS[
    Math.floor(Math.max(0, unlockCount - 1) / TOWN_DECOR_UNLOCKS_PER_BUILDING)
  ] || null;

const clampPercent = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const TOWN_EDITOR_DECORATION_BY_ID = TOWN_EDITOR_BUILDINGS.reduce(
  (lookup, building) => {
    building.decorations.forEach((decoration) => {
      lookup[decoration.id] = decoration;
    });
    return lookup;
  },
  {} as Record<string, TownEditorDecorationAsset>,
);

const getTownDecorationUnlockId = (decoration: TownEditorDecorationAsset) => {
  const match = decoration.id.match(/decor_0*(\d+)$/);
  const parsed = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : decoration.order;
};

const TOWN_DECORATION_REWARD_ICON_FALLBACKS: Record<string, string> = {
  // This cut contains only export specks, so show the next visible food-street item.
  "02_food_street_decor_01": "02_food_street_decor_02",
};

const getTownDecorationRewardIconSrc = (
  decoration: TownEditorDecorationAsset,
) => {
  const iconId =
    TOWN_DECORATION_REWARD_ICON_FALLBACKS[decoration.id] || decoration.id;
  return `/assets/town-editor/reward-icons/${iconId}.png`;
};

const getTownDecorationsByUnlockId = (building: TownEditorBuildingAsset) =>
  [...building.decorations].sort(
    (a, b) => getTownDecorationUnlockId(a) - getTownDecorationUnlockId(b),
  );

const normalizeTownDecorationUnlockOrder = (
  building: TownEditorBuildingAsset,
  overrideIds?: string[],
) => {
  const baseOrder = getTownDecorationsByUnlockId(building);
  if (!overrideIds || overrideIds.length === 0) return baseOrder;

  const decorationById = new Map(
    baseOrder.map((decoration) => [decoration.id, decoration]),
  );
  const seen = new Set<string>();
  const ordered: TownEditorDecorationAsset[] = [];

  overrideIds.forEach((id) => {
    const decoration = decorationById.get(id);
    if (!decoration || seen.has(id)) return;
    seen.add(id);
    ordered.push(decoration);
  });

  baseOrder.forEach((decoration) => {
    if (seen.has(decoration.id)) return;
    ordered.push(decoration);
  });

  return ordered;
};

const DEFAULT_TOWN_EDITOR_BUILDING_POSITIONS: Record<
  number,
  TownEditorPosition
> = {
  1: { x: 32.4, y: 35.5, width: 36 },
  2: { x: 76.3, y: 61.4, width: 28 },
  3: { x: 75.5, y: -3.3, width: 29 },
  4: { x: 4.3, y: 61.1, width: 29 },
  5: { x: 6.5, y: 14.3, width: 29 },
  6: { x: 42.3, y: -5, width: 29 },
  7: { x: 36.7, y: 82.6, width: 31 },
  8: { x: 80, y: 29, width: 28 },
};

const getDefaultHomeDecorationPositions = () =>
  HOME_DECORATIONS.reduce(
    (positions, decoration) => ({
      ...positions,
      [decoration.id]: {
        x: decoration.x,
        y: decoration.y,
        width: decoration.width,
      },
    }),
    {} as Record<HomeDecorationId, HomeDecorationPosition>,
  );

const getDefaultTownEditorBuildingPositions = () =>
  TOWN_EDITOR_BUILDINGS.reduce(
    (positions, building) => {
      positions[String(building.id)] =
        DEFAULT_TOWN_EDITOR_BUILDING_POSITIONS[building.id] || {
          x: 8 + ((building.id - 1) % 3) * 30,
          y: 8 + Math.floor((building.id - 1) / 3) * 26,
          width: 28,
        };
      return positions;
    },
    {} as Record<string, TownEditorPosition>,
  );

const getTownGarbageChallenge = (challengeId?: string) =>
  TOWN_GARBAGE_CHALLENGES.find((challenge) => challenge.id === challengeId) ||
  TOWN_GARBAGE_CHALLENGES[0];

const createGarbageLetterTiles = (word: string) => {
  const letters = word.toUpperCase().replace(/[^A-Z]/g, "").split("");
  const shuffled = letters.map((char, index) => ({
    id: `${char}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    char,
  }));

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }

  if (
    shuffled.length > 1 &&
    shuffled.map((tile) => tile.char).join("") === letters.join("")
  ) {
    shuffled.reverse();
  }

  return shuffled;
};

const sanitizeTownGarbageItems = (items: unknown): TownGarbageItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const source = item as Partial<TownGarbageItem>;
      const x = Number(source.x);
      const y = Number(source.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

      return {
        id: source.id || `garbage-saved-${index}`,
        x: clampPercent(x, 4, 96),
        y: clampPercent(y, 5, 96),
        variant: Number.isFinite(Number(source.variant))
          ? Math.max(0, Math.floor(Number(source.variant)) % 3)
          : index % 3,
        challengeId: getTownGarbageChallenge(source.challengeId).id,
      };
    })
    .filter((item): item is TownGarbageItem => Boolean(item))
    .slice(0, TOWN_GARBAGE_MAX_ITEMS);
};

const getTownGarbageRoadSpots = (
  buildingPositions: Record<string, TownEditorPosition>,
) => {
  const defaults = getDefaultTownEditorBuildingPositions();
  const homePosition = buildingPositions["1"] || defaults["1"];
  const homeLeft = homePosition.x;
  const homeTop = homePosition.y;
  const homeRight = homeLeft + homePosition.width;
  const homeBottom = homeTop + homePosition.width;
  const homeCenterX = homePosition.x + homePosition.width / 2;
  const homeCenterY = homePosition.y + homePosition.width / 2;
  const homeWidth = homePosition.width;
  const buildingSafetyMargin = 3.4;
  const isOnBuilding = (spot: { x: number; y: number }) =>
    TOWN_EDITOR_BUILDINGS.some((building) => {
      const position =
        buildingPositions[String(building.id)] || defaults[String(building.id)];
      if (!position) return false;
      return (
        spot.x >= position.x - buildingSafetyMargin &&
        spot.x <= position.x + position.width + buildingSafetyMargin &&
        spot.y >= position.y - buildingSafetyMargin &&
        spot.y <= position.y + position.width + buildingSafetyMargin
      );
    });

  const preferredSpots = [
    {
      x: homeLeft - homeWidth * 0.18,
      y: homeCenterY + homeWidth * 0.02,
    },
    {
      x: homeLeft - homeWidth * 0.2,
      y: homeCenterY + homeWidth * 0.34,
    },
    {
      x: homeRight + homeWidth * 0.18,
      y: homeCenterY + homeWidth * 0.03,
    },
    {
      x: homeRight + homeWidth * 0.16,
      y: homeCenterY + homeWidth * 0.29,
    },
    {
      x: homeCenterX - homeWidth * 0.24,
      y: homeBottom + homeWidth * 0.18,
    },
    {
      x: homeCenterX + homeWidth * 0.22,
      y: homeBottom + homeWidth * 0.18,
    },
    {
      x: homeCenterX - homeWidth * 0.12,
      y: homeTop - homeWidth * 0.16,
    },
    {
      x: homeCenterX + homeWidth * 0.24,
      y: homeTop - homeWidth * 0.16,
    },
  ].map((spot) => ({
    x: clampPercent(spot.x, 8, 92),
    y: clampPercent(spot.y, 10, 90),
  }));

  const roadSpots = preferredSpots.filter((spot) => !isOnBuilding(spot));
  return roadSpots.length > 0 ? roadSpots : preferredSpots;
};

const isTownGarbageInHomeRoadBand = (item: TownGarbageItem) =>
  item.x >= 8 && item.x <= 92 && item.y >= 10 && item.y <= 90;

const isTownGarbageOnPreferredRoadSpot = (
  item: TownGarbageItem,
  buildingPositions: Record<string, TownEditorPosition>,
) =>
  getTownGarbageRoadSpots(buildingPositions).some(
    (spot) => Math.hypot(item.x - spot.x, item.y - spot.y) <= 1.2,
  );

const createTownGarbageItems = (
  buildingPositions: Record<string, TownEditorPosition>,
) => {
  const roadSpots = getTownGarbageRoadSpots(buildingPositions);
  const seed = Date.now();
  const startIndex = Math.floor(Math.random() * Math.max(1, roadSpots.length));

  return Array.from(
    { length: Math.min(TOWN_GARBAGE_MAX_ITEMS, roadSpots.length) },
    (_, index) => {
      const spot = roadSpots[(startIndex + index * 2) % roadSpots.length];
      const challenge =
        TOWN_GARBAGE_CHALLENGES[
          (seed + index * 5) % TOWN_GARBAGE_CHALLENGES.length
        ];

      return {
        id: `garbage-road-${seed}-${index}`,
        x: spot.x,
        y: spot.y,
        variant: index % 3,
        challengeId: challenge.id,
      };
    },
  );
};

const relocateTownGarbageItems = (
  items: TownGarbageItem[],
  buildingPositions: Record<string, TownEditorPosition>,
) => {
  if (items.length === 0) return createTownGarbageItems(buildingPositions);

  const roadSpots = getTownGarbageRoadSpots(buildingPositions);
  const seed = Date.now();
  const startIndex = Math.floor(Math.random() * Math.max(1, roadSpots.length));

  return items.slice(0, TOWN_GARBAGE_MAX_ITEMS).map((item, index) => {
    const spot = roadSpots[(startIndex + index * 2 + 1) % roadSpots.length];
    return {
      ...item,
      id: `garbage-road-${seed}-${index}`,
      x: spot.x,
      y: spot.y,
      variant: (item.variant + 1) % 3,
    };
  });
};

const getDefaultTownEditorDecorationPositions = () =>
  TOWN_EDITOR_BUILDINGS.reduce(
    (positions, building) => {
      building.decorations.forEach((decoration) => {
        positions[decoration.id] = {
          x: decoration.x,
          y: decoration.y,
          width: decoration.width,
        };
      });
      return positions;
    },
    {} as Record<string, TownEditorPosition>,
  );

const clampTownCameraZoom = (zoom: number) =>
  Math.min(
    TOWN_CAMERA_ZOOM_MAX,
    Math.max(TOWN_CAMERA_ZOOM_MIN, Math.round(zoom * 100) / 100),
  );

const clampTownCameraPanSpeed = (speed: number) =>
  Math.min(
    TOWN_CAMERA_PAN_SPEED_MAX,
    Math.max(TOWN_CAMERA_PAN_SPEED_MIN, Math.round(speed * 100) / 100),
  );

type PreludeStage =
  | "hidden"
  | "welcome"
  | "guide_house"
  | "inside_intro"
  | "q1"
  | "q1_correct"
  | "q2_intro"
  | "q2"
  | "q2_guard"
  | "route_intro"
  | "q3"
  | "q3_correct"
	  | "q4"
	  | "q4_correct";
type FrameworkGuideStep = 0 | 1 | 2 | 3 | 4;
type IdleTownGuideTarget = "task" | "home" | null;
type PreludeChoice = "a" | "b" | "c";

const PRELUDE_Q1_OPTIONS: Array<{
  id: PreludeChoice;
  label: string;
  value: string;
  isCorrect: boolean;
}> = [
  { id: "a", label: "A", value: "Hi", isCorrect: true },
  { id: "b", label: "B", value: "Bye", isCorrect: false },
  { id: "c", label: "C", value: "Good night", isCorrect: false },
];

const PRELUDE_Q2_OPTIONS: Array<{
  id: PreludeChoice;
  label: string;
  value: string;
  isCorrect: boolean;
}> = [
  { id: "a", label: "A", value: "📍 Where is", isCorrect: true },
  { id: "b", label: "B", value: "🤔 What is", isCorrect: false },
  { id: "c", label: "C", value: "🍔 How is", isCorrect: false },
];

const PRELUDE_Q3_OPTIONS: Array<{
  id: PreludeChoice;
  label: string;
  value: string;
  isCorrect: boolean;
}> = [
  { id: "a", label: "A", value: "⬅️ 向左转", isCorrect: false },
  { id: "b", label: "B", value: "➡️ 向右转", isCorrect: true },
  { id: "c", label: "C", value: "⬆️ 直走", isCorrect: false },
];

const PRELUDE_Q4_OPTIONS: Array<{
  id: PreludeChoice;
  label: string;
  value: string;
  isCorrect: boolean;
}> = [
  { id: "a", label: "A", value: "🙏 Thank you so much!", isCorrect: true },
  { id: "b", label: "B", value: "🚪 Goodbye!", isCorrect: false },
  { id: "c", label: "C", value: "🤔 OK.", isCorrect: false },
];

const getLocalDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const isPreviousDay = (dateKey: string | null, todayKey: string) => {
  if (!dateKey) return false;
  const date = new Date(`${dateKey}T00:00:00`);
  const today = new Date(`${todayKey}T00:00:00`);
  return today.getTime() - date.getTime() === 24 * 60 * 60 * 1000;
};

const getCityLevelInfo = (quizIndex: number) => {
  const completedLessons = Math.min(8, Math.max(0, quizIndex - 1));
  const level = Math.min(5, 1 + Math.floor(completedLessons / 2));
  const currentLevelStart = (level - 1) * 2;
  const nextLevelAt = Math.min(8, currentLevelStart + 2);
  const progress =
    nextLevelAt <= currentLevelStart
      ? 1
      : Math.min(1, (completedLessons - currentLevelStart) / 2);

  return {
    completedLessons,
    level,
    progress,
    progressLabel:
      completedLessons >= 8
        ? "满级"
        : `${completedLessons - currentLevelStart}/2`,
  };
};

const normalizePlayerId = (value: string) =>
  value.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

const LoadingDots = () => {
  const [dots, setDots] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      setDots((p) => (p.length >= 3 ? "" : p + "."));
    }, 400);
    return () => clearInterval(t);
  }, []);
  return <span className="inline-block w-5 text-left">{dots}</span>;
};

const SignalBars = ({ level }: { level: 1 | 2 | 3 }) => {
  return (
    <div className="flex items-end gap-[3px] h-5">
      <div
        className={`w-[5px] h-[40%] rounded-sm ${level >= 1 ? "bg-[#1CB0F6]" : "bg-stone-200"}`}
      />
      <div
        className={`w-[5px] h-[70%] rounded-sm ${level >= 2 ? "bg-[#1CB0F6]" : "bg-stone-200"}`}
      />
      <div
        className={`w-[5px] h-[100%] rounded-sm ${level >= 3 ? "bg-[#1CB0F6]" : "bg-stone-200"}`}
      />
    </div>
  );
};

const playTone = (
  frequency: number,
  type: OscillatorType,
  duration: number,
  vol = 0.1,
) => {
  if (typeof window === "undefined") return;
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, Math.ceil((duration + 0.12) * 1000));
  } catch (e) {}
};

const playDuolingoSuccess = () => {
  playTone(523.25, "sine", 0.15, 0.13); // C5
  setTimeout(() => playTone(659.25, "sine", 0.25, 0.13), 100); // E5
};

const playDuolingoReward = () => {
  playTone(440, "sine", 0.1);
  setTimeout(() => playTone(554.37, "sine", 0.1), 100);
  setTimeout(() => playTone(659.25, "sine", 0.1), 200);
  setTimeout(() => playTone(880, "sine", 0.3), 300);
};

const playCleaningUnlockSound = () => {
  if (typeof window === "undefined") return;
  try {
    const AudioContext =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    Array.from({ length: 9 }).forEach((_, index) => {
      const duration = 0.26;
      const start = ctx.currentTime + index * 0.38;
      const buffer = ctx.createBuffer(
        1,
        Math.floor(ctx.sampleRate * duration),
        ctx.sampleRate,
      );
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }

      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(900 + (index % 3) * 260, start);
      filter.Q.setValueAtTime(1.4, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start(start);
      source.stop(start + duration);
    });

    [987.77, 1174.66, 1567.98].forEach((frequency, index) => {
      const start = ctx.currentTime + 3.45 + index * 0.16;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });

    window.setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 4600);
  } catch (e) {}
};

// Vibration utility for mobile feedback
const hapticFeedback = {
  light: () => {
    triggerHaptic("light", 10);
    playTone(800, "sine", 0.05, 0.02);
  },
  success: () => {
    triggerHaptic("success", 50);
    playDuolingoSuccess();
  },
	  error: () => {
	    triggerHaptic("error", [10, 50, 10]);
	    playSoftErrorSound();
	  },
	  reward: () => {
	    playVictoryCelebrationFeedback();
	  },
  clean: () => {
    triggerHaptic("clean", [25, 40, 25, 40, 70]);
    playCleaningUnlockSound();
  },
};

const StarIcon = ({
  fillRatio,
  pureGold,
}: {
  fillRatio: number;
  pureGold?: boolean;
}) => (
  <svg
    width={pureGold ? "24" : "14"}
    height={pureGold ? "24" : "14"}
    viewBox="0 0 24 24"
    fill="none"
    stroke={pureGold ? "#B8860B" : "none"}
    strokeWidth={pureGold ? "0.5" : "0"}
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <linearGradient
        id={`star-fill-${fillRatio}-${pureGold}`}
        x1="0"
        y1="0"
        x2="1"
        y2="0"
      >
        <stop
          offset={`${fillRatio * 100}%`}
          stopColor={pureGold ? "#FFE600" : "#eab308"}
        />
        <stop offset={`${fillRatio * 100}%`} stopColor="#e7e5e4" />
      </linearGradient>
    </defs>
    <path
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
      fill={`url(#star-fill-${fillRatio}-${pureGold})`}
    />
  </svg>
);

const ALL_QUIZ_ITEMS = [
  { id: 1, name: "Banana", Icon: Banana },
  { id: 2, name: "Apple", Icon: Apple },
  { id: 3, name: "Sofa", Icon: Sofa },
  { id: 4, name: "Lamp", Icon: Lamp },
  { id: 5, name: "Window", image: "/assets/window.png" },
  { id: 6, name: "Box", image: "/assets/box.png" },
  { id: 7, name: "Basket", image: "/assets/basket.png" },
  { id: 8, name: "Drawer", image: "/assets/drawer.png" },
  { id: 9, name: "Dusty", image: "/assets/dusty.png" },
  { id: 10, name: "Coffee", Icon: Coffee },
  { id: 11, name: "Table", image: "/assets/jianglichaji.png" },
  { id: 12, name: "Rug", image: "/assets/renwujinagliditan.png" },
  { id: 13, name: "Photo_Wall", Icon: ImageIcon },
  { id: 14, name: "Plant", Icon: ShoppingBag },
  { id: 15, name: "Roof", Icon: Wrench },
  { id: 16, name: "Paint", Icon: Palette },
  { id: 17, name: "Clock", Icon: Clock },
];

const DecorationMarker = ({
  label,
  top,
  left,
  isPlaced,
  onClick,
  active = true,
}: {
  label: string;
  top: string;
  left: string;
  isPlaced: boolean;
  onClick?: () => void;
  active?: boolean;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: isPlaced ? 0 : 0.01, scale: isPlaced ? 0 : 1 }}
      className={`absolute z-30 flex flex-col items-center gap-1 cursor-pointer group ${active ? "pointer-events-auto" : "pointer-events-none"}`}
      style={{ top, left }}
      onPointerUp={(e) => {
        if (!isDraggingSceneGlobalRef.current) {
          onClick?.();
        }
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center border-4 border-white shadow-lg"
      >
        <Plus className="w-6 h-6 text-amber-900" />
      </motion.div>
      <div className="bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/20 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-white text-[10px] font-bold">{label}</span>
      </div>
    </motion.div>
  );
};

const CoordinateGridOverlay = ({
  sceneWidth = DEFAULT_SCENE_WIDTH,
}: {
  sceneWidth?: number;
}) => {
  return (
    <div className="absolute inset-0 z-[99] pointer-events-none select-none overflow-hidden">
      {/* Horizontal guide lines at 5% steps */}
      {Array.from({ length: 19 }).map((_, i) => {
        const percent = (i + 1) * 5;
        const isMajor = percent % 10 === 0;
        return (
          <div
            key={`h-line-${percent}`}
            className={`absolute left-0 right-0 border-t ${
              isMajor ? "border-dashed border-sky-400/25" : "border-dotted border-sky-300/15"
            } flex justify-between items-start`}
            style={{ top: `${percent}%` }}
          >
            <span className={`font-mono text-[7px] select-none rounded-br px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              Y: {percent}%
            </span>
            <span className={`font-mono text-[7px] select-none rounded-bl px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              Y: {percent}%
            </span>
          </div>
        );
      })}

      {/* Vertical guide lines at 5% steps */}
      {Array.from({ length: 19 }).map((_, i) => {
        const percent = (i + 1) * 5;
        const isMajor = percent % 10 === 0;
        const px = Math.round(sceneWidth * (percent / 100));
        return (
          <div
            key={`v-line-${percent}`}
            className={`absolute top-0 bottom-0 border-l ${
              isMajor ? "border-dashed border-sky-400/25" : "border-dotted border-sky-300/15"
            } flex flex-col justify-between items-center`}
            style={{ left: `${percent}%` }}
          >
            <span className={`font-mono text-[7px] select-none rounded-b text-center leading-tight px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              X: {percent}%{isMajor && <span className="text-[5.5px] block">({px}px)</span>}
            </span>
            <span className={`font-mono text-[7px] select-none rounded-t text-center leading-tight px-1 shadow-xs ${
              isMajor ? "text-sky-600 font-bold bg-white/80" : "text-sky-400/60 bg-white/40"
            }`}>
              X: {percent}%{isMajor && <span className="text-[5.5px] block">({px}px)</span>}
            </span>
          </div>
        );
      })}

      {/* Grid intersection coordinate cards for high fidelity measurement */}
      {Array.from({ length: 19 }).map((_, r) => {
        const rowPercent = (r + 1) * 5;
        const rMajor = rowPercent % 10 === 0;
        return Array.from({ length: 19 }).map((_, c) => {
          const colPercent = (c + 1) * 5;
          const cMajor = colPercent % 10 === 0;
          const isBothMajor = rMajor && cMajor;
          return (
            <div
              key={`dot-${rowPercent}-${colPercent}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-0.5"
              style={{ top: `${rowPercent}%`, left: `${colPercent}%` }}
            >
              <div className={`rounded-full relative ${
                isBothMajor ? "w-1.5 h-1.5 bg-sky-500/50" : "w-1 h-1 bg-sky-300/30"
              }`}>
                <div className={`absolute w-3 h-[1px] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isBothMajor ? "bg-sky-500/30" : "bg-sky-300/10"
                }`} />
                <div className={`absolute h-3 w-[1px] left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isBothMajor ? "bg-sky-500/30" : "bg-sky-300/10"
                }`} />
              </div>
              <span className={`font-mono text-[5.5px] select-none absolute top-1.5 scale-[0.85] whitespace-nowrap px-0.5 rounded ${
                isBothMajor
                  ? "text-sky-600 font-bold bg-white/80 border border-sky-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                  : "text-sky-400 bg-white/50 scale-[0.75]"
              }`}>
                {colPercent},{rowPercent}
              </span>
            </div>
          );
        });
      })}
    </div>
  );
};

const GUESS_LEVELS = [
  { word: "SUNNY", hint: "It describes the weather~" },
  { word: "TODAY", hint: "It represents a date~" },
  { word: "NURSE", hint: "A profession that cares for people in a hospital~" },
  { word: "TIGER", hint: "A large fierce feline animal~" },
];

const WordGuessGame = ({
  onComplete,
  onFail,
}: {
  onComplete: () => void;
  onFail: () => void;
}) => {
  const { word: targetWord, hint: initialHint } = useMemo(() => {
    return GUESS_LEVELS[Math.floor(Math.random() * GUESS_LEVELS.length)];
  }, []);

  const WORD_LENGTH = targetWord.length;
  const MAX_ATTEMPTS = 4;

  const [attempts, setAttempts] = useState<string[][]>(
    Array(MAX_ATTEMPTS).fill(Array(WORD_LENGTH).fill("")),
  );
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [grandmaSay, setGrandmaSay] = useState<string | null>(initialHint);
  const [successRow, setSuccessRow] = useState<number | null>(null);

  // Keyboard letters (10 letters)
  const letters = useMemo(() => {
    const chars = new Set(targetWord.split(""));
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const alphabetArray = alphabet.split("").sort(() => Math.random() - 0.5);
    for (const char of alphabetArray) {
      if (chars.size >= 10) break;
      chars.add(char);
    }
    return Array.from(chars).sort(() => Math.random() - 0.5);
  }, [targetWord]);

  const handleKeyPress = (letter: string) => {
    if (currentAttempt >= MAX_ATTEMPTS || successRow !== null) return;

    const newAttempts = [...attempts.map((row) => [...row])];
    const currentRow = newAttempts[currentAttempt];

    // Find first empty cell
    const emptyIndex = currentRow.findIndex((char) => char === "");
    if (emptyIndex !== -1) {
      currentRow[emptyIndex] = letter;
      setAttempts(newAttempts);

      // Auto check if row is full
      if (emptyIndex === WORD_LENGTH - 1) {
        checkRow(currentRow, currentAttempt);
      }
    }
  };

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    if (rowIndex !== currentAttempt || successRow !== null) return;
    const newAttempts = [...attempts.map((row) => [...row])];
    newAttempts[rowIndex][colIndex] = "";
    setAttempts(newAttempts);
  };

  const checkRow = (row: string[], rowIndex: number) => {
    const word = row.join("");
    if (word === targetWord) {
      setGrandmaSay("Too smart, couldn't stump you!");
      setSuccessRow(rowIndex);
      setTimeout(onComplete, 2000);
    } else {
      if (currentAttempt + 1 >= MAX_ATTEMPTS) {
        setGrandmaSay("Sigh, you ran out of chances...");
        setTimeout(onFail, 1500);
      } else {
        setGrandmaSay("Not quite, try again!");
        setCurrentAttempt((prev) => prev + 1);
      }
    }
  };

  const getCellStatus = (
    rowIndex: number,
    colIndex: number,
    char: string,
  ): "correct" | "present" | "absent" | "empty" | "current" => {
    if (!char) return "empty";
    if (rowIndex > currentAttempt && successRow === null) return "empty";
    if (rowIndex === currentAttempt && successRow === null) return "current";

    if (char === targetWord[colIndex]) {
      return "correct";
    } else if (targetWord.includes(char)) {
      return "present";
    } else {
      return "absent";
    }
  };

  return (
    <div className="flex-1 flex flex-col pointer-events-none relative w-full h-full">
      {/* 老奶奶小气泡 */}
      <div className="absolute top-[-100px] left-8 flex items-end gap-3 z-50 pointer-events-none">
        <div className="relative">
          <AnimatePresence>
            {grandmaSay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                className="absolute bottom-full left-4 mb-2 whitespace-nowrap"
              >
                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-lg border-2 border-amber-100 flex items-center justify-center">
                  <span className="text-amber-900 font-black text-sm italic">
                    {grandmaSay}
                  </span>
                </div>
                {/* 小尾巴 */}
                <div className="absolute left-0 bottom-[-6px] w-4 h-4 bg-white border-b-2 border-l-2 border-amber-100 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl bg-amber-50 overflow-hidden">
            <img
              src="/assets/buntouxiang.png"
              alt="Grandmother"
              className="w-full h-full object-cover -scale-x-100"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 flex flex-col items-center justify-start gap-8 pointer-events-auto">
        <div className="flex flex-col gap-4">
          {attempts.map((row, rowIndex) => (
            <div key={`row-${rowIndex}`} className="flex gap-3">
              {row.map((char, colIndex) => {
                const status = getCellStatus(rowIndex, colIndex, char);

                let bgClass = "bg-white";
                let textClass = "text-stone-700";
                let borderClass = "border-stone-200";

                if (status === "correct") {
                  bgClass = "bg-emerald-500";
                  borderClass = "border-emerald-600";
                  textClass = "text-white";
                } else if (status === "present") {
                  bgClass = "bg-amber-400";
                  borderClass = "border-amber-500";
                  textClass = "text-white";
                } else if (status === "absent") {
                  bgClass = "bg-stone-300";
                  borderClass = "border-stone-400";
                  textClass = "text-white";
                } else if (status === "current") {
                  borderClass = "border-amber-500";
                  textClass = "text-amber-700";
                }

                // Give it a shadow if it's the current target cell
                const isTargetCell =
                  rowIndex === currentAttempt && !char && successRow === null;
                const shadowClass = isTargetCell
                  ? "shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                  : "";

                // Animate completion bounce
                const isSuccessAnim = successRow === rowIndex;

                return (
                  <motion.div
                    key={`cell-${rowIndex}-${colIndex}`}
                    className={`w-14 h-14 rounded-xl border-4 text-2xl font-black flex items-center justify-center cursor-pointer transition-colors duration-300
                      ${bgClass} ${textClass} ${borderClass} ${shadowClass}
                    `}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    animate={
                      isSuccessAnim
                        ? { y: [0, -15, 0] }
                        : char && status === "current"
                          ? { scale: [1.2, 1] }
                          : { scale: 1 }
                    }
                    transition={
                      isSuccessAnim
                        ? {
                            duration: 0.5,
                            delay: colIndex * 0.1,
                            ease: "easeOut",
                          }
                        : { duration: 0.2 }
                    }
                  >
                    {char}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="w-full max-w-sm mt-8">
          <div className="grid grid-cols-5 gap-2">
            {letters.map((letter) => {
              // Determine keyboard letter status (most exact match across submitted rows)
              let keyStatus = "empty";
              if (successRow !== null || currentAttempt > 0) {
                const subAttempts = attempts.slice(
                  0,
                  successRow !== null ? successRow + 1 : currentAttempt,
                );
                const allUsedChars = subAttempts.flat();
                if (allUsedChars.includes(letter)) {
                  // check if any of the used are 'correct'
                  let isCorrect = false;
                  subAttempts.forEach((row) => {
                    row.forEach((c, idx) => {
                      if (c === letter && targetWord[idx] === letter) {
                        isCorrect = true;
                      }
                    });
                  });

                  if (isCorrect) {
                    keyStatus = "correct";
                  } else if (targetWord.includes(letter)) {
                    keyStatus = "present";
                  } else {
                    keyStatus = "absent";
                  }
                }
              }

              let keyBgClass =
                "bg-white border-stone-200 text-stone-600 active:bg-stone-100";
              if (keyStatus === "correct") {
                keyBgClass = "bg-emerald-500 border-emerald-600 text-white";
              } else if (keyStatus === "present") {
                keyBgClass = "bg-amber-400 border-amber-500 text-white";
              } else if (keyStatus === "absent") {
                keyBgClass = "bg-stone-300 border-stone-400 text-stone-100";
              }

              return (
                <motion.button
                  key={letter}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`h-12 border-2 rounded-xl font-black text-xl shadow-sm disabled:opacity-50 transition-colors ${keyBgClass}`}
                  onClick={() => handleKeyPress(letter)}
                  disabled={
                    currentAttempt >= MAX_ATTEMPTS || successRow !== null
                  }
                >
                  {letter}
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const QuizGame = ({
  level,
  onComplete,
  onFail,
}: {
  level: number;
  onComplete: () => void;
  onFail: () => void;
}) => {
  const [leftSelection, setLeftSelection] = useState<number | null>(null);
  const [rightSelection, setRightSelection] = useState<number | null>(null);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const [wrongEffect, setWrongEffect] = useState<boolean>(false);
  const [lines, setLines] = useState<
    { id: number; x1: number; y1: number; x2: number; y2: number }[]
  >([]);
  const [mistakes, setMistakes] = useState(0);
  const [grandmaSay, setGrandmaSay] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const leftRefs = useRef<Map<number, HTMLButtonElement>>(new Map());
  const rightRefs = useRef<Map<number, HTMLButtonElement>>(new Map());

  const compliments = [
    "Awesome!",
    "So smart!",
    "Good job!",
    "Great memory!",
    "Very quick!",
    "Keep it up!",
  ];

  // 为每个关卡选择 5 个随机项目
  const currentItems = useMemo(() => {
    // 使用 level 作为种子来保证关卡内的项目一致，或者完全随机
    const shuffled = [...ALL_QUIZ_ITEMS].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 5);
  }, [level]);

  const leftItems = useMemo(
    () => [...currentItems].sort(() => Math.random() - 0.5),
    [currentItems],
  );
  const rightItems = useMemo(
    () => [...currentItems].sort(() => Math.random() - 0.5),
    [currentItems],
  );

  const calculateLinePositions = (id: number) => {
    if (!containerRef.current) return null;
    const lEl = leftRefs.current.get(id);
    const rEl = rightRefs.current.get(id);
    if (!lEl || !rEl) return null;

    const cRect = containerRef.current.getBoundingClientRect();
    const lRect = lEl.getBoundingClientRect();
    const rRect = rEl.getBoundingClientRect();

    return {
      id,
      x1: lRect.right - cRect.left,
      y1: lRect.top + lRect.height / 2 - cRect.top,
      x2: rRect.left - cRect.left,
      y2: rRect.top + rRect.height / 2 - cRect.top,
    };
  };

  useEffect(() => {
    if (leftSelection !== null && rightSelection !== null) {
      if (leftSelection === rightSelection) {
        const newLine = calculateLinePositions(leftSelection);
        if (newLine) {
          setLines((prev) => [...prev, newLine]);
        }
        setMatchedIds((prev) => [...prev, leftSelection]);

        // 老奶奶夸奖
        const randomMsg =
          compliments[Math.floor(Math.random() * compliments.length)];
        setGrandmaSay(randomMsg);
        setTimeout(() => setGrandmaSay(null), 1500);

        setLeftSelection(null);
        setRightSelection(null);
      } else {
        setWrongEffect(true);
        setMistakes((prev) => prev + 1);
        const timer = setTimeout(() => {
          setWrongEffect(false);
          setLeftSelection(null);
          setRightSelection(null);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [leftSelection, rightSelection]);

  useEffect(() => {
    if (mistakes >= 3) {
      onFail();
    }
  }, [mistakes, onFail]);

  useEffect(() => {
    if (matchedIds.length === 5) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
  }, [matchedIds, onComplete]);

  return (
    <div className="flex-1 flex flex-col pointer-events-none relative">
      {/* 老奶奶小气泡提示区 */}
      <div className="absolute top-[-100px] left-8 flex items-end gap-3 z-50 pointer-events-none">
        <div className="relative">
          <AnimatePresence>
            {grandmaSay && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, scale: 0.5, y: 10, x: 20 }}
                className="absolute bottom-full left-4 mb-2 whitespace-nowrap"
              >
                <div className="bg-white px-4 py-2 rounded-2xl rounded-bl-none shadow-lg border-2 border-amber-100 flex items-center justify-center">
                  <span className="text-amber-900 font-black text-sm italic">
                    {grandmaSay}
                  </span>
                </div>
                {/* 小尾巴 */}
                <div className="absolute left-0 bottom-[-6px] w-4 h-4 bg-white border-b-2 border-l-2 border-amber-100 rotate-45" />
              </motion.div>
            )}
          </AnimatePresence>
          <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl bg-amber-50 overflow-hidden">
            <img
              src="/assets/buntouxiang.png"
              alt="Grandmother"
              className="w-full h-full object-cover -scale-x-100"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </div>

      {/* 游戏主体 */}
      <div className="flex-1 px-8 py-4 flex flex-col justify-center gap-4 pointer-events-auto">
        <div
          ref={containerRef}
          className="grid grid-cols-2 gap-x-12 relative h-[450px]"
        >
          {/* SVG 连接线图层 */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <svg className="w-full h-full overflow-visible">
              <AnimatePresence>
                {lines.map((line) => (
                  <motion.line
                    key={`line-${line.id}`}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke="#10b981"
                    strokeWidth="6"
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                ))}
              </AnimatePresence>
            </svg>
          </div>

          {/* 左侧图标列 */}
          <div className="flex flex-col justify-around">
            {leftItems.map((item) => {
              const isMatched = matchedIds.includes(item.id);
              const isSelected = leftSelection === item.id;
              return (
                <motion.button
                  key={`left-${item.id}`}
                  ref={(el) => {
                    if (el) leftRefs.current.set(item.id, el);
                  }}
                  disabled={isMatched || (wrongEffect && isSelected)}
                  onClick={() => !isMatched && setLeftSelection(item.id)}
                  className={`relative group w-20 h-20 rounded-3xl flex items-center justify-center border-2 transition-all duration-300 z-10
                    ${
                      isMatched
                        ? "bg-emerald-50 border-emerald-500"
                        : isSelected
                          ? wrongEffect
                            ? "bg-red-100 border-red-500 animate-shake"
                            : "bg-amber-100 border-amber-500 scale-105"
                          : "bg-white border-amber-900/10 hover:border-amber-500/50"
                    }`}
                >
                  {item.Icon ? (
                    <item.Icon
                      className={`w-10 h-10 ${isMatched ? "text-stone-300" : "text-stone-700"}`}
                    />
                  ) : item.image ? (
                    <img
                      src={item.image}
                      className="w-14 h-14 object-contain translate-y-[2px]"
                      alt={item.name}
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </motion.button>
              );
            })}
          </div>

          {/* 右侧单词列 */}
          <div className="flex flex-col justify-around">
            {rightItems.map((item) => {
              const isMatched = matchedIds.includes(item.id);
              const isRightSelected = rightSelection === item.id;
              return (
                <motion.button
                  key={`right-${item.id}`}
                  ref={(el) => {
                    if (el) rightRefs.current.set(item.id, el);
                  }}
                  disabled={isMatched || (wrongEffect && isRightSelected)}
                  onClick={() => !isMatched && setRightSelection(item.id)}
                  className={`relative h-14 w-full rounded-2xl flex items-center justify-center border-2 font-black italic tracking-wide transition-all duration-300 z-10
                    ${
                      isMatched
                        ? "bg-emerald-50 border-emerald-500 text-white"
                        : isRightSelected
                          ? wrongEffect
                            ? "bg-red-100 border-red-500 text-red-700 animate-shake"
                            : "bg-amber-100 border-amber-500 text-amber-700 scale-105 shadow-lg"
                          : "bg-white border-amber-900/10 text-stone-600 hover:border-amber-500/50"
                    }`}
                >
                  {item.name}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* 错误提示 / 生命值 */}
        <div className="mt-8 flex justify-center gap-2">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i < 3 - mistakes ? 1 : 0,
                opacity: i < 3 - mistakes ? 1 : 0,
              }}
              className="w-4 h-4 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
};

const SpeechBubble = ({
  text,
  icon,
  show,
  onClick,
}: {
  text?: string;
  icon?: string;
  show: boolean;
  onClick?: () => void;
}) => (
  <AnimatePresence>
    {show && (
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 5 }}
        whileTap={{ scale: 0.95 }}
        onClick={onClick}
        className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-4 flex flex-col items-center z-[100] w-48 ${onClick ? "cursor-pointer pointer-events-auto" : "pointer-events-none"}`}
      >
        <div className="relative flex flex-col items-center">
          {/* 1. 最顶层内容 (z-20) */}
          <div className="relative z-20 p-3 flex items-center justify-center min-w-[60px]">
            {text && (
              <p className="text-[11px] font-bold text-neutral-800 text-center leading-relaxed px-2">
                {text}
              </p>
            )}
            {icon && (
              <img
                src={icon}
                alt="icon"
                className="w-8 h-8 object-contain"
                referrerPolicy="no-referrer"
              />
            )}
          </div>

          {/* 2. 中间层气泡主体 qipao1 (z-10) */}
          <img
            src="/assets/qipao1.png"
            alt=""
            className="absolute inset-0 w-full h-full z-10"
            style={{ objectFit: "fill" }}
            referrerPolicy="no-referrer"
          />

          {/* 3. 最底层气泡箭头 qipao2 (z-0) */}
          <img
            src="/assets/qipao2.png"
            alt=""
            className="w-4 h-4 -mb-3 relative z-0"
            style={{ marginTop: "-8px" }}
            referrerPolicy="no-referrer"
          />
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

const TypewriterText = ({
  text,
  onComplete,
  speed = 80,
  onWordTyped,
  instant = false,
}: {
  text: string;
  onComplete?: () => void;
  speed?: number;
  onWordTyped?: () => void;
  instant?: boolean;
}) => {
  const [displayedWords, setDisplayedWords] = useState<string[]>([]);
  const words = useMemo(() => text.split(" "), [text]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const onWordTypedRef = useRef(onWordTyped);
  onWordTypedRef.current = onWordTyped;

  useEffect(() => {
    if (instant) {
      setDisplayedWords(words);
      onCompleteRef.current?.();
      return;
    }

    let i = 0;
    setDisplayedWords([]);
    const interval = setInterval(() => {
      setDisplayedWords(words.slice(0, i + 1));
      i++;
      onWordTypedRef.current?.();
      if (i >= words.length) {
        clearInterval(interval);
        onCompleteRef.current?.();
      }
    }, speed);
    return () => clearInterval(interval);
  }, [words, speed, instant]);
  return (
    <SpeechProgressText
      text={displayedWords.join(" ")}
      speechMatchText={text}
      className="whitespace-pre-wrap"
    />
  );
}

const PreludeTypewriterText: React.FC<{
  text: string;
  className?: string;
  speed?: number;
  instant?: boolean;
}> = ({
  text,
  className,
  speed = 72,
  instant = false,
}) => (
  <p className={className}>
    <TypewriterText text={text} speed={speed} instant={instant} />
  </p>
);

const UnderlinedDialogueText = ({ text }: { text: string }) => {
  return (
    <SpeechProgressText
      text={text}
      underlineWords
      underlineClassName="border-stone-400/35"
      className="whitespace-pre-wrap"
    />
  );
};

const ChatMessage = ({ sender, name, avatarBg, avatarImg, align, children, borderColor }: any) => {
  const isRight = align === 'right';

  // npc: Orange stroke (#F97316), me/player: Blue stroke (#2563EB)
  const strokeColor = isRight ? '#2563EB' : '#F97316';

  return (
    <div className={`flex w-full ${isRight ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex gap-3 max-w-[85%] ${isRight ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar Plate Wrapper */}
        <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
          {/* Bottom Background Plate (qitatouxiangdi/zhujuetouxiangdi) */}
          <img
            src={avatarBg}
            className="absolute inset-0 w-full h-full object-contain"
            referrerPolicy="no-referrer"
          />
          {/* Top Avatar Face (npc1/zhujue1) */}
          <img
            src={avatarImg}
            className="absolute w-[68%] h-[68%] object-contain rounded-full"
            style={{ top: '10%' }}
            referrerPolicy="no-referrer"
          />
          {/* Name Label centered over the bottom yellow region of the plate */}
          <div
            className="absolute bottom-[7px] left-0 right-0 px-1 text-center text-[#4E2B02] text-[8.5px] font-black uppercase whitespace-nowrap tracking-wide leading-none select-none"
            style={{ zIndex: 12 }}
          >
            {name}
          </div>
        </div>

        {/* Dialogue Bubble */}
        <div
          className="relative px-5 py-3 bg-white border-[3px] rounded-[20px] shadow-sm text-stone-800 font-bold text-sm leading-relaxed"
          style={{ borderColor: strokeColor }}
        >
          {children}
          {/* Outer Triangle Pointer (border matching bubble) */}
          <div
            className={`absolute top-[14px] ${isRight ? '-right-[10px] border-l-[10px] border-y-transparent border-y-[8px]' : '-left-[10px] border-r-[10px] border-y-transparent border-y-[8px]'} w-0 h-0 z-0`}
            style={isRight ? { borderLeftColor: strokeColor } : { borderRightColor: strokeColor }}
          />
          {/* Inner Triangle Pointer (white background overlay) */}
          <div className={`absolute top-[17px] ${isRight ? '-right-[5px] border-l-white border-l-[6px] border-y-transparent border-y-[6px]' : '-left-[5px] border-r-white border-r-[6px] border-y-transparent border-y-[6px]'} w-0 h-0 z-10`} />
        </div>
      </div>
    </div>
  );
}

const ONBOARDING_TITLES = [
  "LingoVille",
  "The most fun way to learn",
  "What language would you like to learn?",
  "Preferred App language?",
  "How much Spanish do you know?",
  "Why are you learning Spanish?",
  "I'm crafting your personalized journey",
  "Your learning journey is OK!",
  "Perfect!",
];

const SPOKEN_LANGUAGES = [
  { flag: "🇺🇸", name: "American English" },
  { flag: "🇬🇧", name: "British English" },
  { flag: "🇪🇸", name: "Spanish" },
  { flag: "🇫🇷", name: "French" },
  { flag: "🇩🇪", name: "German" },
  { flag: "🇯🇵", name: "Japanese" },
  { flag: "🇨🇳", name: "Chinese" },
  { flag: "🇮🇹", name: "Italian" },
  { flag: "🇰🇷", name: "Korean" },
  { flag: "🇷🇺", name: "Russian" },
];

const SceneryAnimations = () => {
  return (
    <div className="absolute inset-0 pointer-events-none z-[5] overflow-hidden">
      {/* Airplane */}
      <div className="town-sky-float town-sky-float-a absolute top-[18%]">
        <span className="text-4xl filter drop-shadow-sm opacity-80 inline-block scale-x-[-1]">
          ✈️
        </span>
      </div>

      {/* Another Airplane delayed */}
      <div className="town-sky-float town-sky-float-b absolute top-[12%]">
        <span className="text-3xl filter drop-shadow-sm opacity-60 -rotate-[15deg] inline-block">
          ✈️
        </span>
      </div>

      <div className="town-sky-float town-sky-float-c absolute top-[35%]">
        <span className="text-2xl filter drop-shadow opacity-90 inline-block scale-x-[-1]">
          🕊️
        </span>
      </div>

      <div className="town-sky-float town-sky-float-d absolute top-[28%]">
        <span className="text-xl filter drop-shadow opacity-80 inline-block">
          🕊️
        </span>
      </div>
    </div>
  );
};

const UnitCompleteScreen = ({
  unitId,
  eyebrow = "Welcome home",
  subtitle = "Your town is ready for a new decoration.",
  onContinue,
  layerClassName = "z-[110000]",
}: {
  unitId: number;
  eyebrow?: string;
  subtitle?: string;
  onContinue: () => void;
  layerClassName?: string;
}) => (
  <motion.div
    key={`unit-${unitId}-complete`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className={`absolute inset-0 ${layerClassName} bg-[#111827] pointer-events-auto overflow-hidden flex items-center justify-center`}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.32),transparent_34%),linear-gradient(180deg,#172554_0%,#111827_58%,#020617_100%)]" />
    {Array.from({ length: 7 }).map((_, burstIndex) => (
      <motion.div
        key={`unit-complete-firework-${burstIndex}`}
        className="absolute h-2 w-2 rounded-full bg-white"
        style={{
          left: `${12 + ((burstIndex * 17) % 76)}%`,
          top: `${12 + ((burstIndex * 23) % 52)}%`,
          boxShadow:
            "0 0 0 8px rgba(251,191,36,.55), 0 0 0 18px rgba(34,197,94,.28), 0 0 38px 18px rgba(56,189,248,.34)",
        }}
        initial={{ opacity: 0, scale: 0.1 }}
        animate={{ opacity: [0, 1, 0], scale: [0.1, 1.6, 2.8] }}
        transition={{
          duration: 1.7,
          delay: burstIndex * 0.18,
          repeat: Infinity,
          repeatDelay: 1.4,
        }}
      />
    ))}
    {Array.from({ length: 64 }).map((_, shardIndex) => (
      <motion.span
        key={`unit-complete-shard-${shardIndex}`}
        className="absolute h-3 w-1.5 rounded-full"
        style={{
          left: "50%",
          top: "50%",
          background:
            shardIndex % 4 === 0
              ? "#FDE047"
              : shardIndex % 4 === 1
                ? "#38BDF8"
                : shardIndex % 4 === 2
                  ? "#FB7185"
                  : "#86EFAC",
        }}
        initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.5 }}
        animate={{
          opacity: [0, 1, 1, 0],
          x:
            Math.cos((Math.PI * 2 * shardIndex) / 64) *
            (120 + (shardIndex % 8) * 18),
          y:
            Math.sin((Math.PI * 2 * shardIndex) / 64) *
            (150 + (shardIndex % 7) * 16),
          rotate: 360 + shardIndex * 12,
          scale: [0.5, 1.2, 0.9],
        }}
        transition={{
          duration: 2.5,
          delay: (shardIndex % 12) * 0.035,
          repeat: Infinity,
          repeatDelay: 0.9,
          ease: "easeOut",
        }}
      />
    ))}

    <motion.div
      initial={{ scale: 0.74, y: 24, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: "spring", damping: 16, stiffness: 180 }}
      className="relative z-10 w-full px-7 text-center"
    >
      <p className="text-[12px] font-black uppercase tracking-[0.34em] text-sky-200">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-[52px] leading-[0.94] font-black text-white drop-shadow-[0_10px_30px_rgba(59,130,246,0.8)]">
        Unit {unitId}
        <br />
        Complete
      </h1>
      <p className="mx-auto mt-5 max-w-[280px] text-[15px] font-black leading-relaxed text-sky-100">
        {subtitle}
      </p>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onContinue}
        className="mt-9 h-[58px] w-full max-w-[310px] rounded-[22px] bg-[#58CC02] text-[18px] font-black text-white shadow-[0_7px_0_#3f9300] active:translate-y-[5px] active:shadow-none"
      >
        Continue
      </motion.button>
    </motion.div>
  </motion.div>
);

export default function App() {
  const appRootRef = useRef<HTMLDivElement>(null);
  const townBgmRef = useRef<TownBgmController | null>(null);
  const levelTransitionInputLockRef = useRef(false);
  const levelTransitionInputLockTimerRef = useRef<number | null>(null);
  const sceneX = useMotionValue(0);
  const sceneY = useMotionValue(0);
  const townCameraScale = useMotionValue(TOWN_CAMERA_ZOOM_DEFAULT);
  const townUnlockCameraRef = useRef<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const frameworkGuideCameraRef = useRef<{
    x: number;
    y: number;
    zoom: number;
  } | null>(null);
  const [joystickState, setJoystickState] = useState<{
    origin: { x: number; y: number };
    current: { x: number; y: number };
  } | null>(null);
  const joystickDelta = useRef(0);
  const rAFRef = useRef<number>();
  const [activeTab, setActiveTab] = useState<
    "town" | "profile" | "ai_custom" | "ai_course"
  >("town");
  const [aiPracticeCategory, setAiPracticeCategory] = useState<string | null>(
    null,
  );
  const [scene, setScene] = useState<"exterior" | "interior">("exterior");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [diamonds, setDiamonds] = useState(0);
  const [stamina, setStamina] = useState(25);
  const [lastStaminaRefreshDate, setLastStaminaRefreshDate] = useState(() =>
    getLocalDayKey(),
  );
  const [correctAnswerStreak, setCorrectAnswerStreak] = useState(0);
  const [showTasks, setShowTasks] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showReferenceGrid, setShowReferenceGrid] = useState(false);
  const [selectedTownEditorDecorationId, setSelectedTownEditorDecorationId] =
    useState<string | null>(null);
  const [pickedTownDecorationId, setPickedTownDecorationId] =
    useState<string | null>(null);
	  const [townCameraZoom, setTownCameraZoom] = useState(() => {
	    try {
	      const stored = localStorage.getItem(TOWN_CAMERA_ZOOM_STORAGE_KEY);
	      const parsed = stored ? Number(stored) : TOWN_CAMERA_ZOOM_DEFAULT;
	      return Number.isFinite(parsed)
	        ? clampTownCameraZoom(parsed)
	        : TOWN_CAMERA_ZOOM_DEFAULT;
	    } catch {
	      return TOWN_CAMERA_ZOOM_DEFAULT;
	    }
	  });
  const [townCameraPanSpeed, setTownCameraPanSpeed] = useState(() => {
    try {
      const stored = localStorage.getItem(TOWN_CAMERA_PAN_SPEED_STORAGE_KEY);
      const parsed = stored ? Number(stored) : TOWN_CAMERA_PAN_SPEED_DEFAULT;
      return Number.isFinite(parsed)
        ? clampTownCameraPanSpeed(parsed)
        : TOWN_CAMERA_PAN_SPEED_DEFAULT;
    } catch {
      return TOWN_CAMERA_PAN_SPEED_DEFAULT;
    }
  });
  const [isAppVisible, setIsAppVisible] = useState(() =>
    typeof document === "undefined" ? true : !document.hidden,
  );
  const isMobilePerformanceMode = useMemo(isMobileLikeDevice, []);
	  useEffect(() => {
	    townCameraScale.set(townCameraZoom);
	  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncVisibility = () => setIsAppVisible(!document.hidden);
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("pagehide", syncVisibility);
    window.addEventListener("pageshow", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("pagehide", syncVisibility);
      window.removeEventListener("pageshow", syncVisibility);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOWN_CAMERA_PAN_SPEED_STORAGE_KEY,
        townCameraPanSpeed.toString(),
      );
      (window as any).__LINGOVILLE_TOWN_CAMERA_PAN_SPEED__ =
        townCameraPanSpeed;
    } catch (e) {
      console.error(e);
    }
  }, [townCameraPanSpeed]);

  useEffect(() => {
    const handleGlobalButtonFeedback = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const target = event.target as Element | null;
      const feedbackTarget = target?.closest(
        "button,a,[role='button'],input[type='button'],input[type='submit'],input[type='reset']",
      ) as HTMLElement | null;

      if (!feedbackTarget || !appRootRef.current?.contains(feedbackTarget)) {
        return;
      }

      if (
        feedbackTarget.getAttribute("aria-disabled") === "true" ||
        (feedbackTarget as HTMLButtonElement).disabled
      ) {
        return;
      }

      playButtonClickSound();

      const label = `${feedbackTarget.textContent || ""} ${
        feedbackTarget.getAttribute("aria-label") || ""
      }`.toLowerCase();
      if (/\bcontinue\b|\bgot it\b|继续|下一步/.test(label)) {
        triggerHaptic("light", 8);
      }
    };

    document.addEventListener("pointerup", handleGlobalButtonFeedback, true);
    return () => {
      document.removeEventListener(
        "pointerup",
        handleGlobalButtonFeedback,
        true,
      );
    };
  }, []);
  const [homeDecorationPositions, setHomeDecorationPositions] = useState<
    Record<HomeDecorationId, HomeDecorationPosition>
  >(() => {
    const defaults = getDefaultHomeDecorationPositions();
    try {
      const stored = localStorage.getItem(
        "lingoville_home_decoration_positions",
      );
      if (!stored) return defaults;

      const parsed = JSON.parse(stored) as Partial<
        Record<HomeDecorationId, HomeDecorationPosition>
      >;
      return HOME_DECORATIONS.reduce((positions, decoration) => {
        const saved = parsed[decoration.id];
	            positions[decoration.id] =
	              saved &&
	              Number.isFinite(saved.x) &&
	              Number.isFinite(saved.y)
	                ? {
	                    x: saved.x,
	                    y: saved.y,
	                    width: decoration.width,
	                  }
	                : defaults[decoration.id];
        return positions;
      }, {} as Record<HomeDecorationId, HomeDecorationPosition>);
    } catch {
      return defaults;
    }
  });
  const [townEditorBuildingPositions, setTownEditorBuildingPositions] =
    useState<Record<string, TownEditorPosition>>(() => {
      const defaults = getDefaultTownEditorBuildingPositions();
      try {
        const stored = localStorage.getItem(
          "lingoville_town_editor_building_positions",
        );
        if (!stored) return defaults;

        const parsed = JSON.parse(stored) as Partial<
          Record<string, TownEditorPosition>
        >;
        return TOWN_EDITOR_BUILDINGS.reduce((positions, building) => {
          const key = String(building.id);
          const saved = parsed[key];
          positions[key] =
            saved &&
            Number.isFinite(saved.x) &&
            Number.isFinite(saved.y) &&
            Number.isFinite(saved.width)
              ? saved
              : defaults[key];
          return positions;
        }, {} as Record<string, TownEditorPosition>);
      } catch {
        return defaults;
      }
    });
  const [townEditorDecorationPositions, setTownEditorDecorationPositions] =
    useState<Record<string, TownEditorPosition>>(() => {
      const defaults = getDefaultTownEditorDecorationPositions();
      try {
        const canUseSavedWidths =
          localStorage.getItem(TOWN_EDITOR_DECORATION_SIZE_READY_STORAGE_KEY) ===
          "true";
        const stored = localStorage.getItem(
          "lingoville_town_editor_decoration_positions",
        );
        if (!stored) return defaults;

        const parsed = JSON.parse(stored) as Partial<
          Record<string, TownEditorPosition>
        >;
        return TOWN_EDITOR_BUILDINGS.reduce((positions, building) => {
          building.decorations.forEach((decoration) => {
            const saved = parsed[decoration.id];
            positions[decoration.id] =
              saved &&
              Number.isFinite(saved.x) &&
              Number.isFinite(saved.y)
                ? {
                    x: saved.x,
                    y: saved.y,
                    width:
                      canUseSavedWidths && Number.isFinite(saved.width)
                        ? saved.width
                        : decoration.width,
                  }
                : defaults[decoration.id];
          });
          return positions;
        }, {} as Record<string, TownEditorPosition>);
      } catch {
        return defaults;
      }
    });
  const [lastSeenTownDecorUnlockCount, setLastSeenTownDecorUnlockCount] =
    useState<number | null>(() => {
      try {
        const stored = localStorage.getItem(TOWN_DECOR_UNLOCK_STORAGE_KEY);
        if (!stored) return null;
        const parsed = Number(stored);
        return Number.isFinite(parsed) ? parsed : null;
      } catch {
        return null;
      }
    });
  const [
    lastSeenTownBuildingUpgradeCount,
    setLastSeenTownBuildingUpgradeCount,
  ] = useState(() => {
    try {
      const stored = localStorage.getItem(
        TOWN_BUILDING_UPGRADE_SEEN_STORAGE_KEY,
      );
      const parsed = stored ? Number(stored) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  });
  const [townDecorUnlockAnimation, setTownDecorUnlockAnimation] =
    useState<TownDecorUnlockAnimation | null>(null);
  const [townNpcReactionBubble, setTownNpcReactionBubble] =
    useState<TownDecorUnlockAnimation | null>(null);
  const [townNpcInspectAnimation, setTownNpcInspectAnimation] =
    useState<TownDecorUnlockAnimation | null>(null);
  const [townBuildingUpgradeHoldIds, setTownBuildingUpgradeHoldIds] = useState<
    number[]
  >([]);
  const [townBuildingUpgradeToast, setTownBuildingUpgradeToast] = useState<{
    key: number;
    buildingId: number;
    name: string;
    fromLevel: number;
    toLevel: number;
  } | null>(null);
  const [townDecorRewardReveal, setTownDecorRewardReveal] =
    useState<TownDecorRewardReveal | null>(null);
  const [townGarbageItems, setTownGarbageItems] = useState<TownGarbageItem[]>(
    [],
  );
  const [townGarbagePrompt, setTownGarbagePrompt] =
    useState<TownGarbagePrompt | null>(null);
  const [townGarbageSmoke, setTownGarbageSmoke] =
    useState<TownGarbageSmokeEffect | null>(null);
  const [townGarbageEnergyFlight, setTownGarbageEnergyFlight] =
    useState<TownGarbageEnergyFlight | null>(null);
	  const [townGarbageTip, setTownGarbageTip] = useState<{
	    key: number;
	    text: string;
	  } | null>(null);
  const [townGarbageDailyReward, setTownGarbageDailyReward] = useState(() => {
    const today = getLocalDayKey();
    try {
      const stored = localStorage.getItem(TOWN_GARBAGE_DAILY_REWARD_STORAGE_KEY);
      if (!stored) return { date: today, count: 0 };
      const parsed = JSON.parse(stored) as { date?: string; count?: number };
      if (parsed.date !== today) return { date: today, count: 0 };
      return {
        date: today,
        count: Math.min(
          TOWN_GARBAGE_DAILY_REWARD_LIMIT,
          Math.max(0, Number(parsed.count) || 0),
        ),
      };
    } catch {
      return { date: today, count: 0 };
    }
  });
	  const [pendingTownDecorUnlockCounts, setPendingTownDecorUnlockCounts] =
    useState<number[]>(() => {
      try {
        const stored = localStorage.getItem(
          TOWN_DECOR_PENDING_UNLOCK_STORAGE_KEY,
        );
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0)
          .sort((a, b) => a - b);
      } catch {
        return [];
      }
    });
  const [townDecorationUnlockOrderOverrides, setTownDecorationUnlockOrderOverrides] =
    useState<Record<string, string[]>>(() => {
      try {
        const stored = localStorage.getItem(
          TOWN_DECORATION_UNLOCK_ORDER_STORAGE_KEY,
        );
        if (!stored) return {};
        const parsed = JSON.parse(stored);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return {};
        }
        return Object.entries(parsed).reduce(
          (lookup, [buildingId, ids]) => {
            if (!Array.isArray(ids)) return lookup;
            lookup[buildingId] = ids
              .map((id) => String(id))
              .filter(Boolean);
            return lookup;
          },
          {} as Record<string, string[]>,
        );
      } catch {
        return {};
      }
    });
  const [manualUnlockedTownDecorationIds, setManualUnlockedTownDecorationIds] =
    useState<string[]>(() => {
      try {
        const stored = localStorage.getItem(
          TOWN_MANUAL_UNLOCKED_DECORATIONS_STORAGE_KEY,
        );
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return Array.from(new Set(parsed.map((id) => String(id)).filter(Boolean)));
      } catch {
        return [];
      }
    });
  const [pendingDirectTownDecorUnlocks, setPendingDirectTownDecorUnlocks] =
    useState<PendingDirectTownDecorUnlock[]>(() => {
      try {
        const stored = localStorage.getItem(TOWN_DIRECT_DECOR_PENDING_STORAGE_KEY);
        if (!stored) return [];
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .map((item) => ({
            buildingId: Number(item?.buildingId),
            decorationId: String(item?.decorationId || ""),
            unlockCount: Number.isFinite(Number(item?.unlockCount))
              ? Number(item.unlockCount)
              : undefined,
          }))
          .filter(
            (item) =>
              Number.isFinite(item.buildingId) && Boolean(item.decorationId),
          );
      } catch {
        return [];
      }
    });
  const [newTownDecorBubbleIds, setNewTownDecorBubbleIds] = useState<string[]>(
    [],
  );
  const [tappedTownDecoration, setTappedTownDecoration] = useState<{
    id: string;
    key: number;
  } | null>(null);
  const [townDecorProgressParticles, setTownDecorProgressParticles] =
    useState<TownDecorProgressParticles | null>(null);
  const [pendingMiaDecorGuide, setPendingMiaDecorGuide] = useState(false);
  const [miaDecorGuideStep, setMiaDecorGuideStep] = useState<0 | 1 | 2>(0);
  const [townProgressPulse, setTownProgressPulse] = useState(false);
  const [townProgressCatchPulse, setTownProgressCatchPulse] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [showLevelConfirm, setShowLevelConfirm] = useState(false);
  const [showStaminaRecoveryPrompt, setShowStaminaRecoveryPrompt] =
    useState(false);
  const [showSceneModal, setShowSceneModal] = useState(false);
  const [showDialogueFlow, setShowDialogueFlow] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [targetDecorationPrompt, setTargetDecorationPrompt] =
    useState<PendingDirectTownDecorUnlock | null>(null);
  const [targetDecorationQuiz, setTargetDecorationQuiz] =
    useState<PendingDirectTownDecorUnlock | null>(null);
  const [lockedBuildingPrompt, setLockedBuildingPrompt] =
    useState<TownEditorBuildingAsset | null>(null);
  const [earlyUnlockConfirmBuilding, setEarlyUnlockConfirmBuilding] =
    useState<TownEditorBuildingAsset | null>(null);
  const [earlyUnlockBuildingId, setEarlyUnlockBuildingId] =
    useState<number | null>(null);
  const [showEarlyUnlockSuccess, setShowEarlyUnlockSuccess] = useState(false);
  const [earlyUnlockConfettiKey, setEarlyUnlockConfettiKey] = useState(0);
  const [extraUnlockedBuildingIds, setExtraUnlockedBuildingIds] = useState<
    number[]
  >(() => {
    try {
      const stored = localStorage.getItem(
        TOWN_EARLY_UNLOCKED_BUILDINGS_STORAGE_KEY,
      );
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 1)
        .sort((a, b) => a - b);
    } catch {
      return [];
    }
  });
  const [showVictory, setShowVictory] = useState(false);
  const [showVictoryMsg, setShowVictoryMsg] = useState(false);
  const [showPreludeVictory, setShowPreludeVictory] = useState(false);
  const [isMergedPreludeComplete, setIsMergedPreludeComplete] =
    useState(false);
  const preludeFinishStartedRef = useRef(false);
  const [completedVictoryUnitId, setCompletedVictoryUnitId] = useState(1);
  const [showWinStreak, setShowWinStreak] = useState(false);
  const [showBuildingUpgrade, setShowBuildingUpgrade] = useState(false);
  const [showGrannyExclamation, setShowGrannyExclamation] = useState(false);
  const [dismissedCardPhase, setDismissedCardPhase] = useState(0);
  const [animatingCompletedPhase, setAnimatingCompletedPhase] = useState<
    number | null
  >(null);
  const [isGrandmaIntroShown, setIsGrandmaIntroShown] = useState(false); // New state to control initial visibility
  const [winStreakNumber, setWinStreakNumber] = useState(1);
  const [streakDays, setStreakDays] = useState(0);
  const [lastStreakDate, setLastStreakDate] = useState<string | null>(null);
  const [lastLessonStreakPanelDate, setLastLessonStreakPanelDate] = useState<
    string | null
  >(() => {
    try {
      return localStorage.getItem(LESSON_STREAK_PANEL_DATE_STORAGE_KEY);
    } catch {
      return null;
    }
  });
  const [streakJustLit, setStreakJustLit] = useState(false);
  const [levelCurtain, setLevelCurtain] = useState<{
    key: number;
    mode: "enter" | "exit";
  } | null>(null);
  const [isLevelTransitionInputLocked, setIsLevelTransitionInputLocked] =
    useState(false);
  const [townLiftTransition, setTownLiftTransition] = useState<{
    key: number;
    label?: string;
  } | null>(null);
  const [showStreakPanel, setShowStreakPanel] = useState(false);
  const [hasSeenHomeIntro, setHasSeenHomeIntro] = useState(() => {
    try {
      return localStorage.getItem("lingoville_home_intro_seen") === "true";
    } catch {
      return false;
    }
  });
	  const [hasSeenPreludeTutorial, setHasSeenPreludeTutorial] = useState(() => {
	    try {
	      return localStorage.getItem(PRELUDE_TUTORIAL_STORAGE_KEY) === "true";
	    } catch {
	      return false;
	    }
	  });
	  const [hasSeenFrameworkGuide, setHasSeenFrameworkGuide] = useState(() => {
	    try {
	      return (
	        localStorage.getItem(POST_LESSON_ONE_FRAMEWORK_GUIDE_STORAGE_KEY) ===
	        "true"
	      );
	    } catch {
	      return false;
	    }
	  });
	  const [pendingFrameworkGuide, setPendingFrameworkGuide] = useState(() => {
	    try {
	      return (
	        localStorage.getItem(
	          POST_LESSON_ONE_FRAMEWORK_GUIDE_PENDING_STORAGE_KEY,
	        ) === "true"
	      );
	    } catch {
	      return false;
	    }
	  });
	  const [frameworkGuideStep, setFrameworkGuideStep] =
	    useState<FrameworkGuideStep>(0);
  const [frameworkGuidePanoramaIntro, setFrameworkGuidePanoramaIntro] =
    useState(false);
	  const [shouldShowHomeIntroThisSession, setShouldShowHomeIntroThisSession] =
	    useState(false);

  // 新增：餐厅解锁相关状态
  const [isRestaurantUnlocked, setIsRestaurantUnlocked] = useState(false);
  const [showRestaurantUnlockDialogue, setShowRestaurantUnlockDialogue] =
    useState(false);
  const [isRestaurantFalling, setIsRestaurantFalling] = useState(false);
  const [victoryDialogueStep, setVictoryDialogueStep] = useState(0);
  const [showTownTabArrow, setShowTownTabArrow] = useState(false);
	  const [userMistakes, setUserMistakes] = useState<any[]>([]);
	  const [reviewWordMeta, setReviewWordMeta] = useState<Record<string, any>>({});
	  const [reviewRounds, setReviewRounds] = useState<any[]>([]);
  const [lastReviewStaminaRewardDate, setLastReviewStaminaRewardDate] =
    useState(() => {
      try {
        return localStorage.getItem(REVIEW_STAMINA_REWARD_DATE_STORAGE_KEY) || "";
      } catch {
        return "";
      }
    });
  const lastReviewStaminaRewardDateRef = useRef(lastReviewStaminaRewardDate);
	  const [hasCompletedOpeningFlow, setHasCompletedOpeningFlow] = useState(
	    getStoredOpeningFlowComplete,
	  );
	  const [onboardingStep, setOnboardingStep] = useState(1);
	  const isReturningOpeningLaunch =
	    hasCompletedOpeningFlow && onboardingStep === 1;
  const [onboardingCarouselIdx, setOnboardingCarouselIdx] = useState(0);
  const [selectedLang, setSelectedLang] = useState("English");
  const [isTopLanguageMenuOpen, setIsTopLanguageMenuOpen] = useState(false);
  const [topResourceHint, setTopResourceHint] = useState<
    "city" | "streak" | "stamina" | null
  >(null);
  const topResourceHintTimerRef = useRef<number | null>(null);
  const homeDecorationStageRef = useRef<HTMLDivElement>(null);
  const townEditorLayerRef = useRef<HTMLDivElement>(null);
  const topCityProgressRef = useRef<HTMLButtonElement>(null);
  const staminaPillRef = useRef<HTMLButtonElement>(null);
  const newTownDecorBubbleTimerRef = useRef<number | null>(null);
  const townDecorTapAnimationTimerRef = useRef<number | null>(null);
  const townDecorProgressParticleTimerRef = useRef<number | null>(null);
  const townGarbageLoadedRef = useRef(false);
  const townGarbageSmokeTimerRef = useRef<number | null>(null);
  const townGarbageEnergyTimerRef = useRef<number | null>(null);
  const townGarbageTipTimerRef = useRef<number | null>(null);
  const townGarbageStaminaTimerRef = useRef<number | null>(null);
  const townNpcInspectTimerRef = useRef<number | null>(null);
  const townNpcReactionTimerRef = useRef<number | null>(null);
  const townNpcInspectClearTimerRef = useRef<number | null>(null);
  const townBuildingUpgradeTimerRef = useRef<number | null>(null);
  const frameworkGuideCameraTimerRef = useRef<number | null>(null);
  const frameworkGuideCameraModeRef = useRef<"intro" | "restore" | null>(null);
  const frameworkGuideAfterRestoreRef = useRef<(() => void) | null>(null);
  const frameworkGuideIntroStartedRef = useRef(false);
	  const townProgressPulseTimerRef = useRef<number | null>(null);
	  const townProgressCatchTimerRef = useRef<number | null>(null);
	  const suppressBuildingPointerUpRef = useRef(false);
	  const draggingHomeDecorationRef = useRef<{
    id: HomeDecorationId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
	  const draggingTownEditorRef = useRef<
	    | {
	        kind: "building";
        id: string;
        pointerId: number;
        offsetX: number;
        offsetY: number;
        startClientX: number;
        startClientY: number;
      }
    | {
        kind: "decoration";
        id: string;
        buildingId: string;
        pointerId: number;
        offsetX: number;
        offsetY: number;
        startClientX: number;
        startClientY: number;
      }
	    | null
	  >(null);
	  const pendingTownDecorationDragRef = useRef<{
	    id: string;
	    buildingId: string;
	    pointerId: number;
    offsetX: number;
    offsetY: number;
    startClientX: number;
    startClientY: number;
    target: HTMLElement;
    timerId: number | null;
	    activated: boolean;
	    cancelled: boolean;
	  } | null>(null);
  const transparentTownDecorationPointerRef = useRef<{
    pointerId: number;
    decorationId: string;
    buildingId: number;
  } | null>(null);
  const [spokenLang, setSpokenLang] = useState({
    flag: "🇺🇸",
    name: "American English",
  });
  const [isSelectLangDropdownOpen, setIsSelectLangDropdownOpen] =
    useState(false);
  const [knowledgeLevel, setKnowledgeLevel] = useState("Not very much");
  const [learningGoals, setLearningGoals] = useState<string[]>([]);
  const [nativeLang, setNativeLang] = useState("English");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [step1Progress, setStep1Progress] = useState(0);
  const [introStep, setIntroStep] = useState(0);
  const [preOnboardingName, setPreOnboardingName] = useState("");
  const [appUserId, setAppUserId] = useState<string | null>(() => {
    try {
      const stored = (localStorage.getItem("app_user_id") || "").trim().toUpperCase();
      return PLAYER_ID_PATTERN.test(stored) ? stored : null;
    } catch {
      return null;
    }
  });
  const [knownPlayerIds, setKnownPlayerIds] = useState<string[]>(() =>
    getStoredTestPlayerIds(),
  );
  const [deletePlayerIdPrompt, setDeletePlayerIdPrompt] =
    useState<string | null>(null);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [preludeStage, setPreludeStage] = useState<PreludeStage>("hidden");
  const lastPreludeQuestionHapticRef = useRef<PreludeStage | null>(null);
  const lastDialogueFlowSoundRef = useRef<string | null>(null);
  const isPreludeActive = preludeStage !== "hidden";
  const preludePlayerName =
    (appUserId || preOnboardingName || "friend").trim() || "friend";
  const [preludeQ1WrongChoices, setPreludeQ1WrongChoices] = useState<
    PreludeChoice[]
  >([]);
  const [preludeQ1Choice, setPreludeQ1Choice] =
    useState<PreludeChoice | null>(null);
  const [preludeQ1FeedbackLine, setPreludeQ1FeedbackLine] = useState<
    "q1_wrong_goodbye" | "q1_wrong_goodnight" | null
  >(null);
  const [preludeQ2Choice, setPreludeQ2Choice] =
    useState<PreludeChoice | null>(null);
  const [preludeQ2WrongChoices, setPreludeQ2WrongChoices] = useState<
    PreludeChoice[]
  >([]);
  const [preludeQ2FeedbackLine, setPreludeQ2FeedbackLine] = useState<
    "q2_wrong_what" | "q2_wrong_how" | null
  >(null);
  const [preludeQ3Choice, setPreludeQ3Choice] =
    useState<PreludeChoice | null>(null);
  const [preludeQ3WrongChoices, setPreludeQ3WrongChoices] = useState<
    PreludeChoice[]
  >([]);
  const [preludeQ4Choice, setPreludeQ4Choice] =
    useState<PreludeChoice | null>(null);
  const [preludeQ4WrongChoices, setPreludeQ4WrongChoices] = useState<
    PreludeChoice[]
  >([]);
  const [preludeDetailExpanded, setPreludeDetailExpanded] = useState({
    q1: false,
    q2: false,
  });
	  const [preludeVisibleLineIds, setPreludeVisibleLineIds] = useState<string[]>(
	    [],
	  );
	  const [preludeCurrentLineId, setPreludeCurrentLineId] =
	    useState<string | null>(null);
  const [preludeRouteImageUnlocked, setPreludeRouteImageUnlocked] =
    useState(false);
	  const [preludeSkippedLineIds, setPreludeSkippedLineIds] = useState<
	    string[]
	  >([]);
	  const preludeAudioRunRef = useRef(0);
	  const preludeSkipResolveRef = useRef<(() => void) | null>(null);
  const lastPreludeInteriorBackgroundRef = useRef<string | null>(null);
  const preludeActionPanelRef = useRef<HTMLDivElement | null>(null);
  const [nameRegistrationStatus, setNameRegistrationStatus] = useState<
    "idle" | "checking" | "loading"
  >("idle");
  const [nameInputError, setNameInputError] = useState<string | null>(null);
  const [existingPlayerIdPrompt, setExistingPlayerIdPrompt] = useState<
    string | null
  >(null);
  const [preOnboardingDialogueStep, setPreOnboardingDialogueStep] = useState(0);
  const [preOnboardingTypedStep, setPreOnboardingTypedStep] = useState<
    number | null
  >(null);
  const [preOnboardingSpeechDoneStep, setPreOnboardingSpeechDoneStep] =
    useState<number | null>(null);
  const preOnboardingAudioRunRef = useRef(0);
  const preOnboardingAdvanceTimerRef = useRef<ReturnType<
    typeof window.setTimeout
  > | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getPreOnboardingVoiceText = useCallback(() => {
    if (preOnboardingDialogueStep === 0) {
      return ONBOARDING_DIALOGUE_AUDIO.step4Welcome.text;
    }
    if (preOnboardingDialogueStep === 1) {
      return ONBOARDING_DIALOGUE_AUDIO.step4NamePrompt.text;
    }
    if (preOnboardingDialogueStep === 3) {
      return `Perfect, ${preOnboardingName || "friend"}! I've got your info here.`;
    }
    if (preOnboardingDialogueStep === 4) {
      return ONBOARDING_DIALOGUE_AUDIO.step4Ready.text;
    }
    return "";
  }, [preOnboardingDialogueStep, preOnboardingName]);

  const getPreOnboardingVoiceAudioSrc = useCallback(() => {
    if (preOnboardingDialogueStep === 0) {
      return ONBOARDING_DIALOGUE_AUDIO.step4Welcome.audioSrc;
    }
    if (preOnboardingDialogueStep === 1) {
      return ONBOARDING_DIALOGUE_AUDIO.step4NamePrompt.audioSrc;
    }
    if (preOnboardingDialogueStep === 4) {
      return ONBOARDING_DIALOGUE_AUDIO.step4Ready.audioSrc;
    }
    return undefined;
  }, [preOnboardingDialogueStep]);

  useEffect(() => {
    if (onboardingStep !== 10) return;
    const voiceText = getPreOnboardingVoiceText();
    if (!voiceText) {
      setPreOnboardingSpeechDoneStep(preOnboardingDialogueStep);
      return;
    }
    const runId = ++preOnboardingAudioRunRef.current;
    setPreOnboardingSpeechDoneStep(null);
    void speakText(voiceText, {
      role: "female",
      audioSrc: getPreOnboardingVoiceAudioSrc(),
    }).finally(() => {
      if (preOnboardingAudioRunRef.current === runId) {
        setPreOnboardingSpeechDoneStep(preOnboardingDialogueStep);
      }
    });
    return () => {
      preOnboardingAudioRunRef.current += 1;
      void stopSpeech();
    };
  }, [
    getPreOnboardingVoiceAudioSrc,
    getPreOnboardingVoiceText,
    onboardingStep,
    preOnboardingDialogueStep,
  ]);

  useEffect(() => {
    setPreOnboardingTypedStep(null);
    setPreOnboardingSpeechDoneStep(null);
    if (preOnboardingAdvanceTimerRef.current) {
      window.clearTimeout(preOnboardingAdvanceTimerRef.current);
      preOnboardingAdvanceTimerRef.current = null;
    }
  }, [preOnboardingDialogueStep]);

  useEffect(() => {
    if (onboardingStep !== 10) return;

    const nextStepByDialogueStep: Record<number, number> = {
      0: 1,
      1: 2,
      3: 4,
      4: 5,
    };
    const nextStep = nextStepByDialogueStep[preOnboardingDialogueStep];
    if (nextStep === undefined) return;
    if (preOnboardingTypedStep !== preOnboardingDialogueStep) return;
    if (preOnboardingSpeechDoneStep !== preOnboardingDialogueStep) return;

    const delayMs =
      preOnboardingDialogueStep === 4
        ? 0
        : preOnboardingDialogueStep === 3
          ? 1200
          : 800;
    preOnboardingAdvanceTimerRef.current = window.setTimeout(() => {
      setPreOnboardingDialogueStep((current) => Math.max(current, nextStep));
    }, delayMs);

    return () => {
      if (preOnboardingAdvanceTimerRef.current) {
        window.clearTimeout(preOnboardingAdvanceTimerRef.current);
        preOnboardingAdvanceTimerRef.current = null;
      }
    };
  }, [
    onboardingStep,
    preOnboardingDialogueStep,
    preOnboardingSpeechDoneStep,
    preOnboardingTypedStep,
  ]);

  const skipPreOnboardingDialogue = useCallback(() => {
    if (onboardingStep !== 10) return;
    if (preOnboardingAdvanceTimerRef.current) {
      window.clearTimeout(preOnboardingAdvanceTimerRef.current);
      preOnboardingAdvanceTimerRef.current = null;
    }
    preOnboardingAudioRunRef.current += 1;
    void stopSpeech();
    setPreOnboardingDialogueStep((current) => {
      if (current === 0) return 1;
      if (current === 1) return 2;
      if (current === 3) return 4;
      if (current === 4) return 5;
      return current;
    });
  }, [onboardingStep]);

  const changeOnboardingStepNow = useCallback(
    (nextStep: number | ((current: number) => number)) => {
      if (preOnboardingAdvanceTimerRef.current) {
        window.clearTimeout(preOnboardingAdvanceTimerRef.current);
        preOnboardingAdvanceTimerRef.current = null;
      }
      preOnboardingAudioRunRef.current += 1;
      void stopSpeech();
      setOnboardingStep(nextStep);
    },
    [],
  );

  const [preLevel2State, setPreLevel2State] = useState(0); // 0: initial, 1: recording, 2: success
  const [preLevel2IsPlaying, setPreLevel2IsPlaying] = useState(false);

  // New states for Step 2 and Step 3 custom animations
  const [step2Phase, setStep2Phase] = useState(0);
  const [step3Phase, setStep3Phase] = useState(0);

  useEffect(() => {
    if (onboardingStep !== 1 || isReturningOpeningLaunch) return;
    const onboardingAudio = ONBOARDING_DIALOGUE_AUDIO.step1Intro;

    void speakText(onboardingAudio.text, {
      role: onboardingAudio.role,
      audioSrc: onboardingAudio.audioSrc,
    });
    return () => {
      void stopSpeech();
    };
  }, [isReturningOpeningLaunch, onboardingStep]);

  useEffect(() => {
    if (onboardingStep !== 2) return;
    const onboardingAudio = ONBOARDING_DIALOGUE_AUDIO.step2Barista;

    void speakText(onboardingAudio.text, {
      role: onboardingAudio.role,
      audioSrc: onboardingAudio.audioSrc,
    });
    return () => {
      void stopSpeech();
    };
  }, [onboardingStep]);

  useEffect(() => {
    if (onboardingStep !== 2 || step2Phase !== 6) return;
    const onboardingAudio = ONBOARDING_DIALOGUE_AUDIO.step2Me;

    void speakText(onboardingAudio.text, {
      role: onboardingAudio.role,
      audioSrc: onboardingAudio.audioSrc,
    });
    return () => {
      void stopSpeech();
    };
  }, [onboardingStep, step2Phase]);

  useEffect(() => {
    if (onboardingStep !== 3) return;
    const onboardingAudio = ONBOARDING_DIALOGUE_AUDIO.step3TownGrowth;

    void speakText(onboardingAudio.text, {
      role: onboardingAudio.role,
      audioSrc: onboardingAudio.audioSrc,
    });
    return () => {
      void stopSpeech();
    };
  }, [onboardingStep]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (step2Phase >= 1 && step2Phase <= 5) {
      t = setTimeout(() => {
        setStep2Phase(prev => prev + 1);
      }, 400); // Wait 400ms per word
    }
    return () => clearTimeout(t);
  }, [step2Phase]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (onboardingStep === 2) {
      setStep2Phase(0);
    } else if (onboardingStep === 3) {
      setStep3Phase(0);
      let p = 0;
      t = setInterval(() => {
        p++;
        if (p <= 4) setStep3Phase(p);
      }, 1000); // 1s per phase
    }
    return () => clearInterval(t);
  }, [onboardingStep]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (onboardingStep === 1) {
      setStep1Progress(0);
      const interval = 20; // 20ms per tick
      const duration = 2000; // 2 seconds total
      const steps = duration / interval;
      let currentProgress = 0;

      t = setInterval(() => {
        currentProgress += 100 / steps;
        if (currentProgress >= 100) {
          setStep1Progress(100);
          clearInterval(t);
        } else {
          setStep1Progress(Math.floor(currentProgress));
        }
      }, interval);
    }
    return () => clearInterval(t);
  }, [onboardingStep]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (onboardingStep === 7) {
      setLoadingProgress(0);
      const interval = 30; // 30ms per tick
      const duration = 4000; // 4 seconds total
      const steps = duration / interval;
      let currentProgress = 0;

      t = setInterval(() => {
        currentProgress += 100 / steps;
        if (currentProgress >= 100) {
          setLoadingProgress(100);
          clearInterval(t);
        } else {
          setLoadingProgress(Math.floor(currentProgress));
        }
      }, interval);
    }
    return () => clearInterval(t);
  }, [onboardingStep]);

  useEffect(() => {
    if (onboardingStep === 12) {
      if (!hasCompletedOpeningFlow) {
        setHasCompletedOpeningFlow(true);
        persistOpeningFlowComplete();
      }
      const t1 = setTimeout(() => {
        setIntroStep((prev) => (prev >= 5 ? prev : 6));
      }, 10);
      return () => {
        clearTimeout(t1);
      };
    }
  }, [hasCompletedOpeningFlow, onboardingStep]);

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (introStep === 5) {
      t = setTimeout(() => setShowGuideArrow(true), 500);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [introStep]);

  const [showTopCard, setShowTopCard] = useState(false);
  const wasAwayFromTownMainForTaskCardRef = useRef(false);

  useEffect(() => {
    if (introStep >= 5) {
      setShowTopCard(true);
    } else {
      setShowTopCard(false);
    }
  }, [introStep]);

  useEffect(() => {
    try {
      localStorage.setItem("lingoville_home_intro_seen", hasSeenHomeIntro ? "true" : "false");
    } catch (e) {
      console.error(e);
    }
  }, [hasSeenHomeIntro]);

	  useEffect(() => {
	    try {
	      localStorage.setItem(
	        PRELUDE_TUTORIAL_STORAGE_KEY,
	        hasSeenPreludeTutorial ? "true" : "false",
	      );
	    } catch (e) {
	      console.error(e);
	    }
	  }, [hasSeenPreludeTutorial]);

	  useEffect(() => {
	    try {
	      localStorage.setItem(
	        POST_LESSON_ONE_FRAMEWORK_GUIDE_STORAGE_KEY,
	        hasSeenFrameworkGuide ? "true" : "false",
	      );
	    } catch (e) {
	      console.error(e);
	    }
	  }, [hasSeenFrameworkGuide]);

	  useEffect(() => {
	    try {
	      if (pendingFrameworkGuide) {
	        localStorage.setItem(
	          POST_LESSON_ONE_FRAMEWORK_GUIDE_PENDING_STORAGE_KEY,
	          "true",
	        );
	      } else {
	        localStorage.removeItem(
	          POST_LESSON_ONE_FRAMEWORK_GUIDE_PENDING_STORAGE_KEY,
	        );
	      }
	    } catch (e) {
	      console.error(e);
	    }
	  }, [pendingFrameworkGuide]);

  // 小镇重建事件状态
  const [townEventStep, setTownEventStep] = useState(0); // 0: None, 1: Dialogue 1, 2: Building Fall, 3: Dialogue 2, 4: Dialogue 3, 5: Guide to Chapters
  const [houseImage] = useState(HOME_BUILDING_IMAGE);
  const prevHouseImageRef = useRef(houseImage);
  const isFirstTimeImage = houseImage !== prevHouseImageRef.current;

  useEffect(() => {
    prevHouseImageRef.current = houseImage;
  }, [houseImage]);

  useEffect(() => {
    if (hasSeenPreludeTutorial && townEventStep < 5) {
      setTownEventStep(5);
    }
  }, [hasSeenPreludeTutorial, townEventStep]);

  const [hasSeenTownEvent, setHasSeenTownEvent] = useState(false);
  const [isDiamondFlying, setIsDiamondFlying] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<{
    title: string;
    id: number;
    status: string;
  } | null>(null);
  const [activeBubbleId, setActiveBubbleId] = useState<number | null>(null);
  const [zoomingToLevel, setZoomingToLevel] = useState<{
    id: number;
    x: string;
    y: number;
  } | null>(null);
  const [quizIndex, setQuizIndex] = useState(1);
  const hasCompletedUnit1 = quizIndex > 1;
  const hasCompletedUnit3 = quizIndex > 3;
  const todayTownGarbageRewardCount =
    townGarbageDailyReward.date === getLocalDayKey()
      ? townGarbageDailyReward.count
      : 0;
  const hasReachedTownGarbageDailyLimit =
    todayTownGarbageRewardCount >= TOWN_GARBAGE_DAILY_REWARD_LIMIT;

  useEffect(() => {
    if (!hasCompletedUnit1) {
      setTownGarbageItems([]);
      return;
    }
    if (hasReachedTownGarbageDailyLimit) {
      setTownGarbageItems([]);
      try {
        localStorage.setItem(TOWN_GARBAGE_STORAGE_KEY, JSON.stringify([]));
      } catch (e) {
        console.error(e);
      }
      return;
    }
    if (townGarbageLoadedRef.current) return;
    townGarbageLoadedRef.current = true;

    try {
      const stored = localStorage.getItem(TOWN_GARBAGE_STORAGE_KEY);
      if (stored !== null) {
        const storedItems = sanitizeTownGarbageItems(JSON.parse(stored));
        if (storedItems.length > 0) {
          setTownGarbageItems(storedItems);
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }

    const generatedItems = createTownGarbageItems(townEditorBuildingPositions);
    setTownGarbageItems(generatedItems);
    try {
      localStorage.setItem(
        TOWN_GARBAGE_STORAGE_KEY,
        JSON.stringify(generatedItems),
      );
    } catch (e) {
      console.error(e);
    }
  }, [
    hasCompletedUnit1,
    hasReachedTownGarbageDailyLimit,
    townEditorBuildingPositions,
  ]);

  const [showSocial, setShowSocial] = useState(false);
  const [showSocialCreate, setShowSocialCreate] = useState(false);
  const [selectedSocialTermIds, setSelectedSocialTermIds] = useState<string[]>([]);
  const [lastSocialReviewWords, setLastSocialReviewWords] = useState<string[]>([]);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([
    {
      id: 1,
      author: "Bun",
      avatar: "/assets/BunNPC.png",
      content: "Today I practiced “fresh coffee” and “Welcome!”. Come and get some fresh coffee.",
      likes: 12,
      isLiked: false,
      comments: [
        { author: "Mia", content: "This one is useful at the cafe!" },
      ],
      timestamp: "2 hours ago",
      terms: ["fresh coffee", "Welcome"],
    },
  ]);
  const [socialReward, setSocialReward] = useState<{
    fans: number;
    customers: number;
    words: string[];
  } | null>(null);

  useEffect(() => {
    if (!hasCompletedUnit3) {
      setShowSocial(false);
      setShowSocialCreate(false);
      setSocialReward(null);
    }
  }, [hasCompletedUnit3]);

  const [showCourseOutline, setShowCourseOutline] = useState(false);
  const [showStarTooltip, setShowStarTooltip] = useState(false);
  const [flyingStarAnim, setFlyingStarAnim] = useState(false);
  const [pulsingStarIdx, setPulsingStarIdx] = useState<number | null>(null);
  const lastQuizIndexRef = useRef(quizIndex);
  const [fastForwardClicks, setFastForwardClicks] = useState(0);
  const fastForwardTimerRef = useRef<NodeJS.Timeout | null>(null);
  const quizRef = useRef<UnifiedQuizRef>(null);
	  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(
	    null,
	  );
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const activeQuizLessonId = earlyUnlockBuildingId
    ? 8
    : targetDecorationQuiz
      ? Math.min(8, Math.max(1, quizIndex))
      : quizIndex;
  const activeQuizLessonNumber = Math.min(
    8,
    Math.max(1, activeQuizLessonId),
  );

  const handleQuestionChange = useCallback((q: any) => {
    const nextId = q?.question_id || null;
    setCurrentQuestionId((prev) => (prev === nextId ? prev : nextId));
  }, []);

	  const handleAudioPlay = useCallback(() => {
	    setIsVideoMutedForQuestion(true);
	  }, []);

  useEffect(() => {
    lastReviewStaminaRewardDateRef.current = lastReviewStaminaRewardDate;
  }, [lastReviewStaminaRewardDate]);

  const hasClaimedReviewStaminaToday =
    lastReviewStaminaRewardDate === getLocalDayKey();

  const claimDailyReviewStaminaReward = useCallback(() => {
    const today = getLocalDayKey();
    if (lastReviewStaminaRewardDateRef.current === today) {
      return false;
    }

    lastReviewStaminaRewardDateRef.current = today;
    setLastReviewStaminaRewardDate(today);
    setStamina((current) => current + 1);
    hapticFeedback.success?.();
    try {
      localStorage.setItem(REVIEW_STAMINA_REWARD_DATE_STORAGE_KEY, today);
    } catch (e) {
      console.error(e);
    }
    return true;
  }, []);

  const updateDailyStreak = useCallback(() => {
    const today = getLocalDayKey();
    setLastStreakDate((prevDate) => {
      if (prevDate === today) return prevDate;

      setStreakDays((prevDays) =>
        prevDate && isPreviousDay(prevDate, today) ? prevDays + 1 : 1,
      );
      hapticFeedback.reward?.();
      setStreakJustLit(true);
      window.setTimeout(() => setStreakJustLit(false), 1300);
      return today;
    });
  }, []);

  const lockLevelTransitionInput = useCallback((duration = 1350) => {
    levelTransitionInputLockRef.current = true;
    setIsLevelTransitionInputLocked(true);

    if (levelTransitionInputLockTimerRef.current !== null) {
      window.clearTimeout(levelTransitionInputLockTimerRef.current);
    }
    levelTransitionInputLockTimerRef.current = window.setTimeout(() => {
      levelTransitionInputLockRef.current = false;
      setIsLevelTransitionInputLocked(false);
      levelTransitionInputLockTimerRef.current = null;
    }, duration);
  }, []);

  const playLevelCurtain = useCallback(
    (mode: "enter" | "exit", onCovered?: () => void) => {
      const key = Date.now();
      lockLevelTransitionInput(1320);
      setLevelCurtain({ key, mode });
      window.setTimeout(() => {
        onCovered?.();
      }, 520);
      window.setTimeout(() => {
        setLevelCurtain((current) => (current?.key === key ? null : current));
      }, 1180);
    },
    [lockLevelTransitionInput],
  );

  const playTownLiftTransition = useCallback((onLifted?: () => void, _label = "Back to Town") => {
    void _label;
    setTownLiftTransition(null);
    window.setTimeout(() => {
      onLifted?.();
    }, 0);
  }, []);

  const isCourseEntryInputLocked =
    isTransitioning || isLevelTransitionInputLocked || Boolean(levelCurtain);

  const queueTownDecorUnlock = useCallback((unlockCount: number) => {
    if (!Number.isFinite(unlockCount) || unlockCount <= 0) return;
    setPendingTownDecorUnlockCounts((current) => {
      if (current.includes(unlockCount)) return current;
      return [...current, unlockCount].sort((a, b) => a - b);
    });
  }, []);

  const markTownDecorUnlockCountSeen = useCallback((unlockCount?: number) => {
    if (!Number.isFinite(unlockCount) || !unlockCount || unlockCount <= 0) {
      return;
    }

    setLastSeenTownDecorUnlockCount((current) => {
      const next = Math.max(current ?? 0, unlockCount);
      try {
        localStorage.setItem(TOWN_DECOR_UNLOCK_STORAGE_KEY, next.toString());
      } catch (e) {
        console.error(e);
      }
      return next;
    });
  }, []);

  const completeCurrentMainLesson = useCallback(
    (options?: { queueDefaultDecoration?: boolean }) => {
      const completedLessonId = quizIndex;
      const shouldQueueDefaultDecoration =
        options?.queueDefaultDecoration !== false;

      hapticFeedback.reward?.();
      setShowQuiz(false);
      setCompletedVictoryUnitId(completedLessonId);
      setShowVictory(true);
      if (shouldQueueDefaultDecoration) {
        queueTownDecorUnlock(PRELUDE_DECOR_LESSON_COUNT + completedLessonId);
      }
      updateDailyStreak();
      if (completedLessonId === 1 && !hasSeenFrameworkGuide) {
        setPendingFrameworkGuide(true);
      }
      setQuizIndex((prev) =>
        Math.max(prev, Math.min(MAX_MAIN_LESSON_ID + 1, completedLessonId + 1)),
      );
    },
    [
      hasSeenFrameworkGuide,
      queueTownDecorUnlock,
      quizIndex,
      updateDailyStreak,
    ],
  );

  const handleQuizComplete = useCallback(() => {
    completeCurrentMainLesson();
  }, [completeCurrentMainLesson]);

  const handleEarlyUnlockQuizComplete = useCallback(() => {
    const buildingId = earlyUnlockBuildingId;
    if (!buildingId) {
      handleQuizComplete();
      return;
    }

    hapticFeedback.reward?.();
    setShowQuiz(false);
    setEarlyUnlockBuildingId(null);
    setExtraUnlockedBuildingIds((current) =>
      current.includes(buildingId)
        ? current
        : [...current, buildingId].sort((a, b) => a - b),
    );
    setEarlyUnlockConfettiKey(Date.now());
    setShowEarlyUnlockSuccess(true);
  }, [earlyUnlockBuildingId, handleQuizComplete]);

  const handleTargetDecorationQuizComplete = useCallback(() => {
    if (!targetDecorationQuiz) {
      handleQuizComplete();
      return;
    }

    const completedLessonId = quizIndex;
    const consumedUnlockCount = PRELUDE_DECOR_LESSON_COUNT + completedLessonId;
    completeCurrentMainLesson({ queueDefaultDecoration: false });
    setPendingDirectTownDecorUnlocks((current) => {
      const nextUnlock = {
        ...targetDecorationQuiz,
        unlockCount: consumedUnlockCount,
      };
      const withoutDuplicate = current.filter(
        (item) =>
          item.buildingId !== nextUnlock.buildingId ||
          item.decorationId !== nextUnlock.decorationId,
      );
      return [...withoutDuplicate, nextUnlock];
    });
    setTargetDecorationQuiz(null);
  }, [
    completeCurrentMainLesson,
    handleQuizComplete,
    quizIndex,
    targetDecorationQuiz,
  ]);

  const continueAfterVictory = useCallback(() => {
    const today = getLocalDayKey();
    setShowVictory(false);
    setIsDiamondFlying(false);

    if (lastLessonStreakPanelDate === today) {
      setShowWinStreak(false);
      playTownLiftTransition(() => {
        setActiveTab("town");
        setScene("exterior");
      });
      return;
    }

    setLastLessonStreakPanelDate(today);
    try {
      localStorage.setItem(LESSON_STREAK_PANEL_DATE_STORAGE_KEY, today);
    } catch (e) {
      console.error(e);
    }
    setShowWinStreak(true);
  }, [lastLessonStreakPanelDate, playTownLiftTransition]);

  const handleQuizFail = useCallback(() => {
    setEarlyUnlockBuildingId(null);
    setTargetDecorationQuiz(null);
    setShowQuiz(false);
  }, []);

  const handleQuizMistake = useCallback((step: any) => {
    const lessonInfo =
      lessonsConfig.lessons.find(
        (l: any) => l.lesson_id === activeQuizLessonId,
      ) ||
      lessonsConfig.lessons[0];

    setUserMistakes((prev) => {
      // Avoid duplicates based on instruction
      if (prev.some((m) => m.instruction === step.instruction)) return prev;
      return [...prev, { ...step, _lessonInfo: lessonInfo }];
    });
  }, [activeQuizLessonId]);

  const handleQuizAnswerResult = useCallback((isCorrect: boolean) => {
    setStamina((prev) => Math.max(0, prev - 1));

    if (!isCorrect) {
      hapticFeedback.error?.();
      setCorrectAnswerStreak(0);
      return;
    }

    setCorrectAnswerStreak((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        setStamina((current) => Math.min(MAX_STAMINA, current + 1));
        return 0;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (currentQuestionId) {
      setIsVideoMutedForQuestion(false);
      setVideoSrc(null);
    } else {
      setVideoSrc(null);
    }
  }, [currentQuestionId]);

  const handleVideoError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
  ) => {
    if (!videoSrc || !currentQuestionId) return;

    // Default error handling for others
    e.currentTarget.style.display = "none";
    const parent = e.currentTarget.parentElement;
    if (parent && !parent.querySelector(".fallback-img")) {
      const img = document.createElement("img");
      img.src = "/assets/zhangjiebeijingtu.png";
      img.className =
        "absolute inset-0 w-full h-full object-cover fallback-img";
      parent.appendChild(img);
    }
  };

  const handleFastForward = () => {
    if (fastForwardTimerRef.current) clearTimeout(fastForwardTimerRef.current);
    setFastForwardClicks(0);
    quizRef.current?.skipToLast();
    showMessage("已跳到本节最后一题");
  };

  const quizStep = quizIndex % 2 !== 0 ? "match" : "word";

  const [showStreakDraw, setShowStreakDraw] = useState(false);
  const [showStreakReward, setShowStreakReward] = useState(false);
  const [showWinStreak2, setShowWinStreak2] = useState(false);
  const [showGrannySofaDialogue, setShowGrannySofaDialogue] = useState(false);

  // 处理小镇重建事件
  useEffect(() => {
    if (townEventStep === 2) {
      const timer = setTimeout(() => {
        setTownEventStep(5);
      }, 300);
      return () => clearTimeout(timer);
    } else if (townEventStep === 3) {
      // 老奶奶头顶气泡显示3秒后，直接进入阶段5
      const timer = setTimeout(() => {
        setTownEventStep(5);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [townEventStep]);

  const [dialogueStep, setDialogueStep] = useState(0); // 0: Hide, 1: Granny, 2: Granny+NPC, 3: All
  const [showGuideArrow, setShowGuideArrow] = useState(false);
  const [idleTownGuideTarget, setIdleTownGuideTarget] =
    useState<IdleTownGuideTarget>(null);
  const idleTownGuideTimerRef = useRef<number | null>(null);
  const [isDraggingScene, setIsDraggingScene] = useState(false);

  const [showInteriorGrannyExclamation, setShowInteriorGrannyExclamation] =
    useState(false);
  const [lastAnimatedLessonId, setLastAnimatedLessonId] = useState(1);
  const [hasNewTaskCompleted, setHasNewTaskCompleted] = useState(false);

  useEffect(() => {
    if (
      scene === "interior" &&
      !showVictory &&
      !showWinStreak &&
      !showWinStreak2 &&
      !showVictoryMsg &&
      !showBuildingUpgrade &&
      !showRestaurantUnlockDialogue &&
      !isTransitioning
    ) {
      if (quizIndex > lastQuizIndexRef.current) {
        lastQuizIndexRef.current = quizIndex;
        const completedLesson = lessonsConfig.lessons.find(
          (l) => l.lesson_id === quizIndex - 1,
        );
        const willGetFurniture =
          completedLesson?.reward_once?.type === "decoration" ||
          completedLesson?.reward_once?.type === "furniture";
        const delayForStar = 0; // Removed furniture-based delay

        // Trigger star flight
        setFlyingStarAnim(true);
        setTimeout(() => {
          setFlyingStarAnim(false);
          const currentStarIdx = Math.ceil((quizIndex - 1) / 2); // 1-based index of the star being lit
          setPulsingStarIdx(currentStarIdx);

          // Pop the START dialogue immediately after the star pulses
          setTimeout(() => {
            setPulsingStarIdx(null);
            setTimeout(() => {
              setShowLevelConfirm(true);
            }, 50); // Minimized UI reaction time
          }, 100); // 0.1s pulse time
        }, 1000); // 1.0s flight animation time
      }
    }
  }, [
    scene,
    quizIndex,
    showVictory,
    showWinStreak,
    showWinStreak2,
    showVictoryMsg,
    showBuildingUpgrade,
    showRestaurantUnlockDialogue,
    isTransitioning,
  ]);

	  // Derived tasks from EXTERIOR_TASKS and quizIndex
	  const currentTasks = useMemo(() => {
	    return EXTERIOR_TASKS.map((task, idx) => ({
	      ...task,
	      id: idx + 1,
	      lessonId: task.linkedLessonId || idx + 1,
	      isCompleted: quizIndex > (task.linkedLessonId || idx + 1),
	      isActive: quizIndex === (task.linkedLessonId || idx + 1),
	    })).filter((task) => task.isActive);
	  }, [quizIndex]);

	  const activeMainTask = useMemo(() => {
	    if (quizIndex < 1 || quizIndex > MAX_MAIN_LESSON_ID) return null;
	    return (
	      EXTERIOR_TASKS.find((task) => task.linkedLessonId === quizIndex) ||
	      EXTERIOR_TASKS[quizIndex - 1] ||
	      null
	    );
	  }, [quizIndex]);

	  const topTaskCardTask = useMemo(() => {
	    if (animatingCompletedPhase !== null) {
	      return EXTERIOR_TASKS[animatingCompletedPhase] || activeMainTask;
	    }
	    return activeMainTask;
	  }, [activeMainTask, animatingCompletedPhase]);

	  const taskProgressInfo = useMemo(() => {
	    const total = EXTERIOR_TASKS.length;
	    const completed = EXTERIOR_TASKS.filter(
	      (task, idx) => quizIndex > (task.linkedLessonId || idx + 1),
	    ).length;

    return {
      total,
      completed,
      progress: total > 0 ? Math.min(1, completed / total) : 0,
    };
  }, [quizIndex]);

  const socialLessonLimit = Math.max(
    1,
    Math.min(EXTERIOR_TASKS.length, quizIndex - 1),
  );

  const availableSocialTerms = useMemo(
    () =>
      SOCIAL_LESSON_TERMS.filter(
        (term) => term.lessonId <= socialLessonLimit,
      ),
    [socialLessonLimit],
  );

  const recentSocialTerms = useMemo(() => {
    const latestTerms = availableSocialTerms.filter(
      (term) => term.lessonId === socialLessonLimit,
    );

    return latestTerms.length > 0
      ? latestTerms
      : availableSocialTerms.slice(-8);
  }, [availableSocialTerms, socialLessonLimit]);

  const selectedSocialTerms = useMemo(
    () =>
      selectedSocialTermIds
        .map((id) => availableSocialTerms.find((term) => term.id === id))
        .filter((term): term is SocialTerm => Boolean(term)),
    [availableSocialTerms, selectedSocialTermIds],
  );

  const generatedSocialPost = useMemo(
    () => buildSocialPostContent(selectedSocialTerms),
    [selectedSocialTerms],
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        "lingoville_home_decoration_positions",
        JSON.stringify(homeDecorationPositions),
      );
      (window as any).__LINGOVILLE_HOME_DECORATION_POSITIONS__ =
        homeDecorationPositions;
    } catch (e) {
      console.error(e);
    }
  }, [homeDecorationPositions]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOWN_CAMERA_ZOOM_STORAGE_KEY,
        townCameraZoom.toString(),
      );
      (window as any).__LINGOVILLE_TOWN_CAMERA_ZOOM__ = townCameraZoom;
    } catch (e) {
      console.error(e);
    }
 }, [townCameraZoom]);

  useEffect(() => {
    setTownEditorDecorationPositions((prev) => {
      let shouldResetStoredSizes = false;
      try {
        shouldResetStoredSizes =
          localStorage.getItem(
            TOWN_EDITOR_DECORATION_SIZE_READY_STORAGE_KEY,
          ) !== "true";
      } catch {
        shouldResetStoredSizes = true;
      }

      if (!shouldResetStoredSizes) return prev;

      let hasChanged = false;
      const next = { ...prev };
      const defaults = getDefaultTownEditorDecorationPositions();

      TOWN_EDITOR_BUILDINGS.forEach((building) => {
        building.decorations.forEach((decoration) => {
          const current = next[decoration.id] || defaults[decoration.id];
          if (!current) return;

          if (current.width !== decoration.width) {
            hasChanged = true;
            next[decoration.id] = {
              ...current,
              width: decoration.width,
            };
          }
        });
      });

      try {
        localStorage.setItem(
          TOWN_EDITOR_DECORATION_SIZE_READY_STORAGE_KEY,
          "true",
        );
      } catch (e) {
        console.error(e);
      }

      return hasChanged ? next : prev;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        "lingoville_town_editor_building_positions",
        JSON.stringify(townEditorBuildingPositions),
      );
      localStorage.setItem(
        "lingoville_town_editor_decoration_positions",
        JSON.stringify(townEditorDecorationPositions),
      );
      (window as any).__LINGOVILLE_TOWN_EDITOR_POSITIONS__ = {
        buildings: townEditorBuildingPositions,
        decorations: townEditorDecorationPositions,
      };
    } catch (e) {
      console.error(e);
    }
  }, [townEditorBuildingPositions, townEditorDecorationPositions]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOWN_DECOR_PENDING_UNLOCK_STORAGE_KEY,
        JSON.stringify(pendingTownDecorUnlockCounts),
      );
    } catch (e) {
      console.error(e);
    }
  }, [pendingTownDecorUnlockCounts]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOWN_EARLY_UNLOCKED_BUILDINGS_STORAGE_KEY,
        JSON.stringify(extraUnlockedBuildingIds),
      );
    } catch (e) {
      console.error(e);
    }
  }, [extraUnlockedBuildingIds]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOWN_DECORATION_UNLOCK_ORDER_STORAGE_KEY,
        JSON.stringify(townDecorationUnlockOrderOverrides),
      );
    } catch (e) {
      console.error(e);
    }
  }, [townDecorationUnlockOrderOverrides]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOWN_MANUAL_UNLOCKED_DECORATIONS_STORAGE_KEY,
        JSON.stringify(manualUnlockedTownDecorationIds),
      );
    } catch (e) {
      console.error(e);
    }
  }, [manualUnlockedTownDecorationIds]);

  useEffect(() => {
    try {
      localStorage.setItem(
        TOWN_DIRECT_DECOR_PENDING_STORAGE_KEY,
        JSON.stringify(pendingDirectTownDecorUnlocks),
      );
    } catch (e) {
      console.error(e);
    }
  }, [pendingDirectTownDecorUnlocks]);

  useEffect(
    () => () => {
      if (newTownDecorBubbleTimerRef.current !== null) {
        window.clearTimeout(newTownDecorBubbleTimerRef.current);
      }
      if (levelTransitionInputLockTimerRef.current !== null) {
        window.clearTimeout(levelTransitionInputLockTimerRef.current);
        levelTransitionInputLockTimerRef.current = null;
      }
      if (townDecorTapAnimationTimerRef.current !== null) {
        window.clearTimeout(townDecorTapAnimationTimerRef.current);
      }
      if (townDecorProgressParticleTimerRef.current !== null) {
        window.clearTimeout(townDecorProgressParticleTimerRef.current);
      }
      if (townProgressPulseTimerRef.current !== null) {
        window.clearTimeout(townProgressPulseTimerRef.current);
      }
      if (townProgressCatchTimerRef.current !== null) {
        window.clearTimeout(townProgressCatchTimerRef.current);
      }
      if (townGarbageSmokeTimerRef.current !== null) {
        window.clearTimeout(townGarbageSmokeTimerRef.current);
      }
      if (townGarbageEnergyTimerRef.current !== null) {
        window.clearTimeout(townGarbageEnergyTimerRef.current);
      }
      if (townGarbageTipTimerRef.current !== null) {
        window.clearTimeout(townGarbageTipTimerRef.current);
      }
      if (townGarbageStaminaTimerRef.current !== null) {
        window.clearTimeout(townGarbageStaminaTimerRef.current);
      }
      if (townNpcInspectTimerRef.current !== null) {
        window.clearTimeout(townNpcInspectTimerRef.current);
      }
      if (townNpcReactionTimerRef.current !== null) {
        window.clearTimeout(townNpcReactionTimerRef.current);
      }
      if (townNpcInspectClearTimerRef.current !== null) {
        window.clearTimeout(townNpcInspectClearTimerRef.current);
      }
      if (townBuildingUpgradeTimerRef.current !== null) {
        window.clearTimeout(townBuildingUpgradeTimerRef.current);
        townBuildingUpgradeTimerRef.current = null;
      }
      if (frameworkGuideCameraTimerRef.current !== null) {
        window.clearTimeout(frameworkGuideCameraTimerRef.current);
        frameworkGuideCameraTimerRef.current = null;
      }
      frameworkGuideCameraModeRef.current = null;
      frameworkGuideAfterRestoreRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!townDecorUnlockAnimation) return;

    if (townNpcInspectTimerRef.current !== null) {
      window.clearTimeout(townNpcInspectTimerRef.current);
      townNpcInspectTimerRef.current = null;
    }
    if (townNpcReactionTimerRef.current !== null) {
      window.clearTimeout(townNpcReactionTimerRef.current);
      townNpcReactionTimerRef.current = null;
    }
    if (townNpcInspectClearTimerRef.current !== null) {
      window.clearTimeout(townNpcInspectClearTimerRef.current);
      townNpcInspectClearTimerRef.current = null;
    }
    setTownNpcReactionBubble(null);
    setTownNpcInspectAnimation(null);

    const nextInspectAnimation = townDecorUnlockAnimation;
    townNpcReactionTimerRef.current = window.setTimeout(() => {
      setTownNpcReactionBubble(nextInspectAnimation);
      townNpcReactionTimerRef.current = null;
    }, 3300);
    townNpcInspectTimerRef.current = window.setTimeout(() => {
      setTownNpcInspectAnimation(nextInspectAnimation);
      townNpcInspectTimerRef.current = null;
      townNpcInspectClearTimerRef.current = window.setTimeout(() => {
        setTownNpcReactionBubble((current) =>
          current?.key === nextInspectAnimation.key ? null : current,
        );
        setTownNpcInspectAnimation((current) =>
          current?.key === nextInspectAnimation.key ? null : current,
        );
        townNpcInspectClearTimerRef.current = null;
      }, 4300);
    }, 3900);

    return () => {
      if (townNpcReactionTimerRef.current !== null) {
        window.clearTimeout(townNpcReactionTimerRef.current);
        townNpcReactionTimerRef.current = null;
      }
      if (townNpcInspectTimerRef.current !== null) {
        window.clearTimeout(townNpcInspectTimerRef.current);
        townNpcInspectTimerRef.current = null;
      }
    };
  }, [townDecorUnlockAnimation]);

  const homeDecorCompletionCount = useMemo(() => {
    const completedMainLessons = Math.min(
      EXTERIOR_TASKS.length,
      Math.max(0, quizIndex - 1),
    );
    return Math.min(
      HOME_DECORATIONS.length,
      (hasSeenPreludeTutorial ? 1 : 0) + completedMainLessons,
    );
  }, [hasSeenPreludeTutorial, quizIndex]);

  const townDecorProgressCount = useMemo(() => {
    const completedMainLessons = Math.min(
      EXTERIOR_TASKS.length,
      Math.max(0, quizIndex - 1),
    );
    const preludeLessons = hasSeenPreludeTutorial
      ? PRELUDE_DECOR_LESSON_COUNT
      : 0;
    return Math.min(
      TOWN_EDITOR_BUILDINGS.length * TOWN_DECOR_UNLOCKS_PER_BUILDING,
      preludeLessons + completedMainLessons,
    );
  }, [hasSeenPreludeTutorial, quizIndex]);

  const visibleTownDecorProgressCount = useMemo(
    () =>
      Math.min(
        townDecorProgressCount,
        lastSeenTownDecorUnlockCount ??
          Math.max(0, townDecorProgressCount - 1),
      ),
    [lastSeenTownDecorUnlockCount, townDecorProgressCount],
  );

  useEffect(() => {
    if (hasSeenPreludeTutorial) return;

    setPendingMiaDecorGuide(false);
    setPendingTownDecorUnlockCounts((current) =>
      current.filter((unlockCount) => unlockCount !== 1),
    );
    setLastSeenTownDecorUnlockCount((current) => {
      if (current === null || current <= townDecorProgressCount) return current;
      try {
        localStorage.setItem(
          TOWN_DECOR_UNLOCK_STORAGE_KEY,
          townDecorProgressCount.toString(),
        );
      } catch (e) {
        console.error(e);
      }
      return townDecorProgressCount;
    });
  }, [hasSeenPreludeTutorial, townDecorProgressCount]);

  const getTownBuildingUnlockState = useCallback(
    (building: TownEditorBuildingAsset) => {
      const buildingStart =
        (building.id - 1) * TOWN_DECOR_UNLOCKS_PER_BUILDING;
      const unlockedSteps = Math.max(
        0,
        visibleTownDecorProgressCount - buildingStart,
      );
      const completedMainLessons = Math.max(0, quizIndex - 1);
      const requiredLesson = getTownBuildingUnlockRequiredLesson(building.id);
      const isBuildingUnlocked =
        building.id === 1 ||
        extraUnlockedBuildingIds.includes(building.id) ||
        completedMainLessons >= requiredLesson;
      const isBuildingUpgraded =
        visibleTownDecorProgressCount >=
        building.id * TOWN_DECOR_UNLOCKS_PER_BUILDING;

      return {
        isBuildingUnlocked,
        isBuildingUpgraded,
        unlockedDecorationSteps: Math.min(
          TOWN_DECOR_UNLOCKS_PER_BUILDING,
          unlockedSteps,
        ),
      };
    },
    [extraUnlockedBuildingIds, quizIndex, visibleTownDecorProgressCount],
  );

  const getTownDecorationUnlockOrder = useCallback(
    (building: TownEditorBuildingAsset) =>
      normalizeTownDecorationUnlockOrder(
        building,
        townDecorationUnlockOrderOverrides[String(building.id)],
      ),
    [townDecorationUnlockOrderOverrides],
  );

  const getTownDecorationNormalUnlockOrder = useCallback(
    (building: TownEditorBuildingAsset) => {
      const manualIds = new Set(manualUnlockedTownDecorationIds);
      return getTownDecorationUnlockOrder(building).filter(
        (decoration) => !manualIds.has(decoration.id),
      );
    },
    [getTownDecorationUnlockOrder, manualUnlockedTownDecorationIds],
  );

  const getManualUnlockedDecorationCountForBuilding = useCallback(
    (building: TownEditorBuildingAsset) => {
      const manualIds = new Set(manualUnlockedTownDecorationIds);
      return building.decorations.reduce(
        (count, decoration) => count + (manualIds.has(decoration.id) ? 1 : 0),
        0,
      );
    },
    [manualUnlockedTownDecorationIds],
  );

  const isTownDecorationUnlocked = useCallback(
    (
      building: TownEditorBuildingAsset,
      decorationIndex: number,
      decorationId?: string,
    ) => {
      const { isBuildingUnlocked, unlockedDecorationSteps } =
        getTownBuildingUnlockState(building);
      if (!isBuildingUnlocked) return false;
      const targetDecorationId =
        decorationId ||
        getTownDecorationUnlockOrder(building)[decorationIndex]?.id ||
        null;
      if (
        targetDecorationId &&
        manualUnlockedTownDecorationIds.includes(targetDecorationId)
      ) {
        return true;
      }
      if (unlockedDecorationSteps >= TOWN_DECOR_UNLOCKS_PER_BUILDING) {
        return true;
      }
      const manualUnlockedCount = Math.min(
        unlockedDecorationSteps,
        getManualUnlockedDecorationCountForBuilding(building),
      );
      const normalUnlockedSteps = Math.max(
        0,
        unlockedDecorationSteps - manualUnlockedCount,
      );
      const normalUnlockIndex = getTownDecorationNormalUnlockOrder(
        building,
      ).findIndex((decoration) => decoration.id === targetDecorationId);
      return normalUnlockIndex >= 0 && normalUnlockIndex < normalUnlockedSteps;
    },
    [
      getManualUnlockedDecorationCountForBuilding,
      getTownBuildingUnlockState,
      getTownDecorationNormalUnlockOrder,
      getTownDecorationUnlockOrder,
      manualUnlockedTownDecorationIds,
    ],
  );

  const getTownDecorationUnlockBatch = useCallback((unlockCount: number) => {
    const buildingIndex = Math.floor(
      Math.max(0, unlockCount - 1) / TOWN_DECOR_UNLOCKS_PER_BUILDING,
    );
    const stepInBuilding =
      (Math.max(0, unlockCount - 1) % TOWN_DECOR_UNLOCKS_PER_BUILDING) + 1;
    const building = TOWN_EDITOR_BUILDINGS[buildingIndex];
    if (!building) return null;

    const manualUnlockedCount = Math.min(
      stepInBuilding - 1,
      getManualUnlockedDecorationCountForBuilding(building),
    );
    const normalStepInBuilding = Math.max(
      1,
      stepInBuilding - manualUnlockedCount,
    );
    const decorationsByUnlockId = getTownDecorationNormalUnlockOrder(building);
    const decorationIds =
      stepInBuilding >= TOWN_DECOR_UNLOCKS_PER_BUILDING
        ? decorationsByUnlockId
            .slice(normalStepInBuilding - 1)
            .map((decoration) => decoration.id)
        : decorationsByUnlockId[normalStepInBuilding - 1]
          ? [decorationsByUnlockId[normalStepInBuilding - 1].id]
          : [];

    if (decorationIds.length === 0) return null;
    return {
      buildingId: building.id,
      decorationIds,
    };
  }, [
    getManualUnlockedDecorationCountForBuilding,
    getTownDecorationNormalUnlockOrder,
  ]);

  const getTownDecorationRewardForTask = useCallback(
    (lessonId?: number, _rewardItemId?: string) => {
      if (!lessonId) return null;
      const unlockCount = PRELUDE_DECOR_LESSON_COUNT + lessonId;
      const batch = getTownDecorationUnlockBatch(unlockCount);
      if (!batch) return null;

      const batchDecorations = (batch?.decorationIds || [])
        .map((id) => TOWN_EDITOR_DECORATION_BY_ID[id])
        .filter((decoration): decoration is TownEditorDecorationAsset =>
          Boolean(decoration),
        );
      const decorations = batchDecorations;

      if (decorations.length === 0) return null;

      return {
        buildingId: batch.buildingId,
        decorationIds: batch.decorationIds,
        primaryDecoration: decorations[0],
        decorations,
      };
    },
    [getTownDecorationUnlockBatch],
  );

	  const focusTownDecorationUnlock = useCallback(
	    (batch: { buildingId: number; decorationIds: string[] }) => {
      const building = TOWN_EDITOR_BUILDINGS.find(
        (item) => item.id === batch.buildingId,
      );
      const decoration = batch.decorationIds
        .map((id) => TOWN_EDITOR_DECORATION_BY_ID[id])
        .find(Boolean);
      if (!building || !decoration) return;

      const buildingPosition =
        townEditorBuildingPositions[String(building.id)] ||
        getDefaultTownEditorBuildingPositions()[String(building.id)];
      const decorationPosition =
        townEditorDecorationPositions[decoration.id] ||
        getDefaultTownEditorDecorationPositions()[decoration.id];
      if (!buildingPosition || !decorationPosition) return;

	      const currentZoom = townCameraScale.get();
	      townUnlockCameraRef.current = {
	        x: sceneX.get(),
	        y: sceneY.get(),
	        zoom: TOWN_CAMERA_ZOOM_DEFAULT,
	      };

      const appRect = appRootRef.current?.getBoundingClientRect();
      const viewportWidth = appRect?.width || Math.min(window.innerWidth, 450);
      const viewportHeight = appRect?.height || viewportWidth * (19.5 / 9);
      const focusLayoutScale = Math.max(
        0.78,
        Math.min(1.16, viewportWidth / TOWN_LAYOUT_REFERENCE_WIDTH),
      );
      const contentSceneSize = TOWN_SCENE_WORLD_SIZE * focusLayoutScale;
      const backgroundSceneSize = TOWN_BACKGROUND_WORLD_SIZE * focusLayoutScale;
	      const targetZoom = Math.min(2.1, Math.max(currentZoom, 1.85));
      const decorationCenterX =
        buildingPosition.x +
        ((decorationPosition.x + decorationPosition.width / 2) *
          buildingPosition.width) /
          100;
      const decorationCenterY =
        buildingPosition.y +
        ((decorationPosition.y + (decoration.height || decorationPosition.width) / 2) *
          buildingPosition.width) /
          100;
      const limitX = Math.max(
        0,
        (backgroundSceneSize * targetZoom) / 2 - viewportWidth / 2,
      );
      const limitY = Math.max(
        0,
        (backgroundSceneSize * targetZoom) / 2 - viewportHeight / 2,
      );
      const nextX = Math.max(
        -limitX,
        Math.min(
          limitX,
          (0.5 - decorationCenterX / 100) * contentSceneSize * targetZoom,
        ),
      );
      const nextY = Math.max(
        -limitY,
        Math.min(
          limitY,
          (0.5 - decorationCenterY / 100) * contentSceneSize * targetZoom,
        ),
      );

	      setTownCameraZoom(targetZoom);
	      animate(townCameraScale, targetZoom, {
	        duration: 0.78,
	        ease: [0.22, 1, 0.36, 1],
	      });
	      animate(sceneX, nextX, {
	        duration: 0.78,
	        ease: [0.22, 1, 0.36, 1],
	      });
	      animate(sceneY, nextY, {
	        duration: 0.78,
	        ease: [0.22, 1, 0.36, 1],
	      });
	    },
	    [
	      sceneX,
	      sceneY,
	      townCameraScale,
	      townEditorBuildingPositions,
	      townEditorDecorationPositions,
	    ],
	  );

  const getTownDecorationScreenTarget = useCallback(
    (batch: { buildingId: number; decorationIds: string[] }) => {
      const building = TOWN_EDITOR_BUILDINGS.find(
        (item) => item.id === batch.buildingId,
      );
      if (!building) return null;

      const buildingPosition =
        townEditorBuildingPositions[String(building.id)] ||
        getDefaultTownEditorBuildingPositions()[String(building.id)];
      const appRect = appRootRef.current?.getBoundingClientRect();
      const viewportWidth = appRect?.width || Math.min(window.innerWidth, 450);
      const viewportHeight = appRect?.height || viewportWidth * (19.5 / 9);
      const screenLayoutScale = Math.max(
        0.78,
        Math.min(1.16, viewportWidth / TOWN_LAYOUT_REFERENCE_WIDTH),
      );
      const sceneSize = TOWN_SCENE_WORLD_SIZE * screenLayoutScale;
      const items = batch.decorationIds
        .map((decorationId) => {
          const decoration = TOWN_EDITOR_DECORATION_BY_ID[decorationId];
          if (!decoration) return null;
          const decorationPosition =
            townEditorDecorationPositions[decoration.id] ||
            getDefaultTownEditorDecorationPositions()[decoration.id];
          if (!decorationPosition) return null;
          const decorationCenterX =
            buildingPosition.x +
            ((decorationPosition.x + decorationPosition.width / 2) *
              buildingPosition.width) /
              100;
          const decorationCenterY =
            buildingPosition.y +
            ((decorationPosition.y +
              (decoration.height || decorationPosition.width) / 2) *
              buildingPosition.width) /
              100;
          const rawX =
            viewportWidth / 2 +
            sceneX.get() +
            (decorationCenterX / 100 - 0.5) * sceneSize * townCameraZoom;
          const rawY =
            viewportHeight / 2 +
            sceneY.get() +
            (decorationCenterY / 100 - 0.5) * sceneSize * townCameraZoom;

          return {
            decorationId: decoration.id,
            src: decoration.src,
            targetX: Math.max(58, Math.min(viewportWidth - 58, rawX)),
            targetY: Math.max(96, Math.min(viewportHeight - 110, rawY)),
          };
        })
        .filter(
          (
            item,
          ): item is {
            decorationId: string;
            src: string;
            targetX: number;
            targetY: number;
          } => Boolean(item),
        );
      const primaryItem = items[0];
      if (!primaryItem) return null;

      return {
        buildingId: building.id,
        decorationId: primaryItem.decorationId,
        src: primaryItem.src,
        targetX: primaryItem.targetX,
        targetY: primaryItem.targetY,
        items,
      };
    },
    [
      sceneX,
      sceneY,
      townCameraZoom,
      townEditorBuildingPositions,
      townEditorDecorationPositions,
    ],
  );

  const playTownDecorProgressParticles = useCallback((decorationIds: string[]) => {
    const appRect = appRootRef.current?.getBoundingClientRect();
    const targetRect = topCityProgressRef.current?.getBoundingClientRect();
    if (!appRect || !targetRect) {
      setTownProgressPulse(true);
      if (townProgressPulseTimerRef.current !== null) {
        window.clearTimeout(townProgressPulseTimerRef.current);
      }
      townProgressPulseTimerRef.current = window.setTimeout(() => {
        setTownProgressPulse(false);
        townProgressPulseTimerRef.current = null;
      }, 2200);
      return;
    }

    const sourceRect = decorationIds
      .map((decorationId) =>
        document
          .querySelector(`[data-town-editor-decoration="${decorationId}"]`)
          ?.getBoundingClientRect(),
      )
      .find((rect): rect is DOMRect => Boolean(rect));

    const fallbackX = appRect.width / 2;
    const fallbackY = appRect.height * 0.48;
    const startX = sourceRect
      ? sourceRect.left - appRect.left + sourceRect.width / 2
      : fallbackX;
    const startY = sourceRect
      ? sourceRect.top - appRect.top + sourceRect.height / 2
      : fallbackY;
    const endX = targetRect.left - appRect.left + targetRect.width / 2;
    const endY = targetRect.top - appRect.top + targetRect.height / 2;
    const key = Date.now();

    if (townDecorProgressParticleTimerRef.current !== null) {
      window.clearTimeout(townDecorProgressParticleTimerRef.current);
    }
    if (townProgressPulseTimerRef.current !== null) {
      window.clearTimeout(townProgressPulseTimerRef.current);
    }
    if (townProgressCatchTimerRef.current !== null) {
      window.clearTimeout(townProgressCatchTimerRef.current);
    }

    setTownDecorProgressParticles({
      key,
      startX,
      startY,
      endX,
      endY,
      count: 16,
    });

    townProgressCatchTimerRef.current = window.setTimeout(() => {
      setTownProgressPulse(true);
      setTownProgressCatchPulse(true);
      hapticFeedback.light?.();
      townProgressCatchTimerRef.current = window.setTimeout(() => {
        setTownProgressCatchPulse(false);
        townProgressCatchTimerRef.current = null;
      }, 620);
    }, 720);

    townDecorProgressParticleTimerRef.current = window.setTimeout(() => {
      setTownDecorProgressParticles((current) =>
        current?.key === key ? null : current,
      );
      townDecorProgressParticleTimerRef.current = null;
    }, 1350);

    townProgressPulseTimerRef.current = window.setTimeout(() => {
      setTownProgressPulse(false);
      townProgressPulseTimerRef.current = null;
    }, 2700);
  }, []);

  const playTownBuildingUpgradeCue = useCallback(
    (building: TownEditorBuildingAsset) => {
      if (townBuildingUpgradeTimerRef.current !== null) {
        window.clearTimeout(townBuildingUpgradeTimerRef.current);
      }

      const key = Date.now();
      setTownBuildingUpgradeHoldIds((current) =>
        current.includes(building.id) ? current : [...current, building.id],
      );
      setTownBuildingUpgradeToast({
        key,
        buildingId: building.id,
        name: getTownBuildingSignName(building),
        fromLevel: 1,
        toLevel: 2,
      });
      setLastSeenTownBuildingUpgradeCount((current) => {
        const next = Math.max(current, building.id);
        try {
          localStorage.setItem(
            TOWN_BUILDING_UPGRADE_SEEN_STORAGE_KEY,
            next.toString(),
          );
        } catch (e) {
          console.error(e);
        }
        return next;
      });
      triggerHaptic("reward", [32, 30, 58]);

      townBuildingUpgradeTimerRef.current = window.setTimeout(() => {
        setTownBuildingUpgradeToast((current) =>
          current?.key === key ? null : current,
        );
        setTownBuildingUpgradeHoldIds((current) =>
          current.filter((buildingId) => buildingId !== building.id),
        );
        triggerHaptic("medium", 28);
        townBuildingUpgradeTimerRef.current = null;
      }, 1650);
    },
    [],
  );

	  const restoreTownUnlockCamera = useCallback(() => {
	    const previous = townUnlockCameraRef.current;
	    if (!previous) return;
	    townUnlockCameraRef.current = null;
	    setTownCameraZoom(previous.zoom);
	    animate(townCameraScale, previous.zoom, {
	      duration: 0.62,
	      ease: [0.22, 1, 0.36, 1],
	    });
	    animate(sceneX, previous.x, {
	      duration: 0.62,
	      ease: [0.22, 1, 0.36, 1],
	    });
	    animate(sceneY, previous.y, {
	      duration: 0.62,
	      ease: [0.22, 1, 0.36, 1],
	    });
	  }, [sceneX, sceneY, townCameraScale]);

  const startFrameworkGuidePanoramaIntro = useCallback(() => {
    if (frameworkGuideCameraTimerRef.current !== null) {
      window.clearTimeout(frameworkGuideCameraTimerRef.current);
      frameworkGuideCameraTimerRef.current = null;
    }

    frameworkGuideCameraRef.current = {
      x: sceneX.get(),
      y: sceneY.get(),
      zoom: TOWN_CAMERA_ZOOM_DEFAULT,
    };

    const viewportRect = appRootRef.current?.getBoundingClientRect();
    const viewportWidth =
      viewportRect?.width || Math.min(window.innerWidth, PHONE_FRAME_MAX_WIDTH);
    const viewportHeight =
      viewportRect?.height ||
      viewportWidth * (PHONE_FRAME_ASPECT_HEIGHT / PHONE_FRAME_ASPECT_WIDTH);
    const panoramaLayoutScale = Math.max(
      0.78,
      Math.min(1.16, viewportWidth / TOWN_LAYOUT_REFERENCE_WIDTH),
    );
    const panoramaSceneSize = TOWN_BACKGROUND_WORLD_SIZE * panoramaLayoutScale;
    const coverZoom =
      panoramaSceneSize > 0
        ? Math.max(
            viewportWidth / panoramaSceneSize,
            viewportHeight / panoramaSceneSize,
          )
        : TOWN_CAMERA_ZOOM_MIN;
    const targetZoom = Math.max(0.1, coverZoom + 0.012);
    frameworkGuideCameraModeRef.current = "intro";
    frameworkGuideAfterRestoreRef.current = null;
    setFrameworkGuidePanoramaIntro(true);
    animate(townCameraScale, targetZoom, {
      duration: 0.95,
      ease: [0.22, 1, 0.36, 1],
    });
    animate(sceneX, 0, {
      duration: 0.95,
      ease: [0.22, 1, 0.36, 1],
    });
    animate(sceneY, 0, {
      duration: 0.95,
      ease: [0.22, 1, 0.36, 1],
    });

    frameworkGuideCameraTimerRef.current = window.setTimeout(() => {
      setFrameworkGuidePanoramaIntro(false);
      setFrameworkGuideStep(1);
      hapticFeedback.light?.();
      frameworkGuideCameraTimerRef.current = null;
      frameworkGuideCameraModeRef.current = null;
    }, 1450);
  }, [sceneX, sceneY, townCameraScale]);

	  const restoreFrameworkGuideCamera = useCallback(
	    (afterRestore?: () => void) => {
      if (frameworkGuideCameraTimerRef.current !== null) {
        window.clearTimeout(frameworkGuideCameraTimerRef.current);
        frameworkGuideCameraTimerRef.current = null;
      }

      const previous = frameworkGuideCameraRef.current;
      frameworkGuideCameraModeRef.current = "restore";
      frameworkGuideAfterRestoreRef.current = afterRestore ?? null;
      setFrameworkGuidePanoramaIntro(true);
      if (!previous) {
        frameworkGuideCameraTimerRef.current = window.setTimeout(() => {
          setFrameworkGuidePanoramaIntro(false);
          frameworkGuideAfterRestoreRef.current?.();
          frameworkGuideAfterRestoreRef.current = null;
          frameworkGuideCameraModeRef.current = null;
          frameworkGuideCameraTimerRef.current = null;
        }, 260);
        return;
      }

      frameworkGuideCameraRef.current = null;
      setTownCameraZoom(previous.zoom);
      animate(townCameraScale, previous.zoom, {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      });
      animate(sceneX, previous.x, {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      });
      animate(sceneY, previous.y, {
        duration: 0.7,
        ease: [0.22, 1, 0.36, 1],
      });

      frameworkGuideCameraTimerRef.current = window.setTimeout(() => {
        setFrameworkGuidePanoramaIntro(false);
        frameworkGuideAfterRestoreRef.current?.();
        frameworkGuideAfterRestoreRef.current = null;
        frameworkGuideCameraModeRef.current = null;
        frameworkGuideCameraTimerRef.current = null;
      }, 760);
    },
	    [sceneX, sceneY, townCameraScale],
	  );

  useEffect(() => {
    if (!frameworkGuidePanoramaIntro) return;

    const failsafeTimer = window.setTimeout(() => {
      if (frameworkGuideCameraTimerRef.current !== null) {
        window.clearTimeout(frameworkGuideCameraTimerRef.current);
        frameworkGuideCameraTimerRef.current = null;
      }

      const cameraMode = frameworkGuideCameraModeRef.current;
      const afterRestore = frameworkGuideAfterRestoreRef.current;
      frameworkGuideCameraModeRef.current = null;
      frameworkGuideAfterRestoreRef.current = null;
      setFrameworkGuidePanoramaIntro(false);

      if (cameraMode === "restore") {
        afterRestore?.();
        return;
      }

      if (pendingFrameworkGuide && !hasSeenFrameworkGuide) {
        setFrameworkGuideStep((current) => (current === 0 ? 1 : current));
      } else {
        frameworkGuideIntroStartedRef.current = false;
      }
    }, 3200);

    return () => window.clearTimeout(failsafeTimer);
  }, [frameworkGuidePanoramaIntro, hasSeenFrameworkGuide, pendingFrameworkGuide]);

	  useEffect(() => {
    if (lastSeenTownDecorUnlockCount !== null) return;
    const initialSeenCount = Math.max(0, townDecorProgressCount - 1);
    setLastSeenTownDecorUnlockCount(initialSeenCount);
    try {
      localStorage.setItem(
        TOWN_DECOR_UNLOCK_STORAGE_KEY,
        initialSeenCount.toString(),
      );
    } catch (e) {
      console.error(e);
    }
  }, [lastSeenTownDecorUnlockCount, townDecorProgressCount]);

  const isTownMainReadyForUnlock = useMemo(
    () =>
      activeTab === "town" &&
      scene === "exterior" &&
      !showReferenceGrid &&
      !showQuiz &&
      !showVictory &&
      !showWinStreak &&
      !showWinStreak2 &&
      !showStreakDraw &&
      !showStreakReward &&
      !showStreakPanel &&
      !showVictoryMsg &&
      !showBuildingUpgrade &&
      !showRestaurantUnlockDialogue &&
      !showLevelConfirm &&
      !showStaminaRecoveryPrompt &&
      !showTasks &&
      !showReview &&
      !showCourseOutline &&
      !showSocial &&
      !showSocialCreate &&
      !socialReward &&
      !showStory &&
      !showSceneModal &&
      !showDialogueFlow &&
      !showPreludeVictory &&
      !levelCurtain &&
      !townLiftTransition &&
      !townDecorRewardReveal &&
      !targetDecorationPrompt &&
      !lockedBuildingPrompt &&
      !earlyUnlockConfirmBuilding &&
      !showEarlyUnlockSuccess &&
      !showGrannySofaDialogue &&
      !(townEventStep > 0 && townEventStep < 5) &&
      introStep !== 4 &&
      miaDecorGuideStep === 0 &&
      frameworkGuideStep === 0 &&
      !frameworkGuidePanoramaIntro &&
      !isPreludeActive &&
      !isLevelTransitionInputLocked &&
      !isTransitioning,
    [
      activeTab,
      isLevelTransitionInputLocked,
      isPreludeActive,
      isTransitioning,
      introStep,
      scene,
      showBuildingUpgrade,
      showCourseOutline,
      showDialogueFlow,
      showGrannySofaDialogue,
      showLevelConfirm,
      showPreludeVictory,
      showQuiz,
      showReferenceGrid,
      showRestaurantUnlockDialogue,
      showStaminaRecoveryPrompt,
      showReview,
      showSceneModal,
      showSocial,
      showSocialCreate,
      showStreakDraw,
      showStreakPanel,
      showStreakReward,
      showStory,
      showTasks,
      showVictory,
      showVictoryMsg,
      showWinStreak,
      showWinStreak2,
      socialReward,
      levelCurtain,
      townEventStep,
      townLiftTransition,
      townDecorRewardReveal,
      targetDecorationPrompt,
      lockedBuildingPrompt,
      earlyUnlockConfirmBuilding,
      showEarlyUnlockSuccess,
      miaDecorGuideStep,
      frameworkGuideStep,
      frameworkGuidePanoramaIntro,
    ],
  );

  useEffect(() => {
    if (
      !isTownMainReadyForUnlock ||
      townBuildingUpgradeToast ||
      townDecorUnlockAnimation ||
      townDecorRewardReveal
    ) {
      return;
    }

    const upgradedBuildingAwaitingCue = TOWN_EDITOR_BUILDINGS.find(
      (building) => {
        if (building.id <= lastSeenTownBuildingUpgradeCount) return false;
        const state = getTownBuildingUnlockState(building);
        return state.isBuildingUnlocked && state.isBuildingUpgraded;
      },
    );

    if (upgradedBuildingAwaitingCue) {
      playTownBuildingUpgradeCue(upgradedBuildingAwaitingCue);
    }
  }, [
    getTownBuildingUnlockState,
    isTownMainReadyForUnlock,
    lastSeenTownBuildingUpgradeCount,
    playTownBuildingUpgradeCue,
    townBuildingUpgradeToast,
    townDecorRewardReveal,
    townDecorUnlockAnimation,
  ]);

	  const hasVisibleTopTaskCard = useMemo(
	    () =>
	      showTopCard &&
	      Boolean(topTaskCardTask) &&
	      introStep >= 5 &&
	      activeTab === "town" &&
      scene === "exterior" &&
      !showQuiz &&
	      !isPreludeActive &&
	      ((townEventStep !== 2 &&
	        townEventStep < 5 &&
	        dismissedCardPhase === 0) ||
	        (townEventStep >= 5 &&
	          dismissedCardPhase < EXTERIOR_TASKS.length)),
	    [
	      activeTab,
	      dismissedCardPhase,
	      introStep,
	      isPreludeActive,
	      scene,
	      showQuiz,
	      showTopCard,
	      topTaskCardTask,
	      townEventStep,
	    ],
	  );

  useEffect(() => {
    const canShowIdleGuide =
      isTownMainReadyForUnlock &&
      activeTab === "town" &&
      scene === "exterior" &&
      !isDraggingScene &&
      !showGuideArrow;

    const clearIdleGuideTimer = () => {
      if (idleTownGuideTimerRef.current !== null) {
        window.clearTimeout(idleTownGuideTimerRef.current);
        idleTownGuideTimerRef.current = null;
      }
    };

    if (!canShowIdleGuide) {
      clearIdleGuideTimer();
      setIdleTownGuideTarget(null);
      return;
    }

    const scheduleIdleGuide = () => {
      clearIdleGuideTimer();
      idleTownGuideTimerRef.current = window.setTimeout(() => {
        setIdleTownGuideTarget(hasVisibleTopTaskCard ? "task" : "home");
      }, 7000);
    };

    const handleUserActivity = () => {
      setIdleTownGuideTarget(null);
      scheduleIdleGuide();
    };

    scheduleIdleGuide();
    window.addEventListener("pointerdown", handleUserActivity, {
      capture: true,
      passive: true,
    });
    window.addEventListener("keydown", handleUserActivity, {
      capture: true,
    });
    window.addEventListener("wheel", handleUserActivity, {
      capture: true,
      passive: true,
    });

    return () => {
      clearIdleGuideTimer();
      window.removeEventListener("pointerdown", handleUserActivity, true);
      window.removeEventListener("keydown", handleUserActivity, true);
      window.removeEventListener("wheel", handleUserActivity, true);
    };
  }, [
    activeTab,
    hasVisibleTopTaskCard,
    isDraggingScene,
    isTownMainReadyForUnlock,
    scene,
    showGuideArrow,
  ]);

  useEffect(() => {
	    const hasTaskCardContent =
	      introStep >= 5 &&
	      Boolean(topTaskCardTask) &&
	      ((townEventStep !== 2 &&
	        townEventStep < 5 &&
	        dismissedCardPhase === 0) ||
        (townEventStep >= 5 &&
          dismissedCardPhase < EXTERIOR_TASKS.length));

    const isPlainTownMain =
      hasTaskCardContent &&
      isTownMainReadyForUnlock &&
      !townDecorUnlockAnimation &&
      !townDecorRewardReveal &&
      newTownDecorBubbleIds.length === 0 &&
      animatingCompletedPhase === null;

    if (!isPlainTownMain) {
      wasAwayFromTownMainForTaskCardRef.current = true;
      return;
    }

    if (wasAwayFromTownMainForTaskCardRef.current) {
      setShowTopCard(true);
      wasAwayFromTownMainForTaskCardRef.current = false;
    }
  }, [
	    animatingCompletedPhase,
	    dismissedCardPhase,
	    introStep,
	    isTownMainReadyForUnlock,
	    newTownDecorBubbleIds.length,
	    topTaskCardTask,
	    townDecorRewardReveal,
	    townDecorUnlockAnimation,
	    townEventStep,
  ]);

  useEffect(() => {
    const nextDirectUnlock = pendingDirectTownDecorUnlocks[0] || null;
    const canPlayDirectUnlock =
      isTownMainReadyForUnlock &&
      nextDirectUnlock !== null &&
      !townDecorUnlockAnimation &&
      !townDecorRewardReveal;

    if (!canPlayDirectUnlock || !nextDirectUnlock) return;

    const building = TOWN_EDITOR_BUILDINGS.find(
      (item) => item.id === nextDirectUnlock.buildingId,
    );
    const decoration = building?.decorations.find(
      (item) => item.id === nextDirectUnlock.decorationId,
    );

    if (!building || !decoration) {
      markTownDecorUnlockCountSeen(nextDirectUnlock.unlockCount);
      setPendingDirectTownDecorUnlocks((current) => current.slice(1));
      return;
    }

    if (!getTownBuildingUnlockState(building).isBuildingUnlocked) {
      return;
    }

    if (manualUnlockedTownDecorationIds.includes(decoration.id)) {
      markTownDecorUnlockCountSeen(nextDirectUnlock.unlockCount);
      setPendingDirectTownDecorUnlocks((current) => current.slice(1));
      return;
    }

    const batch = {
      buildingId: building.id,
      decorationIds: [decoration.id],
    };
    const animationKey = Date.now();
    const startTimer = window.setTimeout(() => {
      const finishDirectUnlock = () => {
        restoreTownUnlockCamera();
        window.setTimeout(() => {
          setTownDecorUnlockAnimation((current) =>
            current?.key === animationKey ? null : current,
          );
          setManualUnlockedTownDecorationIds((current) =>
            current.includes(decoration.id)
              ? current
              : [...current, decoration.id],
          );
          setNewTownDecorBubbleIds([decoration.id]);
          hapticFeedback.success?.();
          playTownDecorProgressParticles([decoration.id]);
          markTownDecorUnlockCountSeen(nextDirectUnlock.unlockCount);
          if (
            nextDirectUnlock.unlockCount &&
            nextDirectUnlock.unlockCount % TOWN_DECOR_UNLOCKS_PER_BUILDING ===
              0
          ) {
            const upgradedBuilding = getTownBuildingForUnlockCount(
              nextDirectUnlock.unlockCount,
            );
            if (upgradedBuilding) {
              playTownBuildingUpgradeCue(upgradedBuilding);
            }
          }
          if (newTownDecorBubbleTimerRef.current !== null) {
            window.clearTimeout(newTownDecorBubbleTimerRef.current);
          }
          newTownDecorBubbleTimerRef.current = window.setTimeout(() => {
            setNewTownDecorBubbleIds([]);
            newTownDecorBubbleTimerRef.current = null;
          }, 1850);
          setPendingDirectTownDecorUnlocks((current) => current.slice(1));
        }, 680);
      };

      const target = getTownDecorationScreenTarget(batch);
      if (target) {
        setTownDecorRewardReveal({
          key: animationKey,
          ...target,
          phase: "showcase",
        });
        hapticFeedback.reward?.();
        window.setTimeout(() => {
          setTownDecorRewardReveal((current) =>
            current?.key === animationKey
              ? { ...current, phase: "fly" }
              : current,
          );
        }, 1350);
        window.setTimeout(() => {
          setTownDecorRewardReveal((current) =>
            current?.key === animationKey ? null : current,
          );
          focusTownDecorationUnlock(batch);
          setTownDecorUnlockAnimation({ key: animationKey, ...batch });
          hapticFeedback.clean?.();
          window.setTimeout(finishDirectUnlock, 5200);
        }, 2450);
        return;
      }

      focusTownDecorationUnlock(batch);
      hapticFeedback.clean?.();
      setTownDecorUnlockAnimation({ key: animationKey, ...batch });
      window.setTimeout(finishDirectUnlock, 4200);
    }, 420);

    return () => window.clearTimeout(startTimer);
  }, [
    focusTownDecorationUnlock,
    getTownDecorationScreenTarget,
    getTownBuildingUnlockState,
    isTownMainReadyForUnlock,
    markTownDecorUnlockCountSeen,
    manualUnlockedTownDecorationIds,
    pendingDirectTownDecorUnlocks,
    playTownBuildingUpgradeCue,
    playTownDecorProgressParticles,
    restoreTownUnlockCamera,
    townDecorRewardReveal,
    townDecorUnlockAnimation,
  ]);

	  useEffect(() => {
    const queuedUnlockCount =
      pendingTownDecorUnlockCounts.find(
        (unlockCount) => unlockCount <= townDecorProgressCount,
      ) ?? null;
	    const canPlayTownUnlock =
	      isTownMainReadyForUnlock &&
        pendingDirectTownDecorUnlocks.length === 0 &&
	      lastSeenTownDecorUnlockCount !== null &&
	      (queuedUnlockCount !== null ||
	        townDecorProgressCount > lastSeenTownDecorUnlockCount) &&
	      !townDecorUnlockAnimation;

	    if (!canPlayTownUnlock) return;

	    const nextUnlockCount =
      queuedUnlockCount ?? lastSeenTownDecorUnlockCount + 1;
	    const batch = getTownDecorationUnlockBatch(nextUnlockCount);
	    if (!batch) {
	      setPendingTownDecorUnlockCounts((current) =>
        current.filter((unlockCount) => unlockCount !== nextUnlockCount),
      );
      markTownDecorUnlockCountSeen(nextUnlockCount);
      if (nextUnlockCount % TOWN_DECOR_UNLOCKS_PER_BUILDING === 0) {
        const upgradedBuilding = getTownBuildingForUnlockCount(nextUnlockCount);
        if (
          upgradedBuilding &&
          getTownBuildingUnlockState(upgradedBuilding).isBuildingUnlocked
        ) {
          playTownBuildingUpgradeCue(upgradedBuilding);
        }
      }
	      return;
	    }
    const batchBuilding = TOWN_EDITOR_BUILDINGS.find(
      (building) => building.id === batch.buildingId,
    );
    if (
      batchBuilding &&
      !getTownBuildingUnlockState(batchBuilding).isBuildingUnlocked
    ) {
      return;
    }

	    const finishUnlock = (animationKey: number) => {
	      restoreTownUnlockCamera();

      window.setTimeout(() => {
	        setTownDecorUnlockAnimation((current) =>
	          current?.key === animationKey ? null : current,
	        );
        setNewTownDecorBubbleIds(batch.decorationIds);
        hapticFeedback.success?.();
        playTownDecorProgressParticles(batch.decorationIds);
        if (nextUnlockCount % TOWN_DECOR_UNLOCKS_PER_BUILDING === 0) {
          const upgradedBuilding = getTownBuildingForUnlockCount(nextUnlockCount);
          if (upgradedBuilding) {
            playTownBuildingUpgradeCue(upgradedBuilding);
          }
        }
        if (newTownDecorBubbleTimerRef.current !== null) {
          window.clearTimeout(newTownDecorBubbleTimerRef.current);
        }
        newTownDecorBubbleTimerRef.current = window.setTimeout(() => {
          setNewTownDecorBubbleIds([]);
          newTownDecorBubbleTimerRef.current = null;
        }, 1850);
        setPendingTownDecorUnlockCounts((current) =>
          current.filter((unlockCount) => unlockCount !== nextUnlockCount),
        );
        markTownDecorUnlockCountSeen(nextUnlockCount);
        if (nextUnlockCount === 1) {
          setPendingMiaDecorGuide(true);
        }
      }, 680);
    };

    const startTimer = window.setTimeout(() => {
      const animationKey = Date.now();
      const target = getTownDecorationScreenTarget(batch);
      if (target) {
        setTownDecorRewardReveal({
          key: animationKey,
          ...target,
          phase: "showcase",
        });
        hapticFeedback.reward?.();
        window.setTimeout(() => {
          setTownDecorRewardReveal((current) =>
            current?.key === animationKey
              ? { ...current, phase: "fly" }
              : current,
          );
        }, 1350);
        window.setTimeout(() => {
          setTownDecorRewardReveal((current) =>
            current?.key === animationKey ? null : current,
          );
          focusTownDecorationUnlock(batch);
          setTownDecorUnlockAnimation({ key: animationKey, ...batch });
          hapticFeedback.clean?.();
          window.setTimeout(() => finishUnlock(animationKey), 5200);
        }, 2450);
        return;
      }

      focusTownDecorationUnlock(batch);
      setTownDecorUnlockAnimation({ key: animationKey, ...batch });
      hapticFeedback.clean?.();

      window.setTimeout(() => {
        finishUnlock(animationKey);
      }, 5200);
    }, 420);

    return () => {
      window.clearTimeout(startTimer);
    };
	  }, [
	    getTownDecorationUnlockBatch,
	    getTownDecorationScreenTarget,
	    focusTownDecorationUnlock,
      getTownBuildingUnlockState,
		    isTownMainReadyForUnlock,
	    lastSeenTownDecorUnlockCount,
    markTownDecorUnlockCountSeen,
    playTownDecorProgressParticles,
    pendingDirectTownDecorUnlocks.length,
    pendingTownDecorUnlockCounts,
    playTownBuildingUpgradeCue,
	    restoreTownUnlockCamera,
	    townDecorProgressCount,
		  ]);

		  useEffect(() => {
		    const hasPendingDecorUnlock =
        pendingDirectTownDecorUnlocks.length > 0 ||
        pendingTownDecorUnlockCounts.some(
          (unlockCount) => unlockCount <= townDecorProgressCount,
        ) ||
		      lastSeenTownDecorUnlockCount !== null &&
		      townDecorProgressCount > lastSeenTownDecorUnlockCount;

	    if (
	      pendingMiaDecorGuide &&
	      frameworkGuideStep === 0 &&
	      isTownMainReadyForUnlock &&
	      !hasPendingDecorUnlock
	    ) {
	      setPendingMiaDecorGuide(false);
	      window.setTimeout(() => setMiaDecorGuideStep(1), 260);
	      return;
	    }

	    if (
	      pendingFrameworkGuide &&
	      !hasSeenFrameworkGuide &&
	      frameworkGuideStep === 0 &&
	      isTownMainReadyForUnlock &&
	      !hasPendingDecorUnlock &&
        !frameworkGuideIntroStartedRef.current
	    ) {
        frameworkGuideIntroStartedRef.current = true;
	      startFrameworkGuidePanoramaIntro();
	    }
	  }, [
      pendingDirectTownDecorUnlocks.length,
	    frameworkGuideStep,
      startFrameworkGuidePanoramaIntro,
	    hasSeenFrameworkGuide,
	    isTownMainReadyForUnlock,
		    lastSeenTownDecorUnlockCount,
		    pendingMiaDecorGuide,
		    pendingFrameworkGuide,
    pendingTownDecorUnlockCounts,
		    townDecorProgressCount,
		  ]);

	  const continueFrameworkGuide = useCallback(() => {
	    hapticFeedback.light?.();
      if (frameworkGuideStep === 1) {
        setFrameworkGuideStep(0);
        restoreFrameworkGuideCamera(() => {
          setFrameworkGuideStep(2);
        });
        return;
      }
	    setFrameworkGuideStep((current) => {
	      if (current >= 4) {
	        setHasSeenFrameworkGuide(true);
	        setPendingFrameworkGuide(false);
          frameworkGuideIntroStartedRef.current = false;
          setIdleTownGuideTarget(null);
          window.setTimeout(() => setShowGuideArrow(true), 320);
	        return 0;
	      }
	      return (current + 1) as FrameworkGuideStep;
	    });
	  }, [frameworkGuideStep, restoreFrameworkGuideCamera]);

  useEffect(() => {
    if (frameworkGuideStep === 0) return;
    const guideAudio = FRAMEWORK_GUIDE_AUDIO[frameworkGuideStep];
    void speakText(guideAudio.text, {
      role: guideAudio.role,
      audioSrc: guideAudio.audioSrc,
    });
    return () => {
      void stopSpeech();
    };
  }, [frameworkGuideStep]);

	  const unlockedHomeDecorations = useMemo(
    () =>
      HOME_DECORATIONS.filter(
        (decoration) =>
          homeDecorCompletionCount >= decoration.unlockAfterCompletions,
      ),
    [homeDecorCompletionCount],
  );

  const updateHomeDecorationPosition = useCallback(
    (id: HomeDecorationId, nextX: number, nextY: number) => {
      setHomeDecorationPositions((prev) => {
        const current =
          prev[id] || getDefaultHomeDecorationPositions()[id];
        const width = current.width;
        const x = Math.max(0, Math.min(100 - width, nextX));
        const y = Math.max(0, Math.min(95, nextY));
        return {
          ...prev,
          [id]: {
            ...current,
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
          },
        };
      });
    },
    [],
  );

  const updateTownEditorBuildingPosition = useCallback(
    (id: string, nextX: number, nextY: number) => {
      setTownEditorBuildingPositions((prev) => {
        const current =
          prev[id] || getDefaultTownEditorBuildingPositions()[id];
        const width = current.width;
        const x = Math.max(-8, Math.min(108 - width, nextX));
        const y = Math.max(-5, Math.min(92, nextY));
        return {
          ...prev,
          [id]: {
            ...current,
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
          },
        };
      });
    },
    [],
  );

  const updateTownEditorDecorationPosition = useCallback(
    (id: string, nextX: number, nextY: number) => {
      setTownEditorDecorationPositions((prev) => {
        const current =
          prev[id] || getDefaultTownEditorDecorationPositions()[id];
        const decoration = TOWN_EDITOR_DECORATION_BY_ID[id];
        const width = current.width;
        const height = decoration?.height || width;
        const x = Math.max(-3, Math.min(103 - width, nextX));
        const y = Math.max(-3, Math.min(103 - height, nextY));
        return {
          ...prev,
          [id]: {
            ...current,
            x: Math.round(x * 10) / 10,
            y: Math.round(y * 10) / 10,
          },
        };
      });
    },
    [],
  );

  const updateTownEditorDecorationWidth = useCallback(
    (id: string, direction: 1 | -1) => {
      setTownEditorDecorationPositions((prev) => {
        const current =
          prev[id] || getDefaultTownEditorDecorationPositions()[id];
        if (!current) return prev;

        const nextWidth = Math.min(
          TOWN_EDITOR_DECORATION_WIDTH_MAX,
          Math.max(
            TOWN_EDITOR_DECORATION_WIDTH_MIN,
            current.width + direction * TOWN_EDITOR_DECORATION_WIDTH_STEP,
          ),
        );

        return {
          ...prev,
          [id]: {
            ...current,
            width: Math.round(nextWidth * 10) / 10,
          },
        };
      });
    },
    [],
  );

		  const adjustTownCameraZoom = useCallback(
		    (direction: 1 | -1) => {
	      setTownCameraZoom((current) => {
	        const next = clampTownCameraZoom(
	          current + direction * TOWN_CAMERA_ZOOM_STEP,
	        );
	        animate(townCameraScale, next, {
	          duration: 0.24,
	          ease: "easeOut",
	        });
	        return next;
	      });
	    },
	    [townCameraScale],
	  );

	  const persistTownCameraZoom = useCallback(() => {
	    try {
	      localStorage.setItem(
	        TOWN_CAMERA_ZOOM_STORAGE_KEY,
	        townCameraZoom.toString(),
      );
    } catch (e) {
      console.error(e);
	    }
	  }, [townCameraZoom]);

  const adjustTownCameraPanSpeed = useCallback((direction: 1 | -1) => {
    setTownCameraPanSpeed((current) =>
      clampTownCameraPanSpeed(
        current + direction * TOWN_CAMERA_PAN_SPEED_STEP,
      ),
    );
  }, []);

	  useEffect(() => {
    if (!showReferenceGrid) {
      setSelectedTownEditorDecorationId(null);
    }
  }, [showReferenceGrid]);

  const handleTownEditorBuildingPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, buildingId: number) => {
      if (!showReferenceGrid) return;

      const layer = townEditorLayerRef.current;
      if (!layer) return;

      e.preventDefault();
      e.stopPropagation();
      isDraggingSceneGlobalRef.current = true;

      const id = String(buildingId);
      setSelectedTownEditorDecorationId(null);
      const rect = layer.getBoundingClientRect();
      const position =
        townEditorBuildingPositions[id] ||
        getDefaultTownEditorBuildingPositions()[id];
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;

      draggingTownEditorRef.current = {
        kind: "building",
        id,
        pointerId: e.pointerId,
        offsetX: pointerX - position.x,
        offsetY: pointerY - position.y,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [showReferenceGrid, townEditorBuildingPositions],
  );

  const triggerTownDecorationTapAnimation = useCallback(
    (decorationId: string) => {
      hapticFeedback.light?.();
      setTappedTownDecoration({
        id: decorationId,
        key: Date.now(),
      });

      if (townDecorTapAnimationTimerRef.current !== null) {
        window.clearTimeout(townDecorTapAnimationTimerRef.current);
      }
      townDecorTapAnimationTimerRef.current = window.setTimeout(() => {
        setTappedTownDecoration((current) =>
          current?.id === decorationId ? null : current,
        );
        townDecorTapAnimationTimerRef.current = null;
      }, 560);
    },
    [],
  );

  const handleTownEditorDecorationPointerDown = useCallback(
	    (
	      e: React.PointerEvent<HTMLDivElement>,
	      buildingId: number,
	      decorationId: string,
	    ) => {
      if (!showReferenceGrid && (isCourseEntryInputLocked || levelTransitionInputLockRef.current)) {
        e.preventDefault();
        e.stopPropagation();
        suppressBuildingPointerUpRef.current = true;
        window.setTimeout(() => {
          suppressBuildingPointerUpRef.current = false;
        }, 320);
        return;
      }
	      const building = TOWN_EDITOR_BUILDINGS.find(
	        (item) => item.id === buildingId,
	      );
      const decoration = building?.decorations.find(
        (item) => item.id === decorationId,
      );
      if (
        decoration &&
        !isPointOnVisibleImagePixel(
          decoration.src,
          e.clientX,
          e.clientY,
          e.currentTarget.getBoundingClientRect(),
          28,
        )
      ) {
        transparentTownDecorationPointerRef.current = {
          pointerId: e.pointerId,
          decorationId,
          buildingId,
        };
        return;
      }
      if (
        transparentTownDecorationPointerRef.current?.pointerId === e.pointerId
      ) {
        transparentTownDecorationPointerRef.current = null;
      }
	      const decorationUnlockIndex = building
	        ? getTownDecorationUnlockOrder(building).findIndex(
	            (item) => item.id === decorationId,
	          )
        : -1;
      const isDecorationUnlocked =
        Boolean(building) &&
        isTownDecorationUnlocked(
          building!,
          Math.max(0, decorationUnlockIndex),
          decorationId,
        );
      const isBuildingUnlocked = building
        ? getTownBuildingUnlockState(building).isBuildingUnlocked
        : false;
      const canDragDecoration =
        showReferenceGrid ||
        (hasCompletedUnit1 && building && isDecorationUnlocked);
	      if (!canDragDecoration) {
        if (
          hasCompletedUnit1 &&
          building &&
          isBuildingUnlocked &&
          !isDecorationUnlocked &&
          !townDecorUnlockAnimation &&
          !townDecorRewardReveal
        ) {
	          e.preventDefault();
	          e.stopPropagation();
	          suppressBuildingPointerUpRef.current = true;
	          window.setTimeout(() => {
	            suppressBuildingPointerUpRef.current = false;
	          }, 260);
	          hapticFeedback.light?.();
	          setShowLevelConfirm(false);
	          setLockedBuildingPrompt(null);
	          setEarlyUnlockConfirmBuilding(null);
	          setTargetDecorationPrompt({ buildingId, decorationId });
	        }
        return;
      }

		      const stage = e.currentTarget.closest(
		        "[data-town-editor-stage]",
		      ) as HTMLElement | null;
	      if (!stage) return;

	      e.preventDefault();
		      e.stopPropagation();

	      const rect = stage.getBoundingClientRect();
	      const position =
	        townEditorDecorationPositions[decorationId] ||
	        getDefaultTownEditorDecorationPositions()[decorationId];
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;

      const dragSeed = {
        id: decorationId,
        buildingId: String(buildingId),
        pointerId: e.pointerId,
        offsetX: pointerX - position.x,
        offsetY: pointerY - position.y,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };

      if (showReferenceGrid) {
		        isDraggingSceneGlobalRef.current = true;
		        setSelectedTownEditorDecorationId(decorationId);
        setNewTownDecorBubbleIds((current) =>
          current.filter((id) => id !== decorationId),
        );
        draggingTownEditorRef.current = {
          kind: "decoration",
          ...dragSeed,
        };
        setPickedTownDecorationId(decorationId);
      } else {
        const previousPending = pendingTownDecorationDragRef.current;
        if (previousPending?.timerId !== null && previousPending?.timerId !== undefined) {
          window.clearTimeout(previousPending.timerId);
        }

        const target = e.currentTarget;
        const pending = {
          ...dragSeed,
          target,
          timerId: null as number | null,
          activated: false,
          cancelled: false,
        };
        pending.timerId = window.setTimeout(() => {
          const current = pendingTownDecorationDragRef.current;
          if (
            !current ||
            current.pointerId !== pending.pointerId ||
            current.cancelled
          ) {
            return;
          }

          current.activated = true;
          isDraggingSceneGlobalRef.current = true;
          hapticFeedback.light?.();
          setSelectedTownEditorDecorationId(decorationId);
          setPickedTownDecorationId(decorationId);
          setNewTownDecorBubbleIds((ids) =>
            ids.filter((id) => id !== decorationId),
          );
          draggingTownEditorRef.current = {
            kind: "decoration",
            id: current.id,
            buildingId: current.buildingId,
            pointerId: current.pointerId,
            offsetX: current.offsetX,
            offsetY: current.offsetY,
            startClientX: current.startClientX,
            startClientY: current.startClientY,
          };
        }, TOWN_DECORATION_LONG_PRESS_MS);
        pendingTownDecorationDragRef.current = pending;
      }

	      e.currentTarget.setPointerCapture(e.pointerId);
	    },
	    [
      getTownBuildingUnlockState,
      getTownDecorationUnlockOrder,
      hasCompletedUnit1,
      isCourseEntryInputLocked,
      isTownDecorationUnlocked,
      showReferenceGrid,
      townDecorRewardReveal,
      townDecorUnlockAnimation,
      townEditorDecorationPositions,
    ],
  );

	  const handleTownEditorPointerMove = useCallback(
	    (e: React.PointerEvent<HTMLDivElement>) => {
      const pending = pendingTownDecorationDragRef.current;
      if (
        pending &&
        pending.pointerId === e.pointerId &&
        !pending.activated
      ) {
        e.preventDefault();
        e.stopPropagation();
        if (
          Math.hypot(
            e.clientX - pending.startClientX,
            e.clientY - pending.startClientY,
          ) > TOWN_DECORATION_LONG_PRESS_MOVE_TOLERANCE
        ) {
          pending.cancelled = true;
          if (pending.timerId !== null) {
            window.clearTimeout(pending.timerId);
            pending.timerId = null;
          }
        }
        return;
      }

	      const drag = draggingTownEditorRef.current;
	      if (!drag || drag.pointerId !== e.pointerId) return;

      e.preventDefault();
      e.stopPropagation();

      if (drag.kind === "building") {
        const layer = townEditorLayerRef.current;
        if (!layer) return;
        const rect = layer.getBoundingClientRect();
        const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
        const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
        updateTownEditorBuildingPosition(
          drag.id,
          pointerX - drag.offsetX,
          pointerY - drag.offsetY,
        );
        return;
      }

      const stage = townEditorLayerRef.current?.querySelector<HTMLElement>(
        `[data-town-editor-stage="${drag.buildingId}"]`,
      );
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
      updateTownEditorDecorationPosition(
        drag.id,
        pointerX - drag.offsetX,
        pointerY - drag.offsetY,
      );
    },
    [
      updateTownEditorBuildingPosition,
      updateTownEditorDecorationPosition,
    ],
  );

	  const handleTownEditorPointerUp = useCallback(
	    (e: React.PointerEvent<HTMLDivElement>) => {
      const pending = pendingTownDecorationDragRef.current;
      if (pending && pending.pointerId === e.pointerId) {
        if (pending.timerId !== null) {
          window.clearTimeout(pending.timerId);
          pending.timerId = null;
        }

        if (!pending.activated) {
          const isTap =
            !pending.cancelled &&
            e.type !== "pointercancel" &&
            Math.hypot(
              e.clientX - pending.startClientX,
              e.clientY - pending.startClientY,
            ) < 8;

          e.preventDefault();
          e.stopPropagation();

          try {
            pending.target.releasePointerCapture(e.pointerId);
          } catch (err) {
            console.warn("releasePointerCapture failed", err);
          }

          pendingTownDecorationDragRef.current = null;
          setPickedTownDecorationId(null);
          isDraggingSceneGlobalRef.current = false;
          if (isTap) {
            setNewTownDecorBubbleIds((current) =>
              current.filter((id) => id !== pending.id),
            );
            triggerTownDecorationTapAnimation(pending.id);
          }
          return;
        }

        pendingTownDecorationDragRef.current = null;
      }

	      const drag = draggingTownEditorRef.current;
	      if (!drag || drag.pointerId !== e.pointerId) return;
      const isDecorationTap =
        drag.kind === "decoration" &&
        !showReferenceGrid &&
        Math.hypot(
          e.clientX - drag.startClientX,
          e.clientY - drag.startClientY,
        ) < 8;

      e.preventDefault();
      e.stopPropagation();

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        console.warn("releasePointerCapture failed", err);
      }

      draggingTownEditorRef.current = null;
      setPickedTownDecorationId(null);
      if (isDecorationTap) {
        triggerTownDecorationTapAnimation(drag.id);
      }
      setTimeout(() => {
        isDraggingSceneGlobalRef.current = false;
      }, 80);
    },
    [showReferenceGrid, triggerTownDecorationTapAnimation],
  );

  const getHomeDecorationTargetAtPoint = useCallback(
    (pointerX: number, pointerY: number): HomeDecorationId => {
      let nearest: {
        id: HomeDecorationId;
        score: number;
        contains: boolean;
      } | null = null;

      HOME_DECORATIONS.forEach((decoration) => {
        const position =
          homeDecorationPositions[decoration.id] ||
          getDefaultHomeDecorationPositions()[decoration.id];
        const height = position.width * decoration.heightRatio;
        const expanded = 7;
        const contains =
          pointerX >= position.x - expanded &&
          pointerX <= position.x + position.width + expanded &&
          pointerY >= position.y - expanded &&
          pointerY <= position.y + height + expanded;
        const centerX = position.x + position.width / 2;
        const centerY = position.y + height / 2;
        const distance = Math.hypot(pointerX - centerX, pointerY - centerY);
        const score = contains ? distance - 1000 : distance;

        if (!nearest || score < nearest.score) {
          nearest = { id: decoration.id, score, contains };
        }
      });

      return nearest?.id || HOME_DECORATIONS[0].id;
    },
    [homeDecorationPositions],
  );

  const handleHomeDecorationPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: HomeDecorationId) => {
      if (!showReferenceGrid) return;

      const stage = homeDecorationStageRef.current;
      if (!stage) return;

      e.preventDefault();
      e.stopPropagation();
      isDraggingSceneGlobalRef.current = true;

      const rect = stage.getBoundingClientRect();
      const position =
        homeDecorationPositions[id] || getDefaultHomeDecorationPositions()[id];
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;

      draggingHomeDecorationRef.current = {
        id,
        pointerId: e.pointerId,
        offsetX: pointerX - position.x,
        offsetY: pointerY - position.y,
      };

      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [homeDecorationPositions, showReferenceGrid],
  );

  const handleHomeDecorationStagePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!showReferenceGrid) return;

      const stage = homeDecorationStageRef.current;
      if (!stage) return;

      const rect = stage.getBoundingClientRect();
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
      handleHomeDecorationPointerDown(
        e,
        getHomeDecorationTargetAtPoint(pointerX, pointerY),
      );
    },
    [
      getHomeDecorationTargetAtPoint,
      handleHomeDecorationPointerDown,
      showReferenceGrid,
    ],
  );

  const handleHomeDecorationPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = draggingHomeDecorationRef.current;
      const stage = homeDecorationStageRef.current;
      if (!drag || !stage || drag.pointerId !== e.pointerId) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = stage.getBoundingClientRect();
      const pointerX = ((e.clientX - rect.left) / rect.width) * 100;
      const pointerY = ((e.clientY - rect.top) / rect.height) * 100;
      updateHomeDecorationPosition(
        drag.id,
        pointerX - drag.offsetX,
        pointerY - drag.offsetY,
      );
    },
    [updateHomeDecorationPosition],
  );

  const handleHomeDecorationPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = draggingHomeDecorationRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;

      e.preventDefault();
      e.stopPropagation();
      draggingHomeDecorationRef.current = null;

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        console.warn("releasePointerCapture failed", err);
      }

      window.setTimeout(() => {
        isDraggingSceneGlobalRef.current = false;
      }, 80);
    },
    [],
  );

  const resetSocialSelection = useCallback(() => {
    const defaultIds = recentSocialTerms.slice(0, 4).map((term) => term.id);
    setSelectedSocialTermIds(defaultIds);
  }, [recentSocialTerms]);

  const toggleSocialTerm = useCallback((termId: string) => {
    setSelectedSocialTermIds((prev) => {
      if (prev.includes(termId)) {
        return prev.filter((id) => id !== termId);
      }

      if (prev.length >= 6) return prev;
      return [...prev, termId];
    });
  }, []);

  const cityLevelInfo = useMemo(() => getCityLevelInfo(quizIndex), [quizIndex]);
  const apartmentProgressInfo = useMemo(() => {
    const completed = Math.min(
      TOWN_DECOR_UNLOCKS_PER_BUILDING,
      visibleTownDecorProgressCount,
    );
    return {
      completed,
      progress: completed / TOWN_DECOR_UNLOCKS_PER_BUILDING,
      label: `${completed}/${TOWN_DECOR_UNLOCKS_PER_BUILDING}`,
    };
  }, [visibleTownDecorProgressCount]);
  const topBuildingProgress = townProgressPulse
    ? apartmentProgressInfo.progress
    : cityLevelInfo.progress;
  const topBuildingProgressLabel = townProgressPulse
    ? apartmentProgressInfo.label
    : cityLevelInfo.progressLabel;
  const topBuildingTitle = townProgressPulse
    ? "Apartment"
    : `城市 Lv.${cityLevelInfo.level}`;

  useEffect(() => {
    if (miaDecorGuideStep === 0) return;
    const guideAudio = DECOR_GUIDE_AUDIO[miaDecorGuideStep];
    void speakText(guideAudio.text, {
      role: guideAudio.role,
      audioSrc: guideAudio.audioSrc,
    });
    return () => {
      void stopSpeech();
    };
  }, [miaDecorGuideStep]);

  const continueMiaDecorGuide = useCallback(() => {
    hapticFeedback.error?.();
    if (miaDecorGuideStep === 1) {
      setMiaDecorGuideStep(2);
      return;
    }
    setMiaDecorGuideStep(0);
    setIdleTownGuideTarget(null);
    window.setTimeout(() => setShowGuideArrow(true), 320);
    setTownProgressPulse(true);
    window.setTimeout(() => setTownProgressPulse(false), 2400);
  }, [miaDecorGuideStep]);

  const selectedTopLanguage =
    selectedLang === "Spanish"
      ? { label: "Spanish", short: "ES", flag: "🇪🇸" }
      : { label: "English", short: "EN", flag: "🇬🇧" };

  const showTopResourceHint = useCallback(
    (hint: "city" | "streak" | "stamina") => {
      setIsTopLanguageMenuOpen(false);
      setTopResourceHint(hint);
      if (topResourceHintTimerRef.current) {
        window.clearTimeout(topResourceHintTimerRef.current);
      }
      topResourceHintTimerRef.current = window.setTimeout(() => {
        setTopResourceHint(null);
        topResourceHintTimerRef.current = null;
      }, 2400);
    },
    [],
  );

  const topResourceHintText = {
    city: "城市等级会跟随主线课程进度升级。",
    streak: "每天完成一节课点亮火花，连续学习会累加天数。",
    stamina: "每次答题消耗 1 点，连续答对 3 题返还 1 点，每天 0 点回满。",
  };

  useEffect(() => {
    return () => {
      if (topResourceHintTimerRef.current) {
        window.clearTimeout(topResourceHintTimerRef.current);
      }
    };
  }, []);

  // Handle task transition animation when modal is open
  useEffect(() => {
    if (showTasks && quizIndex > lastAnimatedLessonId) {
      // If we open the task menu and the latest completed lesson is ahead of what we last animated
      const timer = setTimeout(() => {
        setLastAnimatedLessonId(quizIndex);
      }, 1500); // Wait for the checkmark to be seen before sliding out
      return () => clearTimeout(timer);
    }
  }, [showTasks, quizIndex, lastAnimatedLessonId]);

  const [furniture, setFurniture] = useState<string[]>([]);

  const interiorContainerRef = useRef<HTMLDivElement>(null);
  const dragAreaRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(450);
  const [containerHeight, setContainerHeight] = useState(800);
  const townLayoutScale = useMemo(
    () => Math.max(0.78, Math.min(1.16, containerWidth / TOWN_LAYOUT_REFERENCE_WIDTH)),
    [containerWidth],
  );
  const townSceneWorldSize = useMemo(
    () => TOWN_SCENE_WORLD_SIZE * townLayoutScale,
    [townLayoutScale],
  );
  const exteriorSceneSize = useMemo(
    () => TOWN_BACKGROUND_WORLD_SIZE * townLayoutScale,
    [townLayoutScale],
  );

  const townDragRef = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startSceneX: 0,
    startSceneY: 0,
    startTime: 0,
    pointerId: -1,
    hasCaptured: false,
  });
  const townPinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    isPinching: boolean;
    startDistance: number;
    startZoom: number;
    startSceneX: number;
    startSceneY: number;
    startCenterX: number;
    startCenterY: number;
  }>({
    pointers: new Map(),
    isPinching: false,
    startDistance: 0,
    startZoom: 1,
    startSceneX: 0,
    startSceneY: 0,
    startCenterX: 0,
    startCenterY: 0,
  });

  const clampScenePositionForZoom = useCallback(
    (x: number, y: number, zoom: number) => {
	      const activeSceneWidth =
	        scene === "exterior"
	          ? exteriorSceneSize
	          : DEFAULT_SCENE_WIDTH;
	      const activeSceneHeight =
	        scene === "exterior"
	          ? exteriorSceneSize
	          : containerHeight;
      const activeZoom = scene === "exterior" ? zoom : 1;
      const limitX = Math.max(
        0,
        (activeSceneWidth * activeZoom) / 2 - containerWidth / 2,
      );
      const limitY = Math.max(
        0,
        (activeSceneHeight * activeZoom) / 2 - containerHeight / 2,
      );

      return {
        x: Math.max(-limitX, Math.min(limitX, x)),
        y: Math.max(-limitY, Math.min(limitY, y)),
      };
    },
    [containerHeight, containerWidth, exteriorSceneSize, scene],
  );

  const onScenePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scene === "exterior") {
      townPinchRef.current.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });

      if (townPinchRef.current.pointers.size >= 2) {
        const points = Array.from(
          townPinchRef.current.pointers.values(),
        ).slice(0, 2) as { x: number; y: number }[];
        const [first, second] = points;
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        townPinchRef.current.isPinching = true;
        townPinchRef.current.startDistance = Math.max(
          1,
          Math.hypot(second.x - first.x, second.y - first.y),
        );
        townPinchRef.current.startZoom = townCameraScale.get();
        townPinchRef.current.startSceneX = sceneX.get();
        townPinchRef.current.startSceneY = sceneY.get();
        townPinchRef.current.startCenterX = centerX;
        townPinchRef.current.startCenterY = centerY;
        townDragRef.current.isDragging = false;
        townDragRef.current.pointerId = -1;
        setIsDraggingScene(true);
        isDraggingSceneGlobalRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (err) {
          console.warn("setPointerCapture failed", err);
        }
        return;
      }
    }

    townDragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startSceneX: sceneX.get(),
      startSceneY: sceneY.get(),
      startTime: Date.now(),
      pointerId: e.pointerId,
      hasCaptured: false,
    };
    isDraggingSceneGlobalRef.current = false;
  };

  const onScenePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scene === "exterior" && townPinchRef.current.pointers.has(e.pointerId)) {
      townPinchRef.current.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
    }

    if (townPinchRef.current.isPinching) {
      const points = Array.from(
        townPinchRef.current.pointers.values(),
      ).slice(0, 2) as { x: number; y: number }[];
      if (points.length < 2) return;

      e.preventDefault();
      e.stopPropagation();
      const [first, second] = points;
      const currentDistance = Math.max(
        1,
        Math.hypot(second.x - first.x, second.y - first.y),
      );
      const centerClientX = (first.x + second.x) / 2;
      const centerClientY = (first.y + second.y) / 2;
      const nextZoom = clampTownCameraZoom(
        townPinchRef.current.startZoom *
          (currentDistance / townPinchRef.current.startDistance),
      );
      const appRect = appRootRef.current?.getBoundingClientRect();
      const appLeft = appRect?.left || 0;
      const appTop = appRect?.top || 0;
      const viewportWidth = appRect?.width || containerWidth;
      const viewportHeight = appRect?.height || containerHeight;
      const startCenterX = townPinchRef.current.startCenterX - appLeft;
      const startCenterY = townPinchRef.current.startCenterY - appTop;
      const currentCenterX = centerClientX - appLeft;
      const currentCenterY = centerClientY - appTop;
      const worldX =
        (startCenterX -
          viewportWidth / 2 -
          townPinchRef.current.startSceneX) /
        townPinchRef.current.startZoom;
      const worldY =
        (startCenterY -
          viewportHeight / 2 -
          townPinchRef.current.startSceneY) /
        townPinchRef.current.startZoom;
      const unclampedX = currentCenterX - viewportWidth / 2 - worldX * nextZoom;
      const unclampedY = currentCenterY - viewportHeight / 2 - worldY * nextZoom;
      const clamped = clampScenePositionForZoom(
        unclampedX,
        unclampedY,
        nextZoom,
      );

      townCameraScale.set(nextZoom);
      sceneX.set(clamped.x);
      sceneY.set(clamped.y);
      return;
    }

    const drag = townDragRef.current;
    if (!drag.isDragging || drag.pointerId !== e.pointerId) return;

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    const dragDistance = Math.hypot(deltaX, deltaY);

    if (dragDistance > 8) {
      isDraggingSceneGlobalRef.current = true;
      if (!isDraggingScene) {
        setIsDraggingScene(true);
      }
      if (!drag.hasCaptured) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.hasCaptured = true;
        } catch (err) {
          console.warn("setPointerCapture failed", err);
        }
      }
    }

    const panSpeed = scene === "exterior" ? townCameraPanSpeed : 1;
	    let newX = drag.startSceneX + deltaX * panSpeed;
	    let newY = drag.startSceneY + deltaY * panSpeed;
    const minX = sceneConstraints.left;
    const maxX = sceneConstraints.right;
    const minY = sceneConstraints.top;
    const maxY = sceneConstraints.bottom;

    if (newX < minX) {
      newX = minX;
    } else if (newX > maxX) {
      newX = maxX;
    }
    if (newY < minY) {
      newY = minY;
    } else if (newY > maxY) {
      newY = maxY;
    }

    sceneX.set(newX);
    sceneY.set(newY);
  };

  const onScenePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    townPinchRef.current.pointers.delete(e.pointerId);
    if (townPinchRef.current.isPinching) {
      e.preventDefault();
      e.stopPropagation();
      if (townPinchRef.current.pointers.size < 2) {
        townPinchRef.current.isPinching = false;
        townPinchRef.current.startDistance = 0;
        townDragRef.current.isDragging = false;
        townDragRef.current.pointerId = -1;
        setTownCameraZoom(clampTownCameraZoom(townCameraScale.get()));
        setIsDraggingScene(false);
        window.setTimeout(() => {
          isDraggingSceneGlobalRef.current = false;
        }, 100);
      }
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        console.warn("releasePointerCapture failed", err);
      }
      return;
    }

    const drag = townDragRef.current;
    if (!drag.isDragging || drag.pointerId !== e.pointerId) return;

    if (drag.hasCaptured) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        console.warn("releasePointerCapture failed", err);
      }
    }

    const deltaX = e.clientX - drag.startX;
    const deltaY = e.clientY - drag.startY;
    const duration = Date.now() - drag.startTime;
    const dragDistance = Math.hypot(deltaX, deltaY);

    drag.isDragging = false;
    drag.pointerId = -1;
    drag.hasCaptured = false;
    setIsDraggingScene(false);

    const minX = sceneConstraints.left;
    const maxX = sceneConstraints.right;
    const minY = sceneConstraints.top;
    const maxY = sceneConstraints.bottom;
    let finalX = sceneX.get();
    let finalY = sceneY.get();
    if (finalX < minX) {
      finalX = minX;
    } else if (finalX > maxX) {
      finalX = maxX;
    }
    if (finalY < minY) {
      finalY = minY;
    } else if (finalY > maxY) {
      finalY = maxY;
    }

    sceneX.set(finalX);
    sceneY.set(finalY);

    if (dragDistance > 8 || duration > 300) {
      isDraggingSceneGlobalRef.current = true;
      setTimeout(() => {
        isDraggingSceneGlobalRef.current = false;
      }, 50);
    } else {
      isDraggingSceneGlobalRef.current = false;
    }
  };

  useEffect(() => {
    if (activeTab === "town" && scene === "exterior") return;
    townPinchRef.current.pointers.clear();
    townPinchRef.current.isPinching = false;
    townPinchRef.current.startDistance = 0;
  }, [activeTab, scene]);

  const [isInitializing, setIsInitializing] = useState(true);
  const [hasLoadedInitialProgress, setHasLoadedInitialProgress] = useState(false);

  const getPreludeLine = useCallback(
    (lineId: string) => {
      const config = preludeTutorialConfig as {
        audioRoot: string;
        lines: Record<
          string,
          {
            text?: string;
            textTemplate?: string;
            audio?: string;
            role?: SpeechRole;
          }
        >;
      };
      const line = config.lines[lineId] || {};
      const rawText = line.textTemplate || line.text || "";
      return {
        text: rawText.replace(/\{playerName\}/g, preludePlayerName),
        role: line.role || "female",
        audioSrc: line.audio ? `${config.audioRoot}/${line.audio}` : undefined,
      };
    },
    [preludePlayerName],
  );

	  const playPreludeLines = useCallback(
	    async (lineIds: string[]) => {
	      const runId = preludeAudioRunRef.current + 1;
	      preludeAudioRunRef.current = runId;
	      setPreludeVisibleLineIds([]);
	      setPreludeSkippedLineIds([]);
	      setPreludeCurrentLineId(null);
	      preludeSkipResolveRef.current = null;

	      if (lineIds.length === 0) {
	        await stopSpeech();
	        return;
	      }

	      for (const lineId of lineIds) {
	        if (preludeAudioRunRef.current !== runId) return;
	        let wasSkipped = false;
		        setPreludeVisibleLineIds((prev) =>
		          prev.includes(lineId) ? prev : [...prev, lineId],
		        );
		        setPreludeCurrentLineId(lineId);
            if (PRELUDE_QUESTION_PROMPT_LINE_IDS.has(lineId)) {
              playQuestionAppearSound();
            } else {
              playDialogueAppearSound();
            }
		        const line = getPreludeLine(lineId);
	        const skipPromise = new Promise<void>((resolve) => {
	          preludeSkipResolveRef.current = () => {
	            wasSkipped = true;
	            resolve();
	          };
	        });
	        const speechPromise = speakText(line.text, {
	          role: line.role,
	          audioSrc: line.audioSrc,
	        }).then(() => undefined);
	        await Promise.race([speechPromise, skipPromise]);
	        if (preludeAudioRunRef.current !== runId) return;
	        if (preludeSkipResolveRef.current) {
	          preludeSkipResolveRef.current = null;
	        }
	        setPreludeCurrentLineId((current) =>
	          current === lineId ? null : current,
	        );
        if (lineId === "guard_q2_correct") {
          setPreludeRouteImageUnlocked(true);
        }
	        if (!wasSkipped) {
	          await new Promise((resolve) => window.setTimeout(resolve, 220));
	        }
	      }
	      if (preludeAudioRunRef.current === runId) {
	        setPreludeCurrentLineId(null);
	      }
	    },
	    [getPreludeLine],
	  );

  const applyRemoteProgress = useCallback((data: any, fallbackUserId?: string) => {
    if (!data || Object.keys(data).length === 0) return;

    if (data.quizIndex !== undefined) {
      setQuizIndex(data.quizIndex);
      lastQuizIndexRef.current = data.quizIndex;
      setLastAnimatedLessonId(data.quizIndex);
    }
    if (data.stamina !== undefined) {
      const today = getLocalDayKey();
      if (data.lastStaminaRefreshDate && data.lastStaminaRefreshDate !== today) {
        setStamina(MAX_STAMINA);
        setLastStaminaRefreshDate(today);
      } else {
        setStamina(Math.max(0, Math.min(MAX_STAMINA, Number(data.stamina) || 0)));
        if (data.lastStaminaRefreshDate) {
          setLastStaminaRefreshDate(data.lastStaminaRefreshDate);
        }
      }
    }
    if (data.correctAnswerStreak !== undefined) {
      setCorrectAnswerStreak(Math.max(0, Number(data.correctAnswerStreak) || 0));
    }
    if (data.streakDays !== undefined) {
      setStreakDays(Math.max(0, Number(data.streakDays) || 0));
    }
    if (data.lastStreakDate !== undefined) {
      setLastStreakDate(data.lastStreakDate || null);
    }
    if (data.lastLessonStreakPanelDate !== undefined) {
      const value = data.lastLessonStreakPanelDate || null;
      setLastLessonStreakPanelDate(value);
      try {
        if (value) {
          localStorage.setItem(LESSON_STREAK_PANEL_DATE_STORAGE_KEY, value);
        } else {
          localStorage.removeItem(LESSON_STREAK_PANEL_DATE_STORAGE_KEY);
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (data.selectedLang) setSelectedLang(data.selectedLang);
    if (data.townEventStep !== undefined) setTownEventStep(data.townEventStep);
    if (data.diamonds !== undefined) setDiamonds(data.diamonds);
    if (
      data.onboardingStep !== undefined ||
      data.openingFlowComplete !== undefined ||
      data.hasSeenHomeIntro !== undefined ||
      data.hasSeenPreludeTutorial !== undefined ||
      data.hasSeenFrameworkGuide !== undefined
    ) {
      const remoteOnboardingStep =
        data.onboardingStep !== undefined
          ? Math.max(1, Number(data.onboardingStep) || 1)
          : undefined;
      const remotePreludeVersion = Number(data.preludeTutorialVersion || 0);
      const shouldTreatOpeningComplete =
        getStoredOpeningFlowComplete() ||
        Boolean(data.openingFlowComplete) ||
        Boolean(data.hasSeenHomeIntro) ||
        Boolean(data.hasSeenFrameworkGuide) ||
        (remotePreludeVersion >= PRELUDE_TUTORIAL_VERSION &&
          Boolean(data.hasSeenPreludeTutorial)) ||
        (remoteOnboardingStep ?? 1) >= 12;

      if (shouldTreatOpeningComplete) {
        setHasCompletedOpeningFlow(true);
        persistOpeningFlowComplete();
        if (remoteOnboardingStep !== undefined) {
          setOnboardingStep(Math.max(12, remoteOnboardingStep));
        }
      } else if (remoteOnboardingStep !== undefined) {
        setOnboardingStep(remoteOnboardingStep);
      }
    }
    if (data.dismissedCardPhase !== undefined) setDismissedCardPhase(data.dismissedCardPhase);
    if (data.scene !== undefined) {
      setScene(data.scene === "interior" ? "exterior" : data.scene);
    }
    if (data.furniture) setFurniture(data.furniture);
    if (data.isRestaurantUnlocked !== undefined) setIsRestaurantUnlocked(data.isRestaurantUnlocked);
    if (data.preOnboardingName !== undefined) {
      setPreOnboardingName(normalizePlayerId(data.preOnboardingName));
    } else if (fallbackUserId) {
      setPreOnboardingName(fallbackUserId);
    }
    if (data.preOnboardingDialogueStep !== undefined) {
      setPreOnboardingDialogueStep(data.preOnboardingDialogueStep);
    }
    if (Array.isArray(data.userMistakes)) setUserMistakes(data.userMistakes);
	    if (data.reviewWordMeta && typeof data.reviewWordMeta === "object") {
	      setReviewWordMeta(data.reviewWordMeta);
	    }
	    if (Array.isArray(data.reviewRounds)) setReviewRounds(data.reviewRounds);
    if (data.lastReviewStaminaRewardDate !== undefined) {
      const value = data.lastReviewStaminaRewardDate || "";
      setLastReviewStaminaRewardDate(value);
      lastReviewStaminaRewardDateRef.current = value;
      try {
        if (value) {
          localStorage.setItem(REVIEW_STAMINA_REWARD_DATE_STORAGE_KEY, value);
        } else {
          localStorage.removeItem(REVIEW_STAMINA_REWARD_DATE_STORAGE_KEY);
        }
      } catch (e) {
        console.error(e);
      }
    }
	    if (Array.isArray(data.earlyUnlockedTownBuildingIds)) {
      const remoteIds = data.earlyUnlockedTownBuildingIds
        .map((item: unknown) => Number(item))
        .filter((item: number) => Number.isFinite(item) && item > 1);
      setExtraUnlockedBuildingIds((current) =>
        Array.from(new Set([...current, ...remoteIds])).sort((a, b) => a - b),
      );
    }
    if (
      data.townDecorationUnlockOrderOverrides &&
      typeof data.townDecorationUnlockOrderOverrides === "object" &&
      !Array.isArray(data.townDecorationUnlockOrderOverrides)
    ) {
      setTownDecorationUnlockOrderOverrides((current) => ({
        ...current,
        ...Object.entries(data.townDecorationUnlockOrderOverrides).reduce(
          (lookup, [buildingId, ids]) => {
            if (!Array.isArray(ids)) return lookup;
            lookup[buildingId] = ids.map((id) => String(id)).filter(Boolean);
            return lookup;
          },
          {} as Record<string, string[]>,
        ),
      }));
    }
    if (Array.isArray(data.manualUnlockedTownDecorationIds)) {
      const remoteIds = data.manualUnlockedTownDecorationIds
        .map((id: unknown) => String(id))
        .filter(Boolean);
      setManualUnlockedTownDecorationIds((current) =>
        Array.from(new Set([...current, ...remoteIds])),
      );
    }
    if (data.hasSeenHomeIntro !== undefined) {
      setHasSeenHomeIntro((prev) => prev || Boolean(data.hasSeenHomeIntro));
    }
	    if (data.hasSeenPreludeTutorial !== undefined) {
      const remotePreludeVersion = Number(data.preludeTutorialVersion || 0);
	      setHasSeenPreludeTutorial(
	        (prev) =>
          prev ||
          (remotePreludeVersion >= PRELUDE_TUTORIAL_VERSION &&
            Boolean(data.hasSeenPreludeTutorial)),
	      );
	    }
	    if (data.hasSeenFrameworkGuide !== undefined) {
	      setHasSeenFrameworkGuide(
	        (prev) => prev || Boolean(data.hasSeenFrameworkGuide),
	      );
	    }
	  }, []);

  useEffect(() => {
    const uid = appUserId;
    if (!uid) {
      try {
        const legacyUid = localStorage.getItem("app_user_id");
        if (legacyUid && !PLAYER_ID_PATTERN.test(legacyUid.trim().toUpperCase())) {
          localStorage.removeItem("app_user_id");
        }
      } catch (e) {
        console.error(e);
      }
      setIsInitializing(false);
      return;
    }

    fetch(getApiUrl("/api/progress/" + uid))
      .then(res => res.json())
      .then(data => {
        applyRemoteProgress(data, uid);
        setIsInitializing(false);
      })
      .catch(err => {
        console.error("Failed to load progress", err);
        setIsInitializing(false);
      });
  }, []);

  useEffect(() => {
    if (!isInitializing) {
      setHasLoadedInitialProgress(true);
    }
  }, [isInitializing]);

  useEffect(() => {
    if (!hasLoadedInitialProgress || !isReturningOpeningLaunch) return;

    const timer = window.setTimeout(() => {
      setShouldShowHomeIntroThisSession(false);
      changeOnboardingStepNow(12);
    }, 850);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    changeOnboardingStepNow,
    hasLoadedInitialProgress,
    isReturningOpeningLaunch,
  ]);

  useEffect(() => {
    if (
      hasLoadedInitialProgress &&
      onboardingStep >= 12 &&
      activeTab === "town" &&
      scene === "exterior" &&
      !showQuiz &&
      !hasSeenPreludeTutorial &&
      !showPreludeVictory &&
      !isMergedPreludeComplete &&
      preludeStage === "hidden"
    ) {
      setShowLevelConfirm(false);
      setShowTopCard(false);
      setShowGuideArrow(false);
      setPreludeStage("welcome");
    }
  }, [
    activeTab,
    hasLoadedInitialProgress,
    hasSeenPreludeTutorial,
    isMergedPreludeComplete,
    onboardingStep,
    preludeStage,
    scene,
    showPreludeVictory,
    showQuiz,
  ]);

  useEffect(() => {
    const isPreludeQuestionStage =
      preludeStage === "q1" ||
      preludeStage === "q2" ||
      preludeStage === "q3" ||
      preludeStage === "q4";

    if (!isPreludeQuestionStage) {
      if (preludeStage === "hidden") {
        lastPreludeQuestionHapticRef.current = null;
      }
      return;
    }

    if (lastPreludeQuestionHapticRef.current === preludeStage) return;
    lastPreludeQuestionHapticRef.current = preludeStage;
    hapticFeedback.light?.();
  }, [preludeStage]);

	  useEffect(() => {
		    if (!isPreludeActive) {
		      preludeAudioRunRef.current += 1;
		      setPreludeVisibleLineIds([]);
		      setPreludeSkippedLineIds([]);
		      setPreludeCurrentLineId(null);
          setPreludeRouteImageUnlocked(false);
		      preludeSkipResolveRef.current = null;
		      void stopSpeech();
	      return;
	    }

    let lineIds: string[] = [];
    if (preludeStage === "welcome") lineIds = ["welcome"];
    if (preludeStage === "inside_intro") {
      lineIds = ["lost", "guard_hi", "attention"];
    }
    if (preludeStage === "q1") {
      lineIds = preludeQ1FeedbackLine
        ? [preludeQ1FeedbackLine]
        : ["q1_prompt"];
    }
    if (preludeStage === "q1_correct") {
      lineIds = ["q1_correct", "guard_q1_correct"];
    }
    if (preludeStage === "q2_intro") {
      lineIds = ["guard_wait", "where_intro"];
    }
    if (preludeStage === "q2") {
      lineIds = preludeQ2FeedbackLine
        ? [preludeQ2FeedbackLine]
        : ["q2_prompt"];
    }
    if (preludeStage === "q2_guard") {
      lineIds =
        preludeQ2Choice === "a"
          ? ["q2_correct", "guard_q2_correct"]
          : ["guard_q2_correct"];
    }
    if (preludeStage === "route_intro") {
      lineIds = ["guard_route", "route_check"];
    }
    if (preludeStage === "q3") {
      lineIds = ["guard_turn_left", "turn_left_prompt"];
    }
    if (preludeStage === "q3_correct") {
      lineIds = ["q3_correct"];
    }
    if (preludeStage === "q4") {
      lineIds = ["guard_hallway", "thank_prompt", "q4_prompt"];
    }
    if (preludeStage === "q4_correct") {
      lineIds = ["q4_correct", "guard_welcome", "almost_home"];
    }

    void playPreludeLines(lineIds);
	    return () => {
	      preludeAudioRunRef.current += 1;
	      preludeSkipResolveRef.current = null;
	    };
	  }, [
    isPreludeActive,
    playPreludeLines,
    preludeQ1FeedbackLine,
    preludeQ2Choice,
    preludeQ2FeedbackLine,
    preludeStage,
  ]);

  useEffect(() => {
    if (!isPreludeActive) return;

    const shouldBringPreludeButtonIntoView =
      (preludeStage === "q1_correct" &&
        preludeVisibleLineIds.includes("q1_correct")) ||
      (preludeStage === "q2" &&
        preludeQ2FeedbackLine !== null &&
        preludeVisibleLineIds.includes(preludeQ2FeedbackLine)) ||
      (preludeStage === "q2_guard" &&
        (preludeVisibleLineIds.includes("q2_correct") ||
          preludeVisibleLineIds.includes("guard_q2_correct"))) ||
      (preludeStage === "q3_correct" &&
        preludeVisibleLineIds.includes("q3_correct")) ||
      (preludeStage === "q4_correct" &&
        preludeVisibleLineIds.includes("q4_correct"));

    if (!shouldBringPreludeButtonIntoView) return;

    const panel = preludeActionPanelRef.current;
    if (!panel) return;

    let followUpTimer: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
      followUpTimer = window.setTimeout(() => {
        panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" });
      }, 180);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (followUpTimer !== null) {
        window.clearTimeout(followUpTimer);
      }
    };
  }, [
    isPreludeActive,
    preludeQ2FeedbackLine,
    preludeStage,
    preludeVisibleLineIds,
  ]);

  useEffect(() => {
    if (hasLoadedInitialProgress) {
      if (appUserId) {
        fetch(getApiUrl("/api/progress/" + appUserId), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            playerId: appUserId,
            quizIndex,
            townEventStep,
            diamonds,
            stamina,
            lastStaminaRefreshDate,
            correctAnswerStreak,
            streakDays,
            lastStreakDate,
            lastLessonStreakPanelDate,
            selectedLang,
            onboardingStep,
            dismissedCardPhase,
            scene,
            furniture,
            isRestaurantUnlocked,
            preOnboardingName: appUserId,
            preOnboardingDialogueStep,
	            userMistakes,
		            reviewWordMeta,
		            reviewRounds,
	            lastReviewStaminaRewardDate,
		            earlyUnlockedTownBuildingIds: extraUnlockedBuildingIds,
	            townDecorationUnlockOrderOverrides,
	            manualUnlockedTownDecorationIds,
	            hasSeenHomeIntro,
	            openingFlowComplete: hasCompletedOpeningFlow,
	            hasSeenPreludeTutorial,
            preludeTutorialVersion: hasSeenPreludeTutorial
              ? PRELUDE_TUTORIAL_VERSION
              : 0,
	            hasSeenFrameworkGuide,
	          })
	        }).catch(err => console.error("Failed to save progress", err));
	      }
	    }
		  }, [appUserId, quizIndex, townEventStep, diamonds, stamina, lastStaminaRefreshDate, correctAnswerStreak, streakDays, lastStreakDate, lastLessonStreakPanelDate, selectedLang, onboardingStep, dismissedCardPhase, scene, furniture, isRestaurantUnlocked, preOnboardingDialogueStep, userMistakes, reviewWordMeta, reviewRounds, lastReviewStaminaRewardDate, extraUnlockedBuildingIds, townDecorationUnlockOrderOverrides, manualUnlockedTownDecorationIds, hasSeenHomeIntro, hasCompletedOpeningFlow, hasSeenPreludeTutorial, hasSeenFrameworkGuide, hasLoadedInitialProgress]);

	  useEffect(() => {
	    const updateSize = () => {
	      const rect = appRootRef.current?.getBoundingClientRect();
	      const newWidth =
	        rect?.width || Math.min(window.innerWidth, PHONE_FRAME_MAX_WIDTH);
	      const newHeight =
	        rect?.height ||
	        newWidth * (PHONE_FRAME_ASPECT_HEIGHT / PHONE_FRAME_ASPECT_WIDTH);
	      setContainerWidth(newWidth);
	      setContainerHeight(newHeight);
	    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const sceneConstraints = useMemo(() => {
    const activeSceneWidth =
      scene === "exterior" ? exteriorSceneSize : DEFAULT_SCENE_WIDTH;
    const activeSceneHeight =
      scene === "exterior" ? exteriorSceneSize : containerHeight;
    const activeZoom = scene === "exterior" ? townCameraZoom : 1;
    const limitX = Math.max(
      0,
      (activeSceneWidth * activeZoom) / 2 - containerWidth / 2,
    );
    const limitY = Math.max(
      0,
      (activeSceneHeight * activeZoom) / 2 - containerHeight / 2,
    );
    return { left: -limitX, right: limitX, top: -limitY, bottom: limitY };
  }, [
    containerHeight,
    containerWidth,
    exteriorSceneSize,
    scene,
    townCameraZoom,
  ]);

  useEffect(() => {
    if (activeTab !== "town") return;
    const currentX = sceneX.get();
    const currentY = sceneY.get();
    const nextX = Math.max(
      sceneConstraints.left,
      Math.min(sceneConstraints.right, currentX),
    );
    const nextY = Math.max(
      sceneConstraints.top,
      Math.min(sceneConstraints.bottom, currentY),
    );
    if (nextX !== currentX) sceneX.set(nextX);
    if (nextY !== currentY) sceneY.set(nextY);
  }, [
    activeTab,
    sceneConstraints.bottom,
    sceneConstraints.left,
    sceneConstraints.right,
    sceneConstraints.top,
    sceneX,
    sceneY,
  ]);

  // Smooth joystick scene panning
  useEffect(() => {
	    if (activeTab === "town") {
	      if (scene === "exterior") {
	        sceneX.set(0);
	        sceneY.set(0);
	      } else if (scene === "interior") {
	        sceneX.set(DEFAULT_SCENE_WIDTH / 2 - containerWidth / 2);
	        sceneY.set(0);
	      }
	    }
	  }, [
	    scene,
	    activeTab,
	    containerWidth,
	    sceneX,
	    sceneY,
	  ]);

  // 资源预加载
  useEffect(() => {
    const assets = [
      TOWN_BACKGROUND_IMAGE,
      BUILDING_RESIDENT_IMAGE,
      LOCKED_BUILDING_OVERLAY_IMAGE,
      "/assets/guanqia1bg.png",
      "/assets/cafeishineibeijing.png",
      HOME_BUILDING_IMAGE,
      "/assets/yugang1.png",
      "/assets/zhuozi1.png",
      "/assets/BunNPC.png",
      "/assets/buntouxiang.png",
      MIA_PORTRAIT_IMAGE,
      MIA_AVATAR_IMAGE,
      PRELUDE_GUARD_GREETING_IMAGE,
      PRELUDE_GUARD_POINTING_IMAGE,
      "/assets/cafeishineibeijing.png",
      "/assets/zairu.png",
      "/assets/qipao1.png",
      "/assets/qipao2.png",
      "/assets/start_low.png",
      "/assets/start_high.png",
      "/assets/renwudi.png",
      "/assets/renwu.png",
      "/assets/renwutishi.png",
      "/assets/youhappy.png",
      "/assets/youhappiness.png",
      "/assets/yousorrow.png",
      "/assets/youanger.png",
      "/assets/jackhappy.png",
      "/assets/jackhappiness.png",
      "/assets/jacksorrow.png",
      "/assets/jackanger.png",
      "/assets/MrsHendersonhappy.png",
      "/assets/MrsHendersonhappiness.png",
      "/assets/MrsHendersonsorrow.png",
      "/assets/MrsHendersonanger.png",
      "/assets/dingbuiconpng.png",
      "/assets/fanhui.png",
      "/assets/renwuguanbi.png",
      "/assets/renwuanniu.png",
      "/assets/renwudiban.png",
      "/assets/pojiuhome.png",
      "/assets/buntouxiang.png",
      "/assets/yindao.png",
      "/assets/tiaoguo.png",
      "/assets/datibg.png",
      "/assets/npc.png",
      "/assets/car.png",
      "/assets/xiexin.png",
      "/assets/xinxiangzhuzi.png",
      "/assets/tanhao.png",
      "/assets/laonainaiqueren.png",
      "/assets/423anniu.png",
      "/assets/lianshengjiemian.png",
      "/assets/jianzhushengj.png",
      "/assets/1renwukapian.png",
      "/assets/shafajiangli.png",
      "/assets/shafa1.png",
    ];
    assets.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // 体力每天 0 点刷新到 25。
  useEffect(() => {
    const refreshDailyStamina = () => {
      const today = getLocalDayKey();
      if (lastStaminaRefreshDate !== today) {
        setStamina(MAX_STAMINA);
        setLastStaminaRefreshDate(today);
        setCorrectAnswerStreak(0);
      }
      setTownGarbageDailyReward((current) => {
        if (current.date === today) return current;
        const next = { date: today, count: 0 };
        townGarbageLoadedRef.current = false;
        try {
          localStorage.setItem(
            TOWN_GARBAGE_DAILY_REWARD_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch (e) {
          console.error(e);
        }
        return next;
      });
    };

    refreshDailyStamina();
    const recoveryInterval = window.setInterval(refreshDailyStamina, 60 * 1000);
    return () => window.clearInterval(recoveryInterval);
  }, [lastStaminaRefreshDate]);

  // 胜利界面钻石飞出逻辑
  useEffect(() => {
    let flyTimer: NodeJS.Timeout;
    let hitTimer: NodeJS.Timeout;

    if (showVictory) {
      flyTimer = setTimeout(() => {
        setIsDiamondFlying(true);
        // 飞行持续 0.8s，结束后更新数量
        hitTimer = setTimeout(() => {
          setDiamonds((prev) => prev + 1);
        }, 800);
      }, 800);
    } else {
      setIsDiamondFlying(false);
    }

    return () => {
      clearTimeout(flyTimer);
      clearTimeout(hitTimer);
    };
  }, [showVictory]);

  const showMessage = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const rememberTestPlayerId = useCallback((rawId: string | null | undefined) => {
    const playerId = String(rawId || "").trim().toUpperCase();
    if (!PLAYER_ID_PATTERN.test(playerId)) return;

    setKnownPlayerIds((current) => {
      const next = normalizeStoredPlayerIds([playerId, ...current]);
      saveStoredTestPlayerIds(next);
      return next;
    });
  }, []);

  useEffect(() => {
    rememberTestPlayerId(appUserId);
  }, [appUserId, rememberTestPlayerId]);

  const deleteTestPlayerId = useCallback(
    async (rawId: string) => {
      const playerId = normalizePlayerId(rawId);
      if (!PLAYER_ID_PATTERN.test(playerId)) return;

      setDeletingPlayerId(playerId);
      try {
        const resp = await fetch(getApiUrl(`/api/users/${playerId}`), {
          method: "DELETE",
        });
        if (!resp.ok) throw new Error("delete_failed");

        const nextIds = knownPlayerIds.filter((id) => id !== playerId);
        setKnownPlayerIds(nextIds);
        saveStoredTestPlayerIds(nextIds);
        setDeletePlayerIdPrompt(null);

        if (appUserId === playerId) {
          clearLocalPlayerSessionStorage();
          showMessage(`ID ${playerId} 已删除，正在重启`);
          window.setTimeout(() => window.location.reload(), 650);
          return;
        }

        showMessage(`已删除 ID ${playerId}`);
      } catch (err) {
        console.error("Failed to delete player ID", err);
        showMessage("删除失败，请稍后再试");
      } finally {
        setDeletingPlayerId(null);
      }
    },
    [appUserId, knownPlayerIds],
  );

  useEffect(() => {
    const controller = createTownBgmController();
    townBgmRef.current = controller;

    const unlockTownBgm = () => controller.unlock();
    window.addEventListener("pointerdown", unlockTownBgm, { passive: true });
    window.addEventListener("keydown", unlockTownBgm);

    return () => {
      window.removeEventListener("pointerdown", unlockTownBgm);
      window.removeEventListener("keydown", unlockTownBgm);
      controller.cleanup();
      townBgmRef.current = null;
    };
  }, []);

  const shouldPlayTownBgm =
    isAppVisible &&
    activeTab === "town" &&
    scene === "exterior" &&
    onboardingStep >= 12 &&
    !isInitializing &&
    !showQuiz &&
    !isPreludeActive &&
    !showVictory &&
    !showVictoryMsg &&
    !showPreludeVictory &&
    !showWinStreak &&
    !showStreakPanel &&
    !showReview &&
    !showStaminaRecoveryPrompt &&
    !showReferenceGrid &&
    !showDialogueFlow &&
    !frameworkGuidePanoramaIntro &&
    frameworkGuideStep === 0 &&
    miaDecorGuideStep === 0;

  useEffect(() => {
    townBgmRef.current?.setActive(shouldPlayTownBgm);
  }, [shouldPlayTownBgm]);

  const openTownGarbageChallenge = useCallback(
	    (item: TownGarbageItem) => {
	      if (
          hasReachedTownGarbageDailyLimit ||
	        showReferenceGrid ||
	        showQuiz ||
	        isPreludeActive ||
        townDecorUnlockAnimation ||
        townDecorRewardReveal
      ) {
        return;
      }

      const challenge = getTownGarbageChallenge(item.challengeId);
      hapticFeedback.light?.();
      setTownGarbagePrompt({
        key: Date.now(),
        garbageId: item.id,
        challenge,
        available: createGarbageLetterTiles(challenge.word),
        selected: [],
        wrong: false,
      });
    },
	    [
      hasReachedTownGarbageDailyLimit,
	      isPreludeActive,
	      showQuiz,
      showReferenceGrid,
      townDecorRewardReveal,
      townDecorUnlockAnimation,
    ],
  );

  const openStaminaRecoveryPrompt = useCallback(() => {
    hapticFeedback.light?.();
    setShowStaminaRecoveryPrompt(true);
  }, []);

  const closeMainTownPopupsForRecovery = useCallback(() => {
    setShowStaminaRecoveryPrompt(false);
    setShowLevelConfirm(false);
    setShowTasks(false);
    setSelectedLesson(null);
    setLockedBuildingPrompt(null);
    setEarlyUnlockConfirmBuilding(null);
    setTargetDecorationPrompt(null);
    setShowSceneModal(false);
    setShowDialogueFlow(false);
  }, []);

  const jumpToTownGarbageFromRecovery = useCallback(() => {
    if (!hasCompletedUnit1) {
      showMessage("通过 Unit 1 后解锁垃圾清理");
      hapticFeedback.light?.();
      return;
    }

    if (hasReachedTownGarbageDailyLimit) {
      showMessage("今日捡垃圾体力已领完");
      hapticFeedback.light?.();
      return;
    }

    const availableItems =
      townGarbageItems.length > 0
        ? townGarbageItems
        : createTownGarbageItems(townEditorBuildingPositions);
    const targetItem = availableItems[0];
    if (!targetItem) {
      showMessage("暂时没有可清理的垃圾");
      hapticFeedback.light?.();
      return;
    }

    if (townGarbageItems.length === 0) {
      setTownGarbageItems(availableItems);
      try {
        localStorage.setItem(
          TOWN_GARBAGE_STORAGE_KEY,
          JSON.stringify(availableItems),
        );
      } catch (e) {
        console.error(e);
      }
    }

    closeMainTownPopupsForRecovery();
    setActiveTab("town");
    setScene("exterior");
    window.setTimeout(() => openTownGarbageChallenge(targetItem), 120);
  }, [
    closeMainTownPopupsForRecovery,
    hasCompletedUnit1,
    hasReachedTownGarbageDailyLimit,
    openTownGarbageChallenge,
    townEditorBuildingPositions,
    townGarbageItems,
  ]);

  const jumpToReviewFromRecovery = useCallback(() => {
    closeMainTownPopupsForRecovery();
    setActiveTab("town");
    setScene("exterior");
    setShowReview(true);
  }, [closeMainTownPopupsForRecovery]);

  const selectGarbageLetter = useCallback((tileId: string) => {
    setTownGarbagePrompt((current) => {
      if (!current) return current;
      const tile = current.available.find((item) => item.id === tileId);
      if (!tile) return current;
      return {
        ...current,
        available: current.available.filter((item) => item.id !== tileId),
        selected: [...current.selected, tile],
        wrong: false,
      };
    });
  }, []);

  const returnGarbageLetter = useCallback((tileId: string) => {
    setTownGarbagePrompt((current) => {
      if (!current) return current;
      const tile = current.selected.find((item) => item.id === tileId);
      if (!tile) return current;
      return {
        ...current,
        available: [...current.available, tile],
        selected: current.selected.filter((item) => item.id !== tileId),
        wrong: false,
      };
    });
  }, []);

  const resetGarbageLetters = useCallback(() => {
    setTownGarbagePrompt((current) => {
      if (!current) return current;
      return {
        ...current,
        available: createGarbageLetterTiles(current.challenge.word),
        selected: [],
        wrong: false,
      };
    });
  }, []);

	  const completeTownGarbageChallenge = useCallback(() => {
	    const prompt = townGarbagePrompt;
	    if (!prompt) return;
      if (hasReachedTownGarbageDailyLimit) {
        setTownGarbagePrompt(null);
        setTownGarbageItems([]);
        return;
      }

	    const answer = prompt.selected.map((tile) => tile.char).join("");
	    const target = prompt.challenge.word.toUpperCase();
    if (answer !== target) {
      hapticFeedback.error?.();
      setTownGarbagePrompt((current) =>
        current?.key === prompt.key ? { ...current, wrong: true } : current,
      );
      return;
    }

    const garbageItem = townGarbageItems.find(
      (item) => item.id === prompt.garbageId,
    );
    hapticFeedback.clean?.();
    setTownGarbagePrompt(null);

	    if (!garbageItem) return;

      const today = getLocalDayKey();
      const nextDailyRewardCount = Math.min(
        TOWN_GARBAGE_DAILY_REWARD_LIMIT,
        todayTownGarbageRewardCount + 1,
      );
      const hasJustReachedDailyLimit =
        nextDailyRewardCount >= TOWN_GARBAGE_DAILY_REWARD_LIMIT;
      const nextDailyReward = {
        date: today,
        count: nextDailyRewardCount,
      };
      setTownGarbageDailyReward(nextDailyReward);
      try {
        localStorage.setItem(
          TOWN_GARBAGE_DAILY_REWARD_STORAGE_KEY,
          JSON.stringify(nextDailyReward),
        );
      } catch (e) {
        console.error(e);
      }

	    setTownGarbageItems((current) => {
	      const nextItems = hasJustReachedDailyLimit
          ? []
          : current.filter((item) => item.id !== garbageItem.id);
	      try {
	        localStorage.setItem(
	          TOWN_GARBAGE_STORAGE_KEY,
          JSON.stringify(nextItems),
        );
      } catch (e) {
        console.error(e);
      }
      return nextItems;
    });

    const key = Date.now();
    setTownGarbageSmoke({
      key,
      x: garbageItem.x,
      y: garbageItem.y,
    });
    if (townGarbageSmokeTimerRef.current !== null) {
      window.clearTimeout(townGarbageSmokeTimerRef.current);
    }
    townGarbageSmokeTimerRef.current = window.setTimeout(() => {
      setTownGarbageSmoke((current) => (current?.key === key ? null : current));
      townGarbageSmokeTimerRef.current = null;
    }, 1350);

	    setTownGarbageTip({
	      key,
	      text: hasJustReachedDailyLimit
          ? "清理垃圾获得 1 点体力，今日垃圾已清理完"
          : "清理垃圾获得 1 点体力",
	    });
    if (townGarbageTipTimerRef.current !== null) {
      window.clearTimeout(townGarbageTipTimerRef.current);
    }
    townGarbageTipTimerRef.current = window.setTimeout(() => {
      setTownGarbageTip((current) => (current?.key === key ? null : current));
      townGarbageTipTimerRef.current = null;
    }, 1850);

    const appRect = appRootRef.current?.getBoundingClientRect();
    const targetRect = staminaPillRef.current?.getBoundingClientRect();
    if (appRect) {
      const startX = appRect.width / 2;
      const startY = appRect.height * 0.52;
      const endX = targetRect
        ? targetRect.left - appRect.left + targetRect.width / 2
        : appRect.width - 54;
      const endY = targetRect
        ? targetRect.top - appRect.top + targetRect.height / 2
        : 70;

      setTownGarbageEnergyFlight({
        key,
        startX,
        startY,
        endX,
        endY,
      });

      if (townGarbageEnergyTimerRef.current !== null) {
        window.clearTimeout(townGarbageEnergyTimerRef.current);
      }
      townGarbageEnergyTimerRef.current = window.setTimeout(() => {
        setTownGarbageEnergyFlight((current) =>
          current?.key === key ? null : current,
        );
        townGarbageEnergyTimerRef.current = null;
      }, 1250);
    }

    if (townGarbageStaminaTimerRef.current !== null) {
      window.clearTimeout(townGarbageStaminaTimerRef.current);
    }
    townGarbageStaminaTimerRef.current = window.setTimeout(() => {
      setStamina((current) => current + 1);
      hapticFeedback.success?.();
      townGarbageStaminaTimerRef.current = null;
    }, 760);
	  }, [
    hasReachedTownGarbageDailyLimit,
    todayTownGarbageRewardCount,
    townGarbageItems,
    townGarbagePrompt,
  ]);

  const startQuizIfEnoughStamina = useCallback((ignoreTransitionLock = false) => {
    if (
      !ignoreTransitionLock &&
      (levelTransitionInputLockRef.current || levelCurtain || isTransitioning)
    ) {
      return false;
    }
    if (stamina <= 0) {
      openStaminaRecoveryPrompt();
      return false;
    }
    playLevelCurtain("enter", () => {
      setShowQuiz(true);
      setIsVideoMutedForQuestion(false);
    });
    return true;
  }, [
    isTransitioning,
    levelCurtain,
    openStaminaRecoveryPrompt,
    playLevelCurtain,
    stamina,
  ]);

  const playStartCtaVoice = useCallback((kind: "start" | "startLearning") => {
    const text = kind === "start" ? "Start" : "Learning";
    const audioSrc =
      kind === "start" ? "/audio/ui/start.mp3" : "/audio/ui/learning.mp3";
    void speakText(text, {
      role: "question",
      lang: "en-US",
      audioSrc,
    }).catch((error) => console.error(error));
  }, []);

  const startQuizFromConfirmWithVoice = useCallback(() => {
    if (levelTransitionInputLockRef.current || levelCurtain || isTransitioning) {
      return;
    }
    lockLevelTransitionInput(1860);
    playStartCtaVoice("startLearning");
    setShowLevelConfirm(false);
    setShowTasks(false);
    window.setTimeout(() => {
      startQuizIfEnoughStamina(true);
    }, 360);
  }, [
    isTransitioning,
    levelCurtain,
    lockLevelTransitionInput,
    playStartCtaVoice,
    startQuizIfEnoughStamina,
  ]);

  const openLockedBuildingPrompt = (building: TownEditorBuildingAsset) => {
    hapticFeedback.light?.();
    setLockedBuildingPrompt(building);
    setEarlyUnlockConfirmBuilding(null);
  };

  const startEarlyUnlockQuiz = (building: TownEditorBuildingAsset) => {
    if (levelTransitionInputLockRef.current || levelCurtain || isTransitioning) {
      return;
    }
    if (stamina <= 0) {
      openStaminaRecoveryPrompt();
      return;
    }

    hapticFeedback.success?.();
    setLockedBuildingPrompt(null);
    setEarlyUnlockConfirmBuilding(null);
    setEarlyUnlockBuildingId(building.id);
    playLevelCurtain("enter", () => {
      setShowQuiz(true);
      setIsVideoMutedForQuestion(false);
    });
  };

  const moveTownDecorationToNextUnlockSlot = useCallback(
    (target: PendingDirectTownDecorUnlock) => {
      const building = TOWN_EDITOR_BUILDINGS.find(
        (item) => item.id === target.buildingId,
      );
      if (!building) return;

      const { unlockedDecorationSteps } = getTownBuildingUnlockState(building);
      const manualIds = new Set(manualUnlockedTownDecorationIds);

      setTownDecorationUnlockOrderOverrides((current) => {
        const key = String(target.buildingId);
        const currentOrder = normalizeTownDecorationUnlockOrder(
          building,
          current[key],
        ).map((decoration) => decoration.id);
        const withoutTarget = currentOrder.filter(
          (id) => id !== target.decorationId,
        );
        const normalOrder = withoutTarget.filter((id) => !manualIds.has(id));
        const nextNormalDecorationId =
          normalOrder[Math.min(unlockedDecorationSteps, normalOrder.length)];
        const insertIndex = nextNormalDecorationId
          ? withoutTarget.indexOf(nextNormalDecorationId)
          : withoutTarget.length;
        const nextOrder = [...withoutTarget];
        nextOrder.splice(Math.max(0, insertIndex), 0, target.decorationId);

        return {
          ...current,
          [key]: nextOrder,
        };
      });
    },
    [getTownBuildingUnlockState, manualUnlockedTownDecorationIds],
  );

  const startTargetDecorationQuiz = (target: PendingDirectTownDecorUnlock) => {
    if (levelTransitionInputLockRef.current || levelCurtain || isTransitioning) {
      return;
    }
    if (stamina <= 0) {
      openStaminaRecoveryPrompt();
      return;
    }

    hapticFeedback.success?.();
    moveTownDecorationToNextUnlockSlot(target);
    setTargetDecorationPrompt(null);
    setTargetDecorationQuiz(target);
    playLevelCurtain("enter", () => {
      setShowQuiz(true);
      setIsVideoMutedForQuestion(false);
    });
  };

	  const handlePreludeWelcomeContinue = () => {
	    hapticFeedback.light?.();
      preludeFinishStartedRef.current = false;
      setIsMergedPreludeComplete(false);
      setPreludeRouteImageUnlocked(false);
      setPreludeQ1Choice(null);
      setPreludeQ1WrongChoices([]);
      setPreludeQ1FeedbackLine(null);
      setPreludeQ2Choice(null);
      setPreludeQ2WrongChoices([]);
      setPreludeQ2FeedbackLine(null);
      setPreludeDetailExpanded({ q1: false, q2: false });
	    preludeAudioRunRef.current += 1;
	    preludeSkipResolveRef.current = null;
	    setPreludeCurrentLineId(null);
	    void stopSpeech();
	    setPreludeStage("guide_house");
	    setShowTopCard(false);
	    setShowGuideArrow(false);
	  };

	  const skipCurrentPreludeLine = useCallback(() => {
	    if (!preludeCurrentLineId) return;
	    setPreludeSkippedLineIds((prev) =>
	      prev.includes(preludeCurrentLineId)
	        ? prev
	        : [...prev, preludeCurrentLineId],
	    );
	    void stopSpeech();
	    const resolveSkip = preludeSkipResolveRef.current;
	    preludeSkipResolveRef.current = null;
	    resolveSkip?.();
	  }, [preludeCurrentLineId]);

	  const handlePreludeInteriorTap = useCallback(
	    (e: React.MouseEvent<HTMLDivElement>) => {
	      const target = e.target as HTMLElement | null;
	      if (
	        target?.closest(
	          "button, input, textarea, select, a, [role='button']",
	        )
	      ) {
	        return;
	      }
	      skipCurrentPreludeLine();
	    },
	    [skipCurrentPreludeLine],
	  );

  const handlePreludeHouseTap = () => {
    if (levelTransitionInputLockRef.current || levelCurtain || isTransitioning) {
      return;
    }
    hapticFeedback.success?.();
    setShowLevelConfirm(false);
    setShowTasks(false);
    playLevelCurtain("enter", () => setPreludeStage("inside_intro"));
  };

  const recordPreludeLocationMistake = (choice: PreludeChoice) => {
    const picked = PRELUDE_Q2_OPTIONS.find((option) => option.id === choice);
    setUserMistakes((prev) => {
      if (
        prev.some(
          (mistake) =>
            mistake?.question_id === "PRELUDE_Q2_WHERE_IS_APARTMENT_4A",
        )
      ) {
        return prev;
      }

      return [
        ...prev,
        {
          question_id: "PRELUDE_Q2_WHERE_IS_APARTMENT_4A",
          instruction: "You want to ask where Apartment 4B is.",
          text: "Where is Apartment 4B?",
          sentence_en: "Where is Apartment 4B?",
          translation: "4B公寓在哪里？",
          review_word: "Where is",
          selected_answer: picked?.value || "",
          correct_answer: "Where is",
          scene_image: "/assets/qianzhitu.png",
          options: PRELUDE_Q2_OPTIONS.map((option) => ({
            text: option.value,
            is_correct: option.isCorrect,
          })),
          _lessonInfo: {
            lesson_id: 0,
            title: "Welcome to Apartment 4B",
            title_cn: "前置剧情",
            unit_id: "intro",
          },
        },
      ];
    });
  };

  const handlePreludeQ1Answer = (choice: PreludeChoice) => {
	    if (choice === "a") {
      hapticFeedback.success?.();
      setPreludeQ1Choice(choice);
      setPreludeQ1FeedbackLine(null);
      setPreludeDetailExpanded((prev) => ({ ...prev, q1: false }));
      setPreludeStage("q1_correct");
      return;
    }

    hapticFeedback.error?.();
    setPreludeQ1WrongChoices((prev) =>
      prev.includes(choice) ? prev : [...prev, choice],
    );
    setPreludeQ1FeedbackLine(
      choice === "b" ? "q1_wrong_goodbye" : "q1_wrong_goodnight",
    );
  };

	  const handlePreludeQ2Answer = (choice: PreludeChoice) => {
	    if (choice === "a") {
        setPreludeQ2Choice(choice);
        setPreludeQ2WrongChoices([]);
	      hapticFeedback.success?.();
	      setPreludeQ2FeedbackLine(null);
      setPreludeDetailExpanded((prev) => ({ ...prev, q2: false }));
      setPreludeStage("q2_guard");
      return;
    }

    hapticFeedback.error?.();
    recordPreludeLocationMistake(choice);
    setPreludeQ2WrongChoices((prev) =>
      prev.includes(choice) ? prev : [...prev, choice],
    );
    setPreludeQ2FeedbackLine(
	      choice === "b" ? "q2_wrong_what" : "q2_wrong_how",
	    );
	  };

  const continueMergedPreludeRoute = () => {
    setPreludeQ3Choice(null);
    setPreludeQ3WrongChoices([]);
    setPreludeQ4Choice(null);
    setPreludeQ4WrongChoices([]);
    setPreludeRouteImageUnlocked(true);
    setPreludeStage("route_intro");
  };

	  const handlePreludeQ3Answer = (choice: PreludeChoice) => {
	    setPreludeQ3Choice(choice);
    if (choice === "b") {
      hapticFeedback.success?.();
      setPreludeStage("q3_correct");
      return;
    }
    hapticFeedback.error?.();
    setPreludeQ3WrongChoices((prev) =>
      prev.includes(choice) ? prev : [...prev, choice],
    );
  };

  const handlePreludeQ4Answer = (choice: PreludeChoice) => {
    setPreludeQ4Choice(choice);
    if (choice === "a") {
      hapticFeedback.success?.();
      setPreludeStage("q4_correct");
      return;
    }
    hapticFeedback.error?.();
    setPreludeQ4WrongChoices((prev) =>
      prev.includes(choice) ? prev : [...prev, choice],
    );
  };

  const handlePreludeFinish = () => {
    if (preludeFinishStartedRef.current) return;
    preludeFinishStartedRef.current = true;
    hapticFeedback.reward?.();
    setIsMergedPreludeComplete(true);
    playTownLiftTransition(() => {
      setPreludeStage("hidden");
      setPreludeQ1WrongChoices([]);
      setPreludeQ1Choice(null);
      setPreludeQ1FeedbackLine(null);
      setPreludeQ2Choice(null);
      setPreludeQ2WrongChoices([]);
      setPreludeQ2FeedbackLine(null);
      setPreludeQ3Choice(null);
      setPreludeQ3WrongChoices([]);
      setPreludeQ4Choice(null);
      setPreludeQ4WrongChoices([]);
      setPreludeDetailExpanded({ q1: false, q2: false });
      setPreludeVisibleLineIds([]);
      setPreludeRouteImageUnlocked(false);
      setShowPreludeVictory(true);
    }, "Almost there! 4B");
  };

  const completePreludeVictory = () => {
    setShowPreludeVictory(false);
    setIsMergedPreludeComplete(false);
    setPreludeStage("hidden");
    setHasSeenHomeIntro(true);
    setHasSeenPreludeTutorial(true);
    setShouldShowHomeIntroThisSession(false);
    setIntroStep((prev) => Math.max(prev, 6));
    setTownEventStep(5);
    queueTownDecorUnlock(1);
    playTownLiftTransition(() => {
      setActiveTab("town");
      setScene("exterior");
      setShowTopCard(true);
    }, "Apartment 4B");
  };

  const confirmNewPlayerId = async () => {
    const playerId = normalizePlayerId(preOnboardingName);
    setPreOnboardingName(playerId);
    setNameInputError(null);

    if (!PLAYER_ID_PATTERN.test(playerId)) {
      setNameInputError("请输入 4 个英文字母作为你的 ID。");
      return;
    }

    try {
      setNameRegistrationStatus("checking");
      const checkResp = await fetch(getApiUrl(`/api/users/${playerId}`));
      if (!checkResp.ok) throw new Error("check_failed");

      const checkData = await checkResp.json();
      if (checkData.exists) {
        setExistingPlayerIdPrompt(playerId);
        return;
      }

      const registerResp = await fetch(getApiUrl("/api/users/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: playerId,
          initialProgress: {
            playerId,
            quizIndex,
            townEventStep,
            diamonds,
            stamina,
            lastStaminaRefreshDate,
            correctAnswerStreak,
            streakDays,
            lastStreakDate,
            lastLessonStreakPanelDate,
            selectedLang,
            onboardingStep,
            dismissedCardPhase,
            scene,
            furniture,
            isRestaurantUnlocked,
            preOnboardingName: playerId,
            preOnboardingDialogueStep,
	            userMistakes,
		            reviewWordMeta,
		            reviewRounds,
            lastReviewStaminaRewardDate,
		            hasSeenHomeIntro,
		            openingFlowComplete: hasCompletedOpeningFlow,
	            hasSeenPreludeTutorial,
            preludeTutorialVersion: hasSeenPreludeTutorial
              ? PRELUDE_TUTORIAL_VERSION
              : 0,
	            hasSeenFrameworkGuide,
	          },
	        }),
	      });

      if (registerResp.status === 409) {
        setExistingPlayerIdPrompt(playerId);
        return;
      }
      if (!registerResp.ok) throw new Error("register_failed");

      localStorage.setItem("app_user_id", playerId);
      setAppUserId(playerId);
      rememberTestPlayerId(playerId);
      hapticFeedback.success?.();
      setPreOnboardingDialogueStep(3);
    } catch (err) {
      console.error("Failed to register player ID", err);
      setNameInputError("连接服务器失败，请检查网络后重试。");
    } finally {
      setNameRegistrationStatus("idle");
    }
  };

  const loadExistingPlayerId = async () => {
    if (!existingPlayerIdPrompt) return;

    try {
      setNameRegistrationStatus("loading");
      const playerId = existingPlayerIdPrompt;
      const resp = await fetch(getApiUrl(`/api/progress/${playerId}`));
      if (!resp.ok) throw new Error("load_failed");
      const data = await resp.json();

      localStorage.setItem("app_user_id", playerId);
      setAppUserId(playerId);
      rememberTestPlayerId(playerId);
      applyRemoteProgress({ ...data, preOnboardingName: data.preOnboardingName || playerId }, playerId);
      setExistingPlayerIdPrompt(null);
      setNameInputError(null);
      showMessage(`已读取 ID ${playerId}`);
    } catch (err) {
      console.error("Failed to load player ID", err);
      setNameInputError("读取进度失败，请稍后再试。");
    } finally {
      setNameRegistrationStatus("idle");
    }
  };

  const rejectExistingPlayerId = () => {
    hapticFeedback.light?.();
    setExistingPlayerIdPrompt(null);
    setPreOnboardingName("");
    setNameInputError("这个 ID 已被注册，请重新输入。");
  };

  const [isVideoMutedForQuestion, setIsVideoMutedForQuestion] = useState(false);
  const quizVideoRef = useRef<HTMLVideoElement>(null);

  // 控制对话流的步进 (使用 JSON 课前剧情)
	  useEffect(() => {
	    if (!showDialogueFlow) {
	      setDialogueStep(0);
        lastDialogueFlowSoundRef.current = null;
	    }
	  }, [showDialogueFlow, quizIndex]);

  useEffect(() => {
    if (!showDialogueFlow) return;

    const currentStory =
      preLessonStoriesConfig.lessons.find((l) => l.lesson_id === quizIndex) ||
      preLessonStoriesConfig.lessons[0];
    const currentDialogue = currentStory.dialogues[dialogueStep];
    if (!currentDialogue) return;

    const soundKey = `${quizIndex}:${dialogueStep}:${
      (currentDialogue as any).id ||
      currentDialogue.text_en ||
      currentDialogue.speaker
    }`;
    if (lastDialogueFlowSoundRef.current === soundKey) return;
    lastDialogueFlowSoundRef.current = soundKey;
    playDialogueAppearSound();
  }, [dialogueStep, quizIndex, showDialogueFlow]);

	  const advanceDialogueFlow = () => {
    const currentStory =
      preLessonStoriesConfig.lessons.find((l) => l.lesson_id === quizIndex) ||
      preLessonStoriesConfig.lessons[0];
    if (dialogueStep < currentStory.dialogues.length) {
      setDialogueStep((prev) => prev + 1);
    }
  };

	  const handleStartGame = () => {
	    if (
      suppressBuildingPointerUpRef.current ||
      targetDecorationPrompt ||
      isCourseEntryInputLocked ||
      levelTransitionInputLockRef.current
    ) {
      return;
    }
	    if (preludeStage === "guide_house") {
	      handlePreludeHouseTap();
	      return;
	    }
	    if (isPreludeActive) return;
	    if (!lessonsConfig.lessons.some((lesson) => lesson.lesson_id === quizIndex)) {
	      setShowLevelConfirm(false);
	      showMessage("当前主线课程已全部完成");
	      hapticFeedback.light?.();
	      return;
	    }

	    setShowGuideArrow(false);
    setIdleTownGuideTarget(null);
    setShowGrannyExclamation(false);
    setShowDialogueFlow(false);
    setShowSceneModal(false);
    setShowTasks(false);
    setShowLevelConfirm(true);
  };

  const handleExitBuilding = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    setTimeout(() => {
      setScene("exterior");
    }, 720);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 1800);
  };

	  useEffect(() => {
	    if (scene === "exterior" && !isTransitioning) {
	      if (quizIndex > MAX_MAIN_LESSON_ID) {
	        setShowTopCard(false);
	        setDismissedCardPhase(EXTERIOR_TASKS.length);
	        setAnimatingCompletedPhase(null);
	        return;
	      }
	      if (quizIndex === 2 && townEventStep < 5) {
        if (townEventStep === 3 && dismissedCardPhase < 1) {
          if (animatingCompletedPhase === null) {
            setAnimatingCompletedPhase(dismissedCardPhase);
            hapticFeedback.success();
            setShowTopCard(true);
            setTimeout(() => {
              setShowTopCard(false);
              setTimeout(() => {
                setDismissedCardPhase(1);
                setAnimatingCompletedPhase(null);
                setShowTopCard(true);
                setTimeout(() => {
                  // Do not pop up new task bubble on step 1
                }, 500);
              }, 600);
            }, 1000); // Wait 1 second before hiding so user sees completion state
          }
        }
      } else {
        const targetPhase = Math.min(quizIndex - 1, EXTERIOR_TASKS.length - 1);
        if (dismissedCardPhase < targetPhase) {
          if (animatingCompletedPhase === null) {
            setAnimatingCompletedPhase(dismissedCardPhase);
            hapticFeedback.success();
            setShowTopCard(true);
            setTimeout(() => {
              setShowTopCard(false);
              setTimeout(() => {
                setDismissedCardPhase(targetPhase);
                setAnimatingCompletedPhase(null);
                setShowTopCard(true);
              }, 600);
            }, 1000); // Wait 1 second before hiding
          }
        }
      }
    }
  }, [
    scene,
    isTransitioning,
    townEventStep,
    dismissedCardPhase,
    quizIndex,
    animatingCompletedPhase,
  ]);

  const renderPreludeOption = (
    option: (typeof PRELUDE_Q1_OPTIONS)[number],
    question: "q1" | "q2",
  ) => {
    const isQ1 = question === "q1";
    const wrongChoices = isQ1 ? preludeQ1WrongChoices : preludeQ2WrongChoices;
    const isWrongDisabled = wrongChoices.includes(option.id);
    const selectedChoice = isQ1 ? preludeQ1Choice : preludeQ2Choice;
    const isSelected = selectedChoice === option.id;

    let stateClass =
      "bg-white border-stone-200 text-stone-800 shadow-[0_4px_0_#d6d3d1]";
    if (isWrongDisabled) {
      stateClass = "bg-rose-50 border-rose-400 text-rose-700 shadow-none";
    }
    if (isSelected && option.isCorrect) {
      stateClass =
        "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-[0_4px_0_#16a34a]";
    } else if (isSelected && !option.isCorrect) {
      stateClass = "bg-rose-50 border-rose-400 text-rose-700 shadow-none";
    }

    return (
      <motion.button
        key={option.id}
        type="button"
        disabled={isWrongDisabled || Boolean(selectedChoice)}
        onClick={() =>
          isQ1
            ? handlePreludeQ1Answer(option.id)
            : handlePreludeQ2Answer(option.id)
        }
        className={`w-full rounded-[15px] border-[1.5px] px-3.5 py-2.5 text-left text-[14px] font-extrabold transition-all active:translate-y-[3px] ${
          isWrongDisabled || (isSelected && !option.isCorrect)
            ? "animate-shake"
            : ""
        } ${stateClass} ${
          isWrongDisabled || selectedChoice ? "cursor-default" : "active:shadow-none"
        }`}
      >
        <span className="mr-2 text-[11px] font-extrabold text-stone-400">
          {option.label}.
        </span>
        {option.value}
      </motion.button>
    );
  };

  const renderPreludePracticeOption = (
    option: (typeof PRELUDE_Q3_OPTIONS)[number],
    selectedChoice: PreludeChoice | null,
    wrongChoices: PreludeChoice[],
    onSelect: (choice: PreludeChoice) => void,
  ) => {
    const isSelected = selectedChoice === option.id;
    const isWrongMarked = wrongChoices.includes(option.id);
    let stateClass =
      "bg-white border-stone-200 text-stone-800 shadow-[0_4px_0_#d6d3d1]";
    if (isSelected && option.isCorrect) {
      stateClass =
        "bg-emerald-50 border-emerald-400 text-emerald-700 shadow-[0_4px_0_#16a34a]";
    } else if (isWrongMarked) {
      stateClass = "bg-rose-50 border-rose-400 text-rose-700 shadow-none";
    }

    return (
      <motion.button
        key={option.id}
        type="button"
        disabled={isWrongMarked}
        onClick={() => onSelect(option.id)}
        className={`w-full rounded-[15px] border-[1.5px] px-3.5 py-2.5 text-left text-[14px] font-extrabold transition-all active:translate-y-[3px] active:shadow-none ${
          isWrongMarked ? "animate-shake cursor-default" : ""
        } ${stateClass}`}
      >
        <span className="mr-2 text-[11px] font-extrabold text-stone-400">
          {option.label}.
        </span>
        {option.value}
      </motion.button>
    );
  };
		  const isPreludeInteriorStage =
		    preludeStage !== "hidden" &&
		    preludeStage !== "welcome" &&
		    preludeStage !== "guide_house";
			  const isPreludeLineSkipped = (lineId: string) =>
			    preludeSkippedLineIds.includes(lineId);
  const preludeInteriorBackground = preludeRouteImageUnlocked
    ? PRELUDE_GUARD_POINTING_IMAGE
    : PRELUDE_GUARD_GREETING_IMAGE;

  useEffect(() => {
    if (!isPreludeInteriorStage) {
      lastPreludeInteriorBackgroundRef.current = null;
      return;
    }

    const previousBackground = lastPreludeInteriorBackgroundRef.current;
    if (
      previousBackground &&
      previousBackground !== preludeInteriorBackground
    ) {
      playSceneSwipeSound();
    }
    lastPreludeInteriorBackgroundRef.current = preludeInteriorBackground;
  }, [isPreludeInteriorStage, preludeInteriorBackground]);

  const isPreludeQ1CorrectPanel =
    preludeStage === "q1_correct" &&
    preludeQ1Choice === "a" &&
    preludeVisibleLineIds.includes("q1_correct");
  const shouldRenderPreludeQ1Panel =
    (preludeStage === "q1" &&
      (preludeVisibleLineIds.includes("q1_prompt") ||
        Boolean(preludeQ1FeedbackLine))) ||
    isPreludeQ1CorrectPanel;
  const isPreludeQ2CorrectPanel =
    preludeStage === "q2_guard" &&
    preludeQ2Choice === "a" &&
    (preludeVisibleLineIds.includes("q2_correct") ||
      preludeVisibleLineIds.includes("guard_q2_correct"));
  const shouldRenderPreludeQ2Panel =
    (preludeStage === "q2" &&
      (preludeVisibleLineIds.includes("q2_prompt") ||
        Boolean(preludeQ2FeedbackLine))) ||
    isPreludeQ2CorrectPanel;
  const shouldShowPreludeInteriorActionPanel =
    (preludeStage === "inside_intro" &&
      preludeVisibleLineIds.includes("attention")) ||
    shouldRenderPreludeQ1Panel ||
    (preludeStage === "q1_correct" &&
      preludeVisibleLineIds.includes("q1_correct")) ||
    (preludeStage === "q2_intro" &&
      preludeVisibleLineIds.includes("where_intro")) ||
    shouldRenderPreludeQ2Panel ||
    (preludeStage === "q2_guard" &&
      (preludeVisibleLineIds.includes("q2_correct") ||
        preludeVisibleLineIds.includes("guard_q2_correct"))) ||
    (preludeStage === "route_intro" &&
      preludeVisibleLineIds.includes("route_check")) ||
    (preludeStage === "q3" &&
      preludeVisibleLineIds.includes("turn_left_prompt")) ||
    (preludeStage === "q3_correct" &&
      preludeVisibleLineIds.includes("q3_correct")) ||
    (preludeStage === "q4" &&
      preludeVisibleLineIds.includes("q4_prompt")) ||
    (preludeStage === "q4_correct" &&
      (preludeVisibleLineIds.includes("q4_correct") ||
        preludeVisibleLineIds.includes("almost_home")));
		  const frameworkGuideData =
	    frameworkGuideStep === 1
	      ? {
	          key: "overview",
	          label: "LingoVille",
	          text: "8 buildings. 8 real-life situations.\nEvery place teaches you English\nyou'll actually use.",
	          targetClass: "",
	          highlightClass: "",
	          icon: null,
	        }
	      : frameworkGuideStep === 2
	        ? {
	            key: "mistake-book",
	            label: "Mistake Book",
	            text: "📓This is your Mistake Book.\nEvery tricky one is saved here for review!",
	            targetClass: "left-6 bottom-[148px] h-14 w-14",
	            highlightClass:
	              "rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 border-2 border-white/95 shadow-[0_10px_28px_rgba(14,165,233,0.45)]",
	            icon: <NotebookTabs className="h-7 w-7 text-white" strokeWidth={2.8} />,
	          }
	        : frameworkGuideStep === 3
	          ? {
	              key: "ai-custom",
	              label: "AI Lesson",
	              text: "✨ Tell me what you want to learn.\nI'll create a lesson just for you 💫",
	              targetClass: "bottom-1 left-[calc(50%_-_88px)] h-16 w-16",
	              highlightClass: "rounded-2xl bg-white shadow-[0_10px_30px_rgba(99,102,241,0.35)]",
	              icon: <BrainCircuit className="mt-2 h-7 w-7 text-[#6C63FF]" strokeWidth={2.8} />,
	            }
	          : frameworkGuideStep === 4
	            ? {
	                key: "ai-speaking",
	                label: "AI Speaking",
	                text: "🎙️ Need to practice speaking?\nTap here whenever you want to chat! 💬",
	                targetClass: "bottom-1 left-[calc(50%_+_24px)] h-16 w-16",
	                highlightClass: "rounded-2xl bg-white shadow-[0_10px_30px_rgba(99,102,241,0.35)]",
	                icon: <BotMessageSquare className="mt-2 h-7 w-7 text-[#6C63FF]" strokeWidth={2.8} />,
	              }
	            : null;
  const selectedTownEditorDecoration =
    selectedTownEditorDecorationId
      ? TOWN_EDITOR_DECORATION_BY_ID[selectedTownEditorDecorationId]
      : null;
  const selectedTownEditorDecorationPosition =
    selectedTownEditorDecorationId
      ? townEditorDecorationPositions[selectedTownEditorDecorationId] ||
        getDefaultTownEditorDecorationPositions()[selectedTownEditorDecorationId]
      : null;
  const targetDecorationPromptBuilding = targetDecorationPrompt
    ? TOWN_EDITOR_BUILDINGS.find(
        (building) => building.id === targetDecorationPrompt.buildingId,
      ) || null
    : null;
  const targetDecorationPromptDecoration =
    targetDecorationPromptBuilding && targetDecorationPrompt
      ? targetDecorationPromptBuilding.decorations.find(
          (decoration) =>
            decoration.id === targetDecorationPrompt.decorationId,
        ) || null
      : null;
  const upcomingTownDecorUnlockBatch = useMemo(() => {
    const directUnlock = pendingDirectTownDecorUnlocks[0];
    if (directUnlock) {
      return {
        buildingId: directUnlock.buildingId,
        decorationIds: [directUnlock.decorationId],
      };
    }
    return getTownDecorationUnlockBatch(visibleTownDecorProgressCount + 1);
  }, [
    getTownDecorationUnlockBatch,
    pendingDirectTownDecorUnlocks,
    visibleTownDecorProgressCount,
  ]);
  const upcomingTownDecorShakeIds = useMemo(
    () => new Set(upcomingTownDecorUnlockBatch?.decorationIds || []),
    [upcomingTownDecorUnlockBatch],
  );
	  const shouldShowTownGarbage =
	    isAppVisible &&
	    hasCompletedUnit1 &&
      !hasReachedTownGarbageDailyLimit &&
	    activeTab === "town" &&
	    scene === "exterior" &&
	    !showReferenceGrid &&
    !showQuiz &&
	    !isPreludeActive &&
	    !townDecorUnlockAnimation &&
	    !townDecorRewardReveal;
  useEffect(() => {
    if (
      !shouldShowTownGarbage ||
      townGarbagePrompt ||
      townGarbageItems.length === 0 ||
      townGarbageItems.every(
        (item) =>
          isTownGarbageInHomeRoadBand(item) &&
          isTownGarbageOnPreferredRoadSpot(item, townEditorBuildingPositions),
      )
    ) {
      return;
    }

    setTownGarbageItems((current) => {
      const nextItems = relocateTownGarbageItems(
        current,
        townEditorBuildingPositions,
      );
      try {
        localStorage.setItem(
          TOWN_GARBAGE_STORAGE_KEY,
          JSON.stringify(nextItems),
        );
      } catch (e) {
        console.error(e);
      }
      return nextItems;
    });
  }, [
    shouldShowTownGarbage,
    townEditorBuildingPositions,
    townGarbageItems,
    townGarbagePrompt,
  ]);

  useEffect(() => {
    if (!shouldShowTownGarbage || townGarbagePrompt) return;

    const relocateTimer = window.setTimeout(() => {
      setTownGarbageItems((current) => {
        const nextItems = relocateTownGarbageItems(
          current,
          townEditorBuildingPositions,
        );
        try {
          localStorage.setItem(
            TOWN_GARBAGE_STORAGE_KEY,
            JSON.stringify(nextItems),
          );
        } catch (e) {
          console.error(e);
        }
        return nextItems;
      });
    }, TOWN_GARBAGE_RELOCATE_DELAY_MS);

    return () => window.clearTimeout(relocateTimer);
  }, [
    shouldShowTownGarbage,
    townEditorBuildingPositions,
    townGarbageItems,
    townGarbagePrompt,
  ]);
	  const townGarbageAnswer =
	    townGarbagePrompt?.selected.map((tile) => tile.char).join("") || "";
  const townGarbageTarget =
    townGarbagePrompt?.challenge.word.toUpperCase() || "";
  const shouldRunTownAmbientAnimations =
    isAppVisible &&
    activeTab === "town" &&
    scene === "exterior" &&
    !isDraggingScene &&
    !showReferenceGrid &&
    !showQuiz &&
    !isPreludeActive &&
    !showVictory &&
    !showVictoryMsg &&
    !showPreludeVictory &&
    !showWinStreak &&
    !showWinStreak2 &&
    !showStreakPanel &&
    !showReview &&
    !showTasks &&
    !showLevelConfirm &&
    !showStaminaRecoveryPrompt &&
    !showCourseOutline &&
    !showSocial &&
    !showSocialCreate &&
    !showStory &&
    !showSceneModal &&
    !showDialogueFlow &&
    !townGarbagePrompt &&
    !townDecorUnlockAnimation &&
    !townDecorRewardReveal &&
    !targetDecorationPrompt &&
    !lockedBuildingPrompt &&
    !earlyUnlockConfirmBuilding &&
    !showEarlyUnlockSuccess &&
    !frameworkGuidePanoramaIntro &&
    frameworkGuideStep === 0 &&
    miaDecorGuideStep === 0 &&
    !levelCurtain &&
    !townLiftTransition &&
    !isTransitioning;
  const shouldRunTownHighCostAmbientAnimations =
    shouldRunTownAmbientAnimations && !isMobilePerformanceMode;
  const townUnlockFoamCount = isMobilePerformanceMode ? 10 : 18;
  const townUnlockStarCount = isMobilePerformanceMode ? 8 : 12;

			  return (
    <div className="fixed inset-0 w-full h-full bg-[#1a1a1a] overflow-hidden flex justify-center items-center">
      {/* 手机比例容器 */}
		      <div
		        ref={appRootRef}
		        className={`relative bg-neutral-800 shadow-2xl overflow-hidden md:rounded-[48px] md:border-[12px] border-neutral-900 font-sans ${
		          isMobilePerformanceMode ? "town-performance-mode" : ""
		        } ${isDraggingScene ? "town-scene-is-moving" : ""}`}
		        style={{
	          width: `min(100dvw, 100vw, ${PHONE_FRAME_MAX_WIDTH}px, calc(min(100dvh, 100vh) * ${PHONE_FRAME_ASPECT_WIDTH} / ${PHONE_FRAME_ASPECT_HEIGHT}))`,
	          height: `min(100dvh, 100vh, ${PHONE_FRAME_MAX_HEIGHT}px, calc(min(100dvw, 100vw) * ${PHONE_FRAME_ASPECT_HEIGHT} / ${PHONE_FRAME_ASPECT_WIDTH}))`,
	        }}
	      >
        {isInitializing && (
          <div className="absolute inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1a1a1a] text-white">
            <div className="w-12 h-12 border-4 border-t-[#22c55e] border-white/20 rounded-full animate-spin"></div>
            <p className="mt-4 font-bold text-lg text-neutral-300">Syncing progress...</p>
          </div>
        )}
        {/* 场景层容器 */}
        <div className="absolute inset-0">
          <AnimatePresence mode="wait">
            {activeTab === "town" && (
              <motion.div
                key="town-tab"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0"
              >
	                {/* 核心场景层 */}
	                <div className="absolute inset-0" ref={dragAreaRef}>
	                  {/* 全局环境氛围图层 - 颗粒 */}
	                  {shouldRunTownHighCostAmbientAnimations && (
	                    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
	                      {TOWN_DUST_PARTICLES.map((particle, i) => (
	                        <motion.div
	                          key={`dust-${i}`}
	                          initial={{
	                            opacity: 0,
	                            y: "100%",
	                            x: particle.x1,
	                          }}
	                          animate={{
	                            y: "-10%",
	                            opacity: [0, 0.3, 0],
	                            x: [particle.x1, particle.x2],
	                          }}
	                          transition={{
	                            duration: particle.duration,
	                            repeat: Infinity,
	                            ease: "linear",
	                            delay: particle.delay,
	                          }}
	                          className="absolute w-1 h-1 bg-white/30 rounded-full blur-[1px]"
	                        />
	                      ))}
	                    </div>
	                  )}

                  {/* 户外场景 */}
                  <div
                    className={`absolute inset-0 transition-opacity duration-300 ${scene === "exterior" ? "opacity-100" : "opacity-0 pointer-events-none"} overflow-hidden`}
                  >
                    <motion.div
	                      style={{
	                        x: sceneX,
	                        y: sceneY,
	                        scale: townCameraScale,
                        transformOrigin: "center center",
                        width: `${exteriorSceneSize}px`,
                        height: `${exteriorSceneSize}px`,
                        marginLeft: `${-exteriorSceneSize / 2}px`,
                        marginTop: `${-exteriorSceneSize / 2}px`,
                      }}
	                      className={`town-scene-transform-layer absolute left-1/2 top-1/2 select-none touch-none ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                      onPointerDown={onScenePointerDown}
                      onPointerMove={onScenePointerMove}
                      onPointerUp={onScenePointerUp}
                      onPointerCancel={onScenePointerUp}
                    >
                      {/* 背景图层 - 增加微弱呼吸缩放 */}
                      <div className="absolute inset-0 z-0">
                        <img
                          data-scene-bg="true"
                          src={TOWN_BACKGROUND_IMAGE}
                          alt="City Background"
                          className="w-full h-full object-cover select-none"
                          referrerPolicy="no-referrer"
                          draggable={false}
                        />
                      </div>

	                      {shouldRunTownHighCostAmbientAnimations && (
	                        <SceneryAnimations />
	                      )}

                      <div
                        ref={townEditorLayerRef}
                        className={`absolute left-1/2 top-1/2 z-30 touch-none select-none ${
                          showReferenceGrid
                            ? "pointer-events-none"
                            : "pointer-events-none"
                        }`}
                        style={{
                          width: `${townSceneWorldSize}px`,
                          height: `${townSceneWorldSize}px`,
                          marginLeft: `${-townSceneWorldSize / 2}px`,
                          marginTop: `${-townSceneWorldSize / 2}px`,
                        }}
                      >
                        {TOWN_EDITOR_BUILDINGS.map((building) => {
                          const buildingKey = String(building.id);
                          const buildingPosition =
                            townEditorBuildingPositions[buildingKey] ||
                            getDefaultTownEditorBuildingPositions()[
                              buildingKey
                            ];
                          const {
                            isBuildingUnlocked,
                            isBuildingUpgraded,
                          } = getTownBuildingUnlockState(building);
                          const shouldShowBuildingUpgraded =
                            isBuildingUpgraded &&
                            !townBuildingUpgradeHoldIds.includes(building.id);
                          const residentTargetDecoration =
                            building.id === 1 &&
                            townNpcInspectAnimation?.buildingId === building.id
                              ? building.decorations.find((decoration) =>
                                  townNpcInspectAnimation.decorationIds.includes(
                                    decoration.id,
                                  ),
                                ) || null
                              : null;
                          const residentTargetPosition =
                            residentTargetDecoration
                              ? townEditorDecorationPositions[
                                  residentTargetDecoration.id
                                ] ||
                                getDefaultTownEditorDecorationPositions()[
                                  residentTargetDecoration.id
                                ]
                              : null;
                          const showResidentNewFurnitureBubble =
                            building.id === 1 &&
                            (townNpcReactionBubble?.buildingId === building.id ||
                              Boolean(residentTargetDecoration));
                          const residentInspectLeft = residentTargetPosition
                            ? `${clampPercent(
                                residentTargetPosition.x +
                                  residentTargetPosition.width * 0.12 -
                                  9,
                                18,
                                70,
                              )}%`
                            : HOME_RESIDENT_IDLE_LEFT;
                          const residentInspectTop = residentTargetPosition
                            ? `${clampPercent(residentTargetPosition.y + 8, 36, 70)}%`
                            : HOME_RESIDENT_IDLE_TOP;
                          const residentFacing = residentTargetPosition
                            ? residentTargetPosition.x > 50
                              ? -1
                              : 1
                            : HOME_RESIDENT_IDLE_FLIP;

                          return (
                            <motion.div
                              key={building.id}
                              data-town-editor-building={building.id}
                              animate={{
                                scale:
                                  !showReferenceGrid && shouldShowBuildingUpgraded
                                    ? 1.3
                                    : 1,
                              }}
                              transition={{
                                type: "spring",
                                damping: 16,
                                stiffness: 120,
                              }}
                              onPointerDown={(e) =>
                                handleTownEditorBuildingPointerDown(
                                  e,
                                  building.id,
                                )
                              }
                              onPointerMove={handleTownEditorPointerMove}
	                              onPointerUp={(e) => {
	                                if (showReferenceGrid) {
	                                  handleTownEditorPointerUp(e);
	                                  return;
	                                }
                                  if (
                                    isCourseEntryInputLocked ||
                                    levelTransitionInputLockRef.current
                                  ) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    return;
                                  }
	                                if (suppressBuildingPointerUpRef.current) {
	                                  suppressBuildingPointerUpRef.current = false;
	                                  e.stopPropagation();
	                                  return;
	                                }
		                                const fromDecoration = (
		                                  e.target as HTMLElement | null
		                                )?.closest("[data-town-editor-decoration]");
                                const transparentDecorationPointer =
                                  transparentTownDecorationPointerRef.current;
		                                if (
                                  fromDecoration &&
                                  transparentDecorationPointer?.pointerId !==
                                    e.pointerId
                                ) {
		                                  e.stopPropagation();
		                                  return;
		                                }
                                if (
                                  transparentDecorationPointer?.pointerId ===
                                  e.pointerId
                                ) {
                                  transparentTownDecorationPointerRef.current =
                                    null;
                                }
	                                const stageElement =
	                                  e.currentTarget.querySelector(
	                                    "[data-town-editor-stage]",
                                  ) as HTMLElement | null;
                                const hitRect = (
                                  stageElement || e.currentTarget
                                ).getBoundingClientRect();
                                if (
                                  !isPointOnVisibleImagePixel(
                                    building.src,
                                    e.clientX,
                                    e.clientY,
                                    hitRect,
                                  )
                                ) {
                                  return;
                                }
	                                if (
	                                  !isBuildingUnlocked &&
	                                  !isDraggingSceneGlobalRef.current
                                ) {
                                  openLockedBuildingPrompt(building);
                                  return;
                                }
                                if (
                                  building.id === 1 &&
                                  !isDraggingSceneGlobalRef.current
                                ) {
                                  handleStartGame();
                                }
                              }}
                              onPointerCancel={handleTownEditorPointerUp}
                              className={`absolute touch-none ${
                                showReferenceGrid
                                  ? "pointer-events-auto cursor-grab active:cursor-grabbing"
                                  : building.id === 1 || !isBuildingUnlocked
                                    ? "pointer-events-auto cursor-pointer"
                                    : "pointer-events-none"
                              }`}
                              style={{
                                left: `${buildingPosition.x}%`,
                                top: `${buildingPosition.y}%`,
                                width: `${buildingPosition.width}%`,
                                zIndex: 30 + building.id,
                                transformOrigin: "center center",
                              }}
                            >
                              <div
                                data-town-editor-stage={building.id}
                                className="relative aspect-square w-full"
                              >
                                <img
                                  src={building.src}
                                  alt={building.name}
                                  onLoad={(e) =>
                                    primeImageHitCanvas(
                                      building.src,
                                      e.currentTarget,
                                    )
                                  }
	                                  className="absolute inset-0 h-full w-full object-contain pointer-events-none drop-shadow-[0_12px_22px_rgba(15,23,42,0.2)] transition-[filter,opacity] duration-700"
	                                  style={{
	                                    filter: "none",
	                                    opacity: 1,
	                                  }}
                                  referrerPolicy="no-referrer"
                                  draggable={false}
                                />
                                {!isBuildingUnlocked && (
                                  <motion.img
	                                    src={LOCKED_BUILDING_OVERLAY_IMAGE}
	                                    alt=""
	                                    className="absolute inset-0 z-[210] h-full w-full object-contain pointer-events-none drop-shadow-[0_12px_22px_rgba(15,23,42,0.18)]"
	                                    animate={
	                                      shouldRunTownHighCostAmbientAnimations
	                                        ? {
	                                            scale: [1, 1.035, 0.992, 1.018, 1],
	                                            y: [0, -2, 1, -1, 0],
	                                            opacity: [0.94, 1, 0.96, 1, 0.94],
	                                          }
	                                        : { scale: 1, y: 0, opacity: 0.97 }
	                                    }
	                                    transition={
	                                      shouldRunTownHighCostAmbientAnimations
	                                        ? {
	                                            duration: 2.4,
	                                            ease: "easeInOut",
	                                            repeat: Infinity,
	                                            repeatDelay: 0.35 + building.id * 0.08,
	                                          }
	                                        : { duration: 0.2 }
	                                    }
	                                    referrerPolicy="no-referrer"
	                                    draggable={false}
	                                  />
                                )}

                                {isBuildingUnlocked ? (
                                  <div className="pointer-events-none absolute left-1/2 top-[87%] z-[72] flex -translate-x-1/2 flex-col items-center scale-150 origin-top">
                                    <div className="rounded-[7px] border-[2px] border-[#7a4a20] bg-[#f7d28a] px-2.5 py-1 shadow-[0_3px_0_#8b5a2b,0_8px_12px_rgba(68,38,13,0.22)]">
                                      <span className="block max-w-[96px] whitespace-nowrap text-center text-[7px] font-black uppercase leading-none tracking-wide text-[#5b3616] drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                                        {getTownBuildingSignName(building)}
                                      </span>
                                    </div>
                                    <div className="h-3 w-[5px] rounded-b-sm bg-[#7a4a20] shadow-[0_3px_4px_rgba(68,38,13,0.25)]" />
                                  </div>
                                ) : (
	                                  <motion.div
	                                    className="pointer-events-none absolute left-[88%] top-[76%] z-[230] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center scale-125 origin-center"
	                                    animate={
	                                      shouldRunTownHighCostAmbientAnimations
	                                        ? { y: [0, -4, 0] }
	                                        : { y: 0 }
	                                    }
	                                    transition={
	                                      shouldRunTownHighCostAmbientAnimations
	                                        ? {
	                                            duration: 1.8,
	                                            repeat: Infinity,
	                                            ease: "easeInOut",
	                                          }
	                                        : { duration: 0.2 }
	                                    }
	                                  >
                                    <div className="rounded-[14px] border-[3px] border-[#6f421c] bg-[#ffe2a1] px-4 py-2.5 shadow-[0_5px_0_#8b5a2b,0_14px_20px_rgba(68,38,13,0.28)]">
                                      <span className="block max-w-[160px] text-center text-[12px] font-black uppercase leading-tight tracking-wide text-[#543014] drop-shadow-[0_1px_0_rgba(255,255,255,0.8)]">
                                        {getTownBuildingSignName(building)}
                                      </span>
                                      <span className="mt-1 block text-center text-[10px] font-black leading-none text-[#9a5b24]">
                                        未解锁
                                      </span>
                                    </div>
                                    <div className="h-8 w-[8px] rounded-b-sm bg-[#7a4a20] shadow-[0_4px_6px_rgba(68,38,13,0.28)]" />
                                  </motion.div>
                                )}

	                                {(isBuildingUnlocked || showReferenceGrid
	                                  ? building.decorations
	                                  : []
	                                ).map((decoration, decorationIndex) => {
	                                  const decorationUnlockIndex =
	                                    getTownDecorationUnlockOrder(
	                                      building,
	                                    ).findIndex(
	                                      (item) => item.id === decoration.id,
	                                    );
	                                  const decorationPosition =
	                                    townEditorDecorationPositions[
	                                      decoration.id
                                    ] ||
                                    getDefaultTownEditorDecorationPositions()[
                                      decoration.id
                                    ];
	                                  const isDecorationUnlocked =
	                                    isTownDecorationUnlocked(
	                                      building,
	                                      decorationUnlockIndex >= 0
	                                        ? decorationUnlockIndex
	                                        : decorationIndex,
                                        decoration.id,
	                                    );
                                  const isPlayingUnlock =
                                    townDecorUnlockAnimation?.decorationIds.includes(
                                      decoration.id,
                                    ) || false;
	                                  const showDecorationNormal =
	                                    showReferenceGrid ||
	                                    isDecorationUnlocked ||
	                                    isPlayingUnlock;
	                                  const showDecorationSheen =
	                                    shouldRunTownAmbientAnimations &&
	                                    !showReferenceGrid &&
	                                    hasCompletedUnit1 &&
	                                    isDecorationUnlocked &&
	                                    !isPlayingUnlock &&
	                                    (!isMobilePerformanceMode ||
	                                      decorationIndex % 3 === 0);
	                                  const isSelectedDecoration =
	                                    showReferenceGrid &&
	                                    selectedTownEditorDecorationId ===
	                                      decoration.id;
                                  const canDragDecoration =
                                    showReferenceGrid ||
                                    (hasCompletedUnit1 &&
                                      isDecorationUnlocked &&
                                      !townDecorUnlockAnimation &&
                                      !townDecorRewardReveal);
                                  const canOpenDecorationUnlock =
                                    !showReferenceGrid &&
                                    hasCompletedUnit1 &&
                                    isBuildingUnlocked &&
                                    !isDecorationUnlocked &&
                                    !townDecorUnlockAnimation &&
                                    !townDecorRewardReveal;
                                  const showNewDecorationBubble =
                                    newTownDecorBubbleIds.includes(
                                      decoration.id,
                                    ) &&
                                    !showReferenceGrid &&
                                    isDecorationUnlocked &&
                                    !isPlayingUnlock;
	                                  const shouldShakeDecorationReminder =
	                                    shouldRunTownAmbientAnimations &&
	                                    !showReferenceGrid &&
	                                    !isDecorationUnlocked &&
	                                    !isPlayingUnlock &&
	                                    !townDecorUnlockAnimation &&
                                    !townDecorRewardReveal &&
                                    upcomingTownDecorShakeIds.has(decoration.id);
                                  const isTapAnimatingDecoration =
                                    tappedTownDecoration?.id === decoration.id &&
                                    !showReferenceGrid &&
                                    hasCompletedUnit1 &&
                                    isDecorationUnlocked &&
                                    !isPlayingUnlock;
	                                  const isPickedDecoration =
	                                    pickedTownDecorationId === decoration.id;
                                    const isFastSceneMove =
                                      isMobilePerformanceMode && isDraggingScene;
                                    const lockedDecorationFilter = isFastSceneMove
                                      ? "none"
                                      : "grayscale(100%) brightness(0.68)";
                                    const lockedDecorationOpacity =
                                      isFastSceneMove ? 0.24 : 0.34;

		                                  return (
	                                    <motion.div
                                      key={decoration.id}
                                      data-town-editor-decoration={
                                        decoration.id
                                      }
                                      onPointerDown={(e) =>
                                        handleTownEditorDecorationPointerDown(
                                          e,
                                          building.id,
                                          decoration.id,
                                        )
                                      }
		                                      onPointerMove={handleTownEditorPointerMove}
		                                      onPointerUp={(e) => {
                                            if (
                                              transparentTownDecorationPointerRef.current
                                                ?.pointerId === e.pointerId
                                            ) {
                                              return;
                                            }
		                                        if (canOpenDecorationUnlock) {
		                                          e.preventDefault();
		                                          e.stopPropagation();
		                                          return;
		                                        }
		                                        handleTownEditorPointerUp(e);
		                                      }}
		                                      onClick={(e) => {
                                            if (
                                              transparentTownDecorationPointerRef.current
                                                ?.decorationId === decoration.id
                                            ) {
                                              return;
                                            }
		                                        if (canOpenDecorationUnlock) {
		                                          e.preventDefault();
		                                        }
		                                        e.stopPropagation();
		                                      }}
		                                      onPointerCancel={(e) => {
                                            if (
                                              transparentTownDecorationPointerRef.current
                                                ?.pointerId === e.pointerId
                                            ) {
                                              transparentTownDecorationPointerRef.current =
                                                null;
                                              return;
                                            }
                                            handleTownEditorPointerUp(e);
                                          }}
			                                      className={`absolute touch-none ${
			                                        canDragDecoration || canOpenDecorationUnlock
			                                          ? canDragDecoration
	                                                ? showReferenceGrid
                                                    ? "pointer-events-auto cursor-grab active:cursor-grabbing"
                                                    : "pointer-events-auto cursor-pointer"
	                                                : "pointer-events-auto cursor-pointer"
			                                          : "pointer-events-none"
                                      } ${
                                        isSelectedDecoration ||
                                        isPickedDecoration
                                          ? "rounded-md ring-2 ring-[#58CC02] ring-offset-2 ring-offset-white/80"
                                          : ""
                                      }`}
                                      animate={
                                        isPickedDecoration
                                          ? {
                                              x: 0,
                                              y: -20,
                                              scale: 1.12,
                                              rotate: 0,
                                            }
                                          : isTapAnimatingDecoration
                                          ? {
                                              x: 0,
                                              y: [0, -7, 2, -2, 0],
                                              scale: [1, 1.1, 0.98, 1.04, 1],
                                              rotate: [0, -4, 4, -2, 0],
                                            }
                                          : shouldShakeDecorationReminder
                                          ? {
                                              x: [0, -3, 3, -2, 2, 0, -2, 2, 0],
                                              y: 0,
                                              scale: 1,
                                              rotate: [
                                                0,
                                                -2.5,
                                                2.5,
                                                -1.8,
                                                1.8,
                                                0,
                                                -1.5,
                                                1.5,
                                                0,
                                              ],
                                            }
                                          : { x: 0, y: 0, scale: 1, rotate: 0 }
                                      }
                                      transition={
                                        isPickedDecoration
                                          ? {
                                              type: "spring",
                                              stiffness: 520,
                                              damping: 28,
                                            }
                                          : isTapAnimatingDecoration
                                          ? {
                                              duration: 0.48,
                                              ease: "easeOut",
                                            }
                                          : shouldShakeDecorationReminder
                                          ? {
                                              duration: 0.92,
                                              ease: "easeInOut",
                                              repeat: Infinity,
                                              repeatDelay: 3.8,
                                            }
                                          : { duration: 0.18, ease: "easeOut" }
                                      }
                                      style={{
	                                        left: `${decorationPosition.x}%`,
	                                        top: `${decorationPosition.y}%`,
	                                        width: `${decorationPosition.width}%`,
	                                        zIndex:
                                            isPickedDecoration
                                              ? 520
                                              : 60 +
                                                Math.round(
                                                  decorationPosition.y +
                                                    decoration.height,
                                                ),
	                                      }}
                                    >
	                                      {isPickedDecoration && (
                                        <motion.div
                                          className="absolute inset-x-[10%] bottom-[-8%] z-[-1] h-[20%] rounded-full bg-black/30 blur-[10px] pointer-events-none"
                                          initial={{ opacity: 0, scale: 0.75 }}
                                          animate={{ opacity: 0.42, scale: 1 }}
                                          transition={{ duration: 0.14 }}
                                        />
                                      )}
                                      {isPlayingUnlock ? (
                                        <motion.img
                                          key={`${decoration.id}-${townDecorUnlockAnimation?.key}`}
	                                          src={decoration.src}
	                                          alt={`${building.name} decor ${decoration.order}`}
                                          onLoad={(e) =>
                                            primeImageHitCanvas(
                                              decoration.src,
                                              e.currentTarget,
                                            )
                                          }
	                                          className="h-auto w-full object-contain pointer-events-none drop-shadow-[0_5px_8px_rgba(15,23,42,0.15)]"
                                          initial={{
                                            filter:
                                              "grayscale(100%) brightness(0.72)",
                                            opacity: 0.48,
                                            scale: 0.96,
                                          }}
                                          animate={{
                                            filter:
                                              "grayscale(0%) brightness(1)",
                                            opacity: 1,
                                            scale: 1,
                                          }}
                                          transition={{
                                            duration: 4.2,
                                            ease: "easeOut",
                                          }}
                                          referrerPolicy="no-referrer"
                                          draggable={false}
                                        />
                                      ) : (
	                                        <img
	                                          src={decoration.src}
	                                          alt={`${building.name} decor ${decoration.order}`}
                                          onLoad={(e) =>
                                            primeImageHitCanvas(
                                              decoration.src,
                                              e.currentTarget,
                                            )
                                          }
	                                          className={`h-auto w-full object-contain pointer-events-none transition-[filter,opacity,transform] duration-500 ${
                                              isMobilePerformanceMode
                                                ? ""
                                                : "drop-shadow-[0_5px_8px_rgba(15,23,42,0.15)]"
                                            }`}
	                                          style={{
	                                            filter: showDecorationNormal
	                                              ? "none"
	                                              : lockedDecorationFilter,
	                                            opacity: showDecorationNormal
                                                ? 1
                                                : lockedDecorationOpacity,
	                                            transform: showDecorationNormal
	                                              ? "scale(1)"
	                                              : "scale(0.98)",
                                          }}
                                          referrerPolicy="no-referrer"
                                          draggable={false}
                                        />
                                      )}
                                      {showDecorationSheen && (
                                        <div
                                          className="absolute inset-0 z-[125] pointer-events-none overflow-hidden"
                                          style={{
                                            WebkitMaskImage: `url(${decoration.src})`,
                                            maskImage: `url(${decoration.src})`,
                                            WebkitMaskRepeat: "no-repeat",
                                            maskRepeat: "no-repeat",
                                            WebkitMaskSize: "contain",
                                            maskSize: "contain",
                                            WebkitMaskPosition: "center",
                                            maskPosition: "center",
                                          }}
                                        >
	                                          <div
	                                            className="town-decor-sheen-stripe absolute -top-1/4 h-[150%] w-[42%] rotate-12 bg-gradient-to-r from-transparent via-white/65 to-transparent blur-[3px] mix-blend-screen"
	                                            style={{
	                                              animationDelay: `${
	                                                ((building.id + decorationIndex) %
	                                                  5) *
	                                                0.35
	                                              }s`,
	                                            }}
	                                          />
	                                          <div
	                                            className="town-decor-sheen-pulse absolute inset-0 bg-white/0"
	                                            style={{
	                                              animationDelay: `${
	                                                ((building.id + decorationIndex) %
	                                                  5) *
	                                                0.35
	                                              }s`,
	                                            }}
	                                          />
                                        </div>
                                      )}
                                      <AnimatePresence>
                                        {showNewDecorationBubble && (
                                          <motion.div
                                            key={`new-decor-bubble-${decoration.id}`}
                                            initial={{
                                              opacity: 0,
                                              y: 10,
                                              scale: 0.68,
                                            }}
                                            animate={{
                                              opacity: [0, 1, 1, 1, 1, 1],
                                              y: [8, 0, -5, 0, -5, 0],
                                              scale: [0.7, 1, 1.1, 1, 1.1, 1],
                                            }}
                                            exit={{
                                              opacity: 0,
                                              y: -8,
                                              scale: 0.8,
                                            }}
                                            transition={{
                                              duration: 1.45,
                                              ease: "easeInOut",
                                            }}
                                            className="absolute left-1/2 top-[-34px] z-[260] flex h-[46px] w-[46px] -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-[#58CC02] text-center text-[10px] font-black leading-[1.05] text-white shadow-[0_8px_18px_rgba(63,147,0,0.34)] pointer-events-none"
                                          >
                                            新装饰
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
	                                      {isPlayingUnlock && (
                                        <div className="absolute inset-[-35%] z-[220] pointer-events-none overflow-visible">
                                          <motion.div
                                            className="absolute flex h-12 w-12 items-center justify-center text-[34px] drop-shadow-[0_10px_18px_rgba(120,72,24,0.35)]"
                                            style={{
                                              left: "50%",
                                              top: "50%",
                                              marginLeft: -24,
                                              marginTop: -24,
                                            }}
                                            initial={{ x: -36, y: 18, rotate: -22 }}
                                            animate={{
                                              x: [-36, 34, -28, 28, -16, 38],
                                              y: [18, -18, 24, 8, -12, 20],
                                              rotate: [-25, -8, -28, -6, -22, -10],
                                            }}
                                            transition={{
                                              duration: 4,
                                              ease: "easeInOut",
                                            }}
                                          >
                                            🧹
                                          </motion.div>

	                                          {Array.from({ length: townUnlockFoamCount }).map((_, bubbleIndex) => (
                                            <motion.span
                                              key={`foam-${bubbleIndex}`}
                                              className="absolute rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.9)]"
                                              style={{
                                                width: `${8 + (bubbleIndex % 5) * 4}px`,
                                                height: `${8 + (bubbleIndex % 5) * 4}px`,
                                                left: `${8 + ((bubbleIndex * 19) % 78)}%`,
                                                top: `${8 + ((bubbleIndex * 31) % 72)}%`,
                                              }}
                                              initial={{ opacity: 0, scale: 0.2 }}
                                              animate={{
                                                opacity: [0, 0.95, 0.72, 0],
                                                scale: [0.2, 1.4, 1.15, 0.35],
                                                y: [0, -12, -22, -32],
                                              }}
                                              transition={{
                                                duration: 3.8,
                                                delay: bubbleIndex * 0.08,
                                                ease: "easeOut",
                                              }}
                                            />
                                          ))}

	                                          {Array.from({ length: townUnlockStarCount }).map((_, starIndex) => (
                                            <motion.span
                                              key={`shine-${starIndex}`}
                                              className="absolute text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.95)]"
                                              style={{
                                                left: `${10 + ((starIndex * 23) % 80)}%`,
                                                top: `${10 + ((starIndex * 37) % 76)}%`,
                                              }}
                                              initial={{ opacity: 0, scale: 0, rotate: -30 }}
                                              animate={{
                                                opacity: [0, 1, 0],
                                                scale: [0, 1.5, 0.2],
                                                rotate: [-30, 20, 60],
                                              }}
                                              transition={{
                                                duration: 1.25,
                                                delay: 3.5 + starIndex * 0.06,
                                                ease: "easeOut",
                                              }}
                                            >
                                              ✦
                                            </motion.span>
                                          ))}
                                        </div>
                                      )}
                                      {showReferenceGrid && (
                                        <div className="absolute left-1/2 top-full mt-0.5 -translate-x-1/2 rounded bg-stone-950/85 px-1 py-0.5 font-mono text-[6px] leading-none text-white shadow-md pointer-events-none">
                                          {decoration.order}
                                        </div>
                                      )}
                                    </motion.div>
                                  );
                                })}

                                {building.id === 1 &&
                                  isBuildingUnlocked &&
                                  !showReferenceGrid && (
                                    <motion.div
                                      className="absolute z-[185] w-[5.8%] pointer-events-none"
                                      initial={{
                                        left: HOME_RESIDENT_IDLE_LEFT,
                                        top: HOME_RESIDENT_IDLE_TOP,
                                      }}
                                      animate={{
                                        left: residentInspectLeft,
                                        top: residentInspectTop,
                                      }}
                                      transition={{
                                        duration: residentTargetDecoration ? 1.15 : 0.7,
                                        ease: "easeInOut",
                                      }}
                                    >
                                      <motion.img
                                        src={BUILDING_RESIDENT_IMAGE}
                                        alt=""
                                        className="h-auto w-full object-contain drop-shadow-[0_6px_9px_rgba(68,38,13,0.24)]"
                                        animate={{
                                          scaleX: residentFacing,
                                          y: residentTargetDecoration
                                            ? [0, -2, 1, -1, 0]
                                            : 0,
                                          rotate: residentTargetDecoration
                                            ? [-1.2, 1.1, -0.6, 0.8, -1.2]
                                            : 0,
                                        }}
                                        transition={{
                                          scaleX: {
                                            duration: 0.25,
                                            ease: "easeInOut",
                                          },
                                          y: {
                                            duration: 0.72,
                                            repeat: residentTargetDecoration
                                              ? Infinity
                                              : 0,
                                            ease: "easeInOut",
                                          },
                                          rotate: {
                                            duration: 1.1,
                                            repeat: residentTargetDecoration
                                              ? Infinity
                                              : 0,
                                            ease: "easeInOut",
                                          },
                                        }}
                                        referrerPolicy="no-referrer"
                                        draggable={false}
                                      />
                                      <AnimatePresence>
                                        {showResidentNewFurnitureBubble && (
                                          <motion.div
                                            key="resident-new-furniture-bubble"
                                            className="absolute left-1/2 top-[-48px] z-[3] w-[132px] -translate-x-1/2 rounded-[15px] border-2 border-white bg-white/95 px-2.5 py-1.5 text-center text-[9px] font-extrabold leading-[1.15] text-stone-800 shadow-[0_8px_18px_rgba(15,23,42,0.2)]"
                                            initial={{
                                              opacity: 0,
                                              y: 8,
                                              scale: 0.78,
                                            }}
                                            animate={{
                                              opacity: 1,
                                              y: [0, -2, 0],
                                              scale: [1, 1.04, 1],
                                            }}
                                            exit={{
                                              opacity: 0,
                                              y: -6,
                                              scale: 0.9,
                                            }}
                                            transition={{
                                              opacity: { duration: 0.18 },
                                              y: {
                                                duration: 1.05,
                                                repeat: Infinity,
                                                ease: "easeInOut",
                                              },
                                              scale: {
                                                duration: 1.05,
                                                repeat: Infinity,
                                                ease: "easeInOut",
                                              },
                                            }}
                                          >
                                            <span>
                                              Wow, amazing! New furniture!
                                            </span>
                                            <span className="absolute left-1/2 top-full h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-b-2 border-r-2 border-white bg-white/95" />
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </motion.div>
                                  )}

                                {showReferenceGrid && (
                                  <div className="absolute left-1/2 -top-4 z-[200] -translate-x-1/2 whitespace-nowrap rounded-full bg-white/92 px-2 py-1 text-[9px] font-black text-stone-700 shadow-md border border-stone-200 pointer-events-none">
                                    {building.id}.{building.name} x
                                    {buildingPosition.x} y
                                    {buildingPosition.y} w
                                    {buildingPosition.width}
                                  </div>
                                )}
                                {(showGuideArrow ||
                                  preludeStage === "guide_house") &&
                                  building.id === 1 && (
                                    <motion.div
                                      className="absolute top-2 left-1/2 z-[240] -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                      animate={{ y: [0, 10, 0] }}
                                      transition={{
                                        duration: 1,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                      }}
                                    >
                                      <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.6)] border-4 border-white">
                                        <ArrowBigDown
                                          className="w-6 h-6 text-white translate-y-[2px]"
                                          fill="currentColor"
                                        />
                                      </div>
                                    </motion.div>
                                  )}
                                {idleTownGuideTarget === "home" &&
                                  building.id === 1 &&
                                  !showReferenceGrid && (
                                    <motion.div
                                      className="absolute -top-20 left-1/2 z-[245] -translate-x-1/2 flex flex-col items-center pointer-events-none"
                                      initial={{ opacity: 0, y: -8, scale: 0.92 }}
                                      animate={{
                                        opacity: 1,
                                        y: [0, 8, 0],
                                        scale: 1,
                                      }}
                                      exit={{ opacity: 0, y: -8, scale: 0.92 }}
                                      transition={{
                                        y: {
                                          duration: 1,
                                          repeat: Infinity,
                                          ease: "easeInOut",
                                        },
                                        opacity: { duration: 0.2 },
                                        scale: { duration: 0.2 },
                                      }}
                                    >
                                      <div className="mb-2 rounded-full border-2 border-white bg-stone-950/86 px-3 py-1.5 text-[10px] font-black text-white shadow-lg">
                                        点这里开始学习
                                      </div>
                                      <div className="w-12 h-12 bg-[#58CC02] rounded-full flex items-center justify-center shadow-[0_0_18px_rgba(88,204,2,0.65)] border-4 border-white">
                                        <ArrowBigDown
                                          className="w-6 h-6 text-white translate-y-[2px]"
                                          fill="currentColor"
                                        />
                                      </div>
                                    </motion.div>
                                  )}
                              </div>
                            </motion.div>
                          );
                        })}

                        <AnimatePresence>
                          {shouldShowTownGarbage &&
                            townGarbageItems.map((item) => (
	                              <motion.button
	                                key={item.id}
	                                type="button"
	                                aria-label="清理垃圾"
	                                className="absolute z-[280] h-[66px] w-[66px] -translate-x-1/2 -translate-y-1/2 touch-none rounded-full pointer-events-auto"
                                style={{
                                  left: `${item.x}%`,
                                  top: `${item.y}%`,
                                }}
	                                initial={{ opacity: 0, scale: 0.55, y: 12 }}
	                                animate={
	                                  shouldRunTownHighCostAmbientAnimations
	                                    ? {
	                                        opacity: 1,
	                                        scale: 1,
	                                        y: [0, -2, 0],
	                                        rotate:
	                                          item.variant === 0
	                                            ? [-1, 1.5, -1]
	                                            : item.variant === 1
	                                              ? [1.5, -1.5, 1.5]
	                                              : [0, 1.2, 0],
	                                      }
	                                    : {
	                                        opacity: 1,
	                                        scale: 1,
	                                        y: 0,
	                                        rotate: 0,
	                                      }
	                                }
                                exit={{
                                  opacity: 0,
                                  scale: 0.25,
                                  rotate: 14,
                                }}
	                                transition={
	                                  shouldRunTownHighCostAmbientAnimations
	                                    ? {
	                                        y: {
	                                          duration: 2.6,
	                                          repeat: Infinity,
	                                          ease: "easeInOut",
	                                        },
	                                        rotate: {
	                                          duration: 2.6,
	                                          repeat: Infinity,
	                                          ease: "easeInOut",
	                                        },
	                                        opacity: { duration: 0.18 },
	                                        scale: { duration: 0.25 },
	                                      }
	                                    : {
	                                        opacity: { duration: 0.18 },
	                                        scale: { duration: 0.25 },
	                                        y: { duration: 0.2 },
	                                        rotate: { duration: 0.2 },
	                                      }
	                                }
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
	                                onPointerUp={(e) => {
	                                  e.preventDefault();
	                                  e.stopPropagation();
	                                  openTownGarbageChallenge(item);
	                                }}
	                              >
	                                <span className="absolute inset-0 rounded-full border-2 border-white/90 bg-white/10 shadow-[0_0_16px_rgba(255,255,255,0.55)]" />
	                                <span className="absolute inset-1 rounded-full bg-black/14 blur-[9px]" />
	                                <span className="absolute left-[16px] top-[25px] h-7 w-8 rotate-[-8deg] rounded-[10px] border-2 border-stone-500/45 bg-stone-300 shadow-[0_6px_9px_rgba(68,64,60,0.24)]" />
	                                <span className="absolute left-[24px] top-[18px] h-6 w-7 rotate-[13deg] rounded-[7px] border-2 border-amber-500/50 bg-amber-100 shadow-sm" />
	                                <span className="absolute left-[12px] top-[18px] h-5 w-6 rotate-[-18deg] rounded-[6px] border-2 border-sky-500/45 bg-sky-100 shadow-sm" />
	                                <span className="absolute left-[35px] top-[35px] h-4 w-6 rotate-[20deg] rounded-full bg-lime-500/75 shadow-[0_2px_0_rgba(63,98,18,0.25)]" />
	                                <span className="absolute left-[28px] top-[34px] h-3 w-7 rotate-[12deg] rounded-full bg-stone-500/55" />
	                                <span className="absolute left-[16px] top-[38px] h-2 w-2 rounded-full bg-rose-300" />
	                              </motion.button>
                            ))}
                        </AnimatePresence>

                        <AnimatePresence>
                          {townGarbageSmoke && (
                            <motion.div
                              key={`town-garbage-smoke-${townGarbageSmoke.key}`}
                              className="absolute z-[265] h-[150px] w-[150px] -translate-x-1/2 -translate-y-1/2 pointer-events-none overflow-visible"
                              style={{
                                left: `${townGarbageSmoke.x}%`,
                                top: `${townGarbageSmoke.y}%`,
                              }}
                              initial={{ opacity: 0, scale: 0.55 }}
                              animate={{ opacity: [0, 1, 0.8, 0], scale: [0.55, 1.1, 1.35] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 1.25, ease: "easeOut" }}
                            >
                              <motion.div
                                className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 blur-[10px]"
                                animate={{ scale: [0.4, 1.8], opacity: [0.9, 0] }}
                                transition={{ duration: 1.1, ease: "easeOut" }}
                              />
                              {Array.from({ length: 22 }).map((_, smokeIndex) => {
                                const angle = (Math.PI * 2 * smokeIndex) / 22;
                                const distance = 28 + (smokeIndex % 6) * 11;
                                return (
                                  <motion.span
                                    key={`town-garbage-smoke-puff-${smokeIndex}`}
                                    className="absolute left-1/2 top-1/2 rounded-full bg-stone-200/85 shadow-[0_0_16px_rgba(255,255,255,0.65)] blur-[2px]"
                                    style={{
                                      width: `${16 + (smokeIndex % 5) * 7}px`,
                                      height: `${16 + (smokeIndex % 5) * 7}px`,
                                    }}
                                    initial={{
                                      x: -8,
                                      y: -8,
                                      opacity: 0,
                                      scale: 0.25,
                                    }}
                                    animate={{
                                      x: Math.cos(angle) * distance - 8,
                                      y: Math.sin(angle) * distance - 8,
                                      opacity: [0, 0.95, 0],
                                      scale: [0.25, 1.45, 0.65],
                                    }}
                                    transition={{
                                      duration: 1.1,
                                      delay: smokeIndex * 0.018,
                                      ease: "easeOut",
                                    }}
                                  />
                                );
                              })}
                              {Array.from({ length: 12 }).map((_, sparkIndex) => (
                                <motion.span
                                  key={`town-garbage-spark-${sparkIndex}`}
                                  className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-yellow-300 shadow-[0_0_12px_rgba(253,224,71,0.9)]"
                                  initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                                  animate={{
                                    x: Math.cos((Math.PI * 2 * sparkIndex) / 12) * (44 + sparkIndex * 3),
                                    y: Math.sin((Math.PI * 2 * sparkIndex) / 12) * (34 + sparkIndex * 2),
                                    opacity: [0, 1, 0],
                                    scale: [0.4, 1.25, 0.2],
                                  }}
                                  transition={{
                                    duration: 0.85,
                                    delay: 0.12 + sparkIndex * 0.025,
                                    ease: "easeOut",
                                  }}
                                />
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div
                          className={`absolute left-1/2 top-[10px] z-[220] -translate-x-1/2 rounded-full bg-stone-950/85 px-3 py-1.5 text-[10px] font-black text-white shadow-lg pointer-events-none ${
                            showReferenceGrid ? "block" : "hidden"
                          }`}
                        >
                          网格摆放层：拖建筑，或拖建筑上的单个装饰
                        </div>
                        {townDecorUnlockAnimation && !showReferenceGrid && (
                          <motion.div
                            initial={{ opacity: 0, y: -8, scale: 0.92 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -8, scale: 0.92 }}
                            className="absolute left-1/2 top-[46px] z-[230] -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-[11px] font-black text-emerald-600 shadow-xl border border-emerald-100 pointer-events-none"
                          >
                            Cleaning up a new decoration...
                          </motion.div>
                        )}
                      </div>

                      {/* 户外 UI 层 - 调整位置，将建筑和装饰物向上移动以符合视觉比例 */}
                      <div
                        className="hidden"
                      >
                        <div className="relative w-96 h-96 flex items-center justify-center scale-[0.8]">
                          {/* 建筑物可点击进入 - 增加进度高亮效果 */}
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onPointerUp={(e) => {
                              if (showReferenceGrid) {
                                e.preventDefault();
                                e.stopPropagation();
                                return;
                              }
                              if (!isDraggingSceneGlobalRef.current) {
                                handleStartGame();
                              }
                            }}
                            className={`relative group z-20 ${
                              showReferenceGrid
                                ? "cursor-default"
                                : "cursor-pointer"
                            } ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                          >
                            <div
                              ref={homeDecorationStageRef}
                              onPointerDown={
                                handleHomeDecorationStagePointerDown
                              }
                              onPointerMove={handleHomeDecorationPointerMove}
                              onPointerUp={handleHomeDecorationPointerUp}
                              onPointerCancel={handleHomeDecorationPointerUp}
                              className={`relative w-[560px] max-w-none aspect-[1431/953] drop-shadow-[0_22px_34px_rgba(15,23,42,0.24)] ${
                                showReferenceGrid
                                  ? "z-[80] touch-none pointer-events-auto"
                                  : ""
                              }`}
                            >
                              <AnimatePresence mode="popLayout">
                                <motion.img
                                  key={houseImage}
                                  initial={
                                    isFirstTimeImage
                                      ? { y: -60, opacity: 0, scale: 0.92 }
                                      : { y: 0, opacity: 1, scale: 1 }
                                  }
                                  animate={{
                                    y: 0,
                                    opacity: 1,
                                    scale: 1,
                                    rotate: isFirstTimeImage
                                      ? [0, 3, -3, 2, -2, 0]
                                      : 0,
                                  }}
                                  transition={{
                                    y: {
                                      type: "spring",
                                      damping: 15,
                                      stiffness: 100,
                                      duration: 1,
                                    },
                                    rotate: { delay: 0.6, duration: 1.4 },
                                  }}
                                  src={houseImage}
                                  alt="Home"
                                  className="absolute inset-0 z-10 h-full w-full object-contain"
                                  referrerPolicy="no-referrer"
                                  draggable={false}
                                />
                              </AnimatePresence>

                              <AnimatePresence>
                                {(showReferenceGrid
                                  ? HOME_DECORATIONS
                                  : unlockedHomeDecorations
                                ).map((decoration) => {
                                  const isUnlocked =
                                    homeDecorCompletionCount >=
                                    decoration.unlockAfterCompletions;
                                  const position =
                                    homeDecorationPositions[decoration.id] ||
                                    getDefaultHomeDecorationPositions()[
                                      decoration.id
                                    ];
                                  return (
                                    <motion.div
                                      key={decoration.id}
                                      data-home-decoration={decoration.id}
                                      onPointerDown={(e) =>
                                        handleHomeDecorationPointerDown(
                                          e,
                                          decoration.id,
                                        )
                                      }
                                      onPointerMove={
                                        handleHomeDecorationPointerMove
                                      }
                                      onPointerUp={handleHomeDecorationPointerUp}
                                      onPointerCancel={
                                        handleHomeDecorationPointerUp
                                      }
                                      initial={{ opacity: 0, y: -40, scale: 0.75 }}
                                      animate={{
                                        opacity:
                                          showReferenceGrid && !isUnlocked
                                            ? 0.62
                                            : 1,
                                        y: 0,
                                        scale: 1,
                                        rotate: showReferenceGrid
                                          ? 0
                                          : [0, 3, -3, 1.5, -1.5, 0],
                                      }}
                                      exit={{ opacity: 0, scale: 0.8 }}
                                      transition={{
                                        type: "spring",
                                        damping: 13,
                                        stiffness: 150,
                                        rotate: { delay: 0.45, duration: 1.15 },
                                      }}
                                      className={`absolute z-30 h-auto touch-none select-none ${
                                        showReferenceGrid
                                          ? "pointer-events-auto cursor-grab active:cursor-grabbing"
                                          : "pointer-events-none"
                                      }`}
                                      style={{
                                        left: `${position.x}%`,
                                        top: `${position.y}%`,
                                        width: `${position.width}%`,
                                      }}
                                    >
                                      <img
                                        src={decoration.src}
                                        alt={decoration.name}
                                        className="h-auto w-full object-contain"
                                        referrerPolicy="no-referrer"
                                        draggable={false}
                                      />
                                      {showReferenceGrid && (
                                        <div className="absolute left-1/2 top-full mt-1 -translate-x-1/2 rounded-md bg-stone-950/85 px-1.5 py-1 text-center font-mono text-[7px] leading-tight text-white shadow-md">
                                          <div>{decoration.name}</div>
                                          <div>
                                            x{position.x} y{position.y} w
                                            {position.width}
                                          </div>
                                        </div>
                                      )}
                                    </motion.div>
                                  );
                                })}
                              </AnimatePresence>
                              {showReferenceGrid && (
                                <div className="absolute left-1/2 top-2 z-50 -translate-x-1/2 rounded-full bg-stone-950/85 px-3 py-1.5 text-[10px] font-black text-white shadow-lg pointer-events-none">
                                  拖动装饰调整位置
                                </div>
                              )}
                            </div>

                            {!showReferenceGrid &&
                              (townEventStep === 0 || townEventStep === 5) && (
                              <>
                                {/* 引导点击效果 */}
                                <div className="absolute inset-0 bg-yellow-400/0 group-hover:bg-yellow-400/5 transition-colors duration-300 rounded-3xl z-20" />
                              </>
                            )}

                            {/* 引导箭头 */}
                            {(showGuideArrow || preludeStage === "guide_house") && (
                              <motion.div
                                className="absolute top-2 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none"
                                animate={{ y: [0, 10, 0] }}
                                transition={{
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(34,197,94,0.6)] border-4 border-white">
                                  <ArrowBigDown
                                    className="w-6 h-6 text-white translate-y-[2px]"
                                    fill="currentColor"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </motion.div>

                          {/* 玩家从大巴下车后停留在场景中 */}
                          <AnimatePresence>
                            {introStep >= 2 && introStep < 5 && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 1 }}
                                className="absolute inset-x-0 bottom-[-27%] flex items-center justify-center translate-x-[30%] z-[85] pointer-events-none"
                              >
                                <motion.div
                                  className={`relative w-14 h-14 cursor-pointer ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                                  initial={{ x: -140, y: 150, scale: 0.5 }}
                                  animate={{ x: -140, y: 150, scale: 1 }}
                                  transition={{ duration: 1 }}
                                >
                                  <motion.div
                                    animate={{
                                      y: [0, -4, 0],
                                      scaleY: [1, 0.94, 1],
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                    }}
                                  >
                                    <img
                                      src="/assets/npc.png"
                                      alt="Player"
                                      className="w-full h-full object-contain -scale-x-100"
                                      referrerPolicy="no-referrer"
                                    />
                                  </motion.div>
                                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/30 rounded-full blur-sm -z-10" />
                                </motion.div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* 小镇事件对话框 (包含 introStep 等事件) */}
                          <AnimatePresence>
                            {townEventStep === 1 && (
                              <motion.div
                                key="town-dialogue"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-[150] w-[85%] max-w-sm ${scene === "exterior" ? "pointer-events-auto" : "pointer-events-none"}`}
                                onPointerUp={(e) => {
                                  if (!isDraggingSceneGlobalRef.current && townEventStep === 1) {
                                    setTownEventStep(2);
                                  }
                                }}
                              >
                                <div className="relative bg-white/95 backdrop-blur-2xl border-4 border-amber-100 p-5 pt-7 rounded-[32px] shadow-2xl">
                                  {/* 老奶奶头像 - 放在左侧稍微压住边框 */}
                                  <div className="absolute -left-10 bottom-2 w-20 h-20 rounded-2xl border-4 border-white shadow-xl overflow-hidden bg-amber-50 z-10 rotate-[-5deg]">
                                    <img
                                      src="/assets/buntouxiang.png"
                                      className="w-full h-full object-cover -scale-x-100"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>

                                  {/* 对话内容 (向右偏移一点给头像留空间) */}
                                  <div className="pl-10 relative text-stone-800 font-bold leading-relaxed">
                                    <AnimatePresence mode="wait">
                                      <motion.p
                                        key={`dialogue-${townEventStep}`}
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="text-sm tracking-tight"
                                      >
                                        {townEventStep === 1 && (
                                          <ConfigBubble
                                            file="guide_dialogues.json"
                                            field="text_en"
                                            align="start"
                                          >
                                            {guideDialoguesConfig.events.find(
                                              (e) =>
                                                e.event_id ===
                                                "town_event_intro",
                                            )?.dialogues[0]?.text_en ||
                                              "It used to be beautiful here, but now..."}
                                          </ConfigBubble>
                                        )}
                                      </motion.p>
                                    </AnimatePresence>

                                    <div className="mt-3 flex justify-end">
                                      <div className="text-[9px] text-amber-500/80 animate-pulse font-black flex items-center gap-1">
                                        <span>NEXT</span>
                                        <div className="w-1 h-1 bg-amber-500 rounded-full" />
                                      </div>
                                    </div>
                                  </div>

                                  {/* 气泡尖角 - 调整到左侧对齐头像 */}
                                  <div className="absolute left-10 -bottom-2 w-4 h-4 bg-white/95 rotate-45 border-r-4 border-b-4 border-amber-100" />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* 指向章节按钮的箭头移至全局层 */}
                        </div>
                      </div>
	                      {showReferenceGrid && (
	                        <div
	                          className="absolute left-1/2 top-1/2 z-[99] pointer-events-none"
	                          style={{
	                            width: `${townSceneWorldSize}px`,
	                            height: `${townSceneWorldSize}px`,
	                            marginLeft: `${-townSceneWorldSize / 2}px`,
	                            marginTop: `${-townSceneWorldSize / 2}px`,
	                          }}
	                        >
	                          <CoordinateGridOverlay
	                            sceneWidth={townSceneWorldSize}
	                          />
	                        </div>
	                      )}
                    </motion.div>
                  </div>

                  {/* 室内场景 */}
                  <div
                    ref={interiorContainerRef}
                    className={`absolute inset-0 bg-neutral-900 transition-opacity duration-300 ${scene === "interior" ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                  >
                    {/* 飞出的星星 */}
                    <AnimatePresence>
                      {flyingStarAnim && (
                        <motion.div
                          initial={{
                            opacity: 0,
                            scale: 0,
                            top: "50%",
                            left: "50%",
                            x: "-50%",
                            y: "-50%",
                          }}
                          animate={{
                            opacity: [0, 1, 1, 1, 1],
                            scale: [0, 5, 5, 3, 1],
                            top: ["50%", "50%", "50%", "30%", "56px"],
                            left: ["50%", "50%", "50%", "40%", "35%"],
                            rotate: [0, 180, 270, 315, 360],
                          }}
                          exit={{ opacity: 0, scale: 1 }}
                          transition={{
                            duration: 3.0,
                            times: [0, 0.2, 0.6, 0.8, 1],
                            ease: "easeInOut",
                          }}
                          className="absolute z-[200] w-12 h-12 pointer-events-none drop-shadow-[0_0_20px_rgba(255,215,0,1)] flex items-center justify-center text-yellow-400"
                        >
                          <StarIcon fillRatio={1} pureGold={true} />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* 室内氛围：丁达尔光柱 - 提升层级到画布之上 */}
                    <motion.div
                      animate={{ opacity: [0.05, 0.15, 0.05] }}
                      transition={{
                        duration: 5,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="absolute -top-40 -left-20 w-[150%] h-[100%] bg-gradient-to-b from-white/20 to-transparent blur-[80px] rotate-[35deg] pointer-events-none z-[85]"
                    />

                    {/* 可滑动画布 */}
                    <motion.div
                      style={{ x: sceneX }}
                      className={`absolute inset-y-0 left-1/2 -ml-[450px] w-[900px] h-full select-none touch-pan-y ${scene === "interior" ? "pointer-events-auto" : "pointer-events-none"}`}
                      onPointerDown={onScenePointerDown}
                      onPointerMove={onScenePointerMove}
                      onPointerUp={onScenePointerUp}
                      onPointerCancel={onScenePointerUp}
                    >
                      {/* 背景图层 */}
                      <img
                        data-scene-bg="true"
                        src={
                          showQuiz
                            ? quizIndex === 2
                              ? "/assets/cafeishineibeijing2.png"
                              : quizIndex === 3
                                ? "/assets/cafeishineibeijing3.png"
                                : quizIndex === 4
                                  ? "/assets/cafeishineibeijing4.png"
                                  : "/assets/cafeishineibeijing.png"
                            : "/assets/jianzhunei2.png"
                        }
                        alt="Interior Scene"
                        className="w-full h-full object-cover select-none"
                        draggable={false}
                        referrerPolicy="no-referrer"
                      />

                      {/* 家具展示层 - 在画布内 */}
                      <div className="absolute inset-0 pointer-events-none z-20">
                        {/* 标记位置 */}
                        <DecorationMarker
                          label="Photo Wall"
                          top="35%"
                          left="25%"
                          isPlaced={furniture.includes("photo_wall")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />
                        <DecorationMarker
                          label="Lamp"
                          top="47%"
                          left="33%"
                          isPlaced={furniture.includes("lamp")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />
                        <DecorationMarker
                          label="Coffee Table"
                          top="53%"
                          left="15%"
                          isPlaced={furniture.includes("table")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />
                        <DecorationMarker
                          label="Rug"
                          top="55%"
                          left="11%"
                          isPlaced={furniture.includes("rug")}
                          onClick={() => setShowTasks(true)}
                          active={scene === "interior"}
                        />

                        {/* 实际放置的家具 */}
                        {furniture.includes("rug") && (
                          <motion.img
                            key="furniture-rug"
                            initial={{ opacity: 0, y: -400 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              rotate: [0, 10, -10, 7, -7, 5, -5, 0],
                            }}
                            transition={{
                              y: { type: "spring", damping: 12, stiffness: 80 },
                              rotate: { delay: 1.2, duration: 2.0 },
                            }}
                            src="/assets/jinagliditan.png"
                            className="absolute top-[52%] left-[4%] w-56 h-auto z-10"
                            referrerPolicy="no-referrer"
                            onPointerUp={(e) => {
                              if (!isDraggingSceneGlobalRef.current) {
                                setShowTasks(true);
                              }
                            }}
                          />
                        )}

                        {furniture.includes("photo_wall") && (
                          <motion.div
                            key="furniture-photo-wall"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="absolute top-[32%] left-[23%] flex flex-wrap gap-2 w-32"
                          >
                            {[...Array(4)].map((_, i) => (
                              <div
                                key={i}
                                className="w-12 h-16 bg-white border-4 border-stone-800 shadow-lg p-1 -rotate-[5deg] even:rotate-[5deg]"
                              >
                                <div className="w-full h-full bg-stone-100 flex items-center justify-center overflow-hidden">
                                  <ImageIcon className="w-4 h-4 text-stone-300" />
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}

                        {furniture.includes("lamp") && (
                          <motion.div
                            key="furniture-lamp"
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="absolute top-[43%] left-[32%] flex flex-col items-center"
                          >
                            <div className="w-10 h-10 bg-amber-100 rounded-full blur-xl animate-pulse" />
                            <div className="w-12 h-8 bg-amber-500 rounded-t-full border-2 border-amber-600 relative overflow-hidden">
                              <div className="absolute inset-x-0 bottom-0 h-1 bg-amber-400" />
                            </div>
                            <div className="w-1 h-12 bg-amber-900" />
                            <div className="w-6 h-2 bg-amber-900 rounded-full" />
                          </motion.div>
                        )}

                        {furniture.includes("table") && (
                          <motion.img
                            key="furniture-table"
                            initial={{ opacity: 0, y: -400 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              rotate: [0, 10, -10, 7, -7, 5, -5, 0],
                            }}
                            transition={{
                              y: {
                                type: "spring",
                                damping: 12,
                                stiffness: 80,
                                delay: 0.2,
                              },
                              rotate: { delay: 1.4, duration: 2.0 },
                            }}
                            src="/assets/jianglichaji.png"
                            className="absolute top-[48%] left-[12%] w-24 h-auto z-20"
                            referrerPolicy="no-referrer"
                            onPointerUp={(e) => {
                              if (!isDraggingSceneGlobalRef.current) {
                                setShowTasks(true);
                              }
                            }}
                          />
                        )}

                        {furniture.includes("shafa1") && (
                          <motion.div
                            key="furniture-shafa1"
                            initial={{ opacity: 0, y: -400 }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              rotate: [0, 5, -5, 3, -3, 0],
                            }}
                            transition={{
                              y: {
                                type: "spring",
                                damping: 12,
                                stiffness: 80,
                                delay: 0.5,
                              },
                              rotate: { delay: 1.7, duration: 2.0 },
                            }}
                            className="absolute top-[45%] left-[28%] w-24 h-auto pointer-events-none z-[25]"
                          >
                            <img
                              src="/assets/shafa1.png"
                              alt="Sofa 1"
                              className="w-full h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </motion.div>
                        )}
                      </div>
                      {showReferenceGrid && <CoordinateGridOverlay />}
                    </motion.div>
                    <AnimatePresence>
                      {townBuildingUpgradeToast && scene === "exterior" && (
                        <motion.div
                          key={`building-upgrade-${townBuildingUpgradeToast.key}`}
                          className="absolute left-5 right-5 top-[25%] z-[420] pointer-events-none"
                          initial={{ opacity: 0, y: -18, scale: 0.94 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            scale: [0.94, 1.03, 1],
                          }}
                          exit={{ opacity: 0, y: -12, scale: 0.96 }}
                          transition={{
                            duration: 0.34,
                            scale: {
                              duration: 0.52,
                              ease: [0.22, 1, 0.36, 1],
                            },
                          }}
                        >
                          <div className="mx-auto flex max-w-[360px] items-center gap-3 rounded-[22px] border border-white/65 bg-stone-950/58 px-4 py-3 shadow-[0_18px_42px_rgba(15,23,42,0.28)] backdrop-blur-md">
                            <motion.div
                              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] bg-amber-300 text-amber-900 shadow-[0_5px_0_rgba(180,83,9,0.45)]"
                              animate={{
                                rotate: [0, -8, 8, -4, 0],
                                scale: [1, 1.1, 1],
                              }}
                              transition={{ duration: 0.7, ease: "easeOut" }}
                            >
                              <Trophy className="h-7 w-7" strokeWidth={3} />
                            </motion.div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-amber-200">
                                恭喜
                              </p>
                              <p className="mt-0.5 truncate text-[17px] font-black leading-tight text-white drop-shadow-sm">
                                {townBuildingUpgradeToast.name}
                              </p>
                            </div>
                            <div className="shrink-0 rounded-[16px] bg-white/92 px-3 py-2 text-center shadow-inner">
                              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-stone-400">
                                Upgrade
                              </p>
                              <p className="mt-0.5 text-[15px] font-black leading-none text-[#58CC02]">
                                Lv.{townBuildingUpgradeToast.fromLevel} → Lv.
                                {townBuildingUpgradeToast.toLevel}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* 顶部UI条 (仅室内显示) */}
                  <AnimatePresence>
                    {scene === "interior" && (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="absolute top-6 left-[5%] right-[5%] w-[90%] h-16 bg-white z-[60] flex items-center shadow-md px-3 pointer-events-auto rounded-[24px]"
                      >
                        <div className="flex items-center gap-3 w-full">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              handleExitBuilding();
                              hapticFeedback.light();
                            }}
                            className="w-10 h-10 flex flex-shrink-0 items-center justify-center bg-[#5A52E0] rounded-[16px] shadow-sm ml-1"
                          >
                            <img
                              src="/assets/fanhui.png"
                              alt="Back"
                              className="w-5 h-5 object-contain brightness-0 invert drop-shadow-sm pr-0.5"
                              referrerPolicy="no-referrer"
                            />
                          </motion.button>
                          <div className="flex flex-col justify-center flex-1 relative">
                            <span className="text-[#333] font-black text-[16px] leading-none mb-1 tracking-tight">
                              Home
                            </span>
                            <div
                              className="flex items-center gap-1.5"
                              onClick={() => {
                                setShowStarTooltip(true);
                                setTimeout(
                                  () => setShowStarTooltip(false),
                                  2000,
                                );
                              }}
                            >
                              <span className="text-stone-400 font-extrabold text-[12px] leading-none pb-[1px]">
                                Decor {homeDecorCompletionCount}/3
                              </span>
                              <div className="flex gap-0.5 items-center">
                                {[1, 2, 3].map((idx) => {
                                  const ratio =
                                    homeDecorCompletionCount >= idx ? 1 : 0;
                                  return (
                                    <motion.div
                                      key={idx}
                                      animate={
                                        pulsingStarIdx === idx
                                          ? { scale: [1, 1.4, 1] }
                                          : { scale: 1 }
                                      }
                                      transition={{ duration: 0.5 }}
                                    >
                                      <StarIcon fillRatio={ratio} />
                                    </motion.div>
                                  );
                                })}
                              </div>
                            </div>

                            <AnimatePresence>
                              {showStarTooltip && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                  className="absolute top-10 left-10 bg-[#FFD159] text-[#A66C00] font-black text-[12px] px-3 py-1.5 rounded-xl shadow-md z-50 whitespace-nowrap"
                                >
                                  <div className="absolute -top-1.5 left-4 w-3 h-3 bg-[#FFD159] rotate-45" />
                                  <span className="relative z-10">
                                    家装饰已解锁 {homeDecorCompletionCount}/3
                                  </span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="ml-auto flex items-center h-[34px]">
                            <div className="w-px h-full bg-stone-200 mr-4" />
	                            <div className="flex items-center gap-1.5 shrink-0 text-[#5A52E0]">
	                              <span className="font-black text-[17px] mr-0.5">
	                                {Math.min(8, Math.max(0, quizIndex - 1))}/8
	                              </span>
	                              <Book className="w-[22px] h-[22px]" />
	                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 首次进入场景立绘对话 (introStep === 4) */}
                  <AnimatePresence>
                    {introStep === 4 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[500] pointer-events-auto cursor-pointer flex flex-col justify-end pb-[35vh] px-4 sm:items-center"
                        onClick={() => {
                          setHasSeenHomeIntro(true);
                          setShouldShowHomeIntroThisSession(false);
                          setIntroStep(5);
                        }}
                      >
                        <div className="absolute inset-0" />

                        {/* 对话框与立绘 */}
                        <div className="relative w-full sm:w-full sm:max-w-md z-20 flex flex-col justify-end scale-[0.8] sm:scale-[0.8] origin-bottom">
                          {/* 角色立绘站在侧边，压在对话框后面 */}
                          <div className="relative w-full h-[0px] pointer-events-none z-10">
                            <motion.img
                              initial={{ x: -40, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30,
                              }}
                              src="/assets/BunNPC.png"
                              className="absolute bottom-[-76px] left-[-8%] h-[190px] sm:h-[230px] w-auto max-w-none object-contain drop-shadow-2xl pointer-events-none origin-bottom-left"
                              referrerPolicy="no-referrer"
                            />
                          </div>

                          <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="bg-white/95 backdrop-blur-md rounded-[32px] p-6 pt-10 sm:p-8 sm:pt-12 shadow-[0_10px_40px_rgba(0,0,0,0.2)] border-4 border-stone-100 relative pointer-events-auto w-full z-30"
                          >
                            <div className="absolute -top-5 left-8 bg-amber-400 text-stone-900 px-6 py-1.5 rounded-xl font-black text-lg tracking-wider uppercase shadow-md z-30">
                              Bun
                            </div>
                            <p className="text-[20px] sm:text-[22px] leading-relaxed text-stone-800 font-black relative z-20">
                              Welcome to your new home. If you need any help, just ask me!
                            </p>
                            <p className="text-[16px] sm:text-[18px] leading-relaxed text-stone-500 font-bold mt-2 relative z-20">
                              欢迎来到新家，如果你遇到什么麻烦，随时找我哦。
                            </p>
                            <div className="absolute bottom-3 right-5 text-amber-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 z-20">
                              <motion.span
                                animate={{ opacity: [1, 0.3, 1] }}
                                transition={{
                                  duration: 1.5,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                }}
                              >
                                Tap to Continue ▶
                              </motion.span>
                            </div>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

	                  {/* 场景底部控制 (不论场景 Exterior 或 Interior 都显示) */}
	                  <div className={`absolute bottom-[76px] left-6 right-6 h-[148px] z-[130] pointer-events-none transition-opacity duration-200 ${showQuiz || isPreludeActive || frameworkGuidePanoramaIntro ? "hidden opacity-0" : "opacity-100"}`}>
                    <div className="relative w-full h-full">
                      {/* 左下角复习图标 */}
                      <motion.button
                        type="button"
                        aria-label="打开错题本"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{
                          duration: 0.8,
                          ease: "backOut",
                          delay: 0.15,
                        }}
                        onClick={() => setShowReview(true)}
                        className="absolute left-0 bottom-[72px] w-14 h-14 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 border-2 border-white/90 shadow-[0_8px_20px_rgba(14,165,233,0.35)] flex items-center justify-center cursor-pointer pointer-events-auto touch-manipulation"
                      >
                        <NotebookTabs className="w-7 h-7 text-white drop-shadow-md" strokeWidth={2.8} />
                        {userMistakes.length > 0 && (
                          <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-md">
                            {Math.min(99, userMistakes.length)}
                          </div>
                        )}
                      </motion.button>

                      {/* 左下角任务图标 */}
                      <motion.button
                        type="button"
                        aria-label="打开任务列表"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        initial={{ x: -100, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{
                          duration: 0.8,
                          ease: "backOut",
                          delay: 0.1,
                        }}
                        onClick={() => setShowTasks(true)}
                        className="absolute left-0 bottom-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-500 border-2 border-white/90 shadow-[0_8px_20px_rgba(99,102,241,0.34)] flex items-center justify-center cursor-pointer pointer-events-auto touch-manipulation"
                      >
                        <ListChecks className="w-7 h-7 text-white drop-shadow-md" strokeWidth={2.8} />
                        {currentTasks.filter((t) => !t.isCompleted).length >
                          0 && (
                          <div className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 border-2 border-white flex items-center justify-center z-20 shadow-md">
                            <span className="relative z-10 text-[10px] font-black text-white">
                              {
                                currentTasks.filter((t) => !t.isCompleted)
                                  .length
                              }
                            </span>
                          </div>
                        )}
                      </motion.button>

                      {/* 右下角朋友圈图标 */}
                      {hasCompletedUnit3 && (
                        <motion.button
                          type="button"
                          aria-label="打开朋友圈"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          initial={{ x: 100, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{
                            duration: 0.8,
                            ease: "backOut",
                            delay: 0.15,
	                          }}
	                          onClick={() => {
	                            setShowSocial(true);
	                          }}
	                          className="absolute right-0 bottom-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-lime-500 border-2 border-white/90 shadow-[0_8px_20px_rgba(34,197,94,0.32)] flex items-center justify-center cursor-pointer pointer-events-auto touch-manipulation"
	                        >
	                          <Newspaper className="w-7 h-7 text-white drop-shadow-md" strokeWidth={2.8} />
	                        </motion.button>
                      )}
                    </div>
                  </div>
                  {/* Grid Toggle Button */}
	                  <div className={`absolute top-[88px] right-3 z-[150] pointer-events-auto transition-opacity duration-200 ${showQuiz || isPreludeActive || frameworkGuidePanoramaIntro ? "hidden opacity-0 pointer-events-none" : "opacity-100"}`}>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        if (showReferenceGrid) {
                          persistTownCameraZoom();
                        }
                        setShowReferenceGrid(!showReferenceGrid);
                        hapticFeedback.light();
                      }}
                      className="p-2.5 bg-white/95 hover:bg-white backdrop-blur-md rounded-full shadow-[0_4px_16px_rgba(0,0,0,0.12)] border border-stone-200/60 text-stone-700 flex items-center justify-center transition-all duration-200"
                    >
                      <div className={`w-5 h-5 flex items-center justify-center transition-transform ${showReferenceGrid ? 'opacity-100 text-[#5A52E0]' : 'opacity-65 text-stone-400'}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                          <rect width="18" height="18" x="3" y="3" rx="2" />
                          <path d="M3 9h18" />
                          <path d="M3 15h18" />
                          <path d="M9 3v18" />
                          <path d="M15 3v18" />
                        </svg>
                      </div>
                    </motion.button>
                    <AnimatePresence>
                      {showReferenceGrid && (
                        <motion.div
                          initial={{ opacity: 0, y: -6, scale: 0.92 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -6, scale: 0.92 }}
                          className="absolute right-0 top-12 flex flex-col items-center gap-2"
                        >
	                          <motion.button
	                            whileHover={{ scale: 1.05 }}
	                            whileTap={{ scale: 0.94 }}
                            aria-label="拉近镜头"
                            onClick={() => {
                              adjustTownCameraZoom(1);
                              hapticFeedback.light();
                            }}
                            disabled={
                              townCameraZoom >= TOWN_CAMERA_ZOOM_MAX
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white/96 text-[#5A52E0] shadow-[0_4px_14px_rgba(90,82,224,0.18)] disabled:opacity-45"
                          >
                            <ZoomIn className="h-5 w-5" strokeWidth={2.8} />
                          </motion.button>
	                          <motion.button
	                            whileHover={{ scale: 1.05 }}
	                            whileTap={{ scale: 0.94 }}
	                            aria-label="拉远镜头"
                            onClick={() => {
                              adjustTownCameraZoom(-1);
                              hapticFeedback.light();
                            }}
                            disabled={
                              townCameraZoom <= TOWN_CAMERA_ZOOM_MIN
                            }
                            className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-100 bg-white/96 text-[#5A52E0] shadow-[0_4px_14px_rgba(90,82,224,0.18)] disabled:opacity-45"
	                          >
		                            <ZoomOut className="h-5 w-5" strokeWidth={2.8} />
		                          </motion.button>
                          <div className="mt-1 flex w-[64px] flex-col items-center gap-1 rounded-[18px] border border-sky-100 bg-white/96 p-1.5 shadow-[0_4px_14px_rgba(14,165,233,0.18)]">
                            <div className="rounded-full bg-sky-50 px-2 py-0.5 text-[8px] font-black uppercase leading-none text-sky-600">
                              Speed
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                aria-label="降低滑动速度"
                                onClick={() => {
                                  adjustTownCameraPanSpeed(-1);
                                  hapticFeedback.light();
                                }}
                                disabled={
                                  townCameraPanSpeed <=
                                  TOWN_CAMERA_PAN_SPEED_MIN
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-stone-600 disabled:opacity-40"
                              >
                                <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                              <button
                                type="button"
                                aria-label="提高滑动速度"
                                onClick={() => {
                                  adjustTownCameraPanSpeed(1);
                                  hapticFeedback.light();
                                }}
                                disabled={
                                  townCameraPanSpeed >=
                                  TOWN_CAMERA_PAN_SPEED_MAX
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-white shadow-[0_3px_0_#0369a1] disabled:opacity-40"
                              >
                                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                              </button>
                            </div>
                            <div className="font-mono text-[8px] font-black leading-none text-stone-500">
                              {townCameraPanSpeed.toFixed(2)}x
                            </div>
                          </div>
	                          {selectedTownEditorDecoration &&
	                            selectedTownEditorDecorationPosition && (
                              <div className="mt-1 flex w-[58px] flex-col items-center gap-1 rounded-[18px] border border-emerald-100 bg-white/96 p-1.5 shadow-[0_4px_14px_rgba(16,185,129,0.18)]">
                                <div className="max-w-full truncate rounded-full bg-emerald-50 px-1.5 py-0.5 font-mono text-[8px] font-black leading-none text-emerald-600">
                                  {getTownDecorationUnlockId(
                                    selectedTownEditorDecoration,
                                  )}
                                </div>
                                <button
                                  type="button"
                                  aria-label="缩小装饰"
                                  onClick={() => {
                                    updateTownEditorDecorationWidth(
                                      selectedTownEditorDecoration.id,
                                      -1,
                                    );
                                    hapticFeedback.light();
                                  }}
                                  disabled={
                                    selectedTownEditorDecorationPosition.width <=
                                    TOWN_EDITOR_DECORATION_WIDTH_MIN
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 text-stone-600 disabled:opacity-40"
                                >
                                  <Minus className="h-4 w-4" strokeWidth={3} />
                                </button>
                                <button
                                  type="button"
                                  aria-label="放大装饰"
                                  onClick={() => {
                                    updateTownEditorDecorationWidth(
                                      selectedTownEditorDecoration.id,
                                      1,
                                    );
                                    hapticFeedback.light();
                                  }}
                                  disabled={
                                    selectedTownEditorDecorationPosition.width >=
                                    TOWN_EDITOR_DECORATION_WIDTH_MAX
                                  }
                                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#58CC02] text-white shadow-[0_3px_0_#3f9300] disabled:opacity-40"
                                >
                                  <Plus className="h-4 w-4" strokeWidth={3} />
                                </button>
                                <div className="font-mono text-[8px] font-black leading-none text-stone-500">
                                  {selectedTownEditorDecorationPosition.width.toFixed(
                                    1,
                                  )}
                                  %
                                </div>
                              </div>
                            )}
	                          <div className="rounded-full bg-stone-950/82 px-2 py-1 font-mono text-[9px] font-black leading-none text-white shadow-md">
	                            {Math.round(townCameraZoom * 100)}%
	                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {/* My Profile Scene */}
            {activeTab === "profile" && (
              <motion.div
                key="profile-scene"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute inset-0 bg-[#F7F3F0] px-6 pt-12 pb-32 overflow-y-auto pointer-events-auto"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 border-white shadow-md bg-stone-100 overflow-hidden">
                    <img
                      src="/assets/buntouxiang.png"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-stone-900 font-black text-2xl tracking-tight">
                      {preOnboardingName || "Maple Explorer"}
                    </h2>
                    <p className="text-stone-400 text-sm font-bold uppercase tracking-widest mt-1">
                      Learning Lv: 12
                    </p>

                    {/* Add Learning Language */}
                    <div className="inline-flex items-center gap-1.5 bg-white/60 mt-2 px-2 py-1 rounded-lg border border-white">
                      <span className="text-lg leading-none">🇬🇧</span>
                      <span className="text-stone-600 text-xs font-bold uppercase">
                        English
                      </span>
                    </div>
                  </div>
                </div>

                {/* Town Level */}
                <div className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm mb-6 flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <MapPinned className="w-6 h-6 text-indigo-500" strokeWidth={2.7} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-stone-700 font-bold">
                        Town Level {townEventStep >= 5 ? 2 : 1}
                      </span>
                      <span className="text-amber-500 text-xs font-bold">
                        120/500 XP
                      </span>
                    </div>
                    <div className="h-2 w-full bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 w-[24%]" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm text-center">
                    <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-500 flex items-center justify-center mx-auto mb-2">
                      <Flame className="w-5 h-5" strokeWidth={2.8} />
                    </div>
                    <div className="text-green-500 font-black text-2xl">
                      3 Days
                    </div>
                    <div className="text-stone-400 text-xs uppercase font-bold tracking-tight">
                      Current Streak
                    </div>
                  </div>
                  <div className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm text-center">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-500 flex items-center justify-center mx-auto mb-2">
                      <Trophy className="w-5 h-5" strokeWidth={2.8} />
                    </div>
                    <div className="text-orange-500 font-black text-2xl">
                      15 Days
                    </div>
                    <div className="text-stone-400 text-xs uppercase font-bold tracking-tight">
                      Best Streak
                    </div>
                  </div>
                  <div className="col-span-2 bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm text-center text-center">
                    <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-500 flex items-center justify-center mx-auto mb-2">
                      <Timer className="w-5 h-5" strokeWidth={2.8} />
                    </div>
                    <div className="text-blue-500 font-black text-2xl">
                      12 hr 30 min
                    </div>
                    <div className="text-stone-400 text-xs uppercase font-bold tracking-tight">
                      Total Time
                    </div>
                  </div>
                </div>

                <h3 className="text-stone-800 font-bold mb-3">
                  Building Progress
                </h3>
                <div className="space-y-3 mb-6">
                  <div className="bg-white/60 p-4 rounded-2xl flex items-center justify-between border border-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Armchair className="w-6 h-6 text-blue-500" strokeWidth={2.7} />
                      </div>
                      <div>
                        <div className="text-stone-700 font-bold">
                          Grandma's House
                        </div>
                        <div className="text-stone-400 text-xs font-medium">
                          Furniture & Routine
                        </div>
                      </div>
                    </div>
                    <div className="text-stone-500 font-bold">
                      Lv. {furniture.length + 1}
                    </div>
                  </div>
                  <div className="bg-white/60 p-4 rounded-2xl flex items-center justify-between border border-white opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                        <Store className="w-6 h-6 text-amber-500" strokeWidth={2.7} />
                      </div>
                      <div>
                        <div className="text-stone-700 font-bold">
                          Cafe (Locked)
                        </div>
                        <div className="text-stone-400 text-xs font-medium">
                          Ordering & Socializing
                        </div>
                      </div>
                    </div>
                    <div className="text-stone-500 font-bold">Lv. 0</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Settings", Icon: Settings },
                    { label: "Help", Icon: HelpCircle },
                  ].map((item, idx) => (
                    <motion.div
                      key={`${item.label}-${idx}`}
                      whileTap={{ scale: 0.98 }}
                      className="bg-white/60 p-4 rounded-2xl flex items-center justify-between border border-white cursor-pointer"
                      onClick={() => showMessage(`${item.label} coming soon`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-stone-100 rounded-xl flex items-center justify-center">
                          <item.Icon className="w-5 h-5 text-stone-500" strokeWidth={2.7} />
                        </div>
                        <span className="text-stone-700 font-bold">{item.label}</span>
                      </div>
                      <div className="w-6 h-6 flex items-center justify-center opacity-30">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Developer Tools / Test Controls */}
                <div className="mt-8 pt-6 border-t border-stone-200">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1.5 h-4 bg-rose-500 rounded-full" />
                    <h3 className="text-stone-800 font-bold text-xs uppercase tracking-wider">
                      Developer Sandbox / 调试功能
                    </h3>
                  </div>

                  <div className="mb-3 rounded-3xl border border-sky-100 bg-white/80 p-4 shadow-sm">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-black text-stone-800">
                          测试 ID 管理
                        </h4>
                        <p className="mt-1 text-[11px] font-bold leading-relaxed text-stone-400">
                          本机创建或读取过的 ID 会记录在这里，删除会同步清理服务器进度。
                        </p>
                      </div>
                      <div className="rounded-2xl bg-sky-100 px-3 py-2 text-[12px] font-black text-sky-600">
                        {knownPlayerIds.length}
                      </div>
                    </div>

                    {knownPlayerIds.length === 0 ? (
                      <div className="rounded-2xl bg-stone-50 px-4 py-3 text-center text-[12px] font-bold text-stone-400">
                        暂无测试 ID
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {knownPlayerIds.map((playerId) => {
                          const isCurrent = appUserId === playerId;
                          return (
                            <div
                              key={playerId}
                              className="flex items-center justify-between gap-3 rounded-2xl bg-stone-50 px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-[16px] font-black tracking-[0.12em] text-stone-800">
                                    {playerId}
                                  </span>
                                  {isCurrent && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-600">
                                      当前
                                    </span>
                                  )}
                                </div>
                                <p className="mt-0.5 text-[10px] font-bold text-stone-400">
                                  {isCurrent
                                    ? "删除后会清除本机登录并重启"
                                    : "可删除服务器中的测试进度"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  hapticFeedback.light?.();
                                  setDeletePlayerIdPrompt(playerId);
                                }}
                                disabled={deletingPlayerId === playerId}
                                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-500 active:scale-95 disabled:opacity-50"
                                aria-label={`删除 ID ${playerId}`}
                              >
                                <Trash2 className="h-5 w-5" strokeWidth={2.7} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <motion.div
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      hapticFeedback.success?.();
                      setShowResetConfirm(true);
                    }}
                    className="bg-rose-50 hover:bg-rose-100 border border-rose-200/60 p-4 rounded-2xl flex items-center justify-between cursor-pointer transition-colors duration-200"
                  >
                    <div className="flex items-center gap-3 font-sans">
                      <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-500">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <div className="text-rose-700 font-black text-sm">
                          清除进度并重启游戏
                        </div>
                        <div className="text-rose-400 text-[10px] font-bold mt-0.5">
                          Clear and Reset All Game Progress
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-rose-300" />
                  </motion.div>
                </div>
              </motion.div>
            )}

            {activeTab === "ai_custom" && (
              <AiCustomQuizScreen
                stamina={stamina}
                setGlobalStamina={setStamina}
                onClose={() => setActiveTab("town")}
              />
            )}

            {/* AI Courses Scene */}
            {activeTab === "ai_course" && (
              <motion.div
                key="ai-course-scene"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="absolute inset-0 bg-[#F7F3F0] px-6 pt-12 pb-32 overflow-y-auto pointer-events-auto"
              >
                <div className="flex flex-col mb-6">
                  <h2 className="text-stone-900 font-black text-3xl tracking-tight">
                    AI Speaking Course
                  </h2>
                  <p className="text-stone-500 font-bold mt-2">
                    Choose a scene to start practicing
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-stone-800 font-black text-xl mb-4">
                      Scene Categories
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div
                        onClick={() => setAiPracticeCategory("Community")}
                        className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-blue-200 transition-colors flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-3">
                          <Home className="w-8 h-8 text-blue-500" />
                        </div>
                        <h4 className="text-stone-800 font-extrabold">
                          Community
                        </h4>
                      </div>
                      <div
                        onClick={() => setAiPracticeCategory("Cafe")}
                        className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-amber-200 transition-colors flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-3">
                          <Coffee className="w-8 h-8 text-amber-500" />
                        </div>
                        <h4 className="text-stone-800 font-extrabold">Cafe</h4>
                      </div>
                      <div
                        onClick={() => setAiPracticeCategory("Hospital")}
                        className="bg-white p-4 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-red-200 transition-colors flex flex-col items-center text-center"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mb-3">
                          <Plus className="w-8 h-8 text-red-500" />
                        </div>
                        <h4 className="text-stone-800 font-extrabold">
                          Hospital
                        </h4>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-stone-800 font-black text-xl mb-4">
                      Detailed Situations
                    </h3>
                    <div className="space-y-4">
                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-orange-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">🛵</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Ordering Takeout
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Learn to order food via phone or app.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-green-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">🍳</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Cooking
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Discussing recipes and ingredients.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-purple-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">📦</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Picking Up Package
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Talking to couriers and post office.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-3xl border-2 border-stone-100 shadow-sm cursor-pointer hover:border-teal-200 transition-colors">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-3xl">🎒</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-stone-800 font-extrabold text-xl">
                              Getting Things
                            </h4>
                            <p className="text-stone-400 text-sm font-bold mt-1">
                              Asking someone to grab items for you.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 顶部资源条 - 全局显示 (在 Profile / AI Course 界面或建筑内场景隐藏) */}
	        <div
	          className={`absolute top-10 left-0 right-0 px-4 z-[260] transition-opacity duration-300 ${showQuiz || isPreludeActive || frameworkGuidePanoramaIntro ? "hidden opacity-0 pointer-events-none" : activeTab !== "town" || (activeTab === "town" && scene === "interior") ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100 pointer-events-auto"}`}
	        >
          <div className="relative">
            <div className="h-[58px] rounded-[22px] bg-white/95 backdrop-blur-xl border border-white shadow-[0_8px_24px_rgba(15,23,42,0.12)] px-2.5 flex items-center gap-2">
              <button
                type="button"
                aria-label="切换语言"
                onClick={() => {
                  setTopResourceHint(null);
                  setIsTopLanguageMenuOpen((prev) => !prev);
                }}
                className="h-11 min-w-[76px] rounded-[16px] bg-sky-50 border border-sky-100 flex items-center justify-center gap-1.5 px-2 active:scale-95 transition-transform"
              >
                <span className="text-[26px] leading-none">{selectedTopLanguage.flag}</span>
                <span className="text-[15px] font-black text-stone-800 leading-none">
                  {selectedTopLanguage.short}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-sky-500" strokeWidth={3} />
              </button>

	              <motion.button
	                type="button"
                  ref={topCityProgressRef}
	                aria-label="查看城市等级与课程进度"
	                onClick={() => {
	                  setIsTopLanguageMenuOpen(false);
	                  setTopResourceHint(null);
	                  setShowCourseOutline(true);
	                }}
                  animate={
                    townProgressCatchPulse
                      ? {
                          x: [0, -5, 4, -3, 2, 0],
                          rotate: [0, -2, 2, -1, 1, 0],
                          scale: [1, 1.05, 1.02, 1.04, 1],
                        }
                      : { x: 0, rotate: 0, scale: 1 }
                  }
                  transition={{ duration: 0.58, ease: "easeOut" }}
	                className={`h-11 flex-1 min-w-[120px] rounded-[16px] border px-3 py-1.5 flex flex-col justify-center active:scale-[0.98] transition-all ${
                    townProgressPulse
                      ? "bg-emerald-50 border-emerald-200 shadow-[0_0_20px_rgba(34,197,94,0.28)]"
                      : "bg-indigo-50 border-indigo-100"
                  }`}
	              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPinned
                      className={`w-4 h-4 shrink-0 ${townProgressPulse ? "text-emerald-500" : "text-indigo-500"}`}
                      strokeWidth={3}
                    />
                    <span className="text-[12px] font-black text-stone-800 truncate">
                      {topBuildingTitle}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black shrink-0 ${townProgressPulse ? "text-emerald-600" : "text-indigo-500"}`}>
                    {topBuildingProgressLabel}
                  </span>
                </div>
                <div className={`mt-1.5 h-1.5 rounded-full overflow-hidden ${townProgressPulse ? "bg-emerald-100" : "bg-indigo-100"}`}>
                  <motion.div
                    className={`h-full rounded-full ${townProgressPulse ? "bg-emerald-500" : "bg-indigo-500"}`}
                    animate={{ width: `${topBuildingProgress * 100}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 18 }}
                  />
                </div>
              </motion.button>

	              <motion.button
	                type="button"
	                aria-label="查看连胜说明"
	                onClick={() => {
	                  setIsTopLanguageMenuOpen(false);
	                  setTopResourceHint(null);
	                  setShowStreakPanel(true);
	                }}
                animate={streakJustLit ? { scale: [1, 1.25, 1], rotate: [0, -8, 6, 0] } : { scale: 1 }}
                transition={{ duration: 0.8 }}
                className={`h-11 min-w-[58px] rounded-[16px] border px-2 flex items-center justify-center gap-1 active:scale-95 ${
                  streakDays > 0
                    ? "bg-orange-50 border-orange-100 text-orange-500"
                    : "bg-stone-100 border-stone-200 text-stone-400"
                }`}
              >
                <Flame
                  className={`w-5 h-5 ${streakDays > 0 ? "fill-orange-400" : "fill-stone-300"}`}
                  strokeWidth={2.7}
                />
                <span className="text-[15px] font-black">{streakDays}</span>
              </motion.button>

	              <button
	                type="button"
                  ref={staminaPillRef}
	                aria-label="查看体力说明"
	                onClick={() => {
	                  setStamina((prev) => prev + 5);
	                  setTopResourceHint(null);
	                  setIsTopLanguageMenuOpen(false);
	                  hapticFeedback.success?.();
	                  showMessage("体力 +5");
	                }}
                className="h-11 min-w-[62px] rounded-[16px] bg-cyan-50 border border-cyan-100 px-2 flex items-center justify-center gap-1 text-cyan-600 active:scale-95 transition-transform"
              >
                <Zap className="w-5 h-5 fill-cyan-400" strokeWidth={2.7} />
                <span className="text-[15px] font-black">{stamina}</span>
              </button>
            </div>

            <AnimatePresence>
              {topResourceHint && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  className="absolute right-0 top-[66px] max-w-[260px] rounded-[18px] bg-stone-900/95 text-white shadow-[0_14px_34px_rgba(15,23,42,0.28)] px-4 py-3 z-[420] border border-white/10"
                >
                  <div className="absolute -top-1.5 right-8 w-3 h-3 bg-stone-900/95 rotate-45 border-l border-t border-white/10" />
                  <p className="text-[13px] font-bold leading-snug">
                    {topResourceHintText[topResourceHint]}
                  </p>
                </motion.div>
              )}

              {isTopLanguageMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  className="absolute left-0 top-[66px] w-[170px] rounded-[20px] bg-white border border-stone-100 shadow-[0_14px_34px_rgba(15,23,42,0.18)] p-2 z-[430]"
                >
                  {[
                    { label: "English", short: "EN", flag: "🇬🇧" },
                    { label: "Spanish", short: "ES", flag: "🇪🇸" },
                  ].map((lang) => {
                    const selected = selectedLang === lang.label;
                    return (
                      <button
                        key={lang.label}
                        type="button"
                        onClick={() => {
                          setSelectedLang(lang.label);
                          setIsTopLanguageMenuOpen(false);
                          if (lang.label === "Spanish") {
                            showMessage("西班牙语入口已切换，课程内容后续接入");
                          }
                        }}
                        className={`w-full h-11 rounded-[14px] flex items-center gap-2 px-3 text-left active:scale-[0.98] transition-all ${
                          selected ? "bg-sky-50 text-sky-600" : "text-stone-600 hover:bg-stone-50"
                        }`}
                      >
                        <span className="text-xl">{lang.flag}</span>
                        <span className="font-black text-[14px] flex-1">{lang.label}</span>
                        {selected && <CheckCircle2 className="w-4 h-4" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {townDecorProgressParticles && (
            <motion.div
              key={`town-progress-particles-${townDecorProgressParticles.key}`}
              className="absolute inset-0 z-[520] pointer-events-none overflow-hidden"
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {Array.from({ length: townDecorProgressParticles.count }).map(
                (_, particleIndex) => {
                  const direction = particleIndex % 2 === 0 ? 1 : -1;
                  const arc =
                    direction * (26 + ((particleIndex * 11) % 34));
                  const lift = 32 + ((particleIndex * 17) % 46);
                  const delay = particleIndex * 0.028;
                  const midX =
                    (townDecorProgressParticles.endX -
                      townDecorProgressParticles.startX) /
                      2 +
                    arc;
                  const midY =
                    (townDecorProgressParticles.endY -
                      townDecorProgressParticles.startY) /
                      2 -
                    lift;

                  return (
                    <motion.span
                      key={`town-progress-particle-${particleIndex}`}
                      className={`absolute h-2 w-2 rounded-full shadow-[0_0_12px_rgba(74,222,128,0.95)] ${
                        particleIndex % 3 === 0
                          ? "bg-yellow-300"
                          : particleIndex % 3 === 1
                            ? "bg-emerald-300"
                            : "bg-sky-300"
                      }`}
                      style={{
                        left: townDecorProgressParticles.startX,
                        top: townDecorProgressParticles.startY,
                      }}
                      initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
                      animate={{
                        x: [
                          0,
                          midX,
                          townDecorProgressParticles.endX -
                            townDecorProgressParticles.startX,
                        ],
                        y: [
                          0,
                          midY,
                          townDecorProgressParticles.endY -
                            townDecorProgressParticles.startY,
                        ],
                        scale: [0.35, 1.2, 0.45],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 0.86,
                        delay,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    />
                  );
                },
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {townGarbageEnergyFlight && (
            <motion.div
              key={`town-garbage-energy-${townGarbageEnergyFlight.key}`}
              className="absolute inset-0 z-[124000] pointer-events-none overflow-hidden"
            >
              <motion.div
                className="absolute flex h-[68px] w-[68px] items-center justify-center rounded-full border-[3px] border-white bg-cyan-400 text-white shadow-[0_0_32px_rgba(34,211,238,0.72)]"
                style={{
                  left: townGarbageEnergyFlight.startX,
                  top: townGarbageEnergyFlight.startY,
                  marginLeft: -34,
                  marginTop: -34,
                }}
                initial={{ opacity: 0, scale: 0.45, x: 0, y: 0, rotate: -8 }}
                animate={{
                  opacity: [0, 1, 1, 0],
                  scale: [0.45, 1.18, 0.8, 0.35],
                  x: townGarbageEnergyFlight.endX - townGarbageEnergyFlight.startX,
                  y: townGarbageEnergyFlight.endY - townGarbageEnergyFlight.startY,
                  rotate: [0, -10, 12, 0],
                }}
                transition={{ duration: 0.96, ease: [0.22, 1, 0.36, 1] }}
              >
                <Zap className="h-8 w-8 fill-white" strokeWidth={3} />
              </motion.div>
              {Array.from({ length: 8 }).map((_, trailIndex) => (
                <motion.span
                  key={`town-garbage-energy-trail-${trailIndex}`}
                  className="absolute h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.9)]"
                  style={{
                    left: townGarbageEnergyFlight.startX,
                    top: townGarbageEnergyFlight.startY,
                  }}
                  initial={{ opacity: 0, scale: 0.2, x: 0, y: 0 }}
                  animate={{
                    opacity: [0, 0.9, 0],
                    scale: [0.2, 1, 0.25],
                    x:
                      (townGarbageEnergyFlight.endX -
                        townGarbageEnergyFlight.startX) *
                        (0.18 + trailIndex * 0.075) -
                      12 +
                      (trailIndex % 3) * 10,
                    y:
                      (townGarbageEnergyFlight.endY -
                        townGarbageEnergyFlight.startY) *
                        (0.18 + trailIndex * 0.075) -
                      16 +
                      (trailIndex % 2) * 14,
                  }}
                  transition={{
                    duration: 0.78,
                    delay: trailIndex * 0.035,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {townGarbageTip && (
            <motion.div
              key={`town-garbage-tip-${townGarbageTip.key}`}
              className="absolute left-1/2 top-[46%] z-[124100] w-[260px] -translate-x-1/2 pointer-events-none"
              initial={{ opacity: 0, y: 18, scale: 0.86 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.94 }}
              transition={{ type: "spring", damping: 16, stiffness: 190 }}
            >
              <div className="rounded-[24px] border-2 border-cyan-100 bg-white/97 px-5 py-4 text-center shadow-[0_18px_42px_rgba(8,145,178,0.26)]">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100 text-cyan-600">
                  <Zap className="h-7 w-7 fill-cyan-400" strokeWidth={3} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-500">
                  Tips
                </p>
                <p className="mt-1 text-[16px] font-black text-stone-800">
                  {townGarbageTip.text}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 顶部的任务引导卡片 */}
	        <div
	          className={`absolute top-[100px] left-0 right-0 z-[90] pointer-events-none justify-center overflow-x-hidden min-h-[231px] transition-opacity duration-300 ${
			            showQuiz ||
                    isPreludeActive ||
                    showReferenceGrid ||
                    pendingDirectTownDecorUnlocks.length > 0 ||
                    townDecorUnlockAnimation ||
                    townDecorRewardReveal ||
                    frameworkGuidePanoramaIntro ||
                    newTownDecorBubbleIds.length > 0
			              ? "hidden opacity-0"
	              :
	            activeTab === "town" && scene === "exterior" && !showQuiz
	              ? showLevelConfirm
	                ? "flex opacity-35 saturate-50"
	                : isDraggingScene
                    ? "flex opacity-20"
                    : "flex opacity-100"
	              : "opacity-0"
	          }`}
	        >
	          <AnimatePresence mode="popLayout">
		            {showTopCard &&
		              topTaskCardTask &&
		              ((townEventStep !== 2 &&
	                townEventStep < 5 &&
	                dismissedCardPhase === 0) ||
	                (townEventStep >= 5 &&
	                  dismissedCardPhase < EXTERIOR_TASKS.length)) && (
	                <motion.div
	                  key={`top-task-card-${topTaskCardTask.taskId}-${animatingCompletedPhase ?? "active"}`}
                  initial={{ opacity: 0, x: 200, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -200, scale: 0.95 }}
                  transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  role="button"
                  tabIndex={0}
	                  aria-label={`打开任务卡片：${topTaskCardTask.title || "当前任务"}`}
                  onClick={() => {
                    if (animatingCompletedPhase === null) {
                      handleStartGame();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (
                      animatingCompletedPhase === null &&
                      (e.key === "Enter" || e.key === " ")
                    ) {
                      e.preventDefault();
                      handleStartGame();
                    }
                  }}
	                  className={`absolute drop-shadow-lg w-[246px] h-[185px] cursor-pointer ${showLevelConfirm || isDraggingScene ? "pointer-events-none" : "pointer-events-auto"}`}
                >
                  <img
                    src="/assets/1renwukapian.png"
                    alt="Task Panel"
                    className="w-full h-full block"
                    referrerPolicy="no-referrer"
                  />

                  {/* 覆盖的视频/图片内容 */}
		                  <div className="absolute top-[18px] left-[11px] w-[224px] h-[99px] rounded-[12px] overflow-hidden">
		                    <img
		                      src={`/assets/lesson-scenes/lesson_${Math.min(8, topTaskCardTask.linkedLessonId || topTaskCardTask.taskId)}_start.png`}
	                      className="w-full h-full object-cover"
	                      referrerPolicy="no-referrer"
	                      onError={(e) => {
	                        const target = e.target as HTMLImageElement;
	                        if (!target.src.includes("lesson_1_start.png")) {
	                          target.src = "/assets/lesson-scenes/lesson_1_start.png";
	                        }
	                      }}
	                    />
                    {/* 可选：叠加一层渐变以免遮挡文本太生硬，如果原卡片自带了阴影的话可以加点渐变 */}
                    <div className="absolute inset-x-0 bottom-0 h-[58px] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />
                  </div>

                  {/* 奖励内容：按小镇装饰 id 展示 */}
	                  {(() => {
	                    const reward = getTownDecorationRewardForTask(
	                      topTaskCardTask.linkedLessonId,
	                      topTaskCardTask.reward_item_id,
	                    );

                    return (
                      <div className="absolute top-[5px] right-[7px] z-10 flex h-[60px] w-[60px] items-center justify-center rounded-[18px] border border-white/90 bg-gradient-to-br from-white via-amber-50 to-emerald-50 shadow-[0_8px_18px_rgba(82,60,28,0.22)]">
                        <div className="absolute inset-[4px] rounded-[14px] border border-amber-200/70 bg-white/65" />
                        {reward ? (
                          <>
                            <img
                              src={getTownDecorationRewardIconSrc(
                                reward.primaryDecoration,
                              )}
                              alt={reward.primaryDecoration.id}
                              className="relative z-10 h-[52px] w-[52px] object-contain drop-shadow-md"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (target.dataset.fallbackSrc === "true")
                                  return;
                                target.dataset.fallbackSrc = "true";
                                target.src = reward.primaryDecoration.src;
                              }}
                            />
                          </>
                        ) : (
                          <Gift
                            className="relative z-10 h-8 w-8 text-amber-500"
                            strokeWidth={2.8}
                          />
                        )}
                      </div>
                    );
                  })()}

                  <div className="absolute top-[91px] left-5 right-5 z-10 flex flex-col justify-end">
                    {/* 任务标题（一行显示） */}
	                    <h3 className="w-full rounded-[7px] bg-stone-500/38 px-2 py-0.5 text-left font-black text-white text-[22px] leading-none whitespace-nowrap overflow-hidden text-ellipsis backdrop-blur-[1px] drop-shadow-[0_2px_5px_rgba(0,0,0,0.72)]">
	                      {topTaskCardTask.title}
	                    </h3>
                  </div>

                  {/* Buttom Buttons */}
                  <div className="absolute bottom-3 left-4 right-4 flex justify-between gap-2.5 z-10">
                    <button
                      className={`flex-1 border-2 border-[#6C63FF] bg-white text-[#6C63FF] rounded-full py-1 font-black text-[12px] shadow-sm tracking-wide transition-opacity pointer-events-auto cursor-pointer ${animatingCompletedPhase !== null ? "opacity-30" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (animatingCompletedPhase === null) {
                          setShowTopCard(false);
                          setShowGrannyExclamation(true);
                          setIsGrandmaIntroShown(true);
                        }
                      }}
                    >
                      Later
                    </button>
                    <motion.button
                      className={`relative flex-1 flex items-center justify-center text-white rounded-full py-1 font-black text-[12px] tracking-wide transition-colors pointer-events-auto cursor-pointer ${animatingCompletedPhase !== null ? "bg-green-500 shadow-md" : "bg-[#6C63FF]"}`}
                      animate={
                        animatingCompletedPhase === null
                          ? {
                              scale: [1, 1.05, 1],
                              boxShadow: [
                                "0px 4px 6px -1px rgba(0, 0, 0, 0.1)",
                                "0px 0px 15px rgba(108,99,255,0.7)",
                                "0px 4px 6px -1px rgba(0, 0, 0, 0.1)",
                              ],
                            }
                          : {
                              scale: 1,
                              boxShadow: "0px 4px 6px -1px rgba(0, 0, 0, 0.1)",
                            }
                      }
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (animatingCompletedPhase === null) {
                          playStartCtaVoice("start");
                          handleStartGame();
                        }
                      }}
                    >
                      {idleTownGuideTarget === "task" &&
                        animatingCompletedPhase === null && (
                          <>
                            <motion.span
                              className="absolute -inset-2 rounded-full border-2 border-[#58CC02] pointer-events-none"
                              animate={{
                                opacity: [0.25, 1, 0.25],
                                scale: [1, 1.12, 1],
                              }}
                              transition={{
                                duration: 1.15,
                                repeat: Infinity,
                                ease: "easeInOut",
                              }}
                            />
                            <motion.span
                              className="absolute -top-[48px] left-1/2 z-30 flex -translate-x-1/2 flex-col items-center pointer-events-none"
                              initial={{ opacity: 0, y: -6, scale: 0.92 }}
                              animate={{
                                opacity: 1,
                                y: [0, 7, 0],
                                scale: 1,
                              }}
                              transition={{
                                y: {
                                  duration: 1,
                                  repeat: Infinity,
                                  ease: "easeInOut",
                                },
                                opacity: { duration: 0.2 },
                                scale: { duration: 0.2 },
                              }}
                            >
                              <span className="flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-[#58CC02] shadow-[0_0_18px_rgba(88,204,2,0.65)]">
                                <ArrowBigDown
                                  className="h-5 w-5 translate-y-[2px] text-white"
                                  fill="currentColor"
                                />
                              </span>
                            </motion.span>
                          </>
                        )}
                      {animatingCompletedPhase !== null ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        "Start"
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>
        </div>

        {/* 转场图层 */}
        <motion.div
          className={`absolute inset-0 z-[100] ${
            isTransitioning ? "pointer-events-auto" : "pointer-events-none"
          }`}
          initial={false}
          animate={{
            y: isTransitioning ? ["-100%", "0%", "0%", "-100%"] : "-100%",
          }}
          transition={{
            duration: 1.8,
            times: [0, 0.4, 0.6, 1],
            ease: "easeInOut",
          }}
        >
          <img
            src="/assets/zairu.png"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </motion.div>

	        {/* Toast */}
	        <AnimatePresence>
	          {toast && (
              (() => {
                const isStaminaToast = toast.includes("体力不足");

                return (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: isStaminaToast ? -18 : 20,
                      scale: isStaminaToast ? 0.94 : 1,
                    }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: isStaminaToast ? -12 : 8 }}
                    className={`absolute left-1/2 -translate-x-1/2 pointer-events-none ${
                      isStaminaToast
                        ? "top-[20%] z-[2147483000]"
                        : "bottom-64 z-[200]"
                    }`}
                  >
                    <div
                      className={`border px-6 py-3 rounded-2xl flex items-center gap-3 shadow-[0_16px_36px_rgba(15,23,42,0.28)] ${
                        isStaminaToast
                          ? "bg-stone-950/92 border-white/15"
                          : "bg-black/80 border-white/10"
                      }`}
                    >
                      <span className="text-white text-xs font-bold uppercase">
                        {toast}
                      </span>
                    </div>
                  </motion.div>
                );
              })()
	          )}
	        </AnimatePresence>

        <AnimatePresence>
          {showStaminaRecoveryPrompt && (
            <motion.div
              className="absolute inset-0 z-[113500] flex items-center justify-center bg-slate-950/36 px-6 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStaminaRecoveryPrompt(false)}
            >
              {(() => {
                const garbageRemaining = Math.max(
                  0,
                  TOWN_GARBAGE_DAILY_REWARD_LIMIT -
                    todayTownGarbageRewardCount,
                );
                const garbageStatus = !hasCompletedUnit1
                  ? "Unit 1 后解锁"
                  : garbageRemaining > 0
                    ? `今日还可获得 ${garbageRemaining} 次`
                    : "今日已用完";
                const reviewStatus = hasClaimedReviewStaminaToday
                  ? "今日已使用"
                  : userMistakes.length > 0
                    ? "今日还可获得 1 次"
                    : "暂无错题可复习";

                return (
                  <motion.div
                    className="w-full max-w-[350px] rounded-[30px] border border-white bg-white p-5 text-left shadow-[0_24px_58px_rgba(15,23,42,0.32)]"
                    initial={{ opacity: 0, y: 28, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 18, scale: 0.96 }}
                    transition={{ type: "spring", damping: 18, stiffness: 210 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-[12px] font-black text-rose-500">
                          <Zap className="h-3.5 w-3.5 fill-rose-400" strokeWidth={3} />
                          体力不足
                        </div>
                        <h3 className="mt-3 text-[23px] font-black leading-tight text-stone-900">
                          先恢复一点体力吧
                        </h3>
                        <p className="mt-1 text-[13px] font-bold leading-relaxed text-stone-500">
                          可以通过清理路上的垃圾，或完成错题复习来获得体力。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowStaminaRecoveryPrompt(false)}
                        className="h-9 w-9 shrink-0 rounded-full bg-stone-100 text-[18px] font-black text-stone-400 active:scale-95"
                        aria-label="关闭体力恢复提示"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="rounded-[22px] border border-cyan-100 bg-cyan-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-cyan-400 text-white shadow-[0_4px_0_#0891b2]">
                              <Zap className="h-6 w-6 fill-white" strokeWidth={3} />
                            </div>
                            <div>
                              <p className="text-[15px] font-black text-stone-900">
                                捡垃圾
                              </p>
                              <p className="text-[12px] font-bold text-cyan-700">
                                {garbageStatus}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-[12px] font-black text-cyan-700">
                            {todayTownGarbageRewardCount}/
                            {TOWN_GARBAGE_DAILY_REWARD_LIMIT}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={!hasCompletedUnit1 || garbageRemaining <= 0}
                          onClick={jumpToTownGarbageFromRecovery}
                          className="mt-3 h-11 w-full rounded-[16px] bg-[#1CB0F6] text-[14px] font-black text-white shadow-[0_4px_0_#1688C8] active:translate-y-[3px] active:shadow-none disabled:bg-stone-300 disabled:shadow-[0_4px_0_#a8a29e]"
                        >
                          去捡垃圾
                        </button>
                      </div>

                      <div className="rounded-[22px] border border-amber-100 bg-amber-50 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-amber-400 text-white shadow-[0_4px_0_#c27a00]">
                              <NotebookTabs className="h-6 w-6" strokeWidth={3} />
                            </div>
                            <div>
                              <p className="text-[15px] font-black text-stone-900">
                                做错题
                              </p>
                              <p className="text-[12px] font-bold text-amber-700">
                                {reviewStatus}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-[12px] font-black text-amber-700">
                            {hasClaimedReviewStaminaToday ? 1 : 0}/1
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={jumpToReviewFromRecovery}
                          className="mt-3 h-11 w-full rounded-[16px] bg-[#58CC02] text-[14px] font-black text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none"
                        >
                          去错题本
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {townGarbagePrompt && (
            <motion.div
              key={`town-garbage-prompt-${townGarbagePrompt.key}`}
              className="absolute inset-0 z-[113000] flex items-center justify-center bg-black/34 px-6 pointer-events-auto"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setTownGarbagePrompt(null)}
            >
              <motion.div
                className="w-full max-w-[360px] rounded-[30px] border border-white bg-white p-5 shadow-[0_24px_54px_rgba(15,23,42,0.28)]"
                initial={{ opacity: 0, y: 34, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.94 }}
                transition={{ type: "spring", damping: 17, stiffness: 180 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500">
                      Clean-up
                    </p>
	                    <h3 className="mt-1 text-[23px] font-black leading-tight text-stone-900">
	                      趣味拼词题
	                    </h3>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-[12px] font-black text-cyan-700">
                      <Zap className="h-3.5 w-3.5 fill-cyan-400" strokeWidth={3} />
                      答对奖励 +1 体力
                    </div>
	                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-cyan-50 text-cyan-600 shadow-inner">
                    <Zap className="h-7 w-7 fill-cyan-400" strokeWidth={3} />
                  </div>
                </div>

	                <div className="mt-4 rounded-[22px] border border-emerald-100 bg-emerald-50 px-4 py-3">
	                  <p className="text-[13px] font-bold leading-relaxed text-stone-700">
                    把这个英文词拼出来：
                    <span className="font-black text-emerald-700">
                      {townGarbagePrompt.challenge.meaning}
                    </span>
                  </p>
	                  <p className="mt-1 text-[12px] font-semibold leading-snug text-emerald-700/80">
	                    {townGarbagePrompt.challenge.hint}
	                  </p>
                  <p className="mt-2 rounded-full bg-white/70 px-3 py-1 text-center text-[12px] font-black text-cyan-700">
                    清理成功后获得 1 点体力
                  </p>
	                </div>

                <div className="mt-4 flex min-h-[54px] flex-wrap items-center justify-center gap-2 rounded-[20px] bg-stone-100 px-3 py-3">
                  {townGarbagePrompt.selected.length === 0 ? (
                    Array.from({ length: townGarbageTarget.length }).map(
                      (_, index) => (
                        <span
                          key={`garbage-blank-${index}`}
                          className="h-8 w-7 rounded-[10px] border-2 border-dashed border-stone-300 bg-white/55"
                        />
                      ),
                    )
                  ) : (
                    <>
                      {townGarbagePrompt.selected.map((tile) => (
                        <button
                          key={`selected-garbage-letter-${tile.id}`}
                          type="button"
                          onClick={() => returnGarbageLetter(tile.id)}
                          className="flex h-10 w-9 items-center justify-center rounded-[12px] bg-white text-[18px] font-black text-stone-800 shadow-[0_4px_0_#d6d3d1] active:translate-y-[3px] active:shadow-none"
                        >
                          {tile.char}
                        </button>
                      ))}
                      {Array.from({
                        length:
                          townGarbageTarget.length -
                          townGarbagePrompt.selected.length,
                      }).map((_, index) => (
                        <span
                          key={`garbage-rest-blank-${index}`}
                          className="h-8 w-7 rounded-[10px] border-2 border-dashed border-stone-300 bg-white/55"
                        />
                      ))}
                    </>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {townGarbagePrompt.available.map((tile) => (
                    <button
                      key={`available-garbage-letter-${tile.id}`}
                      type="button"
                      onClick={() => selectGarbageLetter(tile.id)}
                      className="h-11 rounded-[14px] bg-[#6C63FF] text-[18px] font-black text-white shadow-[0_4px_0_#4f46e5] active:translate-y-[3px] active:shadow-none"
                    >
                      {tile.char}
                    </button>
                  ))}
                </div>

                <AnimatePresence>
                  {townGarbagePrompt.wrong && (
                    <motion.p
                      className="mt-3 rounded-[14px] bg-rose-50 px-3 py-2 text-center text-[12px] font-black text-rose-500"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                    >
                      还差一点，换个顺序再试试。
                    </motion.p>
                  )}
                </AnimatePresence>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={resetGarbageLetters}
                    className="h-[48px] w-[96px] rounded-[17px] border-2 border-stone-200 bg-white text-[14px] font-black text-stone-500 active:scale-[0.97]"
                  >
                    重排
                  </button>
                  <button
                    type="button"
                    disabled={townGarbageAnswer.length !== townGarbageTarget.length}
                    onClick={completeTownGarbageChallenge}
                    className={`h-[48px] flex-1 rounded-[17px] text-[15px] font-black text-white shadow-[0_5px_0_rgba(63,147,0,0.95)] active:translate-y-[4px] active:shadow-none ${
                      townGarbageAnswer.length === townGarbageTarget.length
                        ? "bg-[#58CC02]"
                        : "bg-stone-300 shadow-[0_5px_0_#a8a29e]"
                    }`}
                  >
	                    清理垃圾 · +1 体力
	                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

	        {/* 指定装饰解锁确认弹窗 */}
	        <AnimatePresence>
	          {targetDecorationPrompt &&
              targetDecorationPromptBuilding &&
              targetDecorationPromptDecoration && (
	            <motion.div
	              initial={{ opacity: 0 }}
	              animate={{ opacity: 1 }}
	              exit={{ opacity: 0 }}
	              className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/10 px-8 pointer-events-auto"
	              onClick={() => setTargetDecorationPrompt(null)}
	            >
	              <motion.div
	                initial={{ opacity: 0, y: 18, scale: 0.92 }}
	                animate={{ opacity: 1, y: 0, scale: 1 }}
	                exit={{ opacity: 0, y: 12, scale: 0.96 }}
	                transition={{ type: "spring", damping: 22, stiffness: 300 }}
	                className="relative w-full max-w-[330px] rounded-[26px] bg-white px-5 py-5 text-center shadow-[0_18px_44px_rgba(15,23,42,0.24)] border border-white"
	                onClick={(e) => e.stopPropagation()}
	              >
                  <div className="mx-auto mb-3 flex h-[82px] w-[82px] items-center justify-center rounded-[24px] border border-amber-100 bg-gradient-to-br from-white via-amber-50 to-emerald-50 shadow-[0_10px_24px_rgba(82,60,28,0.14)]">
                    <img
                      src={getTownDecorationRewardIconSrc(
                        targetDecorationPromptDecoration,
                      )}
                      alt={targetDecorationPromptDecoration.id}
                      className="h-[68px] w-[68px] object-contain drop-shadow-md"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (target.dataset.fallbackSrc === "true") return;
                        target.dataset.fallbackSrc = "true";
                        target.src = targetDecorationPromptDecoration.src;
                      }}
                    />
                  </div>
                  <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-black text-emerald-600">
                    <Gift className="w-3.5 h-3.5" strokeWidth={3} />
                    New Decoration
                  </div>
                  <h3 className="text-[22px] font-black leading-tight text-stone-900">
                    通过答题可解锁此装饰
                  </h3>
                  <p className="mt-2 text-[13px] font-bold leading-relaxed text-stone-500">
                    完成一次小测验后，这个装饰会优先解锁，其他装饰顺延。
                  </p>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (targetDecorationPrompt) {
                        startTargetDecorationQuiz(targetDecorationPrompt);
                      }
                    }}
                    className="mt-5 h-[52px] w-full rounded-[18px] bg-[#58CC02] text-white font-black text-[16px] shadow-[0_5px_0_#3f9300] active:translate-y-[4px] active:shadow-none transition-all"
                  >
                    开始答题
                  </motion.button>
	              </motion.div>
	            </motion.div>
	          )}
	        </AnimatePresence>

	        {/* 课程气泡弹窗 */}
	        <AnimatePresence>
	          {showLevelConfirm && (
	            <motion.div
	              initial={{ opacity: 0 }}
	              animate={{ opacity: 1 }}
	              exit={{ opacity: 0 }}
	              className="absolute inset-0 z-[9999] flex items-center justify-center bg-black/10 px-8 pointer-events-auto"
	              onClick={() => setShowLevelConfirm(false)}
	            >
	              {(() => {
	                const lessonInfo =
	                  lessonsConfig.lessons.find(
	                    (l: any) => l.lesson_id === quizIndex,
	                  ) || lessonsConfig.lessons[0];
	                const lessonNumber = Math.min(8, Math.max(1, quizIndex));
	                return (
	                  <motion.div
	                    initial={{ opacity: 0, y: 18, scale: 0.92 }}
	                    animate={{ opacity: 1, y: 0, scale: 1 }}
	                    exit={{ opacity: 0, y: 12, scale: 0.96 }}
	                    transition={{ type: "spring", damping: 22, stiffness: 300 }}
	                    className="relative w-full max-w-[330px] rounded-[26px] bg-white px-5 py-5 text-center shadow-[0_18px_44px_rgba(15,23,42,0.24)] border border-white"
	                    onClick={(e) => e.stopPropagation()}
	                  >
		                    <div className="relative">
	                      <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-[12px] font-black text-indigo-600">
	                        <Book className="w-3.5 h-3.5" strokeWidth={3} />
	                        Lesson {lessonNumber}
	                      </div>
	                      <ConfigBubble file="lessons.json" field="title" align="center">
	                        <h3 className="text-[22px] font-black leading-tight text-stone-900">
	                          {lessonInfo.title}
	                        </h3>
	                      </ConfigBubble>
	                      <ConfigBubble
	                        file="lessons.json"
	                        field="title_cn"
	                        align="center"
	                        className="mt-1"
	                      >
	                        <p className="text-[13px] font-black text-stone-400">
	                          {lessonInfo.title_cn}
	                        </p>
	                      </ConfigBubble>
	                      <ConfigBubble
	                        file="lessons.json"
	                        field="description"
	                        align="center"
	                        className="mt-3"
	                      >
	                        <p className="text-[14px] font-bold leading-relaxed text-stone-600">
	                          {lessonInfo.description}
	                        </p>
	                      </ConfigBubble>
	                      <motion.button
		                        type="button"
		                        whileTap={{ scale: 0.97 }}
		                        onClick={() => {
		                          startQuizFromConfirmWithVoice();
		                        }}
		                        className="mt-5 h-[52px] w-full rounded-[18px] bg-[#58CC02] text-white font-black text-[16px] shadow-[0_5px_0_#3f9300] active:translate-y-[4px] active:shadow-none transition-all"
		                      >
                          开始学习
                        </motion.button>
	                    </div>
	                  </motion.div>
	                );
	              })()}
	            </motion.div>
	          )}
	        </AnimatePresence>

        {/* 前置剧情课程 */}
        <AnimatePresence>
          {preludeStage === "welcome" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute -inset-px z-[10050] pointer-events-auto flex flex-col justify-end px-4 pb-[18%]"
              onClick={handlePreludeWelcomeContinue}
            >
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative isolate mx-auto w-full max-w-[380px]">
                <motion.img
                  initial={{ x: -40, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ type: "spring", damping: 22, stiffness: 260 }}
                  src={MIA_PORTRAIT_IMAGE}
                  className="absolute bottom-[calc(100%-42px)] left-0 z-0 h-[214px] w-auto object-contain drop-shadow-2xl pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                <motion.div
                  initial={{ y: 18, opacity: 0, scale: 0.96 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{ delay: 0.12, type: "spring", damping: 22, stiffness: 260 }}
                  className="relative z-10 rounded-[30px] bg-white/95 border-4 border-white px-5 pb-5 pt-8 shadow-[0_18px_44px_rgba(15,23,42,0.28)]"
                >
                  <div className="absolute -top-5 left-8 rounded-[14px] bg-sky-400 px-5 py-1.5 text-[17px] font-black text-white shadow-md">
                    Mia
                  </div>
                  <p className="text-[18px] font-medium leading-relaxed text-stone-900">
                    Welcome to LingoVille, {preludePlayerName}!
                  </p>
                  <p className="mt-2 text-[15px] font-medium leading-relaxed text-stone-700">
                    Your new home is right there - Apartment 4B.
                    <br />
                    Let's go check it out!
                  </p>
                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-[12px] font-black uppercase tracking-[0.18em] text-sky-400">
                      Tap to continue
                    </span>
                    <ArrowRight className="h-5 w-5 text-sky-400" strokeWidth={3} />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isPreludeInteriorStage && (
            <motion.div
              initial={{ opacity: 0 }}
		              animate={{ opacity: 1 }}
		              exit={{ opacity: 0 }}
		              className="absolute -inset-px z-[10050] bg-stone-950 pointer-events-auto overflow-hidden"
		              onClick={handlePreludeInteriorTap}
		            >
              <AnimatePresence initial={false}>
                <motion.img
                  key={preludeInteriorBackground}
                  src={preludeInteriorBackground}
                  alt="Apartment hallway"
                  className="absolute -inset-px h-[calc(100%+2px)] w-[calc(100%+2px)] object-cover will-change-transform"
                  initial={{ x: "100%" }}
                  animate={{ x: "0%" }}
                  exit={{ x: "-100%" }}
                  transition={{
                    duration: 0.34,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                  referrerPolicy="no-referrer"
                  draggable={false}
                />
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/5 to-black/62" />

              {preludeStage === "inside_intro" &&
                preludeVisibleLineIds.includes("lost") && (
                <motion.div
                  key="prelude-top-intro"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-4 right-4 top-8 rounded-[24px] bg-white/92 px-5 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.2)]"
                >
	                  <PreludeTypewriterText
	                    key="prelude-lost"
	                    text={'3 buildings?? Where\'s 4B?? 😱 Wait - there\'s a guard. Let\'s ask for help 💪'}
	                    className="text-[18px] font-black leading-snug text-stone-900"
	                    instant={isPreludeLineSkipped("lost")}
	                  />
                </motion.div>
              )}

              {preludeStage === "q2_intro" &&
                preludeVisibleLineIds.includes("where_intro") && (
                <motion.div
                  key="prelude-top-where"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-4 right-4 top-8 rounded-[24px] bg-white/92 px-5 py-4 shadow-[0_14px_34px_rgba(15,23,42,0.2)]"
                >
	                  <PreludeTypewriterText
	                    key="prelude-where-intro"
	                    text="Now ask him where 4B is 👇"
	                    className="text-[16px] font-black leading-snug text-stone-900"
	                    instant={isPreludeLineSkipped("where_intro")}
	                  />
                  <p className="mt-1 text-[13px] font-bold text-stone-500">
                    知识点：询问位置 "Where is + 地点?"
                  </p>
                </motion.div>
              )}

              <AnimatePresence mode="wait">
                {(() => {
                  let guardLineId = "";
                  let guardText = "";
                  if (
                    (preludeStage === "inside_intro" ||
                      preludeStage === "q1") &&
                    preludeVisibleLineIds.includes("guard_hi")
                  ) {
                    guardLineId = "guard_hi";
                    guardText = '"Hi! How can I help you?"';
                  } else if (
                    preludeStage === "q1_correct" &&
                    preludeVisibleLineIds.includes("guard_q1_correct")
                  ) {
                    guardLineId = "guard_q1_correct";
                    guardText = '"Of course! What do you need?" 😊';
                  } else if (
                    (preludeStage === "q2_intro" ||
                      preludeStage === "q2") &&
                    preludeVisibleLineIds.includes("guard_wait")
                  ) {
                    guardLineId = "guard_wait";
                    guardText = '"Take your time. What are you looking for?" 🌷';
                  } else if (
                    preludeStage === "q2_guard" &&
                    preludeVisibleLineIds.includes("guard_q2_correct")
                  ) {
                    guardLineId = "guard_q2_correct";
                    guardText =
                      '"Apartment 4B? Sure! Let me show you..." 🌷';
                  } else if (
                    preludeStage === "route_intro" &&
                    preludeVisibleLineIds.includes("guard_route")
                  ) {
                    guardLineId = "guard_route";
                    guardText =
                      '"Go straight, then turn right. 4B is on your right!" 🌷';
                  } else if (
                    preludeStage === "q3" &&
                    preludeVisibleLineIds.includes("guard_turn_left")
                  ) {
                    guardLineId = "guard_turn_left";
                    guardText =
                      '"Turn right at the end of the hallway."';
                  } else if (
                    preludeStage === "q4" &&
                    preludeVisibleLineIds.includes("guard_hallway")
                  ) {
                    guardLineId = "guard_hallway";
                    guardText =
                      '"It\'s just down the hallway. You can\'t miss it!" ✨';
                  } else if (
                    preludeStage === "q4_correct" &&
                    preludeVisibleLineIds.includes("guard_welcome")
                  ) {
                    guardLineId = "guard_welcome";
                    guardText =
                      '"You\'re welcome, dear! Welcome to LingoVille! 🌷"';
                  }

                  if (!guardLineId) return null;

                  return (
                    <motion.div
                      key={guardLineId}
                      initial={{ x: -24, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -16, opacity: 0 }}
	                      className="absolute left-[30px] top-[20%]"
                    >
                      <div className="max-w-[188px] rounded-[20px] bg-white/95 px-4 py-3 shadow-xl border border-white">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-sky-500">
                          Security Guard
                        </p>
	                        <PreludeTypewriterText
	                          key={`type-${guardLineId}`}
	                          text={guardText}
	                          className="mt-1 text-[15px] font-black leading-snug text-stone-900"
	                          instant={isPreludeLineSkipped(guardLineId)}
	                        />
                        <div className="mt-2 inline-flex rounded-full bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-500">
                          ...
                        </div>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              <div
                ref={preludeActionPanelRef}
                className={`absolute inset-x-5 max-h-[50%] overflow-y-auto rounded-[22px] bg-white/95 p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.28)] border border-white/80 backdrop-blur-md ${
                  shouldShowPreludeInteriorActionPanel ? "" : "hidden"
                }`}
                style={{
                  bottom: "max(14px, calc(env(safe-area-inset-bottom) + 8px))",
                }}
              >
                {preludeStage === "inside_intro" &&
                  preludeVisibleLineIds.includes("attention") && (
                  <div>
                    <div className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold text-amber-700">
                      Say hi back
                    </div>
	                    <PreludeTypewriterText
	                      key="prelude-attention"
	                      text="The guard greeted you. Say hi back before asking."
	                      className="mt-3 text-[15px] font-semibold leading-snug text-stone-900"
	                      instant={isPreludeLineSkipped("attention")}
	                    />
                    <button
                      type="button"
                      onClick={() => setPreludeStage("q1")}
                      className="mt-4 h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {shouldRenderPreludeQ1Panel && (
                  <div>
                    <p className="text-[13px] font-medium leading-relaxed text-stone-500">
                      The guard greeted you. How do you say hi back?
                    </p>
                    <h3 className="mt-1.5 text-[18px] font-extrabold leading-tight text-stone-950">
                      Complete the sentence:
                    </h3>
                    <div
                      className={`mt-2.5 flex items-center justify-center gap-2 rounded-[17px] px-3.5 py-3 text-center ${
                        isPreludeQ1CorrectPanel
                          ? "bg-emerald-50"
                          : "bg-sky-50"
                      }`}
                    >
                      {isPreludeQ1CorrectPanel && (
                        <Volume2
                          className="h-4 w-4 shrink-0 text-emerald-500"
                          strokeWidth={2.7}
                        />
                      )}
                      <span className="text-[17px] font-extrabold text-stone-900">
                        "
                        {isPreludeQ1CorrectPanel ? (
                          <span className="text-emerald-600">Hi</span>
                        ) : (
                          <span className="text-stone-400">_______</span>
                        )}
                        , I'm looking for Apartment 4B."
                      </span>
                    </div>
                    {!isPreludeQ1CorrectPanel && (
                      <div className="mt-3 space-y-2.5">
                        {PRELUDE_Q1_OPTIONS.map((option) =>
                          renderPreludeOption(option, "q1"),
                      )}
                      </div>
                    )}
                    {preludeQ1FeedbackLine &&
                      preludeVisibleLineIds.includes(preludeQ1FeedbackLine) && (
                      <motion.div
                        key={preludeQ1FeedbackLine}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 rounded-[18px] bg-sky-50 px-3.5 py-3"
                      >
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-500">
                          Mia
                        </p>
	                        <PreludeTypewriterText
	                          key={`type-${preludeQ1FeedbackLine}`}
	                          text={
                            preludeQ1FeedbackLine === "q1_wrong_goodbye"
                              ? "Wait, you just got here! 'Bye' is for leaving - try 'Hi' to say hello."
                              : "It's not bedtime yet! 'Good night' is for nighttime goodbyes. Use 'Hi' here."
	                          }
	                          className="mt-1 text-[13px] font-semibold leading-relaxed text-stone-700"
	                          instant={isPreludeLineSkipped(preludeQ1FeedbackLine)}
	                        />
                      </motion.div>
                    )}
                    {isPreludeQ1CorrectPanel && (
                      <motion.div
                        key="prelude-q1-inline-correct"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 rounded-[18px] bg-emerald-50 px-3.5 py-3"
                      >
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={3} />
                          <h3 className="text-[18px] font-extrabold">
                            ✨ Perfect!
                          </h3>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[15px] bg-white/80 px-3 py-2.5">
                          <p className="text-[13px] font-semibold leading-relaxed text-stone-900">
                            'Hi' 是最常用的打招呼方式
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setPreludeDetailExpanded((prev) => ({
                                ...prev,
                                q1: !prev.q1,
                              }))
                            }
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600 active:scale-95"
                            aria-label="查看详细解释"
                          >
                            <HelpCircle className="h-4 w-4" strokeWidth={2.7} />
                          </button>
                        </div>
                        <AnimatePresence>
                          {preludeDetailExpanded.q1 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2.5 space-y-1 rounded-[15px] bg-white/70 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-stone-600">
                                <p>• Hi = 嗨（最常用、最日常）</p>
                                <p>• Hello = 你好（稍正式）</p>
                                <p>• Hey = 嘿（最随意，朋友间）</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                    {isPreludeQ1CorrectPanel && (
                      <button
                        type="button"
                        onClick={() => setPreludeStage("q2_intro")}
                        className="mt-4 h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
                      >
                        Continue
                      </button>
                    )}
                  </div>
                )}

                {preludeStage === "q2_intro" &&
                  (preludeVisibleLineIds.includes("guard_wait") ||
                    preludeVisibleLineIds.includes("where_intro")) && (
                  <div>
                    {preludeVisibleLineIds.includes("where_intro") && (
                      <>
	                        <PreludeTypewriterText
	                          key="prelude-where-bottom"
	                          text="Now ask him where 4B is 👇"
	                          className="mt-1 text-[15px] font-semibold leading-snug text-stone-900"
	                          instant={isPreludeLineSkipped("where_intro")}
	                        />
                        <button
                          type="button"
                          onClick={() => setPreludeStage("q2")}
                          className="mt-4 h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
                        >
                          Continue
                        </button>
                      </>
                    )}
                  </div>
                )}

                {shouldRenderPreludeQ2Panel && (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-extrabold text-indigo-600">
                        询问位置
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-extrabold text-stone-500">
                        完成句子
                      </span>
                    </div>
                    <p className="mt-3 text-[13px] font-medium leading-relaxed text-stone-500">
                      You want to ask where Apartment 4B is.
                    </p>
                    <h3 className="mt-1.5 text-[18px] font-extrabold leading-tight text-stone-950">
                      Complete the sentence:
                    </h3>
                    <div
                      className={`mt-2.5 flex items-center justify-center gap-2 rounded-[17px] px-3.5 py-3 text-center ${
                        isPreludeQ2CorrectPanel
                          ? "bg-emerald-50"
                          : "bg-indigo-50"
                      }`}
                    >
                      {isPreludeQ2CorrectPanel && (
                        <Volume2
                          className="h-4 w-4 shrink-0 text-emerald-500"
                          strokeWidth={2.7}
                        />
                      )}
                      <span className="text-[17px] font-extrabold text-stone-900">
                        "
                        {isPreludeQ2CorrectPanel ? (
                          <span className="text-emerald-600">Where is</span>
                        ) : (
                          <span className="text-stone-400">_______</span>
                        )}{" "}
                        Apartment 4B?"
                      </span>
                    </div>
                    {!isPreludeQ2CorrectPanel && (
                      <div className="mt-3 space-y-2.5">
                        {PRELUDE_Q2_OPTIONS.map((option) =>
                          renderPreludeOption(option, "q2"),
                      )}
                      </div>
                    )}
                    {preludeQ2FeedbackLine &&
                      preludeVisibleLineIds.includes(preludeQ2FeedbackLine) && (
                      <motion.div
                        key={preludeQ2FeedbackLine}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 rounded-[18px] bg-sky-50 px-3.5 py-3"
                      >
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-sky-500">
                          Mia
                        </p>
	                        <PreludeTypewriterText
	                          key={`type-${preludeQ2FeedbackLine}`}
	                          text={
                            preludeQ2FeedbackLine === "q2_wrong_what"
                              ? "Close one! 🤔 'Where' is for places, 'What' is for things. I've saved this in your Mistake Book 📓"
                              : "Almost! 'How is' asks how something feels. For places, use 'Where is' 📍 Saved to your Mistake Book 📓"
	                          }
	                          className="mt-1 text-[13px] font-semibold leading-relaxed text-stone-700"
	                          instant={isPreludeLineSkipped(preludeQ2FeedbackLine)}
	                        />
                      </motion.div>
                    )}
                    {isPreludeQ2CorrectPanel && (
                      <motion.div
                        key="prelude-q2-inline-correct"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 rounded-[18px] bg-emerald-50 px-3.5 py-3"
                      >
                        <div className="flex items-center gap-2 text-emerald-600">
                          <CheckCircle2 className="h-4 w-4" strokeWidth={3} />
                          <h3 className="text-[18px] font-extrabold">
                            ✨ Perfect!
                          </h3>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-3 rounded-[15px] bg-white/80 px-3 py-2.5">
                          <p className="text-[13px] font-semibold leading-relaxed text-stone-900">
                            'Where is + 地点?' = 询问位置 📍
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setPreludeDetailExpanded((prev) => ({
                                ...prev,
                                q2: !prev.q2,
                              }))
                            }
                            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-600 active:scale-95"
                            aria-label="查看详细解释"
                          >
                            <HelpCircle className="h-4 w-4" strokeWidth={2.7} />
                          </button>
                        </div>
                        <AnimatePresence>
                          {preludeDetailExpanded.q2 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2.5 space-y-1 rounded-[15px] bg-white/70 px-3 py-2.5 text-[12px] font-medium leading-relaxed text-stone-600">
                                <p>'Where is Apartment 4B?' = 4B公寓在哪里？</p>
                                <p>• Where is...? = 在哪里？(问位置)</p>
                                <p>• What is...? = 是什么？(问东西)</p>
                                <p>• How is...? = 怎么样？(问情况)</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                    {isPreludeQ2CorrectPanel && (
                      <button
                        type="button"
                        onClick={continueMergedPreludeRoute}
                        className="mt-4 h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
	                      >
                        Continue
                      </button>
                    )}
                  </div>
                )}

                {preludeStage === "q2_guard" &&
                  preludeQ2Choice !== "a" &&
                  preludeVisibleLineIds.includes("guard_q2_correct") && (
                  <div>
                    <button
                      type="button"
                      onClick={continueMergedPreludeRoute}
                      className="h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {preludeStage === "route_intro" &&
                  preludeVisibleLineIds.includes("route_check") && (
                  <div>
                    <div className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-extrabold text-sky-700">
                      Listen carefully
                    </div>
	                    <PreludeTypewriterText
	                      key="prelude-route-check"
	                      text="Listen carefully — let's check"
	                      className="mt-3 text-[16px] font-semibold leading-snug text-stone-900"
	                      instant={isPreludeLineSkipped("route_check")}
	                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPreludeQ3Choice(null);
                        setPreludeQ3WrongChoices([]);
                        setPreludeStage("q3");
                      }}
                      className="mt-4 h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {preludeStage === "q3" &&
                  preludeVisibleLineIds.includes("turn_left_prompt") && (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-extrabold text-sky-600">
                        听音选义
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-extrabold text-stone-500">
                        Turn right
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const line = getPreludeLine("guard_turn_left");
                        void speakText(line.text, {
                          role: line.role,
                          audioSrc: line.audioSrc,
                        });
                      }}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-[16px] bg-sky-50 px-3.5 py-3 text-[14px] font-extrabold text-sky-700 border-[1.5px] border-sky-100 active:scale-[0.98] transition-transform"
                    >
                      <Volume2 className="h-4 w-4" strokeWidth={3} />
                      Tap to replay: "Turn right at the end of the hallway."
                    </button>
                    <p className="mt-3 text-[13px] font-medium leading-relaxed text-stone-500">
                      Listen carefully — where should you turn?
                    </p>
                    <h3 className="mt-1.5 text-[18px] font-extrabold leading-tight text-stone-950">
                      What does "Turn right" mean?
                    </h3>
                    <div className="mt-3 space-y-2.5">
                      {PRELUDE_Q3_OPTIONS.map((option) =>
                        renderPreludePracticeOption(
                          option,
                          preludeQ3Choice,
                          preludeQ3WrongChoices,
                          handlePreludeQ3Answer,
                        ),
                      )}
                    </div>
                    {preludeQ3Choice && preludeQ3Choice !== "b" && (
                      <div className="mt-3 rounded-[15px] bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-600">
                        Listen again. "Right" means 向右.
                      </div>
                    )}
                  </div>
                )}

                {preludeStage === "q3_correct" &&
                  preludeVisibleLineIds.includes("q3_correct") && (
                  <div>
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-7 w-7" strokeWidth={3} />
                    </div>
                    <h3 className="mt-3 text-center text-[20px] font-extrabold text-emerald-600">
                      ✨ Perfect!
                    </h3>
                    <div className="mt-3 rounded-[18px] bg-emerald-50 px-3.5 py-3">
                      <p className="text-[14px] font-semibold leading-relaxed text-stone-900">
                        'Turn right' = 向右转 ➡️
                      </p>
                      <div className="mt-2.5 space-y-1 text-[12px] font-medium leading-relaxed text-stone-600">
                        <p>• Turn right = 向右转 ➡️</p>
                        <p>• Turn left = 向左转 ⬅️</p>
                        <p>• Go straight = 直走 ⬆️</p>
                      </div>
                      <p className="mt-2.5 text-[13px] font-semibold leading-relaxed text-emerald-700">
                        方向英语三件套，记住就能走遍美国。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreludeQ4Choice(null);
                        setPreludeQ4WrongChoices([]);
                        setPreludeStage("q4");
                      }}
                      className="mt-4 h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
                    >
                      Continue
                    </button>
                  </div>
                )}

                {preludeStage === "q4" &&
                  preludeVisibleLineIds.includes("q4_prompt") && (
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-600">
                        感谢表达
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-extrabold text-stone-500">
                        选词填空
                      </span>
                    </div>
                    <p className="mt-3 text-[14px] font-semibold leading-relaxed text-stone-900">
                      He was so helpful — you should thank him.
                    </p>
                    <p className="mt-2.5 text-[13px] font-medium leading-relaxed text-stone-500">
                      The guard helped you find Apartment 4B.
                    </p>
                    <h3 className="mt-1.5 text-[18px] font-extrabold leading-tight text-stone-950">
                      What's the best way to thank him?
                    </h3>
                    <div className="mt-3 space-y-2.5">
                      {PRELUDE_Q4_OPTIONS.map((option) =>
                        renderPreludePracticeOption(
                          option,
                          preludeQ4Choice,
                          preludeQ4WrongChoices,
                          handlePreludeQ4Answer,
                        ),
                      )}
                    </div>
                    {preludeQ4Choice && preludeQ4Choice !== "a" && (
                      <div className="mt-3 rounded-[15px] bg-rose-50 px-3.5 py-2.5 text-[13px] font-semibold text-rose-600">
                        He helped a lot. Try the warmer thank-you sentence.
                      </div>
                    )}
                  </div>
                )}

                {preludeStage === "q4_correct" &&
                  (preludeVisibleLineIds.includes("q4_correct") ||
                    preludeVisibleLineIds.includes("almost_home")) && (
                  <div>
                    {preludeVisibleLineIds.includes("q4_correct") && (
                      <>
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[18px] bg-emerald-100 text-emerald-600">
                          <CheckCircle2 className="h-7 w-7" strokeWidth={3} />
                        </div>
                        <h3 className="mt-3 text-center text-[20px] font-extrabold text-emerald-600">
                          ✨ Perfect!
                        </h3>
                        <div className="mt-3 rounded-[18px] bg-emerald-50 px-3.5 py-3">
                          <p className="text-[14px] font-semibold leading-relaxed text-stone-900">
                            'Thank you so much!' = 非常感谢！🙏
                          </p>
                          <div className="mt-2.5 space-y-1 text-[12px] font-medium leading-relaxed text-stone-600">
                            <p>• Thanks = 谢了 (随意)</p>
                            <p>• Thank you = 谢谢 (基础)</p>
                            <p>• Thank you so much = 非常感谢 (真诚)</p>
                          </div>
                          <p className="mt-2.5 text-[13px] font-semibold leading-relaxed text-emerald-700">
                            别人帮了大忙时，用 'so much' 表达真诚！
                          </p>
                        </div>
                      </>
                    )}
	                    {preludeVisibleLineIds.includes("almost_home") && (
	                      <>
	                        <div className="mt-3 rounded-[18px] bg-sky-50 px-3.5 py-3">
		                          <PreludeTypewriterText
	                            key="prelude-almost-home"
	                            text={'"Almost there! 4B — your new home is right around the corner 🏠"'}
	                            className="text-[14px] font-semibold leading-relaxed text-sky-700"
	                            instant={isPreludeLineSkipped("almost_home")}
	                          />
	                        </div>
	                      </>
	                    )}
                    {preludeVisibleLineIds.includes("q4_correct") && (
                      <button
                        type="button"
                        onClick={handlePreludeFinish}
                        className="mt-4 h-[44px] w-full rounded-[15px] bg-[#58CC02] text-[14px] font-extrabold text-white shadow-[0_4px_0_#3f9300] active:translate-y-[3px] active:shadow-none transition-all"
                      >
                        Continue
                      </button>
                    )}
	                  </div>
	                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

	        {/* 连胜全屏面板 */}
	        <AnimatePresence>
	          {showStreakPanel && (
	            <motion.div
	              initial={{ opacity: 0, y: 18 }}
	              animate={{ opacity: 1, y: 0 }}
	              exit={{ opacity: 0, y: 18 }}
	              transition={{ type: "spring", damping: 24, stiffness: 260 }}
		              className="absolute inset-0 z-[10000] bg-gradient-to-b from-[#FFF5E0] via-[#FFFDF7] to-[#E9FCE4] pointer-events-auto overflow-y-auto"
	            >
	              <div className="min-h-full px-5 pt-12 pb-8">
	                <div className="flex items-center justify-between">
	                  <h2 className="text-[34px] font-black leading-none text-stone-950">
	                    Streak
	                  </h2>
	                  <button
	                    type="button"
	                    aria-label="关闭连胜页面"
	                    onClick={() => setShowStreakPanel(false)}
	                    className="w-10 h-10 rounded-full bg-white text-stone-500 text-[24px] leading-none flex items-center justify-center shadow-sm border border-orange-100 active:scale-95"
	                  >
	                    ×
	                  </button>
	                </div>

	                <div className="mt-7 rounded-[28px] bg-white border border-orange-100 shadow-[0_16px_38px_rgba(251,146,60,0.16)] px-5 py-5">
	                  <div className="flex items-center justify-center gap-4">
	                    <motion.div
	                      animate={{ scale: [1, 1.08, 1], rotate: [0, -4, 4, 0] }}
	                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
	                      className="w-20 h-20 rounded-[26px] bg-orange-100 text-orange-500 flex items-center justify-center"
	                    >
	                      <Flame className="w-11 h-11 fill-orange-400" strokeWidth={2.6} />
	                    </motion.div>
	                    <div>
	                      <p className="text-[46px] leading-none font-black text-stone-950">
	                        {streakDays}
	                      </p>
	                      <p className="mt-1 text-[13px] font-black text-orange-500 uppercase tracking-[0.16em]">
	                        day streak
	                      </p>
	                    </div>
	                  </div>
		                  <p className="mt-5 text-center text-[15px] font-black leading-relaxed text-stone-700">
		                    this town lives because of you - barmaby
		                  </p>
		                  <div className="mt-5 rounded-full bg-stone-100 h-3 overflow-hidden">
		                    <motion.div
		                      className="h-full rounded-full bg-[#58CC02]"
		                      animate={{ width: `${Math.min(100, (Math.min(streakDays, 30) / 30) * 100)}%` }}
		                      transition={{ type: "spring", stiffness: 120, damping: 18 }}
		                    />
		                  </div>
		                  <p className="mt-2 text-center text-[12px] font-black text-[#3f9300]">
		                    {Math.min(streakDays, 30)}/30 days checked in
		                  </p>
		                </div>

	                <div className="mt-6 rounded-[26px] bg-white border border-orange-100 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
	                  <div className="grid grid-cols-7 gap-1.5 mb-2">
	                    {STREAK_WEEKDAYS.map((day) => (
	                      <div
	                        key={day}
	                        className="text-center text-[10px] font-black text-stone-400 uppercase"
	                      >
	                        {day}
	                      </div>
	                    ))}
	                  </div>
		                  <div className="grid grid-cols-7 gap-1.5">
		                    {STREAK_CALENDAR_DAYS.map((day) => {
		                      const isChecked = streakDays >= day;
		                      return (
		                        <div
		                          key={day}
			                          className={`relative min-h-[50px] rounded-[14px] border flex flex-col items-center justify-center gap-0.5 ${
			                            isChecked
			                              ? "bg-[#E8F8DB] border-[#58CC02] shadow-[0_4px_0_rgba(88,204,2,0.22)]"
			                              : "bg-stone-50 border-stone-100"
			                          }`}
			                        >
			                          <span
			                            className={`text-[10px] font-black ${
			                              isChecked
			                                ? "text-[#3f9300]"
			                                : "text-stone-400"
			                            }`}
			                          >
		                            {day}
		                          </span>
		                          <Gift
			                            className={`w-5 h-5 ${
			                              isChecked
			                                ? "text-[#58CC02] fill-lime-200"
			                                : "text-stone-300"
			                            }`}
		                            strokeWidth={2.8}
		                          />
		                        </div>
		                      );
		                    })}
	                  </div>
	                </div>
	              </div>
	            </motion.div>
	          )}
	        </AnimatePresence>

	        {/* 故事弹窗 - 明亮暖色设计 */}
        <AnimatePresence>
          {showStory && (
            <div className="absolute inset-0 z-[200] flex items-center justify-center p-6 bg-white/20 backdrop-blur-md pointer-events-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 30 }}
                className="relative w-full max-w-sm rounded-[40px] overflow-hidden border-4 border-white shadow-[0_24px_48px_-12px_rgba(120,80,40,0.2)] bg-white"
              >
                {/* 装饰背景层 - 暖色渐变 */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#FFFBF7] to-[#FDF4E9] z-0" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 blur-[60px] rounded-full z-0" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-100/40 blur-[40px] rounded-full z-0" />

                <div className="relative p-10 flex flex-col items-center z-10">
                  {/* 关闭按钮 */}
                  <button
                    onClick={() => {
                      setShowStory(false);
                      setShowGuideArrow(true);
                    }}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center transition-transform hover:scale-110 active:scale-90 group"
                  >
                    <div className="absolute inset-0 bg-stone-100 rounded-full group-hover:bg-amber-50 transition-colors" />
                    <img
                      src="/assets/renwuguanbi.png"
                      alt="Close"
                      className="w-5 h-5 object-contain relative z-10 opacity-60 group-hover:opacity-100 grayscale brightness-50"
                      referrerPolicy="no-referrer"
                    />
                  </button>

                  <div className="flex w-full gap-6 items-center mb-8 mt-4">
                    {/* 故事内容 (左侧) */}
                    <div className="flex-1">
                      <div className="space-y-1.5 mb-4 opacity-40">
                        <div className="w-10 h-0.5 bg-amber-700/60 rounded-full" />
                        <div className="w-6 h-0.5 bg-amber-700/30 rounded-full" />
                      </div>
                      <p className="text-stone-800 text-[16px] leading-[1.7] font-medium tracking-tight italic">
                        "Maple read on the sofa under a flickering lamp. Barnaby
                        came from the dining room and leaned in the doorway,
                        watching."
                      </p>
                    </div>

                    {/* Bun头像 (右侧) */}
                    <div className="w-20 h-20 relative flex-shrink-0">
                      <div className="absolute inset-0 bg-amber-400/10 rounded-full blur-2xl animate-pulse" />
                      <div className="absolute inset-0 rounded-full border-2 border-amber-200/50 scale-110" />
                      <div className="absolute inset-0 rounded-full bg-stone-50 shadow-inner" />
                      <img
                        src="/assets/buntouxiang.png"
                        alt="Bun"
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_4px_8px_rgba(0,0,0,0.1)] -scale-x-100"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* 标题区 (下方) */}
                  <div className="w-full flex items-center gap-4 mt-2">
                    <div className="h-px flex-1 bg-amber-200/60" />
                    <span className="text-amber-800 font-extrabold text-[10px] uppercase tracking-[0.6em] italic opacity-60">
                      New Story
                    </span>
                    <div className="h-px flex-1 bg-amber-200/60" />
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* 未解锁建筑提示 */}
        <AnimatePresence>
          {lockedBuildingPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[90000] flex items-center justify-center bg-black/35 px-8 pointer-events-auto"
              onClick={() => setLockedBuildingPrompt(null)}
            >
              <motion.div
                initial={{ y: 22, scale: 0.92, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 18, scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 22, stiffness: 260 }}
                className="w-full max-w-[330px] rounded-[26px] border border-amber-100 bg-white p-5 text-center shadow-[0_22px_55px_rgba(15,23,42,0.28)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 shadow-inner">
                  <House className="h-8 w-8" strokeWidth={2.7} />
                </div>
                <h3 className="mt-4 text-[22px] font-black leading-tight text-stone-950">
                  {getTownBuildingSignName(lockedBuildingPrompt)}
                </h3>
                <p className="mt-2 text-[14px] font-bold leading-relaxed text-stone-500">
                  通过第
                  {getTownBuildingUnlockRequiredLesson(
                    lockedBuildingPrompt.id,
                  )}
                  课解锁
                </p>
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.light?.();
                    setEarlyUnlockConfirmBuilding(lockedBuildingPrompt);
                    setLockedBuildingPrompt(null);
                  }}
                  className="mt-5 h-12 w-full rounded-2xl bg-[#58CC02] text-[15px] font-black text-white shadow-[0_5px_0_#45a501] active:translate-y-1 active:shadow-none"
                >
                  提前解锁
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 提前解锁确认 */}
        <AnimatePresence>
          {earlyUnlockConfirmBuilding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[91000] flex items-center justify-center bg-black/42 px-8 pointer-events-auto"
              onClick={() => setEarlyUnlockConfirmBuilding(null)}
            >
              <motion.div
                initial={{ y: 22, scale: 0.92, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 18, scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", damping: 22, stiffness: 260 }}
                className="w-full max-w-[330px] rounded-[26px] border border-sky-100 bg-white p-5 text-center shadow-[0_22px_55px_rgba(15,23,42,0.28)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-100 text-sky-600 shadow-inner">
                  <Trophy className="h-8 w-8" strokeWidth={2.7} />
                </div>
                <h3 className="mt-4 text-[21px] font-black leading-tight text-stone-950">
                  通过测验可提前解锁，是否确认？
                </h3>
                <p className="mt-2 text-[13px] font-bold leading-relaxed text-stone-500">
                  测验内容会使用当前已有课程的第8课，完成后立即解锁这个建筑。
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      hapticFeedback.light?.();
                      setEarlyUnlockConfirmBuilding(null);
                    }}
                    className="h-12 rounded-2xl bg-stone-100 text-[14px] font-black text-stone-600 shadow-[0_5px_0_#d6d3d1] active:translate-y-1 active:shadow-none"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      startEarlyUnlockQuiz(earlyUnlockConfirmBuilding)
                    }
                    className="h-12 rounded-2xl bg-[#58CC02] text-[14px] font-black text-white shadow-[0_5px_0_#45a501] active:translate-y-1 active:shadow-none"
                  >
                    确认
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 提前解锁成功 */}
        <AnimatePresence>
          {showEarlyUnlockSuccess && (
            <motion.div
              key={earlyUnlockConfettiKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[110000] flex items-center justify-center overflow-hidden bg-black/38 px-8 pointer-events-auto"
            >
              {Array.from({ length: 54 }).map((_, index) => {
                const angle = -70 + ((index * 31) % 140);
                const distance = 160 + ((index * 29) % 170);
                const x = Math.cos((angle * Math.PI) / 180) * distance;
                const y = Math.sin((angle * Math.PI) / 180) * distance - 80;
                const colors = [
                  "#58CC02",
                  "#1CB0F6",
                  "#FFC800",
                  "#FF4B4B",
                  "#CE82FF",
                ];
                return (
                  <motion.span
                    key={`early-unlock-confetti-${index}`}
                    className="absolute left-1/2 top-[58%] h-3 w-2 rounded-[2px]"
                    style={{ backgroundColor: colors[index % colors.length] }}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
                    animate={{
                      opacity: [0, 1, 1, 0],
                      x,
                      y,
                      scale: [0.5, 1.2, 1, 0.85],
                      rotate: 220 + index * 37,
                    }}
                    transition={{
                      duration: 1.55,
                      delay: index * 0.012,
                      ease: "easeOut",
                    }}
                  />
                );
              })}
              <motion.div
                initial={{ y: 28, scale: 0.9, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 20, scale: 0.94, opacity: 0 }}
                transition={{ type: "spring", damping: 18, stiffness: 250 }}
                className="relative z-10 w-full max-w-[335px] rounded-[30px] border border-emerald-100 bg-white px-6 py-7 text-center shadow-[0_26px_70px_rgba(15,23,42,0.3)]"
              >
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] bg-emerald-100 text-emerald-600 shadow-inner">
                  <Trophy className="h-10 w-10" strokeWidth={2.8} />
                </div>
                <h3 className="mt-5 text-[26px] font-black leading-tight text-stone-950">
                  恭喜提前解锁
                </h3>
                <p className="mt-2 text-[15px] font-bold leading-relaxed text-stone-500">
                  快去答题探索吧。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    hapticFeedback.light?.();
                    setShowEarlyUnlockSuccess(false);
                  }}
                  className="mt-6 h-12 w-full rounded-2xl bg-[#58CC02] text-[15px] font-black text-white shadow-[0_5px_0_#45a501] active:translate-y-1 active:shadow-none"
                >
                  太棒了
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 场景详情全屏遮罩 */}
        <AnimatePresence>
          {showSceneModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowSceneModal(false);
                startQuizIfEnoughStamina();
              }}
              className="absolute inset-0 z-[200] flex flex-col items-center justify-center p-12 bg-black/70 backdrop-blur-md cursor-pointer pointer-events-auto"
            >
              {/* 标题 */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-8 flex items-center gap-4"
              >
                <div className="w-12 h-px bg-amber-400/50" />
                <h2 className="text-amber-400 font-black text-3xl tracking-widest uppercase italic drop-shadow-lg">
                  Scene
                </h2>
                <div className="w-12 h-px bg-amber-400/50" />
              </motion.div>

              {/* 内容 */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="max-w-md"
              >
                <p className="text-white text-lg leading-[2] font-medium italic text-center drop-shadow-md">
                  "Maple was reading on the living room sofa, with the old table
                  lamp flickering on and off. Barnaby walked over from the
                  dining room, stopped at the living room doorway, and leaned
                  against the frame watching for a moment."
                </p>
              </motion.div>

              {/* 点击关闭提示 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-12 text-white/50 text-[10px] uppercase tracking-[0.4em]"
              >
                Click anywhere to close
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 聊天式对话流 */}
        <AnimatePresence>
          {showDialogueFlow && (
            <div
              className="absolute inset-0 z-[210] flex flex-col pointer-events-auto overflow-hidden"
              onClick={advanceDialogueFlow}
            >
              <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-md" />

              {/* 跳过按钮 */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setDialogueStep(
                    (
                      preLessonStoriesConfig.lessons.find(
                        (l: any) => l.lesson_id === quizIndex,
                      ) || preLessonStoriesConfig.lessons[0]
                    ).dialogues.length,
                  );
                }}
                className="absolute top-10 right-6 w-20 h-8 z-30 flex items-center justify-center group"
              >
                <img
                  src="/assets/tiaoguo.png"
                  alt="Skip"
                  className="w-full h-full object-contain transition-transform group-hover:scale-105 active:scale-95"
                  referrerPolicy="no-referrer"
                />
              </motion.button>

              <div className="flex-1 relative w-full flex flex-col justify-end pointer-events-none pb-8 sm:pb-12 z-10">
                {(() => {
                  const currentStory =
                    preLessonStoriesConfig.lessons.find(
                      (l: any) => l.lesson_id === quizIndex,
                    ) || preLessonStoriesConfig.lessons[0];
                  const currentDialogue = currentStory.dialogues[dialogueStep];

                  if (!currentDialogue) return null;

                  // 动态映射立绘人物
                  let avatar = currentDialogue.avatar;
                  if (
                    avatar === "/assets/Amilitouxiang.png" ||
                    avatar === MIA_AVATAR_IMAGE
                  )
                    avatar = MIA_PORTRAIT_IMAGE;
                  else if (avatar === "/assets/buntouxiang.png")
                    avatar = "/assets/BunNPC.png";
                  const displaySpeaker =
                    currentDialogue.speaker === "Amili"
                      ? "Mia"
                      : currentDialogue.speaker;
                  const portraitSide =
                    currentDialogue.position === "right" ? "right" : "left";

                  return (
                    <div className="relative w-full h-[60vh] flex flex-col justify-end">
                      {/* Dialogue Box */}
                      <motion.div
                        key={"dialog-" + dialogueStep}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative w-full px-4 z-30 pointer-events-auto"
                      >
                        <div className="relative isolate w-full max-w-sm mx-auto">
                          <motion.img
                            key={avatar}
                            initial={{
                              opacity: 0,
                              scale: 0.95,
                              y: 16,
                              x: portraitSide === "right" ? 30 : -30,
                            }}
                            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                            src={avatar}
                            alt={displaySpeaker}
                            className={`absolute bottom-[calc(100%-42px)] ${
                              portraitSide === "right"
                                ? "right-0 origin-bottom-right"
                                : "left-0 origin-bottom-left"
                            } max-w-[62%] w-auto max-h-[48vh] object-contain object-bottom drop-shadow-[0_15px_30px_rgba(0,0,0,0.5)] z-0 pointer-events-none`}
                            referrerPolicy="no-referrer"
                          />
                          <div className="relative z-10 w-full bg-white/95 backdrop-blur-xl border border-white/50 rounded-[24px] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.2)] pb-6">
                          <h4 className="text-[14px] font-black text-amber-500 uppercase tracking-wider mb-2">
                            {displaySpeaker}
                          </h4>
                          <ConfigBubble
                            file="pre_lesson_stories.json"
                            field="text_en"
                            align="left"
                            theme="light"
                          >
                            <p className="text-stone-800 font-medium text-[14px] leading-relaxed">
                              <UnderlinedDialogueText text={currentDialogue.text_en} />
                            </p>
                            {currentDialogue.text_cn && (
                              <p className="text-stone-500 text-[12px] mt-2.5 font-medium leading-relaxed">
                                {currentDialogue.text_cn}
                              </p>
                            )}
                          </ConfigBubble>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  );
                })()}

                {/* 课程标题及内容 (显示在最下方) */}
                <div className="absolute top-1/3 mt-10 left-0 right-0 flex flex-col items-center pointer-events-none z-0">
                  {dialogueStep >=
                    (
                      preLessonStoriesConfig.lessons.find(
                        (l: any) => l.lesson_id === quizIndex,
                      ) || preLessonStoriesConfig.lessons[0]
                    ).dialogues.length &&
                    (() => {
                      const lessonInfo =
                        lessonsConfig.lessons.find(
                          (l) => l.lesson_id === quizIndex,
                        ) || lessonsConfig.lessons[0];
                      return (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-center space-y-3"
                        >
                          <div className="inline-block py-1 px-4 bg-white/10 rounded-full border border-white/20">
                            <span className="text-amber-300 font-black text-xs uppercase tracking-[0.4em]">
                              {lessonInfo.unit_id.replace("-", " ")}
                            </span>
                          </div>
                          <ConfigBubble
                            file="lessons.json"
                            field="title"
                            align="center"
                          >
                            <h3 className="text-white text-3xl sm:text-4xl px-4 font-black italic drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] leading-tight">
                              {lessonInfo.title}
                            </h3>
                          </ConfigBubble>
                        </motion.div>
                      );
                    })()}
                </div>
              </div>

              {/* 4. 底部 Learn to Earn 按钮 */}
              {dialogueStep >=
                (
                  preLessonStoriesConfig.lessons.find(
                    (l: any) => l.lesson_id === quizIndex,
                  ) || preLessonStoriesConfig.lessons[0]
                ).dialogues.length && (
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute bottom-12 left-6 right-6 z-30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowDialogueFlow(false);
                      startQuizIfEnoughStamina();
                    }}
                    className="w-full h-16 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-between px-6 shadow-[0_8px_16px_rgba(245,158,11,0.3)] group active:scale-[0.98] transition-transform"
                  >
                    <span className="text-white font-black text-xl tracking-tight">
                      Learn to Earn
                    </span>
                    <div className="flex items-center gap-2 bg-black/10 py-2 px-3 rounded-xl border border-white/10">
                      <img
                        src="/assets/pojiuhome.png"
                        alt="Reward"
                        className="w-6 h-6 object-contain"
                        referrerPolicy="no-referrer"
                      />
                      <span className="text-white font-black text-lg">+1</span>
                    </div>
                  </button>
                </motion.div>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* 答题界面 */}
        <AnimatePresence>
          {showQuiz && (
            <div className="absolute -inset-px z-[250] bg-slate-950 flex flex-col pointer-events-auto overflow-hidden">
              {/* 顶部导航栏 - 浮动在最顶端其实是UnifiedQuiz里有进度条，但我们保留返回和体力 */}
              <div className="absolute top-10 left-0 right-0 h-20 flex items-center px-6 z-50 pointer-events-none">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() =>
                    playTownLiftTransition(() => {
                      setEarlyUnlockBuildingId(null);
                      setTargetDecorationQuiz(null);
                      setShowQuiz(false);
                    })
                  }
                  className="w-10 h-10 flex-shrink-0 pointer-events-auto"
                >
                  <img
                    src="/assets/fanhui.png"
                    alt="Back"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.button>

	                <motion.button
	                  whileHover={{ scale: 1.05 }}
	                  whileTap={{ scale: 0.95 }}
	                  onClick={handleFastForward}
	                  className="h-10 px-4 rounded-full bg-white/95 text-stone-700 border border-white shadow-[0_6px_18px_rgba(15,23,42,0.18)] flex-shrink-0 pointer-events-auto ml-auto relative font-black text-[14px]"
	                >
	                  跳过
	                </motion.button>
              </div>

              {/* Chat-Based Quiz UI */}
              <div className="relative flex-1 bg-slate-950 flex flex-col overflow-hidden w-full h-full">
                <UnifiedQuiz
                  key={`${
                    targetDecorationQuiz
                      ? `decor-${targetDecorationQuiz.decorationId}`
                      : earlyUnlockBuildingId
                        ? "early"
                        : "main"
                  }-${activeQuizLessonId}`}
                  ref={quizRef}
                  lessonId={activeQuizLessonId}
                  background={`/assets/lesson-scenes/lesson_${activeQuizLessonNumber}_start.png`}
                  stamina={stamina}
                  onQuestionChange={handleQuestionChange}
                  onAudioPlay={handleAudioPlay}
                  onComplete={
                    targetDecorationQuiz
                      ? handleTargetDecorationQuizComplete
                      : earlyUnlockBuildingId
                      ? handleEarlyUnlockQuizComplete
                      : handleQuizComplete
                  }
                  onFail={handleQuizFail}
                  onMistake={handleQuizMistake}
                  onAnswerResult={handleQuizAnswerResult}
                  setGlobalStamina={setStamina}
                />
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* 胜利结算界面 */}
        <AnimatePresence>
          {showVictory && (
            <UnitCompleteScreen
              unitId={completedVictoryUnitId}
              subtitle="Your town is ready for a new decoration."
              onContinue={continueAfterVictory}
              layerClassName="z-[110000]"
            />
          )}
        </AnimatePresence>

        {/* 新增连胜结算弹层 */}
	        <AnimatePresence>
	          {showWinStreak && (
	            <motion.div
	              initial={{ opacity: 0, y: 24 }}
	              animate={{ opacity: 1, y: 0 }}
	              exit={{ opacity: 0, y: 24 }}
	              transition={{ type: "spring", damping: 24, stiffness: 260 }}
	              className="absolute inset-0 z-[350] bg-gradient-to-b from-[#FFF1D6] via-[#FFFDF7] to-[#E9FCE4] pointer-events-auto overflow-y-auto"
	            >
	              <div className="min-h-full px-5 pt-12 pb-8 flex flex-col">
	                <div className="text-center">
	                  <p className="text-[13px] font-black text-orange-500 uppercase tracking-[0.22em]">
	                    lesson complete
	                  </p>
	                  <h2 className="mt-2 text-[36px] font-black leading-none text-stone-950">
	                    Streak
	                  </h2>
	                </div>

	                <div className="mt-7 rounded-[30px] bg-white border border-orange-100 shadow-[0_18px_44px_rgba(251,146,60,0.16)] px-5 py-6">
	                  <div className="flex items-center justify-center gap-4">
	                    <motion.div
	                      initial={{ scale: 0.8, rotate: -8 }}
	                      animate={{ scale: [1, 1.14, 1], rotate: [0, -5, 5, 0] }}
	                      transition={{ duration: 1.1, ease: "easeOut" }}
	                      className="w-24 h-24 rounded-[30px] bg-orange-100 text-orange-500 flex items-center justify-center"
	                    >
	                      <Flame className="w-14 h-14 fill-orange-400" strokeWidth={2.6} />
	                    </motion.div>
	                    <div>
	                      <p className="text-[56px] leading-none font-black text-stone-950">
	                        {streakDays}
	                      </p>
	                      <p className="mt-1 text-[13px] font-black text-orange-500 uppercase tracking-[0.16em]">
	                        day streak
	                      </p>
	                    </div>
	                  </div>
	                  <p className="mt-5 text-center text-[15px] font-black leading-relaxed text-stone-700">
	                    this town lives because of you - barmaby
	                  </p>
	                  <div className="mt-5 rounded-full bg-stone-100 h-3 overflow-hidden">
	                    <motion.div
	                      className="h-full rounded-full bg-[#58CC02]"
	                      initial={{ width: 0 }}
	                      animate={{ width: `${Math.min(100, (Math.min(streakDays, 30) / 30) * 100)}%` }}
	                      transition={{ type: "spring", stiffness: 110, damping: 16 }}
	                    />
	                  </div>
	                  <p className="mt-2 text-center text-[12px] font-black text-[#3f9300]">
	                    {Math.min(streakDays, 30)}/30 days checked in
	                  </p>
	                </div>

	                <div className="mt-6 rounded-[26px] bg-white border border-orange-100 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
	                  <div className="grid grid-cols-7 gap-1.5 mb-2">
	                    {STREAK_WEEKDAYS.map((day) => (
	                      <div key={day} className="text-center text-[10px] font-black text-stone-400 uppercase">
	                        {day}
	                      </div>
	                    ))}
	                  </div>
		                  <div className="grid grid-cols-7 gap-1.5">
		                    {STREAK_CALENDAR_DAYS.map((day) => {
		                      const isChecked = streakDays >= day;
		                      return (
		                        <div
		                          key={`win-streak-${day}`}
		                          className={`relative min-h-[46px] rounded-[13px] border flex flex-col items-center justify-center gap-0.5 ${
		                            isChecked
		                              ? "bg-[#E8F8DB] border-[#58CC02] shadow-[0_4px_0_rgba(88,204,2,0.22)]"
		                              : "bg-stone-50 border-stone-100"
		                          }`}
		                        >
		                          <span className={`text-[10px] font-black ${isChecked ? "text-[#3f9300]" : "text-stone-400"}`}>
		                            {day}
		                          </span>
		                          <Gift
		                            className={`w-5 h-5 ${isChecked ? "text-[#58CC02] fill-lime-200" : "text-stone-300"}`}
		                            strokeWidth={2.8}
		                          />
		                        </div>
		                      );
		                    })}
	                  </div>
	                </div>

	                <motion.button
	                  whileHover={{ scale: 1.02 }}
	                  whileTap={{ scale: 0.98 }}
	                  onClick={() => {
	                    hapticFeedback.light();
	                    setShowWinStreak(false);
	                    playTownLiftTransition(() => {
	                      setActiveTab("town");
	                      setScene("exterior");
	                    });
	                  }}
	                  className="mt-6 h-[56px] w-full rounded-[20px] bg-[#58CC02] text-white font-black text-[18px] shadow-[0_6px_0_#3f9300] active:translate-y-[5px] active:shadow-none"
	                >
	                  Continue
	                </motion.button>
	              </div>
	            </motion.div>
	          )}
	        </AnimatePresence>

        {/* 第二关连胜抽奖界面 */}
        <AnimatePresence>
          {showStreakDraw && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[360] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/lianxuechoujiang.png"
                  alt="Streak Draw"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowStreakDraw(false);
                    setShowStreakReward(true);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Push"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-2xl tracking-[0.1em] drop-shadow-md">
                    PUSH
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第二关连胜奖品界面 */}
        <AnimatePresence>
          {showStreakReward && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[370] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/lianxuejiangpin.png"
                  alt="Streak Reward"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowStreakReward(false);
                    setShowWinStreak2(true);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Collect Continue"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-lg tracking-[0.05em] drop-shadow-md">
                    COLLECT CONTINUE
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 第二关连胜结算弹层 */}
        <AnimatePresence>
          {showWinStreak2 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[380] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/liangsheng2.png"
                  alt="Win Streak 2"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setWinStreakNumber(3);
                    setShowWinStreak2(false);
	                    // Add sofa1 to furniture and return to the town scene
                    if (!furniture.includes("shafa1")) {
                      setFurniture((prev) => [...prev, "shafa1"]);
	                    }
	                    setActiveTab("town");
	                    setScene("exterior");
                    setShowGrannySofaDialogue(true);

                    setTimeout(() => {
                      setShowGrannySofaDialogue(false);
                    }, 3000);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Continue"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-2xl tracking-[0.1em] drop-shadow-md">
                    Continue
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Restaurant Unlock Dialogue */}
        <AnimatePresence>
          {showRestaurantUnlockDialogue && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[1000] bg-black/70 backdrop-blur-md flex items-center justify-center p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-white rounded-[40px] p-8 max-w-sm w-full shadow-2xl flex flex-col items-center text-center border-4 border-amber-400 relative overflow-hidden"
              >
                {/* Bun Avatar Header */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-amber-50 border-b-4 border-amber-100 flex items-center px-6">
                  <div className="w-16 h-16 bg-white rounded-2xl p-1 border-2 border-amber-200 shadow-sm flex-shrink-0">
                    <img
                      src="/assets/buntouxiang.png"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="ml-4 text-left">
                    <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                      Bun says:
                    </div>
                    <div className="text-stone-800 font-black text-lg italic">
                      {(guideDialoguesConfig.events.find(
                        (e) => e.event_id === "building_unlock_reward",
                      )?.dialogues[0] as any)?.title || "Great News!"}
                    </div>
                  </div>
                </div>

                <div className="mt-20 flex flex-col items-center">
                  <div className="relative mb-6">
                    <motion.div
                      animate={{ rotate: [0, 360], scale: [1, 1.2, 1] }}
                      transition={{
                        duration: 10,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-0 bg-amber-100 rounded-full blur-2xl opacity-60"
                    />
                    <div className="w-32 h-32 bg-white rounded-3xl flex items-center justify-center shadow-xl border-2 border-amber-50 relative z-10 p-4">
                      <img
                        src="/assets/canting.png"
                        className="w-full h-full object-contain"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  <h3 className="text-2xl font-black text-stone-800 mb-4 uppercase tracking-tighter">
                    LingoVille Expansion!
                  </h3>

                  <ConfigBubble
                    file="guide_dialogues.json"
                    field="text_en"
                    align="center"
                    className="mb-8"
                  >
                    <p className="text-stone-600 font-bold leading-relaxed">
                      "
                      {guideDialoguesConfig.events.find(
                        (e) => e.event_id === "building_unlock_reward",
                      )?.dialogues[0]?.text_en ||
                        "Wonderful! You've completed the Pizza Corner. Now it's time to unveil our grand Restaurant!"}
                      "
                    </p>
                  </ConfigBubble>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowRestaurantUnlockDialogue(false);
                      setIsRestaurantFalling(true);
                      setIsRestaurantUnlocked(true);
                      setTimeout(() => {
                        setIsRestaurantFalling(false);
                      }, 4000); // Increased time for the fancy landing
                    }}
                    className="w-full h-18 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-2xl font-black text-xl shadow-lg shadow-orange-200/50 transition-all border-b-6 border-orange-800 relative z-10 uppercase tracking-widest"
                  >
                    Unveil Now!
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 新增建筑升级弹层 */}
        <AnimatePresence>
          {showBuildingUpgrade && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[400] bg-black/90 backdrop-blur-md pointer-events-auto overflow-hidden"
            >
              {/* 升级底图居中显示 */}
              <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <img
                  src="/assets/jianzhushengj.png"
                  alt="Building Upgrade"
                  className="w-full h-full object-fill pointer-events-none"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* 底部 Upgrade 按钮区 */}
              <div className="absolute bottom-[4%] left-0 right-0 z-20 flex justify-center px-8">
                <motion.div
                  className="w-full max-w-[320px] h-18 cursor-pointer flex items-center justify-center group relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setShowBuildingUpgrade(false);
                    // 返回主界面展示建筑升级效果
                    setActiveTab("town");
                    setScene("exterior");
                    setTownEventStep(2);
                  }}
                >
                  <img
                    src="/assets/423anniu.png"
                    alt="Upgrade"
                    className="absolute inset-0 w-full h-full object-contain drop-shadow-lg"
                    referrerPolicy="no-referrer"
                  />
                  <span className="relative z-10 text-white font-black text-2xl tracking-[0.1em] drop-shadow-md">
                    Upgrade
                  </span>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 课程简介弹窗 */}
        <AnimatePresence>
          {selectedLesson && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[160] flex items-center justify-center bg-black/60 p-6"
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="relative w-full max-w-[1680px] aspect-[4/5] flex items-center justify-center p-2"
              >
                {/* 使用现有的任务底板作为背景 */}
                <img
                  src="/assets/renwudiban.png"
                  className="absolute inset-0 w-full h-full object-contain"
                  referrerPolicy="no-referrer"
                />

                {/* 关闭按钮 */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedLesson(null)}
                  className="absolute top-[-2%] right-[2%] w-10 h-10 z-20"
                >
                  <img
                    src="/assets/renwuguanbi.png"
                    className="w-full h-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                </motion.button>

                {/* 弹窗内容 */}
                <div className="relative z-10 w-[75%] h-[60%] mt-32 flex flex-col items-center">
                  <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6 border-4 border-amber-200">
                    <Book className="w-10 h-10 text-amber-600" />
                  </div>

                  <h2 className="text-xl font-black text-amber-900 mb-2 truncate w-full text-center">
                    {selectedLesson.title}
                  </h2>
                  <div className="text-[12px] font-bold text-amber-800/70 mb-8 uppercase tracking-widest">
                    Lesson {selectedLesson.id}
                  </div>

                  <div className="bg-amber-50/50 rounded-2xl p-4 mb-8 w-full border border-amber-100/50">
                    <p className="text-sm text-amber-900/80 font-medium leading-relaxed text-center">
                      Through this lesson, you will master everyday expressions
                      about "{selectedLesson.title}", and improve your language
                      skills through interaction.
                    </p>
                  </div>

                  <motion.button
	                    whileHover={{ scale: 1.05 }}
	                    whileTap={{ scale: 0.95 }}
	                    onClick={() => {
	                      const lessonToStart = selectedLesson;
                        if (lessonToStart.id !== quizIndex) {
                          showMessage(
                            lessonToStart.id < quizIndex
                              ? "这节课已经完成，继续主线会进入下一节"
                              : `当前主线是第 ${quizIndex} 课`,
                          );
                          return;
                        }
	                      playStartCtaVoice("startLearning");
	                      setSelectedLesson(null);
	                      window.setTimeout(() => {
	                        if (startQuizIfEnoughStamina()) {
                          showMessage(`Start learning: ${lessonToStart.title}`);
                        }
                      }, 360);
                    }}
                    className="w-40 h-12 relative"
                  >
                    <img
                      src="/assets/renwuanniu.png"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-amber-900 mb-0.5 pointer-events-none tracking-wider">
                      Start Learning
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 任务弹窗 */}
        <AnimatePresence>
          {showVictoryMsg && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                const messages =
                  guideDialoguesConfig.events.find(
                    (e) => e.event_id === "first_lesson_complete",
                  )?.dialogues || [];
                if (victoryDialogueStep < messages.length - 1) {
                  setVictoryDialogueStep((prev) => prev + 1);
                } else {
                  setShowVictoryMsg(false);
                  setShowTownTabArrow(true);
                }
              }}
              className="absolute inset-0 z-[250] flex items-end justify-center pb-32 bg-black/40 backdrop-blur-sm px-6 cursor-pointer pointer-events-auto"
            >
              <motion.div
                key={victoryDialogueStep}
                initial={{ y: 50, scale: 0.9, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                className="relative flex items-end gap-3 max-w-sm w-full"
              >
                {/* 外部左侧头像 */}
                <div className="w-16 h-16 rounded-full border-4 border-white shadow-xl bg-stone-100 flex-shrink-0 overflow-hidden relative z-10">
                  <img
                    src="/assets/buntouxiang.png"
                    className="w-full h-full object-cover -scale-x-100"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* 对话框主体 */}
                <div className="bg-white rounded-3xl p-6 shadow-2xl relative flex-1">
                  <h4 className="text-amber-600 font-black text-xs uppercase tracking-widest mb-1">
                    Grandmother
                  </h4>
                  <ConfigBubble
                    file="guide_dialogues.json"
                    field="text_en"
                    align="start"
                  >
                    <p className="text-stone-800 font-bold leading-relaxed">
                      {guideDialoguesConfig.events.find(
                        (e) => e.event_id === "first_lesson_complete",
                      )?.dialogues[victoryDialogueStep]?.text_en ||
                        "Hey! Your performance just now was amazing"}
                    </p>
                  </ConfigBubble>
                  <div className="mt-2 text-stone-400 text-[10px] uppercase font-bold tracking-widest">
                    Tap anywhere to continue
                  </div>
                  {/* 小气泡尖角 */}
                  <div className="absolute -left-2 bottom-6 w-4 h-4 bg-white rotate-45" />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 指向小镇图标的箭头 */}
        <AnimatePresence>
          {showTownTabArrow && activeTab !== "town" && (
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: 1,
                scale: 1,
                y: [0, -10, 0],
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{
                y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" },
              }}
              className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[110] flex flex-col items-center pointer-events-none"
            >
              <div className="bg-amber-500 text-white text-[10px] font-black px-3 py-1.5 rounded-full shadow-lg mb-2 whitespace-nowrap">
                Tap here to enter the town
              </div>
              <ArrowBigDown className="w-8 h-8 text-amber-500 fill-amber-500 drop-shadow-lg" />
            </motion.div>
          )}
        </AnimatePresence>

        {showReview && (
          <ReviewScreen
            onClose={() => setShowReview(false)}
            stamina={stamina}
            setGlobalStamina={setStamina}
            mistakes={userMistakes}
            playerId={appUserId}
            reviewWordMeta={reviewWordMeta}
            setReviewWordMeta={setReviewWordMeta}
            reviewRounds={reviewRounds}
            setReviewRounds={setReviewRounds}
            hasClaimedDailyStaminaReward={hasClaimedReviewStaminaToday}
            onClaimDailyStaminaReward={claimDailyReviewStaminaReward}
          />
        )}

        {/* 指向章节图标的箭头 */}
        <AnimatePresence>
          {showTasks && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowTasks(false);
                setHasNewTaskCompleted(false);
              }}
              className="absolute inset-0 z-[620] flex items-center justify-center bg-slate-950/55 backdrop-blur-[3px] px-4 py-8 pointer-events-auto"
            >
              <motion.div
                initial={{ opacity: 0, y: 26, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 18, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[392px] max-h-[78vh] overflow-hidden rounded-[30px] bg-[#F9FBFF] border border-white/80 shadow-[0_24px_70px_rgba(15,23,42,0.38)] flex flex-col"
              >
                <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-[#E0F2FE] via-[#EEF2FF] to-[#FFF7ED]" />
                <div className="absolute -top-16 -right-12 w-36 h-36 rounded-full bg-white/45 blur-2xl" />

                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setShowTasks(false);
                    setHasNewTaskCompleted(false);
                  }}
                  aria-label="关闭任务弹窗"
                  className="absolute top-4 right-4 z-30 w-10 h-10 rounded-full bg-white/90 border border-white shadow-[0_8px_20px_rgba(15,23,42,0.12)] flex items-center justify-center text-stone-500 active:scale-95"
                >
                  <Plus className="w-5 h-5 rotate-45" strokeWidth={3} />
                </motion.button>

                <div className="relative z-10 px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3 pr-11">
                    <div className="w-[52px] h-[52px] rounded-[20px] bg-[#6C63FF] text-white flex items-center justify-center shadow-[0_8px_18px_rgba(108,99,255,0.28)]">
                      <ListChecks className="w-7 h-7" strokeWidth={3} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-black text-[#6C63FF] uppercase tracking-wide">
                        Story Missions
                      </p>
                      <h2 className="text-[26px] font-black text-stone-900 leading-none">
                        任务列表
                      </h2>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[22px] bg-white/82 backdrop-blur-md border border-white shadow-[0_10px_26px_rgba(15,23,42,0.08)] p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Trophy className="w-5 h-5 text-amber-500 fill-amber-400 shrink-0" />
                        <span className="text-[14px] font-black text-stone-800 truncate">
                          主线进度
                        </span>
                      </div>
                      <span className="text-[13px] font-black text-stone-500 shrink-0">
                        {taskProgressInfo.completed}/{taskProgressInfo.total}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full bg-stone-100 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-[#58CC02] to-[#1CB0F6]"
                        initial={{ width: 0 }}
                        animate={{ width: `${taskProgressInfo.progress * 100}%` }}
                        transition={{ type: "spring", stiffness: 120, damping: 18 }}
                      />
                    </div>
                  </div>
                </div>

                <div className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 pb-5 pt-1">
                  <div className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {currentTasks.map((task, idx) => (
                      <motion.div
                        layout
                        key={`task-${task.id}-${task.lessonId}`}
                        initial={{ opacity: 0, x: 200, y: 50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                        exit={{
                          opacity: 0,
                          x: -500,
                          transition: {
                            duration: 0.5,
                            ease: [0.32, 0, 0.67, 0],
                          },
                        }}
                        transition={{
                          duration: 0.4,
                          type: "spring",
                          damping: 20,
                        }}
                        className={`relative overflow-hidden rounded-[24px] border p-3.5 flex items-center gap-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.08)] flex-shrink-0 ${
                          task.isCompleted
                            ? "bg-emerald-50 border-emerald-100"
                            : task.isActive
                              ? "bg-white border-sky-100"
                              : "bg-white/75 border-stone-100"
                        }`}
                      >
                        {task.isActive && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-sky-50 via-transparent to-amber-50"
                            animate={{ opacity: [0.45, 0.85, 0.45] }}
                            transition={{ duration: 2.6, repeat: Infinity }}
                          />
                        )}

                        {(() => {
                          const reward = getTownDecorationRewardForTask(
                            task.linkedLessonId || task.lessonId,
                            task.reward_item_id,
                          );
                          return (
                            <div
                              className={`relative z-10 w-[60px] h-[60px] rounded-[20px] flex-shrink-0 flex items-center justify-center border overflow-hidden shadow-[0_8px_18px_rgba(82,60,28,0.12)] ${
                                task.isCompleted
                                  ? "bg-emerald-50 border-emerald-200"
                                  : "bg-gradient-to-br from-white via-amber-50 to-emerald-50 border-amber-100"
                              }`}
                            >
                              <div className="absolute inset-[5px] rounded-[15px] border border-white/80 bg-white/55" />
                              {reward && (
                                <>
                                  <img
                                    src={getTownDecorationRewardIconSrc(
                                      reward.primaryDecoration,
                                    )}
                                    alt={reward.primaryDecoration.id}
                                    className="relative z-10 h-[52px] w-[52px] object-contain drop-shadow-sm"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                      const target = e.currentTarget;
                                      if (target.dataset.fallbackSrc === "true")
                                        return;
                                      target.dataset.fallbackSrc = "true";
                                      target.src =
                                        reward.primaryDecoration.src;
                                    }}
                                  />
                                </>
                              )}
                              {!reward && (
                                <Gift
                                  className="relative z-10 h-8 w-8 text-amber-500"
                                  strokeWidth={2.8}
                                />
                              )}
                              {task.isActive && (
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{
                                    duration: 4,
                                    repeat: Infinity,
                                    ease: "linear",
                                  }}
                                  className="absolute inset-0 bg-gradient-to-t from-amber-400/20 to-transparent"
                                />
                              )}
                            </div>
                          );
                        })()}

                        <div className="relative z-10 min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-black ${
                                task.isCompleted
                                  ? "bg-emerald-100 text-emerald-700"
                                  : task.isActive
                                    ? "bg-sky-100 text-sky-700"
                                    : "bg-stone-100 text-stone-500"
                              }`}
                            >
                              Lesson {task.lessonId}
                            </span>
                            {task.isActive && (
                              <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black">
                                Current
                              </span>
                            )}
                          </div>
                          <h3 className="text-stone-900 text-[16px] font-black leading-tight truncate">
                            {task.title}
                          </h3>
                          <p className="text-stone-500 text-[12px] font-bold mt-1 truncate">
                            {task.subtitle || "+ words, + phrases"}
                          </p>
                        </div>

	                        <motion.button
	                          whileTap={{ scale: 0.95 }}
	                          onClick={() => {
	                            const taskLessonId =
	                              task.linkedLessonId || task.lessonId;
	                            if (task.isCompleted) {
	                              showMessage("这节课已经完成，继续主线会进入下一节");
	                              return;
	                            }
	                            if (taskLessonId !== quizIndex) {
	                              showMessage(`当前主线是第 ${quizIndex} 课`);
	                              return;
	                            }
	                            playStartCtaVoice("start");
	                            setShowTasks(false);
	                            handleStartGame();
	                          }}
                          className={`relative z-10 h-12 min-w-[72px] rounded-[18px] flex-shrink-0 flex items-center justify-center font-black text-[13px] shadow-sm active:scale-95 transition-transform ${
                            task.isCompleted
                              ? "bg-emerald-100 text-emerald-700 cursor-default"
                              : "bg-[#58CC02] text-white shadow-[0_4px_0_#3f9300]"
                          }`}
                        >
                          {task.isCompleted ? (
                            <CheckCircle2 className="w-6 h-6" strokeWidth={3} />
                          ) : (
                            <span className="flex items-center gap-1">
                              Start
                              <ChevronRight className="w-4 h-4" strokeWidth={3} />
                            </span>
                          )}
                        </motion.button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 课程大纲弹窗 */}
        <AnimatePresence>
          {showCourseOutline && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
	              className="absolute inset-0 z-[9000] flex items-center justify-center bg-black/60 p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                className="relative w-full max-w-[400px] max-h-[80%] bg-[#F5F5F7] rounded-[24px] shadow-xl flex flex-col overflow-hidden"
              >
	                <div className="px-5 py-4 bg-white shadow-sm z-10">
	                  <div className="flex items-start justify-between gap-3">
	                    <div className="min-w-0">
	                      <ConfigBubble file="lessons.json" field="outline_title">
	                        <h2 className="text-[#333] font-black text-xl tracking-tight">
	                          城市等级与课程进度
	                        </h2>
	                      </ConfigBubble>
	                      <p className="mt-1 text-[12px] font-bold text-stone-400">
	                        {(lessonsConfig as any).outline_title || "Course Outline"}
	                      </p>
	                    </div>
	                  <motion.button
	                    whileHover={{ scale: 1.1 }}
	                    whileTap={{ scale: 0.9 }}
	                    onClick={() => setShowCourseOutline(false)}
	                    className="w-8 h-8 flex items-center justify-center bg-stone-100 rounded-full text-stone-500"
	                  >
	                    ×
	                  </motion.button>
	                  </div>
	                  <div className="mt-4 rounded-[18px] bg-indigo-50 border border-indigo-100 p-3">
	                    <div className="flex items-center justify-between gap-3">
	                      <div className="flex items-center gap-2.5">
	                        <div className="w-10 h-10 rounded-[14px] bg-white text-indigo-500 flex items-center justify-center shadow-sm">
	                          <MapPinned className="w-5 h-5" strokeWidth={3} />
	                        </div>
	                        <div>
	                          <p className="text-[11px] font-black text-indigo-400 uppercase">
	                            当前城市等级
	                          </p>
	                          <p className="text-[18px] leading-tight font-black text-indigo-800">
	                            Lv.{cityLevelInfo.level}
	                          </p>
	                        </div>
	                      </div>
	                      <span className="text-[12px] font-black text-indigo-500">
	                        {cityLevelInfo.progressLabel}
	                      </span>
	                    </div>
	                    <div className="mt-3 h-2 rounded-full bg-white overflow-hidden">
	                      <motion.div
	                        className="h-full rounded-full bg-indigo-500"
	                        animate={{ width: `${cityLevelInfo.progress * 100}%` }}
	                        transition={{ type: "spring", stiffness: 120, damping: 18 }}
	                      />
	                    </div>
	                  </div>
	                </div>

                <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
                  {lessonsConfig.lessons.map((lesson, idx) => {
                    const isCompleted = quizIndex > lesson.lesson_id;
                    const isCurrent = quizIndex === lesson.lesson_id;
                    const isLocked = quizIndex < lesson.lesson_id;
                    const stage = lesson.unit_id;

                    return (
                      <div
                        key={lesson.lesson_id}
                        className={`flex gap-4 p-4 rounded-[16px] border-2 transition-colors ${isCurrent ? "bg-white border-[#5A52E0] shadow-md" : isCompleted ? "bg-white/60 border-stone-200" : "bg-stone-50 border-stone-200/50 opacity-80"}`}
                      >
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden ${isCurrent ? "bg-[#5A52E0]/10" : isCompleted ? "bg-green-100" : "bg-stone-200"}`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6 text-green-500" />
                          ) : isLocked ? (
                            <div className="w-5 h-5 border-2 border-stone-400 rounded-full border-t-transparent flex items-center justify-center">
                              <div className="w-2 h-2 bg-stone-400 rounded-full" />
                            </div>
                          ) : (
                            <Book className="w-6 h-6 text-[#5A52E0]" />
                          )}
                        </div>
                        <div className="flex flex-col justify-center flex-1">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                              {stage}
                            </span>
                            <span
                              className={`text-[10px] font-black uppercase ${isCurrent ? "text-[#5A52E0]" : isCompleted ? "text-green-500" : "text-stone-400"}`}
                            >
                              {isCompleted
                                ? "Completed"
                                : isCurrent
                                  ? "In Progress"
                                  : "Locked"}
                            </span>
                          </div>
                          <ConfigBubble file="lessons.json" field="title">
                            <h3
                              className={`font-black text-base ${isLocked ? "text-stone-400" : "text-stone-800"}`}
                            >
                              Lesson {lesson.lesson_id}: {lesson.title}
                            </h3>
                          </ConfigBubble>
                          <ConfigBubble
                            file="lessons.json"
                            field="description"
                            className="mt-1"
                          >
                            <p
                              className={`text-[12px] font-bold ${isLocked ? "text-stone-300" : "text-stone-500"}`}
                            >
                              {lesson.description}
                            </p>
                          </ConfigBubble>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Onboarding Flow: onboardingStep 1 to 9 */}
        <AnimatePresence>
          {onboardingStep <= 9 && (
            <motion.div
              key="onboarding-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[99999] bg-[#1a1a1a] flex flex-col items-center justify-between pointer-events-auto overflow-hidden"
            >
              {/* Background */}
              <img
                src={
                  onboardingStep === 1
                    ? "/assets/xinshou1.png"
                    : onboardingStep === 2
                    ? "/assets/xinshou2.png"
                    : onboardingStep === 3
                    ? "/assets/xinshou3.png"
                    : "/assets/quanbubg1.png"
                }
                className="absolute inset-0 w-full h-full object-cover"
                alt="Background"
                referrerPolicy="no-referrer"
              />

              {/* Header with Icon and Title */}
              <AnimatePresence>
                {onboardingStep > 3 && onboardingStep < 9 && (
                  <motion.div
                    key="top-header"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, position: "absolute" }}
                    transition={{ type: "tween", duration: 0.2 }}
                    className="relative z-20 w-full pt-16 px-6 flex flex-col pointer-events-auto shrink-0"
                  >
                    {/* Top Bar with Back Button & Progress */}
                    <motion.div
                      className="flex items-center w-full mb-8"
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                      }}
                    >
	                      <button
	                        onClick={() =>
	                          changeOnboardingStepNow((prev) =>
	                            Math.max(1, prev - 1),
	                          )
	                        }
                        className="w-10 h-10 shrink-0 flex items-center justify-center p-2 rounded-xl group active:scale-95 transition-transform"
                      >
                        <img
                          src="/assets/fanhui.png"
                          className="w-full h-full object-contain drop-shadow-sm group-hover:brightness-90 brightness-0 opacity-70"
                          referrerPolicy="no-referrer"
                        />
                      </button>

                      {/* Progress bar for steps 3-6 */}
                      {onboardingStep >= 3 && onboardingStep <= 6 && (
                        <div className="flex-1 flex gap-2 mx-4 items-center">
                          {[1, 2, 3, 4].map((step) => (
                            <div
                              key={step}
                              className={`h-3 rounded-full flex-1 transition-colors duration-500 ${step <= onboardingStep - 2 ? "bg-[#58CC02]" : "bg-stone-400"}`}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>

                    <div className="flex items-start gap-4 relative w-full">
                      <motion.img
                        key={`rabbit-${onboardingStep}`}
                        initial={
                          onboardingStep >= 2 && onboardingStep <= 8
                            ? { x: -100, opacity: 0 }
                            : false
                        }
                        animate={
                          onboardingStep >= 2 && onboardingStep <= 8
                            ? { x: 0, opacity: 1 }
                            : false
                        }
                        transition={{
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                        src="/assets/xiaotuzijiemian.png"
                        alt="Rabbit Icon"
                        className={`object-contain drop-shadow-md flex-shrink-0 relative z-10 ${onboardingStep >= 3 && onboardingStep <= 8 ? "w-20 h-20" : "w-14 h-14"}`}
                        referrerPolicy="no-referrer"
                      />
                      {onboardingStep >= 3 && onboardingStep <= 8 ? (
                        <motion.div
                          key={`bubble-${onboardingStep}`}
                          initial={{ opacity: 0, scale: 0.5, x: -20 }}
                          animate={{ opacity: 1, scale: 1, x: 0 }}
                          transition={{
                            type: "spring",
                            stiffness: 260,
                            damping: 20,
                            delay: 0.1,
                          }}
                          className="relative bg-slate-50 border-2 border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm mt-1"
                          style={{ transformOrigin: "top left" }}
                        >
                          <div className="absolute top-1 -left-2 w-3 h-3 bg-slate-50 border-l-2 border-t-2 border-slate-200 -rotate-45 z-0" />
                          <h1 className="relative z-10 text-stone-800 font-extrabold text-lg tracking-tight leading-snug">
                            {ONBOARDING_TITLES[onboardingStep - 1]}
                          </h1>
                        </motion.div>
                      ) : (
                        <motion.h1
                          key={`title-${onboardingStep}`}
                          initial={
                            onboardingStep === 2
                              ? { opacity: 0, x: -20 }
                              : false
                          }
                          animate={
                            onboardingStep === 2 ? { opacity: 1, x: 0 } : false
                          }
                          transition={{ delay: 0.1 }}
                          className="text-stone-800 font-extrabold text-2xl drop-shadow-sm tracking-tight leading-snug mt-2"
                        >
                          {ONBOARDING_TITLES[onboardingStep - 1]}
                        </motion.h1>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Middle Section Dynamic Content */}
              <div className="relative w-full flex-1 flex flex-col items-center z-10 pointer-events-auto px-6 mt-4 overflow-x-hidden overflow-y-auto">
                <AnimatePresence mode="wait">
                  {onboardingStep === 1 && (
                    <motion.div
                      key="step1"
                      exit={{ opacity: 0 }}
                      className="flex-1 flex flex-col items-center pt-16 w-full relative"
                    >
                      <h1 className="text-[#FF4B4B] font-black text-[2rem] drop-shadow-sm tracking-wide leading-[1.1] text-center mb-3">
                        The most fun way<br />to learn language
                      </h1>
                      <p className="text-black font-extrabold text-[1.1rem] drop-shadow-xs">
                        Start your language adventure Now!
                      </p>
                    </motion.div>
                  )}

                  {onboardingStep === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="relative flex-1 flex flex-col w-full items-center pt-16 pointer-events-none"
                    >
                      <h1 className="text-[#FF4B4B] font-black text-[2rem] drop-shadow-sm tracking-wide leading-[1.1] text-center mb-3">
                        Learning in<br />real-life situations
                      </h1>
                      <p className="text-black font-extrabold text-[1.1rem] drop-shadow-xs">
                        Immerse in real-world language.
                      </p>

                      {/* Interaction Area */}
                      <div className="flex-1 w-full flex flex-col justify-center items-center mt-4">
                        {/* NPC avatars and bubbles */}
                        <div className="w-full flex justify-between items-start px-2 mb-4 shrink-0 relative h-32">
                          {/* Left NPC */}
                          <div className="flex gap-2">
                            <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                              <img src="/assets/qitatouxiangdi.png" className="absolute inset-0 w-full h-full object-contain" />
                              <img src="/assets/barista.png" className="absolute w-[84%] h-[84%] object-contain rounded-full" style={{ top: '2%' }} />
                              <div className="absolute bottom-[7px] left-0 right-0 px-1 text-center text-[#4E2B02] text-[7px] font-black whitespace-nowrap tracking-wide leading-none select-none">barista</div>
                            </div>
                            <div className="relative px-3 py-2 bg-white border-2 border-orange-400 rounded-xl shadow-sm text-stone-800 font-bold text-xs max-w-[140px]">
                              <TypewriterText
                                text="Hey! What can I get for you?"
                                onComplete={() => setTimeout(() => setStep2Phase(1), 500)}
                              />
                              <div className="absolute top-[10px] -left-[8px] border-r-[8px] border-r-orange-400 border-y-transparent border-y-[6px] w-0 h-0" />
                              <div className="absolute top-[12px] -left-[5px] border-r-[6px] border-r-white border-y-transparent border-y-[4px] w-0 h-0" />
                            </div>
                          </div>

                          {/* Right NPC */}
                          {step2Phase >= 6 && (
                            <div className="flex gap-2 absolute right-2 top-10">
                              <div className="relative px-3 py-2 bg-white border-2 border-blue-500 rounded-xl shadow-sm text-stone-800 font-bold text-xs max-w-[140px]">
                                <TypewriterText text="I'd like a Latte, please." />
                                <div className="absolute top-[10px] -right-[8px] border-l-[8px] border-l-blue-500 border-y-transparent border-y-[6px] w-0 h-0" />
                                <div className="absolute top-[12px] -right-[5px] border-l-[6px] border-l-white border-y-transparent border-y-[4px] w-0 h-0" />
                              </div>
                              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                                <img src="/assets/zhujuetouxiangdi.png" className="absolute inset-0 w-full h-full object-contain" />
                                <img src={PLAYER_COURSE_AVATAR_IMAGE} className="absolute w-[76%] h-[76%] object-contain rounded-full" style={{ top: '5%' }} />
                                <div className="absolute bottom-[7px] left-0 right-0 px-1 text-center text-[#4E2B02] text-[7px] font-black whitespace-nowrap tracking-wide leading-none select-none">me</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* White Board sentence builder */}
                        <div className="w-full bg-white rounded-2xl shadow-xl p-4 border-2 border-stone-200 mt-auto mb-8 max-w-[320px]">
                          {/* Target Blanks */}
                          <div className="flex flex-wrap gap-2 mb-6 min-h-[40px] items-center pb-2 border-b-2 border-stone-100">
                            {["I'd", "like", "a", "Latte", "please."].map((word, i) => (
                              <div key={i} className={`h-8 flex-shrink-0 flex items-center justify-center rounded-lg px-3 font-extrabold text-sm transition-all ${step2Phase > i ? "bg-white border-2 border-[#1CB0F6] text-[#1CB0F6] shadow-sm" : "border-b-2 border-stone-300 text-transparent"}`}>
                                {step2Phase > i ? word : word}
                              </div>
                            ))}
                          </div>
                          {/* Word Bank */}
                          <div className="flex gap-2 flex-wrap justify-center">
                            {["latte", "i'd", "please.", "a", "like"].map((word, i) => {
                              // map word to its answer index
                              const ansIdx = ["I'd", "like", "a", "Latte", "please."].findIndex(w => w.toLowerCase() === word.toLowerCase());
                              const isUsed = step2Phase > ansIdx;
                              return (
                                <div key={i} className={`px-4 py-2 rounded-xl font-extrabold text-sm transition-all ${isUsed ? "bg-stone-200 text-stone-300 shadow-none scale-95" : "bg-white border-2 border-stone-200 shadow-[0_4px_0_0_#e5e7eb] text-stone-700"}`}>
                                  {word}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="w-full flex-1 flex flex-col pt-16 items-center pointer-events-none"
                    >
                      <h1 className="text-[#FF4B4B] font-black text-[2rem] drop-shadow-sm tracking-wide leading-[1.1] text-center mb-3">
                        Learn a language<br />like playing a game
                      </h1>
                      <p className="text-black font-extrabold text-[1.1rem] drop-shadow-xs mb-8">
                        Every lesson grows your town.
                      </p>

                      <div className="flex-1 w-full flex flex-col items-center mt-2 relative perspective-1000">
                        {/* Activity Card */}
	                        <motion.img
	                          src="/assets/xinshou31.png"
	                          className="w-[230px] object-contain drop-shadow-xl z-20"
	                          initial={{ opacity: 0, y: 20 }}
	                          animate={{ opacity: 1, y: 0 }}
	                        />

                        {step3Phase >= 1 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="text-stone-400 my-2 z-10"
                          >
                            <ArrowDown className="w-8 h-8" strokeWidth={3} />
                          </motion.div>
                        )}

                        <div className="flex items-center gap-2 z-10 mt-2">
                          {step3Phase >= 2 && (
	                            <motion.img
	                              src="/assets/xinshou32.png"
	                              className="w-[120px] object-contain drop-shadow-lg"
	                              initial={{ opacity: 0, scale: 0.8 }}
	                              animate={{ opacity: 1, scale: 1 }}
	                            />
                          )}

                          {step3Phase >= 3 && (
                            <motion.div
                              initial={{ opacity: 0, width: 0 }}
                              animate={{ opacity: 1, width: 'auto' }}
                              className="text-stone-400"
                            >
                              <ArrowRight className="w-6 h-6" strokeWidth={3} />
                            </motion.div>
                          )}

                          {step3Phase >= 4 && (
	                            <motion.img
	                              src="/assets/xinshou33.png"
	                              className="w-[144px] object-contain drop-shadow-2xl"
	                              initial={{ opacity: 0, scale: 0.8 }}
	                              animate={{
                                opacity: 1,
                                scale: [1, 1.05, 1],
                              }}
                              transition={{
                                scale: {
                                  duration: 2,
                                  repeat: Infinity,
                                  ease: "easeInOut"
                                }
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 5 && (
                    <motion.div
                      key="step4"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed">
                        This will help to adapt the first lesson to your level.
                      </p>
                      <div className="flex flex-col gap-4 pb-8">
                        {[
                          { text: "Not very much", bars: 1 as const },
                          { text: "I know some", bars: 2 as const },
                          { text: "I know a lot", bars: 3 as const },
                        ].map((level, idx) => (
                          <div
                            key={`${level.text}-${idx}`}
                            onClick={() => setKnowledgeLevel(level.text)}
                            className={`bg-white rounded-2xl p-5 flex items-center justify-between shadow-sm border-2 ${knowledgeLevel === level.text ? "border-[#1CB0F6] bg-blue-50/50" : "border-stone-200"} cursor-pointer active:scale-95 transition-all w-full`}
                          >
                            <span className="text-stone-800 font-extrabold text-lg">
                              {level.text}
                            </span>
                            <SignalBars level={level.bars} />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 6 && (
                    <motion.div
                      key="step5"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed">
                        We'll tailor lessons to your goal.
                      </p>
                      <div className="flex flex-col gap-3 pb-8">
                        {[
                          {
                            id: "travel",
                            text: "Travel & explore cultures",
                            Icon: Plane,
                          },
                          {
                            id: "move",
                            text: "Move to another country",
                            Icon: Home,
                          },
                          {
                            id: "education",
                            text: "Support my education",
                            Icon: GraduationCap,
                          },
                          {
                            id: "career",
                            text: "Boost my career",
                            Icon: Briefcase,
                          },
                          {
                            id: "connect",
                            text: "Connect with people",
                            Icon: Users,
                          },
                          { id: "fun", text: "Just for fun", Icon: Smile },
                          { id: "other", text: "Other", Icon: MoreHorizontal },
                        ].map((goal, idx) => {
                          const isSelected = learningGoals.includes(goal.id);
                          return (
                            <div
                              key={`${goal.id}-${idx}`}
                              onClick={() =>
                                setLearningGoals((prev) =>
                                  isSelected
                                    ? prev.filter((g) => g !== goal.id)
                                    : [...prev, goal.id],
                                )
                              }
                              className={`bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border-2 ${isSelected ? "border-[#1CB0F6] bg-blue-50/50" : "border-stone-200"} cursor-pointer active:scale-95 transition-all w-full`}
                            >
                              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                                <goal.Icon
                                  className={`w-8 h-8 ${isSelected ? "text-[#1CB0F6]" : "text-stone-400"}`}
                                />
                              </div>
                              <span
                                className={`font-extrabold text-lg ${isSelected ? "text-[#1CB0F6]" : "text-stone-800"}`}
                              >
                                {goal.text}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 4 && (
                    <motion.div
                      key="step6"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed text-center">
                        We'll use this language to help you learn. You can
                        change it in Settings.
                      </p>

                      <div className="relative w-full flex-1 flex flex-col items-center justify-center mt-8">
                        {/* Top floating UI */}
                        <div className="absolute top-0 flex flex-col mt-[-20px] left-1/2 -translate-x-1/2 w-[240px]">
                          <div className="bg-[#ccfbf1] text-[#0f766e] font-black px-4 py-2.5 rounded-2xl w-fit xl shadow-sm border-2 border-[#5eead4] z-10 self-start">
                            English
                          </div>
                          <div className="absolute top-[50%] left-[30%] -translate-x-1/2 -translate-y-1/2 z-20 flex">
                            <ArrowRightLeft className="w-8 h-8 text-stone-400 rotate-45 drop-shadow-md" />
                          </div>
                          <div className="bg-[#f3e8ff] text-[#7e22ce] font-black px-4 py-2.5 rounded-2xl w-fit shadow-sm border-2 border-[#d8b4fe] z-10 self-end mt-4">
                            Your native language
                          </div>
                        </div>

                        {/* Rabbit */}
                        <img
                          src="/assets/xiaotuzijiemian.png"
                          className="w-48 h-48 object-contain -translate-y-8 drop-shadow-xl"
                          referrerPolicy="no-referrer"
                        />

                        {/* Options */}
                        <div className="-mt-7 flex flex-col gap-4 bg-white/70 backdrop-blur px-6 py-4 rounded-3xl shadow-sm border-2 border-white">
                          {["English", "Chinese"].map((lang, idx) => (
                            <div
                              key={`${lang}-${idx}`}
                              onClick={() => setNativeLang(lang)}
                              className="flex items-center gap-3 cursor-pointer group"
                            >
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${nativeLang === lang ? "border-[#58CC02] bg-[#58CC02]" : "border-stone-300 group-hover:border-stone-400"} transition-colors`}
                              >
                                {nativeLang === lang && (
                                  <div className="w-2.5 h-2.5 bg-white rounded-full" />
                                )}
                              </div>
                              <span
                                className={`font-extrabold text-lg ${nativeLang === lang ? "text-[#58CC02]" : "text-stone-500"}`}
                              >
                                {lang}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 7 && (
                    <motion.div
                      key="step7"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col items-center justify-center mt-2 max-w-sm px-4 space-y-12"
                    >
                      {/* Circular Progress */}
                      <div className="relative w-48 h-48 flex items-center justify-center">
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                          <circle
                            cx="96"
                            cy="96"
                            r="80"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            className="text-stone-200"
                          />
                          <circle
                            cx="96"
                            cy="96"
                            r="80"
                            stroke="currentColor"
                            strokeWidth="12"
                            fill="transparent"
                            strokeDasharray="502.65"
                            strokeDashoffset={
                              502.65 - (502.65 * loadingProgress) / 100
                            }
                            className="text-[#58CC02] transition-all duration-100 ease-linear"
                          />
                        </svg>
                        <span className="text-5xl font-black text-[#58CC02] drop-shadow-sm">
                          {loadingProgress}%
                        </span>
                      </div>

                      {/* Loading Texts */}
                      <div className="flex flex-col gap-5 w-full px-2">
                        {[
                          {
                            text: "Analyzing your learning needs",
                            threshold: 0,
                          },
                          {
                            text: "Creating a personalized learning plan",
                            threshold: 33,
                          },
                          {
                            text: "Customizing exclusive content",
                            threshold: 66,
                          },
                        ].map((item, idx, arr) => {
                          const isStarted = loadingProgress >= item.threshold;
                          const isCompleted =
                            loadingProgress >= (arr[idx + 1]?.threshold ?? 100);

                          return (
                            <div
                              key={idx}
                              className={`flex items-center justify-between text-[15px] font-bold ${isStarted ? "text-stone-700" : "text-stone-300"} transition-colors`}
                            >
                              <div className="flex items-center gap-1">
                                <span>{item.text}</span>
                                {isStarted && !isCompleted && <LoadingDots />}
                              </div>
                              {isCompleted && (
                                <CheckCircle2 className="w-6 h-6 text-[#1CB0F6] flex-shrink-0 drop-shadow-sm" />
                              )}
                              {!isCompleted && isStarted && (
                                <div className="w-6 h-6 flex-shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 8 && (
                    <motion.div
                      key="step8"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                        delay: 0.1,
                      }}
                      className="w-full flex-1 flex flex-col mt-2 max-w-sm px-2"
                    >
                      <p className="text-stone-500 font-bold mb-6 px-1 text-base leading-relaxed text-center">
                        Tailored to your goals, level, and interests and
                        preference.
                      </p>

                      <div className="flex flex-col gap-4 pb-8 w-full">
                        {/* Button 1: English Level */}
                        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border-2 border-stone-200 cursor-pointer active:scale-95 transition-all w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                              <User className="w-6 h-6 text-blue-500" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-stone-500 font-bold text-[10px] uppercase tracking-wider">
                                English Level
                              </span>
                              <span className="text-stone-800 font-black text-lg">
                                Beginner - A1
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-stone-300" />
                        </div>

                        {/* Button 2: Learning Goal */}
                        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border-2 border-stone-200 cursor-pointer active:scale-95 transition-all w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                              <Plane className="w-6 h-6 text-green-500" />
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-stone-500 font-bold text-[10px] uppercase tracking-wider">
                                Learning Goal
                              </span>
                              <span className="text-stone-800 font-black text-lg">
                                Prepare to travel
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-stone-300" />
                        </div>

                        {/* Button 3: Language */}
                        <div className="bg-white rounded-2xl p-4 flex items-center justify-between shadow-sm border-2 border-stone-200 cursor-pointer active:scale-95 transition-all w-full">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                              <span className="text-2xl leading-none">🇺🇸</span>
                            </div>
                            <div className="flex flex-col text-left">
                              <span className="text-stone-500 font-bold text-[10px] uppercase tracking-wider">
                                Language
                              </span>
                              <span className="text-stone-800 font-black text-lg">
                                English
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-6 h-6 text-stone-300" />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {onboardingStep === 9 && (
                    <motion.div
                      key="step9"
                      initial={{ x: "100%", opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        type: "spring",
                        stiffness: 200,
                        damping: 20,
                      }}
                      className="w-full flex-1 flex flex-col items-center justify-center mt-2 px-2 text-center h-full pb-8"
                    >
                      <h1 className="text-stone-800 font-black text-6xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] tracking-tighter uppercase mb-6 transform -rotate-3 text-[#58CC02] stroke-white stroke-2 z-10 relative">
                        Perfect!
                      </h1>
                      <img
                        src="/assets/xiaotuzijiemian.png"
                        className="w-64 h-64 object-contain drop-shadow-2xl animate-bounce translate-y-8"
                        referrerPolicy="no-referrer"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {isReturningOpeningLaunch && onboardingStep === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 rounded-[18px] border border-white/70 bg-white/75 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.16)] backdrop-blur-md"
                >
                  <p className="mb-2 text-center text-[12px] font-black uppercase tracking-[0.14em] text-stone-700">
                    Loading your town...
                  </p>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/85 shadow-inner">
                    <motion.div
                      className="h-full rounded-full bg-[#58CC02]"
                      style={{ width: `${step1Progress}%` }}
                    />
                  </div>
                </motion.div>
              )}

              {/* Bottom Continue Button */}
              {onboardingStep !== 7 && !isReturningOpeningLaunch && (
                <div className="relative z-10 w-full p-8 pb-12 mt-auto">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
	                    onClick={() => {
	                      if (onboardingStep === 3) {
	                        changeOnboardingStepNow(10);
	                      } else {
	                        changeOnboardingStepNow((prev) => prev + 1);
	                      }
	                    }}
                    className={`w-full text-white font-black text-xl py-4 rounded-2xl shadow-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest pointer-events-auto ${
                      onboardingStep <= 3
                        ? "bg-[#FF4B4B] hover:bg-[#e03d3d] border-[#c02d2d]"
                        : "bg-[#1CB0F6] hover:bg-[#1899D6] border-[#127ea6]"
                    }`}
                  >
                    {onboardingStep === 1 ? "GO" : onboardingStep === 9 ? "Let's Start" : "Continue"}
                  </motion.button>
                </div>
              )}
              {onboardingStep === 7 && (
                <div
                  className={`relative z-10 w-full p-8 pb-12 mt-auto transition-opacity duration-300 ${loadingProgress >= 100 ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
	                    onClick={() =>
	                      changeOnboardingStepNow((prev) => prev + 1)
	                    }
                    className="w-full bg-[#58CC02] hover:bg-[#46a302] text-white font-black text-xl py-4 rounded-2xl shadow-xl border-b-4 border-[#3b8a02] active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest pointer-events-auto"
                  >
                    Start Learning
                  </motion.button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pre-onboarding Levels (Step 10 and 11) */}
        <AnimatePresence>
          {onboardingStep === 10 && (
            <motion.div
              key="pre-level-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[99999] bg-white pointer-events-auto overflow-hidden flex flex-col"
            >
              {/* Crisp Onboarding Background (xinshou4) with soft light overlay */}
              <div className="absolute inset-0 z-0 select-none">
                <img src="/assets/xinshou4.png" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-stone-900/10 backdrop-blur-[1px]" />
              </div>

              {/* Chat area */}
              <div
                className={`relative z-10 w-full h-full flex flex-col px-4 pt-14 overflow-hidden ${
                  preOnboardingDialogueStep === 2 ? "pb-[280px]" : "pb-28"
                }`}
                ref={chatEndRef}
                onClick={skipPreOnboardingDialogue}
              >
                {/* Message 1 (Mia) */}
                <ChatMessage
                  sender="mia"
                  name="mia"
                  avatarBg="/assets/qitatouxiangdi.png"
                  avatarImg={MIA_AVATAR_IMAGE}
                  align="left"
                >
                  <TypewriterText
                    text="Hi, welcome to LingoVille! I'm Mia — your learning buddy."
                    onComplete={() => {
                      if (preOnboardingDialogueStep === 0) {
                        setPreOnboardingTypedStep(0);
                      }
                    }}
                  />
                </ChatMessage>

                {/* Message 2 (Mia) */}
                {preOnboardingDialogueStep >= 1 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage
                      sender="mia"
                      name="mia"
                      avatarBg="/assets/qitatouxiangdi.png"
                      avatarImg={MIA_AVATAR_IMAGE}
                      align="left"
                    >
                      {preOnboardingDialogueStep === 1 ? (
                        <TypewriterText
                          text="Before we get started, let's get to know each other. What's your name?"
                          onComplete={() => {
                            if (preOnboardingDialogueStep === 1) {
                              setPreOnboardingTypedStep(1);
                            }
                          }}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">Before we get started, let's get to know each other. What's your name?</span>
                      )}
                    </ChatMessage>
                  </motion.div>
                )}

                {/* Message 3 (Player typing or completed) */}
                {preOnboardingDialogueStep === 2 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage
                      sender="me"
                      name="me"
                      avatarBg="/assets/zhujuetouxiangdi.png"
                      avatarImg="/assets/zhujue1.png"
                      align="right"
                    >
                      <span className="font-extrabold text-stone-800 text-sm flex items-center gap-1.5 leading-none">
                        <span>I'm</span>
                        <span className="inline-flex gap-1 items-end relative top-0.5">
                          {Array.from({ length: 4 }).map((_, idx) => (
                            <span
                              key={idx}
                              className={`w-4 border-b-2 text-center pb-0 text-base font-black uppercase ${
                                preOnboardingName[idx] ? "border-[#2563EB] text-[#2563EB]" : "border-stone-400 text-stone-300"
                              }`}
                            >
                              {preOnboardingName[idx] || "\u00A0"}
                            </span>
                          ))}
                        </span>
                      </span>
                    </ChatMessage>
                  </motion.div>
                )}

                {preOnboardingDialogueStep >= 3 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage
                      sender="me"
                      name="me"
                      avatarBg="/assets/zhujuetouxiangdi.png"
                      avatarImg="/assets/zhujue1.png"
                      align="right"
                    >
                      <span className="whitespace-pre-wrap font-black text-stone-800">I'm {preOnboardingName}</span>
                    </ChatMessage>
                  </motion.div>
                )}

                {/* Message 4 (Mia: Perfect, [User]!) */}
                {preOnboardingDialogueStep >= 3 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage
                      sender="mia"
                      name="mia"
                      avatarBg="/assets/qitatouxiangdi.png"
                      avatarImg={MIA_AVATAR_IMAGE}
                      align="left"
                    >
                      {preOnboardingDialogueStep === 3 ? (
                        <TypewriterText
                          text={`Perfect, ${preOnboardingName}!\nI’ve got your info here.`}
                          onComplete={() => {
                            if (preOnboardingDialogueStep === 3) {
                              setPreOnboardingTypedStep(3);
                            }
                          }}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">{`Perfect, ${preOnboardingName}!\nI’ve got your info here.`}</span>
                      )}
                    </ChatMessage>
                  </motion.div>
                )}

                {/* Introduction Card (xinshou41) displayed right under Msg 4 */}
                {preOnboardingDialogueStep >= 4 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="flex justify-start mb-5 pl-14 pr-3 z-10"
                  >
                    <div className="w-full max-w-[305px] bg-white/95 p-2.5 rounded-[24px] border-3 border-orange-400 shadow-xl">
                      <img src="/assets/xinshou41.png" className="w-full h-auto rounded-xl object-contain" referrerPolicy="no-referrer" />
                    </div>
                  </motion.div>
                )}

                {/* Message 5 (Mia: Everything's set!) */}
                {preOnboardingDialogueStep >= 4 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <ChatMessage
                      sender="mia"
                      name="mia"
                      avatarBg="/assets/qitatouxiangdi.png"
                      avatarImg={MIA_AVATAR_IMAGE}
                      align="left"
                    >
                      {preOnboardingDialogueStep === 4 ? (
                        <TypewriterText
                          text="Everything's set! Your town will grow as you learn — let's get started!"
                          onComplete={() => {
                            if (preOnboardingDialogueStep === 4) {
                              setPreOnboardingTypedStep(4);
                            }
                          }}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">Everything's set! Your town will grow as you learn — let's get started!</span>
                      )}
                    </ChatMessage>
                  </motion.div>
                )}
                <div className="h-20 shrink-0" />
              </div>

              {/* Onboarding Name Input Pad at Step 2 */}
              <AnimatePresence>
                {preOnboardingDialogueStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 25 }}
                    className="absolute bottom-4 w-full px-4 max-w-sm mx-auto pointer-events-auto z-50 left-1/2 -translate-x-1/2"
                  >
                    <div className="flex flex-col gap-2 bg-white/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border-2 border-stone-200">
                      {/* Keyboard Letters Row 1 */}
                      <div className="flex justify-center gap-1">
                        {"ABCDEFGHIJKLM".split("").map((letter, idx) => (
                          <button
                            key={`${letter}-${idx}`}
                            onClick={() => {
                              if (preOnboardingName.length < 4) {
                                hapticFeedback.light?.();
                                setNameInputError(null);
                                setPreOnboardingName((prev) => prev + letter);
                              }
                            }}
                            className="flex-[1_1_0] min-w-0 aspect-[2/3] bg-stone-100 text-stone-800 font-extrabold text-[13px] rounded-md border-b-2 border-stone-300 shadow-xs active:border-b-0 active:translate-y-0.5 active:shadow-none flex items-center justify-center p-0 hover:bg-stone-200 uppercase"
                          >
                            {letter}
                          </button>
                        ))}
                      </div>

                      {/* Keyboard Letters Row 2 (with DEL) */}
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => {
                            hapticFeedback.light?.();
                            setNameInputError(null);
                            setPreOnboardingName((prev) => prev.slice(0, -1));
                          }}
                          className="flex-[1.5_1.5_0] min-w-0 bg-stone-400 text-white font-extrabold text-[11px] rounded-md border-b-2 border-stone-500 shadow-xs active:border-b-0 active:translate-y-0.5 active:shadow-none flex items-center justify-center hover:bg-stone-500"
                        >
                          DEL
                        </button>
                        {"NOPQRSTUVWXYZ".split("").map((letter, idx) => (
                          <button
                            key={`${letter}-${idx}`}
                            onClick={() => {
                              if (preOnboardingName.length < 4) {
                                hapticFeedback.light?.();
                                setNameInputError(null);
                                setPreOnboardingName((prev) => prev + letter);
                              }
                            }}
                            className="flex-[1_1_0] min-w-0 aspect-[2/3] bg-stone-100 text-stone-800 font-extrabold text-[13px] rounded-md border-b-2 border-stone-300 shadow-xs active:border-b-0 active:translate-y-0.5 active:shadow-none flex items-center justify-center p-0 hover:bg-stone-200 uppercase"
                          >
                            {letter}
                          </button>
                        ))}
                      </div>

                      {/* Confirm Name Action Button */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        disabled={preOnboardingName.length < 4 || nameRegistrationStatus !== "idle"}
                        onClick={confirmNewPlayerId}
                        className={`w-full py-4 mt-1.5 rounded-2xl shadow-md border-b-4 transition-all uppercase tracking-widest font-black text-lg text-white ${
                          preOnboardingName.length < 4 || nameRegistrationStatus !== "idle"
                            ? "bg-stone-400 border-stone-500 cursor-not-allowed opacity-50"
                            : "bg-[#1CB0F6] hover:bg-[#1899D6] border-[#127ea6] active:border-b-0 active:translate-y-1"
                        }`}
                      >
                        {nameRegistrationStatus !== "idle"
                          ? "拉取数据中"
                          : "Confirm Name"}
                      </motion.button>
                      {nameInputError && (
                        <p className="text-center text-rose-500 text-[12px] font-black leading-snug px-2">
                          {nameInputError}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {existingPlayerIdPrompt && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-[90] bg-black/65 backdrop-blur-sm flex items-center justify-center px-6 pointer-events-auto"
                  >
                    <motion.div
                      initial={{ scale: 0.92, y: 18 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.92, y: 18 }}
                      className="w-full max-w-sm bg-white rounded-[28px] p-6 shadow-2xl border-4 border-sky-100 text-center"
                    >
                      <div className="mx-auto w-16 h-16 rounded-2xl bg-sky-100 flex items-center justify-center mb-4">
                        <User className="w-8 h-8 text-sky-500" />
                      </div>
                      <h2 className="text-stone-800 font-black text-xl mb-2">
                        ID 已注册
                      </h2>
                      <p className="text-stone-500 font-bold text-sm leading-relaxed mb-5">
                        {existingPlayerIdPrompt} 已经有学习记录。要读取这个 ID 的课程进度和错题记录吗？
                      </p>
                      <div className="flex flex-col gap-3">
                        <button
                          disabled={nameRegistrationStatus === "loading"}
                          onClick={loadExistingPlayerId}
                          className="w-full bg-[#58CC02] text-white py-3.5 rounded-2xl font-black shadow-[0_4px_0_#3b8a02] active:translate-y-1 active:shadow-none disabled:opacity-60"
                        >
                          {nameRegistrationStatus === "loading" ? "读取中..." : "读取此 ID"}
                        </button>
                        <button
                          disabled={nameRegistrationStatus === "loading"}
                          onClick={rejectExistingPlayerId}
                          className="w-full bg-stone-100 text-stone-700 py-3.5 rounded-2xl font-black shadow-[0_4px_0_#d6d3d1] active:translate-y-1 active:shadow-none disabled:opacity-60"
                        >
                          重新起名
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Step 5: Continue to Town */}
              <AnimatePresence>
                {preOnboardingDialogueStep === 5 && (
                  <motion.div
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 25 }}
                    className="absolute bottom-8 w-full px-8 max-w-sm mx-auto pointer-events-auto z-50 left-1/2 -translate-x-1/2"
                  >
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
	                      onClick={() => {
	                        setHasCompletedOpeningFlow(true);
	                        persistOpeningFlowComplete();
	                        setShouldShowHomeIntroThisSession(true);
	                        changeOnboardingStepNow(12);
	                      }}
                      className="w-full bg-[#58CC02] hover:bg-[#46a302] text-white font-black text-2xl py-5 rounded-[20px] shadow-xl border-b-4 border-[#3b8a02] active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest pointer-events-auto"
                    >
                      Continue
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 虚拟摇杆 (Virtual Joystick) */}
        <AnimatePresence>
          {joystickState && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[999] pointer-events-none rounded-full border border-white/20 bg-black/40 backdrop-blur-sm flex items-center justify-center shadow-lg"
              style={{
                width: 120,
                height: 120,
                left: joystickState.origin.x - 60,
                top: joystickState.origin.y - 60,
              }}
            >
              {/* Inner knob */}
              <motion.div
                className="w-12 h-12 rounded-full border border-white/30 bg-white/70 backdrop-blur-md shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
                style={{
                  x: joystickState.current.x - joystickState.origin.x,
                  y: joystickState.current.y - joystickState.origin.y,
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {aiPracticeCategory && (
            <AiSpeakingPractice
              category={aiPracticeCategory}
              onBack={() => setAiPracticeCategory(null)}
            />
          )}
        </AnimatePresence>

        {/* --- Social Media Modal --- */}
        <AnimatePresence>
          {showSocial && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 z-[300] bg-[#F5F7FB] flex flex-col pointer-events-auto overflow-hidden"
            >
              <div className="relative h-24 pt-10 sm:h-20 sm:pt-6 flex items-center justify-between px-4 shrink-0">
	                <button
	                  onClick={() => {
	                    setShowSocial(false);
	                  }}
	                  className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white text-stone-600 shadow-sm border border-stone-100"
	                >
	                  <ChevronLeft className="w-6 h-6" strokeWidth={2.8} />
	                </button>
                <div className="text-center">
                  <h2 className="text-[22px] font-black text-stone-900 leading-none">
                    学习朋友圈
                  </h2>
                  <p className="text-[11px] font-black text-sky-500 mt-1">
                    本地练习动态
                  </p>
                </div>
                <div className="w-10 h-10" />
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-24">
                <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#1CB0F6] via-[#6C63FF] to-[#8B5CF6] p-5 text-white shadow-[0_18px_40px_rgba(37,99,235,0.28)]">
                  <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/14" />
                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[12px] font-black text-white/75 uppercase tracking-wide">
                        Current Review
                      </p>
                      <h3 className="text-[26px] font-black leading-tight mt-1">
                        用刚学的词发一条动态
                      </h3>
                      <p className="text-[13px] font-bold text-white/76 mt-2 leading-relaxed">
                        不用手写长文，点选主线词卡，系统会自动拼成一句可发布的英文动态。
                      </p>
                    </div>
                    <div className="w-16 h-16 rounded-[22px] bg-white/18 border border-white/20 flex items-center justify-center shrink-0">
                      <Newspaper className="w-8 h-8" strokeWidth={2.6} />
                    </div>
                  </div>
                  <div className="relative z-10 mt-4 flex flex-wrap gap-2">
                    {recentSocialTerms.slice(0, 4).map((term) => (
                      <span
                        key={`recent-${term.id}`}
                        className="px-3 py-1.5 rounded-full bg-white/18 border border-white/20 text-[12px] font-black"
                      >
                        {term.text}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-stone-900 font-black text-[18px]">
                      动态广场
                    </h3>
                    <p className="text-stone-400 font-bold text-[12px]">
                      复习过的表达会留在这里
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-white text-sky-600 text-[12px] font-black border border-sky-100">
                    {socialPosts.length} posts
                  </span>
                </div>

                <div className="mt-3 space-y-4">
                  {socialPosts.map((post) => (
                    <motion.div
                      layout
                      key={post.id}
                      className="bg-white rounded-[24px] p-4 shadow-[0_12px_28px_rgba(15,23,42,0.07)] border border-stone-100"
                    >
                      <div className="flex gap-3">
                        <div className="w-12 h-12 rounded-[18px] border border-stone-100 overflow-hidden shrink-0 bg-sky-50">
                          <img
                            src={post.avatar}
                            className="w-full h-full object-cover origin-bottom"
                            style={{ objectPosition: "bottom" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-black text-stone-900 truncate">
                              {post.author}
                            </h3>
                            <span className="text-[11px] text-stone-400 font-bold shrink-0">
                              {post.timestamp}
                            </span>
                          </div>
                          <p className="text-stone-700 mt-2 text-[15px] font-bold leading-relaxed">
                            {post.content}
                          </p>

                          {post.terms && post.terms.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {post.terms.map((term) => (
                                <span
                                  key={`${post.id}-${term}`}
                                  className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-600 text-[11px] font-black border border-sky-100"
                                >
                                  {term}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 flex items-center justify-between text-xs text-stone-500 font-bold">
                            <div className="flex gap-4">
                              <button
                                className="flex items-center gap-1.5 active:scale-95"
                                onClick={() => {
                                  setSocialPosts((posts) =>
                                    posts.map((p) => {
                                      if (p.id === post.id) {
                                        return {
                                          ...p,
                                          isLiked: !p.isLiked,
                                          likes: p.isLiked
                                            ? p.likes - 1
                                            : p.likes + 1,
                                        };
                                      }
                                      return p;
                                    }),
                                  );
                                }}
                              >
                                <Heart
                                  className={`w-4 h-4 ${post.isLiked ? "fill-red-500 text-red-500" : "text-stone-400"}`}
                                />
                                <span>{post.likes}</span>
                              </button>
                              <div className="flex items-center gap-1.5 text-stone-400">
                                <MessageCircle className="w-4 h-4" />
                                <span>{post.comments.length}</span>
                              </div>
                            </div>
                            {post.author === (preOnboardingName || "You") && (
                              <span className="text-emerald-600 font-black">
                                reviewed
                              </span>
                            )}
                          </div>

                          {post.comments.length > 0 && (
                            <div className="mt-3 bg-stone-50 rounded-[16px] p-3 space-y-1.5">
                              {post.comments.map((comment, idx) => (
                                <div key={idx} className="text-[12px] leading-relaxed">
                                  <span className="font-black text-stone-700">
                                    {comment.author}:{" "}
                                  </span>
                                  <span className="text-stone-600 font-bold">
                                    {comment.content}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-[#F5F7FB] via-[#F5F7FB] to-transparent">
                <motion.button
                  whileTap={{ scale: 0.97 }}
	                  onClick={() => {
	                    resetSocialSelection();
	                    setShowSocialCreate(true);
	                  }}
                  className="relative w-full h-16 rounded-[22px] bg-[#58CC02] text-white flex items-center justify-center gap-3 font-black text-[18px] shadow-[0_5px_0_#3f9300] active:translate-y-[5px] active:shadow-none"
                >
	                  <Plus className="w-6 h-6" strokeWidth={3} />
	                  发一条学习动态
	                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSocialCreate && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 z-[350] bg-[#F6F8FC] flex flex-col pointer-events-auto overflow-hidden"
            >
              <div className="h-24 pt-10 sm:h-20 sm:pt-6 flex items-center justify-between px-4 shrink-0">
                <button
                  className="w-10 h-10 rounded-full bg-white text-stone-500 shadow-sm border border-stone-100 flex items-center justify-center"
                  onClick={() => setShowSocialCreate(false)}
                >
                  <ChevronLeft className="w-6 h-6" strokeWidth={2.8} />
                </button>
                <div className="text-center">
                  <h2 className="text-[20px] font-black text-stone-900 leading-none">
                    选词发朋友圈
                  </h2>
                  <p className="text-[11px] font-black text-sky-500 mt-1">
                    Lesson {socialLessonLimit} review
                  </p>
                </div>
                <div className="w-10 h-10" />
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-28">
                <div className="rounded-[28px] bg-white border border-stone-100 shadow-[0_16px_36px_rgba(15,23,42,0.08)] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-[16px] overflow-hidden bg-sky-50 border border-sky-100 shrink-0">
                      <img
                        src={MIA_AVATAR_IMAGE}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-stone-900 truncate">
                        {preOnboardingName || "You"}
                      </p>
                      <p className="text-[12px] font-bold text-stone-400">
                        Just now · local review
                      </p>
                    </div>
                  </div>
                  <div className="min-h-[118px] rounded-[22px] bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-100 p-4">
                    <p className="text-[17px] font-black text-stone-800 leading-relaxed">
                      {generatedSocialPost}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedSocialTerms.length === 0 ? (
                      <span className="px-3 py-1.5 rounded-full bg-stone-100 text-stone-400 text-[12px] font-black">
                        请选择 1-6 个表达
                      </span>
                    ) : (
                      selectedSocialTerms.map((term) => (
                        <span
                          key={`preview-${term.id}`}
                          className="px-3 py-1.5 rounded-full bg-white text-sky-600 border border-sky-100 text-[12px] font-black shadow-sm"
                        >
                          {term.text}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <h3 className="text-stone-900 font-black text-[18px]">
                      刚学过的表达
                    </h3>
                    <p className="text-stone-400 font-bold text-[12px]">
                      点词卡，自动生成动态
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-white text-stone-500 text-[12px] font-black border border-stone-100">
                    {selectedSocialTerms.length}/6
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5">
                  {availableSocialTerms.map((term) => {
                    const selected = selectedSocialTermIds.includes(term.id);
                    const isRecent = term.lessonId === socialLessonLimit;

                    return (
                      <motion.button
                        key={term.id}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleSocialTerm(term.id)}
                        className={`w-full rounded-[20px] border-2 p-3 text-left flex items-center gap-3 transition-colors ${
                          selected
                            ? "bg-sky-50 border-sky-400 shadow-[0_10px_24px_rgba(14,165,233,0.15)]"
                            : "bg-white border-stone-100"
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-[14px] flex items-center justify-center shrink-0 ${
                            selected
                              ? "bg-sky-500 text-white"
                              : "bg-stone-100 text-stone-400"
                          }`}
                        >
                          {selected ? (
                            <CheckCircle2 className="w-5 h-5" strokeWidth={3} />
                          ) : (
                            <Book className="w-5 h-5" strokeWidth={2.8} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-stone-900 text-[16px] truncate">
                              {term.text}
                            </span>
                            {isRecent && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-black shrink-0">
                                recent
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] font-bold text-stone-400 mt-0.5 truncate">
                            {term.translation} · Lesson {term.lessonId}
                          </p>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 ${
                            selected
                              ? "bg-white text-sky-600"
                              : "bg-stone-100 text-stone-400"
                          }`}
                        >
                          {term.tag}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>

	              </div>

              <div className="absolute left-0 right-0 bottom-0 p-4 bg-gradient-to-t from-[#F6F8FC] via-[#F6F8FC] to-transparent">
                <motion.button
                  whileTap={{ scale: selectedSocialTerms.length > 0 ? 0.97 : 1 }}
                  disabled={selectedSocialTerms.length === 0}
                  className={`w-full h-16 rounded-[22px] flex items-center justify-center gap-3 font-black text-[18px] transition-all ${
                    selectedSocialTerms.length > 0
                      ? "bg-[#1CB0F6] text-white shadow-[0_5px_0_#1688C8] active:translate-y-[5px] active:shadow-none"
                      : "bg-stone-200 text-stone-400"
                  }`}
                  onClick={() => {
                    if (selectedSocialTerms.length === 0) return;

                    const words = selectedSocialTerms.map((term) => term.text);
                    const reward = {
                      fans: 24 + selectedSocialTerms.length * 12,
                      customers: 3 + selectedSocialTerms.length,
                      words,
                    };

                    setSocialPosts((posts) => [
                      {
                        id: Date.now(),
                        author: preOnboardingName || "You",
                        avatar: MIA_AVATAR_IMAGE,
                        content: generatedSocialPost,
                        likes: 8 + selectedSocialTerms.length * 2,
                        isLiked: false,
                        comments: buildSocialComments(selectedSocialTerms),
                        timestamp: "Just now",
                        terms: words,
                      },
                      ...posts,
                    ]);
	                    setLastSocialReviewWords(words);
	                    setShowSocialCreate(false);

	                    setTimeout(() => {
	                      setSocialReward(reward);
	                    }, 350);
	                  }}
                >
                  发布学习动态
                  <ArrowRight className="w-5 h-5" strokeWidth={3} />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {socialReward && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[400] bg-slate-950/78 backdrop-blur-md flex items-center justify-center p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.84, y: 24 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.84, y: 24 }}
                transition={{ type: "spring", stiffness: 320, damping: 24 }}
                className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl relative overflow-hidden flex flex-col items-center text-center"
              >
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-emerald-100 via-sky-100 to-violet-100" />
                <div className="relative z-10 w-20 h-20 bg-white rounded-[28px] flex items-center justify-center mb-4 shadow-xl border border-emerald-100">
                  <Heart className="w-10 h-10 text-emerald-500 fill-emerald-500" />
                </div>
                <p className="relative z-10 text-emerald-600 font-black text-[13px] mb-1">
                  发布成功
                </p>
                <h2 className="relative z-10 text-[28px] font-black text-stone-900 mb-2">
                  复习动态已发出！
                </h2>
                <p className="relative z-10 text-stone-500 font-bold text-[14px] leading-relaxed mb-5">
                  你刚复习了 {socialReward.words.length} 个主线表达，已经记录到朋友圈里。
                </p>

                <div className="relative z-10 w-full rounded-[22px] bg-stone-50 p-3 flex flex-wrap justify-center gap-2 mb-5">
                  {(socialReward.words.length > 0
                    ? socialReward.words
                    : lastSocialReviewWords
                  ).map((word) => (
                    <span
                      key={`reward-${word}`}
                      className="px-3 py-2 rounded-full bg-white text-sky-600 border border-sky-100 text-[13px] font-black shadow-sm"
                    >
                      {word}
                    </span>
                  ))}
                </div>

                <div className="relative z-10 bg-white w-full rounded-[22px] p-4 flex gap-4 mb-6 border border-stone-100 shadow-sm">
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-[24px] font-black text-pink-500">
                      +{socialReward.fans}
                    </span>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-1">
                      Likes
                    </span>
                  </div>
                  <div className="w-px bg-stone-200" />
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-[24px] font-black text-amber-500">
                      +{socialReward.customers}
                    </span>
                    <span className="text-xs font-bold text-stone-400 uppercase tracking-widest mt-1">
                      Comments
                    </span>
                  </div>
                </div>

                <button
                  className="relative z-10 w-full bg-[#58CC02] text-white font-black py-4 rounded-[18px] shadow-[0_5px_0_#3f9300] active:translate-y-[5px] active:shadow-none"
	                  onClick={() => {
	                    setSocialReward(null);
	                  }}
                >
                  太棒了
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* --- End Social Media Modal --- */}

        {/* --- Reset Confirmation Modal --- */}
        <AnimatePresence>
          {showResetConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[500] bg-black/75 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl border-4 border-rose-100 flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mb-4 text-rose-500 animate-pulse animate-duration-1000">
                  <RotateCcw className="w-8 h-8" />
                </div>
                <h2 className="text-xl font-black text-stone-800 mb-2">
                  确认重置进度？
                </h2>
                <p className="text-xs font-bold text-rose-500 mb-4 font-mono">
                  RESET GAME PROGRESS
                </p>
                <p className="text-stone-600 font-bold text-xs leading-relaxed mb-6">
                  这会彻底清空你的游戏游玩历史、解锁的建筑/场景、购买的装饰和所有学习进度。此操作不可逆！
                </p>

                <div className="flex gap-3 w-full">
                  <button
                    className="flex-1 bg-stone-100 text-stone-700 font-black py-3 px-4 rounded-xl shadow-[0_4px_0_#d6d3d1] active:translate-y-1 active:shadow-none hover:bg-stone-200 transition-colors text-xs"
                    onClick={() => {
                      hapticFeedback.light?.();
                      setShowResetConfirm(false);
                    }}
                  >
                    取消 / Cancel
                  </button>
                  <button
                    className="flex-1 bg-rose-500 text-white font-black py-3 px-4 rounded-xl shadow-[0_4px_0_#be123c] active:translate-y-1 active:shadow-none hover:bg-rose-600 transition-colors text-xs"
                    onClick={() => {
                      hapticFeedback.success?.();
                      clearLocalPlayerSessionStorage();
                      window.location.reload();
                    }}
                  >
                    确认 / Reset
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {deletePlayerIdPrompt && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[510] bg-black/65 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-auto"
              onClick={() => {
                if (!deletingPlayerId) setDeletePlayerIdPrompt(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.92, y: 18 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.92, y: 18 }}
                className="w-full max-w-sm rounded-[30px] bg-white p-6 text-center shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-rose-100 text-rose-500">
                  <Trash2 className="h-8 w-8" strokeWidth={2.8} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-rose-400">
                  Delete test ID
                </p>
                <h2 className="mt-1 text-[22px] font-black text-stone-900">
                  删除 ID {deletePlayerIdPrompt}？
                </h2>
                <p className="mt-3 text-[13px] font-bold leading-relaxed text-stone-500">
                  会删除服务器上的课程进度、错题记录和 AI 自定义内容。
                  {appUserId === deletePlayerIdPrompt
                    ? " 这是当前正在使用的 ID，删除后会清除本机登录并重启。"
                    : ""}
                </p>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    disabled={Boolean(deletingPlayerId)}
                    onClick={() => setDeletePlayerIdPrompt(null)}
                    className="h-12 flex-1 rounded-2xl bg-stone-100 text-[14px] font-black text-stone-600 shadow-[0_4px_0_#d6d3d1] active:translate-y-[4px] active:shadow-none disabled:opacity-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(deletingPlayerId)}
                    onClick={() => void deleteTestPlayerId(deletePlayerIdPrompt)}
                    className="h-12 flex-1 rounded-2xl bg-rose-500 text-[14px] font-black text-white shadow-[0_4px_0_#be123c] active:translate-y-[4px] active:shadow-none disabled:opacity-60"
                  >
                    {deletingPlayerId === deletePlayerIdPrompt
                      ? "删除中..."
                      : "确认删除"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(townDecorRewardReveal || townDecorUnlockAnimation) && (
            <motion.div
              key="town-decor-unlock-input-guard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[107900] pointer-events-auto bg-transparent"
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {townDecorRewardReveal && (
            <motion.div
              key={`decor-reveal-${townDecorRewardReveal.key}`}
              className="absolute inset-0 z-[108000] pointer-events-none overflow-hidden"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{
                  opacity:
                    townDecorRewardReveal.phase === "showcase"
                      ? [0, 0.72, 0.52]
                      : 0,
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55 }}
                className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
              />
              {townDecorRewardReveal.phase === "showcase" && (
                <>
                  <motion.div
                    className="absolute left-1/2 top-[42%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/30 blur-2xl"
                    animate={{ scale: [0.8, 1.18, 0.95], opacity: [0.4, 0.9, 0.55] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-0 right-0 top-[62%] text-center text-[22px] font-black text-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.45)]"
                  >
                    {(townDecorRewardReveal.items?.length || 1) > 1
                      ? "New Decorations!"
                      : "New Decoration!"}
                  </motion.p>
                </>
              )}
              {Array.from({ length: 18 }).map((_, sparkleIndex) => (
                <motion.span
                  key={`decor-reveal-sparkle-${sparkleIndex}`}
                  className="absolute text-yellow-200 drop-shadow-[0_0_12px_rgba(250,204,21,0.95)]"
                  style={{
                    left: `${18 + ((sparkleIndex * 19) % 64)}%`,
                    top: `${18 + ((sparkleIndex * 29) % 55)}%`,
                  }}
                  initial={{ opacity: 0, scale: 0, rotate: -40 }}
                  animate={{
                    opacity: townDecorRewardReveal.phase === "showcase" ? [0, 1, 0] : 0,
                    scale: [0, 1.35, 0.2],
                    rotate: [-40, 18, 70],
                  }}
                  transition={{
                    duration: 1.1,
                    delay: sparkleIndex * 0.045,
                    repeat: townDecorRewardReveal.phase === "showcase" ? Infinity : 0,
                    repeatDelay: 0.9,
                  }}
                >
                  ✦
                </motion.span>
              ))}
              <>
                {(
                  townDecorRewardReveal.items || [
                    {
                      decorationId: townDecorRewardReveal.decorationId,
                      src: townDecorRewardReveal.src,
                      targetX: townDecorRewardReveal.targetX,
                      targetY: townDecorRewardReveal.targetY,
                    },
                  ]
                ).map((item, itemIndex, revealItems) => {
                  const fanOffset =
                    (itemIndex - (revealItems.length - 1) / 2) *
                    Math.min(48, 150 / Math.max(1, revealItems.length));
                  const showcaseScale = Math.max(
                    0.72,
                    Math.min(1, 1.06 - (revealItems.length - 1) * 0.045),
                  );
                  return (
                    <motion.img
                      key={`decor-reveal-img-${item.decorationId}`}
                      src={item.src}
                      alt=""
                      className="absolute h-auto w-[172px] object-contain drop-shadow-[0_18px_30px_rgba(15,23,42,0.38)]"
                      initial={{
                        x: containerWidth / 2 - 86 + fanOffset,
                        y: containerHeight * 0.42 - 86,
                        scale: 0.35,
                        rotate: -10 + fanOffset * 0.08,
                        opacity: 0,
                      }}
                      animate={
                        townDecorRewardReveal.phase === "showcase"
                          ? {
                              x: containerWidth / 2 - 86 + fanOffset,
                              y:
                                containerHeight * 0.42 -
                                86 -
                                Math.abs(fanOffset) * 0.08,
                              scale: [0.35, showcaseScale * 1.18, showcaseScale],
                              rotate: [
                                -10 + fanOffset * 0.08,
                                5 + fanOffset * 0.04,
                                fanOffset * 0.05,
                              ],
                              opacity: 1,
                            }
                          : {
                              x: item.targetX - 86,
                              y: item.targetY - 86,
                              scale: 0.42,
                              rotate: 0,
                              opacity: [1, 1, 0.12],
                            }
                      }
                      exit={{ opacity: 0, scale: 0.2 }}
                      transition={{
                        duration:
                          townDecorRewardReveal.phase === "showcase"
                            ? 0.82
                            : 0.9,
                        ease: "easeInOut",
                      }}
                      referrerPolicy="no-referrer"
                    />
                  );
                })}
              </>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {frameworkGuidePanoramaIntro && (
            <motion.div
              key="framework-guide-panorama-intro"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[108450] pointer-events-none bg-gradient-to-t from-slate-950/10 via-transparent to-transparent"
              aria-hidden="true"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {miaDecorGuideStep > 0 && (
            <motion.div
              key={`mia-decor-guide-${miaDecorGuideStep}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[108500] pointer-events-auto bg-gradient-to-t from-slate-950/28 via-transparent to-transparent"
              onClick={continueMiaDecorGuide}
            >
              <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 18, opacity: 0, scale: 0.96 }}
                className="absolute left-5 right-5 bottom-[74px] z-30 isolate rounded-[28px] bg-white/96 border border-white shadow-[0_18px_44px_rgba(15,23,42,0.26)] px-5 py-5"
              >
                <motion.img
                  src={MIA_PORTRAIT_IMAGE}
                  alt="Mia"
                  initial={{ y: 26, opacity: 0, scale: 0.92 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 18, opacity: 0 }}
                  className="absolute bottom-[calc(100%-42px)] left-0 z-0 h-[226px] max-h-[32vh] w-auto object-contain drop-shadow-[0_18px_28px_rgba(15,23,42,0.35)] pointer-events-none"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 z-[5] rounded-[28px] bg-white/96 border border-white pointer-events-none" />
                <div className="absolute -top-3 left-16 z-[6] h-6 w-6 rotate-45 bg-white/96 border-l border-t border-white" />
                <p className="relative z-10 text-[12px] font-black uppercase tracking-[0.18em] text-sky-500">
                  Mia
                </p>
                <PreludeTypewriterText
                  key={`mia-decor-guide-text-${miaDecorGuideStep}`}
                  text={
                    miaDecorGuideStep === 1
                      ? "Look — your apartment has its first decoration\nAlready feeling more like home!"
                      : "Here's how it works\nEvery unit you finish = 1 new decoration\nYour apartment will keep growing as you learn"
                  }
                  className="relative z-10 mt-2 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-stone-900"
                  speed={58}
                />
                <button
                  type="button"
                  className="relative z-10 mt-4 h-[46px] w-full rounded-[17px] bg-[#58CC02] text-[15px] font-black text-white shadow-[0_5px_0_#3f9300] active:translate-y-[4px] active:shadow-none transition-all"
                >
                  {miaDecorGuideStep === 1 ? "Continue" : "Got it"}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPreludeVictory && (
            <UnitCompleteScreen
              unitId={0}
              subtitle="Apartment 4B is ready for its first decoration."
              onContinue={completePreludeVictory}
              layerClassName="z-[110000]"
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {levelCurtain && (
	            <motion.div
	              key={levelCurtain.key}
              className="absolute inset-0 z-[120000] pointer-events-auto overflow-hidden bg-sky-400"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.img
	                src="/assets/zairu.png"
	                alt=""
	                className="h-full w-full object-cover"
	                initial={{ y: "-100%" }}
	                animate={{
	                  y:
	                    levelCurtain.mode === "enter"
	                      ? ["-100%", "0%", "0%", "-100%"]
	                      : ["-100%", "0%", "0%", "100%"],
	                }}
                transition={{
                  duration: 1.16,
                  times: [0, 0.42, 0.64, 1],
                  ease: "easeInOut",
                }}
                referrerPolicy="no-referrer"
              />
	            </motion.div>
	          )}
	        </AnimatePresence>

	        <AnimatePresence>
	          {frameworkGuideData && (
	            <motion.div
	              key={`framework-guide-${frameworkGuideData.key}`}
	              initial={{ opacity: 0 }}
	              animate={{ opacity: 1 }}
	              exit={{ opacity: 0 }}
	              className={`absolute inset-0 z-[116000] pointer-events-auto overflow-hidden ${
	                frameworkGuideStep === 1 ? "bg-black/48" : ""
	              }`}
	              onClick={continueFrameworkGuide}
	            >
	              {frameworkGuideStep > 1 && (
	                <motion.div
	                  key={`framework-highlight-${frameworkGuideData.key}`}
	                  initial={{ scale: 0.72, opacity: 0 }}
	                  animate={{ scale: [0.94, 1.08, 1], opacity: 1 }}
	                  exit={{ scale: 0.82, opacity: 0 }}
	                  transition={{ duration: 0.45, ease: "easeOut" }}
	                  className={`absolute z-10 flex items-center justify-center ${frameworkGuideData.targetClass}`}
	                  style={{
	                    boxShadow: "0 0 0 9999px rgba(2,6,23,0.64)",
	                    borderRadius: "22px",
	                  }}
	                >
	                  <div
	                    className={`absolute inset-0 flex items-center justify-center ${frameworkGuideData.highlightClass}`}
	                  >
	                    {frameworkGuideData.icon}
	                  </div>
	                  <motion.div
	                    className="absolute -inset-2 rounded-[26px] border-[3px] border-[#58CC02]"
	                    animate={{
	                      scale: [1, 1.08, 1],
	                      opacity: [0.9, 0.45, 0.9],
	                    }}
	                    transition={{ duration: 1.2, repeat: Infinity }}
	                  />
	                </motion.div>
	              )}

              <motion.div
                initial={{ y: 24, opacity: 0, scale: 0.96 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 18, opacity: 0, scale: 0.96 }}
	                className={`absolute z-30 isolate rounded-[28px] bg-white/96 border border-white shadow-[0_18px_44px_rgba(15,23,42,0.28)] px-5 py-5 ${
	                  frameworkGuideStep === 1
	                    ? "left-5 right-5 bottom-[128px]"
	                    : frameworkGuideStep === 2
                      ? "left-5 right-5 bottom-[226px]"
                      : "left-5 right-[96px] bottom-[86px]"
                }`}
              >
                <motion.img
                  src={MIA_PORTRAIT_IMAGE}
                  alt="Mia"
                  initial={{ y: 26, opacity: 0, scale: 0.92 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  exit={{ y: 18, opacity: 0 }}
                  className={`absolute bottom-[calc(100%-42px)] z-0 h-[218px] max-h-[31vh] w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.38)] pointer-events-none ${
                    frameworkGuideStep === 2 ? "left-0" : "right-0"
                  }`}
                  referrerPolicy="no-referrer"
                />
                <div
                  className="absolute inset-0 z-[5] rounded-[28px] bg-white/96 border border-white pointer-events-none"
                />
                <div
                  className={`absolute -top-3 z-[6] h-6 w-6 rotate-45 bg-white/96 border-l border-t border-white ${
                    frameworkGuideStep === 2 ? "left-16" : "right-16"
                  }`}
                />
                <p className="relative z-10 text-[12px] font-black uppercase tracking-[0.18em] text-sky-500">
                  Mia
                </p>
	                <PreludeTypewriterText
	                  key={`framework-guide-text-${frameworkGuideStep}`}
	                  text={frameworkGuideData.text}
	                  className="relative z-10 mt-2 whitespace-pre-wrap text-[15px] font-medium leading-relaxed text-stone-900"
	                  speed={54}
	                />
	                <div className="relative z-10 mt-4 flex items-center justify-between gap-3">
	                  <span className="text-[11px] font-black uppercase tracking-[0.16em] text-stone-400">
	                    {frameworkGuideStep}/4
	                  </span>
	                  <button
	                    type="button"
	                    className="h-[42px] min-w-[112px] rounded-[16px] bg-[#58CC02] px-5 text-[14px] font-black text-white shadow-[0_5px_0_#3f9300] active:translate-y-[4px] active:shadow-none transition-all"
	                  >
	                    {frameworkGuideStep >= 4 ? "Got it" : "Continue"}
	                  </button>
	                </div>
	              </motion.div>
	            </motion.div>
	          )}
	        </AnimatePresence>

	        {/* Bottom Navigation */}
	        <AnimatePresence>
          {onboardingStep >= 12 &&
            !aiPracticeCategory &&
            !showReview &&
            !isPreludeActive &&
            !frameworkGuidePanoramaIntro &&
            !(activeTab === "town" && scene === "interior") && (
              <motion.div
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="absolute bottom-0 left-0 right-0 h-16 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-[200] flex items-center justify-around px-2 pb-3 rounded-b-[48px] overflow-hidden translate-y-1"
              >
                <button
                  onClick={() => {
                    hapticFeedback.light();
                    setActiveTab("town");
                  }}
                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 relative"
                >
                  <House
                    className={`w-7 h-7 mt-2 ${activeTab === "town" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "town" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    hapticFeedback.light();
                    setActiveTab("ai_custom");
                  }}
                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 relative"
                >
                  <BrainCircuit
                    className={`w-7 h-7 mt-2 ${activeTab === "ai_custom" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "ai_custom" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
	                <button
	                  onClick={() => {
	                    hapticFeedback.light();
	                    showMessage("敬请期待");
	                  }}
	                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 relative"
	                >
                  <BotMessageSquare
                    className={`w-7 h-7 mt-2 ${activeTab === "ai_course" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "ai_course" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
                <button
                  onClick={() => {
                    hapticFeedback.light();
                    setActiveTab("profile");
                  }}
                  className="flex flex-col items-center justify-center w-16 h-full transition-colors active:scale-95 z-10 relative"
                >
                  <CircleUserRound
                    className={`w-7 h-7 mt-2 ${activeTab === "profile" ? "text-[#6C63FF]" : "text-stone-400"}`}
                  />
                  {activeTab === "profile" && (
                    <div className="absolute top-1 w-6 h-1 rounded-full bg-[#6C63FF]" />
                  )}
                </button>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    </div>
  );
}
