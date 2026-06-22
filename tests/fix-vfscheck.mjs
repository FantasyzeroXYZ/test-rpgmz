import { readFileSync, writeFileSync } from 'fs';
let c = readFileSync('public/sandbox.js', 'utf8');

const marker = 'VFS-CHECK#';
const idx = c.indexOf(marker);
if (idx < 0) { console.log('NOT FOUND'); process.exit(1); }

const fnStart = c.lastIndexOf('(function _vfsCheck', idx);
const fnEnd = c.indexOf('})(0);', fnStart) + 6;

const newFn = `(function _vfsCheck(n){
    var v=getVfs();
    console.log('[VFS-CHECK#'+n+'] vfs='+!!v+' parent='+!!(window.parent&&window.parent!==window)+' ref='+!!(window.parent&&window.parent.__vfsRef)+' init='+(window.parent&&window.parent.__vfsRef&&window.parent.__vfsRef._initialized));
    if(v){console.log('[VFS-CHECK#'+n+'] basePath='+(v._basePath||'(root)')+' pixi='+v.fileExists('js/libs/pixi.js')+' main='+v.fileExists('js/main.js')+' eff='+v.fileExists('js/libs/effekseer.min.js'));}
    else if(n<10){setTimeout(function(){_vfsCheck(n+1);},500);}
})(0);`;

c = c.substring(0, fnStart) + newFn + c.substring(fnEnd);
writeFileSync('public/sandbox.js', c, 'utf8');
console.log('PATCHED');
