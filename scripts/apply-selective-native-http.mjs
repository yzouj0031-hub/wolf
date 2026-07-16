import fs from 'node:fs';

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const wrongSupabaseUrl = 'https://hnlsmcucmbicygzjmfut.supabase.co';
const correctSupabaseUrl = 'https://hnlsmcucmbicygzjfmuf.supabase.co';
html = html.replaceAll(wrongSupabaseUrl, correctSupabaseUrl);

const marker = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.0/dist/umd/supabase.min.js"></script>';
const nativeHttpTag = '<script src="./native-http.js"></script>';
if (!html.includes(nativeHttpTag)) {
  if (!html.includes(marker)) throw new Error('Supabase script marker not found');
  html = html.replace(marker, marker + '\n' + nativeHttpTag);
}

if (!html.includes(correctSupabaseUrl)) throw new Error('Correct Supabase URL was not written');
if (html.includes(wrongSupabaseUrl)) throw new Error('Incorrect Supabase URL still exists');

fs.writeFileSync(file, html);
