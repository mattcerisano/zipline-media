import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ROLE_MAPPINGS = {
  // Existing common ones to keep standard
  'Editor': 'Editor',
  'Producer': 'Producer',
  'Director of Photography': 'Director of Photography',
  'Camera Operator': 'Camera Operator',
  'Gaffer': 'Gaffer',
  'Production Assistant': 'Production Assistant',

  // Variations to map to standard roles
  'Dir. of Photography': 'Director of Photography',
  'DP': 'Director of Photography',
  'Cam Op': 'Camera Operator',
  'Producer / Cam Op': 'Producer',
  'Steadicam / Camp Op': 'Camera Operator',
  'AC': '1st AC',
  'AC / Camera Swing': '1st AC',
  'Video Playback': 'Production Assistant', // Or custom if needed
  'Playback Assistant / Camera Swing': 'Production Assistant',
  'PA': 'Production Assistant',
  'Grip': 'Grip',
  'Key Grip': 'Key Grip',
  'Audio': 'Audio Mixer',
  'Sound': 'Audio Mixer',
  'Creative Director': 'Creative Director',
  'Swiss Army/Looking to Learn More': 'Production Assistant',
};

async function standardizeRoles() {
  console.log('Fetching contacts...');
  const { data: contacts, error } = await supabase.from('contacts').select('id, name, primary_role');
  
  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  let updatedCount = 0;

  for (const contact of contacts) {
    if (contact.primary_role) {
      let currentRole = contact.primary_role.trim();
      let newRole = null;

      // Check if it exactly matches a mapping key
      if (ROLE_MAPPINGS[currentRole]) {
         newRole = ROLE_MAPPINGS[currentRole];
      } else {
         // Fuzzy matching
         if (currentRole.toLowerCase().includes('editor')) newRole = 'Editor';
         else if (currentRole.toLowerCase().includes('dp') || currentRole.toLowerCase().includes('photography')) newRole = 'Director of Photography';
         else if (currentRole.toLowerCase().includes('cam op') || currentRole.toLowerCase().includes('camera')) newRole = 'Camera Operator';
         else if (currentRole.toLowerCase().includes('pa') || currentRole.toLowerCase().includes('assistant')) newRole = 'Production Assistant';
         else if (currentRole.toLowerCase().includes('audio') || currentRole.toLowerCase().includes('sound')) newRole = 'Audio Mixer';
         else if (currentRole.toLowerCase().includes('gaffer')) newRole = 'Gaffer';
         else if (currentRole.toLowerCase().includes('grip')) newRole = 'Grip';
         else if (currentRole.toLowerCase().includes('producer')) newRole = 'Producer';
         else if (currentRole.toLowerCase().includes('color')) newRole = 'Colorist';
      }

      if (newRole && newRole !== contact.primary_role) {
         console.log(`Updating ${contact.name}: ${contact.primary_role} -> ${newRole}`);
         const { error: updateError } = await supabase
           .from('contacts')
           .update({ primary_role: newRole })
           .eq('id', contact.id);
         
         if (updateError) {
           console.error(`Failed to update ${contact.name}:`, updateError);
         } else {
           updatedCount++;
         }
      }
    }
  }

  console.log(`Standardization complete. Updated ${updatedCount} contacts.`);
}

standardizeRoles();