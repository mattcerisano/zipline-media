const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

const videoId = 'edNuZdVg38o';
const title = "Sitting Down with the Cast and EP of ‘The ’Burbs’ | Baby, this is Keke Palmer";
const embedUrl = `https://www.youtube.com/embed/${videoId}`;
const thumbUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

const newEntryRecent = {
  title: title,
  description: title,
  thumbnail: thumbUrl,
  videoUrl: embedUrl,
  uploadDate: new Date().toISOString(),
  duration: "",
  category: "Recent Work",
  hostedOn: "youtube"
};

const newEntryNewMedia = {
  ...newEntryRecent,
  category: "New Media"
};

// 1. Add to top of Recent Work
// Filter out if already exists to avoid dupes
let updatedVideos = videos.filter(v => v.videoUrl !== embedUrl);

// Find first Recent Work index
let recentIndex = updatedVideos.findIndex(v => v.category === "Recent Work");
if (recentIndex === -1) recentIndex = 0;
updatedVideos.splice(recentIndex, 0, newEntryRecent);

// 2. Add to top of New Media
let newMediaIndex = updatedVideos.findIndex(v => v.category === "New Media");
if (newMediaIndex === -1) newMediaIndex = updatedVideos.length;
updatedVideos.splice(newMediaIndex, 0, newEntryNewMedia);

fs.writeFileSync(videosPath, JSON.stringify(updatedVideos, null, 2));
console.log('Added "The Burbs" Keke Palmer video to Recent Work and New Media.');
