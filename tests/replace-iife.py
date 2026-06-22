import re

with open('tests/orig_sandbox.txt', 'r', encoding='utf-8') as f:
    sandbox = f.read()

sandbox = sandbox.rstrip()
if sandbox.endswith('`);'):
    sandbox = sandbox[:-3]
if sandbox.endswith('\n`);'):
    sandbox = sandbox[:-4]

# Escape for template literal
escaped = sandbox.replace('\\', '\\\\')
escaped = escaped.replace('`', '\\`')

# Build replacement
replacement = 'function buildSandboxIIFE(): string {\n'
replacement += '  return `' + escaped + '`;\n'
replacement += '}\n'

with open('src/services/emulatorBridge.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find lines between "function buildSandboxIIFE" and the closing "};"
start = None
end = None
for i, line in enumerate(lines):
    if 'function buildSandboxIIFE(): string {' in line:
        start = i
    if start is not None and i > start and ('</script>`;' in line or '<\\/script>`;' in line):
        end = i + 1
        break

if start and end:
    new_lines = lines[:start] + [replacement] + lines[end:]
    with open('src/services/emulatorBridge.ts', 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print(f'OK: replaced lines {start+1}-{end}')
else:
    print(f'NOT FOUND start={start} end={end}')
