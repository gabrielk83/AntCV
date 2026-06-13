/* DIAGNOSTIC — Settings -> Personal subtab layout.
 * Opens the settings dialog, navigates to STANDARD -> Personal, and dumps the
 * flex column children (id, order, width, flex-basis, x/y, text) so we can SEE
 * whether the cards stack vertically (each its own row) or horizontally.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png' };
const server = http.createServer(async (req,res)=>{
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port; const base = `http://127.0.0.1:${port}`;
await mkdir(OUT,{recursive:true});

const SECTIONS = { cv:[
  { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'IT expert.' },
  { id:'languages', title:'LANGUAGES', loc:'sidebar', on:true, type:'text', content:'EN, DA' },
], cl:[] };

const browser=await chromium.launch();
const page=await browser.newPage({viewport:{width:1280,height:1400}});
await page.addInitScript(({sections})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));
  localStorage.setItem('personalInfo',JSON.stringify({name:'Gabriel'}));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
},{sections:SECTIONS});
const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
await page.waitForTimeout(3000);

// open settings: click an element whose text contains the gear
async function clickByText(txt, exact){
  return await page.evaluate(({txt,exact})=>{
    const els=[...document.querySelectorAll('button,[role="button"],a,summary,div,span')];
    const m=els.find(e=>{const t=(e.textContent||'').replace(/\s+/g,' ').trim(); return e.offsetParent!==null && (exact? t===txt : t.includes(txt)) && t.length<40;});
    if(m){m.click();return true;} return false;
  },{txt,exact});
}
// the gear is an icon button near top-right (between undo and Export)
let opened = await page.evaluate(()=>{
  const btns=[...document.querySelectorAll('button,[role="button"]')];
  // gear button: small, top of page, contains a gear glyph or title/aria mentioning settings
  const g=btns.find(b=>{const t=(b.textContent||'')+' '+(b.getAttribute('aria-label')||'')+' '+(b.getAttribute('title')||'');const r=b.getBoundingClientRect();return r.top<60 && (/⚙|settings|gear/i.test(t));});
  if(g){g.click();return 'found-gear-btn';}
  return 'no-gear';
});
await page.waitForTimeout(900);
let openedState = await page.evaluate(()=>/STANDARD/.test(document.body.textContent||''));
if(!openedState){ // fallback: click by coordinate where the gear renders
  await page.mouse.click(1135,25); await page.waitForTimeout(900);
  openedState = await page.evaluate(()=>/STANDARD/.test(document.body.textContent||''));
}
await page.screenshot({path:path.join(OUT,'personal-tab-settings.png')});
await clickByText('STANDARD',true); await page.waitForTimeout(500);
let toPersonal = await clickByText('Personal',true); if(!toPersonal) toPersonal = await clickByText('User',true);
await page.waitForTimeout(1500);
console.log('gear:',opened,'| settings open:',openedState);

const dump = await page.evaluate(()=>{
  const anchor=document.getElementById('antcv-react-personal-languages');
  if(!anchor) return {err:'no languages anchor', hasSettings: /STANDARD/.test(document.body.textContent||'')};
  const col=anchor.parentElement; const cs=getComputedStyle(col);
  const kids=[...col.children].map((c,i)=>{const k=getComputedStyle(c);const r=c.getBoundingClientRect();return{i,id:c.id||'',order:k.order,w:Math.round(r.width),fb:k.flexBasis,fg:k.flexGrow,x:Math.round(r.x),y:Math.round(r.y),t:(c.textContent||'').replace(/\s+/g,' ').trim().slice(0,40)};});
  return {colDisp:cs.display,wrap:cs.flexWrap,dir:cs.flexDirection,colW:Math.round(col.getBoundingClientRect().width),kids};
});
console.log('settings opened:', opened, '| toPersonal:', toPersonal);
console.log(JSON.stringify(dump,null,1));
// flag horizontal stacking: any two kids sharing the same y but different x
if(dump.kids){
  const byY={}; dump.kids.forEach(k=>{(byY[k.y]=byY[k.y]||[]).push(k);});
  const rows=Object.values(byY).filter(a=>a.length>1);
  console.log('\nHORIZONTAL ROWS (2+ cards sharing a y):', rows.length);
  rows.forEach(r=>console.log('  y='+r[0].y+': '+r.map(k=>`#${k.id||'?'}"${k.t.slice(0,18)}"`).join('  +  ')));
}
await page.screenshot({path:path.join(OUT,'personal-tab.png')});
if(errs.length) console.log('pageerrors:',errs.slice(0,3).join(' | '));
await browser.close(); await new Promise(r=>server.close(r));
