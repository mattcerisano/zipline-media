const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../../src/data/videos.json');
const videos = require(videosPath);

// New Recent Work batch (Sept 2026). Ordered newest-first; prepended to the
// array so they lead the Recent Work row, which renders in array order.
//
// `category` is set explicitly rather than left to the title-keyword fallback
// in mapVideoToPlaylists() — none of these titles contain the keywords that
// would route them correctly, so all six would otherwise land in Broadway B-Roll.
const newVideos = [
  {
    title: "In Rehearsals with the North American Tour of Death Becomes Her",
    url: "https://www.youtube.com/watch?v=uvOV_nfTWRU",
    uploadDate: "2026-09-04T15:30:06-07:00",
    category: ["Recent Work", "B-Roll"]        // -> Broadway B-Roll
  },
  {
    title: "MTA Sessions with the cast of Two Strangers (Carry a Cake Across New York)",
    url: "https://www.youtube.com/watch?v=LeH7_a52mvY",
    uploadDate: "2026-08-31T07:15:04-07:00",
    category: ["Recent Work", "Music"]         // -> Cast Recordings
  },
  {
    title: "Thank you, Broadway!",
    url: "https://www.youtube.com/watch?v=NJ895vCqJeI",
    uploadDate: "2026-08-30T13:45:47-07:00",
    category: ["Recent Work", "B-Roll"]        // -> Broadway B-Roll
  },
  {
    title: "Oprah Winfrey on Knowing Your Worth",
    url: "https://www.youtube.com/watch?v=___b_FVXtQo",
    uploadDate: "2026-07-21T06:00:08-07:00",
    category: ["Recent Work", "New Media"]     // -> New Media
  },
  {
    title: "Music City: A New Musical now playing Off-Broadway in NYC.",
    url: "https://www.youtube.com/watch?v=fq4gyUn7KWg",
    uploadDate: "2026-07-10T08:28:39-07:00",
    category: ["Recent Work", "Commercial"]    // -> TVC
  },
  {
    title: "Laurie Metcalf | 2026 Tony Awards First Impressions",
    url: "https://www.youtube.com/watch?v=70_VdA5TGqU",
    uploadDate: "2026-06-07T18:39:22-07:00",
    category: ["Recent Work", "Events"]        // -> Opening Nights
  }
];

function normalizeUrl(url) {
  if (!url) return '';
  if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1].split('?')[0]}`;
  if (url.includes('watch?v=')) return `https://www.youtube.com/embed/${url.split('v=')[1].split('&')[0]}`;
  return url;
}

function getThumbnail(url) {
  const id = normalizeUrl(url).split('/').pop();
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

const entries = newVideos.map(item => {
  const normUrl = normalizeUrl(item.url);
  return {
    title: item.title,
    description: item.title,
    thumbnail: getThumbnail(item.url),
    videoUrl: normUrl,
    uploadDate: new Date(item.uploadDate).toISOString(),
    duration: "",
    category: item.category,
    hostedOn: "youtube"
  };
});

// Guard against re-running: skip anything already present by embed URL.
const existingUrls = new Set(videos.map(v => v.videoUrl));
const toAdd = entries.filter(e => {
  if (existingUrls.has(e.videoUrl)) {
    console.log(`SKIP (already present): ${e.title}`);
    return false;
  }
  return true;
});

const updated = [...toAdd, ...videos];
fs.writeFileSync(videosPath, JSON.stringify(updated, null, 2));

console.log(`\nAdded ${toAdd.length} video(s). Total: ${videos.length} -> ${updated.length}`);
toAdd.forEach(v => console.log(`  + ${v.title}`));
