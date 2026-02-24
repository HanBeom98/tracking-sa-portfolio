import os
import sys
from dotenv import load_dotenv

# DDD 경로 추가 (Import 보장)
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'src')))

from src.shared.infra.builder import generate_public_site

def main():
    load_dotenv()
    print("🚀 DDD-based Site Generation Start...")
    
    # 8시간의 혼란을 끝낼 정석 빌드 가동
    generate_public_site()
    
    print("\n✨ All Domains are synchronized and built.")

if __name__ == "__main__":
    main()
