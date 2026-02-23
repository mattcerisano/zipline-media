import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import google from 'googlethis';

const streamPipeline = promisify(pipeline);
const INVENTORY_PATH = 'src/data/inventory.ts';
const IMAGE_DIR = 'public/gear';
const FORCE_UPDATE = process.env.FORCE_UPDATE === 'true';

// Ensure image directory exists
if (!fs.existsSync(IMAGE_DIR)) {
  fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

// Helper to wait
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImage(url, fullPath) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) return false;
    
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
    // Regex matches lines like: {name:"Sony FX6", category:...}
    const lineMatch = line.match(/\{name:\s*\"(.*?)\",\s*category:/);
    
    if (lineMatch) {
      const name = lineMatch[1];
      const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeName}.jpg`;
      const localPath = `/gear/${filename}`;
      const fullPath = path.join(IMAGE_DIR, filename);
      
      const hasLocalImage = fs.existsSync(fullPath);
      const isLinked = line.includes('image:');

      // Process if:
      // 1. It's not linked in the file yet
      // 2. OR we are forcing an update (re-download)
      if (!isLinked || (FORCE_UPDATE && hasLocalImage)) {
        console.log(`Processing: ${name}`);

        // If image exists and we are NOT forcing update, just link it if missing
        if (hasLocalImage && !FORCE_UPDATE) {
           console.log(`   ✨ Image exists locally, checking link...`);
           if (!isLinked) {
             console.log(`   🔗 Linking existing image...`);
             line = line.replace('}', `, image: "${localPath}"}`);
             changesMade = true;
           }
        } else {
          console.log(`   🔍 Searching Google for: ${name}...`);
          
          try {
            // Refined Query: Manufacturer + Name + visual descriptors + exclusions
            const query = `${name} official product photo white background -text -logo -review -youtube`;
            const images = await google.image(query, { safe: false });

            if (images.length > 0) {
              let downloaded = false;
              // Try top 5 results this time to find a valid one
              for (const result of images.slice(0, 5)) {
                const imageUrl = result.url;
                
                // Simple filter: skip youtube/vimeo thumbnails often found in search
                if (imageUrl.includes('ytimg') || imageUrl.includes('vimeo')) continue;

                console.log(`      ⬇️  Trying: ${imageUrl}`);
                downloaded = await downloadImage(imageUrl, fullPath);
                
                if (downloaded) {
                  console.log(`      ✅ Saved to ${localPath}`);
                  if (!isLinked) {
                    line = line.replace('}', `, image: "${localPath}"}`);
                  }
                  changesMade = true;
                  break;
                }
              }

              if (!downloaded) {
                console.log(`      ⚠️ Could not download any images for ${name}`);
              }
              
              await sleep(2500); // Be respectful
            } else {
              console.log(`      ⚠️ No results found for ${name}`);
            }
          } catch (err) {
            console.error(`      ❌ Error:`, err.message);
          }
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