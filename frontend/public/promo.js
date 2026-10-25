// Motor de la promo autorreproducible. Va en un archivo externo (no inline) a propósito: la CSP
// del sitio usa script-src 'self' sin 'unsafe-inline', así que un <script> inline queda bloqueado.
(function(){
  var stage=document.getElementById('stage');
  var scenes=[].slice.call(stage.querySelectorAll('.scene'));
  var durs=scenes.map(function(s){return +s.dataset.dur||3500});
  var starts=[],acc=0; durs.forEach(function(d){starts.push(acc);acc+=d}); var total=acc;

  var segsEl=document.getElementById('segs'), fills=[];
  scenes.forEach(function(){
    var seg=document.createElement('div'); seg.className='seg';
    var f=document.createElement('span'); f.className='fill'; seg.appendChild(f);
    segsEl.appendChild(seg); fills.push(f);
  });

  var dotsEl=document.getElementById('dots'), dots=[];
  scenes.forEach(function(_,i){
    var b=document.createElement('button'); b.className='jd'; b.setAttribute('role','tab');
    b.setAttribute('aria-label','Escena '+(i+1));
    b.addEventListener('click',function(){ seek(i); });
    dotsEl.appendChild(b); dots.push(b);
  });

  var qr=document.getElementById('qr');
  if(qr){
    var pat=[1,1,1,0,1,1,1, 1,0,1,0,0,0,1, 1,1,1,0,1,0,1, 0,0,0,1,0,1,0, 1,0,1,0,1,1,1, 1,0,0,1,0,0,1, 1,1,1,0,1,0,1];
    pat.forEach(function(v){var i=document.createElement('i'); if(!v)i.className='off'; qr.appendChild(i);});
  }

  var elapsed=0, playing=true, last=null, cur=-1, ended=false;
  var playBtn=document.getElementById('playBtn'),
      playLabel=document.getElementById('playLabel'),
      playIcon=document.getElementById('playIcon');
  var ICON_PAUSE='M6 5h4v14H6zM14 5h4v14h-4z', ICON_PLAY='M8 5v14l11-7z';

  function setScene(i){
    if(i===cur) return; cur=i;
    scenes.forEach(function(s,k){ s.classList.toggle('active',k===i); });
    dots.forEach(function(d,k){ d.setAttribute('aria-current', k===i?'true':'false'); });
  }
  function paint(){
    var i=0; for(var k=0;k<scenes.length;k++){ if(elapsed>=starts[k]) i=k; }
    setScene(i);
    for(var j=0;j<fills.length;j++){
      var p = elapsed>=starts[j]+durs[j] ? 1 : (elapsed<=starts[j] ? 0 : (elapsed-starts[j])/durs[j]);
      fills[j].style.width=(p*100)+'%';
    }
  }
  function setPlaying(p){
    playing=p; playLabel.textContent=p?'Pausar':'Reproducir';
    playIcon.innerHTML='<path d="'+(p?ICON_PAUSE:ICON_PLAY)+'"/>';
  }
  function loop(ts){
    if(last==null) last=ts;
    var dt=ts-last; last=ts;
    if(playing && !ended){
      elapsed+=dt;
      if(elapsed>=total){ elapsed=total; ended=true; setPlaying(false); }
      paint();
    }
    requestAnimationFrame(loop);
  }
  function seek(i){ elapsed=starts[i]+1; ended=false; last=null; if(!playing)setPlaying(true); paint(); }

  playBtn.addEventListener('click',function(){
    if(ended){ elapsed=0; ended=false; last=null; setPlaying(true); paint(); return; }
    setPlaying(!playing);
  });
  document.getElementById('replayBtn').addEventListener('click',function(){
    elapsed=0; ended=false; last=null; setPlaying(true); paint();
  });

  setScene(0); paint(); setPlaying(true);
  requestAnimationFrame(loop);
})();
