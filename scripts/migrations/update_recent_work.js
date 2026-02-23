const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

// New list configuration
const newRecentWork = [
  {
    title: "The Lost Boys - Have to Have You in Rehearsal",
    url: "https://www.youtube.com/watch?v=bGr0zWPjpOI"
  },
  {
    title: "The Lost Boys - If We Make it Through the Night",
    url: "https://www.youtube.com/watch?v=letEeZ6BoII"
  },
  {
    title: "Marjorie Prime on Broadway",
    url: "https://www.youtube.com/watch?v=ZD4VpzBu2jo"
  },
  {
    title: "‘Good Fortune’ & Funny Set Confessions with Keanu Reeves, Seth Rogen and Aziz Ansari",
    url: "https://youtu.be/bCy3RdLHC0Q" // Inferred from existing
  },
  {
    title: "Stephanie Chou - Jazz at Lincoln Center - Appel Room",
    url: "https://youtu.be/P9Snqtbahs0?si=3ngs_Yz3gBxnHqSz"
  }
];

// Helper to normalize
function normalizeUrl(url) {
  if (!url) return '';
  if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1].split('?')[0]}`;
  if (url.includes('watch?v=')) return `https://www.youtube.com/embed/${url.split('v=')[1].split('&')[0]}`;
  return url;
}

function getThumbnail(url) {
  if (url.includes('youtube') || url.includes('youtu.be')) {
    const id = normalizeUrl(url).split('/').pop();
    return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  }
  return "https://placehold.co/1920x1080/000000/FFFFFF?text=ZIPLINE+MEDIA";
}

// 1. Remove all existing "Recent Work" items
let otherVideos = videos.filter(v => v.category !== "Recent Work");

// 2. Create new "Recent Work" items
const recentVideos = newRecentWork.map(item => {
  // Try to find existing metadata (description, etc) from the DB even if not in Recent Work
  // (e.g. Marjorie Prime might be in B-Roll)
  const existing = videos.find(v => v.title === item.title) || {};
  
  const normUrl = normalizeUrl(item.url);
  
  return {
    title: item.title,
    description: existing.description || item.title,
    thumbnail: getThumbnail(normUrl),
    videoUrl: normUrl,
    uploadDate: existing.uploadDate || new Date().toISOString(),
    duration: existing.duration || "",
    category: "Recent Work",
    hostedOn: "youtube", // All provided are YouTube
    collection: existing.collection // preserve if any
  };
});

// 3. Merge
const finalVideos = [...recentVideos, ...otherVideos];

fs.writeFileSync(videosPath, JSON.stringify(finalVideos, null, 2));
console.log('Updated Recent Work section with 5 YouTube videos.');
