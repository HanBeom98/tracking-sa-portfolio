import feedparser
import os
import datetime
import subprocess
import requests
from dotenv import load_dotenv

load_dotenv()

def fetch_ai_news(rss_url):
    feed = feedparser.parse(rss_url)
    if feed.entries:
        return feed.entries[0]
    return None

def generate_ai_content(api_key, news_title, news_summary):
    # 님의 목록에서 확인된 정확한 이름 'gemini-flash-latest'를 사용합니다.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    headers = {'Content-Type': 'application/json'}
    payload = {
        "contents": [{
            "parts": [{
                "text": f"뉴스 제목: {news_title}\n뉴스 요약: {news_summary}\n\n위 내용을 바탕으로 한국어 마크다운 포스팅을 작성해줘. 제목, 본문, 수익화 아이디어 3가지를 포함해줘."
            }]
        }]
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        result = response.json()
        
        if 'candidates' in result:
            return result['candidates'][0]['content']['parts'][0]['text']
        else:
            print("❌ API 응답 오류 상세:", result)
            return None
    except Exception as e:
        print(f"네트워크 오류: {e}")
        return None

def save_post(content, post_dir="posts"):
    os.makedirs(post_dir, exist_ok=True)
    today_date = datetime.date.today().strftime("%Y-%m-%d")
    filename = os.path.join(post_dir, f"{today_date}-ai-analysis.md")
    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"💾 파일 저장 완료: {filename}")
    return filename

def git_push_changes():
    try:
        subprocess.run(["git", "config", "user.name", "Gemini Bot"], check=False)
        subprocess.run(["git", "config", "user.email", "bot@gemini.ai"], check=False)
        subprocess.run(["git", "add", "."], check=True)
        subprocess.run(["git", "commit", "-m", f"Auto-post {datetime.date.today()}"], check=True)
        subprocess.run(["git", "push"], check=True)
        print("🚀 GitHub 푸시 성공!")
    except Exception as e:
        print(f"⚠️ Git 오류: {e}")

def main():
    rss_url = "https://techcrunch.com/category/artificial-intelligence/feed/"
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key:
        print("에러: .env 파일에 GEMINI_API_KEY가 없습니다.")
        return

    print("📡 최신 AI 뉴스 수집 중...")
    news = fetch_ai_news(rss_url)
    if news:
        print(f"📰 뉴스 발견: {news.title}")
        print("🤖 AI 분석 글 생성 중...")
        content = generate_ai_content(api_key, news.title, news.summary)
        if content:
            save_post(content)
            print("📤 GitHub 업로드 시도 중...")
            git_push_changes()
        else:
            print("🛑 콘텐츠 생성 실패.")

if __name__ == "__main__":
    main()