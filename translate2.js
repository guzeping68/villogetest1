const fs = require('fs');
const path = './src/data/que.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// Find unique Chinese keys to map
const scenes = new Set();
const goals = new Set();
const types = new Set();
const visuals = new Set();
const feedbacks = new Set();

data.lessons.forEach(lesson => {
  scenes.add(lesson.scene_cn);
  goals.add(lesson.learning_goal_cn);
  if (lesson.quizzes) {
    lesson.quizzes.forEach(q => {
      if (q.question_type_cn) types.add(q.question_type_cn);
      if (q.scene_visual_cn) visuals.add(q.scene_visual_cn);
      if (q.correct_feedback) feedbacks.add(q.correct_feedback);
    });
  }
});

console.log("Scenes:", Array.from(scenes));
console.log("Types:", Array.from(types));
// Wait, we don't need to manually map all of them if the UI doesn't render them,
// but for ones it does, we must map them. Let's see what is used in UI.
