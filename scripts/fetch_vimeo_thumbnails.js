const fs = require('fs');
const path = require('path');
const https = require('https');

const videosPath = path.join(__dirname, '../src/data/videos.json');
const videos = require(videosPath);

async function fetchVimeoThumbnail(url) {
  return new Promise((resolve) => {
    // Clean URL for oEmbed (remove params like ?share=copy)
    const cleanUrl = url.split('?')[0].replace('player.vimeo.com/video', 'vimeo.com');
    const apiUrl = `https://vimeo.com/api/oembed.json?url=${cleanUrl}`;

    https.get(apiUrl, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.thumbnail_url);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  let changed = false;
  
  for (const v of videos) {
    if (v.hostedOn === 'vimeo' && v.thumbnail.includes('placehold.co')) {
      console.log(`Fetching Vimeo for: ${v.title}...`);
      const thumb = await fetchVimeoThumbnail(v.videoUrl);
      if (thumb) {
        v.thumbnail = thumb;
        changed = true;
        console.log(`  -> Found: ${thumb}`);
      } else {
        console.log(`  -> Failed`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(videosPath, JSON.stringify(videos, null, 2));
    console.log('Updated videos.json with Vimeo thumbnails.');
  } else {
    console.log('No Vimeo thumbnails updated.');
  }
}

run();
