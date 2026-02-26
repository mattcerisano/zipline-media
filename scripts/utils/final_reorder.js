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

// 1. Brands
let brands = extractCategory('Brands');
// Sort Rodeo to top, then Walk of Wonders, then others, then Winners Circle near bottom
const rodeo = brands.filter(v => v.title.toLowerCase().includes('rodeo') || v.title.toLowerCase().includes('truck stop'));
const walk = brands.filter(v => v.title.toLowerCase().includes('wonders awaits'));
const winners = brands.filter(v => v.title.toLowerCase().includes('winners circle'));
const otherBrands = brands.filter(v => !rodeo.includes(v) && !walk.includes(v) && !winners.includes(v));

const finalBrands = [...rodeo, ...walk, ...otherBrands.slice(0, 4), ...winners, ...otherBrands.slice(4)];

// 2. Nonprofits: Interleave different clients
let nonprofits = extractCategory('Nonprofits');
const npGroups = {};
nonprofits.forEach(v => {
  const key = v.publisher || v.description || 'Other';
  const groupKey = key.substring(0, 12);
  if (!npGroups[groupKey]) npGroups[groupKey] = [];
  npGroups[groupKey].push(v);
});
let npMushed = [];
let npKeys = Object.keys(npGroups).sort();
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

// 3. New Media: Interleave Keke, Kelce, Tonys, Eric Andre
let newMedia = extractCategory('New Media');
const nmGroups = { eric: [], keke: [], kelce: [], tonys: [], other: [] };
newMedia.forEach(v => {
  const t = (v.title + (v.description || '')).toLowerCase();
  if (t.includes('eric andre') || t.includes('bombing')) nmGroups.eric.push(v);
  else if (t.includes('keke')) nmGroups.keke.push(v);
  else if (t.includes('kelce') || t.includes('heights')) nmGroups.kelce.push(v);
  else if (t.includes('tony')) nmGroups.tonys.push(v);
  else nmGroups.other.push(v);
});
let nmMushed = [];
const nmKeysOrder = ['eric', 'keke', 'kelce', 'tonys', 'other'];
hasMore = true;
while(hasMore) {
  hasMore = false;
  nmKeysOrder.forEach(k => {
    if (nmGroups[k].length > 0) {
      nmMushed.push(nmGroups[k].shift());
      hasMore = true;
    }
  });
}

// Re-assemble
const categoriesOrder = ['Recent Work', 'B-Roll', 'Commercial', 'Social', 'Events', 'Music'];
let finalResult = [];
categoriesOrder.forEach(cat => {
  finalResult = [...finalResult, ...videos.filter(v => v.category === cat)];
});
finalResult = [...finalResult, ...finalBrands, ...npMushed, ...nmMushed];

fs.writeFileSync(filePath, JSON.stringify(finalResult, null, 2));
console.log('Final reorder script finished');
