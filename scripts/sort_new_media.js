const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

// 1. Separate New Media from others
const newMedia = videos.filter(v => v.category === 'New Media');
const others = videos.filter(v => v.category !== 'New Media');

// 2. Sorting Logic

// Helper to determine priority group
function getGroup(video) {
  const t = video.title.toLowerCase();
  
  // Group 1: Star Studded Podcasts (Good Fortune, New Heights)
  if (t.includes('good fortune') && t.includes('keke palmer')) return 1; // Actually title is '‘Good Fortune’ & Funny...'
  if (t.includes('new heights')) return 1; // Catch Ben Stiller and Fitz & Whit
  if (t.includes('record-breaking signings')) return 1; // Ben Stiller ep title
  if (t.includes('new schedules, new popes')) return 1; // Fitz & Whit ep title
  if (t.includes('keanu reeves')) return 1;

  // Group 2: Tony Awards (will sort internally by year)
  if (t.includes('tony awards') || t.includes('first impressions')) return 2;

  // Group 3: Broadway Features / Red Carpets
  if (t.includes('merrily we roll along') || t.includes('red carpet')) return 3;
  if (t.includes('betty boop')) return 3;
  if (t.includes('take me out') && !t.includes('tony awards')) return 3;
  if (t.includes('moulin rouge') || t.includes('zidler')) return 3;
  if (t.includes('shakespeare') || t.includes('costume')) return 3;
  if (t.includes('here lies love')) return 3;
  if (t.includes('sing street')) return 3;
  if (t.includes('camp')) return 3;
  if (t.includes('walden')) return 3;
  if (t.includes('cult of love')) return 3;
  if (t.includes('lempicka')) return 3;
  if (t.includes('townspeople')) return 3;
  if (t.includes('white girl in danger')) return 3;
  if (t.includes('spiderman')) return 3;

  // Group 4: EMG (Elegant Music Group) / Vlogs
  if (t.includes('emg') || t.includes('elegant music group')) return 4;

  return 5; // Everything else
}

// Helper to extract year from Tony Awards
function getTonyYear(title) {
  const match = title.match(/20\d{2}/);
  if (match) return parseInt(match[0]);
  if (title.includes('wayne brady')) return 2021; // 74th Tonys
  return 0;
}

// Helper to extract EMG Episode number
function getEmgEp(title) {
  const match = title.match(/Episode #(\d+)/i);
  if (match) return parseInt(match[1]);
  return 0;
}

const sortedNewMedia = newMedia.sort((a, b) => {
  const groupA = getGroup(a);
  const groupB = getGroup(b);

  if (groupA !== groupB) return groupA - groupB;

  // Internal Sorting

  // Group 1: Podcasts
  if (groupA === 1) {
    // Specific order: Keanu (Good Fortune) -> Ben Stiller -> Fitz & Whit
    const isKeanu = t => t.includes('good fortune') || t.includes('keanu');
    const isStiller = t => t.includes('ben stiller');
    
    if (isKeanu(a.title.toLowerCase()) && !isKeanu(b.title.toLowerCase())) return -1;
    if (!isKeanu(a.title.toLowerCase()) && isKeanu(b.title.toLowerCase())) return 1;
    
    if (isStiller(a.title.toLowerCase()) && !isStiller(b.title.toLowerCase())) return -1;
    if (!isStiller(a.title.toLowerCase()) && isStiller(b.title.toLowerCase())) return 1;
    
    return 0;
  }

  // Group 2: Tony Awards (Newest Year First)
  if (groupA === 2) {
    const yearA = getTonyYear(a.title);
    const yearB = getTonyYear(b.title);
    if (yearA !== yearB) return yearB - yearA; // Descending year
    // Same year? sort alphabetically or specific preference?
    return a.title.localeCompare(b.title);
  }

  // Group 4: EMG (Newest Episode First)
  if (groupA === 4) {
    const epA = getEmgEp(a.title);
    const epB = getEmgEp(b.title);
    if (epA && epB) return epB - epA; // 7 before 1
    // If one is not an episode (like Vlog Six), put it first or last?
    // User list had "VLOG Six" then the numbered episodes. 
    // Let's assume VLOGs come before the "On The Move" series or after?
    // Let's put "On The Move" series together.
    const isMoveA = a.title.includes('On The Move');
    const isMoveB = b.title.includes('On The Move');
    if (isMoveA && !isMoveB) return 1; // Put numbered series AFTER generic vlogs? Or before?
    // Actually, usually Series is grouped. Let's put Series AFTER Vlogs if Vlogs are highlight reels.
    if (!isMoveA && isMoveB) return -1;
    
    return a.title.localeCompare(b.title);
  }

  return 0;
});

// 3. Reconstruct
// We need to insert sortedNewMedia back into the correct position relative to other categories?
// Or just append? The user's list had strict order.
// Let's reconstruct the whole array based on category order:
// Recent, Performance (B-Roll, Com, Soc, Ev, Mus), Brands, Nonprofits, New Media

const finalVideos = [];
const categories = ['Recent Work', 'B-Roll', 'Commercial', 'Social', 'Events', 'Music', 'Brands', 'Nonprofits'];

categories.forEach(cat => {
  finalVideos.push(...others.filter(v => v.category === cat));
});

finalVideos.push(...sortedNewMedia);

fs.writeFileSync(videosPath, JSON.stringify(finalVideos, null, 2));
console.log('Reordered New Media items.');
