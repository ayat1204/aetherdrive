import os
import uuid
import json
import time
from typing import List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Header
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

import boto3
import botocore

STORAGE_KEY = 'files.json'

# Environment configuration
S3_BUCKET = os.getenv('AETHERDRIVE_S3_BUCKET')
AWS_REGION = os.getenv('AWS_REGION')
API_KEY = os.getenv('AETHERDRIVE_API_KEY')

app = FastAPI(title='AetherDrive Backend (S3)')
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ограничьте в production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize S3 client if configuration present
s3 = None
if S3_BUCKET and os.getenv('AWS_ACCESS_KEY_ID') and os.getenv('AWS_SECRET_ACCESS_KEY'):
    s3 = boto3.client('s3', region_name=AWS_REGION)

if s3 is None:
    # Fail fast: require S3 configuration for this deployment
    @app.on_event('startup')
    async def startup_check():
        raise RuntimeError('S3 is not configured. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY and AETHERDRIVE_S3_BUCKET')

# Dependency to verify API key if configured
def verify_api_key(x_api_key: Optional[str] = Header(None)):
    if API_KEY is None:
        # No key configured on server -> allow open access
        return True
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail='Forbidden')
    return True


def load_meta():
    try:
        res = s3.get_object(Bucket=S3_BUCKET, Key=STORAGE_KEY)
        content = res['Body'].read().decode('utf-8')
        return json.loads(content)
    except botocore.exceptions.ClientError as e:
        # If object not found, return empty list
        if e.response['Error']['Code'] in ('NoSuchKey', 'NoSuchBucket'):
            return []
        raise


def save_meta(meta):
    s3.put_object(Bucket=S3_BUCKET, Key=STORAGE_KEY, Body=json.dumps(meta, ensure_ascii=False).encode('utf-8'), ContentType='application/json')


@app.get('/files')
async def list_files():
    meta = load_meta()
    return meta


@app.post('/upload', dependencies=[Depends(verify_api_key)])
async def upload_files(files: List[UploadFile] = File(...)):
    meta = load_meta()
    result = []
    for up in files:
        file_id = uuid.uuid4().hex[:12]
        filename = up.filename
        ext = ('.' + filename.split('.')[-1]) if '.' in filename else ''
        storage_name = f"{file_id}{ext}"
        try:
            data = await up.read()
            s3.put_object(Bucket=S3_BUCKET, Key=storage_name, Body=data, ContentType=up.content_type)
            item = {
                'id': file_id,
                'name': filename,
                'size': len(data),
                'type': up.content_type,
                'createdAt': int(time.time() * 1000),
                'storage_name': storage_name
            }
            meta.append(item)
            result.append(item)
        finally:
            await up.close()
    save_meta(meta)
    return JSONResponse(result)


@app.get('/files/{file_id}/download')
async def download_file(file_id: str):
    meta = load_meta()
    item = next((m for m in meta if m['id'] == file_id), None)
    if not item:
        raise HTTPException(status_code=404, detail='File not found')
    storage_name = item['storage_name']
    try:
        url = s3.generate_presigned_url('get_object', Params={'Bucket': S3_BUCKET, 'Key': storage_name}, ExpiresIn=3600)
        return RedirectResponse(url)
    except botocore.exceptions.ClientError:
        raise HTTPException(status_code=500, detail='Failed to generate download URL')


@app.delete('/files/{file_id}', dependencies=[Depends(verify_api_key)])
async def delete_file(file_id: str):
    meta = load_meta()
    idx = next((i for i, m in enumerate(meta) if m['id'] == file_id), None)
    if idx is None:
        raise HTTPException(status_code=404, detail='File not found')
    item = meta.pop(idx)
    storage_name = item['storage_name']
    try:
        s3.delete_object(Bucket=S3_BUCKET, Key=storage_name)
    except botocore.exceptions.ClientError:
        # ignore if delete failed
        pass
    save_meta(meta)
    return {'ok': True}


@app.get('/backup')
async def backup_all():
    meta = load_meta()
    return JSONResponse(content=meta)
