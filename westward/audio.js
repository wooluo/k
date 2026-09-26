/* audio.js — Web Audio 合成音效 + 三态 BGM（零素材·全离线） */
'use strict';
const AUD=(function(){
  let ctx=null,master=null,bgmGain=null,bgmTimer=null,bgmMode='';
  let muted=false;
  try{muted=localStorage.getItem('wd_mute')==='1';}catch(e){}
  function init(){
    if(ctx)return true;
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      ctx=new AC();
      master=ctx.createGain();master.gain.value=muted?0:0.5;master.connect(ctx.destination);
      bgmGain=ctx.createGain();bgmGain.gain.value=0.15;bgmGain.connect(master);
    }catch(e){return false;}
    return true;
  }
  function resume(){if(ctx&&ctx.state==='suspended')ctx.resume().catch(()=>{});}
  function tone(f,dur,type,vol,slide,delay){
    if(!ctx||muted)return;
    try{
      const t0=ctx.currentTime+(delay||0);
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=type||'square';o.frequency.setValueAtTime(f,t0);
      if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,slide),t0+dur);
      g.gain.setValueAtTime(vol||0.2,t0);
      g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
      o.connect(g);g.connect(master);
      o.start(t0);o.stop(t0+dur+0.02);
    }catch(e){}
  }
  function noise(dur,vol,delay,cut){
    if(!ctx||muted)return;
    try{
      const t0=ctx.currentTime+(delay||0);
      const n=Math.max(64,ctx.sampleRate*dur|0);
      const buf=ctx.createBuffer(1,n,ctx.sampleRate);
      const d=buf.getChannelData(0);
      for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);
      const s=ctx.createBufferSource();s.buffer=buf;
      const g=ctx.createGain();g.gain.value=vol||0.25;
      const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=cut||1800;
      s.connect(f);f.connect(g);g.connect(master);
      s.start(t0);
    }catch(e){}
  }
  const SFX={
    ui(){tone(660,0.06,'square',0.1);tone(880,0.08,'square',0.09,null,0.05);},
    blip(){tone(520,0.045,'square',0.07);},
    confirm(){tone(523,0.07,'square',0.11);tone(784,0.1,'square',0.11,null,0.06);},
    hit(){noise(0.12,0.3);tone(180,0.1,'sawtooth',0.16,60);},
    crit(){noise(0.16,0.35);tone(240,0.14,'sawtooth',0.2,50);tone(120,0.18,'square',0.18,40,0.03);},
    skill(){tone(392,0.08,'square',0.13,620);tone(660,0.12,'square',0.11,920,0.07);noise(0.1,0.18,0.06,2600);},
    hurt(){tone(160,0.16,'sawtooth',0.18,70);noise(0.1,0.2);},
    heal(){tone(523,0.1,'sine',0.15);tone(659,0.1,'sine',0.15,null,0.08);tone(784,0.16,'sine',0.15,null,0.16);},
    item(){tone(880,0.07,'sine',0.13);tone(1175,0.1,'sine',0.13,null,0.06);},
    flee(){for(let i=0;i<4;i++)tone(500+i*140,0.05,'square',0.09,null,i*0.05);},
    victory(){[523,659,784,1047].forEach((f,i)=>tone(f,0.14,'square',0.13,null,i*0.11));},
    defeat(){[392,330,262,196].forEach((f,i)=>tone(f,0.2,'sawtooth',0.12,f*0.8,i*0.16));},
    levelup(){[523,587,659,784,880,1047].forEach((f,i)=>tone(f,0.1,'square',0.13,null,i*0.07));},
    gold(){tone(1319,0.06,'square',0.09);tone(1760,0.09,'square',0.09,null,0.05);},
    boss(){[110,98,87,110].forEach((f,i)=>tone(f,0.3,'sawtooth',0.16,null,i*0.22));noise(0.4,0.12,0,500);},
    tower(){[220,262,330,392,523].forEach((f,i)=>tone(f,0.16,'square',0.13,null,i*0.1));},
    achieve(){[659,784,1047,1319].forEach((f,i)=>tone(f,0.12,'triangle',0.14,null,i*0.09));},
  };
  /* ---- BGM：五声音阶序列器 ---- */
  const SEQ={
    title:{bpm:50,root:220,notes:[0,4,7,4,9,7,4,2,0,4,7,9,12,9,7,4],wave:'sine',bass:[0,0,7,7],perc:0},
    field:{bpm:64,root:262,notes:[0,2,4,7,4,2,0,-3,0,2,4,9,7,4,2,0],wave:'triangle',bass:[0,7,5,7],perc:0},
    dark:{bpm:44,root:174,notes:[0,3,7,3,10,7,3,0],wave:'sine',bass:[0,0,3,3],perc:0},
    battle:{bpm:126,root:196,notes:[0,0,7,0,5,7,0,10,0,0,7,0,3,5,7,12],wave:'square',bass:[0,0,5,7],perc:1},
  };
  let seqI=0,bassI=0;
  function beatMs(m){return 60/SEQ[m].bpm*1000;}
  function bgmNote(){
    if(!ctx||muted||!bgmMode||!SEQ[bgmMode])return;
    const s=SEQ[bgmMode];
    const semi=n=>s.root*Math.pow(2,n/12);
    const t0=ctx.currentTime,beat=60/s.bpm;
    try{
      const n=s.notes[seqI%s.notes.length];
      const o=ctx.createOscillator(),g=ctx.createGain();
      o.type=s.wave;o.frequency.value=semi(n);
      g.gain.setValueAtTime(0.001,t0);
      g.gain.linearRampToValueAtTime(0.5,t0+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,t0+beat*0.92);
      o.connect(g);g.connect(bgmGain);
      o.start(t0);o.stop(t0+beat);
      if(seqI%2===0){
        const b=s.bass[bassI%s.bass.length];
        const o2=ctx.createOscillator(),g2=ctx.createGain();
        o2.type='triangle';o2.frequency.value=semi(b)/2;
        g2.gain.setValueAtTime(0.001,t0);
        g2.gain.linearRampToValueAtTime(0.65,t0+0.03);
        g2.gain.exponentialRampToValueAtTime(0.001,t0+beat*1.7);
        o2.connect(g2);g2.connect(bgmGain);
        o2.start(t0);o2.stop(t0+beat*2);
        bassI++;
      }
      if(s.perc&&seqI%2===1){
        const n2=Math.max(64,ctx.sampleRate*0.05|0);
        const buf=ctx.createBuffer(1,n2,ctx.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<n2;i++)d[i]=(Math.random()*2-1)*(1-i/n2);
        const src=ctx.createBufferSource();src.buffer=buf;
        const g3=ctx.createGain();g3.gain.value=0.5;
        const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=900;
        src.connect(f);f.connect(g3);g3.connect(bgmGain);
        src.start(t0);
      }
    }catch(e){}
    seqI++;
  }
  function bgm(mode){
    if(!ctx&&!init())return;
    if(mode===bgmMode)return;
    if(bgmTimer){clearInterval(bgmTimer);bgmTimer=null;}
    bgmMode=mode;seqI=0;bassI=0;
    if(!mode||muted)return;
    bgmNote();
    bgmTimer=setInterval(bgmNote,beatMs(mode));
  }
  function toggle(){
    muted=!muted;
    try{localStorage.setItem('wd_mute',muted?'1':'0');}catch(e){}
    if(master)master.gain.value=muted?0:0.5;
    if(muted){if(bgmTimer){clearInterval(bgmTimer);bgmTimer=null;}}
    else if(bgmMode){const m=bgmMode;bgmMode='';bgm(m);}
    return muted;
  }
  return {init,resume,sfx:SFX,bgm,toggle,
    get muted(){return muted;},get mode(){return bgmMode;}};
})();
window.AUD=AUD;
