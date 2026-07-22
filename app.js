import { MAX_PLAYERS, calculateScore, createToken, escapeHtml, generateRoomCode, normalizeNickname, normalizeRoomCode, shuffle, sortLeaderboard } from './game-core.mjs';

const $ = (s) => document.querySelector(s);
const app = $('#app');
const toast = $('#toast');
const TRACKS = [
  ['Neon Circuit','Procedural Demo','ai',11,'Generated from seeded note-transition rules.'],
  ['Ode to Joy Motif','L. van Beethoven','human',22,'Human-composed public-domain melody, rendered in the browser.'],
  ['Dream State','Procedural Demo','ai',33,'Generated from probabilistic rhythm and harmony rules.'],
  ['Twinkle Theme','Traditional','human',44,'Traditional human melody, rendered in the browser.'],
  ['Pulse Machine','Procedural Demo','ai',55,'Generated automatically from tempo and transition rules.'],
  ['Fifth Symphony Motif','L. van Beethoven','human',66,'Human-composed public-domain motif, rendered in the browser.'],
].map(([title,artist,kind,seed,why],i)=>({id:`t${i+1}`,title,artist,kind,seed,why}));

const R = {
  view:'home', role:null, peer:null, host:null, conns:new Map(), state:null, code:'',
  token:localStorage.sgaiToken || createToken(), name:localStorage.sgaiName || '', timer:null, audio:null, nodes:[], played:null,
};
localStorage.sgaiToken = R.token;
let PeerClass = window.Peer || null;

function flash(text){ toast.textContent=text; toast.classList.add('show'); clearTimeout(flash.t); flash.t=setTimeout(()=>toast.classList.remove('show'),2600); }
function header(){ return `<header><div class="brand"><b>♫</b> Song Guess: AI Or Real</div><button data-act="leave">Home</button></header>`; }
async function peerLib(){
  if(PeerClass) return PeerClass;
  for(const src of ['https://cdn.jsdelivr.net/npm/peerjs@1.5.5/dist/peerjs.min.js','https://unpkg.com/peerjs@1.5.5/dist/peerjs.min.js']){
    try{ await new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=no;document.head.append(s)}); if(window.Peer) return PeerClass=window.Peer; }catch{}
  }
  throw Error('Multiplayer networking could not load.');
}
function cleanName(v){ const n=normalizeNickname(v); if(n.length<2) throw Error('Nickname must be at least 2 characters.'); return n; }
function players(){ return R.role==='host' ? Object.values(R.state.players) : (R.state?.players||[]); }
function me(){ return players().find(p=>p.token===R.token); }
function safeState(){
  const s=R.state, reveal=['reveal','final'].includes(s.phase), track=s.tracks[s.round]||null;
  return {code:s.code,phase:s.phase,settings:s.settings,round:s.round,started:s.started,deadline:s.deadline,
    players:Object.values(s.players).map(p=>({token:p.token,name:p.name,ready:p.ready,online:p.online,score:p.score,submitted:!!p.answer,answer:reveal?p.answer:null,delta:reveal?p.delta:0})),
    track:track?{id:track.id,...(reveal?track:{})}:null};
}
function sendState(){ if(R.role!=='host') return; const m={type:'state',state:safeState()}; for(const c of R.conns.values()) if(c.open)c.send(m); render(); }
function playerByToken(token){ return R.state?.players?.[token] || null; }
function hostState(code,name){ return {code,phase:'lobby',settings:{rounds:6,seconds:30},round:0,started:0,deadline:0,tracks:shuffle(TRACKS),players:{[R.token]:{token:R.token,name,ready:true,online:true,score:0,answer:null,delta:0}}}; }

async function createRoom(name){
  name=cleanName(name); const code=generateRoomCode(); Object.assign(R,{role:'host',code,name,state:hostState(code,name)}); localStorage.sgaiName=name;
  const Peer=await peerLib(); R.peer?.destroy(); R.peer=new Peer(`sgai-${code}`);
  R.peer.on('open',()=>{R.view='lobby';history.replaceState({},'',`?room=${code}`);render()});
  R.peer.on('connection',c=>{c.on('data',m=>hostMessage(c,m));c.on('close',()=>{const t=c.metadata?.token;if(t&&R.state.players[t]){R.state.players[t].online=false;sendState()}})});
  R.peer.on('error',e=>flash(e.type==='unavailable-id'?'Room code collision. Create another room.':e.message));
}
function hostMessage(c,m){
  if(!m||typeof m!=='object')return;
  if(m.type==='join'){
    const name=normalizeNickname(m.name), token=String(m.token||''), existing=R.state.players[token];
    if(!name||!token)return c.send({type:'error',message:'Invalid join request.'});
    if(Object.values(R.state.players).some(p=>p.token!==token&&p.name.toLowerCase()===name.toLowerCase()))return c.send({type:'error',message:'Nickname already in use.'});
    if(!existing&&Object.keys(R.state.players).length>=MAX_PLAYERS)return c.send({type:'error',message:'Room is full.'});
    if(R.state.phase!=='lobby'&&!existing)return c.send({type:'error',message:'Game already started.'});
    R.state.players[token]=existing||{token,name,ready:false,online:true,score:0,answer:null,delta:0}; Object.assign(R.state.players[token],{name,online:true}); c.metadata={token};R.conns.set(token,c);c.send({type:'joined'});sendState();return;
  }
  const p=playerByToken(c.metadata?.token); if(!p)return;
  if(m.type==='ready'&&R.state.phase==='lobby'){p.ready=!!m.ready;sendState()}
  if(m.type==='answer')submit(c.metadata.token,m.answer,Date.now());
}
async function joinRoom(code,name){
  code=normalizeRoomCode(code);name=cleanName(name);if(code.length!==6)throw Error('Enter a valid six-character code.');Object.assign(R,{role:'guest',code,name});localStorage.sgaiName=name;
  const Peer=await peerLib();R.peer?.destroy();R.peer=new Peer();
  R.peer.on('open',()=>{const c=R.peer.connect(`sgai-${code}`,{reliable:true,metadata:{token:R.token}});R.host=c;c.on('open',()=>c.send({type:'join',name,token:R.token}));c.on('data',guestMessage);c.on('close',()=>flash('Connection lost. Rejoin from the invite link.'))});
  R.peer.on('error',e=>flash(e.message||'Connection failed.'));
}
function guestMessage(m){ if(m.type==='error')return flash(m.message); if(m.type==='state'){R.state=m.state;R.view=m.state.phase==='lobby'?'lobby':'game';syncAudio();render()} }
function toggleReady(){const p=me();if(!p)return;if(R.role==='host'){R.state.players[R.token].ready=!p.ready;sendState()}else R.host?.send({type:'ready',ready:!p.ready})}
function canStart(){const p=Object.values(R.state.players);return p.length>=2&&p.every(x=>x.ready&&x.online)}
function startGame(){if(R.role!=='host'||!canStart())return;R.state.round=0;for(const p of Object.values(R.state.players))p.score=0;startRound()}
function startRound(){const now=Date.now();R.state.phase='countdown';R.state.started=now+3000;R.state.deadline=R.state.started+R.state.settings.seconds*1000;for(const p of Object.values(R.state.players)){p.answer=null;p.delta=0}sendState();clearTimeout(R.timer);R.timer=setTimeout(()=>{R.state.phase='playing';sendState();syncAudio();R.timer=setTimeout(reveal,R.state.settings.seconds*1000)},3000)}
function submit(token,answer,at){if(R.role!=='host'||R.state.phase!=='playing'||at>R.state.deadline||!['ai','human'].includes(answer))return;const p=R.state.players[token];if(!p||p.answer)return;p.answer={value:answer,at};sendState();if(Object.values(R.state.players).filter(x=>x.online).every(x=>x.answer))reveal()}
function answer(value){if(me()?.submitted)return;if(R.role==='host')submit(R.token,value,Date.now());else R.host?.send({type:'answer',answer:value})}
function reveal(){if(R.role!=='host'||!['countdown','playing'].includes(R.state.phase))return;clearTimeout(R.timer);const t=R.state.tracks[R.state.round];for(const p of Object.values(R.state.players)){p.delta=calculateScore({correct:p.answer?.value===t.kind,submittedAt:p.answer?.at,startedAt:R.state.started,durationMs:R.state.settings.seconds*1000});p.score+=p.delta}R.state.phase='reveal';sendState();R.timer=setTimeout(()=>{R.state.round++;if(R.state.round>=R.state.settings.rounds){R.state.phase='final';sendState()}else startRound()},6000)}
function replay(){if(R.role!=='host')return;R.state.phase='lobby';R.state.round=0;R.state.tracks=shuffle(TRACKS);for(const p of Object.values(R.state.players)){p.ready=p.token===R.token;p.score=0;p.answer=null;p.delta=0}sendState()}
function settings(form){R.state.settings.rounds=Number(form.rounds.value);R.state.settings.seconds=Number(form.seconds.value);sendState()}

function stopAudio(){for(const n of R.nodes)try{n.stop()}catch{}R.nodes=[]}
function synth(track,start){stopAudio();const C=window.AudioContext||window.webkitAudioContext;if(!C)return;R.audio||=new C();R.audio.resume();const ctx=R.audio,base=track.kind==='human'?[261,330,392,523]:[220,277,349,415],offset=Math.max(0,(Date.now()-start)/1000);for(let i=0;i<24;i++){const when=ctx.currentTime+i*.24-offset;if(when<ctx.currentTime-.2)continue;const o=ctx.createOscillator(),g=ctx.createGain();o.type=track.kind==='human'?'triangle':'sawtooth';o.frequency.value=base[(i+track.seed)%base.length]*(track.kind==='ai'?(1+((i*track.seed)%5)*.012):1);g.gain.setValueAtTime(.0001,Math.max(ctx.currentTime,when));g.gain.exponentialRampToValueAtTime(.045,Math.max(ctx.currentTime,when)+.02);g.gain.exponentialRampToValueAtTime(.0001,Math.max(ctx.currentTime,when)+.2);o.connect(g).connect(ctx.destination);o.start(Math.max(ctx.currentTime,when));o.stop(Math.max(ctx.currentTime,when)+.22);R.nodes.push(o)}}
function syncAudio(){const s=R.role==='host'?safeState():R.state;if(!s||s.phase!=='playing')return;const key=`${s.round}-${s.started}`;if(R.played===key)return;R.played=key;const t=TRACKS.find(x=>x.id===s.track?.id);if(t)synth(t,s.started)}

function board(ps){return `<div class="board">${sortLeaderboard(ps).map((p,i)=>`<div><span>#${i+1} ${escapeHtml(p.name)}</span><b>${p.score}</b></div>`).join('')}</div>`}
function home(){const code=normalizeRoomCode(new URLSearchParams(location.search).get('room')||'');app.innerHTML=`<main class="shell">${header()}<section class="hero"><small>LIVE MULTIPLAYER MUSIC CHALLENGE</small><h1>AI made it.<br><em>Or did it?</em></h1><p>Invite friends, listen together, and score points for fast correct guesses.</p></section><section class="cards"><article><h2>Create a room</h2><p>Host a lobby and share a six-character code.</p><button class="primary" data-act="create">Create lobby</button></article><article><h2>Join friends</h2><p>Use a room code or invite link.</p><button data-act="join" data-code="${code}">Join lobby</button></article></section></main>`}
function form(type,prefill=''){const join=type==='join';app.innerHTML=`<main class="shell">${header()}<section class="panel form"><h1>${join?'Join a lobby':'Create a lobby'}</h1><form id="entry">${join?`<label>Room code<input name="code" maxlength="6" value="${escapeHtml(prefill)}" required></label>`:''}<label>Nickname<input name="name" maxlength="24" value="${escapeHtml(R.name)}" required></label><div class="row"><button type="button" data-act="leave">Cancel</button><button class="primary grow">${join?'Join room':'Create room'}</button></div></form></section></main>`;$('#entry').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('.primary');b.disabled=true;try{join?await joinRoom(e.currentTarget.code.value,e.currentTarget.name.value):await createRoom(e.currentTarget.name.value)}catch(err){flash(err.message);b.disabled=false}}}
function lobby(){const s=R.role==='host'?safeState():R.state,p=me();app.innerHTML=`<main class="shell">${header()}<section class="lobby"><article class="panel"><div class="code"><div><small>ROOM CODE</small><strong>${s.code}</strong></div><button data-act="copy">Copy invite</button></div><h2>Players <span>${s.players.length}/${MAX_PLAYERS}</span></h2><div class="players">${s.players.map(x=>`<div><span class="avatar">${escapeHtml(x.name[0])}</span><p><b>${escapeHtml(x.name)}</b><small>${x.online?'Connected':'Disconnected'} · ${x.score} points</small></p><strong class="${x.ready?'ok':'wait'}">${x.ready?'READY':'NOT READY'}</strong></div>`).join('')}</div></article><aside class="panel"><h2>Game settings</h2>${R.role==='host'?`<form id="settings"><label>Rounds<select name="rounds">${[2,3,4,5,6].map(n=>`<option ${s.settings.rounds===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Round time<select name="seconds">${[10,15,20,30,45].map(n=>`<option ${s.settings.seconds===n?'selected':''}>${n}</option>`).join('')}</select></label></form>`:`<p>${s.settings.rounds} rounds · ${s.settings.seconds}s each</p>`}<div class="row"><button class="grow" data-act="ready">${p?.ready?'Not ready':'Ready up'}</button>${R.role==='host'?`<button class="primary grow" data-act="start" ${canStart()?'':'disabled'}>Start</button>`:''}</div></aside></section></main>`;$('#settings')?.addEventListener('change',e=>settings(e.currentTarget))}
function game(){const s=R.role==='host'?safeState():R.state,p=me(),now=Date.now();if(s.phase==='final'){app.innerHTML=`<main class="shell">${header()}<section class="panel game"><small>GAME COMPLETE</small><h1>Final leaderboard</h1>${board(s.players)}${R.role==='host'?'<button class="primary" data-act="again">Play again</button>':''}</section></main>`;return}if(s.phase==='reveal'){app.innerHTML=`<main class="shell">${header()}<section class="panel game"><small>ANSWER REVEALED</small><h1 class="reveal-title">${s.track.kind==='ai'?'AI MADE':'HUMAN MADE'}</h1><h2>${escapeHtml(s.track.title)}</h2><p>${escapeHtml(s.track.artist)} · ${escapeHtml(s.track.why)}</p><h2 class="${p.delta>=0?'good':'bad'}">${p.delta>=0?'+':''}${p.delta} points</h2>${board(s.players)}</section></main>`;return}const countdown=s.phase==='countdown',left=Math.max(0,Math.ceil(((countdown?s.started:s.deadline)-now)/1000));app.innerHTML=`<main class="shell">${header()}<section class="panel game"><div class="gamebar"><span>Round ${s.round+1}/${s.settings.rounds}</span><span>${p?.score||0} points</span></div><small>${countdown?'GET READY':'LISTEN AND DECIDE'}</small><div class="timer">${left}</div><div class="wave">${'<i></i>'.repeat(18)}</div>${countdown?'<h2>Audio starts when the countdown ends</h2>':`<div class="answers"><button data-answer="ai" ${p?.submitted?'disabled':''}>AI MADE</button><button data-answer="human" ${p?.submitted?'disabled':''}>HUMAN MADE</button></div><p>${s.players.filter(x=>x.submitted).length}/${s.players.filter(x=>x.online).length} submitted${p?.submitted?' · Your answer is locked':''}</p>`}</section></main>`}
function render(){clearInterval(R.tick);if(R.view==='home')home();else if(R.view==='create')form('create');else if(R.view==='join')form('join',R.code);else if(R.view==='lobby')lobby();else game();if(R.state&&['countdown','playing'].includes(R.state.phase))R.tick=setInterval(game,250)}
app.addEventListener('click',e=>{const a=e.target.closest('[data-act]'),ans=e.target.closest('[data-answer]');if(ans)return answer(ans.dataset.answer);if(!a)return;const x=a.dataset.act;if(x==='leave'){stopAudio();R.peer?.destroy();Object.assign(R,{view:'home',role:null,peer:null,state:null,host:null,code:''});history.replaceState({},'',location.pathname);render()}if(x==='create'){R.view='create';render()}if(x==='join'){R.view='join';R.code=a.dataset.code||'';render()}if(x==='ready')toggleReady();if(x==='start')startGame();if(x==='again')replay();if(x==='copy'){const u=`${location.origin}${location.pathname}?room=${R.code}`;navigator.clipboard?.writeText(u).then(()=>flash('Invite copied.')).catch(()=>flash(u))}});
const invited=normalizeRoomCode(new URLSearchParams(location.search).get('room')||'');if(invited){R.code=invited;R.view='join'}render();
