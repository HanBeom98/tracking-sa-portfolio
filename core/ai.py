import subprocess

def generate_ai_content(api_key, news_title, news_summary):
    try:
        print("🤖 [Multi-Agent] 멀티 에이전트 뉴스 데스크 가동 중 (기획 -> 집필 -> 교열)...")
        # Node.js MAS 실행
        result = subprocess.run(
            ["node", "multi-agent-system/news-desk.js", news_title, news_summary],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except subprocess.CalledProcessError as e:
        print(f"🚨 멀티 에이전트 에러: {e.stderr}")
        return None
    except Exception as e:
        print(f"🚨 시스템 호출 에러: {e}")
        return None
