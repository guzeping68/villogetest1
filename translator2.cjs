const fs = require('fs');

const path2 = './src/data/que.json';
if (fs.existsSync(path2)) {
  const data = JSON.parse(fs.readFileSync(path2, 'utf8'));
  
  const sceneMap = {
    "客厅": "Living Room",
    "餐厅": "Dining Room",
    "后院": "Backyard",
    "厨房": "Kitchen",
    "卧室": "Bedroom",
    "阳台": "Balcony"
  };

  data.lessons.forEach(lesson => {
    if (sceneMap[lesson.scene_cn]) {
      lesson.scene_cn = sceneMap[lesson.scene_cn];
    }
  });

  fs.writeFileSync(path2, JSON.stringify(data, null, 2));
  console.log("Updated scenes in que.json");
}

