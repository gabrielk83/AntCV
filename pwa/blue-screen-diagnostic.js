// Paste into DevTools console when the blue screen is on screen.
// Shows what's actually rendered + what's covering what.
(function(){
  var cx = innerWidth/2, cy = innerHeight/2;
  var top = document.elementFromPoint(cx, cy);

  console.log('=== AntCV blue-screen diagnostic ===');
  console.log('viewport center hit:');
  if (top) {
    var cs = getComputedStyle(top);
    console.log('  tag:', top.tagName, 'id:', top.id || '-', 'cls:', String(top.className).slice(0,80));
    console.log('  pos:', cs.position, 'z:', cs.zIndex);
    console.log('  bg-color:', cs.backgroundColor, 'bg-image:', cs.backgroundImage.slice(0,80));
    console.log('  text preview:', (top.innerText || '').slice(0,120).replace(/\s+/g,' '));
  } else console.log('  (no element at center)');

  console.log('\n.fade elements:');
  document.querySelectorAll('.fade').forEach(function(f, i){
    var cs = getComputedStyle(f);
    console.log('  #'+i,
      'visible:', cs.display!=='none' && cs.visibility!=='hidden',
      'h:', f.offsetHeight, 'children:', f.childElementCount,
      'innerText.len:', f.innerText.length,
      'firstChild.cls:', f.firstElementChild ? String(f.firstElementChild.className).slice(0,40) : '-');
    if (f.innerText.length < 200) console.log('    full text:', f.innerText);
  });

  console.log('\ntop 8 fixed/absolute elements w/ z>=100 covering >60% viewport:');
  var stacked = [];
  document.querySelectorAll('*').forEach(function(n){
    var cs = getComputedStyle(n);
    if (cs.position!=='fixed' && cs.position!=='absolute' && cs.position!=='sticky') return;
    if (cs.display==='none' || cs.visibility==='hidden' || parseFloat(cs.opacity)<0.05) return;
    var z = parseInt(cs.zIndex,10); if (isNaN(z) || z<100) return;
    if (n.offsetWidth*n.offsetHeight < 0.6*innerWidth*innerHeight) return;
    stacked.push({z:z, tag:n.tagName, id:n.id||'-', cls:String(n.className).slice(0,40),
                  w:n.offsetWidth, h:n.offsetHeight, bg:cs.backgroundColor.slice(0,30)});
  });
  stacked.sort(function(a,b){return b.z-a.z});
  console.table(stacked.slice(0,8));

  console.log('\nbody top-level visible children:');
  Array.from(document.body.children).forEach(function(n){
    var cs = getComputedStyle(n);
    if (cs.display==='none') return;
    console.log(' ', n.tagName, 'id:', n.id||'-', 'cls:', String(n.className).slice(0,50), 'z:', cs.zIndex);
  });
})();
