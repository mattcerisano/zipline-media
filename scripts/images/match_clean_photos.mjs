import fs from 'fs';
import path from 'path';

const INVENTORY_PATH = 'src/data/inventory.ts';
const SOURCE_DIR = 'Gear Photos';
const DEST_DIR = 'public/gear';

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

function tokenize(str) {
  // Normalize and split
  let cleaned = str.replace(/\.(jpg|png|webp|jpeg)$/i, '')
                   .replace(/^\d+x\s+/, '') // remove "2x "
                   .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // accents

  // Split numbers/letters e.g. "rs2" -> "rs 2"
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
        // Partial match bonus
        for (const nameToken of nameTokens) {
            if (nameToken.includes(token) || token.includes(nameToken)) {
                if (token.length > 2 && nameToken.length > 2) {
                    matchCount += 0.8;
                    break;
                }
            }
        }
    }
  }
  return matchCount / Math.max(nameTokens.size, fileTokens.size); // Jaccard-ish index
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
    const match = line.match(/\{name:\s*"(.*?)",\s*category:/);
    if (match) {
      inventoryItems.push({ name: match[1], lineIndex: index, tokens: tokenize(match[1]) });
    }
  });

  const sourceFiles = fs.readdirSync(SOURCE_DIR).filter(f => !f.startsWith('.'));
  console.log(`📂 Found ${sourceFiles.length} source files.`);

  let matchesFound = 0;

  // We loop through INVENTORY items this time to find the best file for each
  // This ensures every item gets a chance to find a photo
  for (const item of inventoryItems) {
    let bestFile = null;
    let highestScore = 0;

    for (const file of sourceFiles) {
        const fileTokens = tokenize(file);
        const score = calculateSimilarity(item.tokens, fileTokens);
        
        if (score > 0.35 && score > highestScore) { // Slightly lower threshold to catch more
            highestScore = score;
            bestFile = file;
        }
    }

    if (bestFile) {
        matchesFound++;
        console.log(`✅ MATCH (${(highestScore*100).toFixed(0)}%): "${item.name}" <- "${bestFile}"`);
        
        // Create uniform filename based on ITEM NAME (not source file)
        const ext = path.extname(bestFile);
        const newFilename = `${safeSlug(item.name)}${ext}`;
        const sourcePath = path.join(SOURCE_DIR, bestFile);
        const destPath = path.join(DEST_DIR, newFilename);
        const localLink = `/gear/${newFilename}`;

        // Copy matching file to new canonical name
        fs.copyFileSync(sourcePath, destPath);

        // Update inventory
        let line = lines[item.lineIndex];
        if (line.includes('image:')) {
            lines[item.lineIndex] = line.replace(/image:\s*".*?"/, `image: "${localLink}"`);
        } else {
            lines[item.lineIndex] = line.replace('}', `, image: "${localLink}"}`);
        }
    } else {
        console.log(`❌ No match for: "${item.name}"`);
    }
  }

  console.log(`\n💾 Updating inventory.ts (${matchesFound} matches)...`);
  fs.writeFileSync(INVENTORY_PATH, lines.join('\n'));
}

main();
