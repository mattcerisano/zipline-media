const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../../src/data/videos.json');
const videos = require(videosPath);

// Recent Work is a rolling list of 18 (3 rows of 6 on a wide screen) that
// renders in array order. Each batch is prepended, and the same number of
// entries are dropped off the bottom so the list stays at 18. The dropped
// entries only lose their Recent Work listing — every one of them also has a
// copy under its real section (B-Roll, Music, Events, …), which stays.
//
// Batch is ordered newest-first by upload date. `category` is set explicitly
// so none of these fall through to the title-keyword fallback.
const RECENT_WORK_SIZE = 18;

const newVideos = [
  {
    // Vimeo working title: OM_CurtainSpot_16.9_VO10
    title: "Oh, Mary! | Curtain Spot",
    url: "https://vimeo.com/1239953009",
    thumbnail: "https://i.vimeocdn.com/video/2217637894-39e4a0b34fbbb1e8c79d45c1ce5087e6dd2a5e3747804f929a077186e6dad0cf-d_1280?region=us",
    uploadDate: "2026-10-27T14:28:59-04:00",
    category: ["Recent Work", "Commercial"]    // -> TVC
  },
  {
    // Vimeo working title: OM_BrollSpot_16.9_Master
    title: "Oh, Mary! | B-Roll Spot",
    url: "https://vimeo.com/1239954108",
    thumbnail: "https://i.vimeocdn.com/video/2217640147-0797e7a72e30043ad54ce25e8fb2000560c6605112915bc58f9dd0e5b1fddb86-d_1280?region=us",
    uploadDate: "2026-10-27T14:32:41-04:00",
    category: ["Recent Work", "Commercial"]    // -> TVC
  },
  {
    title: "Billy Crystal is Back on Broadway with a New York Times Critic's Pick",
    url: "https://www.youtube.com/watch?v=Ur7WBgWn3qg",
    uploadDate: "2026-10-23T07:01:53-07:00",
    category: ["Recent Work", "Commercial"]    // -> TVC
  },
  {
    title: "Strictly Limited Engagement: Billy Crystal's 860 on Broadway",
    url: "https://www.youtube.com/watch?v=JEG0hb_jQUg",
    uploadDate: "2026-10-22T13:48:15-07:00",
    category: ["Recent Work", "Commercial"]    // -> TVC
  },
  {
    title: "In The Recording Studio: \"If We Make It Through The Night\"",
    url: "https://www.youtube.com/watch?v=HMIzWgB9URM",
    uploadDate: "2026-07-23T20:53:32-07:00",
    category: ["Recent Work", "Music"]         // -> Cast Recordings
  }
];

function normalizeUrl(url) {
  if (!url) return '';
  if (url.includes('youtu.be/')) return `https://www.youtube.com/embed/${url.split('youtu.be/')[1].split('?')[0]}`;
  if (url.includes('watch?v=')) return `https://www.youtube.com/embed/${url.split('v=')[1].split('&')[0]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
}

function getThumbnail(url) {
  const id = normalizeUrl(url).split('/').pop();
  return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
}

const hostOf = url => (url.includes('vimeo') ? 'vimeo' : 'youtube');

const entries = newVideos.map(item => {
  const normUrl = normalizeUrl(item.url);
  return {
    title: item.title,
    description: item.title,
    thumbnail: item.thumbnail || getThumbnail(item.url),
    videoUrl: normUrl,
    uploadDate: new Date(item.uploadDate).toISOString(),
    duration: "",
    category: item.category,
    hostedOn: hostOf(item.url)
  };
});

const cats = v => (Array.isArray(v.category) ? v.category : [v.category]);
const isRecent = v => cats(v).includes('Recent Work');

// Guard against re-running: skip anything already present by embed URL.
const existingUrls = new Set(videos.map(v => v.videoUrl));
const toAdd = entries.filter(e => {
  if (existingUrls.has(e.videoUrl)) {
    console.log(`SKIP (already present): ${e.title}`);
    return false;
  }
  return true;
});

// Push the oldest (bottom-most) Recent Work entries out so the list stays at 18.
const recent = videos.filter(isRecent);
const overflow = Math.max(0, recent.length + toAdd.length - RECENT_WORK_SIZE);
const dropped = new Set(recent.slice(recent.length - overflow));

for (const v of dropped) {
  const copies = videos.filter(o => o !== v && o.videoUrl === v.videoUrl);
  const otherCats = cats(v).filter(c => c !== 'Recent Work');
  if (copies.length === 0 && otherCats.length === 0) {
    throw new Error(`Refusing to drop "${v.title}": it has no other listing and would vanish from the archive.`);
  }
}

const kept = videos.flatMap(v => {
  if (!dropped.has(v)) return [v];
  // A combined entry ("Recent Work" + another section) just loses the Recent
  // Work tag; a Recent-Work-only entry is removed because its copy elsewhere
  // already covers it.
  const otherCats = cats(v).filter(c => c !== 'Recent Work');
  if (otherCats.length === 0) return [];
  return [{ ...v, category: otherCats.length === 1 ? otherCats[0] : otherCats }];
});

const updated = [...toAdd, ...kept];
fs.writeFileSync(videosPath, JSON.stringify(updated, null, 2));

console.log(`\nAdded ${toAdd.length} video(s). Total: ${videos.length} -> ${updated.length}`);
toAdd.forEach(v => console.log(`  + ${v.title}`));
console.log(`Pushed ${dropped.size} out of Recent Work:`);
dropped.forEach(v => console.log(`  - ${v.title}`));
console.log(`Recent Work now has ${updated.filter(isRecent).length} entries.`);
