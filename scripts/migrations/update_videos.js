const fs = require('fs');
const path = require('path');

// Read existing data
const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);
const sourceText = fs.readFileSync(path.join(__dirname, '../work_source.txt'), 'utf-8');

// Helper: Normalize URL
function normalizeUrl(url) {
  if (!url) return '';
  url = url.trim();
  
  // Clean query params (except for necessary ones? usually none for ID)
  // Actually, youtube IDs are safe.
  if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  if (url.includes('youtube.com/watch?v=')) {
    const id = url.split('v=')[1].split('&')[0];
    return `https://www.youtube.com/embed/${id}`;
  }
  
  // Vimeo
  if (url.includes('vimeo.com/')) {
    if (url.includes('player.vimeo.com')) return url;
    const parts = url.split('?')[0].split('/');
    const id = parts[parts.length - 1];
    if (!isNaN(id)) {
        return `https://player.vimeo.com/video/${id}`;
    }
  }

  // Instagram
  if (url.includes('instagram.com/')) {
     return url; // Keep as is, ArchiveClient might need update to handle links vs embeds or we treat as external link?
     // The user's requested list has instagram links.
     // The current ArchiveClient uses an iframe. Instagram won't embed in a simple iframe without /embed or api.
     // But let's store the URL for now.
  }

  return url;
}

// Helper: Find existing video
function findVideo(searchTitle, searchUrl) {
  const normUrl = normalizeUrl(searchUrl);
  
  // 1. Try exact URL match
  if (normUrl) {
    const found = videos.find(v => normalizeUrl(v.videoUrl) === normUrl);
    if (found) return found;
  }

  // 2. Try Title match (fuzzy)
  const cleanSearch = searchTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!cleanSearch) return null;

  return videos.find(v => {
    const cleanTitle = v.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    return cleanTitle.includes(cleanSearch) || cleanSearch.includes(cleanTitle);
  });
}

// Parsing Logic
const lines = sourceText.split('\n').map(l => l.trim()).filter(l => l);

const HEADERS = {
  "This Minute": "Recent Work",
  "Performance": "Performance", 
  "Brands & Nonprofits": "Brands & Nonprofits", 
  "New Media": "New Media"
};

const SUB_HEADERS = {
  "B-ROLL": "B-Roll",
  "COMMERCIAL": "Commercial",
  "SOCIAL": "Social",
  "EVENTS": "Events",
  "MUSIC": "Music",
  "BRANDS": "Brands",
  "NONPROFITS": "Nonprofits",
  "NEW MEDIA": "New Media"
};

let currentCat = '';
let currentSub = '';
let pendingTitle = '';

const newVideos = [];
const processedTitles = new Set();

function processItem(title, url, category) {
  if (!title) return;
  
  // Determine final category
  let finalCat = category;
  if (category === "Performance" || category === "Brands & Nonprofits") {
     // These are just containers, items should have a sub-category or be skipped if ambiguous?
     // But wait, the user format puts subheaders under these.
     // If currentSub is empty, it means an item is directly under "Performance"? Unlikely per file.
     // We will default to the Parent name if no sub, but that might be wrong.
     // Let's use currentSub if available.
  }

  // Specific override for "This Minute" -> "Recent Work"
  if (category === "Recent Work") {
     finalCat = "Recent Work"; 
  }

  const found = findVideo(title, url);
  const normalizedUrl = normalizeUrl(url) || (found ? found.videoUrl : "");

  let videoObj = {
    title: title,
    description: found ? found.description : title,
    thumbnail: found ? found.thumbnail : "https://placehold.co/1920x1080/000000/FFF?text=Video+Thumbnail",
    videoUrl: normalizedUrl,
    uploadDate: found ? found.uploadDate : new Date().toISOString(),
    duration: found ? found.duration : "",
    category: finalCat,
    hostedOn: normalizedUrl.includes('youtube') ? 'youtube' : (normalizedUrl.includes('vimeo') ? 'vimeo' : 'other')
  };

  // If we found a match, preserve other fields we might need
  if (found) {
     videoObj = { ...found, ...videoObj };
  }

  newVideos.push(videoObj);
  processedTitles.add(title);
}

for (let line of lines) {
  if (HEADERS[line]) {
    if (pendingTitle) { processItem(pendingTitle, '', currentSub || currentCat); pendingTitle = ''; }
    currentCat = HEADERS[line];
    currentSub = '';
    continue;
  }
  if (SUB_HEADERS[line]) {
    if (pendingTitle) { processItem(pendingTitle, '', currentSub || currentCat); pendingTitle = ''; }
    currentSub = SUB_HEADERS[line];
    continue;
  }

  if (line.startsWith('http')) {
    if (pendingTitle) {
      processItem(pendingTitle, line, currentSub || currentCat);
      pendingTitle = '';
    } else {
      // URL without title, try to find by URL in DB to get title?
      const found = findVideo('', line);
      if (found) {
         processItem(found.title, line, currentSub || currentCat);
      } else {
         console.warn('Orphan URL (skipping):', line);
      }
    }
    continue;
  }

  // It is a title
  if (pendingTitle) {
    // Previous pending title had no URL
    processItem(pendingTitle, '', currentSub || currentCat);
  }
  pendingTitle = line;
}
if (pendingTitle) {
  processItem(pendingTitle, '', currentSub || currentCat);
}

// Write Result
fs.writeFileSync(videosPath, JSON.stringify(newVideos, null, 2));
console.log(`Rewrote videos.json with ${newVideos.length} videos.`);