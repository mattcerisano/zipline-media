const fs = require('fs');
const videos = JSON.parse(fs.readFileSync('src/data/videos.json', 'utf8'));

// Helper to find video
function findVideo(partialTitle, category) {
  const found = videos.find(v => v.title.includes(partialTitle));
  if (found) {
    // Override category to ensure it matches the requested slot if needed, 
    // but better to check if it matches naturally.
    console.log(JSON.stringify({
      title: found.title,
      thumbnail: found.thumbnail,
      videoUrl: found.videoUrl,
      category: category // Enforce the category we want to place it in
    }, null, 2) + ',');
  } else {
    console.log(`// Could not find: ${partialTitle}`);
  }
}

console.log('[');
findVideo("The Most BROADWAY Broadway Opening Night", "Opening Nights");
findVideo("Sarah Snook", "New Media");
findVideo("Automation & Carpentry", "Broadway B-Roll");
findVideo("Robyn Hurder is Ivy Lynn", "Reveals");
findVideo("Winners Circle Sizzle", "TVC");
findVideo("Where I Wanna Be", "Cast Recordings");
console.log(']');