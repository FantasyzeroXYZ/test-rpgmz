import { readFileSync, writeFileSync } from 'fs';

const lines = readFileSync('test-rpgmz-main/test-rpgmz-main/index.html', 'utf8').split('\n');
const slines = lines.slice(2195, 2691);
let last = slines[slines.length - 1];
if (last.includes('`);')) slines[slines.length - 1] = last.split('`);')[0];
let sandbox = slines.join('\n');

// Fix template-literal escaping for raw JS:
// In template: \\/ → output: /   (we need \/ in raw JS = keep \\/)
// Wait: template \\/ → template engine processes \\ → \, then / → /
//       Output is: \/ (backslash+forward slash)
//       Raw JS: need \/ which is exactly what the template outputs!
//
// Actually: the raw JS file should contain what the TEMPLATE OUTPUT would be.
// Template input: \\/   Template output: \/
// So raw JS should have: \/   (which is what template produced)
//
// But the EXTRACTED content has \\/ (the template INPUT, not output).
// We need to convert template INPUT to OUTPUT.
//
// Template rules:
//   \\\\ → \\  (escaped backslash, used in path.replace(/\\\\/g))
//   \\/  → \/  (non-special escape, backslash dropped, so \/ becomes /)
//             Wait: \/ in template: \ is escape, / is literal.
//             Since / is not a special escape character, \ is just dropped.
//             So \/ in template → / in output.
//   \`   → `   (escaped backtick)
//   \$   → $   (escaped dollar, when not ${)

let count = 0;

// Fix: \\\\ → \\  (4 backslashes → 2 backslashes in output)
// In the extract: \\\\\\\\ (8 backslashes) → template output: \\\\ (4 backslashes)
// In raw JS we need: \\\\ (4 chars) for regex pattern \\ which matches backslash
// Actually, path.replace(/\\\\/g,'/') in template:
//   template input: \\\\\\\\ → template output: \\\\
//   raw JS regex: /\\\\/ → matches \\
// So we need: \\\\\\\\ → \\\\ (remove half the backslashes)
// But this affects ALL occurrences including non-regex ones...
// Let me just fix the specific patterns.

// Pattern 1: In normalizePath regex: :\\/\\/  should become :\/\/
// Template input: :\\\\/\\\\/ → output: :\/\/
// Raw JS needs: :\/\/
// So: \\\\/\\\\/ → \\/\\/ (remove one backslash from each pair)
sandbox = sandbox.replace(/:\\\\\/\\\\\//g, ':\\/\\/');
count++;

// Pattern 2: [^\\\\/]+ should become [^\/]+
sandbox = sandbox.replace(/\[\^\\\\\/\]+/g, '[^\\/]+');
count++;

// Pattern 3: +\\\\/(  should become +\\/(
sandbox = sandbox.replace(/\+\\\\\/\(/g, '+\\/(');
count++;

// Pattern 4: /\\\\/g (in path.replace) should stay as /\\\\/g
// Because in template: /\\\\\\\\/g → output: /\\\\/g
// In raw JS: /\\\\/g matches backslash → SAME! No change needed.

// Pattern 5: \\`  (escaped backtick) → `
// These are rare, just fix any occurrences
const btCount = (sandbox.match(/\\\\`/g)||[]).length;
sandbox = sandbox.replace(/\\\\`/g, '`');
count += btCount;

// Pattern 6: \\$ → $
const dsCount = (sandbox.match(/\\\\\$/g)||[]).length;
sandbox = sandbox.replace(/\\\\\$/g, '$');
count += dsCount;

// Add normalizePath trailing slash fix
sandbox = sandbox.replace(
  "path=segs.join('/');",
  "path=segs.join('/');if(path.charAt(0)==='/')path=path.substring(1);"
);

writeFileSync('public/sandbox.js', sandbox);
console.log(`Wrote ${sandbox.length} chars, ${count} fixes`);
