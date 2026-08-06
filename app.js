/* Фронтенд: упрощённый режим — требуется backend (S3). Локальный fallback удалён. */

let API_BASE = null; // example: https://your-backend
let API_KEY = null;

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

function escapeHtml(s){
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"})[c]);
}

function enableControls(enabled){
  document.getElementById('fileInput').disabled = !enabled;
  document.getElementById('exportAll').disabled = !enabled;
  document.getElementById('importBackup').disabled = !enabled;
}

function renderList(filter=''){
  const tbody = document.querySelector('#filesTable tbody');
  tbody.innerHTML = '';
  if (!API_BASE) return;
  fetch(`${API_BASE}/files`)
    .then(r => r.json())
    .then(files => {
      const filtered = files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
      if (filtered.length === 0) {
        document.getElementById('emptyMsg').textContent = 'Файлов пока нет.';
        document.getElementById('emptyMsg').style.display = 'block';
        document.getElementById('filesTable').style.display = 'none';
        return;
      }
      document.getElementById('emptyMsg').style.display = 'none';
      document.getElementById('filesTable').style.display = 'table';
      filtered.forEach(f => {
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
    })
    .catch(err => { console.error(err); alert('Не удалось получить список файлов с backend'); });
}

async function handleFilesList(filesList){
  if (!API_BASE) return alert('Сначала подключитесь к backend');
  const form = new FormData();
  for (const file of filesList) form.append('files', file);
  const headers = {};
  if (API_KEY) headers['x-api-key'] = API_KEY;
  try {
    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form, headers });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(txt || 'Upload failed');
    }
    renderList(document.getElementById('search').value);
  } catch(e){ alert('Ошибка загрузки: '+e.message); }
}

function downloadFileById(id){
  if (!API_BASE) return alert('Сначала подключитесь к backend');
  // Open direct download URL (backend will redirect to presigned S3 URL)
  const a = document.createElement('a');
  a.href = `${API_BASE}/files/${id}/download`;
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function deleteFileById(id){
  if (!API_BASE) return alert('Сначала подключитесь к backend');
  const headers = {};
  if (API_KEY) headers['x-api-key'] = API_KEY;
  try {
    const res = await fetch(`${API_BASE}/files/${id}`, { method: 'DELETE', headers });
    if (!res.ok) {
      const txt = await res.text().catch(()=>null);
      throw new Error(txt || 'Delete failed');
    }
    renderList(document.getElementById('search').value);
  } catch(e){ alert('Ошибка удаления: '+e.message); }
}

function exportAll(){
  if (!API_BASE) return alert('Сначала подключитесь к backend');
  const headers = {};
  if (API_KEY) headers['x-api-key'] = API_KEY;
  fetch(`${API_BASE}/backup`, { headers })
    .then(r => { if (!r.ok) throw new Error('Export failed'); return r.blob(); })
    .then(blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'aetherdrive-backup.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); })
    .catch(err => alert('Ошибка экспорта: '+err.message));
}

function importBackup(file){
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(r.result);
      if (!Array.isArray(parsed)) throw new Error('Неверный формат');
      alert('Импорт на сервер не реализован. Если нужно — добавлю.');
    } catch(e){ alert('Ошибка импорта: '+e.message); }
  };
  r.readAsText(file);
}

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
    const key = document.getElementById('apiKey').value.trim();
    API_BASE = url || null;
    API_KEY = key || null;
    if (!API_BASE) return alert('Введите Backend URL');
    enableControls(true);
    renderList();
    alert('Подключено к ' + API_BASE + (API_KEY ? ' (API Key задан)' : ''));
  });

  // Initially disabled until connect
  enableControls(false);
});
