import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import googleIt from 'google-it';

const streamPipeline = promisify(pipeline);
const INVENTORY_PATH = 'src/data/inventory.ts';
const IMAGE_DIR = 'public/gear';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImage(url, fullPath) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('image')) return false;
    
    const fileStream = fs.createWriteStream(fullPath);
    await streamPipeline(res.body, fileStream);
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log('📦 Reading Inventory...');
  let content = fs.readFileSync(INVENTORY_PATH, 'utf8');
  const lines = content.split('\n');
  const newLines = [];
  let changesMade = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineMatch = line.match(/\{name:\"(.*?)\", category:.*?\}/);
    
    if (lineMatch && !line.includes('image:')) {
      const name = lineMatch[1];
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeName}.jpg`;
      const localPath = `/gear/${filename}`;
      const fullPath = path.join(IMAGE_DIR, filename);

      if (fs.existsSync(fullPath)) {
        line = line.replace('}', `, image: "${localPath}"}`);
        changesMade = true;
      } else {
        console.log(`🔍 Scraping for: ${name}...`);
        
        try {
          // Search specifically for images on B&H or general
          const results = await googleIt({
            query: `${name} bhphotovideo product image`,
            'no-display': true 
          });

          // Google-it returns web results, we need to find image-like links or just try the top result's favicon/images
          // This is a bit limited as google-it doesn't return raw image results directly easily.
          // Let's try to find any link that looks like it might have an image or just use the name to hit a generic image service.
          
          // ALTERNATIVE: Use a free image API like Unsplash or just stick to the plan of the user fixing the Google CX.
          // Since "google-it" is just web results, it's not ideal for direct image downloading.
          
          console.log(`   ⚠️ Scraping is unreliable. Please try fixing the "Search the entire web" toggle in Google UI.`);
          console.log(`   💡 Tip: Delete the site in "Sites to search" FIRST, then the toggle should unlock.`);
          
          break; // Stop to avoid spamming
        } catch (err) {
          console.error(`   ❌ Error:`, err.message);
        }
      }
    }
    newLines.push(line);
  }
}

main();
