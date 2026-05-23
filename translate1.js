const fs = require('fs');
const path = './src/data/keqianjuqing.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

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

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log("Updated keqianjuqing.json");
