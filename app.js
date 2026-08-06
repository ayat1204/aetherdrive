/* Фронтенд: теперь использует backend если указан. Если backend недоступен, fallback на localStorage */

const STORAGE_KEY = 'aetherdrive_files_v1_local';
let API_BASE = null; // example: http://localhost:8000

function uid() { return Math.random().toString(36).slice(2, 9); }

function loadFilesLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveFilesLocal(files) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

function renderList(filter=''){
  const tbody = document.querySelector('#filesTable tbody');
  tbody.innerHTML = '';
  if (API_BASE) {
    // fetch from server
    fetch(`${API_BASE}/files`)
      .then(r => r.json())
      .then(files => {
        const filtered = files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
        renderRows(filtered);
      })
      .catch(err => {
        console.error('Ошибка при получении списка с backend:', err);
        // fallback
        const local = loadFilesLocal().filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
        renderRows(local);
      });
  } else {
    const files = loadFilesLocal();
    const filtered = files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
    renderRows(filtered);
  }
}

function renderRows(files){
  const tbody = document.querySelector('#filesTable tbody');
  if (files.length === 0) {
    document.getElementById('emptyMsg').style.display = 'block';
    document.getElementById('filesTable').style.display = 'none';
    return;
  }
  document.getElementById('emptyMsg').style.display = 'none';
  document.getElementById('filesTable').style.display = 'table';
  files.forEach(f => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(f.name)}</td>
      <td>${humanSize(f.size)}</td>
      <td>${escapeHtml(f.type || '')}</td>
      <td>${new Date(f.createdAt).toLocaleString()}</td>
      <td>
        <button class="download" data-id="${f.id}">Скачать</button>
        <button class="delete secondary" data-id="${f.id}">Удалить</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function escapeHtml(s){
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"})[c]);
}

async function handleFilesList(filesList){
  if (API_BASE) {
    const form = new FormData();
    for (const file of filesList) form.append('files', file);
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form });
      if (!res.ok) throw new Error('Upload failed');
      await renderList(document.getElementById('search').value);
    } catch(e){
      alert('Ошибка загрузки на сервер: '+e.message);
    }
    return;
  }

  // fallback: localStorage as before
  const files = loadFilesLocal();
  for (const file of filesList) {
    const id = uid();
    const dataURL = await readAsDataURL(file);
    files.push({ id, name: file.name, size: file.size, type: file.type, createdAt: Date.now(), dataURL });
    saveFilesLocal(files);
  }
  renderList(document.getElementById('search').value);
}

function readAsDataURL(file){
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

async function downloadFileById(id){
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/files/${id}/download`);
      if (!res.ok) return alert('Ошибка скачивания');
      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition');
      let filename = 'file';
      if (disposition) {
        const m = disposition.match(/filename="?([^";]+)"?/);
        if (m) filename = m[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch(e){ alert('Ошибка: '+e.message); }
    return;
  }

  // local fallback
  const files = loadFilesLocal();
  const f = files.find(x => x.id === id);
  if (!f) return alert('Файл не найден');
  const a = document.createElement('a');
  a.href = f.dataURL;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function deleteFileById(id){
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/files/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      renderList(document.getElementById('search').value);
    } catch(e){ alert('Ошибка удаления: '+e.message); }
    return;
  }
  let files = loadFilesLocal();
  files = files.filter(x => x.id !== id);
  saveFilesLocal(files);
  renderList(document.getElementById('search').value);
}

function exportAll(){
  if (API_BASE) {
    // request server to provide backup
    fetch(`${API_BASE}/backup`)
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'aetherdrive-backup.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      })
      .catch(err => alert('Ошибка экспорта: '+err.message));
    return;
  }
  const files = loadFilesLocal();
  const content = JSON.stringify(files);
  const blob = new Blob([content], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'aetherdrive-backup.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function importBackup(file){
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(r.result);
      if (!Array.isArray(parsed)) throw new Error('Неверный формат');
      if (API_BASE) {
        // send each file as JSON? server expects file uploads; for simplicity, skip server import and alert
        alert('Импорт backup на сервер пока не реализован через UI. Импорт будет выполнен локально.');
      }
      saveFilesLocal(parsed);
      renderList(document.getElementById('search').value);
      alert('Импорт (локально) завершён');
    } catch(e){ alert('Ошибка импорта: '+e.message); }
  };
  r.readAsText(file);
}

// Events
window.addEventListener('DOMContentLoaded', ()=>{
  const input = document.getElementById('fileInput');
  input.addEventListener('change', e => { handleFilesList(Array.from(e.target.files)); input.value = ''; });

  document.getElementById('filesTable').addEventListener('click', e => {
    const d = e.target.closest('button'); if (!d) return; const id = d.dataset.id;
    if (d.classList.contains('download')) downloadFileById(id);
    if (d.classList.contains('delete')) { if (confirm('Удалить файл?')) deleteFileById(id); }
  });

  document.getElementById('exportAll').addEventListener('click', exportAll);
  document.getElementById('importBackup').addEventListener('click', ()=>{ const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json'; inp.onchange = e => { importBackup(e.target.files[0]); }; inp.click(); });

  document.getElementById('search').addEventListener('input', e => renderList(e.target.value));

  document.getElementById('connect').addEventListener('click', ()=>{
    const url = document.getElementById('backendUrl').value.trim();
    API_BASE = url || null;
    renderList(document.getElementById('search').value);
    if (API_BASE) alert('Подключено к ' + API_BASE);
  });

  renderList();
});
