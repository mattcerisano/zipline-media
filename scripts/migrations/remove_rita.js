const fs = require('fs');
const path = require('path');
let videos = require('../src/data/videos.json');

const initialLength = videos.length;
// Remove the specific Rita Joseph video that matches the "broken" description
// Usually the older one or the one with the non-standard thumbnail URL format if multiple exist.
// Based on the user's recent "Add these" request, they wanted "Rita Joseph for City Council - Vision".
// So the other one "Rita Joseph for City Council" is likely the one to remove.
videos = videos.filter(v => !(v.title === "Rita Joseph for City Council" && v.videoUrl.includes('Vzpn1QFvF75')));

if (videos.length < initialLength) {
    fs.writeFileSync(path.join(__dirname, '../src/data/videos.json'), JSON.stringify(videos, null, 2));
    console.log('Removed broken Rita Joseph video.');
} else {
    console.log('Could not find the specific Rita Joseph video to remove.');
}
