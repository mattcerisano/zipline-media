const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

const targetTitle = "A 37-Second Montage of Broadway's Lempicka";
const newUrl = "https://www.youtube.com/embed/NkpevV8YSNk";
const newThumb = "https://img.youtube.com/vi/NkpevV8YSNk/maxresdefault.jpg";

let found = false;
const updatedVideos = videos.map(v => {
  if (v.title.includes("37-Second Montage") && v.title.includes("Lempicka")) {
    v.videoUrl = newUrl;
    v.thumbnail = newThumb;
    v.hostedOn = "youtube";
    found = true;
  }
  return v;
});

if (found) {
  fs.writeFileSync(videosPath, JSON.stringify(updatedVideos, null, 2));
  console.log('Successfully updated Lempicka Montage with YouTube link and thumbnail.');
} else {
  console.log('Could not find the Lempicka Montage entry to update.');
}
