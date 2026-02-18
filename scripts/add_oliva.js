const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

const videoId = '997368179';
const title = "Oliva - I am an EMG Bride";
const embedUrl = `https://player.vimeo.com/video/${videoId}`;

const newEntryBrands = {
  title: title,
  description: title,
  thumbnail: "https://placehold.co/1920x1080/000000/FFF?text=Fetching+Thumbnail...",
  videoUrl: embedUrl,
  uploadDate: new Date().toISOString(),
  duration: "",
  category: "Brands",
  hostedOn: "vimeo"
};

const newEntryNewMedia = {
  ...newEntryBrands,
  category: "New Media"
};

// Add to Brands
videos.push(newEntryBrands);
// Add to New Media
videos.push(newEntryNewMedia);

fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
console.log('Added "Oliva - I am an EMG Bride" to Brands and New Media.');
