const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

// Define client signatures (regex or simple string)
const CLIENTS = [
  /Moulin Rouge/i,
  /Lempicka/i,
  /Smash/i,
  /Boop/i,
  /Queen of Versailles/i,
  /Death Becomes Her/i,
  /Gutenberg/i,
  /Phantom/i,
  /Take Me Out/i,
  /Lost Boys/i,
  /Real Women Have Curves/i,
  /Cult of Love/i,
  /Walden/i,
  /McNEAL/i,
  /Floyd Collins/i,
  /Shakespeare Theatre/i,
  /Just in Time/i,
  /Dead Outlaw/i,
  /Once Upon A Mattress/i,
  /Hills of California/i,
  /Clyde's/i,
  /Strange Loop/i,
  /Meet the Cartozians/i,
  /Thanksgiving Play/i,
  /Bad Cinderella/i,
  /Great Gatsby/i,
  /Camelot/i,
  /Hoffman/i,
  /Dr\. Will/i,
  /GNUdefRecords/i,
  /Granite Garden/i,
  /American Cancer Society/i,
  /Hope Lodge/i, // ACS
  /Dance Lab New York/i,
  /DLNY/i,
  /Elegant Music Group/i,
  /EMG/i,
  /Oliva/i, // EMG
  /New York Sports Club/i,
  /T-Mobile/i,
  /Heineken/i,
  /Rita Joseph/i,
  /Khari Edwards/i,
  /Good Fortune/i,
  /Keke/i, // Good Fortune
  /New Heights/i,
  /Tony Awards/i,
  /First Impressions/i, // Tonys
  /Cartozians/i,
  /Marjorie Prime/i,
  /Drag: The Musical/i,
  /Drag The Musical/i
];

function getClientIndex(title) {
  return CLIENTS.findIndex(regex => regex.test(title));
}

// Map logical groups (e.g. DLNY and Dance Lab are the same)
function normalizeClientIndex(idx) {
  if (idx === -1) return -1;
  const regex = CLIENTS[idx];
  // Map aliases to a canonical index (using the first one that appears in CLIENTS)
  if (/Hope Lodge/i.source === regex.source) return CLIENTS.findIndex(r => /American Cancer Society/i.source === r.source);
  if (/DLNY/i.source === regex.source) return CLIENTS.findIndex(r => /Dance Lab New York/i.source === r.source);
  if (/EMG/i.source === regex.source) return CLIENTS.findIndex(r => /Elegant Music Group/i.source === r.source);
  if (/Oliva/i.source === regex.source) return CLIENTS.findIndex(r => /Elegant Music Group/i.source === r.source);
  if (/Keke/i.source === regex.source) return CLIENTS.findIndex(r => /Good Fortune/i.source === r.source);
  if (/First Impressions/i.source === regex.source) return CLIENTS.findIndex(r => /Tony Awards/i.source === r.source);
  if (/Drag The Musical/i.source === regex.source) return CLIENTS.findIndex(r => /Drag: The Musical/i.source === r.source);
  
  return idx;
}

function groupCategory(items) {
  const visited = new Array(items.length).fill(false);
  const result = [];

  for (let i = 0; i < items.length; i++) {
    if (visited[i]) continue;

    // Add current item
    result.push(items[i]);
    visited[i] = true;

    // Identify client
    const currentClientIdx = normalizeClientIndex(getClientIndex(items[i].title));

    if (currentClientIdx !== -1) {
      // Find all others of this client
      for (let j = i + 1; j < items.length; j++) {
        if (!visited[j]) {
          const otherClientIdx = normalizeClientIndex(getClientIndex(items[j].title));
          if (otherClientIdx === currentClientIdx) {
            result.push(items[j]);
            visited[j] = true;
          }
        }
      }
    }
  }
  return result;
}

// Categories to process
const cats = [
  'Recent Work',
  'B-Roll', 
  'Commercial', 
  'Social', 
  'Events', 
  'Music', 
  'Brands', 
  'Nonprofits', 
  'New Media'
];

let finalVideos = [];

cats.forEach(cat => {
  const catVideos = videos.filter(v => v.category === cat);
  // Group them
  const grouped = groupCategory(catVideos);
  finalVideos = finalVideos.concat(grouped);
});

// Add back any categories we missed (if any)
const processedCats = new Set(cats);
const leftovers = videos.filter(v => !processedCats.has(v.category));
finalVideos = finalVideos.concat(leftovers);

fs.writeFileSync(videosPath, JSON.stringify(finalVideos, null, 2));
console.log('Grouped videos by client within categories.');
