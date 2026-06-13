/* DIAGNOSTIC — render Copenhagen Modern preview and screenshot the real palette.
 * Goal: SEE whether the candidate band is dark + sidebar is bright (intended),
 * or both dark (the inverted bug the owner reported). Renders two variants:
 *   A. stylePackage = 'copenhagen-modern' (named)
 *   B. stylePackage = 'custom' + navyColor (the Advanced-control path)
 * Writes screenshots to pwa/test/out/ and prints the computed bg of the
 * candidate band, the sidebar, and the first sidebar heading's color.
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'test', 'out');
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=>{
  try{ let rel=decodeURIComponent((req.url||'/').split('?')[0]); if(rel==='/')rel='/index.html'; const fp=path.join(ROOT,rel); const s=await stat(fp).catch(()=>null); if(!s||!s.isFile()){res.writeHead(404);res.end('nf');return;} res.writeHead(200,{'content-type':MIME[path.extname(fp)]||'application/octet-stream'}); res.end(await readFile(fp)); }catch(e){res.writeHead(500);res.end(String(e&&e.message));}
});
await new Promise(r=>server.listen(0,r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
await mkdir(OUT,{recursive:true});

const SECTIONS = {
  cv: [
    { id:'profile', title:'PROFILE', loc:'main', on:true, type:'text', content:'IT expert with consumer and regulated-market experience. 15+ years across product, change governance and validation.' },
    { id:'competencies', title:'CORE COMPETENCIES', loc:'main', on:true, type:'table', rows:[['Change governance','Change Control Board ownership under Automotive SPICE and ISO 26262.'],['Supplier coordination','RFQ and RFI evaluation; scoring on quality, lead time, total landed cost.']] },
    { id:'experience', title:'PROFESSIONAL EXPERIENCE', loc:'main', on:true, type:'experience', items:['Founded a consultancy bridging hardware product development and technical-commercial evaluation.','Led RFQ and RFI evaluation programmes: structured supplier scoring.'] },
    { id:'tools', title:'TOOLS & METHODS', loc:'sidebar', on:true, type:'text', content:'Jira, Confluence, Codebeamer. Power BI, Excel, SQL, Python.' },
    { id:'certs', title:'CERTIFICATES & COURSES', loc:'sidebar', on:true, type:'text', content:'AI-Practitioner. Six Sigma Black Belt. Automotive SPICE.' },
    { id:'education', title:'EDUCATION', loc:'sidebar', on:true, type:'text', content:'MBA — Technion. M.Sc. Electrical Engineering — Tel Aviv University.' },
  ],
  cl: []
};
const PINFO = { name:'Gabriel Alexander Karp-Gershon', title:'Processes • Products • People', email:'g@example.com', phone:'+45 31 71 00 72', location:'2300 Kobenhavn S', photo:'' };

async function render(label, pkg, navy, styleConfig){
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:1400,height:1700} });
  await page.addInitScript(({sections,pinfo,pkg,navy,styleConfig})=>{
    localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@example.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
    localStorage.setItem('session',JSON.stringify({email:'g@example.com',ts:1717000000000}));
    localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
    localStorage.setItem('sections',JSON.stringify(sections));
    localStorage.setItem('personalInfo',JSON.stringify(pinfo));
    localStorage.setItem('language',JSON.stringify('en'));
    localStorage.setItem('wizardCompleted',JSON.stringify(true));
    localStorage.setItem('stylePackage',JSON.stringify(pkg));
    if(navy) localStorage.setItem('navyColor',JSON.stringify(navy));
    if(styleConfig) localStorage.setItem('styleConfig',JSON.stringify(styleConfig));
  },{sections:SECTIONS,pinfo:PINFO,pkg,navy,styleConfig});
  const errs=[]; page.on('pageerror',e=>errs.push(String(e&&e.message)));
  await page.goto(base+'/index.html',{waitUntil:'load',timeout:30000});
  await page.waitForTimeout(3500);
  // Dump every painted (non-transparent bg) element in the preview, with its bg,
  // text color, inline style, and a text snippet — ground truth for the palette.
  const dump = await page.evaluate(()=>{
    const out=[];
    const norm=c=>c&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent';
    for(const el of document.querySelectorAll('*')){
      const cs=getComputedStyle(el);
      const bg=cs.backgroundColor, bgi=cs.backgroundImage;
      if(!norm(bg)&&(!bgi||bgi==='none')) continue;
      const r=el.getBoundingClientRect();
      if(r.width<120||r.height<24) continue; // skip tiny chips
      const t=(el.textContent||'').replace(/\s+/g,' ').trim().slice(0,40);
      out.push({ tag:el.tagName.toLowerCase(), bg, bgi:bgi&&bgi!=='none'?bgi.slice(0,60):'', color:cs.color, w:Math.round(r.width), h:Math.round(r.height), x:Math.round(r.left), y:Math.round(r.top), inline:(el.getAttribute('style')||'').slice(0,90), text:t });
    }
    // sort top-to-bottom, then by area desc
    return out.sort((a,b)=>a.y-b.y||b.w*b.h-a.w*a.h).slice(0,24);
  });
  console.log(`\n[${label}] pkg=${pkg} navy=${navy||'-'} — painted elements (y-order):`);
  for(const d of dump){ console.log(`  y${d.y} ${d.w}x${d.h} bg=${d.bg}${d.bgi?' IMG':''} col=${d.color} "${d.text}" | ${d.inline}`); }
  const vars = await page.evaluate(()=>{
    const cs=getComputedStyle(document.body);
    const g=n=>cs.getPropertyValue(n).trim();
    const band=document.querySelector('[data-antcv-candidate-band]');
    const paper=document.querySelector('.antcv-preview-paper');
    const tokenized=[...(paper?paper.querySelectorAll('[data-antcv-sidebar-bg-token="1"]'):[])].map(el=>({tag:el.tagName,w:Math.round(el.getBoundingClientRect().width),inlineBg:el.style.backgroundColor,computed:getComputedStyle(el).backgroundColor}));
    return {
      dataPackage: document.body.getAttribute('data-package'),
      packageBase:g('--package-base'), headerBg:g('--header-bg'), sidebarBg:g('--sidebar-bg'), mainHead:g('--main-head-color'),
      bandInline: band?band.style.backgroundColor:null, bandStyleAttr: band?band.getAttribute('style').slice(0,120):null, bandComputed: band?getComputedStyle(band).backgroundColor:null, bandTagged: band?band.getAttribute('data-antcv-sidebar-bg-token'):null,
      tokenized,
    };
  });
  console.log(`  [vars] data-package=${vars.dataPackage} --package-base=${vars.packageBase} --header-bg=${vars.headerBg} --sidebar-bg=${vars.sidebarBg} --main-head=${vars.mainHead}`);
  console.log(`  [band] inline=${vars.bandInline} computed=${vars.bandComputed} tokenized=${vars.bandTagged}`);
  console.log(`  [band] style="${vars.bandStyleAttr}"`);
  console.log(`  [tokenized els] ${JSON.stringify(vars.tokenized)}`);
  // Find the preview band + sidebar by probing computed backgrounds.
  const probe = await page.evaluate(()=>{
    const out={};
    const rgb=el=>el?getComputedStyle(el).backgroundColor:null;
    const txt=el=>el?getComputedStyle(el).color:null;
    // candidate band: the element containing the name
    const all=[...document.querySelectorAll('div,section,header')];
    const nameEl=all.find(e=>/Karp-Gershon/.test(e.textContent||'')&&e.children.length<8&&e.offsetHeight>0&&e.offsetHeight<300);
    // sidebar: element containing TOOLS & METHODS heading
    const sideHead=[...document.querySelectorAll('*')].find(e=>/TOOLS & METHODS/.test(e.textContent||'')&&(e.children.length<3));
    let sideContainer=sideHead; for(let i=0;i<6&&sideContainer;i++){ const r=rgb(sideContainer); if(r&&r!=='rgba(0, 0, 0, 0)'&&r!=='transparent') break; sideContainer=sideContainer.parentElement; }
    out.bandBg = nameEl?rgb([...all].find(e=>{let p=nameEl;for(let i=0;i<6&&p;i++){const r=rgb(p);if(r&&r!=='rgba(0, 0, 0, 0)')return p===e;p=p.parentElement;}return false;})||nameEl):null;
    // simpler: walk up from name to first painted bg
    let bandC=nameEl; for(let i=0;i<6&&bandC;i++){ const r=rgb(bandC); if(r&&r!=='rgba(0, 0, 0, 0)'&&r!=='transparent'){out.bandBg=r;break;} bandC=bandC.parentElement; }
    out.bandText = txt(nameEl);
    out.sidebarBg = rgb(sideContainer);
    out.sidebarHeadColor = txt(sideHead);
    return out;
  });
  await page.screenshot({ path: path.join(OUT, `copenhagen-${label}.png`), fullPage:false });
  await browser.close();
  console.log(`\n[${label}] pkg=${pkg} navy=${navy||'-'}`);
  console.log('  candidate band bg :', probe.bandBg, ' text:', probe.bandText);
  console.log('  sidebar        bg :', probe.sidebarBg, ' head:', probe.sidebarHeadColor);
  if(errs.length) console.log('  pageerrors:', errs.slice(0,3).join(' | '));
  return probe;
}

await render('A-named', 'copenhagen-modern', null, null);
await render('B-custom-navy', 'custom', '#1B627F', { headerBg:'#1B627F', sidebarBg:'#1B627F' });
await new Promise(r=>server.close(r));
console.log('\nScreenshots in pwa/test/out/. Intended: band DARK, sidebar BRIGHT/pale.');
