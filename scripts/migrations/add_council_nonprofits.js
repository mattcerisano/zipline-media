const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

const newNPItems = [
  {
    title: "Rita Joseph for City Council - Vision",
    url: "https://www.youtube.com/watch?v=y1cEemTOONs"
  },
  {
    title: "Dan Cohen for New York City Council District 7",
    url: "https://www.youtube.com/watch?v=tOWeQQruXcs"
  }
];

function normalizeUrl(url) {
  const id = url.split('v=')[1]?.split('&')[0];
  return `https://www.youtube.com/embed/${id}`;
}

function getThumbnail(url) {
  const id = url.split('v=')[1]?.split('&')[0];
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
}

const newEntries = newNPItems.map(item => ({
  title: item.title,
  description: item.title,
  thumbnail: getThumbnail(item.url),
  videoUrl: normalizeUrl(item.url),
  uploadDate: new Date().toISOString(),
  duration: "",
  category: "Nonprofits",
  hostedOn: "youtube"
}));

// Find the last index of Nonprofits to insert them there
let lastNPIndex = -1;
for (let i = 0; i < videos.length; i++) {
  if (videos[i].category === "Nonprofits") {
    lastNPIndex = i;
  }
}

if (lastNPIndex !== -1) {
  videos.splice(lastNPIndex + 1, 0, ...newEntries);
} else {
  videos.push(...newEntries);
}

fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
console.log(`Added ${newEntries.length} items to Nonprofits.`);
