const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../src/data/videos.json');
let videos = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const desiredBrollOrder = [
  "Moulin Rouge! The Musical Celebrates 5 Years on Broadway",
  "Six on CNN’s Thanksgiving in America",
  "A 37-Second Montage of Broadway's Lempicka",
  "Marjorie Prime on Broadway",
  "First Look: Kristin Chenoweth Performs “Golden Hour” From Queen of Versailles",
  "DRAG: The Musical off-Broadway | \"Queen Kitty\" starring Alaska Thunderf*ck",
  "Moulin Rouge! The Musical | Aaron Tveit - Roxanne",
  "The Queen of Versailles Broadway Teaser",
  "The Shakespeare Theatre of New Jersey presents MACBETH",
  "The Complete Works of William Shakespeare (abridged) [revised] [again]",
  "Moulin Rouge! The Musical | Derek Klena - Come What May",
  "Cult of Love on Broadway is a NYT Critic’s Pick!",
  "Moulin Rouge! The Musical | Ashley Loren - Firework",
  "ABT Studio Company Winter Festival Trailer",
  "Golden Hour | The Queen of Versailles on Broadway",
  "DRAG | The Musical First Look",
  "The Royal We | Queen of Versailles on Broadway",
  "Hamptons Dance Project"
];

// Split videos into B-Roll and others
let brollVideos = videos.filter(v => v.category === 'B-Roll');
let otherVideos = videos.filter(v => v.category !== 'B-Roll');

// Sort B-Roll videos based on desired order
brollVideos.sort((a, b) => {
  let indexA = desiredBrollOrder.indexOf(a.title);
  let indexB = desiredBrollOrder.indexOf(b.title);
  
  // If not found in the list, move to the end
  if (indexA === -1) indexA = 999;
  if (indexB === -1) indexB = 999;
  
  return indexA - indexB;
});

// Re-assemble (Keeping B-Roll in its original relative position in the file structure)
// We'll find the first index where B-Roll appeared and insert the sorted list there.
// However, the existing logic usually keeps categories together. 
// For simplicity and since we did a category shuffle earlier, let's keep the existing category flow:
// Recent Work, B-Roll, Commercial, Social, Events, Music, Brands, Nonprofits, New Media

const categories = ['Recent Work', 'B-Roll', 'Commercial', 'Social', 'Events', 'Music', 'Brands', 'Nonprofits', 'New Media'];
let finalVideos = [];

categories.forEach(cat => {
  if (cat === 'B-Roll') {
    finalVideos = [...finalVideos, ...brollVideos];
  } else {
    finalVideos = [...finalVideos, ...otherVideos.filter(v => v.category === cat)];
  }
});

// Add any videos that might have categories not in our sorted list
const reassembledCats = new Set(categories);
const extraVideos = otherVideos.filter(v => !reassembledCats.has(v.category));
finalVideos = [...finalVideos, ...extraVideos];

fs.writeFileSync(filePath, JSON.stringify(finalVideos, null, 2));
console.log('B-Roll reordering complete');
