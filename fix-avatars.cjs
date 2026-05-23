const fs = require('fs');
const filepath = 'src/data/config/pre_lesson_stories.json';
let content = fs.readFileSync(filepath, 'utf8');
content = content.replace(/\/assets\/xiaotuzijiemian.png/g, '/assets/Amilitouxiang.png');
content = content.replace(/\/assets\/laonainaitouxiang.png/g, '/assets/buntouxiang.png');
fs.writeFileSync(filepath, content);
console.log('Fixed');
