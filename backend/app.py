from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os, uuid, json, shutil
from typing import List

STORAGE_DIR = os.path.join(os.path.dirname(__file__), 'storage')
META_FILE = os.path.join(STORAGE_DIR, 'files.json')

os.makedirs(STORAGE_DIR, exist_ok=True)
if not os.path.exists(META_FILE):
    with open(META_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

app = FastAPI(title='AetherDrive Backend')
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # для простоты: разрешаем все. Ограничьте это в production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_meta():
    with open(META_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_meta(meta):
    with open(META_FILE, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

@app.get('/files')
async def list_files():
    meta = load_meta()
    return meta

@app.post('/upload')
async def upload_files(files: List[UploadFile] = File(...)):
    meta = load_meta()
    result = []
    for up in files:
        file_id = uuid.uuid4().hex[:12]
        filename = up.filename
        ext = os.path.splitext(filename)[1]
        storage_name = f"{file_id}{ext}"
        path = os.path.join(STORAGE_DIR, storage_name)
        with open(path, 'wb') as out:
            shutil.copyfileobj(up.file, out)
        item = {
            'id': file_id,
            'name': filename,
            'size': os.path.getsize(path),
            'type': up.content_type,
            'createdAt': int(os.path.getmtime(path) * 1000),
            'storage_name': storage_name
        }
        meta.append(item)
        result.append(item)
    save_meta(meta)
    return JSONResponse(result)

@app.get('/files/{file_id}/download')
async def download_file(file_id: str):
    meta = load_meta()
    item = next((m for m in meta if m['id'] == file_id), None)
    if not item:
        raise HTTPException(status_code=404, detail='File not found')
    path = os.path.join(STORAGE_DIR, item['storage_name'])
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail='File content not found')
    return FileResponse(path, filename=item['name'], media_type=item.get('type') or 'application/octet-stream')

@app.delete('/files/{file_id}')
async def delete_file(file_id: str):
    meta = load_meta()
    idx = next((i for i,m in enumerate(meta) if m['id'] == file_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail='File not found')
    item = meta.pop(idx)
    path = os.path.join(STORAGE_DIR, item['storage_name'])
    if os.path.exists(path):
        os.remove(path)
    save_meta(meta)
    return {'ok': True}

@app.get('/backup')
async def backup_all():
    meta = load_meta()
    # return JSON file as blob
    payload = json.dumps(meta, ensure_ascii=False)
    return JSONResponse(content=json.loads(payload))
