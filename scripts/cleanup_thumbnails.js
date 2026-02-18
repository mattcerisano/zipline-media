const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

let updatedCount = 0;

const updatedVideos = videos.map(v => {
  if (v.thumbnail.includes('placehold.co')) {
    // Fallback for Instagram/Others where we can't scrape
    // Use a clean dark placeholder with text relative to the content?
    // Or just the Zipline logo?
    // Let's use a nice dark placeholder that says "WATCH ON INSTAGRAM" if it's instagram
    if (v.videoUrl.includes('instagram.com')) {
       v.thumbnail = "https://placehold.co/1080x1920/000000/FFF?text=INSTAGRAM+REEL"; 
       // Note: 9:16 aspect ratio might be better for reels? 
       // But the grid is 16:9. So 1920x1080 is safer for the grid layout.
       v.thumbnail = "https://placehold.co/1920x1080/000000/FFFFFF?text=VIEW+ON+INSTAGRAM";
    } else {
       v.thumbnail = "https://placehold.co/1920x1080/000000/FFFFFF?text=ZIPLINE+MEDIA";
    }
    updatedCount++;
  }
  return v;
});

fs.writeFileSync(videosPath, JSON.stringify(updatedVideos, null, 2));
console.log(`Updated ${updatedCount} remaining placeholders.`);
