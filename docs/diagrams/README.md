# 포트폴리오 그림 재생성

`render_diagrams.py`가 같은 도형·텍스트 정의에서 SVG와 2배 해상도 PNG를 생성합니다. PNG는 GitHub 미리보기용, SVG는 확대·편집용입니다. 네트워크나 운영 DB에 접근하지 않습니다.

필요 환경: Python 3.11 이상, Pillow, 맑은 고딕 또는 Noto Sans CJK KR. Windows에서는 `C:/Windows/Fonts/malgun.ttf`, `malgunbd.ttf`를 사용합니다. 다른 환경에서는 스크립트의 폰트 후보 경로를 조정할 수 있습니다.

저장소 루트에서 실행:

```powershell
python -m pip install Pillow
python docs/diagrams/render_diagrams.py
```

결과는 `docs/images/portfolio-{architecture,data-model,search-flow,replay-flow}.{png,svg}`에 저장됩니다. 코드 변경 시 문서의 기준 커밋·필드·TTL과 그림을 함께 검토합니다. 자동 줄바꿈 뒤 카드 밖으로 텍스트가 넘치면 생성기가 오류를 냅니다. 생성 후에는 화살표·줄바꿈·글꼴을 눈으로도 확인합니다.
