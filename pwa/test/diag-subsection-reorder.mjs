/* DIAGNOSTIC — SUBSECTION-RENAME-REORDER-001 (#3). Renders the editor with a 2-group
 * REGULATORY CONTEXT section, asserts ↑/↓ controls inject on the group subheadings,
 * clicks the first group's ↓, and verifies the subsection block moved (store + render). */
import { chromium } from 'playwright';
const URL='http://localhost:8799/index.html';
const SECTIONS={cv:[
  {id:'profile',title:'PROFILE',loc:'main',on:true,type:'text',content:'IT expert.'},
  {id:'regulatory',title:'REGULATORY CONTEXT',loc:'sidebar',on:true,type:'labeled_list',items:[
    {group:'Systems & Safety'},{l:'ASPICE',v:'Requirements'},{l:'ISO 26262',v:'Functional safety'},
    {group:'Electrical & EMC'},{l:'CISPR 25',v:'Emissions'},{l:'ISO 11452',v:'Immunity'},
  ]},
],cl:[]};
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:1400}});
const errs=[];p.on('pageerror',e=>errs.push(String(e&&e.message)));
await p.addInitScript(({sections})=>{
  localStorage.setItem('antcv:auth:token','t');localStorage.setItem('antcv:auth:email','g@e.com');localStorage.setItem('antcv:auth:expires_at','4102444800');
  localStorage.setItem('session',JSON.stringify({email:'g@e.com',ts:1717000000000}));
  localStorage.setItem('step',JSON.stringify('editor'));localStorage.setItem('doc',JSON.stringify('cv'));
  localStorage.setItem('sections',JSON.stringify(sections));localStorage.setItem('personalInfo',JSON.stringify({name:'G'}));
  localStorage.setItem('language',JSON.stringify('en'));localStorage.setItem('wizardCompleted',JSON.stringify(true));
  localStorage.setItem('stylePackage',JSON.stringify('copenhagen-modern'));
},{sections:SECTIONS});
await p.goto(URL,{waitUntil:'load',timeout:30000});
await p.waitForTimeout(4200);
const groupsBefore=await p.evaluate(()=>JSON.parse(localStorage.getItem('sections')).cv.find(s=>s.id==='regulatory').items.filter(i=>i.group!==undefined).map(i=>i.group));
const arrowCount=await p.evaluate(()=>document.querySelectorAll('.antcv-subreorder').length);
// click the FIRST group's down arrow (▼)
const clicked=await p.evaluate(()=>{
  const sec=[...document.querySelectorAll('[data-sid="regulatory"]')][0];
  const first=sec.querySelector('.antcv-subreorder');
  const down=first && first.querySelectorAll('button')[1];
  if(!down) return false;
  down.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  return true;
});
await p.waitForTimeout(1200);
const groupsAfter=await p.evaluate(()=>JSON.parse(localStorage.getItem('sections')).cv.find(s=>s.id==='regulatory').items.filter(i=>i.group!==undefined).map(i=>i.group));
const renderOrder=await p.evaluate(()=>{
  const sec=[...document.querySelectorAll('[data-sid="regulatory"]')][0];
  return [...sec.querySelectorAll('[data-antcv-row-path]')].map(r=>r.innerText.replace(/[▲▼\s]+/g,' ').trim()).filter(Boolean).slice(0,6);
});
await b.close();
const checks=[];const ck=(n,ok,d)=>{checks.push(ok);console.log((ok?'OK  ':'FAIL ')+n+(ok?'':'  '+(d||'')));};
console.log('groupsBefore',JSON.stringify(groupsBefore));
console.log('arrowCount',arrowCount,'clicked',clicked);
console.log('groupsAfter ',JSON.stringify(groupsAfter));
console.log('renderOrder ',JSON.stringify(renderOrder));
ck('two ↑/↓ control groups injected (one per subheading)', arrowCount===2, String(arrowCount));
ck('before: Systems & Safety first', groupsBefore[0]==='Systems & Safety');
ck('after click ▼: Electrical & EMC moved to first (store)', groupsAfter[0]==='Electrical & EMC', JSON.stringify(groupsAfter));
ck('render reflects the new order (Electrical block before Systems)', renderOrder.findIndex(t=>/Electrical/.test(t)) < renderOrder.findIndex(t=>/Systems/.test(t)), JSON.stringify(renderOrder));
ck('no page errors', errs.length===0, errs.slice(0,2).join(' | '));
const ok=checks.every(Boolean);
console.log(ok?'SUBSECTION-REORDER OK':'SUBSECTION-REORDER FAIL');
process.exit(ok?0:1);
