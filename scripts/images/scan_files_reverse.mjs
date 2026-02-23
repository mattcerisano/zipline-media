import fs from 'fs';
import path from 'path';

const INVENTORY_PATH = 'src/data/inventory.ts';
const SOURCE_DIR = 'Gear Photos'; // Relative to project root
const DEST_DIR = 'public/gear';

function tokenize(str) {
  let cleaned = str.replace(/\.(jpg|png|webp|jpeg)$/i, '')
                   .replace(/^\d+x\s+/, '')
                   .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Split numbers/letters
  cleaned = cleaned.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  cleaned = cleaned.replace(/(\d)([a-zA-Z])/g, '$1 $2');

  return new Set(
    cleaned.toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(w => w.length > 1 && !['for', 'with', 'and', 'the', 'kit', 'set', 'black'].includes(w))
  );
}

function calculateSimilarity(nameTokens, fileTokens) {
  if (nameTokens.size === 0 || fileTokens.size === 0) return 0;
  let matchCount = 0;
  for (const token of fileTokens) {
    if (nameTokens.has(token)) {
      matchCount++;
    } else {
        for (const nameToken of nameTokens) {
            if ((nameToken.includes(token) || token.includes(nameToken)) && token.length > 2) {
                matchCount += 0.8;
                break;
            }
        }
    }
  }
  return matchCount / fileTokens.size; // Similarity based on FILE tokens coverage
}

function safeSlug(str) {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

async function main() {
  console.log('📦 Reading Inventory...');
  let content = fs.readFileSync(INVENTORY_PATH, 'utf8');
  const lines = content.split('\n');
  const inventoryItems = [];
  
  lines.forEach((line, index) => {
    const match = line.match(/\{name:\s*\"(.*?)\",\s*category:/);
    if (match) {
      inventoryItems.push({ name: match[1], lineIndex: index, tokens: tokenize(match[1]) });
    }
  });

  const sourceFiles = fs.readdirSync(SOURCE_DIR).filter(f => !f.startsWith('.'));
  console.log(`📂 Scanning ${sourceFiles.length} source files...`);

  let matchesMade = 0;
  let filesUnused = [];

  for (const file of sourceFiles) {
    const fileTokens = tokenize(file);
    let bestItem = null;
    let highestScore = 0;

    for (const item of inventoryItems) {
      const score = calculateSimilarity(item.tokens, fileTokens);
      // Relaxed threshold
      if (score > 0.3 && score > highestScore) {
        highestScore = score;
        bestItem = item;
      }
    }

    if (bestItem) {
      matchesMade++;
      console.log(`✅ FILE: "${file}" matched to ITEM: "${bestItem.name}" (${(highestScore*100).toFixed(0)}%)`);
      
      // Update File
      const ext = path.extname(file);
      const newFilename = `${safeSlug(bestItem.name)}${ext}`;
      const sourcePath = path.join(SOURCE_DIR, file);
      const destPath = path.join(DEST_DIR, newFilename);
      const localLink = `/gear/${newFilename}`;
      
      fs.copyFileSync(sourcePath, destPath);

      // Update Inventory
      let line = lines[bestItem.lineIndex];
      // Always update if found, to ensure we catch everything
      if (line.includes('image:')) {
          lines[bestItem.lineIndex] = line.replace(/image:\s*".*?"/, `image: "${localLink}"`);
      } else {
          lines[bestItem.lineIndex] = line.replace('}', `, image: "${localLink}"}`);
      }

    } else {
      filesUnused.push(file);
    }
  }

  console.log(`\n💾 Updating inventory.ts...`);
  fs.writeFileSync(INVENTORY_PATH, lines.join('\n'));

  console.log(`\n--- SUMMARY ---`);
  console.log(`Matched: ${matchesMade} files`);
  console.log(`Unused: ${filesUnused.length} files`);
  if (filesUnused.length > 0) {
      console.log(`\n❌ THE FOLLOWING FILES DID NOT MATCH ANYTHING:`);
      filesUnused.forEach(f => console.log(`- ${f}`));
  }
}

main();
