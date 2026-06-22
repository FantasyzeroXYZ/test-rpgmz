// Add diagnostic logging to sandbox.js script interception
import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('public/sandbox.js', 'utf8');

// Replace Script src interception to add more logging
const oldScriptBlock = `                try{
                    var normPath=normalizePath(String(value));
                    var vfs=getVfs();
                    if(vfs&&vfs.fileExists(normPath)){
                        var blobUrl=vfs.createMediaUrl(normPath,'application/javascript');
                        if(blobUrl){this.__vfsOriginalPath=value;_sss.call(this,blobUrl);return;}
                        console.warn('[VFS] Script blobUrl failed for:',value,'→',normPath);
                    } else {
                        console.warn('[VFS] Script not in VFS:',value,'→',normPath,' vfs:',!!vfs);
                    }
                }catch(e){console.error('[VFS] Script src error:',e);}
                _sss.call(this,value);`;

const newScriptBlock = `                try{
                    var normPath=normalizePath(String(value));
                    var vfs=getVfs();
                    console.log('[VFS] Script src:',value,'→',normPath,'vfs:',!!vfs,'exists:',vfs?vfs.fileExists(normPath):'N/A');
                    if(vfs&&vfs.fileExists(normPath)){
                        var blobUrl=vfs.createMediaUrl(normPath,'application/javascript');
                        if(blobUrl){console.log('[VFS] Script blob OK:',normPath,blobUrl.slice(0,50));this.__vfsOriginalPath=value;_sss.call(this,blobUrl);return;}
                        console.warn('[VFS] Script blobUrl FAILED:',value,'→',normPath,'fileExists=true');
                    } else {
                        console.warn('[VFS] Script MISSING:',value,'→',normPath,'vfs:',!!vfs);
                    }
                }catch(e){console.error('[VFS] Script src error:',value,e.message);}
                console.warn('[VFS] Script FALLBACK to network:',value);
                _sss.call(this,value);`;

if (c.includes(oldScriptBlock)) {
    c = c.replace(oldScriptBlock, newScriptBlock);
    writeFileSync('public/sandbox.js', c, 'utf8');
    console.log('PATCHED script interception');
} else {
    console.log('Script block not found, searching...');
    // Try to find the try/catch part
    const idx = c.indexOf('Script src error:');
    console.log('Found at:', idx, c.substring(idx-30, idx+30));
}
