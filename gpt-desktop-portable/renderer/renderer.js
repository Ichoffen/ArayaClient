const apiBase = 'http://localhost:3131';
const el = (id) => document.getElementById(id);
const ui = {
  projects: el('projects'),
  history: el('history'),
  newProjectForm: el('newProjectForm'),
  newProjectName: el('newProjectName'),
  chat: el('chat'),
  input: el('input'),
  form: el('form'),
  model: el('model'),
  lastCount: el('lastCount'),
  loadOlder: el('loadOlder'),
  attachBtn: el('attachBtn'),
  fileInput: el('fileInput'),
  micBtn: el('micBtn'),
  micState: el('micState'),
  openSettings: el('openSettings'),
  settingsModal: el('settingsModal'),
  apiKeyInput: el('apiKeyInput'),
  saveSettings: el('saveSettings'),
  closeSettings: el('closeSettings'),
  newChat: el('newChat')
};
let state = { projectId: null, messages: [], oldestId: null, pendingAttachment: null, apiKey: '', recognizing: false, recognizer: null };

async function fetchJSON(url, opts={}) { const res = await fetch(url, opts); if (!res.ok) throw new Error(await res.text()); return res.json(); }

async function init() {
  const projs = await fetchJSON(apiBase + '/api/projects');
  if (!projs.length) { await fetchJSON(apiBase + '/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name:'Motorbuild' }) }); }
  await loadProjects();
  await loadHistory();
  const settings = await fetchJSON(apiBase + '/api/settings');
  state.apiKey = settings.apiKey || '';
  if (!state.apiKey) openSettingsModal();
  setupVoice();
}

async function loadProjects() {
  const projs = await fetchJSON(apiBase + '/api/projects');
  ui.projects.innerHTML = '';
  projs.forEach(p => {
    const div = document.createElement('div');
    div.className = 'project' + (state.projectId === p.id ? ' active' : '');
    div.textContent = p.name;
    div.onclick = () => selectProject(p.id);
    ui.projects.appendChild(div);
  });
  if (!state.projectId && projs.length) selectProject(projs[0].id);
}

async function loadHistory() {
  const rows = await fetchJSON(apiBase + '/api/history');
  ui.history.innerHTML = '';
  rows.forEach(r => {
    const d = document.createElement('div');
    d.className = 'project';
    d.innerHTML = `<strong>${r.project_name}</strong><div style="color:#666;font-size:12px">${r.last_text || '—'}</div>`;
    d.onclick = () => selectProject(r.project_id);
    ui.history.appendChild(d);
  });
}

async function selectProject(id) { state.projectId = id; state.messages = []; state.oldestId = null; render(); await loadMessages(); }

async function loadMessages(beforeId=null) {
  const url = new URL(apiBase + '/api/messages');
  url.searchParams.set('projectId', state.projectId);
  if (beforeId) url.searchParams.set('beforeId', beforeId);
  url.searchParams.set('limit', ui.lastCount.value);
  const rows = await fetchJSON(url.toString());
  if (rows.length) { state.oldestId = rows[0].id; state.messages = rows.concat(state.messages); }
  render();
}

function msgEl(m) {
  const container = document.createElement('div');
  container.className = 'msg ' + m.role;

  const parts = [];
  const re = /```([a-z]*)\n([\s\S]*?)```/g;
  let last = 0, match, text = m.content || '';
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push({ type:'text', text: text.slice(last, match.index) });
    parts.push({ type:'code', lang: match[1] || '', code: match[2] || '' });
    last = match.index + match[0].length;
  }
  if (text.slice(last)) parts.push({ type:'text', text: text.slice(last) });

  parts.forEach(p => {
    if (p.type === 'text') {
      const div = document.createElement('div'); div.textContent = p.text; container.appendChild(div);
    } else {
      const wrap = document.createElement('div'); wrap.style.position='relative';
      wrap.style.border='1px solid #e5e5e5'; wrap.style.borderRadius='8px'; wrap.style.margin='8px 0';
      const btn = document.createElement('button');
      btn.textContent = '📋 Скопировать';
      btn.style.position='absolute'; btn.style.top='6px'; btn.style.right='6px';
      btn.style.fontSize='12px'; btn.style.padding='4px 8px';
      btn.addEventListener('click', async () => {
        await navigator.clipboard.writeText(p.code);
        const prev = btn.textContent; btn.textContent='✅ Скопировано!'; setTimeout(()=>btn.textContent=prev,1200);
      });
      const pre = document.createElement('pre');
      pre.style.padding='28px 12px 12px'; pre.style.margin=0; pre.style.whiteSpace='pre-wrap'; pre.style.fontFamily='var(--mono)';
      pre.textContent = p.code;
      wrap.appendChild(btn); wrap.appendChild(pre); container.appendChild(wrap);
    }
  });

  if (m.attachment_path) {
    const img = document.createElement('img'); img.className='thumb';
    img.src = apiBase + '/attachments/' + m.attachment_path.split('/').pop();
    container.appendChild(img);
  }
  return container;
}

function render(){ ui.chat.innerHTML=''; for (const m of state.messages.slice(-parseInt(ui.lastCount.value,10))) ui.chat.appendChild(msgEl(m)); ui.chat.scrollTop = ui.chat.scrollHeight; }

ui.lastCount.addEventListener('change', ()=>render());
ui.loadOlder.addEventListener('click', async ()=>{ if (!state.oldestId) return; await loadMessages(state.oldestId); });

ui.attachBtn.addEventListener('click', ()=> ui.fileInput.click());
ui.fileInput.addEventListener('change', async (e)=>{ const file = e.target.files[0]; if (!file) return; const base64 = await toDataURL(file); state.pendingAttachment = { dataUrl: base64, filename: file.name }; alert('Картинка прикреплена. Отправь сообщение, чтобы вложить.'); });
function toDataURL(file){ return new Promise((resolve)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.readAsDataURL(file); }); }

ui.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = ui.input.value.trim();
  if (!text && !state.pendingAttachment) return;
  ui.input.value = '';
  const u = await fetchJSON(apiBase + '/api/messages', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId: state.projectId, role:'user', content:text, attachment: state.pendingAttachment }) });
  state.pendingAttachment = null; state.messages.push(u); render();
  const placeholder = { id:-Date.now(), role:'assistant', content:'' }; state.messages.push(placeholder); render();
  const msgs = state.messages.map(m => ({ role: m.role, content: m.content }));
  const res = await fetch(apiBase + '/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ projectId: state.projectId, model: ui.model.value, messages: msgs }) });
  const reader = res.body.getReader(); const decoder = new TextDecoder();
  while (true){ const { value, done } = await reader.read(); if (done) break; const chunk = decoder.decode(value);
    for (const part of chunk.split('\n\n')){ if (!part.startsWith('data:')) continue; const data = part.slice(5).trim(); if (data === '[DONE]') continue;
      try { const obj = JSON.parse(data); if (obj.delta){ placeholder.content += obj.delta; render(); } } catch {}
    } }
});

ui.newProjectForm.addEventListener('submit', async (e)=>{ e.preventDefault(); const name = ui.newProjectName.value.trim(); if (!name) return; ui.newProjectName.value=''; await fetchJSON(apiBase + '/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); await loadProjects(); await loadHistory(); });

ui.newChat.addEventListener('click', () => { if (!state.projectId) return; state.messages = []; state.oldestId = null; render(); });

function setupVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ ui.micBtn.disabled = true; ui.micState.textContent = 'NO MIC API'; return; }
  const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'ru-RU';
  state.recognizer = rec;
  rec.onstart = ()=>{ state.recognizing = true; ui.micState.textContent = 'REC'; ui.micBtn.classList.add('rec'); };
  rec.onend   = ()=>{ state.recognizing = false; ui.micState.textContent = 'OFF'; ui.micBtn.classList.remove('rec'); };
  rec.onresult = (e)=>{
    let finalText = ''; let interim = '';
    for (let i=e.resultIndex; i<e.results.length; i++){
      const tr = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += tr + ' ';
      else interim += tr;
    }
    function lightPunct(s){ s = s.trim(); if(!s) return s; s = s[0].toUpperCase() + s.slice(1); if(!/[.!?…]$/.test(s)) s += '.'; return s; }
    if (finalText) ui.input.value += (ui.input.value ? ' ' : '') + lightPunct(finalText.trim());
  };
  ui.micBtn.addEventListener('click', ()=>{ if (!state.recognizing) rec.start(); else rec.stop(); });
}

function openSettingsModal(){ ui.apiKeyInput.value = state.apiKey || ''; ui.settingsModal.classList.remove('hidden'); }
function closeSettingsModal(){ ui.settingsModal.classList.add('hidden'); }
ui.openSettings.addEventListener('click', openSettingsModal);
ui.closeSettings.addEventListener('click', closeSettingsModal);
ui.saveSettings.addEventListener('click', async ()=>{
  const apiKey = ui.apiKeyInput.value.trim();
  await fetchJSON(apiBase + '/api/settings', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ apiKey }) });
  state.apiKey = apiKey; closeSettingsModal(); alert('Сохранено ✅');
});

init();
