// Apply Effekseer compat patch to sandbox.js
import { readFileSync, writeFileSync } from 'fs';

const path = 'public/sandbox.js';
let content = readFileSync(path, 'utf8');

const lastLogIdx = content.lastIndexOf("console.log('[VFS Sandbox]");
if (lastLogIdx < 0) {
    console.log('ERROR: marker not found');
    process.exit(1);
}

const before = content.substring(0, lastLogIdx);

const patch = `console.log('[VFS Sandbox] Interception layer injected. VFS available:',!!getVfs());

\t// ── Effekseer compat patch ──
\t// Prevents _createEffekseerContext from destroying _app on error,
\t// which would cause "Failed to initialize graphics."
\t(function(){
\t    var _check = setInterval(function(){
\t        if(typeof Graphics !== 'undefined' && Graphics._createEffekseerContext){
\t            clearInterval(_check);
\t            var _orig = Graphics._createEffekseerContext;
\t            Graphics._createEffekseerContext = function(){
\t                if(this._app && window.effekseer){
\t                    try {
\t                        this._effekseer = effekseer.createContext();
\t                        if(this._effekseer){
\t                            this._effekseer.init(this._app.renderer.gl);
\t                            this._effekseer.setRestorationOfStatesFlag(false);
\t                        }
\t                    } catch(e) {
\t                        console.error('[Effekseer] ctx init failed:', e.message);
\t                        this._effekseer = null; // keep _app alive
\t                    }
\t                }
\t            };
\t            console.log('[Sandbox] Effekseer compat patch applied');
\t        }
\t    }, 50);
\t    setTimeout(function(){ clearInterval(_check); }, 15000);
\t})();
})();`;

writeFileSync(path, before + patch, 'utf8');
console.log('PATCHED sandbox.js');
