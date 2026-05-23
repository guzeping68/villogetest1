import fs from 'fs';

const shenghuojuqing = JSON.parse(fs.readFileSync('src/data/config/shenghuojuqing.json', 'utf8'));

function getAvatar(speaker, text) {
  if (!speaker) return "/assets/NPC.png";
  
  let lowerText = text ? text.toLowerCase() : "";
  let emotion = "happy"; // default

  if (lowerText.match(/(sorry|sad|cry|bad|unfortunate|ruined|miss|hurt|pain|sorrow|tear|upset|lose|lost|fired|laid off|crying|died|broke|worry|worried)/)) {
    emotion = "sorrow";
  } else if (lowerText.match(/(angry|mad|furious|argue|idiot|stupid|annoy|bother|hell|damn|shout|yell|stop it)/)) {
    emotion = "anger";
  } else if (lowerText.match(/(haha|lol|yay|great|awesome|excellent|perfect|love|thank you so much|amazing)/)) {
    emotion = "happiness";
  }

  if (speaker.includes("Mrs")) return `/assets/MrsHenderson${emotion}.png`;
  if (speaker.includes("You")) return `/assets/you${emotion}.png`;
  if (speaker.includes("Jake")) return `/assets/jack${emotion}.png`;
  if (speaker.includes("旁白")) return `/assets/NPC.png`;
  
  return "/assets/NPC.png";
}

for (let unitNum = 1; unitNum <= 4; unitNum++) {
  const unit = shenghuojuqing.units.find(u => u.unit_number === unitNum);
  if (!unit) continue;

  const episodeSteps = [];

  // Adding summary as the first narrator item
  if (unit.summary) {
    episodeSteps.push({
      "type": "narrator",
      "speaker": "旁白",
      "avatar": "/assets/NPC.png",
      "text": unit.summary,
      "text_cn": `（${unit.summary}）`
    });
  }

  for (const item of unit.items) {
    if (item.type === "story") {
      for (const entry of item.entries) {
        if (entry.type === "narration") {
          let text = entry.text;
          let cn = "";
          const m = text.match(/（(.*?)）$/);
          if (m) {
            text = text.replace(/（.*?）$/, '').trim();
            cn = m[1];
          }
          episodeSteps.push({
            "type": "narrator",
            "speaker": "旁白",
            "avatar": "/assets/NPC.png",
            "text": text,
            "text_cn": cn ? `（${cn}）` : ""
          });
        } else if (entry.type === "stage_direction") {
          episodeSteps.push({
            "type": "narrator",
            "speaker": "旁白",
            "avatar": "/assets/NPC.png",
            "text": entry.text,
            "text_cn": `（${entry.text}）`
          });
        } else if (entry.type === "dialogue") {
          let speakerText = entry.speaker;
          // Strip any parenthetical from speaker name in dialogue text
          const speakerMatch = speakerText.match(/^(.*?)( \([^)]*\))?$/);
          const cleanSpeaker = speakerMatch ? speakerMatch[1].trim() : speakerText;
          
          episodeSteps.push({
            "type": "dialogue",
            "speaker": cleanSpeaker,
            "avatar": getAvatar(cleanSpeaker, entry.text),
            "text": entry.text,
            "text_cn": "" 
          });
        }
      }
    } else if (item.type === "question") {
      let title = item.question_title_zh || "";
      let cleanTitle = title;
      if (cleanTitle.includes("—")) {
         cleanTitle = cleanTitle.split("—")[0].trim();
      } else if (cleanTitle.includes("-")) {
         cleanTitle = cleanTitle.split("-")[0].trim();
      }
      
      let q: any = {
        "type": "question",
        "format": "multiple_choice",
        "instruction": cleanTitle + "\n" + item.prompt,
      };
      
      if (item.question_type_label && item.question_type_label.includes("语义配对")) {
        q.format = "matching";
        if (unitNum === 1) {
          const fixedPairs = [
            { word: "heater", image: "暖气" },
            { word: "cold", image: "冷的" },
            { word: "neighbor", image: "邻居" },
            { word: "box", image: "箱子" }
          ];
          q.pairs = fixedPairs.map((p, i) => ({
            id: i + 1,
            word: p.word,
            image: p.image
          }));
        } else if (unitNum === 2) {
          const fixedPairs = [
            { word: "apply", image: "申请" },
            { word: "online", image: "在网上" },
            { word: "ID", image: "身份证件" }
          ];
          q.pairs = fixedPairs.map((p, i) => ({
            id: i + 1,
            word: p.word,
            image: p.image
          }));
        } else if (item.pairs) {
          q.pairs = item.pairs.filter(p => !p.left.includes("**")).map((p, i) => ({
            id: i + 1,
            word: p.left,
            image: p.right
          }));
        }
      } else if (item.question_type_label && item.question_type_label.includes("句子拼装")) {
        // Just keep as multiple choice, populate options
        q.format = "multiple_choice";
        if (!item.options || item.options.length === 0) {
           let opts = [];
           let correct = item.correct_answer ? item.correct_answer.replace(/"/g, '') : "";
           if (!correct && item.chunks) correct = item.chunks.join(" ");
           opts.push({label: "A", text: correct, is_correct: true});
           if (item.distractors) {
              item.distractors.forEach((d, i) => {
                 opts.push({label: String.fromCharCode(66+i), text: d, is_correct: false});
              });
           } else {
              opts.push({label: "B", text: "Incorrect option", is_correct: false});
           }
           q.options = opts;
        }
      } else if (item.question_type_label && item.question_type_label.includes("语音跟读")) {
        q.format = "multiple_choice";
        if (!item.options || item.options.length === 0) {
           q.options = [
             { label: "A", text: item.hint ? item.hint.replace(/"/g, '') : "Correct audio", is_correct: true }
           ];
        }
      }
      
      if (item.options && item.options.length > 0) {
        q.options = item.options.map((opt, i) => ({
          label: opt.key || String.fromCharCode(65+i),
          text: opt.label,
          is_correct: item.correct_option === opt.key
        }));
      }
      
      episodeSteps.push(q);
    }
  }

  const finalFile = {
    title: `Episode ${unitNum}: ${unit.unit_title_en}（${unit.unit_title_zh}）`,
    steps: episodeSteps
  };

  fs.writeFileSync(`src/data/config/episode_${unitNum}.json`, JSON.stringify(finalFile, null, 2));
}

console.log("SUCCESS!");
