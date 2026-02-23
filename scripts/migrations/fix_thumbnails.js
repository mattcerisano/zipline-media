const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

let fixedCount = 0;
let missingCount = 0;
const missingList = [];

const updatedVideos = videos.map(v => {
  const isPlaceholder = v.thumbnail.includes('placehold.co');
  
  if (isPlaceholder) {
    // 1. Try Fix YouTube
    if (v.hostedOn === 'youtube') {
      const parts = v.videoUrl.split('/');
      const id = parts[parts.length - 1].split('?')[0]; // Handle embed/ID?params
      if (id) {
        v.thumbnail = `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
        fixedCount++;
        return v;
      }
    }
    
    // 2. Report Missing for others
    missingCount++;
    missingList.push(`${v.hostedOn}: ${v.title} (${v.videoUrl})`);
  }
  return v;
});

fs.writeFileSync(videosPath, JSON.stringify(updatedVideos, null, 2));

console.log(`Fixed ${fixedCount} YouTube thumbnails.`);
console.log(`Still missing ${missingCount} thumbnails (Vimeo/Instagram/Other):`);
missingList.forEach(m => console.log(` - ${m}`));
