const fs = require('fs');
const videos = JSON.parse(fs.readFileSync('src/data/videos.json', 'utf8'));

const categories = [
  "Opening Nights", 
  "New Media", 
  "Broadway B-Roll", 
  "Reveals", 
  "TVC", 
  "Cast Recordings"
];

const selected = {};

categories.forEach(cat => {
  const inCat = videos.filter(v => v.category === cat);
  console.log(`\n--- ${cat} (${inCat.length}) ---`);
  // Show first 5
  inCat.slice(0, 5).forEach(v => {
      console.log(`- ${v.title} (${v.videoUrl})`);
  });
});
