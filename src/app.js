(function(){
"use strict";
const $ = id => document.getElementById(id);
const LS = {
  get(k, d){ try{ const v = localStorage.getItem('fm_'+k); return v===null? d : JSON.parse(v);}catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('fm_'+k, JSON.stringify(v)); }catch(e){} }
};

// ---------- State ----------
let scenarios = [];            // builtin + custom
let S = null;                  // active scenario (normalised)
let history = [];              // [{role:'user'|'assistant', content}]
let board = {};                // heading -> [points]
let revealed = new Set();      // key fact ids
let qCount = 0;
let lastTurns = [];            // [{speaker, text}]
let whisperText = '';
let busy = false;
let student = null;            // {n, q, types:[], facts, lifeline, coach}
let lastSuggested = '';        // suggested next question from the last answer (lifeline)
let stage = 'opening';         // 'opening' (introductions and checks) or 'questions'
let openingDone = new Set();   // opening check ids covered so far
const OPENING = [
  {id:'intro', label:'Introduced yourself and your role'},
  {id:'purpose', label:'Explained why you are meeting'},
  {id:'hearing', label:'Checked they can hear and see you clearly'},
  {id:'comfort', label:'Checked they are comfortable and have time'},
  {id:'privacy', label:'Checked privacy and any needs (interpreter, cultural)'}
];
const cfg = {
  perStudent: ()=> parseInt(LS.get('perStudent', 3)),
  coachOn: ()=> LS.get('coachOn', true),
  lifelineOn: ()=> LS.get('lifelineOn', true),
  brief: ()=> LS.get('brief', true)
};
function newStudent(n, intro){ return {n:n, q:0, types:[], facts:0, lifeline:false, intro: !!intro}; }

function normalise(sc){
  // Accept old single-character files as well as the new "characters" list.
  const s = Object.assign({}, sc);
  if(!s.characters && s.character){
    s.characters = [Object.assign({ id: (s.character.name||'a').toLowerCase(), opening: s.openingLine, persona: s.persona, facts: s.facts||[], notKnown: s.notKnown||[] }, s.character)];
  }
  s.characters = (s.characters||[]).map((c,i)=> Object.assign({ id: c.id || ('c'+i), facts:[], notKnown:[], voice:'female' }, c));
  s.interactionRules = s.interactionRules || [];
  s.headings = s.headings || ["Likes and interests","Dislikes","Changed behaviour","What helped","What did not help","Concerns to report"];
  return s;
}
function loadScenarios(){
  const custom = LS.get('customScenarios', []);
  scenarios = [...(window.BUILTIN_SCENARIOS||[]), ...custom].map(normalise);
}
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove('show'),2800); }
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

// Who is played by the AI (teacher may take over any character except the first)
function teacherPlays(){ return LS.get('teacherPlays_'+S.id, []); }
function aiCharacters(){ const tp = teacherPlays(); return S.characters.filter(c=>!tp.includes(c.id)); }
function charByName(name){ const n = String(name||'').toLowerCase(); return S.characters.find(c=>c.name.toLowerCase()===n) || S.characters.find(c=>n.includes(c.name.toLowerCase())) || null; }

// ---------- Scenario / UI setup ----------
function applyScenario(id){
  S = scenarios.find(s=>s.id===id) || scenarios[0];
  LS.set('scenarioId', S.id);
  setupMode();
  $('hTitle').textContent = S.title;
  $('hUnit').textContent = S.unit || '';
  $('personName').textContent = S.person;
  renderPersona();
  const names = aiCharacters().map(c=>c.name);
  const who = names.length>1? names.slice(0,-1).join(', ')+' and '+names[names.length-1] : (names[0]||'the family');
  document.querySelectorAll('.tCharName').forEach(e=>e.textContent=who);
  $('question').placeholder = 'Your question for '+who+' appears here. You can also type it, then press Send.';
  if(isVisit()) $('question').placeholder = 'What you say appears here. For an action, say or type what you do (for example: I sit down next to her), then press Do.';
  $('tRole').textContent = (S.teacher&&S.teacher.role)||'';
  $('tCues').innerHTML = ((S.teacher&&S.teacher.cues)||[]).map(c=>'<li>'+esc(c)+'</li>').join('');
  $('tDebrief').innerHTML = ((S.teacher&&S.teacher.debrief)||[]).map(c=>'<li>'+esc(c)+'</li>').join('');
  restoreSession();
  if(isVisit()) renderPersona();
  renderBoard();
}
// Switch the screen between a family meeting (default) and a support visit (scenario type "visit")
function setupMode(){
  const v = isVisit();
  $('see').classList.toggle('hidden', !v);
  $('btnDo').classList.toggle('hidden', !v);
  $('btnStage').classList.add('hidden');
  $('tVisit').classList.toggle('hidden', !v);
  $('btnSend').textContent = v? 'Say' : 'Send';
  $('btnStart').textContent = v? 'Start visit' : 'Start meeting';
  $('micLabel').textContent = v? 'Speak' : 'Ask a question';
  $('dotLegend').textContent = v? 'one dot per turn · green = new checklist point' : 'intro · green open · orange closed';
  $('dotLegend').title = v? 'One dot per turn (something said or done). Green = that turn showed a new checklist point.' : 'First mark = introduction done. Then one dot per question: green = open, orange = closed';
  $('btnLifeline').title = v? 'Show one idea for what to say or do (one per student)' : 'Show a suggested question (one per student)';
  $('boardTitle').innerHTML = v? 'Checklist: what the class has shown<span id="personName" class="hidden"></span>' : 'What we have learned about <span id="personName"></span>';
  $('board').className = v? 'board checklist' : 'board';
  $('btnExport').textContent = v? 'Session for students (Word)' : 'Download board (Word)';
  $('btnExportTeacher').classList.toggle('hidden', !v);
}
function picKey(sc, c){ return 'pic_'+sc.id+'_'+c.id; }
function portraitHTML(sc, c){
  const custom = LS.get(picKey(sc,c), '');
  if(custom) return '<img src="'+custom+'" alt="">';
  const P = window.PORTRAITS||{};
  const kind = c.portrait || (c.voice==='male' ? 'olderMan' : 'olderWoman');
  return P[kind] || P.olderWoman || '';
}
function renderPersona(){
  const tp = teacherPlays();
  const chars = isVisit()? stageChars() : S.characters;   // a support visit shows only the person in the current part
  const n = chars.length;
  const t = $('tiles');
  t.style.gridTemplateColumns = 'repeat('+Math.min(n,3)+', 1fr)';
  t.innerHTML = chars.map(c=>'<div class="tile'+(tp.includes(c.id)?' teacher':'')+'" data-id="'+esc(c.id)+'"><div class="pic">'+portraitHTML(S,c)+'</div><div class="name"><span class="mic">&#127908;</span><b>'+esc(c.name)+'</b><small>'+esc(c.relation)+'</small></div></div>').join('');
}
function setSpeaking(name){
  document.querySelectorAll('.tile').forEach(p=>p.classList.remove('speaking'));
  const c = charByName(name); if(!c) return;
  const el = document.querySelector('.tile[data-id="'+c.id+'"]'); if(el) el.classList.add('speaking');
}

// ---------- Student turns and coaching ----------
function renderTurn(){
  if(isVisit()) return renderVisitTurn();
  if(!student) student = newStudent(1);
  const per = cfg.perStudent();
  const opening = stage==='opening';
  $('btnBegin').classList.toggle('hidden', !opening || !history.length);
  if(opening){
    $('studentLabel').textContent = history.length? 'Student '+student.n+' · open the meeting first' : 'Student '+student.n;
  } else if(!student.intro){
    $('studentLabel').textContent = 'Student '+student.n+' · introduce yourself first';
  } else {
    $('studentLabel').textContent = 'Student '+student.n+(student.q>=per? ' · turn finished, press Next student' : ' · question '+(student.q+1)+' of '+per);
  }
  const introDone = !opening && student.intro;
  const dots = ['<i class="'+(introDone? 'done' : '')+'" title="Introduction" style="border-radius:6px">'+'</i>'];
  for(let i=0;i<per;i++){ const ty = student.types[i]; dots.push('<i class="'+(ty? 'done '+(ty==='open'?'open':ty==='closed'?'closed':'') : '')+'" title="'+(ty||'')+'"></i>'); }
  $('dots').innerHTML = dots.join('');
  const ll = $('btnLifeline'); ll.classList.toggle('hidden', !cfg.lifelineOn()); ll.disabled = !!student.lifeline || !history.length || opening || !student.intro;
  ll.textContent = student.lifeline ? 'Lifeline used' : 'Lifeline: show me a question';
  $('btnNext').classList.toggle('primary', student.q>=per); $('btnNext').classList.toggle('ghost', student.q<per);
  renderExplore();
}
function renderExplore(){
  const empty = S.headings.filter(h=>!(board[h]||[]).length);
  $('explore').innerHTML = empty.length? 'Still to explore: '+empty.map(h=>'<span>'+esc(h)+'</span>').join('') : 'Every area has something on the board. Now go deeper: ask follow-up questions.';
}
function showCoach(html, summary){
  const c = $('coach'); if(!html){ c.classList.add('hidden'); return; }
  c.innerHTML = html; c.classList.toggle('summary', !!summary); c.classList.remove('hidden');
}
function turnSummary(){
  const open = student.types.filter(t=>t==='open').length, closed = student.types.filter(t=>t==='closed').length, other = student.types.length-open-closed;
  const parts = [];
  parts.push('<b>Student '+student.n+', turn finished.</b> '+student.types.length+' question'+(student.types.length===1?'':'s')+': '+open+' open, '+closed+' closed'+(other? ', '+other+' other':'')+'.');
  parts.push('New facts uncovered: <b>'+student.facts+'</b>.');
  if(open===student.types.length && student.facts>=3) parts.push('Excellent interviewing: every question was open and the family opened up.');
  else if(student.facts>=3) parts.push('Good digging. The family told you a lot.');
  else if(open===0) parts.push('Next time try starting with "Tell me about..." or "How did...". Open questions bring out stories.');
  else parts.push('Try a follow-up on something they said. That is where the detail is.');
  if(student.lifeline) parts.push('(Lifeline used.)');
  return parts.join(' ');
}
function openingHTML(){
  const items = OPENING.map(o=>'<span style="display:inline-block;margin:2px 10px 2px 0">'+(openingDone.has(o.id)? '<span style="color:var(--ok)">&#10003;</span> ' : '<span style="color:var(--muted)">&#9675;</span> ')+esc(o.label)+'</span>').join('');
  const done = openingDone.size>=OPENING.length;
  return '<b>Opening checks</b> '+(done? '<span style="color:var(--ok)">all covered.</span> Press <b>Begin questions</b>, or <b>Next student</b> to let someone else practise the opening.' : '')+'<div style="font-size:.95em;margin-top:4px">'+items+'</div>';
}
function nextStudent(){
  if(isVisit()) return visitNextStudent();
  const n = student? student.n+1 : 1;
  student = newStudent(n); $('qType').classList.add('hidden');
  if(stage==='opening'){
    openingDone = new Set();
    // keep the model's memory short: the next student starts the opening again
    history = history.slice(0,2).concat([{role:'user', content:'TEACHER: A different student has now sat down to practise opening the meeting. Behave as if the call has just connected again and you have not been introduced to this person. Do not mention the previous student.'},{role:'assistant', content: JSON.stringify({turns:[], question_type:'', tip:'', coach:'', suggested_question:'', board:[], facts:[], opening:[]})}]);
    showTurns([{speaker:'', text: S.characters.map(c=>c.name).join(' and ')+' are on the call, waiting. Introduce yourself.'}]);
    speakTurns([], S.characters.map(c=>c.name).join(' and ')+' are on the call, waiting. Student '+n+', introduce yourself.');
    showCoach(openingHTML());
    toast('Student '+n+': open the meeting.');
  } else {
    history = history.concat([{role:'user', content:'TEACHER: A different student (a new staff member) has now taken over the call. They should say hello and give their name and role before asking anything. If they ask about '+S.person+' before introducing themselves, do not answer; ask kindly who you are speaking to. Once they introduce themselves, greet them briefly and carry on.'},{role:'assistant', content: JSON.stringify({turns:[], question_type:'', tip:'', coach:'', suggested_question:'', board:[], facts:[], opening:[]})}]);
    showCoach('<b>Student '+n+':</b> say hello, your name and your role. Then ask your '+cfg.perStudent()+' questions.');
    toast('Student '+n+': introduce yourself, then ask your questions.');
  }
  renderTurn(); saveSession();
}
function finishOpening(){
  stage = 'questions'; student.intro = true;
  history = history.concat([{role:'user', content:'TEACHER: The opening is complete. The meeting now moves to questions about '+S.person+'. This same student will ask the questions. Answer normally from now on.'},{role:'assistant', content: JSON.stringify({turns:[], question_type:'', tip:'', coach:'', suggested_question:'', board:[], facts:[], opening:[]})}]);
  showCoach('<b>Opening complete.</b> Student '+student.n+', now ask your '+cfg.perStudent()+' questions about '+S.person+'.', true);
  renderTurn(); saveSession();
}
function beginQuestions(){
  // Teacher skips the rest of the opening
  if(!student) student = newStudent(1);
  finishOpening(); toast('Opening skipped. Questions stage.');
}
function useLifeline(){
  if(!student || student.lifeline || !cfg.lifelineOn()) return;
  const q = lastSuggested || ((S.starterQuestions||[])[Math.floor(Math.random()*(S.starterQuestions||[]).length)]) || 'Can you tell me more about what a normal day looked like at home?';
  student.lifeline = true;
  showCoach('<b>Lifeline.</b> You could '+(isVisit()? 'say or do' : 'ask')+': <i>"'+esc(q)+'"</i> Put it in your own words.');
  $('question').value = ''; $('question').placeholder = q;
  renderTurn(); saveSession();
}

function blankSession(){
  history = []; board = {}; revealed = new Set(); qCount = 0; lastTurns=[]; whisperText=''; student = newStudent(1); lastSuggested=''; stage='opening'; openingDone = new Set(); boardFacts = new Set();
  S.headings.forEach(h=>board[h]=[]);
  visitBlank();
  $('log').innerHTML=''; $('qType').classList.add('hidden'); showCoach(''); renderTurn();
  showTurns([{speaker:'', text: LS.get('apiKey','')? 'Press Start meeting when the class is ready.' : 'Press Settings to add your key, then press Start meeting.'}]);
  if(isVisit()) showTurns([{speaker:'', text: LS.get('apiKey','')? 'Press Start visit when the class is ready.' : 'Press Settings to add your key, then press Start visit.'}]);
}
function saveSession(){
  LS.set('session_'+S.id, Object.assign({history, board, revealed:[...revealed], qCount, lastTurns, student, lastSuggested, stage, openingDone:[...openingDone], boardFacts:[...boardFacts], log: $('log').innerHTML}, isVisit()? {vstage, points, calm, seeText, vlog, names, quizSeen:[...quizSeen]} : {}));
}
function restoreSession(){
  const s = LS.get('session_'+S.id, null);
  blankSession();
  if(s && s.history && s.history.length){
    history = s.history; board = Object.assign(board, s.board||{}); revealed = new Set(s.revealed||[]); qCount = s.qCount||0; lastTurns = s.lastTurns||[]; student = s.student||newStudent(1, true); if(student.intro===undefined) student.intro = true; lastSuggested = s.lastSuggested||''; stage = s.stage || 'questions'; openingDone = new Set(s.openingDone||[]); boardFacts = new Set(s.boardFacts||[]);
    if(isVisit()){ vstage = s.vstage || vstage; points = s.points||{}; calm = s.calm||calm; seeText = s.seeText||''; vlog = s.vlog||[]; names = s.names||{}; quizSeen = new Set(s.quizSeen||[]); }
    $('log').innerHTML = s.log||''; renderTurn();
    showTurns(lastTurns.length? lastTurns : [{speaker:'', text:'Meeting in progress. Ask the next question.'}]);
  }
}

function renderBoard(){
  if(isVisit()) return renderChecklist();
  const b = $('board'); b.innerHTML='';
  S.headings.forEach(h=>{
    const col = document.createElement('div'); col.className='col'+(/concern/i.test(h)?' concern':'');
    col.innerHTML = '<h3>'+esc(h)+'</h3><ul>'+(board[h]||[]).map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>';
    b.appendChild(col);
  });
  const total = (S.keyFacts||[]).length, got = [...revealed].filter(id=>(S.keyFacts||[]).some(f=>f.id===id)).length;
  $('progress').textContent = total? got+' of '+total+' key facts uncovered' : '';
  $('barFill').style.width = total? Math.round(100*got/total)+'%' : '0%';
  if($('explore')) renderExplore();
  $('tFacts').innerHTML = (S.keyFacts||[]).map(f=>'<li class="'+(revealed.has(f.id)?'done':'')+'">'+esc(f.label)+' <span style="color:var(--muted)">('+esc(f.heading)+')</span></li>').join('');
}
let boardFacts = new Set();   // key fact ids already represented on the board
const STOP = new Set(['the','a','an','and','or','of','to','in','on','at','for','with','his','her','he','she','was','is','were','from','when','while','that','it','as','by','be','has','had','not','into','up','out','very','about','after','before','until','wilson','val','rosie','clifton','stuart']);
function words(s){ return new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w && !STOP.has(w) && w.length>2)); }
function similar(a1,b1){ const A=words(a1), B=words(b1); if(!A.size||!B.size) return false; let n=0; A.forEach(w=>{ if(B.has(w)) n++; }); const j = n/Math.min(A.size,B.size); return j>=0.6; }
function addToBoard(items, reported, fresh){
  reported = reported||[]; fresh = fresh||[];
  const added = [];
  (items||[]).forEach(it=>{
    if(!it || !it.heading || !it.point) return;
    const want = String(it.heading).toLowerCase();
    const h = S.headings.find(x=>x.toLowerCase()===want) || S.headings.find(x=>x.toLowerCase().includes(want.split(' ')[0]));
    if(!h) return;
    const p = String(it.point).trim().replace(/\.$/,'');
    if(!p) return;
    let fid = it.fact && (S.keyFacts||[]).some(f=>f.id===it.fact) ? it.fact : '';
    if(!fid && reported.length && !fresh.length) return;           // answer only repeated facts already known
    if(!fid && fresh.length===1) fid = fresh[0];                    // untagged point in an answer with one new fact
    if(fid && boardFacts.has(fid)) return;                         // same fact already on the board
    const all = [].concat(...S.headings.map(x=>board[x]||[]));
    const norm = p.toLowerCase();
    if(all.some(x=>x.toLowerCase()===norm || x.toLowerCase().includes(norm) || norm.includes(x.toLowerCase()) || similar(x,p))) return;
    board[h].push(p); added.push(h+'|'+p); if(fid) boardFacts.add(fid);
  });
  renderBoard();
  added.forEach(key=>{
    const [h,p] = key.split('|');
    document.querySelectorAll('.col').forEach(col=>{
      if(col.querySelector('h3').textContent===h){ col.querySelectorAll('li').forEach(li=>{ if(li.textContent===p) li.classList.add('new'); }); }
    });
  });
  setTimeout(()=>document.querySelectorAll('li.new').forEach(li=>li.classList.remove('new')), 6000);
}

function showTurns(turns, thinking){
  const a = $('answer'); a.classList.toggle('thinking', !!thinking);
  a.innerHTML = turns.map(t=>{
    const c = charByName(t.speaker);
    return '<div class="turn '+(c&&c.voice==='male'?'male':'')+'">'+(t.speaker? '<div class="who">'+esc(t.speaker)+'</div>':'')+'<div>'+esc(t.text)+'</div></div>';
  }).join('');
}
function logLine(q, turns){
  const d = document.createElement('div');
  d.innerHTML = '<b>S'+(student?student.n:'')+' Q'+qCount+':</b> '+esc(q)+' '+turns.map(t=>'<br><b>'+esc(t.speaker)+':</b> '+esc(t.text)).join('');
  $('log').prepend(d);
}

// ---------- Prompt ----------
function systemPrompt(){
  if(isVisit()) return visitPrompt();
  const cast = aiCharacters();
  const tp = teacherPlays();
  const teacherChars = S.characters.filter(c=>tp.includes(c.id));
  const names = cast.map(c=>c.name);
  const lines = [];
  lines.push(`You are voicing ${names.length>1? 'the family members '+names.join(' and ') : names[0]} in a training session for aged care students in Australia. The students are support workers practising how to talk with a person's family to learn about someone living with dementia. The student is not acting; they are doing their normal job. You stay fully in character at all times.`);
  lines.push(`SETTING: ${S.setting}`);
  if(stage==='opening'){
    lines.push(`CURRENT STAGE: OPENING THE MEETING. The video call has just connected. You are waiting for the student (the support worker) to open the meeting properly. A good opening includes: introducing themselves by name and role; saying why they wanted to meet; checking you can hear and see them clearly; checking you are comfortable, have enough time and are somewhere private; and asking whether you need anything such as an interpreter or have any cultural needs. React like real people: if they introduce themselves warmly, respond warmly and give your names. If they launch straight into questions about ${S.person} without introducing themselves, do not answer the question; say something like "Sorry love, who am I speaking to?" or "Hang on, we cannot hear you very well, can you move closer?" During this stage you must NOT give any facts about ${S.person}'s life, likes, or behaviour, even if asked directly and even if the opening checks are complete; say warmly that you are happy to talk about ${S.person} once everyone is settled, or ask who you are speaking to. Small talk only. If asked whether you can hear them, answer honestly (Rosie might say the sound is a bit quiet at first). Keep each turn under 40 words.`);
  } else if(student && !student.intro){
    lines.push(`CURRENT STAGE: A NEW STAFF MEMBER HAS JUST TAKEN OVER THE CALL. The meeting was already opened by a colleague, so no need for the full checks again, but this person has not introduced themselves yet. If they ask about ${S.person} before saying who they are, do NOT answer the question: kindly ask who you are speaking to ("Sorry love, and you are?"). Once they give their name and role, greet them warmly in a few words and, if they asked a question in the same message, answer it. Report "intro" in the opening list when they have introduced themselves.`);
  } else {
    lines.push(`CURRENT STAGE: QUESTIONS ABOUT ${S.person.toUpperCase()}. The opening is done. Answer the student's questions.`);
  }
  if(cfg.brief()){
    lines.push(`HOLD BACK DETAIL: this is a class of many students and each one must discover something. Give ONE piece of information per answer (one fact, one small memory), not a list of everything you know about the topic. Answer what was asked and stop. Do not volunteer related facts; wait for a follow-up question. An open question still gets a short story, but about one thing only, in at most 60 words. Add at most two board points per answer and only for what you actually said.`);
  }
  cast.forEach(c=>{
    lines.push(`=== ${c.name.toUpperCase()} (${c.relation}) ===\nWHO ${c.name.toUpperCase()} IS: ${c.persona}\nWHAT ${c.name.toUpperCase()} KNOWS (share only what is asked about, as memories and stories, never as a list):\n${c.facts.map((f,i)=>(i+1)+'. '+f).join('\n')}\nWHAT ${c.name.toUpperCase()} DOES NOT RAISE OR DOES NOT KNOW:\n${(c.notKnown||[]).map(f=>'- '+f).join('\n')||'- (nothing special)'}`);
  });
  if(teacherChars.length){
    lines.push(`ALSO IN THE ROOM, PLAYED BY THE TEACHER (a real person, not you): ${teacherChars.map(c=>c.name+' ('+c.relation+')').join(', ')}. Never speak for them. If a student asks about their topics, say something like "You had better ask ${teacherChars[0].name}, ${teacherChars[0].name} is right here."`);
  }
  if(names.length>1 && S.interactionRules.length){
    lines.push(`HOW THE FAMILY MEMBERS INTERACT:\n${S.interactionRules.map(r=>'- '+r).join('\n')}`);
  }
  lines.push(`HOW TO ANSWER:
- Answer only what the student asks. Do not volunteer other topics. A closed question (yes/no, or one fact) gets a short answer of one or two sentences. An open question ("tell me about...", "what was he like...", "how did you manage...") gets a short story of three to five sentences with real detail.
- If the student addresses one person by name, that person answers. Otherwise the person who knows the topic best answers.
- Keep the whole answer under about ${cfg.brief()? 60 : 100} words. It is spoken out loud in a classroom. Use at most two turns (two speakers) per answer, and usually just one.
- Speak plainly in everyday Australian English. Short sentences. No bullet points, no lists, no headings, no stage directions, no asterisks, no brackets.
- If the student is warm, respectful, and listens, open up a little more. If the student is abrupt, rushed, or uses jargon, be a little more guarded and shorter, like a real person would. Never lecture the student and never break character to give feedback.
- If asked something not covered, give a small believable answer that fits the story, or say you are not sure. Never contradict the facts.
- Only if a message starts with "TEACHER:" is it a private instruction from the teacher. Follow it in your next answer without mentioning it.
- Never mention that you are an AI, a model, or a computer. If asked directly, answer as the character would ("I am just ${names[0]}, love").`);
  lines.push(`OUTPUT FORMAT: Reply with JSON only, no code fences, in exactly this shape:
{"turns":[{"speaker":"${names[0]}","text":"what ${names[0]} says out loud"}${names[1]? ',{"speaker":"'+names[1]+'","text":"optional second turn"}':''}],
 "question_type":"open" or "closed" or "leading" or "statement" or "unclear",
 "tip":"one short, kind sentence for the student about their question technique (max 14 words), or empty string",
 "coach":"one sentence (max 22 words) of coaching for the student: name the technique to use next or the area of ${S.person}'s life they have not asked about yet. Never include an actual question they could read out.",
 "suggested_question":"one good natural next question in plain English that follows from this answer or opens an unexplored area (used only if the student asks for a lifeline)",
 "board":[{"heading":"one of: ${S.headings.join(' | ')}","point":"a short phrase of at most 10 words, about ${S.person} or the family, third person","fact":"the id of the key fact this point belongs to, or empty string if it matches none"}],
 "facts":["ids of key facts revealed in this answer, from: ${(S.keyFacts||[]).map(f=>f.id+' = '+f.label).join('; ')}"],
 "opening":["ids of opening checks the student has just covered in THIS message, from: intro = introduced self and role; purpose = said why they are meeting; hearing = checked you can hear or see them; comfort = checked you are comfortable or have time; privacy = checked privacy, interpreter or cultural needs. Empty list if none."]}
The "speaker" value must be exactly one of: ${names.map(n=>'"'+n+'"').join(', ')}. Only add board points for information actually said in this answer, and never for a fact that has already come up earlier in this conversation (the board already has it). One point per fact. If nothing new, use an empty board list.`);
  return lines.join('\n\n');
}

// ---------- API ----------
async function callAPI(messages, sys){
  const key = LS.get('apiKey',''); const model = LS.get('model','');
  if(!key) throw new Error('No API key. Open Settings.');
  if(!model) throw new Error('No model chosen. Open Settings and press Load models.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
    body: JSON.stringify({model, max_tokens:800, temperature:0.7, system: sys || systemPrompt(), messages})
  });
  if(!res.ok){ let t=''; try{ t=(await res.json()).error?.message||''; }catch(e){} throw new Error('API error '+res.status+(t?': '+t:'')); }
  const data = await res.json();
  return (data.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('');
}
function parseJSON(text){
  let t = text.trim().replace(/^```(json)?/i,'').replace(/```$/,'').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a>=0 && b>a) t = t.slice(a,b+1);
  let j;
  try{ j = JSON.parse(t); }catch(e){ j = {reply: text.replace(/[{}"\[\]]/g,'').slice(0,400)}; }
  const first = aiCharacters()[0] || S.characters[0];
  let turns = Array.isArray(j.turns)? j.turns.filter(x=>x && x.text).map(x=>({speaker: (charByName(x.speaker)||first).name, text:String(x.text).trim()})) : [];
  if(!turns.length && j.reply) turns = [{speaker:first.name, text:String(j.reply).trim()}];
  if(!turns.length) turns = [{speaker:first.name, text:'...'}];
  return {turns, question_type: j.question_type||'', tip: j.tip||'', coach: j.coach||'', suggested: j.suggested_question||'', board: j.board||[], facts: j.facts||[], opening: Array.isArray(j.opening)? j.opening : []};
}

async function ask(text, opts){
  opts = opts||{};
  if(isVisit()) return visitAsk(text, opts.kind||'say');
  if(busy) return;
  text = (text||'').trim(); if(!text) return;
  const typed = !inputByMic; inputByMic = false;
  busy = true; $('btnSend').disabled=true; $('btnMic').disabled=true;
  stopSpeaking(); updateMic();
  if(typed && !opts.silent) narrateInput('The student says: '+text);
  const userContent = (whisperText? 'TEACHER: '+whisperText+'\n\nSTUDENT: '+text : text);
  whisperText='';
  if(!opts.silent){ qCount++; }
  showTurns([{speaker:'', text:'Thinking...'}], true); setSpeaking(''); showCoach('');
  try{
    const msgs = [...history, {role:'user', content:userContent}];
    const raw = await callAPI(msgs);
    const j = parseJSON(raw);
    history = [...msgs, {role:'assistant', content: raw}];
    if(history.length>40) history = history.slice(history.length-40);
    lastTurns = j.turns; showTurns(j.turns, false);
    speakTurns(j.turns);
    if(!student) student = newStudent(1, stage!=='opening');
    const gated = (stage==='opening') || !student.intro;   // nothing counts or reaches the board until introduced
    let newFacts = 0;
    if(!gated){
      const reported = (j.facts||[]).filter(id=>(S.keyFacts||[]).some(f=>f.id===id));
      const fresh = reported.filter(id=>!revealed.has(id));
      addToBoard(j.board, reported, fresh);
      const before = revealed.size; reported.forEach(id=>revealed.add(id)); renderBoard();
      newFacts = revealed.size - before;
      if(j.suggested) lastSuggested = j.suggested;
    }
    if(!opts.silent && stage==='opening'){
      (j.opening||[]).forEach(id=>{ if(OPENING.some(o=>o.id===id)) openingDone.add(id); });
      const d = document.createElement('div'); d.innerHTML = '<b>S'+student.n+' opening:</b> '+esc(text)+' '+j.turns.map(t=>'<br><b>'+esc(t.speaker)+':</b> '+esc(t.text)).join(''); $('log').prepend(d);
      qCount--;
      if(openingDone.size>=OPENING.length){ finishOpening(); }
      else { showCoach(openingHTML()); renderTurn(); }
    } else if(!opts.silent && !student.intro){
      const d = document.createElement('div'); d.innerHTML = '<b>S'+student.n+' intro:</b> '+esc(text)+' '+j.turns.map(t=>'<br><b>'+esc(t.speaker)+':</b> '+esc(t.text)).join(''); $('log').prepend(d);
      qCount--;
      if((j.opening||[]).includes('intro')){ student.intro = true; showCoach('<b>Thanks, Student '+student.n+'.</b> Now ask your '+cfg.perStudent()+' questions about '+S.person+'.', true); }
      else { showCoach('<b>Student '+student.n+':</b> introduce yourself first: your name and your role. Then your questions.'); }
      renderTurn();
    } else if(!opts.silent){
      const qt = (j.question_type||'').toLowerCase();
      student.q++; student.types.push(qt||'other'); student.facts += newFacts;
      logLine(text, j.turns);
      const badge = $('qType'); badge.className='badge '+(qt==='open'?'open':qt==='closed'?'closed':''); badge.textContent = qt? ({open:'Open question',closed:'Closed question',leading:'Leading question',statement:'Statement',unclear:'Unclear question'}[qt]||qt) : ''; badge.classList.toggle('hidden', !qt);
      const per = cfg.perStudent();
      if(student.q>=per){ showCoach(turnSummary(), true); }
      else if(cfg.coachOn()){ const line = (j.tip? j.tip+' ' : '') + (j.coach||''); showCoach(line? '<b>Coach:</b> '+esc(line) : ''); }
      renderTurn();
    }
    $('question').value=''; $('heard').textContent='';
    saveSession();
  }catch(err){
    showTurns([{speaker:'', text:'Something went wrong: '+err.message}], true); toast(err.message);
    if(!opts.silent){ qCount--; }
  }finally{
    busy=false; $('btnSend').disabled=false; $('btnMic').disabled=false; updateMic();
  }
}

// ---------- Support visit ----------
// A scenario with "type":"visit" has stages (for example Cherry, then her supervisor Lance), one person per stage,
// and an observation checklist instead of the board. The whole class takes turns as ONE support worker.
function isVisit(){ return !!(S && S.type==='visit'); }
let vstage = '';              // id of the current stage, or 'done'
let points = {};              // checklist point id ('listen' or 'services.minister') -> {n, evidence, stage}
let calm = 1;                 // 1 very upset .. 5 settled (only in a stage with "calm")
let seeText = '';             // what the students can see right now
let vlog = [];                // [{stage, n, kind:'say'|'do', text, turns, see, time}]
let sessionGen = 0;           // goes up on every Reset; an AI reply that arrives for an older session is ignored
let lastNarration = '';       // what the narrator read before the last answer (Say again repeats it)
let names = {};               // student number -> first name. Stays in this browser: never sent to the AI or read aloud.
let quizSeen = new Set();     // observer quiz question numbers reached so far
let nameFor = 0;              // student number the name box is asking for

function whoLabel(n){ return names[n]? names[n]+' (Student '+n+')' : 'Student '+n; }
function whoShort(n){ return names[n]? names[n]+' (S'+n+')' : 'Student '+n; }
function itemNumbers(){ const m = {}; let k = 0; (S.checklist||[]).forEach(g=>(g.items||[]).forEach(it=>{ m[it.id] = ++k; })); return m; }   // same numbers as the quiz and hints
function quizNumbersFor(freshPoints, freshFacts){
  // A quiz question is reached when its checklist point is shown, or when the person says something it asks about.
  const m = itemNumbers(), nums = new Set();
  (freshPoints||[]).forEach(id=>{ const n = m[id.split('.')[0]]; if(n) nums.add(n); });
  (freshFacts||[]).forEach(f=>clItems().forEach(it=>{ if((it.quizFacts||[]).includes(f)) nums.add(m[it.id]); }));
  return [...nums].sort((a,b)=>a-b);
}
function flashQuiz(nums){
  if(!nums || !nums.length) return;
  nums.forEach(n=>quizSeen.add(n));
  const el = $('quizFlash'); el.innerHTML = '<small>Quiz</small>'+nums.join(', ');
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(()=>el.classList.remove('show'), 6000);
}
function askName(n){
  nameFor = n; $('nameTitle').textContent = 'Student '+n+', your turn';
  $('nameInput').value = names[n]||''; $('nameBox').classList.remove('hidden');
  setTimeout(()=>$('nameInput').focus(), 50);
}
function closeName(save){
  const n = nameFor; if(!n) return;
  if(save){ const v = $('nameInput').value.trim().replace(/\s+/g,' ').slice(0,30); if(v) names[n] = v; else delete names[n]; }
  $('nameBox').classList.add('hidden'); nameFor = 0;
  if(student && student.n===n && vstage!=='done') showCoach('<b>'+esc(whoLabel(n))+':</b> you have '+perTurns()+' turns with '+esc(stageChars()[0].name)+'. '+(vlog.length? 'Look at the checklist and choose something that is still missing.' : 'Say something, or do something and press <b>Do</b>.'));
  renderVisitTurn(); renderChecklist(); saveSession(); $('question').focus();
}
const CALM = ['Very upset','Upset','Unsettled','Calmer','Settled'];

function vStages(){ return (S && S.stages)||[]; }
function vStage(){ const st = vStages(); return (vstage==='done'? st[st.length-1] : st.find(s=>s.id===vstage)) || st[0] || {}; }
function stageChars(){ const ids = vStage().characters||[]; const list = S.characters.filter(c=>ids.includes(c.id)); return list.length? list : S.characters.slice(0,1); }
function perTurns(){ return S.turnsPerStudent || 5; }
function clItems(){ return [].concat(...(S.checklist||[]).map(g=>(g.items||[]).map(it=>Object.assign({stage:g.stage, group:g.title}, it)))); }
function pointIds(it){ return it.parts? it.parts.map(p=>it.id+'.'+p.id) : [it.id]; }
function itemMet(it){ return pointIds(it).every(id=>points[id]); }
function stageItems(st){ return clItems().filter(it=>it.stage===st); }
function missingItems(st){ return stageItems(st).filter(it=>!itemMet(it)); }
function howText(how){ return how==='do'? 'Do' : how==='both'? 'Say + Do' : ''; }   // points shown with an action use the Do button
function howChip(how){ return how? '<span class="cl-how" title="'+(how==='do'? 'Use the Do button' : 'Say something, and use the Do button for the action')+'">'+howText(how)+'</span>' : ''; }
function missingText(it){ return it.label+(it.how? ' ('+howText(it.how)+')' : '')+(it.parts? ' ('+it.parts.filter(p=>!points[it.id+'.'+p.id]).map(p=>p.label+(p.how? ', '+howText(p.how) : '')).join('; ')+')' : ''); }
function pointLabel(id){ const [a,b] = id.split('.'); const it = clItems().find(x=>x.id===a); if(!it) return id; const p = b && (it.parts||[]).find(x=>x.id===b); return p? it.label+': '+p.label : it.label; }
function openPoints(st){
  // the points still open in a stage, with what counts, for the AI
  const out = [];
  stageItems(st).forEach(it=>{
    if(it.parts) it.parts.forEach(p=>{ if(!points[it.id+'.'+p.id]) out.push(it.id+'.'+p.id+' = '+it.label+': '+p.label+' ('+p.hint+')'); });
    else if(!points[it.id]) out.push(it.id+' = '+it.label+' ('+it.hint+')');
  });
  return out;
}
function tickPoints(list, n){
  const order = vStages().map(s=>s.id), cur = order.indexOf(vstage), fresh = [];
  (list||[]).forEach(p=>{
    const id = String((p && typeof p==='object')? p.id : p||'').trim(); if(!id || points[id]) return;
    const it = clItems().find(x=>x.id===id.split('.')[0]); if(!it || !pointIds(it).includes(id)) return;
    const si = order.indexOf(it.stage); if(si<0 || si>cur) return;          // not a point for this part (yet)
    const who = parseInt(p && p.student);
    points[id] = {n: who>0? who : n, evidence: String((p && p.evidence)||'').slice(0,160), stage: vstage};
    fresh.push(id);
  });
  return fresh;
}
function transcriptText(entries){
  return entries.map(e=>'[Student '+e.n+'] SUPPORT WORKER '+(e.kind==='do'?'DOES':'SAYS')+': '+e.text+'\n'+e.turns.map(t=>t.speaker+': '+t.text).join('\n')+(e.see? '\n(seen: '+e.see+')' : '')).join('\n');
}
function visitBlank(){
  sessionGen++;
  vstage = (vStages()[0]||{}).id || ''; points = {}; calm = vStage().calmStart || 1; seeText = ''; vlog = []; lastNarration = ''; names = {}; quizSeen = new Set();
  if(nameFor){ nameFor = 0; $('nameBox').classList.add('hidden'); }
  if(isVisit()){ busy = false; setVisitBusy(false); stage = 'questions'; student = newStudent(1, true); student.kinds = []; renderPersona(); }
}

function visitPrompt(){
  const st = vStage(), c = stageChars()[0], NAME = c.name.toUpperCase();
  const L = [];
  L.push(st.role || ('You are voicing '+c.name+' in a training session for support work students in Australia. Stay fully in character.'));
  L.push('SETTING: '+S.setting);
  if(st.place) L.push('WHERE YOU ARE NOW: '+st.place);
  L.push(`=== ${NAME} (${c.relation}) ===\nWHO ${NAME} IS: ${c.persona}\nWHAT ${NAME} KNOWS (share only what fits the moment, as memories and feelings, never as a list):\n${c.facts.map((f,i)=>(i+1)+'. '+f).join('\n')}\nWHAT ${NAME} DOES NOT KNOW OR DOES NOT RAISE:\n${(c.notKnown||[]).map(f=>'- '+f).join('\n')||'- (nothing special)'}`);
  if((st.rules||[]).length) L.push('HOW '+NAME+' BEHAVES:\n'+st.rules.map(r=>'- '+r).join('\n'));
  if(st.seesTranscript){
    const earlier = vlog.filter(e=>e.stage!==st.id);
    L.push('RECORD OF THE VISIT (private. '+c.name+' did NOT see the visit. Use this record only to give accurate feedback and to notice what the support worker leaves out. Never mention anything from it that the support worker has not told you.):\n'+(earlier.length? transcriptText(earlier) : '(no record)'));
  }
  const factsHere = (S.keyFacts||[]).filter(f=>(f.stage||(vStages()[0]||{}).id)===st.id);
  if(factsHere.length || st.calm){
    // the story so far, so the character stays consistent when older messages have been trimmed
    const told = factsHere.filter(f=>revealed.has(f.id)).map(f=>'- '+f.label);
    const shown = Object.keys(points).filter(id=>points[id].stage===st.id).map(id=>'- '+pointLabel(id));
    L.push('STORY SO FAR (stay consistent with this; older messages may be missing):\n'+c.name+' has already told the support worker:\n'+(told.join('\n')||'- nothing yet')+'\nThe support worker has already shown:\n'+(shown.join('\n')||'- nothing yet')+(st.calm? '\n'+c.name+"'s calm level right now: "+calm+' of 5 ('+CALM[calm-1]+').' : ''));
  }
  L.push(`HOW TO ANSWER:
- A message starting "SUPPORT WORKER SAYS:" is spoken to ${c.name}. A message starting "SUPPORT WORKER DOES:" is an action the support worker does in the room (for example sits down, passes a tissue, hands over a brochure, dials a number). React naturally to actions, in words and body language.
- Speak plainly in everyday Australian English. Short sentences. Keep the answer under about ${st.words||50} words. It is spoken out loud in a classroom.
- At most ONE new piece of information per answer. Answer what was asked, then stop.
- No stage directions, asterisks or brackets anywhere in "text", not even "(sobbing)" or "(pause)". ${st.calm? 'Crying, sniffing and gestures go only in "see", in the third person.' : 'Only the words spoken out loud.'}
- Only a message starting "TEACHER:" is a private instruction from the teacher. Follow it in your next answer without mentioning it.
- Never mention that you are an AI, a model or a computer. Never step out of character to coach in what ${c.name} says; coaching goes only in the "coach" field.`);
  const shape = ['"turns":[{"speaker":"'+c.name+'","text":"what '+c.name+' says out loud"}]'];
  if(st.calm){
    shape.push('"see":"what the support worker can see now: '+c.name+"'s body language or something in the room, third person, at most 15 words\"");
    shape.push('"calm":'+c.name+"'s calm level after this message, a number from 1 (very upset) to 5 (settled)");
  }
  shape.push('"action":"only when the latest message starts SUPPORT WORKER DOES: that action retold in the third person for a narrator, starting The support worker, at most 15 words (for example: The support worker passes Cherry a tissue.). Otherwise an empty string."');
  shape.push('"coach":"one sentence (max 22 words) of coaching for the support worker about their communication technique, or a checklist area they have not shown yet. Name the skill. Never give the exact words to say."');
  shape.push('"suggested":"one natural next thing the support worker could say or do, in plain English (used only if a student asks for a lifeline)"');
  if(factsHere.length) shape.push('"facts":["ids of story facts '+c.name+' revealed in THIS answer, from: '+factsHere.map(f=>f.id+' = '+f.label).join('; ')+'"]');
  shape.push('"points":[{"id":"checklist point id","evidence":"the support worker\'s own words or action from the LATEST message, at most 12 words"}]');
  L.push('OUTPUT FORMAT: Reply with JSON only, no code fences, in exactly this shape:\n{'+shape.join(',\n ')+'}\nCHECKLIST POINTS STILL OPEN. List a point in "points" only if the support worker\'s LATEST message clearly shows it. Judge only the support worker\'s own words or action, not how much your reply reveals. Be fair but not generous: a vague or rushed message does not count. One message can show several points. An empty list is fine.\n'+(openPoints(st.id).join('\n')||'(all shown)'));
  return L.join('\n\n');
}
function parseVisit(text){
  let t = String(text).trim().replace(/^```(json)?/i,'').replace(/```$/,'').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if(a>=0 && b>a) t = t.slice(a,b+1);
  let j;
  try{ j = JSON.parse(t); }catch(e){ j = {reply: String(text).replace(/[{}"\[\]]/g,'').slice(0,400)}; }
  const who = stageChars()[0];
  let turns = Array.isArray(j.turns)? j.turns.filter(x=>x && x.text).map(x=>({speaker: who.name, text:String(x.text).trim()})) : [];
  if(!turns.length && j.reply) turns = [{speaker:who.name, text:String(j.reply).trim()}];
  if(!turns.length) turns = [{speaker:who.name, text:'...'}];
  const c = parseInt(j.calm);
  return {turns, see: String(j.see||'').trim(), action: String(j.action||'').trim(), calm: (c>=1 && c<=5)? c : 0, coach: j.coach||'', suggested: j.suggested||j.suggested_question||'', facts: Array.isArray(j.facts)? j.facts : [], points: Array.isArray(j.points)? j.points : []};
}
function setVisitBusy(on){ ['btnSend','btnDo','btnStage'].forEach(id=>{ $(id).disabled = on; }); updateMic(); }

async function visitAsk(text, kind){
  if(busy) return;
  text = (text||'').trim(); if(!text) return;
  if(!vlog.length && !history.length){ toast('Press Start visit first.'); return; }
  if(vstage==='done'){ toast('The session is finished. Download the session, or press Reset to start again.'); return; }
  const typed = !inputByMic; inputByMic = false;
  busy = true; setVisitBusy(true);
  stopSpeaking();
  if(typed && kind==='say') narrateInput('The support worker says: '+text);
  const gen = sessionGen;
  const userContent = (whisperText? 'TEACHER: '+whisperText+'\n\n' : '')+'SUPPORT WORKER '+(kind==='do'?'DOES':'SAYS')+': '+text;
  whisperText = '';
  showTurns([{speaker:'', text:'Thinking...'}], true); setSpeaking(''); showCoach('');
  try{
    const msgs = [...history, {role:'user', content:userContent}];
    const raw = await callAPI(msgs);
    if(gen !== sessionGen) return;   // Reset was pressed while waiting: drop this reply
    const j = parseVisit(raw);
    history = [...msgs, {role:'assistant', content: raw}];
    if(history.length>40) history = history.slice(history.length-40);
    const st = vStage();
    // Narrator: a typed action in the third person, then what you can see, then the person answers.
    let narration = (typed && kind==='do')? (j.action || ('The support worker: '+text)) : '';
    if(st.calm && j.see) narration = (narration? narration+' ' : '')+j.see;
    lastNarration = narration;
    lastTurns = j.turns; showTurns(j.turns, false); speakTurns(j.turns, narration);
    if(st.calm && j.calm) calm = j.calm;
    seeText = st.calm? (j.see || seeText) : '';
    const newFacts = (j.facts||[]).filter(id=>(S.keyFacts||[]).some(f=>f.id===id) && !revealed.has(id));
    newFacts.forEach(id=>revealed.add(id));
    const fresh = tickPoints(j.points, student.n);
    flashQuiz(quizNumbersFor(fresh, newFacts));
    if(j.suggested) lastSuggested = j.suggested;
    qCount++;
    student.q++; student.types.push(fresh.length? 'open' : 'said'); student.facts += fresh.length; (student.kinds = student.kinds||[]).push(kind);
    vlog.push({stage: vstage, n: student.n, kind, text, turns: j.turns, see: st.calm? j.see : '', time: Date.now()});
    const d = document.createElement('div'); d.innerHTML = '<b>S'+student.n+' '+(kind==='do'?'did':'said')+':</b> '+esc(text)+' '+j.turns.map(t=>'<br><b>'+esc(t.speaker)+':</b> '+esc(t.text)).join(''); $('log').prepend(d);
    const badge = $('qType'); badge.className = 'badge'+(fresh.length? ' open' : ''); badge.textContent = fresh.length? 'New: '+fresh.map(pointLabel).join(', ') : (kind==='do'? 'Action, no new point' : 'No new point'); badge.classList.remove('hidden');
    if(student.q>=perTurns()) showCoach(visitTurnSummary(), true);
    else if(cfg.coachOn() && j.coach) showCoach('<b>Coach:</b> '+esc(j.coach));
    $('question').value=''; $('heard').textContent='';
    renderVisitTurn(); renderChecklist(fresh); saveSession();
  }catch(err){
    if(gen !== sessionGen) return;
    showTurns([{speaker:'', text:'Something went wrong: '+err.message}], true); toast(err.message);
  }finally{
    if(gen === sessionGen){ busy = false; setVisitBusy(false); }
  }
}
function visitTurnSummary(){
  const kinds = student.kinds||[], said = kinds.filter(k=>k==='say').length, did = kinds.length-said;
  const mine = Object.keys(points).filter(id=>points[id].n===student.n && points[id].stage===vstage);
  const left = missingItems(vstage).length;
  const parts = ['<b>'+esc(whoLabel(student.n))+', turn finished.</b> '+said+' said, '+did+' done.'];
  parts.push(mine.length? 'You showed: <b>'+esc(mine.map(pointLabel).join(', '))+'</b>.' : 'No new checklist points this time. Next time, choose a point that is still missing.');
  parts.push(left? 'Still to show: '+left+' point'+(left===1?'':'s')+'.' : 'Every point for this part is shown.');
  if(student.lifeline) parts.push('(Lifeline used.)');
  return parts.join(' ');
}
function renderVisitTurn(){
  if(!student){ student = newStudent(1, true); student.kinds = []; }
  const per = perTurns(), started = vlog.length>0 || history.length>0, done = vstage==='done';
  $('btnBegin').classList.add('hidden');
  $('studentLabel').textContent = done? 'Session finished' : 'Student '+student.n+(names[student.n]? ': '+names[student.n] : '')+(!started? '' : student.q>=per? ' · turn finished, press Next student' : ' · turn '+(student.q+1)+' of '+per);
  const kinds = student.kinds||[], dots = [];
  for(let i=0;i<per;i++){ const ty = student.types[i]; dots.push('<i class="'+(ty? 'done'+(ty==='open'?' open':'') : '')+'" title="'+(ty? (kinds[i]==='do'?'Did something':'Said something')+(ty==='open'?', new checklist point':'') : '')+'"></i>'); }
  $('dots').innerHTML = dots.join('');
  const ll = $('btnLifeline'); ll.classList.toggle('hidden', !cfg.lifelineOn()); ll.disabled = !!student.lifeline || !started || done;
  ll.textContent = student.lifeline ? 'Lifeline used' : 'Lifeline: show me an idea';
  $('btnNext').classList.toggle('primary', student.q>=per); $('btnNext').classList.toggle('ghost', student.q<per);
  const b = $('btnStage'), list = vStages(), next = list[list.findIndex(s=>s.id===vstage)+1];
  const nextName = next? ((S.characters.find(c=>c.id===(next.characters||[])[0])||{}).name || next.title) : '';
  b.textContent = next? 'Go to '+nextName : 'Finish session';
  const left = missingItems(vstage).length;
  b.classList.toggle('hidden', !started || done);
  b.classList.toggle('primary', !left); b.classList.toggle('ghost', !!left);
  b.title = left? left+' checklist point'+(left===1?'':'s')+' still to show' : 'Every point is shown';
  renderVisitExplore(); renderSee();
}
function renderVisitExplore(){
  if(vstage==='done'){ $('explore').innerHTML = 'Session finished. Press <b>Session for students (Word)</b> for the progress notes.'; return; }
  const left = missingItems(vstage);
  $('explore').innerHTML = left.length? 'Still to show: '+left.slice(0,6).map(it=>'<span>'+esc(missingText(it))+'</span>').join('')+(left.length>6? '<span>and '+(left.length-6)+' more on the checklist</span>' : '') : 'Every point is shown. Press <b>'+esc($('btnStage').textContent)+'</b> when you are ready.';
}
function renderSee(){
  const el = $('see'); if(!isVisit()){ el.classList.add('hidden'); return; }
  const st = vStage(), c = stageChars()[0];
  const txt = seeText || st.scene || '';
  const meter = (st.calm && vstage!=='done')? '<span class="calm" title="How upset '+esc(c.name)+' is">'+esc(c.name)+': '+[1,2,3,4,5].map(i=>'<i class="'+(i<=calm?'on':'')+'"></i>').join('')+' <b>'+CALM[calm-1]+'</b></span>' : '';
  el.innerHTML = '<span class="txt"><b>What you can see:</b> '+esc(txt)+'</span>'+meter;
  el.classList.toggle('hidden', !txt && !meter);
}
function renderChecklist(fresh){
  const fr = new Set(fresh||[]);
  const order = vStages().map(s=>s.id), cur = vstage==='done'? order.length : order.indexOf(vstage);
  const st = vStage();
  const hasDo = stageItems(vstage).some(it=>it.how || (it.parts||[]).some(p=>p.how));
  const tasks = (vstage!=='done' && (st.tasks||[]).length)? '<details class="cl-tasks" id="clTasks"'+(LS.get('tasksOpen', true)? ' open' : '')+'><summary><b>Your tasks: '+esc(st.title)+'</b></summary><ul>'+st.tasks.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul></details>'
    + (hasDo? '<div class="cl-dohelp"><span class="cl-how">Do</span> means an action. Say or type what you do, starting with "I", for example "I pass her a tissue". Then press <b>Do</b> instead of Say.</div>' : '') : '';
  const seen = [...quizSeen].sort((a,b)=>a-b);
  const quizLine = seen.length? '<div class="cl-quizseen">Quiz questions reached so far: <b>'+seen.join(', ')+'</b></div>' : '';
  const num = itemNumbers();
  $('board').innerHTML = tasks + quizLine + (S.checklist||[]).map(g=>{
    const gi = order.indexOf(g.stage), later = gi<0 || gi>cur;
    const tag = gi<0? 'After the session' : (gi!==cur? vStages()[gi].title : '');
    const items = (g.items||[]).map(it0=>{
      const it = Object.assign({stage:g.stage}, it0);
      const met = gi>=0 && itemMet(it), isNew = pointIds(it).some(id=>fr.has(id));
      const ev = pointIds(it).filter(id=>points[id]).map(id=>whoShort(points[id].n)+': '+points[id].evidence).join('  |  ');
      const parts = it.parts? ' <span class="cl-parts">'+it.parts.map(p=>{ const ok = !!points[it.id+'.'+p.id]; return '<span class="'+(ok?'met':'')+'">'+(ok?'&#10003; ':'')+esc(p.label)+(p.how? ' <b>'+howText(p.how)+'</b>' : '')+'</span>'; }).join('')+'</span>' : '';
      return '<div class="cl-item'+(met?' met':'')+(isNew?' new':'')+'"'+(ev? ' title="'+esc(ev)+'"' : '')+'><span class="mark">'+(met?'&#10003;':'&#9675;')+'</span><span class="num">'+num[it.id]+'.</span><span>'+esc(it.label)+howChip(it.how)+parts+'</span></div>';
    }).join('');
    return '<div class="cl-group'+(later?' later':'')+'"><h3><span>'+esc(g.title)+'</span>'+(tag? '<span class="tag">'+esc(tag)+'</span>' : '')+'</h3>'+items+'</div>';
  }).join('');
  if($('clTasks')) $('clTasks').addEventListener('toggle', e=> LS.set('tasksOpen', e.target.open));
  const tracked = clItems().filter(it=>order.includes(it.stage)), got = tracked.filter(itemMet).length;
  $('progress').textContent = vStages().map(s=>{ const its = stageItems(s.id); return s.title+': '+its.filter(itemMet).length+' of '+its.length; }).join(' · ');
  $('barFill').style.width = tracked.length? Math.round(100*got/tracked.length)+'%' : '0%';
  $('tFacts').innerHTML = (S.keyFacts||[]).map(f=>'<li class="'+(revealed.has(f.id)?'done':'')+'">'+esc(f.label)+' <span style="color:var(--muted)">('+esc(f.heading)+')</span></li>').join('');
  const first = document.querySelector('.cl-item.new'); if(first) first.scrollIntoView({block:'nearest', behavior:'smooth'});
  if(fr.size) setTimeout(()=>document.querySelectorAll('.cl-item.new').forEach(x=>x.classList.remove('new')), 6000);
  renderVisitExplore();
}
function startVisit(){
  if(vlog.length || history.length){ toast('The visit has already started. Press Reset to start again.'); return; }
  visitBlank();
  const st = vStage();
  history = [{role:'user', content:'TEACHER: '+(st.startNote||'The session starts now.')},{role:'assistant', content: JSON.stringify({turns:[], see:'', calm:calm, coach:'', suggested:'', facts:[], points:[]})}];
  lastTurns = [];
  showTurns([{speaker:'', text: st.startText || 'Student 1: begin.'}]);
  showCoach('<b>Student 1:</b> you have '+perTurns()+' turns. Say something to '+esc(stageChars()[0].name)+', or do something and press <b>Do</b>.');
  lastNarration = st.scene || '';
  speakTurns([], lastNarration);
  renderPersona(); renderVisitTurn(); renderChecklist(); saveSession();
  askName(1);
}
function visitNextStudent(){
  const n = student? student.n+1 : 1;
  student = newStudent(n, true); student.kinds = []; $('qType').classList.add('hidden');
  if(vstage!=='done') showCoach('<b>Student '+n+':</b> you have '+perTurns()+' turns with '+esc(stageChars()[0].name)+'. Look at the checklist and choose something that is still missing.');
  toast('Student '+n+': your turn.');
  renderVisitTurn(); saveSession();
  if(vstage!=='done' && (vlog.length || history.length)) askName(n);
}
async function reviewStage(fromTeacher){
  // One look over the whole conversation of this part, for points the live check missed.
  const open = openPoints(vstage), entries = vlog.filter(e=>e.stage===vstage);
  if(!open.length || !entries.length){ if(fromTeacher) toast('Nothing left to check in this part.'); return []; }
  if(busy) return [];
  busy = true; setVisitBusy(true);
  const gen = sessionGen;
  showCoach('<b>Checking the whole conversation</b> for points the live check may have missed...');
  try{
    const sys = 'You help a TAFE Queensland teacher with an observation checklist for a support work practice session. The whole class took turns as one support worker. Read the transcript. For each checklist point in the list, decide whether the support worker clearly showed it anywhere in the transcript. Be fair but not generous. Reply with JSON only, no code fences: {"points":[{"id":"point id","student":student number,"evidence":"the support worker\'s own words or action, at most 12 words"}]}. Include only points that were clearly shown. An empty list is fine.';
    const raw = await callAPI([{role:'user', content:'CHECKLIST POINTS STILL OPEN:\n'+open.join('\n')+'\n\nTRANSCRIPT:\n'+transcriptText(entries)}], sys);
    if(gen !== sessionGen) return [];   // Reset was pressed while checking
    const fresh = tickPoints(parseVisit(raw).points, student.n);
    flashQuiz(quizNumbersFor(fresh, []));
    renderChecklist(fresh); saveSession();
    if(fromTeacher){ const left = missingItems(vstage); showCoach(left.length? 'Check finished. Still to show: '+left.map(it=>esc(missingText(it))).join('; ')+'.' : 'Check finished. Every point for this part is shown.'); }
    toast(fresh.length? fresh.length+' more point'+(fresh.length===1?' was':'s were')+' found in the conversation.' : 'No more points found in the conversation.');
    return fresh;
  }catch(err){ if(gen === sessionGen){ toast(err.message); showCoach(''); } return []; }
  finally{ if(gen === sessionGen){ busy = false; setVisitBusy(false); renderVisitTurn(); } }
}
async function stageButton(){
  if(busy || vstage==='done') return;
  const gen = sessionGen;
  if(missingItems(vstage).length) await reviewStage(false);
  if(gen !== sessionGen) return;
  const left = missingItems(vstage);
  if(left.length){
    showCoach('<b>Not yet.</b> Before you move on, the class still needs to show: '+left.map(it=>esc(missingText(it))).join('; ')+'. <b>Next student</b>: choose one of these.');
    return;
  }
  advanceStage();
}
function advanceStage(){
  const list = vStages(), next = list[list.findIndex(s=>s.id===vstage)+1];
  stopSpeaking(); $('qType').classList.add('hidden');
  if(!next){ vstage = 'done'; return finishVisit(); }
  vstage = next.id; seeText = ''; lastSuggested = '';
  const c = stageChars()[0];
  const opening = c.opening? [{speaker:c.name, text:c.opening}] : [];
  history = [{role:'user', content:'TEACHER: '+(next.startNote||'The next part begins now.')},{role:'assistant', content: JSON.stringify({turns:opening, coach:'', suggested:'', points:[]})}];
  renderPersona(); lastTurns = opening; lastNarration = next.scene || '';
  showTurns(opening.length? opening : [{speaker:'', text:next.title}]); speakTurns(opening, lastNarration);
  showCoach('<b>'+esc(next.title)+'.</b> '+esc(next.intro||'')+' '+esc(whoLabel(student.n))+', carry on.', true);
  $('question').placeholder = 'What you say to '+c.name+' appears here. You can also type it, then press Say.';
  renderVisitTurn(); renderChecklist(); saveSession();
}
function finishVisit(){
  const order = vStages().map(s=>s.id), tracked = clItems().filter(it=>order.includes(it.stage)), got = tracked.filter(itemMet).length;
  lastTurns = [];
  showTurns([{speaker:'', text:'The session is finished. Thank you, everyone.'}]);
  showCoach('<b>Session finished.</b> The class showed '+got+' of '+tracked.length+' checklist points. Press <b>Session for students (Word)</b>. Each student writes the progress note for '+esc(S.docTitle||S.person)+' from it. Your copy with names: <b>Teacher copy with names (Word)</b>.', true);
  const m = itemNumbers(); flashQuiz(clItems().filter(it=>it.stage==='after').map(it=>m[it.id]));   // the progress note question
  renderVisitTurn(); renderChecklist(); saveSession();
}
const DOC_STYLE = '<style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt}h1{font-size:18pt}h2{font-size:14pt;margin-top:18pt;color:#1b7f79}p{margin:3pt 0}p.see{font-style:italic;color:#555}table{border-collapse:collapse;width:100%}td,th{border:1px solid #444;padding:5pt;vertical-align:top;text-align:left}</style>';
function visitDocHTML(){
  const name = S.docTitle || S.person;
  const body = vStages().map(st=>{
    const entries = vlog.filter(e=>e.stage===st.id); if(!entries.length) return '';
    return '<h2>'+esc(st.title)+'</h2>'+(st.scene? '<p class="see">At the start: '+esc(st.scene)+'</p>' : '')+entries.map(e=>'<p><b>Support worker '+(e.kind==='do'?'(does)':'(says)')+':</b> '+esc(e.text)+'</p>'+e.turns.map(t=>'<p><b>'+esc(t.speaker)+':</b> '+esc(t.text)+'</p>').join('')+(e.see? '<p class="see">What you could see: '+esc(e.see)+'</p>' : '')).join('');
  }).join('');
  return '<html><head><meta charset="utf-8"><title>'+esc(S.title)+'</title>'+DOC_STYLE+'</head><body>'+
    '<h1>'+esc(S.title)+': what was said and done</h1><p>'+esc(S.unit||'')+'<br>Date: '+new Date().toLocaleDateString('en-AU')+'<br>'+(S.docInfo||[]).map(esc).join('<br>')+'</p>'+
    '<p>Read this record, then write your own progress note for '+esc(name)+' in the table at the end.</p>'+
    (body || '<p>(Nothing was said yet.)</p>')+
    '<h2>Progress Notes for '+esc(name)+'</h2><table><tr><th style="width:24%">Date &amp; Time</th><th>Progress Note</th></tr><tr><td style="height:320pt">&nbsp;</td><td>&nbsp;</td></tr></table>'+
    '</body></html>';
}
function checklistTableHTML(){
  const order = vStages().map(s=>s.id), m = itemNumbers();
  const rows = (S.checklist||[]).map(g=>{
    const inPage = order.includes(g.stage);
    return '<tr><td colspan="3" style="background:#dff0ee"><b>'+esc(g.official||g.title)+'</b></td></tr>'+(g.items||[]).map(it0=>{
      const it = Object.assign({stage:g.stage}, it0), met = inPage && itemMet(it);
      const ev = pointIds(it).filter(id=>points[id]).map(id=>(it.parts? esc(pointLabel(id).split(': ').pop())+': ' : '')+esc(whoLabel(points[id].n))+', "'+esc(points[id].evidence)+'"').join('<br>');
      return '<tr><td>'+m[it.id]+'. '+esc(it.official||it.label)+'</td><td style="width:14%">'+(inPage? (met? 'Shown' : 'Not yet') : 'After the session')+'</td><td style="width:40%">'+ev+'</td></tr>';
    }).join('');
  }).join('');
  return '<table><tr><th>Checklist point (number = quiz question)</th><th>Shown?</th><th>Evidence (student and words)</th></tr>'+rows+'</table>';
}
function checklistDocHTML(){
  const order = vStages().map(s=>s.id), tracked = clItems().filter(it=>order.includes(it.stage)), got = tracked.filter(itemMet).length;
  return '<html><head><meta charset="utf-8"><title>'+esc(S.title)+' checklist</title>'+DOC_STYLE+'</head><body>'+
    '<h1>'+esc(S.title)+': checklist evidence</h1><p>'+esc(S.unit||'')+'<br>Class practice session. Date: '+new Date().toLocaleDateString('en-AU')+'<br>Points shown in the page: '+got+' of '+tracked.length+'.</p>'+
    (Object.keys(names).length? '<p><b>This copy has student names. Keep it private.</b></p>' : '')+
    '<p>The AI listened for each point during the session and noted the student and their words. Use this as a guide only. The teacher makes every assessment decision.</p>'+
    checklistTableHTML()+'</body></html>';
}
function visitTeacherDocHTML(){
  // Teacher copy for marking: who took part, what each student showed, the checklist and the conversation, with names.
  const m = itemNumbers(), order = vStages().map(s=>s.id), tracked = clItems().filter(it=>order.includes(it.stage)), got = tracked.filter(itemMet).length;
  const nums = [...new Set(vlog.map(e=>e.n).concat(Object.keys(names).map(Number)))].sort((a,b)=>a-b);
  const people = nums.map(n=>{
    const mine = vlog.filter(e=>e.n===n), said = mine.filter(e=>e.kind==='say').length, did = mine.length-said;
    const pts = Object.keys(points).filter(id=>points[id].n===n).sort((a,b)=>m[a.split('.')[0]]-m[b.split('.')[0]]);
    return '<tr><td>'+n+'</td><td>'+esc(names[n]||'(no name typed)')+'</td><td>'+said+' said, '+did+' done</td><td>'+(pts.map(id=>m[id.split('.')[0]]+'. '+esc(pointLabel(id))+': <i>"'+esc(points[id].evidence)+'"</i>').join('<br>')||'none')+'</td></tr>';
  }).join('');
  const body = vStages().map(st=>{
    const entries = vlog.filter(e=>e.stage===st.id); if(!entries.length) return '';
    return '<h3>'+esc(st.title)+'</h3>'+entries.map(e=>'<p><b>'+esc(whoLabel(e.n))+' '+(e.kind==='do'?'does':'says')+':</b> '+esc(e.text)+'</p>'+e.turns.map(t=>'<p><b>'+esc(t.speaker)+':</b> '+esc(t.text)+'</p>').join('')+(e.see? '<p class="see">What you could see: '+esc(e.see)+'</p>' : '')).join('');
  }).join('');
  return '<html><head><meta charset="utf-8"><title>'+esc(S.title)+' teacher copy</title>'+DOC_STYLE+'</head><body>'+
    '<h1>'+esc(S.title)+': teacher copy with student names</h1><p>'+esc(S.unit||'')+'<br>Class practice session. Date: '+new Date().toLocaleDateString('en-AU')+'<br>Checklist points shown: '+got+' of '+tracked.length+'.</p>'+
    '<p><b>This copy has student names. Keep it private and use it for marking.</b> The students\' copy has no names.</p>'+
    '<h2>Students</h2><table><tr><th style="width:8%">Turn</th><th style="width:18%">Name</th><th style="width:16%">Said / done</th><th>Checklist points shown (number = quiz question) and their words</th></tr>'+(people||'<tr><td colspan="4">No turns yet.</td></tr>')+'</table>'+
    '<h2>Checklist</h2>'+checklistTableHTML()+
    '<h2>What was said and done</h2>'+(body || '<p>(Nothing was said yet.)</p>')+
    '</body></html>';
}

// ---------- Speech out ----------
let voices = [];
function refreshVoices(){ voices = (window.speechSynthesis? speechSynthesis.getVoices() : []) || []; }
function voiceKey(c){ return 'voice_'+S.id+'_'+c.id; }
function pickVoice(c){
  const want = LS.get(voiceKey(c),'');
  if(want){ const v = voices.find(v=>v.name===want); if(v) return v; }
  const gender = (c.voice||'female');
  const fem = /natasha|catherine|female|karen|hayley|zira|jenny|libby|sonia|mia|aria|samantha|kate|annie|clara/i, mal = /william|james|male|daniel|ryan|guy|thomas|george|neil|richard|mark|david|liam/i;
  const byName = list => list.find(v=> gender==='female' ? (fem.test(v.name) && !mal.test(v.name)) : (mal.test(v.name) && !fem.test(v.name)));
  const au = voices.filter(v=>/en[-_]AU/i.test(v.lang));
  return byName(au) || byName(voices.filter(v=>/^en/i.test(v.lang))) || au[0] || voices.find(v=>/^en/i.test(v.lang)) || voices[0] || null;
}
// The narrator reads out what the back of the room cannot see: the scene, what the person does, and anything typed instead of spoken.
function narratorOn(){ return LS.get('narratorOn', true); }
function pickNarratorVoice(){
  const want = LS.get('voice_narrator','');
  if(want){ const v = voices.find(v=>v.name===want); if(v) return v; }
  const used = new Set(S.characters.map(c=>{ const v = pickVoice(c); return v && v.name; }));   // never the same voice as a character
  const en = voices.filter(v=>/^en/i.test(v.lang) && !used.has(v.name));
  for(const p of [/ryan/i, /mitchell/i, /thomas/i, /guy/i, /christopher/i, /george/i, /daniel/i]){ const v = en.find(v=>p.test(v.name)); if(v) return v; }
  const fem = /natasha|catherine|female|karen|hayley|zira|jenny|libby|sonia|mia|aria|samantha|kate|annie|clara|emma|ava|michelle|hazel|susan|linda|heather/i;
  return en.find(v=>/male|james|david|mark|richard|neil|brian|andrew|eric|connor|liam|william/i.test(v.name) && !fem.test(v.name)) || en[0] || voices[0] || null;
}
// Speaking state: the microphone button is grey ("Please wait...") while the narrator or a character is talking.
let speechPending = 0, speechToken = 0, speakingNow = false, speechTimer = null, speechPoll = null, speechUntil = 0, inputNarration = false;
function speechDone(){
  speakingNow = false; speechPending = 0; speechUntil = 0;
  clearTimeout(speechTimer); clearInterval(speechPoll); speechTimer = speechPoll = null;
  updateMic();
}
function speakOne(text, voice, speaker){
  const u = new SpeechSynthesisUtterance(text);
  if(voice) u.voice = voice;
  u.rate = parseFloat(LS.get('rate', 0.95)) * (speaker? 1 : 0.95); u.pitch = 1; u.lang = (voice&&voice.lang)||'en-AU';
  const tok = speechToken;
  speechPending++; speakingNow = true; updateMic();
  u.onstart = ()=>{ if(speaker && tok===speechToken) setSpeaking(speaker); };
  u.onend = u.onerror = ()=>{ if(tok!==speechToken) return; if(speaker) setSpeaking(''); speechPending = Math.max(0, speechPending-1); if(!speechPending) speechDone(); };
  // Browser voices sometimes never say they have finished, so the button always comes back after the expected time.
  const words = String(text).split(/\s+/).length;
  speechUntil = Math.max(speechUntil, Date.now()) + words*480 + 2500;
  clearTimeout(speechTimer); speechTimer = setTimeout(()=>{ if(tok===speechToken){ speechToken++; setSpeaking(''); speechDone(); } }, speechUntil - Date.now());
  if(!speechPoll){ let quiet = 0; speechPoll = setInterval(()=>{ const busyNow = speechSynthesis.speaking || speechSynthesis.pending; quiet = busyNow? 0 : quiet+1; if(quiet>=3){ speechToken++; setSpeaking(''); speechDone(); } }, 700); }
  speechSynthesis.speak(u);
}
function speakTurns(turns, narration){
  if(!window.speechSynthesis || !LS.get('speakOn', true)) return;
  if(inputNarration) inputNarration = false;     // let the narrator finish reading the typed question first
  else stopSpeaking();
  if(narration && narratorOn()) speakOne(narration, pickNarratorVoice(), '');
  turns.forEach(t=>{
    const c = charByName(t.speaker); if(!c) return;
    speakOne(t.text, pickVoice(c), t.speaker);
  });
}
function narrateInput(text){
  // Reads out a typed question or action straight away, while the answer is on its way.
  if(!window.speechSynthesis || !LS.get('speakOn', true) || !narratorOn()) return;
  speakOne(text, pickNarratorVoice(), ''); inputNarration = true;
}
function stopSpeaking(){ try{ speechSynthesis.cancel(); }catch(e){} setSpeaking(''); speechToken++; inputNarration = false; if(speakingNow) speechDone(); }
function updateMic(){
  const b = $('btnMic'); if(!b) return;
  const wait = (busy || speakingNow) && !listening;
  b.disabled = wait;
  b.classList.toggle('waiting', wait);
  if(!listening) $('micLabel').textContent = wait? 'Please wait...' : (isVisit()? 'Speak' : 'Ask a question');
}

// ---------- Speech in ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, finalText = '', inputByMic = false;
let micStream = null; // kept open for the whole session so the browser asks for permission only once
async function holdMicrophone(){
  if(micStream && micStream.active) return true;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return true;
  try{ micStream = await navigator.mediaDevices.getUserMedia({audio:true}); return true; }
  catch(e){ toast('Microphone blocked. Allow the microphone in the browser address bar, then try again.'); return false; }
}
async function startListening(){
  if(!SR){ toast('This browser has no speech recognition. Use Chrome or Edge, or type the question.'); return; }
  if(listening) return;
  stopSpeaking();
  if(!(await holdMicrophone())) return;
  rec = new SR(); rec.lang = LS.get('lang','en-AU'); rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
  finalText = $('question').value ? $('question').value.trim()+' ' : '';
  rec.onresult = e=>{
    inputByMic = true;   // the room heard it, so the narrator does not read it again
    let interim='';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const r=e.results[i]; if(r.isFinal) finalText += r[0].transcript.trim()+' '; else interim += r[0].transcript;
    }
    $('question').value = (finalText+interim).replace(/\s+/g,' ').trim();
    $('heard').textContent = interim? 'Hearing: '+interim : '';
  };
  rec.onerror = e=>{ listening=false; setMicUI(); const m = {'not-allowed':'Microphone blocked. Allow the microphone in the browser address bar.','no-speech':'No speech heard. Try again and speak a little louder.','network':'Speech service needs the internet.','audio-capture':'No microphone found.'}[e.error]||('Microphone error: '+e.error); toast(m); };
  rec.onend = ()=>{ listening=false; setMicUI(); $('heard').textContent = $('question').value? 'Check the words, then press Send.' : ''; };
  try{ rec.start(); listening=true; setMicUI(); $('heard').textContent='Listening... speak now.'; }catch(e){ toast('Could not start the microphone.'); }
}
function stopListening(){ if(rec && listening){ try{ rec.stop(); }catch(e){} } }
function setMicUI(){ $('btnMic').classList.toggle('listening', listening); if(listening) $('micLabel').textContent = 'Listening... click to stop'; else updateMic(); }

// ---------- Export ----------
function boardHTML(){
  const rows = S.headings.map(h=>'<h3>'+esc(h)+'</h3><ul>'+(board[h]||[]).map(p=>'<li>'+esc(p)+'</li>').join('')+'</ul>').join('');
  const transcript = [...$('log').querySelectorAll('div')].reverse().map(d=>'<p>'+d.innerHTML+'</p>').join('');
  const who = S.characters.map(c=>c.name+' ('+c.relation+')').join(' and ');
  return '<html><head><meta charset="utf-8"><title>'+esc(S.title)+'</title><style>body{font-family:Calibri,Arial,sans-serif;font-size:12pt}h1{font-size:18pt}h2{font-size:14pt;margin-top:18pt}h3{font-size:12pt;color:#1b7f79;margin-bottom:2pt}ul{margin-top:0}</style></head><body>'+
    '<h1>'+esc(S.title)+'</h1><p>'+esc(S.unit||'')+'<br>Class information session with '+esc(who)+'. Date: '+new Date().toLocaleDateString('en-AU')+'</p>'+
    '<h2>What we learned about '+esc(S.person)+'</h2>'+rows+
    '<h2>Questions asked and answers given</h2>'+transcript+'</body></html>';
}
function download(name, content, type){
  const blob = new Blob([content], {type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},500);
}

// ---------- Models ----------
async function loadModels(){
  const key = $('apiKey').value.trim(); if(!key){ toast('Paste your API key first.'); return; }
  try{
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100',{headers:{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}});
    if(!res.ok) throw new Error('Could not load models ('+res.status+'). Check the key.');
    const data = await res.json(); const list = (data.data||[]).map(m=>m.id);
    if(!list.length) throw new Error('No models returned.');
    const cur = LS.get('model','') || list.find(m=>/sonnet/i.test(m)) || list[0];
    $('model').innerHTML = list.map(m=>'<option value="'+esc(m)+'" '+(m===cur?'selected':'')+'>'+esc(m)+'</option>').join('');
    toast('Key works. '+list.length+' models loaded.');
  }catch(e){ toast(e.message); }
}

// ---------- Settings UI ----------
let settingsScenario = null; // scenario shown in the settings panel (may differ from S until saved)
function renderPicRows(sc){
  $('picRows').innerHTML = sc.characters.map(c=>{
    const has = !!LS.get(picKey(sc,c),'');
    return '<div class="row" style="margin-bottom:6px"><span style="flex:0 0 160px">'+esc(c.name)+'</span><div style="flex:0 0 56px;height:56px;border-radius:10px;overflow:hidden;border:2px solid var(--line)"><div class="pic" style="width:56px;height:56px">'+portraitHTML(sc,c)+'</div></div><label class="ghost" style="text-align:center;padding:.5em 1em;border:2px solid var(--line);border-radius:12px;cursor:pointer;flex:0">Load picture<input type="file" accept="image/*" data-pic="'+esc(c.id)+'" style="display:none"></label><button data-picreset="'+esc(c.id)+'" style="flex:0" '+(has?'':'disabled')+'>Use drawn portrait</button></div>';
  }).join('');
  document.querySelectorAll('input[data-pic]').forEach(inp=> inp.onchange = e=>{
    const f = e.target.files[0]; if(!f) return; const c = sc.characters.find(x=>x.id===inp.dataset.pic);
    const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = ()=>{
      const size = 360, cv = document.createElement('canvas'); cv.width=size; cv.height=Math.round(size*0.75);
      const ctx = cv.getContext('2d'); const s = Math.max(cv.width/img.width, cv.height/img.height);
      const w = img.width*s, h = img.height*s; ctx.drawImage(img, (cv.width-w)/2, (cv.height-h)/2, w, h);
      LS.set(picKey(sc,c), cv.toDataURL('image/jpeg', 0.85)); URL.revokeObjectURL(url); renderPicRows(sc); if(sc.id===S.id) renderPersona(); toast('Picture loaded for '+c.name+'.');
    };
    img.onerror = ()=> toast('Could not read that image.'); img.src = url; e.target.value='';
  });
  document.querySelectorAll('button[data-picreset]').forEach(b=> b.onclick = ()=>{ const c = sc.characters.find(x=>x.id===b.dataset.picreset); try{ localStorage.removeItem('fm_'+picKey(sc,c)); }catch(e){} renderPicRows(sc); if(sc.id===S.id) renderPersona(); });
}
function renderCastAndVoices(sc){
  settingsScenario = sc;
  refreshVoices();
  renderPicRows(sc);
  const tp = LS.get('teacherPlays_'+sc.id, []);
  $('castRows').innerHTML = sc.characters.map((c,i)=>'<div class="row" style="margin-bottom:6px"><span style="flex:0 0 160px">'+esc(c.name)+' ('+esc(c.relation)+')</span><select data-cast="'+esc(c.id)+'" '+(i===0?'disabled':'')+'><option value="ai" '+(!tp.includes(c.id)?'selected':'')+'>The AI</option><option value="teacher" '+(tp.includes(c.id)?'selected':'')+'>Me (teacher)</option></select></div>').join('');
  $('castField').classList.toggle('hidden', sc.characters.length<2 || sc.type==='visit');
  const opts = voices.map(v=>'<option value="'+esc(v.name)+'">'+esc(v.name)+' ('+esc(v.lang)+')</option>').join('');
  $('voiceRows').innerHTML = sc.characters.map(c=>{
    const cur = LS.get('voice_'+sc.id+'_'+c.id,'');
    const auto = pickVoiceFor(sc, c);
    return '<div class="row" style="margin-bottom:6px"><span style="flex:0 0 160px">'+esc(c.name)+'</span><select data-voice="'+esc(c.id)+'"><option value="">(Automatic'+(auto? ': '+esc(auto.name):'')+')</option>'+opts+'</select><button data-test="'+esc(c.id)+'" style="flex:0">Test</button></div>';
  }).join('') + (()=>{
    const saveS = S; S = sc; const auto = pickNarratorVoice(); S = saveS;
    return '<div class="row" style="margin-bottom:6px"><span style="flex:0 0 160px">Narrator</span><select id="narratorVoice"><option value="">(Automatic'+(auto? ': '+esc(auto.name):'')+')</option>'+opts+'</select><button id="btnTestNarrator" style="flex:0">Test</button></div>';
  })();
  sc.characters.forEach(c=>{ const sel = document.querySelector('select[data-voice="'+c.id+'"]'); if(sel) sel.value = LS.get('voice_'+sc.id+'_'+c.id,''); });
  $('narratorVoice').value = LS.get('voice_narrator','');
  $('btnTestNarrator').onclick = ()=>{
    LS.set('voice_narrator', $('narratorVoice').value); LS.set('rate', parseFloat($('rate').value));
    const saveS = S; S = sc; stopSpeaking();
    const u = new SpeechSynthesisUtterance('The support worker sits down. Cherry wipes her eyes and looks at the shelf.'); const v = pickNarratorVoice(); if(v) u.voice = v; u.rate = parseFloat($('rate').value)*0.95; speechSynthesis.speak(u);
    S = saveS;
  };
  document.querySelectorAll('button[data-test]').forEach(b=> b.onclick = ()=>{
    const c = sc.characters.find(x=>x.id===b.dataset.test); const sel = document.querySelector('select[data-voice="'+c.id+'"]');
    LS.set('voice_'+sc.id+'_'+c.id, sel.value); LS.set('rate', parseFloat($('rate').value));
    const saveS = S; S = sc; stopSpeaking();
    const u = new SpeechSynthesisUtterance((c.opening||('Hello, I am '+c.name+'.')).slice(0,140)); const v = pickVoice(c); if(v) u.voice=v; u.rate = parseFloat($('rate').value); speechSynthesis.speak(u);
    S = saveS;
  });
}
function pickVoiceFor(sc, c){ const saveS = S; S = sc; const v = pickVoice(c); S = saveS; return v; }
function openSettings(){
  $('apiKey').value = LS.get('apiKey','');
  const m = LS.get('model',''); if(m){ $('model').innerHTML='<option value="'+esc(m)+'" selected>'+esc(m)+'</option>'; }
  $('scenario').innerHTML = scenarios.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===S.id?'selected':'')+'>'+esc(s.title)+'</option>').join('');
  renderCastAndVoices(S);
  $('scenario').onchange = ()=> renderCastAndVoices(scenarios.find(s=>s.id===$('scenario').value)||S);
  $('speakOn').checked = LS.get('speakOn',true); $('rate').value = LS.get('rate',0.95); $('lang').value = LS.get('lang','en-AU'); $('narratorOn').checked = narratorOn();
  $('perStudent').value = String(cfg.perStudent()); $('coachOn').checked = cfg.coachOn(); $('lifelineOn').checked = cfg.lifelineOn(); $('briefOn').checked = cfg.brief();
  $('browserNote').innerHTML = (SR? 'Microphone input is available in this browser.' : 'This browser cannot do speech recognition. Open this file in <b>Google Chrome</b> or <b>Microsoft Edge</b>.') + (voices.length? ' '+voices.length+' voices found.' : ' No voices found yet, close and reopen Settings.');
  $('settings').classList.remove('hidden');
}
function saveSettings(){
  LS.set('apiKey', $('apiKey').value.trim());
  LS.set('model', $('model').value);
  LS.set('speakOn', $('speakOn').checked); LS.set('rate', parseFloat($('rate').value)); LS.set('lang', $('lang').value);
  LS.set('narratorOn', $('narratorOn').checked); if($('narratorVoice')) LS.set('voice_narrator', $('narratorVoice').value);
  LS.set('perStudent', parseInt($('perStudent').value)); LS.set('coachOn', $('coachOn').checked); LS.set('lifelineOn', $('lifelineOn').checked); LS.set('brief', $('briefOn').checked);
  const sc = settingsScenario || S;
  const tp = [...document.querySelectorAll('select[data-cast]')].filter(s=>s.value==='teacher').map(s=>s.dataset.cast);
  const tpOld = LS.get('teacherPlays_'+sc.id, []);
  LS.set('teacherPlays_'+sc.id, tp);
  document.querySelectorAll('select[data-voice]').forEach(s=> LS.set('voice_'+sc.id+'_'+s.dataset.voice, s.value));
  const sid = $('scenario').value;
  if(sid!==S.id){ applyScenario(sid); }
  else { applyScenario(S.id); if(JSON.stringify(tp)!==JSON.stringify(tpOld) && history.length) toast('Cast changed. Press Reset before the next meeting so the family knows who is in the room.'); }
  $('settings').classList.add('hidden'); updateStatus();
}
function updateStatus(){
  const ok = !!LS.get('apiKey','') && !!LS.get('model','');
  $('dotKey').className = 'dot '+(ok?'ok':'bad'); $('statusText').textContent = ok? 'Ready ('+LS.get('model','')+')' : 'Not set up yet: open Settings';
}

// ---------- Wire up ----------
function init(){
  loadScenarios();
  applyScenario(LS.get('scenarioId', scenarios[0].id));
  updateStatus();
  if(window.speechSynthesis){ refreshVoices(); speechSynthesis.onvoiceschanged = refreshVoices; }

  $('btnSettings').onclick = openSettings;
  $('btnSettingsSave').onclick = saveSettings;
  $('btnModels').onclick = loadModels;
  $('btnHelp').onclick = ()=>$('help').classList.remove('hidden');
  $('btnHelpClose').onclick = ()=>$('help').classList.add('hidden');
  $('btnScenarioExport').onclick = ()=> download(S.id+'.json', JSON.stringify(S,null,2), 'application/json');
  $('scenarioFile').onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader(); r.onload = ()=>{
      try{
        const sc = JSON.parse(r.result);
        if(!sc.id||!sc.title||!(sc.characters||sc.character)||!sc.headings) throw new Error('Missing fields');
        const custom = LS.get('customScenarios',[]).filter(x=>x.id!==sc.id); custom.push(sc); LS.set('customScenarios',custom);
        loadScenarios(); $('scenario').innerHTML = scenarios.map(s=>'<option value="'+esc(s.id)+'" '+(s.id===sc.id?'selected':'')+'>'+esc(s.title)+'</option>').join('');
        renderCastAndVoices(scenarios.find(s=>s.id===sc.id));
        toast('Scenario loaded: '+sc.title);
      }catch(err){ toast('That file is not a valid scenario: '+err.message); }
    }; r.readAsText(f); e.target.value='';
  };

  $('btnStart').onclick = ()=>{
    if(isVisit()) return startVisit();
    if(history.length){ toast('The meeting has already started. Press Reset to start again.'); return; }
    stage = 'opening'; openingDone = new Set();
    const names = aiCharacters().map(c=>c.name).join(' and ');
    const joined = [{speaker:'', text: names+' have joined the video call and are waiting. Student 1: introduce yourself and open the meeting.'}];
    showTurns(joined); speakTurns([], joined[0].text);
    history = [{role:'user', content:'TEACHER: The video call has just connected. Wait quietly for the student to introduce themselves. Your first reply comes after their first message.'},{role:'assistant', content: JSON.stringify({turns:[], question_type:'', tip:'', coach:'', suggested_question:'', board:[], facts:[], opening:[]})}];
    lastTurns = []; student = newStudent(1, false); showCoach(openingHTML()); renderTurn(); saveSession();
  };
  $('btnBegin').onclick = beginQuestions;
  $('btnSend').onclick = ()=>{ stopListening(); ask($('question').value); };
  $('question').addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); stopListening(); ask($('question').value); } });
  $('btnMic').onclick = ()=> listening? stopListening() : startListening();
  $('btnRepeat').onclick = ()=> lastTurns.length && speakTurns(lastTurns, isVisit()? lastNarration : '');
  $('btnNext').onclick = nextStudent;
  $('btnLifeline').onclick = useLifeline;

  $('btnExport').onclick = ()=> isVisit()? download(S.id+'-session-students.doc', visitDocHTML(), 'application/msword') : download(S.id+'-board.doc', boardHTML(), 'application/msword');
  $('btnExportTeacher').onclick = ()=> download(S.id+'-session-teacher-with-names.doc', visitTeacherDocHTML(), 'application/msword');
  $('btnNameOk').onclick = ()=> closeName(true);
  $('btnNameSkip').onclick = ()=> closeName(false);
  $('nameInput').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); closeName(true); } });
  $('btnPrint').onclick = ()=> window.print();
  $('btnSave').onclick = ()=> download(S.id+'-session.json', JSON.stringify(Object.assign({scenario:S.id, when:new Date().toISOString(), board, revealed:[...revealed], history}, isVisit()? {vstage, points, vlog, names} : {}), null, 2), 'application/json');
  $('btnDo').onclick = ()=>{ stopListening(); ask($('question').value, {kind:'do'}); };
  $('btnStage').onclick = stageButton;
  $('btnCheckAll').onclick = ()=>{ if(!vlog.length){ toast('Nothing to check yet.'); return; } reviewStage(true); };
  let skipArmed = false;
  $('btnSkipStage').onclick = ()=>{
    if(!vlog.length || vstage==='done'){ toast('Start the visit first.'); return; }
    if(!skipArmed){ skipArmed=true; $('btnSkipStage').textContent='Click again to move on without all points'; setTimeout(()=>{skipArmed=false; $('btnSkipStage').textContent='Move on now (skip the checklist)';},4000); return; }
    skipArmed=false; $('btnSkipStage').textContent='Move on now (skip the checklist)'; advanceStage(); $('drawer').classList.remove('open');
  };
  $('btnChecklistDoc').onclick = ()=> download(S.id+'-checklist.doc', checklistDocHTML(), 'application/msword');
  let resetArmed = false;
  $('btnReset').onclick = ()=>{ if(!resetArmed){ resetArmed=true; $('btnReset').textContent='Click again to clear everything'; setTimeout(()=>{resetArmed=false; $('btnReset').textContent='Reset';},4000); return; } resetArmed=false; $('btnReset').textContent='Reset'; stopSpeaking(); blankSession(); renderBoard(); saveSession(); toast(isVisit()? 'Cleared. Press Start visit to begin again.' : 'Cleared. Press Start meeting to begin again.'); };

  $('btnTeacher').onclick = ()=> $('drawer').classList.toggle('open');
  $('btnDrawerClose').onclick = ()=> $('drawer').classList.remove('open');
  $('btnWhisper').onclick = ()=>{ whisperText = $('whisper').value.trim(); $('whisper').value=''; if(whisperText) toast('They will follow that in the next answer.'); };
  document.addEventListener('keydown', e=>{
    if(e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if(e.key==='t'||e.key==='T') $('drawer').classList.toggle('open');
    if(e.key==='Escape'){ $('drawer').classList.remove('open'); $('settings').classList.add('hidden'); $('help').classList.add('hidden'); }
  });
  if(!LS.get('apiKey','')) setTimeout(()=>$('help').classList.remove('hidden'), 300);
}
// ---------- PIN gate (only when the page is on a website, not a local file) ----------
const PAGE_PIN_HASH = '__PIN_HASH__'; // sha-256 of the PIN; empty string = no gate
async function sha256(s){ const b = new TextEncoder().encode(s); const h = await crypto.subtle.digest('SHA-256', b); return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
async function gate(){
  if(!PAGE_PIN_HASH || location.protocol==='file:' || !window.crypto || !crypto.subtle) return true;
  if(LS.get('unlocked','')===PAGE_PIN_HASH) return true;
  const g = $('gate'); g.classList.remove('hidden'); $('gatePin').focus();
  return new Promise(res=>{
    const tryPin = async ()=>{ const h = await sha256($('gatePin').value.trim()); if(h===PAGE_PIN_HASH){ LS.set('unlocked',h); g.classList.add('hidden'); res(true); } else { $('gateMsg').textContent='That PIN is not right.'; $('gatePin').value=''; $('gatePin').focus(); } };
    $('gateGo').onclick = tryPin; $('gatePin').addEventListener('keydown', e=>{ if(e.key==='Enter') tryPin(); });
  });
}
document.addEventListener('DOMContentLoaded', async ()=>{ await gate(); init(); });
})();
