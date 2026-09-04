// Minimal DOM/browser stub — enough to boot LaiLingo and call render functions.
const store = {};
function register(el){ if(el && el.id) store[el.id] = el; }
function unregister(el){ if(el && el.id && store[el.id]===el) delete store[el.id]; }
function mkEl(tag='div', id=''){
  const el = {
    tagName:String(tag).toUpperCase(), id, _html:'', _text:'', children:[], parentNode:null,
    style:new Proxy({},{get:(t,k)=>t[k]||'',set:(t,k,v)=>{t[k]=v;return true;}}),
    dataset:{}, classList:{ _s:new Set(),
      add(...c){c.forEach(x=>this._s.add(x));}, remove(...c){c.forEach(x=>this._s.delete(x));},
      toggle(c,f){ f===undefined ? (this._s.has(c)?this._s.delete(c):this._s.add(c)) : (f?this._s.add(c):this._s.delete(c)); },
      contains(c){return this._s.has(c);} },
    attrs:{},
    get className(){ return [...this.classList._s].join(' '); },
    set className(v){ this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
    get innerHTML(){ return this._html; },
    set innerHTML(v){ this._html = String(v); this.children = []; },  // assigning innerHTML replaces children, as in a real DOM
    get textContent(){ return this._text; },
    set textContent(v){ this._text = String(v); },
    get value(){ return this._value||''; }, set value(v){ this._value=String(v); },
    setAttribute(k,v){ this.attrs[k]=String(v); if(k==='class') this.className=v; if(k==='id'){ this.id=String(v); if(this.parentNode) register(this); } },
    getAttribute(k){ return this.attrs[k] ?? null; },
    removeAttribute(k){ delete this.attrs[k]; },
    // Attaching an element makes it findable by id, exactly as in a browser.
    // Without this, code that does getElementById -> create -> append builds a
    // fresh element on every call and never sees the one it just made.
    appendChild(c){ this.children.push(c); c.parentNode=this; register(c); return c; },
    removeChild(c){ this.children=this.children.filter(x=>x!==c); unregister(c); return c; },
    insertBefore(c){ this.children.unshift(c); c.parentNode=this; register(c); return c; },
    addEventListener(){}, removeEventListener(){}, click(){}, focus(){}, blur(){},
    scrollIntoView(){}, getBoundingClientRect(){ return {top:0,left:0,width:0,height:0,bottom:0,right:0}; },
    querySelector(){ return null; }, querySelectorAll(){ return []; },
    closest(){ return null; }, remove(){}, animate(){ return {finished:Promise.resolve()}; },
    play(){ return Promise.resolve(); }, pause(){}, load(){},
  };
  return el;
}
// Seeded with every id that actually appears in LaiLingo.html, so
// getElementById returns null for anything else — exactly as a browser does.
// Auto-creating unknown ids hid two things: code paths that only run when an
// element is absent (createElement + appendChild), and typo'd ids that would
// throw in a real browser.
const fs = require('fs'), path = require('path');
const REAL_IDS = (() => {
  // The working copy comes FIRST: tests run against the file being edited, so an
  // id added this session must be seeded from it. Reading the shipped copy instead
  // made every new element silently non-existent, which is the exact failure this
  // seeding was introduced to prevent.
  const candidates = [path.join(__dirname,'LaiLingo_work.html'),
                      path.join(__dirname,'LaiLingo.html'),
                      path.join(__dirname,'mnt','VietnameseApp','LaiLingo.html')];
  for(const p of candidates){
    try { return new Set([...fs.readFileSync(p,'utf8').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1])); }
    catch(e){}
  }
  return null;   // no HTML to hand: fall back to the old permissive behaviour
})();
const doc = {
  body: mkEl('body'), documentElement: mkEl('html'), head: mkEl('head'),
  getElementById(id){
    if(store[id]) return store[id];
    if(REAL_IDS && !REAL_IDS.has(id)) return null;
    const el = mkEl('div', id);
    // Every element in the real document has a parent. Code that inserts a
    // sibling (`x.parentNode.insertBefore(...)`) silently no-ops without one,
    // which is how the Worlds language notice was never being created here.
    // A private wrapper rather than document.body, so body.children stays a
    // true record of what the app itself appended.
    el.parentNode = mkEl('div', '');
    el.parentNode.children.push(el);
    return (store[id] = el);
  },
  createElement(t){ return mkEl(t); },
  createTextNode(t){ const e=mkEl('#text'); e.textContent=t; return e; },
  querySelector(){ return null; }, querySelectorAll(){ return []; },
  getElementsByClassName(){ return []; }, getElementsByTagName(){ return []; },
  addEventListener(){}, removeEventListener(){},
  readyState:'complete',
};
const storage = { _d:{}, getItem(k){ return k in this._d ? this._d[k] : null; },
  setItem(k,v){ this._d[k]=String(v); }, removeItem(k){ delete this._d[k]; }, clear(){ this._d={}; } };
const g = globalThis;
g.document = doc;
g.window = g;
g.localStorage = storage; g.sessionStorage = storage;
// Node 22 ships its own read-only global `navigator`, so a plain assignment
// here is silently DISCARDED — every suite that thought it was reading this
// stub was in fact reading Node's, whose userAgent is "Node.js/22". Nothing
// depended on it until the production mic gate needed to fake an iPhone, which
// is how it surfaced. defineProperty replaces it for real, and configurable
// lets a test swap it and put it back.
Object.defineProperty(g, 'navigator', {
  value: { userAgent:'node', language:'en-US', onLine:true, clipboard:{writeText:()=>Promise.resolve()},
    mediaDevices:{ getUserMedia:()=>Promise.reject(new Error('no mic')) }, share:undefined, vibrate(){}, platform:'node', maxTouchPoints:0 },
  writable: true, configurable: true, enumerable: true,
});
g.location = { href:'file:///LaiLingo.html', hash:'', search:'', pathname:'/LaiLingo.html', reload(){} };
g.history = { pushState(){}, replaceState(){}, back(){} };
g.alert = ()=>{}; g.confirm = ()=>true; g.prompt = ()=>null;
g.requestAnimationFrame = cb => setTimeout(()=>cb(Date.now()), 0);
g.cancelAnimationFrame = id => clearTimeout(id);
g.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
g.Audio = function(){ return { play:()=>Promise.resolve(), pause(){}, load(){}, addEventListener(){}, currentTime:0, src:'' }; };
g.speechSynthesis = { speak(){}, cancel(){}, getVoices(){ return []; } };
g.SpeechSynthesisUtterance = function(){ return {}; };
g.fetch = () => Promise.resolve({ ok:false, status:404, json:()=>Promise.resolve({}), text:()=>Promise.resolve('') });
g.scrollTo = ()=>{}; g.addEventListener = ()=>{}; g.removeEventListener = ()=>{};
g.getComputedStyle = () => ({ getPropertyValue:()=>'' });
g.IntersectionObserver = function(){ return { observe(){}, unobserve(){}, disconnect(){} }; };
g.ResizeObserver = g.IntersectionObserver;
g.CSS = { supports:()=>false };
module.exports = { store, mkEl };
