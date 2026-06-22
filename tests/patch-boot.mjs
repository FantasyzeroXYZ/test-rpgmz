// Update sandbox.js Scene_Boot unstuck guard v2
import { readFileSync, writeFileSync } from 'fs';

const path = 'public/sandbox.js';
let c = readFileSync(path, 'utf8');

const marker = 'Scene_Boot unstuck';
const idx = c.lastIndexOf(marker);
if (idx < 0) { console.log('MARKER NOT FOUND'); process.exit(1); }

const blockStart = c.lastIndexOf('\t// Scene_Boot', idx - 100);
const blockEnd = c.indexOf('\t})();', blockStart);
const nextLine = c.indexOf('\n', blockEnd);
const realEnd = c.indexOf('})();', nextLine);

if (blockStart < 0 || realEnd < 0) {
    console.log('BLOCK NOT FOUND', blockStart, realEnd);
    process.exit(1);
}

const before = c.substring(0, blockStart);
const after = c.substring(realEnd + 5); // after })();

const newBlock = `\t// Scene_Boot stuck guard v2
\t(function(){
\t\tconsole.log('[VFS] Boot guard installed');
\t\tvar _born = Date.now();
\t\tvar _lastLog = 0;
\t\tvar _t = setInterval(function(){
\t\t\tif (typeof SceneManager === 'undefined' || !SceneManager._scene) return;
\t\t\tvar s = SceneManager._scene;
\t\t\tif (!s.constructor || s.constructor.name !== 'Scene_Boot') return;
\t\t\tvar age = Math.round((Date.now() - _born) / 1000);
\t\t\t// Log diagnostic every 4s
\t\t\tif (age - _lastLog >= 4) {
\t\t\t\t_lastLog = age;
\t\t\t\tvar f = [];
\t\t\t\ttry { f.push('cfg=' + (typeof ConfigManager!=='undefined' && ConfigManager._loaded)); } catch(e) {}
\t\t\t\ttry { f.push('gInfo=' + (typeof DataManager!=='undefined' && DataManager._globalInfoLoaded)); } catch(e) {}
\t\t\t\ttry { f.push('db=' + (typeof DataManager!=='undefined' && DataManager.isDatabaseLoaded())); } catch(e) {}
\t\t\t\ttry { f.push('fKeys=' + (typeof StorageManager!=='undefined' && StorageManager._forageKeysUpdated)); } catch(e) {}
\t\t\t\ttry { f.push('font=' + (typeof FontManager!=='undefined' && FontManager._ready)); } catch(e) {}
\t\t\t\ttry { f.push('sceneDB=' + !!s._databaseLoaded); } catch(e) {}
\t\t\t\tconsole.log('[VFS] Boot waiting ' + age + 's: ' + f.join(' '));
\t\t\t}
\t\t\tif (age < 12) return;
\t\t\t// Force unstuck
\t\t\tconsole.log('[VFS] Unstucking Scene_Boot...');
\t\t\ttry { if (typeof ConfigManager !== 'undefined' && !ConfigManager._loaded) { ConfigManager._loaded = true; console.log('[VFS]   forced ConfigManager._loaded'); } } catch(e) {}
\t\t\ttry { if (typeof DataManager !== 'undefined' && !DataManager._globalInfoLoaded) { DataManager._globalInfoLoaded = true; console.log('[VFS]   forced DataManager._globalInfoLoaded'); } } catch(e) {}
\t\t\ttry { if (typeof StorageManager !== 'undefined' && !StorageManager._forageKeysUpdated) { StorageManager._forageKeysUpdated = true; console.log('[VFS]   forced StorageManager._forageKeysUpdated'); } } catch(e) {}
\t\t\ttry { if (typeof FontManager !== 'undefined' && !FontManager._ready) { FontManager._ready = true; console.log('[VFS]   forced FontManager._ready'); } } catch(e) {}
\t\t\ttry { if (!s._databaseLoaded) { s._databaseLoaded = true; console.log('[VFS]   forced scene._databaseLoaded'); } } catch(e) {}
\t\t\tconsole.log('[VFS] Scene_Boot unstuck complete');
\t\t\tclearInterval(_t);
\t\t}, 2000);
\t\tsetTimeout(function(){ clearInterval(_t); }, 60000);
\t})();
`;

c = before + newBlock + after;
writeFileSync(path, c, 'utf8');
console.log('PATCHED v2');
