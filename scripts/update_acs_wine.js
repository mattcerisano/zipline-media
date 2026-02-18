const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

const targetTitle = "American Cancer Society | Wine and Spirits";
const newUrl = "https://player.vimeo.com/video/874147470";

let found = false;
const updatedVideos = videos.map(v => {
  if (v.title === targetTitle) {
    v.videoUrl = newUrl;
    v.thumbnail = "https://placehold.co/1920x1080/000000/FFF?text=Fetching+Thumbnail...";
    v.hostedOn = "vimeo";
    found = true;
  }
  return v;
});

if (found) {
  fs.writeFileSync(videosPath, JSON.stringify(updatedVideos, null, 2));
  console.log(`Updated URL for ${targetTitle}`);
} else {
  console.log(`Could not find ${targetTitle}`);
}
