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
  const contactsPath = join(__dirname, '../../src/data/contacts.ts');
  const content = fs.readFileSync(contactsPath, 'utf-8');
  
  // Extract just the CONTACTS_DATA array definition
  const startMarker = 'export const CONTACTS_DATA = [';
  const startIdx = content.indexOf(startMarker);
  const endIdx = content.lastIndexOf(']');
  
  if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find CONTACTS_DATA bounds');
    return;
  }
  
  const arrayContent = content.substring(startIdx + startMarker.length - 1, endIdx + 1);
  
  // Create a temporary .mjs file that exports this data
  const tempFilePath = join(__dirname, 'temp_contacts.mjs');
  fs.writeFileSync(tempFilePath, `export const contacts = ${arrayContent};`);
  
  try {
    const { contacts } = await import('./temp_contacts.mjs');
    console.log(`Successfully imported ${contacts.length} items.`);
    
    // Transform contacts to remove slug-based IDs so Supabase can generate UUIDs
    const transformedContacts = contacts.map(({ id, ...rest }) => ({
      ...rest,
      // We could generate a UUID here or let Supabase do it by omitting 'id'
    }));
    
    const { data, error } = await supabase
      .from('contacts')
      .insert(transformedContacts);

    if (error) {
      console.error('Migration error:', error);
    } else {
      console.log('Successfully migrated contacts data!');
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
