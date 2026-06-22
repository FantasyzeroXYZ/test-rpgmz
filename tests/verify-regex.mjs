import http from 'http';
http.get('http://127.0.0.1:3000/src/services/emulatorBridge.ts', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    const m = d.match(/return `([\s\S]*?)`;?\s*\}/);
    if (!m) { console.log('Cannot find IIFE'); process.exit(1); }
    const js = m[1];
    const regexes = js.match(/\/[^/\n]+\/[gimsuy]*/g) || [];
    console.log('Regex literals found:', regexes.length);
    let problems = 0;
    for (const r of regexes) {
      if (r.includes('//') && !r.includes('https:')) {
        console.log('PROBLEM:', r.slice(0,80));
        problems++;
      }
    }
    console.log(problems === 0 ? 'All regex OK - no // issue' : `Found ${problems} problematic regexes`);
    process.exit(problems === 0 ? 0 : 1);
  });
}).on('error', e => { console.error(e); process.exit(1); });
