# AetherDrive backend

Простой backend на FastAPI для хранения файлов на диске и их общего доступа.

Безопасность: поддержка простого API-ключа
- Если вы хотите ограничить возможность загружать и удалять файлы, задайте переменную окружения AETHERDRIVE_API_KEY перед запуском сервера.
  Например в Linux/macOS:

    export AETHERDRIVE_API_KEY="my-secret-key"
    uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000

- Если AETHERDRIVE_API_KEY не задана, сервер работает в открытом режиме (upload/delete доступны без ключа).
- Клиент (фронтенд) должен передавать ключ в заголовке 'x-api-key' при запросах POST /upload и DELETE /files/{id}.

Запуск локально:

1. Создайте виртуальное окружение и установите зависимости:

   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt

2. Запустите сервер (с ключом или без):

   # с ключом
   export AETHERDRIVE_API_KEY="your-secret-key"
   uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000

   # без ключа (открытый режим)
   uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000

3. В UI (фронтенд) введите URL backend и API Key (если задан) и нажмите Подключиться.

Замечания по безопасности и production:
- По умолчанию CORS разрешает все origin — ограничьте это под ваш домен в production.
- Хранение файлов на диске подходит для простых случаев; для масштабирования используйте S3 или объектное хранилище.
- Добавьте HTTPS, аутентификацию/разрешения и лимиты на загрузку для production.
