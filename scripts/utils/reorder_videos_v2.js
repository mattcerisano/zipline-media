const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/data/videos.json');
let videos = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Helper to extract by category
function extractCategory(cat) {
  const result = videos.filter(v => v.category === cat);
  videos = videos.filter(v => v.category !== cat);
  return result;
}

// 1. Move Arsnova Camper (already handled manually via replace in previous turn, but let's be sure)
videos.forEach(v => {
  if (v.title && v.title.toLowerCase().includes('camper') && v.title.includes('2023')) {
    v.category = 'Nonprofits';
  }
});

// 2. Brands: Rodeo at top, Winners Circle down.
let brands = extractCategory('Brands');
let rodeoIdx = brands.findIndex(v => v.title.toLowerCase().includes('rodeo') || v.title.toLowerCase().includes('truck stop'));
if (rodeoIdx !== -1) {
  const rodeo = brands.splice(rodeoIdx, 1)[0];
  brands.unshift(rodeo);
}
let winnersIdx = brands.findIndex(v => v.title.toLowerCase().includes('winners circle'));
if (winnersIdx !== -1) {
  const winners = brands.splice(winnersIdx, 1)[0];
  brands.splice(Math.min(brands.length, 8), 0, winners); // Drop it down 8 spots
}

// 3. Nonprofits: Interleave
let nonprofits = extractCategory('Nonprofits');
const npGroups = {};
nonprofits.forEach(v => {
  const pub = v.publisher || v.description || 'Other';
  const key = pub.substring(0, 10); // group by start of desc/pub
  if (!npGroups[key]) npGroups[key] = [];
  npGroups[key].push(v);
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

// 4. New Media: Interleave Keke, Kelce, Tonys, Eric Andre
let newMedia = extractCategory('New Media');
const nmGroups = { keke: [], kelce: [], tonys: [], eric: [], other: [] };
newMedia.forEach(v => {
  const t = (v.title + (v.description || '')).toLowerCase();
  if (t.includes('keke')) nmGroups.keke.push(v);
  else if (t.includes('kelce') || t.includes('heights')) nmGroups.kelce.push(v);
  else if (t.includes('tony')) nmGroups.tonys.push(v);
  else if (t.includes('eric andre') || t.includes('bombing')) nmGroups.eric.push(v);
  else nmGroups.other.push(v);
});
let nmMushed = [];
const nmKeys = ['eric', 'keke', 'kelce', 'tonys', 'other'];
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

// Final Categories Order
const finalOrder = [
  ...videos.filter(v => v.category === 'Recent Work'),
  ...videos.filter(v => v.category === 'B-Roll'),
  ...videos.filter(v => v.category === 'Commercial'),
  ...videos.filter(v => v.category === 'Social'),
  ...videos.filter(v => v.category === 'Events'),
  ...videos.filter(v => v.category === 'Music'),
  ...brands,
  ...npMushed,
  ...nmMushed
];

fs.writeFileSync(filePath, JSON.stringify(finalOrder, null, 2));
console.log('Final reorder complete');
