import fs from 'fs';
import path from 'path';

const INVENTORY_PATH = 'src/data/inventory.ts';
const SOURCE_DIR = '/Users/mattcerisano/Downloads/Gear Photos';
const DEST_DIR = 'public/gear';

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

function safeSlug(str) {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Tokenize a string into a set of unique lowercase words, filtering out noise
function tokenize(str) {
  // Remove "2x", "10x", etc. prefixes
  const cleaned = str.replace(/^\d+x\s+/, '').replace(/\.(jpg|png|webp|jpeg)$/i, '');
  
  return new Set(
    cleaned.toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter(w => w.length > 2 && !['for', 'with', 'and', 'the', 'kit', 'set'].includes(w))
  );
}

// Calculate similarity score (0 to 1) based on shared tokens
function calculateSimilarity(nameTokens, fileTokens) {
  if (nameTokens.size === 0 || fileTokens.size === 0) return 0;
  
  let matchCount = 0;
  for (const token of nameTokens) {
    if (fileTokens.has(token)) matchCount++;
  }
  
  return matchCount / Math.max(nameTokens.size, fileTokens.size);
}

async function main() {
  console.log('📦 Reading Inventory...');
  let content = fs.readFileSync(INVENTORY_PATH, 'utf8');
  
  // Get list of source files
  const sourceFiles = fs.readdirSync(SOURCE_DIR).filter(f => !f.startsWith('.'));
  console.log(`📂 Found ${sourceFiles.length} files in source directory.`);

  const lines = content.split('\n');
  const newLines = [];
  let changesMade = false;
  let matchesFound = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const lineMatch = line.match(/\{name:\s*"(.*?)",\s*category:/);
    
    if (lineMatch) {
      const name = lineMatch[1];
      const nameTokens = tokenize(name);
      
      let bestMatch = null;
      let highestScore = 0;

      for (const file of sourceFiles) {
        const fileTokens = tokenize(file);
        const score = calculateSimilarity(nameTokens, fileTokens);
        
        // Threshold: e.g., 0.4 means roughly 40% of unique words match
        // Adjust threshold as needed. 0.4 is fairly loose but safer than 0.
        if (score > 0.4 && score > highestScore) {
          highestScore = score;
          bestMatch = file;
        }
      }

      if (bestMatch) {
        matchesFound++;
        console.log(`✅ MATCH (${(highestScore*100).toFixed(0)}%): "${name}"  <-->  "${bestMatch}"`);
        
        const ext = path.extname(bestMatch);
        const newFilename = `${safeSlug(name)}${ext}`;
        const sourcePath = path.join(SOURCE_DIR, bestMatch);
        const destPath = path.join(DEST_DIR, newFilename);
        const localLink = `/gear/${newFilename}`;

        fs.copyFileSync(sourcePath, destPath);

        if (line.includes('image:')) {
            line = line.replace(/image:\s*".*?"/, `image: "${localLink}"`);
        } else {
            line = line.replace('}', `, image: "${localLink}"}`);
        }
        changesMade = true;
      } else {
        // console.log(`❌ No match for: "${name}"`);
      }
    }
    newLines.push(line);
  }

  if (changesMade) {
    console.log(`\n💾 Updating inventory.ts (${matchesFound} matches applied)...`);
    fs.writeFileSync(INVENTORY_PATH, newLines.join('\n'));
  }
}

main();