import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function removeDuplicates() {
  console.log('Fetching all inventory items...');
  const { data, error } = await supabase.from('inventory').select('id, name');
  
  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  const seenNames = new Set();
  const idsToDelete = [];

  for (const item of data) {
    if (seenNames.has(item.name)) {
      idsToDelete.push(item.id);
    } else {
      seenNames.add(item.name);
    }
  }

  console.log(`Found ${idsToDelete.length} duplicates to delete.`);

  if (idsToDelete.length > 0) {
    // Delete in batches of 50 to avoid any limits
    for (let i = 0; i < idsToDelete.length; i += 50) {
      const batch = idsToDelete.slice(i, i + 50);
      const { error: deleteError } = await supabase
        .from('inventory')
        .delete()
        .in('id', batch);
        
      if (deleteError) {
        console.error('Error deleting batch:', deleteError);
      } else {
        console.log(`Deleted batch of ${batch.length} items.`);
      }
    }
    console.log('Finished removing duplicates.');
  }
}

removeDuplicates();
