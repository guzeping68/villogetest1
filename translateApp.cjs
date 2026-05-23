const fs = require('fs');

const path = './src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

const translations = {
  "太聪明了，没难倒你！": "Too smart, couldn't stump you!",
  "唉，机会用完啦...": "Sigh, you ran out of chances...",
  "不对哦，再试一次！": "Not quite, try again!",
  "你是我请的维修工吗，我的房子太老旧了，快来帮帮我": "Are you the repairman I hired? My house is so old, come help me quickly!",
  "这里曾经很漂亮的，不过现在嘛...": "It used to be beautiful here, but now...",
  "嘿！你刚才的表现太棒了": "Hey! Your performance just now was amazing",
  "你可能还不知道，这里有一座小镇，它一直在等像你这样的人": "You might not know, there's a town here waiting for someone like you",
  "走，跟我去看看吧": "Come on, let's go take a look",
  "通过这节课的学习，你将掌握关于“": "Through this lesson, you will master everyday expressions about \"",
  "”的相关日常表达，在互动中提升语言能力。": "\", and improve your language skills through interaction.",
  "开始学习: ": "Start learning: ",
  "开始学习": "Start Learning",
  "正在分析您的学习需求": "Analyzing your learning needs",
  "正在创建个性化学习计划": "Creating a personalized learning plan",
  "正在定制专属内容": "Customizing exclusive content",
  "点击任意位置继续": "Tap anywhere to continue",
  "点击这里进入小镇": "Tap here to enter the town"
};

for (const [cn, en] of Object.entries(translations)) {
  content = content.split(cn).join(en);
}

fs.writeFileSync(path, content, 'utf8');
console.log("Translated App.tsx");
