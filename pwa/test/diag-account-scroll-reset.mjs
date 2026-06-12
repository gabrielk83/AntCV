/* DIAGNOSTIC — ACCOUNT-SCROLL-RESET-001 (owner 2026-06-13): "in the account
 * menu, scrolling down to the end the app resets" — console shows a fresh
 * boot, i.e. the page reloaded or React crashed to a recovery reload.
 * Repro: boot -> open Settings -> account subtab -> scroll the settings
 * panel to the bottom repeatedly -> watch for pageerror / navigation /
 * blank screen. Run twice: with the LLM-lab sidecar active and with it
 * neutralised, to isolate the new injection as cause.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const browser=await chromium.launch();

async function run(label, neutraliseLab, subtab) {
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.addInitScript(({neutraliseLab})=>{
    if (neutraliseLab) window.__antcvLlmLab = 'neutralised';
    if (localStorage.getItem('__antcvDiagSeeded')) return;
    localStorage.setItem('__antcvDiagSeeded','1');
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','d@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'d@e.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify({cv:[{id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'P.'}],cl:[]}));
    localStorage.setItem('personalInfo',JSON.stringify({name:'Anita'}));
    localStorage.setItem('wizardCompleted', JSON.stringify(true));
  },{neutraliseLab});
  const errs=[]; let navs=0;
  page.on('pageerror',e=>errs.push(String(e&&e.message)));
  page.on('framenavigated',f=>{ if(f===page.mainFrame()) navs++; });
  await page.goto(`http://127.0.0.1:${port}/index.html`,{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(6000);
  const navsAfterBoot=navs;
  await page.evaluate((subtab)=>{ window._antcvOpenSettingsRoute && window._antcvOpenSettingsRoute({ tier:'standard', subtab }); },subtab);
  await page.waitForTimeout(3000); // let the lab poll fire and inject
  // scroll every scrollable container to the bottom, several passes
  for (let pass=0; pass<6; pass++) {
    await page.evaluate(()=>{
      const els=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+40 && /(auto|scroll)/.test(getComputedStyle(e).overflowY));
      els.forEach(e=>{ e.scrollTop = e.scrollHeight; e.dispatchEvent(new Event('scroll',{bubbles:true})); });
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(2500);
  const after = await page.evaluate(()=>({
    bodyLen:(document.body.innerText||'').length,
    settingsOpen: !!document.querySelector('form') || /settings/i.test(document.body.innerText||''),
    labHost: !!document.getElementById('antcv-llm-lab'),
    labVer: window.__antcvLlmLab,
  })).catch(e=>({evalFailed:String(e&&e.message)}));
  console.log(`[${label}] navsAfterBoot=${navsAfterBoot} navsTotal=${navs} reloaded=${navs>navsAfterBoot} pageErrors=${errs.length} ${errs.slice(0,3).join(' | ').slice(0,300)}`);
  console.log(`[${label}] after:`, JSON.stringify(after));
  await page.close();
  return { reloaded: navs>navsAfterBoot, errs };
}

const a = await run('account + lab ACTIVE', false, 'account');
const k = await run('keys + lab ACTIVE', false, 'keys');
const b = await run('account + lab NEUTRALISED', true, 'account');
await browser.close(); server.close();
console.log('VERDICT: account/lab=', a.reloaded||a.errs.length>0, ' keys/lab=', k.reloaded||k.errs.length>0, ' account/no-lab=', b.reloaded||b.errs.length>0);
