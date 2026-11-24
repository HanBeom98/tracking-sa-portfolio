# 공지사항 게시 원고

> 작성 기준: 2026년 7월 18일~19일 `main` 브랜치 반영 내역  
> 게시 카테고리: 공지사항  
> 아래 제목과 HTML 본문을 게시판 작성 화면에 각각 복사해 사용합니다.

## 제목

서든어택 전적 검색 개편 및 서비스 집중화 업데이트 안내

## 본문 요약

| 구분 | 주요 업데이트 | 기대 효과 |
|---|---|---|
| 전적 검색 | 결과 대시보드와 로딩 흐름 개편 | 원하는 정보를 더 빠르고 명확하게 확인 |
| 최근 경기 | 경기 유형별 탭, 추가 기록 불러오기, 맵 이미지와 팀 점수판 제공 | 경기 맥락과 흐름을 쉽게 파악 |
| 활동 분석 | 최근 활동 요약, 31일 활동 히트맵, 일자별 비교 추가 | 플레이 패턴과 활동 변화를 한눈에 확인 |
| 성능 | 프로필 병렬 로딩과 API 응답 캐시 적용 | 검색 대기 시간과 반복 호출 감소 |
| 리그 | 공개 전적 검색과 리그 허브의 역할 분리 | 검색과 운영 기능을 목적에 맞게 이용 |
| 서비스 구조 | 서든어택 전적 검색과 리그 중심으로 메뉴 정리 | 핵심 기능에 더 쉽게 접근 |
| 게시판 | 글 작성과 공지 등록 흐름 안정화 | 공지와 게시글을 안정적으로 등록 |

## 게시판용 HTML 본문

```html
<div style="max-width: 760px; margin: 0 auto; color: inherit; font-size: 17px; line-height: 1.85; word-break: keep-all; overflow-wrap: break-word;">
  <p style="margin: 0 0 28px; font-size: 18px; line-height: 1.8;">
    안녕하세요. Tracking SA입니다.<br>
    7월 19일, 서든어택 전적 검색을 더 빠르고 읽기 쉽게 이용할 수 있도록 화면과 데이터 처리 구조를 전반적으로 개선했습니다. 이번 업데이트는 기능을 단순히 늘리는 것보다, 자주 사용하는 전적 검색과 리그 기능에 서비스의 중심을 맞추는 데 초점을 두었습니다.
  </p>

  <div style="margin: 32px 0; padding: 22px 24px; border-left: 4px solid #2563eb; border-radius: 10px; background: rgba(37, 99, 235, 0.08);">
    <strong style="display: block; margin-bottom: 8px; font-size: 20px; line-height: 1.4;">이번 업데이트 한눈에 보기</strong>
    <span style="font-size: 16px; line-height: 1.75;">전적 결과 화면 개편, 최근 경기 분류, 활동 분석, 검색 속도 개선, 리그 허브 분리, 서비스 메뉴 정리가 함께 반영되었습니다.</span>
  </div>

  <h2 style="margin: 46px 0 18px; font-size: 26px; line-height: 1.35; letter-spacing: -0.02em;">1. 전적 검색 결과 화면 개편</h2>
  <p style="margin: 0 0 18px;">검색 결과를 프로필, 핵심 지표, 최근 경기와 활동 정보 순서로 자연스럽게 읽을 수 있도록 대시보드를 다시 구성했습니다. 데이터를 불러오는 동안에는 진행 상태를 단계별로 표시해 현재 어떤 정보를 준비하고 있는지 알 수 있습니다.</p>
  <p style="margin: 0;">프로필 메뉴와 주요 기능의 위치도 정리해 모바일과 PC 모두에서 필요한 정보로 더 쉽게 이동할 수 있도록 개선했습니다.</p>

  <h2 style="margin: 46px 0 18px; font-size: 26px; line-height: 1.35; letter-spacing: -0.02em;">2. 최근 경기 기록을 더 자세하게</h2>
  <p style="margin: 0 0 18px;">최근 경기를 유형별 탭으로 나누어 원하는 기록을 골라 볼 수 있게 했습니다. 첫 화면에 표시된 기록 이후의 경기도 추가로 불러올 수 있어 이전 경기 흐름을 계속 확인할 수 있습니다.</p>
  <p style="margin: 0;">경기 카드에는 맵 이미지와 팀 점수판을 추가했습니다. 기록 숫자만 보던 방식에서 벗어나 어떤 맵에서 어떤 결과가 나왔는지 더 빠르게 이해할 수 있습니다.</p>

  <h2 style="margin: 46px 0 18px; font-size: 26px; line-height: 1.35; letter-spacing: -0.02em;">3. 플레이어 활동 분석 추가</h2>
  <p style="margin: 0 0 18px;">최근 활동량과 플레이 흐름을 확인할 수 있는 활동 요약을 추가했습니다. 최근 31일 활동 히트맵을 통해 자주 플레이한 날과 활동이 적었던 시기를 한눈에 살펴볼 수 있습니다.</p>
  <p style="margin: 0;">일자별 활동 비교도 함께 제공해 단순 누적 기록을 넘어 최근 플레이 패턴이 어떻게 달라졌는지 확인할 수 있도록 했습니다.</p>

  <h2 style="margin: 46px 0 18px; font-size: 26px; line-height: 1.35; letter-spacing: -0.02em;">4. 검색 속도와 안정성 개선</h2>
  <p style="margin: 0 0 18px;">프로필에 필요한 데이터를 효율적으로 불러오도록 조회 과정을 개선하고, 서든어택 API 응답에 캐시를 적용했습니다. 같은 정보를 반복해서 조회할 때 발생하는 불필요한 요청을 줄여 더 안정적인 검색 경험을 제공하는 것이 목적입니다.</p>
  <p style="margin: 0;">검색 중 일부 데이터가 늦게 도착하더라도 화면 전체가 오래 멈춘 것처럼 보이지 않도록 로딩 흐름도 함께 다듬었습니다.</p>

  <h2 style="margin: 46px 0 18px; font-size: 26px; line-height: 1.35; letter-spacing: -0.02em;">5. 공개 전적과 리그 허브 분리</h2>
  <p style="margin: 0 0 18px;">일반 사용자가 이용하는 공개 전적 검색과 리그 참가자가 이용하는 운영 기능을 명확히 분리했습니다. 공개 전적 화면은 닉네임 검색, 최근 경기, 시즌 지표와 VS 비교에 집중합니다.</p>
  <p style="margin: 0;">리그 허브에서는 리그 기준 멤버 전적, 크루 랭킹, 신청, 팀 밸런서와 관리 기능을 제공합니다. 목적에 맞는 화면으로 바로 이동할 수 있어 검색 기능과 운영 기능이 섞이지 않습니다.</p>

  <h2 style="margin: 46px 0 18px; font-size: 26px; line-height: 1.35; letter-spacing: -0.02em;">6. Tracking SA 서비스 구조 정리</h2>
  <p style="margin: 0 0 18px;">홈페이지를 서든어택 전적 검색과 리그 허브 중심으로 개편하고, 현재 서비스 방향과 관련이 적은 기존 기능과 메뉴를 정리했습니다. 앞으로도 핵심 기능의 품질과 사용성을 우선해 개발할 예정입니다.</p>
  <p style="margin: 0;">게시판 글 작성과 관리자 공지 등록 과정에서 발생하던 문제도 함께 수정해 운영 안내를 더 안정적으로 전달할 수 있도록 했습니다.</p>

  <div style="margin: 48px 0 0; padding: 24px; border: 1px solid rgba(148, 163, 184, 0.35); border-radius: 14px;">
    <strong style="display: block; margin-bottom: 10px; font-size: 20px; line-height: 1.4;">앞으로의 업데이트</strong>
    <p style="margin: 0; font-size: 16px; line-height: 1.75;">현재 SOOP 서든어택 라이브 방송을 홈페이지에서 확인할 수 있는 연동도 준비하고 있습니다. 공식 API 사용 승인과 개발이 완료되면 별도 공지를 통해 안내드리겠습니다.</p>
  </div>

  <p style="margin: 42px 0 0;">이용 중 불편한 점이나 개선 의견이 있다면 문의 페이지 또는 게시판을 통해 알려주세요. 보내주신 의견을 확인해 전적 검색과 리그 기능을 계속 다듬겠습니다.</p>
  <p style="margin: 18px 0 0; font-weight: 700;">감사합니다.<br>Tracking SA</p>
</div>
```

## 게시 전 확인 사항

- 제목 입력란에는 위의 `제목`만 복사합니다.
- 본문 입력란에는 코드 블록 안의 `<div>...</div>`만 복사합니다.
- 게시 후 PC와 모바일에서 제목 크기, 표 대신 사용한 요약 상자, 문단 간격을 확인합니다.
- SOOP 연동 문구는 현재 준비 중인 기능이므로 실제 일정이나 승인 여부를 확정적으로 표현하지 않습니다.
