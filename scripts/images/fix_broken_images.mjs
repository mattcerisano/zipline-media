import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import google from 'googlethis';

const streamPipeline = promisify(pipeline);
const INVENTORY_PATH = 'src/data/inventory.ts';
const IMAGE_DIR = 'public/gear'; // Relative to project root, adjust if running from inside

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function downloadImage(url, fullPath) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) return false;
    
    const fileStream = fs.createWriteStream(fullPath);
    await streamPipeline(res.body, fileStream);
    
    // Validate size
    const stats = fs.statSync(fullPath);
    if (stats.size === 0) {
        fs.unlinkSync(fullPath); // Delete empty file
        return false;
    }
    return true;
  } catch (e) {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    return false;
  }
}

async function main() {
  console.log('🚑 Fixing Broken/Missing Images...');
  let content = fs.readFileSync(INVENTORY_PATH, 'utf8');
  const lines = content.split('\n');
  const itemsToFix = [];

  // Identify broken items
  lines.forEach((line, index) => {
    const match = line.match(/\{name:\s*['"](.*?)['"],\s*category:/);
    if (match) {
        const name = match[1];
        const imageMatch = line.match(/image:\s*['"](.*?)['"]/);
        
        let needsFix = false;
        
        if (!imageMatch) {
            needsFix = true; // Missing link
        } else {
            const imagePath = imageMatch[1];
            const fullPath = path.join('public', imagePath);
            if (!fs.existsSync(fullPath)) {
                needsFix = true; // Missing file
            } else {
                const stats = fs.statSync(fullPath);
                if (stats.size === 0) needsFix = true; // Empty file
            }
        }

        if (needsFix) {
            itemsToFix.push({ name, lineIndex: index });
        }
    }
  });

  console.log(`📋 Found ${itemsToFix.length} items to fix.`);

  for (const item of itemsToFix) {
      console.log(`   🔧 Fixing: ${item.name}`);
      const safeName = item.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeName}.jpg`;
      const localPath = `/gear/${filename}`;
      const fullPath = path.join('public', 'gear', filename);

      try {
        // Try simplified query first
        let query = `${item.name} product photo`;
        let images = await google.image(query, { safe: false });
        
        let downloaded = false;
        
        if (images.length > 0) {
            for (const result of images.slice(0, 4)) {
                if (await downloadImage(result.url, fullPath)) {
                    downloaded = true;
                    console.log(`      ✅ Restored: ${localPath}`);
                    break;
                }
            }
        }

        // Update inventory line if successful
        if (downloaded) {
            let line = lines[item.lineIndex];
            if (line.includes('image:')) {
                lines[item.lineIndex] = line.replace(/image:\s*['"].*?['"]/, `image: '${localPath}'`);
            } else {
                lines[item.lineIndex] = line.replace('}', `, image: "${localPath}"}`);
            }
        } else {
            console.log(`      ⚠️ Failed to find valid image for: ${item.name}`);
        }

      } catch (err) {
          console.error(`      ❌ Error: ${err.message}`);
      }

      await sleep(3000); // Slow down to avoid blocks
  }

  console.log(`💾 Saving inventory updates...`);
  fs.writeFileSync(INVENTORY_PATH, lines.join('\n'));
}

main();
