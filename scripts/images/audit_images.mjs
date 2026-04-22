import fs from 'fs';
import path from 'path';

const INVENTORY_PATH = 'src/data/inventory.ts';
const PUBLIC_DIR = 'public';

function safeSlug(str) {
  return str.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

console.log('🔍 Auditing Inventory Images...');

let content = fs.readFileSync(INVENTORY_PATH, 'utf8');
const lines = content.split('\n');

let missingCount = 0;
let emptyCount = 0;
let mismatchCount = 0;
let totalItems = 0;

const items = [];

// Parse inventory manually to avoid needing TS compilation
lines.forEach(line => {
  const match = line.match(/\{name:\s*['"](.*?)['"],\s*category:/);
  if (match) {
    totalItems++;
    const name = match[1];
    const imageMatch = line.match(/image:\s*['"](.*?)['"]/);
    
    if (imageMatch) {
      const imagePath = imageMatch[1];
      const fullPath = path.join(PUBLIC_DIR, imagePath);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`❌ MISSING FILE: "${name}" -> ${imagePath}`);
        missingCount++;
      } else {
        const stats = fs.statSync(fullPath);
        if (stats.size === 0) {
          console.log(`⚠️ EMPTY FILE (0 bytes): "${name}" -> ${imagePath}`);
          emptyCount++;
        }
        
        // Heuristic check for mismatches
        // e.g. Name contains "FX6" but filename contains "FX3"
        const filename = path.basename(imagePath).toLowerCase();
        const lowerName = name.toLowerCase();
        
        // Specific checks for common confusions
        if (lowerName.includes('fx6') && filename.includes('fx3')) {
             console.log(`❓ MISMATCH WARNING: "${name}" -> ${filename}`);
             mismatchCount++;
        }
        if (lowerName.includes('fx3') && filename.includes('fx6')) {
             console.log(`❓ MISMATCH WARNING: "${name}" -> ${filename}`);
             mismatchCount++;
        }
        if (lowerName.includes('rs 2') && filename.includes('rs_3')) {
             console.log(`❓ MISMATCH WARNING: "${name}" -> ${filename}`);
             mismatchCount++;
        }
      }
    } else {
      console.log(`⚪ NO IMAGE LINKED: "${name}"`);
      // missingCount++; // Optional: count items with no link as missing?
    }
  }
});

console.log(`\n--- SUMMARY ---`);
console.log(`Total Items: ${totalItems}`);
console.log(`Missing Files: ${missingCount}`);
console.log(`Empty Files: ${emptyCount}`);
console.log(`Potential Mismatches: ${mismatchCount}`);
