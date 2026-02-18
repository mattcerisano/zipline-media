const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
let videos = require(videosPath);

// 1. Remove duplicate "LEMPICKA on Broadway" in Commercial
// We'll keep the first one we find and remove subsequent ones, or check if they are identical.
let lempickaCount = 0;
const newVideos = [];
const lempickaTitle = "LEMPICKA on Broadway";

for (const video of videos) {
  if (video.title === lempickaTitle && video.category === "Commercial") {
    lempickaCount++;
    if (lempickaCount > 1) {
      console.log(`Removing duplicate: ${video.title} (${video.category})`);
      continue; // Skip adding this one
    }
  }
  
  // 2. Move "Red Carpet Celebration | Merrily We Roll Along on Broadway"
  if (video.title === "Red Carpet Celebration | Merrily We Roll Along on Broadway") {
    console.log(`Moving "${video.title}" from "${video.category}" to "Events"`);
    video.category = "Events";
  }

  newVideos.push(video);
}

fs.writeFileSync(videosPath, JSON.stringify(newVideos, null, 2));
console.log(`Processed videos. Total count: ${newVideos.length}`);
