/* DIAGNOSTIC — SALMON-PAGE3-MISSING-001 (owner 2026-06-22).
 * The measurer was 2-page scope (experience pass wrote only =2), so a 3-page CV had no
 * page2→3 salmon ("page 3 break should have been around the Security Guard role"). The N-page
 * greedy fill should now assign roles to pages 2 AND 3. Drives the REAL measurer against a
 * 3-page CV and asserts:
 *   (A) antcv:autoPagesPreview[experience] has a role on page 3 (a 2nd break exists);
 *   (B) the preview renders >= 3 page-boxes;
 *   (C) stable across repeats; (D) no app errors.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf' };
const server = http.createServer(async (req,res)=>{ try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); if(!fp.startsWith(ROOT)){res.writeHead(403);res.end();return;} const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;

// ~10 roles with bullets → main column spans 3 A4 pages, forcing breaks at page 2 AND page 3.
const longBullet = (n) => `Bullet ${n} — drove a cross-functional initiative restructuring the operating model, delivering measurable outcomes across regions and stakeholders while cutting cycle time and cost over a sustained multi-quarter programme of work.`;
const role = (i) => ({ id:'r'+i, title:'Role '+i+(i===13?" — Security Guard":''), company:'Company '+i, years:'20'+(8+i)+' – 20'+(10+i), on:true, bullets:[longBullet(1),longBullet(2),longBullet(3),longBullet(4)] });
const roles = []; for (let i=1;i<=16;i++) roles.push(role(i));

const sections = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', text:'Programme leader. '.repeat(8) },
    { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', roles },
    { id:'skills', title:'KEY SKILLS', loc:'sidebar', on:true, type:'labeled_list', items: [{l:'A',v:'A'},{l:'B',v:'B'}] },
  ],
  cl: [],
};
const personalInfo = { name:'Anita Myre-Kornfeldt', headline:'X', email:'a@e.com', phone:'+45', location:'Copenhagen' };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1400, height:1000 } });
await page.addInitScript(([secs, pi])=>{
  localStorage.setItem('antcv:auth:token','diag'); localStorage.setItem('antcv:auth:email','d@e.com');
  localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session', JSON.stringify({ email:'d@e.com', ts:1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(secs)); localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('antcv:autoPages','{}'); localStorage.setItem('antcv:autoPagesPreview','{}'); localStorage.setItem('antcv:itemPages','{}');
}, [sections, personalInfo]);

const errs=[];
page.on('pageerror',e=>errs.push('pageerror: '+(e&&e.message)));
page.on('console',m=>{ if(m.type()==='error'){const t=m.text(); if(!/CORS|workers\.dev|Failed to load|net::ERR|relay/i.test(t)) errs.push('console.error: '+t);} });

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:'domcontentloaded', timeout:60000 });
await page.waitForTimeout(11000); // let the measurer settle naturally

function snap() {
  return page.evaluate(()=>{
    const prev = JSON.parse(localStorage.getItem('antcv:autoPagesPreview')||'{}');
    const exp = prev.experience || {};
    const pageVals = Object.keys(exp).map(k=>({ role:k, page:exp[k] }));
    const maxPage = pageVals.reduce((m,x)=>Math.max(m, Number(x.page)||0), 1);
    return {
      expMap: exp, maxPage,
      pageRows: document.querySelectorAll('.antcv-page-row').length,
      salmons: document.querySelectorAll('.antcv-page-row').length - 1,
    };
  });
}
const s1 = await snap();
await page.waitForTimeout(4000);
const s2 = await snap();

await browser.close(); await new Promise(r=>server.close(r));

console.log('settled :', JSON.stringify(s1));
console.log('re-read :', JSON.stringify(s2));
console.log('app errors:', errs.length, errs.slice(0,4).join(' | '));

let fail = 0;
const check=(c,l)=>{ console.log((c?'PASS':'FAIL')+' — '+l); if(!c) fail++; };
check(s1.maxPage >= 3, `experience map has a role on page >= 3 (maxPage=${s1.maxPage}, map=${JSON.stringify(s1.expMap)})`);
check(s1.pageRows >= 3, `preview rendered >= 3 page-boxes (pageRows=${s1.pageRows})`);
check(JSON.stringify(s1.expMap) === JSON.stringify(s2.expMap), `experience map stable across +4s (no oscillation)`);
check(errs.length === 0, 'no app errors');

console.log('\n' + (fail===0 ? 'ALL N-PAGE DIAG CHECKS PASS' : fail+' CHECK(S) FAILED'));
process.exitCode = fail===0 ? 0 : 1;
