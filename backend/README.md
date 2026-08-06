# AetherDrive backend — S3 storage

Эта версия бекенда сохраняет файлы и метаданные в S3-совместимом хранилище.

Необходимые переменные окружения
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY
- AWS_REGION (опционально, но рекомендуется)
- AETHERDRIVE_S3_BUCKET — имя bucket'a для хранения файлов и files.json
- AETHERDRIVE_API_KEY — (опционально) если задан, upload и delete требуют заголовок x-api-key

Запуск локально (пример):

export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AETHERDRIVE_S3_BUCKET="my-aether-bucket"
export AETHERDRIVE_API_KEY="my-secret-key"  # опционально
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000

Деплой (Render / Railway / Cloud Run):
- Укажите переменные окружения в настройках сервиса как перечислено выше.
- Примените Dockerfile или используйте pip install -r backend/requirements.txt и запустите uvicorn.

Примечание: при первом запуске, если в бакете отсутствует files.json, он будет создан при первой загрузке файла.
