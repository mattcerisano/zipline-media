const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

const newEntry = {
  title: "American Cancer Society | Hope Lodge Gala Video",
  description: "American Cancer Society | Hope Lodge Gala Video",
  thumbnail: "https://placehold.co/1920x1080/000000/FFF?text=Fetching+Thumbnail...",
  videoUrl: "https://player.vimeo.com/video/818450392",
  uploadDate: new Date().toISOString(),
  duration: "",
  category: "Nonprofits",
  hostedOn: "vimeo"
};

// Check if this specific URL already exists
const exists = videos.some(v => v.videoUrl.includes('818450392'));

if (!exists) {
  // Find Nonprofits section to insert near others
  const lastNP = videos.findLastIndex(v => v.category === "Nonprofits");
  if (lastNP !== -1) {
    videos.splice(lastNP + 1, 0, newEntry);
  } else {
    videos.push(newEntry);
  }
  fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
  console.log('Added ACS Hope Lodge Gala Video to Nonprofits.');
} else {
  console.log('Video already exists.');
}
