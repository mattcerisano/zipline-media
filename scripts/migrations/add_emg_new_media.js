const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

const newMediaItems = [
  {
    title: "Barry Manilow | 2023 Tony Awards First Impressions",
    url: "https://www.youtube.com/watch?v=FvBoMlOMFak"
  },
  {
    title: "EMG On The Move | Episode #7: The Gang's All Here",
    url: "https://www.youtube.com/watch?v=IPzHgbqLQ2o"
  },
  {
    title: "EMG on the Move | Episode #5: Unexpected Expansion",
    url: "https://www.youtube.com/watch?v=WCFU8GlKOq4"
  },
  {
    title: "EMG on the Move | Episode #4: Progress",
    url: "https://www.youtube.com/watch?v=EHfRRNHX1-s"
  },
  {
    title: "EMG on the Move | Episode #3: Moving Day",
    url: "https://www.youtube.com/watch?v=Zl5XruawAZ4"
  },
  {
    title: "EMG on the Move | Episode #2: The Problem With The Old Place",
    url: "https://www.youtube.com/watch?v=OLjZreGoVLk"
  },
  {
    title: "EMG on the Move | Episode #1: Our New Home",
    url: "https://www.youtube.com/watch?v=4Es7WOTfxaU"
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

const newEntries = newMediaItems.map(item => ({
  title: item.title,
  description: item.title,
  thumbnail: getThumbnail(item.url),
  videoUrl: normalizeUrl(item.url),
  uploadDate: new Date().toISOString(),
  duration: "",
  category: "New Media",
  hostedOn: "youtube"
}));

// Find the last index of New Media to insert them there
let lastNewMediaIndex = -1;
for (let i = 0; i < videos.length; i++) {
  if (videos[i].category === "New Media") {
    lastNewMediaIndex = i;
  }
}

if (lastNewMediaIndex !== -1) {
  videos.splice(lastNewMediaIndex + 1, 0, ...newEntries);
} else {
  videos.push(...newEntries);
}

fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
console.log(`Added ${newEntries.length} items to New Media.`);
