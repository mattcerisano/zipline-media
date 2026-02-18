const fs = require('fs');
const path = require('path');

const videosPath = path.join(__dirname, '../src/data/videos.json');
let videos = require(videosPath);

// 1. Remove "Oliva - I am an EMG Bride" from New Media
const initialLength = videos.length;
videos = videos.filter(v => !(v.title.includes("Oliva - I am an EMG Bride") && v.category === "New Media"));
const removedCount = initialLength - videos.length;
console.log(`Removed ${removedCount} instance(s) of Oliva from New Media.`);

// 2. New Videos Data
const newItems = [
  { title: "Akira Uchida, DLNY Lab Cycle Choreographer", url: "https://www.youtube.com/watch?v=S57xZUnhwuI" },
  { title: "Will Ervin Jr, DLNY Lab Cycle Choreographer", url: "https://www.youtube.com/watch?v=jgkvtXK42a0" },
  { title: "Gabrielle Lamb, DLNY Alchemy Choreographer", url: "https://www.youtube.com/watch?v=LhghBY6wadk" },
  { title: "DLNY Tap Dance Project, Spring 2021", url: "https://www.youtube.com/watch?v=TMR_OZ8Au2Q" },
  { title: "Madison Hicks, DLNY Lab Cycle Choreographer", url: "https://www.youtube.com/watch?v=5PQz-Yoi5RA" },
  { title: "Dava Huesca, DLNY Lab Cycle Choreographer", url: "https://www.youtube.com/watch?v=Gsc566JYiFg" }
];

// Helper: Normalize URL
function normalizeUrl(url) {
  if (!url) return '';
  // Remove query params for comparison, but keep clean ID for embed
  let id = '';
  if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
  else if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
  
  if (id) return `https://www.youtube.com/embed/${id}`;
  return url;
}

// Helper: Get Thumbnail
function getThumbnail(url) {
  let id = '';
  if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
  else if (url.includes('v=')) id = url.split('v=')[1].split('&')[0];
  
  if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return "https://placehold.co/1920x1080/000000/FFF?text=Thumbnail";
}

let addedCount = 0;

newItems.forEach(item => {
  const normUrl = normalizeUrl(item.url);
  
  // Check for duplicates within Nonprofits
  const exists = videos.some(v => 
    v.category === 'Nonprofits' && 
    (normalizeUrl(v.videoUrl) === normUrl || v.title === item.title)
  );

  if (!exists) {
    videos.push({
      title: item.title,
      description: item.title,
      thumbnail: getThumbnail(item.url),
      videoUrl: normUrl,
      uploadDate: new Date().toISOString(),
      duration: "",
      category: "Nonprofits",
      hostedOn: "youtube"
    });
    addedCount++;
  } else {
    console.log(`Skipping duplicate in Nonprofits: ${item.title}`);
  }
});

fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
console.log(`Added ${addedCount} new videos to Nonprofits.`);
