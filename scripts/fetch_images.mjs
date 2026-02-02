import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const streamPipeline = promisify(pipeline);

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;
const INVENTORY_PATH = 'src/data/inventory.ts';
const IMAGE_DIR = 'public/gear';

if (!GOOGLE_API_KEY || !GOOGLE_CX) {
  console.error('❌ Error: Missing Environment Variables.');
  console.error('Please run with: GOOGLE_API_KEY=... GOOGLE_CX=... node scripts/fetch_images.mjs');
  process.exit(1);
}

// Helper to wait (avoid rate limits)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('📦 Reading Inventory...');
  let content = fs.readFileSync(INVENTORY_PATH, 'utf8');
  
  // Regex to find the inventory array
  // We match the whole object to parse it loosely
  const itemRegex = /\{name:\"(.*?)\", category:\"(.*?)\", qty:(\d+), replacement:(\d+)(?:, image: \"(.*?)\")?\}/g;
  
  let match;
  let items = [];
  let changesMade = false;

  // We have to build a new content string manually to preserve formatting
  // simpler approach: split file by lines, find lines with gear, process them.
  
  const lines = content.split('\n');
  const newLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Check if this line is an inventory item
    // Matches: {name:"...", category:"...", ...}
    const lineMatch = line.match(/\{name:\"(.*?)\", category:.*?\}/);
    
    if (lineMatch && !line.includes('image:')) {
      const name = lineMatch[1];
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeName}.jpg`;
      const localPath = `/gear/${filename}`;
      const fullPath = path.join(IMAGE_DIR, filename);

      // Check if we already have the file locally (skip download if so)
      if (fs.existsSync(fullPath)) {
        console.log(`✨ Image exists for: ${name}`);
        // Add image field to line
        line = line.replace('}', `, image: "${localPath}"}`);
        changesMade = true;
      } else {
        console.log(`🔍 Searching for: ${name}...`);
        
        try {
          // 1. Search Google - Restrict to B&H for better results and to bypass general search restrictions
          const query = `${name}`;
          const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&searchType=image&num=1&safe=active&siteSearch=bhphotovideo.com&siteSearchFilter=i`;
          
          const res = await fetch(searchUrl);
          const data = await res.json();

          if (data.items && data.items.length > 0) {
            const imageUrl = data.items[0].link;
            console.log(`   ⬇️ Downloading: ${imageUrl}`);
            
            // 2. Download Image
            const imgRes = await fetch(imageUrl);
            if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.statusText}`);
            
            const fileStream = fs.createWriteStream(fullPath);
            await streamPipeline(imgRes.body, fileStream);
            
            console.log(`   ✅ Saved to ${localPath}`);
            
            // 3. Update Line
            line = line.replace('}', `, image: "${localPath}"}`);
            changesMade = true;
            
            // Be nice to the API
            await sleep(1000); 
          } else {
            console.log(`   ⚠️ No results found for ${name}`);
          }
        } catch (err) {
          console.error(`   ❌ Error processing ${name}:`, err.message);
        }
      }
    }
    newLines.push(line);
  }

  if (changesMade) {
    console.log('💾 Writing updates to inventory.ts...');
    fs.writeFileSync(INVENTORY_PATH, newLines.join('\n'));
    console.log('🎉 Done!');
  } else {
    console.log('No changes needed.');
  }
}

main();
