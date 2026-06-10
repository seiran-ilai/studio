// 內容進場：DOMContentLoaded 後直接揭曉，由 CSS 的 rise 動畫接手
(function(){
  var root=document.documentElement;
  function reveal(){ root.classList.add("loaded"); }
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",reveal);
  }else{
    reveal();
  }
})();

// 作者資訊 Modal
(function(){
  var modal=document.getElementById("author-modal");
  var openBtn=document.getElementById("open-author");
  var closeBtn=document.getElementById("close-author");
  if(!modal||!openBtn) return;
  var lastFocus=null;
  function open(){ lastFocus=document.activeElement; modal.classList.add("open");
    var f=modal.querySelector(".am-link"); if(f) f.focus(); }
  function close(){ modal.classList.remove("open"); if(lastFocus) lastFocus.focus(); }
  openBtn.addEventListener("click",open);
  if(closeBtn) closeBtn.addEventListener("click",close);
  modal.addEventListener("click",function(e){ if(e.target.hasAttribute("data-close")) close(); });
  document.addEventListener("keydown",function(e){ if(e.key==="Escape"&&modal.classList.contains("open")) close(); });
})();
