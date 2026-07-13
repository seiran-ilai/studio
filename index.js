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

// 分類頁籤切換
(function(){
  var tablist=document.querySelector(".tabs");
  if(!tablist) return;
  var tabs=Array.prototype.slice.call(tablist.querySelectorAll(".tab"));

  function activate(tab,focus){
    tabs.forEach(function(t){
      var selected=t===tab;
      t.classList.toggle("is-active",selected);
      t.setAttribute("aria-selected",selected?"true":"false");
      t.tabIndex=selected?0:-1;
      var panel=document.getElementById(t.getAttribute("aria-controls"));
      if(panel){ panel.classList.toggle("is-active",selected); panel.hidden=!selected; }
    });
    if(focus) tab.focus();
  }

  tabs.forEach(function(tab,i){
    tab.addEventListener("click",function(){ activate(tab,false); });
    tab.addEventListener("keydown",function(e){
      var next=null;
      if(e.key==="ArrowRight"||e.key==="ArrowDown") next=tabs[(i+1)%tabs.length];
      else if(e.key==="ArrowLeft"||e.key==="ArrowUp") next=tabs[(i-1+tabs.length)%tabs.length];
      else if(e.key==="Home") next=tabs[0];
      else if(e.key==="End") next=tabs[tabs.length-1];
      if(next){ e.preventDefault(); activate(next,true); }
    });
  });
})();
