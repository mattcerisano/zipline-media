const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

// Find 'Good Fortune' in New Media
const gfIndex = videos.findIndex(v => v.category === 'New Media' && v.title.includes('Good Fortune'));

if (gfIndex !== -1) {
  const [gf] = videos.splice(gfIndex, 1);
  
  // Find first index of New Media
  const firstNM = videos.findIndex(v => v.category === 'New Media');
  if (firstNM !== -1) {
    videos.splice(firstNM, 0, gf);
  } else {
    videos.push(gf); // Fallback
  }
  
  fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
  console.log('Moved "Good Fortune" to the top of New Media.');
} else {
  console.log('Could not find "Good Fortune" in New Media.');
}
