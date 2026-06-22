import { readFileSync, writeFileSync } from 'fs';
let s = readFileSync('public/sandbox.js', 'utf8');

// Fix: [^\/]++\/  →  [^\/]+\/
const pattern = '[^\\\\/]++\\\\/';
const replacement = '[^\\\\/]+\\\\/';
if (s.includes(pattern)) {
  s = s.replace(pattern, replacement);
  console.log('Fixed ++ → +');
}

// Also fix path.replace(/\/g  →  path.replace(/\\/g
s = s.replace('replace(/\\/g,', 'replace(/\\\\/g,');

writeFileSync('public/sandbox.js', s);
console.log('Done');
