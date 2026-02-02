import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { image_search } from 'duckduckgo-images-api';

const streamPipeline = promisify(pipeline);
const INVENTORY_PATH = 'src/data/inventory.ts';
const IMAGE_DIR = 'public/gear';

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
    // Relaxed regex to handle spacing: {name:"...", category:...}
    const lineMatch = line.match(/\{name:\s*\"(.*?)\",\s*category:/);
    
    if (lineMatch) {
      const name = lineMatch[1];
      
      if (line.includes('image:')) {
        // console.log(`Skipping ${name} (already has image)`);
      } else {
        console.log(`Processing: ${name}`);
        const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `${safeName}.jpg`;
        const localPath = `/gear/${filename}`;
        const fullPath = path.join(IMAGE_DIR, filename);

        // Skip if file already exists locally but not in inventory text
        if (fs.existsSync(fullPath)) {
          console.log(`   ✨ Image exists locally for: ${name}`);
          line = line.replace('}', `, image: "${localPath}"}`);
          changesMade = true;
        } else {
          console.log(`   🔍 Searching DDG for: ${name}...`);
          
          try {
            const query = `${name} product photo white background`;
            const results = await image_search({
              query,
              moderate: true,
              iterations: 1
            });

            if (results && results.length > 0) {
              let downloaded = false;
              // Try top 3 results
              for (const result of results.slice(0, 3)) {
                const imageUrl = result.image;
                console.log(`      ⬇️  Trying: ${imageUrl}`);
                
                downloaded = await downloadImage(imageUrl, fullPath);
                if (downloaded) {
                  console.log(`      ✅ Saved to ${localPath}`);
                  line = line.replace('}', `, image: "${localPath}"}`);
                  changesMade = true;
                  break;
                }
              }

              if (!downloaded) {
                console.log(`      ⚠️ Could not download any images for ${name}`);
              }
              
              await sleep(2000); // Be respectful to the API
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