import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrate() {
  const inventoryPath = join(__dirname, '../../src/data/inventory.ts');
  const content = fs.readFileSync(inventoryPath, 'utf-8');
  
  // Extract just the INVENTORY array definition
  const startMarker = 'export const INVENTORY: InventoryItem[] = [';
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.lastIndexOf(']');
  
  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find INVENTORY bounds');
    return;
  }
  
  const arrayContent = content.substring(startIdx + startMarker.length - 1, endIdx + 1);
  
  // Create a temporary .mjs file that exports this data
  const tempFilePath = join(__dirname, 'temp_inventory.mjs');
  fs.writeFileSync(tempFilePath, `export const inventory = ${arrayContent};`);
  
  try {
    const { inventory } = await import('./temp_inventory.mjs');
    console.log(`Successfully imported ${inventory.length} items.`);
    
    const { data, error } = await supabase
      .from('inventory')
      .insert(inventory);

    if (error) {
      console.error('Migration error:', error);
    } else {
      console.log('Successfully migrated inventory data!');
    }
  } catch (e) {
    console.error('Error during migration:', e);
  } finally {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
  }
}

migrate();
