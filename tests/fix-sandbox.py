"""Fix sandbox.js: convert template-literal escaping to raw JS."""
with open('test-rpgmz-main/test-rpgmz-main/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

sandbox_lines = lines[2195:2691]
# Remove trailing template-literal artifacts from last line
last = sandbox_lines[-1]
# Find the actual end of the JS code (before template closing)
for marker in ['`);', '`;']:
    if marker in last:
        sandbox_lines[-1] = last[:last.index(marker)]
        break
sandbox = ''.join(sandbox_lines)

# Convert template-literal escapes to raw JS
result = []
i = 0
while i < len(sandbox):
    c = sandbox[i]
    if c == chr(92) and i + 1 < len(sandbox):  # backslash
        nxt = sandbox[i + 1]
        if nxt in (chr(92), chr(96), chr(36)):  # \\ → \, \` → `, \$ → $
            result.append(nxt)
            i += 2
        elif nxt == 'n':  # \n → newline
            result.append(chr(10))
            i += 2
        elif nxt == 't':  # \t → tab
            result.append(chr(9))
            i += 2
        elif nxt == 'r':  # \r → CR
            result.append(chr(13))
            i += 2
        elif nxt == chr(47) or nxt == chr(40) or nxt == chr(41):
            # \/ → /    \( → (    \) → )
            # These are non-special escapes: backslash is dropped
            result.append(nxt)
            i += 2
        else:
            result.append(c)
            result.append(nxt)
            i += 2
    else:
        result.append(c)
        i += 1

processed = ''.join(result)
# Also handle \n, \t, \r that weren't caught (literal 2-char sequences)
processed = processed.replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\r')

# Add normalizePath leading-slash fix
processed = processed.replace(
    "path=segs.join('/');",
    "path=segs.join('/');if(path.charAt(0)==='/')path=path.substring(1);"
)

with open('public/sandbox.js', 'w', encoding='utf-8') as f:
    f.write(processed)
print(f'Wrote {len(processed)} chars')
