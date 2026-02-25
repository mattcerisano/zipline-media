const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/data/videos.json');
let videos = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// 1. Move 2023 Arsnova Camper video to nonprofits from social.
videos.forEach(v => {
  if (v.title && v.title.includes('Arsnova Camper') && v.title.includes('2023')) {
    v.category = 'Nonprofits';
  }
});

// Helper to extract by category
function extractCategory(cat) {
  const result = videos.filter(v => v.category === cat);
  videos = videos.filter(v => v.category !== cat);
  return result;
}

// 2. On Brands, move Rodeo up to the top slot, drop Winners Circle down.
let brands = extractCategory('Brands');
let rodeoIdx = brands.findIndex(v => v.title.includes('Rodeo'));
let winnersIdx = brands.findIndex(v => v.title.includes('Winners Circle'));

if (rodeoIdx !== -1) {
  const rodeo = brands.splice(rodeoIdx, 1)[0];
  brands.unshift(rodeo); // top slot
}
// Winners Circle was moved if indices shifted, let's find it again
winnersIdx = brands.findIndex(v => v.title.includes('Winners Circle'));
if (winnersIdx !== -1) {
  const winners = brands.splice(winnersIdx, 1)[0];
  brands.splice(Math.min(brands.length, 5), 0, winners); // move down 5 spots
}

// 3. Nonprofits: mush around the order so it isn't all one client up top.
let nonprofits = extractCategory('Nonprofits');
// simple interleave: group by publisher or client, then round robin
const npGroups = {};
nonprofits.forEach(v => {
  const pub = v.publisher || 'Unknown';
  if (!npGroups[pub]) npGroups[pub] = [];
  npGroups[pub].push(v);
});
let npMushed = [];
let npKeys = Object.keys(npGroups);
let hasMore = true;
while(hasMore) {
  hasMore = false;
  npKeys.forEach(k => {
    if (npGroups[k].length > 0) {
      npMushed.push(npGroups[k].shift());
      hasMore = true;
    }
  });
}

// 4. New Media: mush it around, a little Keke, a little Kelce Bros, a little Tonys let's get Eric Andre in there.
let newMedia = extractCategory('New Media');
const nmGroups = { keke: [], kelce: [], tonys: [], eric: [], other: [] };
newMedia.forEach(v => {
  const t = v.title.toLowerCase() + (v.description || '').toLowerCase();
  if (t.includes('keke')) nmGroups.keke.push(v);
  else if (t.includes('kelce') || t.includes('new heights')) nmGroups.kelce.push(v);
  else if (t.includes('tony') || t.includes('tonys')) nmGroups.tonys.push(v);
  else if (t.includes('eric andre') || t.includes('bombing')) nmGroups.eric.push(v);
  else nmGroups.other.push(v);
});

let nmMushed = [];
let nmKeys = Object.keys(nmGroups);
hasMore = true;
while(hasMore) {
  hasMore = false;
  nmKeys.forEach(k => {
    if (nmGroups[k].length > 0) {
      nmMushed.push(nmGroups[k].shift());
      hasMore = true;
    }
  });
}

// Re-assemble
// Original categories likely order: Recent Work, B-Roll, Commercial, Social, Events, Music, Brands, Nonprofits, New Media
// We just extracted Brands, Nonprofits, New Media. Let's append them back to the end in order
videos = [...videos, ...brands, ...npMushed, ...nmMushed];

fs.writeFileSync(filePath, JSON.stringify(videos, null, 2));
console.log('Done reordering videos.json');
