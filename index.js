// 手機阻擋
(function(){var el=document.getElementById("mobile-block");
  function c(){el.classList.toggle("show",window.innerWidth<1024);}c();window.addEventListener("resize",c);})();

// Loader
(function(){
  var loader=document.getElementById('loader');
  var root=document.documentElement;
  function reveal(){ root.classList.add('loaded'); }
  if(!loader){ reveal(); return; }
  var numEl=loader.querySelector('.loader-num');
  var barEl=loader.querySelector('.loader-bar span');
  var start=null, dur=1700;
  function ease(p){ return p<.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2; }
  function step(ts){
    if(start===null) start=ts;
    var p=Math.min(1,(ts-start)/dur), e=ease(p);
    if(numEl) numEl.textContent=String(Math.round(e*100)).padStart(3,'0');
    if(barEl) barEl.style.transform='scaleX('+e+')';
    if(p<1){ requestAnimationFrame(step); }
    else {
      setTimeout(function(){ loader.classList.add('done'); reveal(); },300);
      setTimeout(function(){ loader.style.display='none'; },1400);
    }
  }
  requestAnimationFrame(step);
  // 保險：最多 5 秒後一定揭曉
  setTimeout(function(){ if(!root.classList.contains('loaded')){ loader.classList.add('done'); reveal(); setTimeout(function(){loader.style.display='none';},1200);} },5000);
})();

// 作者資訊 Modal
(function(){
  var modal=document.getElementById('author-modal');
  var openBtn=document.getElementById('open-author');
  var closeBtn=document.getElementById('close-author');
  if(!modal||!openBtn) return;
  var lastFocus=null;
  function open(){ lastFocus=document.activeElement; modal.classList.add('open');
    var f=modal.querySelector('.am-link'); if(f) f.focus(); }
  function close(){ modal.classList.remove('open'); if(lastFocus) lastFocus.focus(); }
  openBtn.addEventListener('click',open);
  if(closeBtn) closeBtn.addEventListener('click',close);
  modal.addEventListener('click',function(e){ if(e.target.hasAttribute('data-close')) close(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&modal.classList.contains('open')) close(); });
})();
