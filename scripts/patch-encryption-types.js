const fs = require('fs');
const path = process.argv[2];
let content = fs.readFileSync(path, 'utf8');

// Tables that were converted to views
const encTables = [
  'accounts', 'capture_tokens', 'destinatarios', 'email_ingest_addresses',
  'profiles', 'recurring_transaction_templates', 'statement_snapshots',
  'transactions', 'wishlist_items'
];

// For each _enc table, duplicate its entry as the original name in Tables
for (const name of encTables) {
  const encName = name + '_enc';
  
  // Find the _enc entry in Tables section - capture from "      <encName>: {" to the closing "      }"
  const encPattern = new RegExp(`(      ${encName}: \\{[\\s\\S]*?\\n      \\})`, 'm');
  const match = content.match(encPattern);
  if (!match) {
    console.error(`WARNING: Could not find ${encName} in Tables`);
    continue;
  }
  
  // Create a copy with the original name
  let copy = match[1].replace(new RegExp(encName, 'g'), name);
  
  // Fix referencedRelation values that point to _enc tables
  for (const t of encTables) {
    copy = copy.replace(new RegExp(`referencedRelation: "${t}_enc"`, 'g'), `referencedRelation: "${t}"`);
  }
  
  // Fix foreignKeyName values
  copy = copy.replace(/_enc_/g, '_');
  
  // Insert the copy after the _enc entry
  content = content.replace(match[1], match[1] + '\n' + copy);
}

// Remove view entries from Views section (replace with empty)
// Find Views section
const viewsStart = content.indexOf('    Views: {');
const viewsEnd = content.indexOf('\n    }', viewsStart + 10);
if (viewsStart !== -1 && viewsEnd !== -1) {
  content = content.substring(0, viewsStart) + '    Views: {\n      [_ in never]: never' + content.substring(viewsEnd);
}

fs.writeFileSync(path, content);
console.log('Types patched successfully');
