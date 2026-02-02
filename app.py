# app.py
import os
import re
import json
from flask import Flask, send_from_directory, jsonify, render_template_string
from datetime import datetime

app = Flask(__name__, static_url_path='', static_folder='.')

NEWS_POSTS_DIR = 'posts'

# Helper to extract title from markdown content
def extract_title_from_md(md_content):
    title_match = re.search(r'^#\s*(.+)', md_content, re.MULTILINE)
    if title_match:
        return title_match.group(1).strip()
    return "제목 없음" # Default title if not found

# Endpoint to serve static files (e.g., index.html, style.css, main.js etc.)
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    # Prevent directory traversal by ensuring path is within current directory
    if ".." in path or path.startswith('/'):
        return "Forbidden", 403
    return send_from_directory('.', path)

# API endpoint to list all news articles
@app.route('/api/news')
def list_news_articles():
    articles_meta = []
    if not os.path.exists(NEWS_POSTS_DIR):
        return jsonify([])

    for filename in sorted(os.listdir(NEWS_POSTS_DIR), reverse=True):
        if filename.endswith('.md'):
            filepath = os.path.join(NEWS_POSTS_DIR, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                title = extract_title_from_md(content)
                
                # Extract date from filename: YYYY-MM-DD-slug.md
                date_str_match = re.match(r'(\d{4}-\d{2}-\d{2})', filename)
                date = date_str_match.group(1) if date_str_match else '날짜 미상'

                articles_meta.append({
                    'id': filename.replace('.md', ''), # Use filename as ID for client-side routing
                    'title': title,
                    'date': date
                })
            except Exception as e:
                print(f"Error processing {filename}: {e}")
                continue
    return jsonify(articles_meta)

# API endpoint to get a single news article content
@app.route('/api/news/<article_id>')
def get_news_article(article_id):
    # Ensure article_id is safe (alphanumeric, hyphens, no directory traversal)
    if not re.match(r'^[a-zA-Z0-9_-]+$', article_id):
        return jsonify({"error": "Invalid article ID"}), 400

    filename = f"{article_id}.md"
    filepath = os.path.join(NEWS_POSTS_DIR, filename)

    if not os.path.exists(filepath):
        return jsonify({"error": "Article not found"}), 404

    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        return jsonify({'content': content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # For development, run with `flask run` or `python app.py`
    # In production, use a more robust WSGI server like Gunicorn
    app.run(debug=True, port=5000)
