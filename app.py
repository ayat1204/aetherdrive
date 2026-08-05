#!/usr/bin/env python3
"""
Минимальный публичный файловый дроп (для локального теста).
Требования: Python 3.8+, pip install -r requirements.txt
Запуск: python app.py
Открой: http://localhost:5000
"""
import os
from uuid import uuid4
from flask import Flask, request, redirect, url_for, send_file, abort, render_template_string
from werkzeug.utils import secure_filename
from datetime import datetime

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "uploads")
MAX_MB = int(os.environ.get("MAX_MB", "100"))
MAX_BYTES = MAX_MB * 1024 * 1024

os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_BYTES

INDEX_HTML = """
<!doctype html>
<html>
  <head><meta charset="utf-8"><title>Простой File Drop</title></head>
  <body>
    <h1>Простой File Drop</h1>
    <p>Загрузите файл — он станет доступен всем по ссылке.</p>

    <form method="post" action="/upload" enctype="multipart/form-data">
      <input type="file" name="file" required>
      <button type="submit">Загрузить</button>
    </form>

    <h2>Загруженные файлы</h2>
    <div>
      {% if files %}
        <ul>
        {% for f in files %}
          <li>
            <a href="{{ url_for('download', stored_name=f.stored) }}">{{ f.original }}</a>
            — {{ (f.size/1024)|round(1) }} KB — {{ f.time }}
          </li>
        {% endfor %}
        </ul>
      {% else %}
        <p>Файлы отсутствуют.</p>
      {% endif %}
    </div>
    <p style="color:#777; font-size:0.9em;">Макс: {{ max_mb }} MB. Это тестовая локальная версия — не используйте в проде без доработок.</p>
  </body>
</html>
"""


def list_uploaded():
    items = []
    for name in sorted(os.listdir(UPLOAD_DIR), reverse=True):
        path = os.path.join(UPLOAD_DIR, name)
        if not os.path.isfile(path):
            continue
        original = name.split('_', 1)[1] if "_" in name else name
        stat = os.stat(path)
        items.append({
            "stored": name,
            "original": original,
            "size": stat.st_size,
            "time": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
        })
    return items


@app.route("/")
def index():
    files = list_uploaded()
    return render_template_string(INDEX_HTML, files=files, max_mb=MAX_MB)


@app.route("/upload", methods=["POST"])
def upload():
    if "file" not in request.files:
        return "Нет файла", 400
    f = request.files["file"]
    if f.filename == "":
        return "Нет выбранного файла", 400
    safe = secure_filename(f.filename)
    uid = uuid4().hex
    stored_name = f"{uid}_{safe}"
    path = os.path.join(UPLOAD_DIR, stored_name)
    f.save(path)
    return redirect(url_for("index"))


@app.route("/download/<stored_name>")
def download(stored_name):
    if "/" in stored_name or "\\" in stored_name:
        abort(400)
    path = os.path.join(UPLOAD_DIR, stored_name)
    if not os.path.exists(path):
        abort(404)
    original = stored_name.split('_', 1)[1] if "_" in stored_name else stored_name
    try:
        return send_file(path, as_attachment=True, download_name=original)
    except TypeError:
        return send_file(path, as_attachment=True)


@app.errorhandler(413)
def too_large(e):
    return f"Файл слишком большой. Ограничение {MAX_MB} MB.", 413


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
