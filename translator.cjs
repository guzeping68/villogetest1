const fs = require('fs');
const path1 = './src/data/keqianjuqing.json';
if (fs.existsSync(path1)) {
  const data = JSON.parse(fs.readFileSync(path1, 'utf8'));

  const sceneMap = {
    "客厅": "Living Room",
    "餐厅": "Dining Room",
    "后院": "Backyard",
    "厨房": "Kitchen",
    "卧室": "Bedroom"
  };

  data.lessons.forEach(lesson => {
    if (sceneMap[lesson.scene_cn]) {
      lesson.scene_cn = sceneMap[lesson.scene_cn];
    }
    if (lesson.dialogues) {
      lesson.dialogues.forEach(d => {
        if (d.text_en) {
          d.text_cn = d.text_en;
        }
      });
    }
  });

  fs.writeFileSync(path1, JSON.stringify(data, null, 2));
  console.log("Updated keqianjuqing.json");
}

const path2 = './src/data/que.json';
if (fs.existsSync(path2)) {
  const data = JSON.parse(fs.readFileSync(path2, 'utf8'));
  const scenes = new Set();
  const types = new Set();
  data.lessons.forEach(lesson => {
    if (lesson.scene_cn) scenes.add(lesson.scene_cn);
    if (lesson.learning_goal_en) lesson.learning_goal_cn = lesson.learning_goal_en;
    if (lesson.quizzes) {
      lesson.quizzes.forEach(q => {
        if (q.question_type_cn) types.add(q.question_type_cn);
        if (q.scene_visual_en) q.scene_visual_cn = q.scene_visual_en;
      });
    }
  });

  fs.writeFileSync(path2, JSON.stringify(data, null, 2));
  console.log("Updated que.json. Scenes:", Array.from(scenes), "Types:", Array.from(types));
}
