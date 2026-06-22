import { readFileSync, writeFileSync } from 'fs';

let sandbox = readFileSync('public/sandbox.js', 'utf8');

// Find normalizePath function
const start = sandbox.indexOf('function normalizePath(url){');
const end = sandbox.indexOf('return path;', start) + 12;

if (start < 0 || end < 12) { console.log('NOT FOUND'); process.exit(1); }

// Correct normalizePath for raw JS (no template escaping needed)
const correctFn =
`function normalizePath(url){
    if(!url) return '';
    var path=url;
    var m=path.match(/^(?:https?:\\/\\/|file:\\/\\/|blob:|data:)[^?]*/i);
    if(!m) m=path.match(/^(?:https?|file|blob|data):\\/\\/[^\\/]+\\/(.*)$/i);
    if(m) path='/'+(m[1]||'');
    var qi=path.indexOf('?'); if(qi!==-1) path=path.substring(0,qi);
    var hi=path.indexOf('#'); if(hi!==-1) path=path.substring(0,hi);
    try{path=decodeURIComponent(path);}catch(_){}
    path=path.replace(/\\\\/g,'/');
    var segs=[],parts=path.split('/');
    for(var i=0;i<parts.length;i++){var s=parts[i];if(s===''||s==='.') continue;if(s==='..'){if(segs.length>0&&segs[segs.length-1]!=='..') segs.pop();else segs.push('..');}else segs.push(s);}
    path=segs.join('/');if(path.charAt(0)==='/')path=path.substring(1);
    return path;
}`;

sandbox = sandbox.slice(0, start) + correctFn + sandbox.slice(end);
writeFileSync('public/sandbox.js', sandbox);
console.log('Fixed normalizePath');
