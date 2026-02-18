const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

let fixedCount = 0;
const updatedVideos = videos.map(v => {
  if (v.title.includes("Marjorie Prime on Broadway") && v.thumbnail.includes("maxresdefault.jpg")) {
    v.thumbnail = v.thumbnail.replace("maxresdefault.jpg", "hqdefault.jpg");
    fixedCount++;
  }
  return v;
});

fs.writeFileSync(videosPath, JSON.stringify(updatedVideos, null, 2));
console.log(`Fixed thumbnail for ${fixedCount} Marjorie Prime entries.`);
