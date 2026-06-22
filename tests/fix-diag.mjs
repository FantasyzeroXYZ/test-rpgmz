import { readFileSync, writeFileSync } from 'fs';
let c = readFileSync('public/sandbox.js', 'utf8');

// Find and replace the VFS check line
const oldLine = `\tsetTimeout(function(){var v=getVfs();if(v){console.log('[VFS] pixi.js exists='+v.fileExists('js/libs/pixi.js')+' size='+(v.readRawFile('js/libs/pixi.js')||[]).length+' basePath='+v._basePath);}},2000);`;

const newLines = `\t(function _vfsCheck(n){
\t\tvar v=getVfs();
\t\tif(v){console.log('[VFS-CHECK#'+n+'] basePath='+(v._basePath||'(root)')+' pixi='+v.fileExists('js/libs/pixi.js')+' main='+v.fileExists('js/main.js')+' eff='+v.fileExists('js/libs/effekseer.min.js'));}
\t\telse if(n<10){setTimeout(function(){_vfsCheck(n+1);},500);}
\t})(0);`;

if (c.includes(oldLine)) {
    c = c.replace(oldLine, newLines);
} else {
    // Try tab variant
    const oldLineTab = oldLine.replace(/\t/g, '        ');
    if (c.includes(oldLineTab)) {
        c = c.replace(oldLineTab, newLines.replace(/\t/g, '        '));
    } else {
        // Find by pattern
        const idx = c.indexOf('pixi.js exists=');
        if (idx > 0) {
            const start = c.lastIndexOf('\n', idx) + 1;
            const end = c.indexOf('\n', idx);
            const found = c.substring(start, end);
            console.log('FOUND:', JSON.stringify(found));
            c = c.substring(0, start) + newLines + c.substring(end);
            console.log('REPLACED by position');
        } else {
            console.log('NOT FOUND');
            process.exit(1);
        }
    }
}

writeFileSync('public/sandbox.js', c, 'utf8');
console.log('OK');
