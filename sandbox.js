(function(){'use strict';
var _origOnerror=window.onerror;
window.onerror=function(msg,src,line,col,err){
    var stack=(err&&err.stack)?err.stack:'(no stack)';
    console.error('[GAME ERROR]',msg,'at',src,':',line,':',col);
    console.error('[GAME ERROR] Stack:',stack);
    try{window.parent.postMessage({source:'iframe-game',type:'game-error',message:String(msg),sourceUrl:String(src),line:line,column:col,stack:stack},'*');}catch(e2){}
    if(typeof _origOnerror==='function') return _origOnerror.call(this,msg,src,line,col,err);
    return false;
};
window.addEventListener('unhandledrejection',function(e){
    console.error('[GAME PROMISE ERROR]',e.reason);
    try{window.parent.postMessage({source:'iframe-game',type:'game-error',message:'Promise: '+String(e.reason),stack:(e.reason&&e.reason.stack)?e.reason.stack:'(no stack)'},'*');}catch(e2){}
});
console.log('[VFS Sandbox] IIFE starting, VFS available:',!!getVfs());
// ── MV boot diagnostics ──
(function(){var _s=Date.now();var _c=setInterval(function(){
var a=Math.round((Date.now()-_s)/1000);
var sm=typeof SceneManager!=='undefined';
var sc=sm&&SceneManager._scene;
var sn=sc&&sc.constructor?sc.constructor.name:'?';
var dm=typeof DataManager!=='undefined';
var db=dm&&typeof DataManager.isDatabaseLoaded==='function'?DataManager.isDatabaseLoaded():false;
var gi=dm&&DataManager._globalInfoLoaded;
var imr=typeof ImageManager!=='undefined'&&typeof ImageManager.isReady==='function'?ImageManager.isReady():'?';
var fnt=(typeof Graphics!=='undefined'&&typeof Graphics.isFontLoaded==='function')?Graphics.isFontLoaded('GameFont'):'?';
console.log('[MV-BOOT '+a+'s] scene='+sn+' db='+db+' imgReady='+imr+' fontOk='+fnt);
if(sc&&sn!=='Scene_Boot'){console.log('[MV-BOOT] Reached '+sn+'!');clearInterval(_c);}
if(a>60){console.log('[MV-BOOT] Timed out');clearInterval(_c);}
},3000);})();
// ── Track window.onload ──
var _bootStart=Date.now();
// Poll for window.onload being set (game scripts may set it after sandbox runs,
// or before — in either case we'll detect it)
var _onloadCheck=setInterval(function(){
if(typeof window.onload==='function'&&!_onloadWrapped){
_onloadWrapped=true;clearInterval(_onloadCheck);
console.log('[MV-BOOT] window.onload SET as function at '+(Date.now()-_bootStart)+'ms');
var _orig=window.onload;
window.onload=function(e){
console.log('[MV-BOOT] window.onload FIRED at '+(Date.now()-_bootStart)+'ms');
try{return _orig.call(this,e);}catch(ex){console.error('[MV-BOOT] onload error:',ex);}
};
}
},10);
var _onloadWrapped=false;
// Direct load event listener as backup
window.addEventListener('load',function(){console.log('[MV-BOOT] load EVENT at '+(Date.now()-_bootStart)+'ms, ready='+document.readyState);});
document.addEventListener('DOMContentLoaded',function(){console.log('[MV-BOOT] DOMContentLoaded at '+(Date.now()-_bootStart)+'ms');});
(function _vfsCheck(n){
    var v=getVfs();
    console.log('[VFS-CHECK#'+n+'] vfs='+!!v+' parent='+!!(window.parent&&window.parent!==window)+' ref='+!!(window.parent&&window.parent.__vfsRef)+' init='+(window.parent&&window.parent.__vfsRef&&window.parent.__vfsRef._initialized));
    if(v){console.log('[VFS-CHECK#'+n+'] basePath='+(v._basePath||'(root)')+' pixi='+v.fileExists('js/libs/pixi.js')+' main='+v.fileExists('js/main.js')+' eff='+v.fileExists('js/libs/effekseer.min.js'));}
    else if(n<10){setTimeout(function(){_vfsCheck(n+1);},500);}
})(0);
function getVfs(){
    if(window.__vfsRef&&window.__vfsRef._initialized) return window.__vfsRef;
    try{if(window.parent&&window.parent!==window){var pv=window.parent.__vfsRef;if(pv&&pv._initialized){window.__vfsRef=pv;return pv;}}}catch(e){}
    return null;
}
// Game volume control (does NOT affect browser TTS)
var _gameVolume=1.0;
function _applyGameVolume(){
    try{
        if(typeof AudioManager!=='undefined'){
            if(AudioManager.__vfsStoredMaster===undefined){
                AudioManager.__vfsStoredMaster=AudioManager.masterVolume;
            }
            AudioManager.masterVolume=AudioManager.__vfsStoredMaster*_gameVolume;
        }
        // Also adjust any playing audio elements
        var allAudio=document.querySelectorAll('audio');
        for(var ai=0;ai<allAudio.length;ai++){
            var a=allAudio[ai];
            if(a.__vfsOrigVolume===undefined) a.__vfsOrigVolume=a.volume;
            a.volume=Math.min(1,a.__vfsOrigVolume*_gameVolume);
        }
    }catch(e){}
}
window.addEventListener('message',function(e){
    if(e.data&&e.data.source==='host-vfs'){
        if(e.data.type==='refresh-saves'){if(typeof StorageManager!=='undefined'){try{StorageManager.updateForageKeys();}catch(_){}}}
        if(e.data.type==='set-game-volume'){
            _gameVolume=e.data.volume/100;
            _applyGameVolume();
        }
    }
});
function normalizePath(url){
    if(!url) return '';
    var path=url;
    var m=path.match(/^(?:https?|file|blob|data):\/\/[^\/]+\/(.*)$/i);
    if(m) path='/'+m[1];
    var qi=path.indexOf('?'); if(qi!==-1) path=path.substring(0,qi);
    var hi=path.indexOf('#'); if(hi!==-1) path=path.substring(0,hi);
    try{path=decodeURIComponent(path);}catch(_){}
    path=path.replace(/\\/g,'/');
    var segs=[],parts=path.split('/');
    for(var i=0;i<parts.length;i++){var s=parts[i];if(s===''||s==='.') continue;if(s==='..'){if(segs.length>0&&segs[segs.length-1]!=='..') segs.pop();else segs.push('..');}else segs.push(s);}
    path=segs.join('/');if(path.charAt(0)==='/')path=path.substring(1);
    return path;
}
// fetch interception
var _origFetch=window.fetch;
window.fetch=function(input,init){
    var url=(typeof input==='string')?input:(input instanceof Request?input.url:String(input));
    var normPath=normalizePath(url);
    var vfs=getVfs();
    if(vfs&&vfs.fileExists(normPath)){var r=vfs.createResponse(normPath);if(r&&r.status===200) return Promise.resolve(r);}
    // Try encrypted filename variants
    if(vfs){
        var _lo=normPath.toLowerCase();
        if(!_lo.endsWith('.png_')&&!_lo.endsWith('.rpgmvp')&&!_lo.endsWith('.jpg_')&&!_lo.endsWith('.jpeg_')&&!_lo.endsWith('.ogg_')&&!_lo.endsWith('.m4a_')&&!_lo.endsWith('.rpgmvo')){
            var _tp=[normPath+'_'];
            if(/\.(png|jpg|jpeg)$/i.test(normPath)) _tp.push(normPath.replace(/\.(png|jpg|jpeg)$/i,'.rpgmvp'));
            if(/\.(ogg|m4a)$/i.test(normPath)) _tp.push(normPath.replace(/\.(ogg|m4a)$/i,'.rpgmvo'));
            for(var _ti=0;_ti<_tp.length;_ti++){
                if(vfs.fileExists(_tp[_ti])){var r=vfs.createResponse(_tp[_ti]);if(r&&r.status===200) return Promise.resolve(r);}
            }
        }
    }
    return _origFetch.apply(this,arguments);
};
// XHR interception — guard responseType globally (once) to prevent sync-XHR crashes
var OrigXHR=window.XMLHttpRequest;
(function(){
    var _rtDesc=Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype,'responseType');
    if(_rtDesc&&_rtDesc.set){
        var _origSetRT=_rtDesc.set;
        Object.defineProperty(XMLHttpRequest.prototype,'responseType',{
            get:function(){return this._vfsXhrRT!==undefined?this._vfsXhrRT:'';},
            set:function(v){
                try{_origSetRT.call(this,v);this._vfsXhrRT=v;}catch(e){this._vfsXhrRT=v;}
            },
            configurable:true,enumerable:true
        });
    }
})();
window.XMLHttpRequest=function(){
    var xhr=new OrigXHR();
    var _open=xhr.open,_send=xhr.send;
    var _url='',_method='',_intercepted=false;
    xhr.open=function(method,url,async,user,pass){
        _method=method.toUpperCase(); _url=url;
        var normPath=normalizePath(url);
        var vfs=getVfs();
        if(vfs&&vfs.fileExists(normPath)){_intercepted=true;return;}
        // Try encrypted filename variants (.png_ / .rpgmvp / .ogg_)
        var _lo=normPath.toLowerCase();
        if(vfs&&!_lo.endsWith('.png_')&&!_lo.endsWith('.rpgmvp')&&!_lo.endsWith('.jpg_')&&!_lo.endsWith('.jpeg_')&&!_lo.endsWith('.ogg_')&&!_lo.endsWith('.m4a_')&&!_lo.endsWith('.rpgmvo')){
            var _tp=[normPath+'_'];
            if(/\.(png|jpg|jpeg)$/i.test(normPath)) _tp.push(normPath.replace(/\.(png|jpg|jpeg)$/i,'.rpgmvp'));
            if(/\.(ogg|m4a)$/i.test(normPath)) _tp.push(normPath.replace(/\.(ogg|m4a)$/i,'.rpgmvo'));
            for(var _ti=0;_ti<_tp.length;_ti++){
                if(vfs.fileExists(_tp[_ti])){_intercepted=true;_url=_tp[_ti];return;}
            }
        }
        _intercepted=false;
        if(!_intercepted) return _open.call(this,method,url,async,user,pass);
    };
    xhr.send=function(body){
        if(!_intercepted) return _send.call(this,body);
        var normPath=normalizePath(_url);
        var vfs=getVfs();
        if(!vfs||!vfs.fileExists(normPath)){_intercepted=false;return _send.call(this,body);}
        var data=vfs.readRawFile(normPath);
        // responseType may fail on sync XHR — _vfsXhrRT is set by global guard
        var _rt=xhr.responseType!==''?xhr.responseType:(xhr._vfsXhrRT||'');
        Object.defineProperty(xhr,'readyState',{get:function(){return 4;},configurable:true});
        Object.defineProperty(xhr,'status',{get:function(){return 200;},configurable:true});
        Object.defineProperty(xhr,'statusText',{get:function(){return 'OK';},configurable:true});
        if(_rt===''||_rt==='text'){
            var decoder=new TextDecoder('utf-8');
            var text=decoder.decode(data);
            Object.defineProperty(xhr,'responseText',{get:function(){return text;},configurable:true});
            Object.defineProperty(xhr,'response',{get:function(){return text;},configurable:true});
        }else if(_rt==='json'){
            var decoder2=new TextDecoder('utf-8');
            try{var json=JSON.parse(decoder2.decode(data));Object.defineProperty(xhr,'response',{get:function(){return json;},configurable:true});}
            catch(e){Object.defineProperty(xhr,'response',{get:function(){return null;},configurable:true});}
        }else if(_rt==='arraybuffer'){
            // Safe copy: data.buffer may be larger if data is a Uint8Array view
            var buf=data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
            Object.defineProperty(xhr,'response',{get:function(){return buf;},configurable:true});
        }else{
            Object.defineProperty(xhr,'response',{get:function(){return data;},configurable:true});
        }
        Object.defineProperty(xhr,'responseURL',{get:function(){return _url;},configurable:true});
        setTimeout(function(){
            if(xhr.onreadystatechange) xhr.onreadystatechange.call(xhr);
            if(xhr.onload) xhr.onload.call(xhr);
            if(xhr.onloadend) xhr.onloadend.call(xhr);
        },0);
    };
    return xhr;
};
window.XMLHttpRequest.UNSENT=0;window.XMLHttpRequest.OPENED=1;window.XMLHttpRequest.HEADERS_RECEIVED=2;window.XMLHttpRequest.LOADING=3;window.XMLHttpRequest.DONE=4;
// 1x1 transparent PNG for missing image fallback
var _emptyPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// Image src
(function(){
    var desc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
    if(desc&&desc.set){
        var _set=desc.set,_get=desc.get;
        Object.defineProperty(HTMLImageElement.prototype,'src',{
            get:function(){return _get.call(this);},
            set:function(value){
                var normPath=normalizePath(String(value));
                var vfs=getVfs();
                // Try encrypted filename variants when the exact path isn't found
                // (engine may request "Title.png" but VFS only has "Title.png_")
                var tryPaths=[normPath];
                if(vfs&&!vfs.fileExists(normPath)){
                    var lower=normPath.toLowerCase();
                    if(!lower.endsWith('.png_')&&!lower.endsWith('.rpgmvp')&&!lower.endsWith('.jpg_')&&!lower.endsWith('.jpeg_')&&!lower.endsWith('.ogg_')&&!lower.endsWith('.m4a_')&&!lower.endsWith('.rpgmvo')){
                        tryPaths.push(normPath+'_');
                        if(/\.(png|jpg|jpeg)$/i.test(normPath)) tryPaths.push(normPath.replace(/\.(png|jpg|jpeg)$/i,'.rpgmvp'));
                        if(/\.(ogg|m4a)$/i.test(normPath)) tryPaths.push(normPath.replace(/\.(ogg|m4a)$/i,'.rpgmvo'));
                    }
                }
                var rawData=null, mime='';
                for(var ti=0;ti<tryPaths.length;ti++){
                    if(vfs&&vfs.fileExists(tryPaths[ti])){
                        rawData=vfs.readRawFile(tryPaths[ti]);
                        if(rawData) break;
                    }
                }
                if(rawData){
                    // Create data: URL locally in iframe (avoids cross-context blob URL issue)
                    mime=(/\.(png|jpg|jpeg)$/i.test(normPath))?'image/'+(RegExp.$1==='jpg'?'jpeg':RegExp.$1):'image/png';
                    if(mime==='image/jpg') mime='image/jpeg';
                    var _b='';
                    for(var _i=0;_i<rawData.length;_i+=8192){
                        var _end=Math.min(_i+8192,rawData.length);
                        _b+=String.fromCharCode.apply(null,rawData.subarray(_i,_end));
                    }
                    var dataUrl='data:'+mime+';base64,'+btoa(_b);
                    this.__vfsBlobUrl=dataUrl;
                    var self=this;
                    var origOnload=self.onload,origOnerror=self.onerror;
                    self.onload=function(e){
                        if(self.__vfsBlobUrl){vfs.revokeMediaUrl(self.__vfsBlobUrl);self.__vfsBlobUrl=null;}
                        if(typeof origOnload==='function') origOnload.call(self,e);
                    };
                    self.onerror=function(e){
                        if(self.__vfsBlobUrl){vfs.revokeMediaUrl(self.__vfsBlobUrl);self.__vfsBlobUrl=null;}
                        // Debug: check if the URL is a blob URL (valid) or something else
                        var _urlType=String(this.src).substring(0,20);
                        try{window.parent.postMessage({source:'iframe-game',type:'img-enc-debug',path:normPath,hasEncInfo:!!(vfs&&vfs.encryptionInfo),hasKey:!!(vfs&&vfs.encryptionInfo&&vfs.encryptionInfo.key),urlType:_urlType},'*');}catch(e2){}
                        if(typeof origOnerror==='function') origOnerror.call(self,e);
                    };
                    _set.call(this,dataUrl);return;
                }
                // Missing image: use 1x1 transparent PNG to prevent 404s
                if(vfs){_set.call(this,_emptyPng);return;}
                _set.call(this,value);
            },configurable:true,enumerable:true
        });
    }
})();
// Audio src
(function(){
    var desc=Object.getOwnPropertyDescriptor(HTMLAudioElement.prototype,'src');
    if(desc&&desc.set){
        var _set=desc.set,_get=desc.get;
        Object.defineProperty(HTMLAudioElement.prototype,'src',{
            get:function(){return _get.call(this);},
            set:function(value){
                var normPath=normalizePath(String(value));
                var vfs=getVfs();
                if(this.__vfsAudioBlobUrl){
                    var prevBlob=this.__vfsAudioBlobUrl,audioEl=this;
                    setTimeout(function(){if(audioEl.__vfsAudioBlobUrl===prevBlob)return;vfs.revokeMediaUrl(prevBlob);},200);
                    this.__vfsAudioBlobUrl=null;
                }
                // Try encrypted filename variants
                var tryPaths=[normPath];
                if(vfs&&!vfs.fileExists(normPath)){
                    var lower=normPath.toLowerCase();
                    if(!lower.endsWith('.ogg_')&&!lower.endsWith('.m4a_')&&!lower.endsWith('.rpgmvo')){
                        tryPaths.push(normPath+'_');
                        if(/\.(ogg|m4a)$/i.test(normPath)) tryPaths.push(normPath.replace(/\.(ogg|m4a)$/i,'.rpgmvo'));
                    }
                }
                for(var ti=0;ti<tryPaths.length;ti++){
                    if(vfs&&vfs.fileExists(tryPaths[ti])){
                        var blobUrl=vfs.createMediaUrl(tryPaths[ti]);
                        if(blobUrl){this.__vfsAudioBlobUrl=blobUrl;_set.call(this,blobUrl);return;}
                    }
                }
                _set.call(this,value);
            },configurable:true,enumerable:true
        });
    }
})();
// Helper: empty WebM blob for missing video fallback
var _emptyVideoBlob=null;
function getEmptyVideoBlob(){
    if(_emptyVideoBlob) return _emptyVideoBlob;
    _emptyVideoBlob=URL.createObjectURL(new Blob([
        new Uint8Array([0x1a,0x45,0xdf,0xa3,0x9f,0x42,0x86,0x81,0x01,0x42,
        0xf7,0x81,0x01,0x42,0xf2,0x81,0x04,0x42,0xf3,0x81,0x08,0x42,0x82,
        0x84,0x77,0x65,0x62,0x6d,0x42,0x87,0x81,0x04,0x42,0x85,0x81,0x02,
        0x18,0x53,0x80,0x67,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x1f,0x43,0xb6,0x75,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00])],{type:'video/webm'}));
    return _emptyVideoBlob;
}
// Video src
(function(){
    var desc=Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype,'src');
    if(desc&&desc.set){
        var _set=desc.set;
        Object.defineProperty(HTMLVideoElement.prototype,'src',{
            get:function(){return desc.get.call(this);},
            set:function(value){
                var normPath=normalizePath(String(value));
                var vfs=getVfs();
                if(this.__vfsVideoBlobUrl){
                    var prevBlob=this.__vfsVideoBlobUrl,vidEl=this;
                    setTimeout(function(){if(vidEl.__vfsVideoBlobUrl===prevBlob)return;vfs.revokeMediaUrl(prevBlob);},200);
                    this.__vfsVideoBlobUrl=null;
                }
                if(vfs&&vfs.fileExists(normPath)){
                    var blobUrl=vfs.createMediaUrl(normPath);
                    if(blobUrl){this.__vfsVideoBlobUrl=blobUrl;_set.call(this,blobUrl);return;}
                }
                // Fallback: empty silent WebM to prevent LoadError crash
                if(vfs){_set.call(this,getEmptyVideoBlob());return;}
                _set.call(this,value);
            },configurable:true,enumerable:true
        });
    }
})();
// Script src + Link href (prototype-level)
(function(){
    var spd=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
    if(spd&&spd.set){
        var _sss=spd.set,_ssg=spd.get;
        Object.defineProperty(HTMLScriptElement.prototype,'src',{
            get:function(){if(this.__vfsOriginalPath) return this.__vfsOriginalPath; return _ssg.call(this);},
            set:function(value){
                this.__vfsOriginalPath=null;
                if(this.getAttribute('data-vfs-original')) this.__vfsOriginalPath=this.getAttribute('data-vfs-original');
                try{
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
                _sss.call(this,value);
            },configurable:true,enumerable:true
        });
    }
    var lpd=Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype,'href');
    if(lpd&&lpd.set){
        var _lhs=lpd.set,_lhg=lpd.get;
        Object.defineProperty(HTMLLinkElement.prototype,'href',{
            get:function(){if(this.__vfsOriginalHref) return this.__vfsOriginalHref; return _lhg.call(this);},
            set:function(value){
                this.__vfsOriginalHref=null;
                try{
                    var normPath=normalizePath(String(value));
                    var vfs=getVfs();
                    if(vfs&&vfs.fileExists(normPath)){
                        var blobUrl=vfs.createMediaUrl(normPath,'text/css');
                        if(blobUrl){this.__vfsOriginalHref=value;_lhs.call(this,blobUrl);return;}
                    }
                }catch(e){}
                _lhs.call(this,value);
            },configurable:true,enumerable:true
        });
    }
})();

// --- Worker interception ---
(function(){
    if(typeof Worker==='undefined') return;
    var OrigWorker=Worker;
    window.Worker=function(url,options){
        var strUrl=String(url);
        var np=normalizePath(strUrl);
        var v=getVfs();
        if(v&&v.fileExists(np)){
            var data=v.readRawFile(np);
            if(data){
                var blob=new Blob([data],{type:'application/javascript'});
                return new OrigWorker(URL.createObjectURL(blob),options);
            }
        }
        return new OrigWorker(url,options);
    };
    Worker.prototype=OrigWorker.prototype;
})();

// FontFace
if(typeof FontFace!=='undefined'){
    var _OrigFontFace=FontFace;
    window.FontFace=function(family,source,descriptors){
        if(typeof source==='string'){
            source=source.replace(/url\(["']?([^"')]+)["']?\)/g,function(m,url){
                var normPath=normalizePath(url);
                var vfs=getVfs();
                if(vfs&&vfs.fileExists(normPath)){
                    var blobUrl=vfs.createMediaUrl(normPath);
                    if(blobUrl) return 'url('+blobUrl+')';
                }
                return m;
            });
        }
        return new _OrigFontFace(family,source,descriptors);
    };
    window.FontFace.prototype=_OrigFontFace.prototype;
}
// captureGameText
window.captureGameText=function(){
    if(typeof $gameMessage==='undefined'||$gameMessage===null||!$gameMessage.hasText) return '';
    if(!$gameMessage.hasText()) return '';
    var raw=$gameMessage.allText();
    var cleaned=raw;
    if(typeof Window_Base!=='undefined'&&Window_Base.prototype.convertEscapeCharacters){
        try{
            var scene=(typeof SceneManager!=='undefined'&&SceneManager._scene)?SceneManager._scene:null;
            var msgWindow=scene?(scene._messageWindow||null):null;
            if(msgWindow&&typeof msgWindow.convertEscapeCharacters==='function'){
                cleaned=msgWindow.convertEscapeCharacters(raw);
            }else{
                var dummy=Object.create(Window_Base.prototype);
                dummy.actorName=function(n){var actor=(typeof $gameActors!=='undefined'&&n>=1)?$gameActors.actor(n):null;return actor?actor.name():'';};
                dummy.partyMemberName=function(n){var members=(typeof $gameParty!=='undefined')?$gameParty.members():[];var actor=(n>=1&&members[n-1])?members[n-1]:null;return actor?actor.name():'';};
                cleaned=Window_Base.prototype.convertEscapeCharacters.call(dummy,raw);
            }
        }catch(e){cleaned=raw;}
    }
    cleaned=cleaned.replace(/\x1bC\[\d+\]/gi,'');
    cleaned=cleaned.replace(/\x1b\{/g,'');cleaned=cleaned.replace(/\x1b\}/g,'');
    cleaned=cleaned.replace(/\x1b\./g,'');cleaned=cleaned.replace(/\x1b\|/g,'');
    cleaned=cleaned.replace(/\x1b!/g,'');cleaned=cleaned.replace(/\x1b\^/g,'');
    cleaned=cleaned.replace(/\x1b\$/g,'');cleaned=cleaned.replace(/\x1b</g,'');
    cleaned=cleaned.replace(/\x1b>/g,'');cleaned=cleaned.replace(/\x1b\\\\/g,'');
    cleaned=cleaned.replace(/\x1b[A-Z]+(?:\[\d+\])?/gi,'');
    cleaned=cleaned.replace(/\x1bF\[[^\]]*\]/gi,'');
    cleaned=cleaned.replace(/\x1bI\[\d+\]/gi,'');
    cleaned=cleaned.replace(/\f/g,'\n---\n');
    cleaned=cleaned.replace(/\x1b/g,'');
    return cleaned.trim();
};
// captureScreenshot — uses RPG Maker MZ's built-in Bitmap.snap() which
// handles WebGL→Canvas extraction correctly across all Pixi versions.
window.captureScreenshot=function(){
    try{
        if(typeof Graphics==='undefined'||!Graphics.app) return null;
        var w=Graphics.width, h=Graphics.height;
        if(w<=0||h<=0) return null;

        // Route A: Use MZ's own Bitmap.snap (tested, reliable).
        if(typeof Bitmap!=='undefined'&&Bitmap.snap){
            var bmp=Bitmap.snap(Graphics.app.stage);
            if(bmp&&bmp.canvas){
                var data=bmp.canvas.toDataURL('image/png');
                bmp.destroy();
                return data;
            }
        }

        // Route B: Pixi extract fallback (if Bitmap not yet loaded).
        var renderer=Graphics.app.renderer;
        if(!renderer) return null;
        var extract=renderer.plugins&&renderer.plugins.extract?renderer.plugins.extract:renderer.extract;
        if(extract&&extract.canvas){
            var rt=PIXI.RenderTexture.create(w, h);
            if(rt){
                renderer.render(Graphics.app.stage, rt);
                var c=extract.canvas(rt);
                rt.destroy(true);
                if(c) return c.toDataURL('image/png');
            }
        }

        // Route C: gl.readPixels direct readback.
        try{
            var gl=renderer.gl;
            if(gl){
                var pixels=new Uint8Array(w*h*4);
                gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
                var c2=document.createElement('canvas');c2.width=w;c2.height=h;
                var ctx=c2.getContext('2d');
                var imgData=ctx.createImageData(w,h);
                imgData.data.set(pixels);
                // Flip Y (WebGL origin is bottom-left)
                ctx.putImageData(imgData,0,0);
                ctx.translate(0,h);ctx.scale(1,-1);
                ctx.drawImage(c2,0,0);
                ctx.setTransform(1,0,0,1,0,0);
                return c2.toDataURL('image/png');
            }
        }catch(e2){}
    }catch(e){console.error('[Screenshot]',e);}
    return null;
};
// Game_Message hook for event-driven text extraction.
// When the engine adds new dialogue text, notify the host page so it can
// extract text immediately (rather than polling with setInterval).
var _gameMsgHooked=false;
function hookGameMessage(){
    if(_gameMsgHooked) return;
    if(typeof Game_Message==='undefined'||!Game_Message.prototype){setTimeout(hookGameMessage,100);return;}
    _gameMsgHooked=true;
    var _origAdd=Game_Message.prototype.add;
    Game_Message.prototype.add=function(text){
        _origAdd.call(this,text);
        try{window.parent.postMessage({source:'iframe-game',type:'text-changed',text:text},'*');}catch(e){}
    };
    var _origClear=Game_Message.prototype.clear;
    Game_Message.prototype.clear=function(){
        _origClear.call(this);
        try{window.parent.postMessage({source:'iframe-game',type:'text-cleared'},'*');}catch(e){}
    };
    console.log('[VFS Sandbox] Game_Message hooks installed (event-driven text extraction)');
    // 通知宿主页面沙箱已就绪（用于解除加载进度条）
    try{window.parent.postMessage({source:'iframe-game',type:'sandbox-ready'},'*');}catch(e){}
}
setInterval(function(){if(typeof Game_Message!=='undefined') hookGameMessage();},100);
// StorageManager hooks
var _storageHooked=false;
function hookStorageManager(){
    if(_storageHooked) return;
    if(typeof StorageManager==='undefined'){setTimeout(hookStorageManager,100);return;}
    _storageHooked=true;
    var _origSaveToForage=StorageManager.saveToForage;
    StorageManager.saveToForage=function(saveName,zip){
        var result=_origSaveToForage.apply(this,arguments);
        if(window.parent&&window.parent!==window) window.parent.postMessage({source:'iframe-game',type:'save-updated',saveName:saveName},'*');
        return result;
    };
}
setInterval(function(){if(typeof StorageManager!=='undefined') hookStorageManager();},50);
// ---- Encryption key injection ----
// VFS decrypts via Rust (16-byte XOR). Engine must NOT decrypt again.
var __vfsEncKey='', __vfsEncHooked=0;
(function(){var v=getVfs();if(v&&v.encryptionInfo&&v.encryptionInfo.key)__vfsEncKey=v.encryptionInfo.key;})();
var __vfsEncPoll=setInterval(function(){
    if(typeof Utils!=='undefined'&&typeof Utils.setEncryptionInfo==='function'&&!(__vfsEncHooked&1)){
        __vfsEncHooked|=1;
        Utils.setEncryptionInfo=function(a,b,k){
            Utils._hasEncryptedImages=false;Utils._hasEncryptedAudio=false;
            Utils._encryptionKey=k||__vfsEncKey;
        };
        Utils.hasEncryptedImages=function(){return false;};
        Utils.hasEncryptedAudio=function(){return false;};
        Utils.decryptArrayBuffer=function(s){return s;};
        if(typeof Utils.isNwjs==='function') Utils.isNwjs=function(){return false;};
    }
    if(typeof Decrypter!=='undefined'&&typeof Decrypter==='function'&&!(__vfsEncHooked&2)){
        __vfsEncHooked|=2;
        try{
            Object.defineProperty(Decrypter,'hasEncryptedImages',{get:function(){return false;},set:function(v){},configurable:true,enumerable:true});
            Object.defineProperty(Decrypter,'hasEncryptedAudio',{get:function(){return false;},set:function(v){},configurable:true,enumerable:true});
        }catch(e){}
    }
    if(__vfsEncHooked===3) clearInterval(__vfsEncPoll);
},50);
setTimeout(function(){clearInterval(__vfsEncPoll);},12000);


// Anchor tag
var origSetAttr=HTMLAnchorElement.prototype.setAttribute;
HTMLAnchorElement.prototype.setAttribute=function(name,value){
    if(name.toLowerCase()==='href'&&value&&!value.startsWith('#')&&!value.startsWith('javascript:')&&!value.startsWith('blob:')) value='javascript:void(0)';
    return origSetAttr.call(this,name,value);
};
// RAF tick counter
var _tickCount=0;
var _origRAF=window.requestAnimationFrame;
window.requestAnimationFrame=function(cb){_tickCount++;return _origRAF.call(window,cb);};
window.__vfsTickCount=function(){return _tickCount;};
// Listen for host messages
window.addEventListener('message',function(e){
    if(!e.data||e.data.source!=='host-vfs') return;
    if(e.data.type==='refresh-saves'){
        if(typeof StorageManager!=='undefined'){
            try{StorageManager.updateForageKeys().then(function(){
                if(typeof SceneManager!=='undefined'&&SceneManager._scene){
                    var s=SceneManager._scene;
                    if(s.constructor===Scene_Load||s.constructor===Scene_Save){}
                }
            });}catch(e2){}
        }
    }
});
console.log('[VFS Sandbox] Interception layer injected. VFS available:',!!getVfs());

	// ── Effekseer compat patch ──
	// Prevents _createEffekseerContext from destroying _app on error,
	// which would cause "Failed to initialize graphics."
	(function(){
	    var _check = setInterval(function(){
	        if(typeof Graphics !== 'undefined' && Graphics._createEffekseerContext){
	            clearInterval(_check);
	            var _orig = Graphics._createEffekseerContext;
	            Graphics._createEffekseerContext = function(){
	                if(this._app && window.effekseer){
	                    try {
	                        this._effekseer = effekseer.createContext();
	                        if(this._effekseer){
	                            this._effekseer.init(this._app.renderer.gl);
	                            this._effekseer.setRestorationOfStatesFlag(false);
	                        }
	                    } catch(e) {
	                        console.error('[Effekseer] ctx init failed:', e.message);
	                        this._effekseer = null; // keep _app alive
	                    }
	                }
	            };
	            console.log('[Sandbox] Effekseer compat patch applied');
	        }
	    }, 50);
	    setTimeout(function(){ clearInterval(_check); }, 15000);
	})();

	// Scene_Boot stuck guard v2
	(function(){
		console.log('[VFS] Boot guard installed');
		var _born = Date.now();
		var _lastLog = 0;
		var _t = setInterval(function(){
			if (typeof SceneManager === 'undefined' || !SceneManager._scene) return;
			var s = SceneManager._scene;
			if (!s.constructor || s.constructor.name !== 'Scene_Boot') return;
			var age = Math.round((Date.now() - _born) / 1000);
			// Log diagnostic every 4s
			if (age - _lastLog >= 4) {
				_lastLog = age;
				var f = [];
				try { f.push('cfg=' + (typeof ConfigManager!=='undefined' && ConfigManager._loaded)); } catch(e) {}
				try { f.push('gInfo=' + (typeof DataManager!=='undefined' && DataManager._globalInfoLoaded)); } catch(e) {}
				try { f.push('db=' + (typeof DataManager!=='undefined' && DataManager.isDatabaseLoaded())); } catch(e) {}
				try { f.push('fKeys=' + (typeof StorageManager!=='undefined' && StorageManager._forageKeysUpdated)); } catch(e) {}
				try { f.push('font=' + (typeof FontManager!=='undefined' && FontManager._ready)); } catch(e) {}
				try { f.push('sceneDB=' + !!s._databaseLoaded); } catch(e) {}
				console.log('[VFS] Boot waiting ' + age + 's: ' + f.join(' '));
			}
			if (age < 12) return;
			// Force unstuck
			console.log('[VFS] Unstucking Scene_Boot...');
			try { if (typeof ConfigManager !== 'undefined' && !ConfigManager._loaded) { ConfigManager._loaded = true; console.log('[VFS]   forced ConfigManager._loaded'); } } catch(e) {}
			try { if (typeof DataManager !== 'undefined' && !DataManager._globalInfoLoaded) { DataManager._globalInfoLoaded = true; console.log('[VFS]   forced DataManager._globalInfoLoaded'); } } catch(e) {}
			try { if (typeof StorageManager !== 'undefined' && !StorageManager._forageKeysUpdated) { StorageManager._forageKeysUpdated = true; console.log('[VFS]   forced StorageManager._forageKeysUpdated'); } } catch(e) {}
			try { if (typeof FontManager !== 'undefined' && !FontManager._ready) { FontManager._ready = true; console.log('[VFS]   forced FontManager._ready'); } } catch(e) {}
			try { if (!s._databaseLoaded) { s._databaseLoaded = true; console.log('[VFS]   forced scene._databaseLoaded'); } } catch(e) {}
			console.log('[VFS] Scene_Boot unstuck complete');
			clearInterval(_t);
		}, 2000);
		setTimeout(function(){ clearInterval(_t); }, 60000);
	})();

	// ── Game volume hook (AudioManager.masterVolume) ──
	// Periodically checks and reapplies host game volume on top of game's internal volume.
	// This does NOT affect browser TTS (SpeechSynthesis), which runs outside the iframe.
	var _volCheckInterval=setInterval(function(){
		if(_gameVolume===1.0) return; // No adjustment needed
		try{
			if(typeof AudioManager!=='undefined'){
				// Store the game's intended master volume (before our modifier)
				if(AudioManager.__vfsStoredMaster===undefined){
					AudioManager.__vfsStoredMaster=AudioManager.masterVolume;
				}
				// Re-apply: game's internal volume × host game volume
				var targetVol=AudioManager.__vfsStoredMaster*_gameVolume;
				if(Math.abs(AudioManager.masterVolume-targetVol)>0.001){
					AudioManager.masterVolume=targetVol;
				}
			}
		}catch(e){}
	},1500);

})();