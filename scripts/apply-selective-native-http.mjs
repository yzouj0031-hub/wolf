import fs from 'node:fs';

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const marker = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/dist/umd/supabase.min.js"></script>';
const addition = marker + '\n<script src="./native-http.js"></script>';

if (html.includes('<script src="./native-http.js"></script>')) {
  console.log('native-http.js already linked');
  process.exit(0);
}
if (!html.includes(marker)) throw new Error('Supabase script marker not found');
html = html.replace(marker, addition);
fs.writeFileSync(file, html);
