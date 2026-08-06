/* Простая реализация хранения файлов в localStorage как прототип.
   Ограничения: localStorage имеет лимит и не подходит для больших файлов.
   Это демо, чтобы быстро запустить сайт "аналог Google Drive" на GitHub Pages. */

const STORAGE_KEY = 'aetherdrive_files_v1';

function uid() { return Math.random().toString(36).slice(2, 9); }

function loadFiles() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveFiles(files) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function humanSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/(1024*1024)).toFixed(2) + ' MB';
}

function renderList(filter=''){
  const tbody = document.querySelector('#filesTable tbody');
  const files = loadFiles();
  tbody.innerHTML = '';
  const filtered = files.filter(f => f.name.toLowerCase().includes(filter.toLowerCase()));
  if (filtered.length === 0) {
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
}

function escapeHtml(s){
  return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#039;"})[c]);
}

async function handleFilesList(filesList){
  const files = loadFiles();
  for (const file of filesList) {
    const id = uid();
    const dataURL = await readAsDataURL(file);
    files.push({ id, name: file.name, size: file.size, type: file.type, createdAt: Date.now(), dataURL });
    // Save progressively to avoid data loss on large selection
    saveFiles(files);
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

function downloadFileById(id){
  const files = loadFiles();
  const f = files.find(x => x.id === id);
  if (!f) return alert('Файл не найден');
  const a = document.createElement('a');
  a.href = f.dataURL;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function deleteFileById(id){
  let files = loadFiles();
  files = files.filter(x => x.id !== id);
  saveFiles(files);
  renderList(document.getElementById('search').value);
}

function exportAll(){
  const files = loadFiles();
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
      saveFiles(parsed);
      renderList(document.getElementById('search').value);
      alert('Импорт завершён');
    } catch(e){ alert('Ошибка импорта: '+e.message); }
  };
  r.readAsText(file);
}

// Events
window.addEventListener('DOMContentLoaded', ()=>{
  const input = document.getElementById('fileInput');
  input.addEventListener('change', e => {
    handleFilesList(Array.from(e.target.files));
    input.value = '';
  });

  document.getElementById('filesTable').addEventListener('click', e => {
    const d = e.target.closest('button');
    if (!d) return;
    const id = d.dataset.id;
    if (d.classList.contains('download')) downloadFileById(id);
    if (d.classList.contains('delete')) {
      if (confirm('Удалить файл?')) deleteFileById(id);
    }
  });

  document.getElementById('exportAll').addEventListener('click', exportAll);

  document.getElementById('importBackup').addEventListener('click', ()=>{
    const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json';
    inp.onchange = e => { importBackup(e.target.files[0]); };
    inp.click();
  });

  document.getElementById('search').addEventListener('input', e => renderList(e.target.value));

  renderList();
});
