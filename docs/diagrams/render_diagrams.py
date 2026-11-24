"""Render portfolio diagrams to SVG + PNG. Requires Pillow; no network calls."""
from pathlib import Path
from html import escape
import math
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parents[1] / 'images'
SCALE = 2
INK, MUTED = '#16283F', '#52657B'
BG, BORDER = '#F3F6FB', '#D7E0EB'
BLUE, TEAL, PURPLE = '#245EDB', '#087F79', '#7656B6'
FONT_DIR = Path('C:/Windows/Fonts')

def font(size, bold=False):
    candidates = [FONT_DIR / ('malgunbd.ttf' if bold else 'malgun.ttf'),
                  Path('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc')]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), round(size * SCALE))
    raise RuntimeError('Install Malgun Gothic or set a Korean font path in render_diagrams.py')

class Diagram:
    def __init__(self, height, number, label, title, subtitle):
        self.width, self.height = 1600, height
        self.image = Image.new('RGB', (1600*SCALE, height*SCALE), BG)
        self.draw = ImageDraw.Draw(self.image)
        self.parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="{height}" viewBox="0 0 1600 {height}">',
            f'<rect width="1600" height="{height}" fill="{BG}"/>']
        self.text(60, 42, f'TRACKINGSA   /   {number}  {label}', 17, TEAL, True)
        self.text(60, 87, title, 43, INK, True)
        self.text(60, 157, subtitle, 21, MUTED)
        self.text(60, height-45, 'TrackingSA  ·  코드 기준 1df8890  ·  2026.11', 16, MUTED)

    def rect(self, x,y,w,h,fill='#FFFFFF',stroke=None,r=20):
        coords=[round(v*SCALE) for v in (x,y,x+w,y+h)]
        self.draw.rounded_rectangle(coords, radius=round(r*SCALE), fill=fill, outline=stroke, width=2*SCALE)
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke or "none"}" stroke-width="2"/>')

    def text(self,x,y,text,size=20,color=INK,bold=False):
        self.draw.text((round(x*SCALE),round(y*SCALE)), text, font=font(size,bold), fill=color, anchor='lt')
        self.parts.append(f'<text x="{x}" y="{y+size*.87}" fill="{color}" font-family="Malgun Gothic,Noto Sans CJK KR,sans-serif" font-size="{size}" font-weight="{700 if bold else 400}">{escape(text)}</text>')

    def wrap(self,text,width,size=20,bold=False):
        lines, line = [], ''
        f=font(size,bold)
        for char in text:
            if char=='\n': lines.append(line);line='';continue
            if line and self.draw.textlength(line+char,font=f)>width*SCALE:
                lines.append(line.rstrip());line=char.lstrip()
            else:line+=char
        if line:lines.append(line.rstrip())
        return lines

    def card(self,x,y,w,h,title,lines,accent=BLUE,kicker='',body_size=20):
        self.rect(x,y+5,w,h,'#E8EDF5',None,20)
        self.rect(x,y,w,h,'#FFFFFF',BORDER,20)
        self.rect(x+22,y+25,5,29,accent,None,2)
        self.text(x+42,y+25,title,25,INK,True)
        top=y+77
        if kicker:
            for line in self.wrap(kicker,w-48,17):
                self.text(x+24,top,line,17,accent,True);top+=26
            top+=8
        for paragraph in lines:
            for line in self.wrap(paragraph,w-48,body_size):
                self.text(x+24,top,line,body_size,MUTED);top+=31
            top+=7
        assert top-(38-body_size) <= y+h-12, f'Card overflow: {title}: {top} > {y+h}'

    def arrow(self,points,color=BLUE,dashed=False,double=False):
        p=[(round(x*SCALE),round(y*SCALE)) for x,y in points]
        if dashed:
            for a,b in zip(p,p[1:]):
                length=math.dist(a,b)
                for s in range(0,round(length),18*SCALE):
                    e=min(s+10*SCALE,length)
                    self.draw.line([(a[0]+(b[0]-a[0])*s/length,a[1]+(b[1]-a[1])*s/length),(a[0]+(b[0]-a[0])*e/length,a[1]+(b[1]-a[1])*e/length)],fill=color,width=3*SCALE)
        else:self.draw.line(p,fill=color,width=3*SCALE,joint='curve')
        ends=[(p[-2],p[-1])]+([(p[1],p[0])] if double else [])
        for a,b in ends:
            angle=math.atan2(b[1]-a[1],b[0]-a[0]);length=12*SCALE
            tri=[b,(b[0]-length*math.cos(angle-.48),b[1]-length*math.sin(angle-.48)),(b[0]-length*math.cos(angle+.48),b[1]-length*math.sin(angle+.48))]
            self.draw.polygon(tri,fill=color)
        ps=' '.join(f'{x},{y}' for x,y in points)
        self.parts.append(f'<polyline points="{ps}" fill="none" stroke="{color}" stroke-width="3" stroke-linejoin="round"'+(' stroke-dasharray="10 8"' if dashed else '')+'/>')
        for a,b in [(points[-2],points[-1])]+([(points[1],points[0])] if double else []):
            angle=math.atan2(b[1]-a[1],b[0]-a[0]);length=12
            tri=[b,(b[0]-length*math.cos(angle-.48),b[1]-length*math.sin(angle-.48)),(b[0]-length*math.cos(angle+.48),b[1]-length*math.sin(angle+.48))]
            self.parts.append(f'<polygon points="{" ".join(f"{x},{y}" for x,y in tri)}" fill="{color}"/>')

    def note(self,x,y,w,h,title,body,accent=TEAL):
        self.rect(x,y,w,h,'#E7F3F2',None,16)
        self.text(x+24,y+20,title,22,accent,True)
        for i,line in enumerate(self.wrap(body,w-48,20)):
            self.text(x+24,y+57+30*i,line,20,INK)

    def save(self,name):
        OUT.mkdir(parents=True,exist_ok=True)
        self.parts.append('</svg>')
        (OUT/f'{name}.svg').write_text('\n'.join(self.parts),encoding='utf-8')
        self.image.save(OUT/f'{name}.png',optimize=True)
        print(name, self.image.size)

def architecture():
    d=Diagram(1160,'01','SYSTEM ARCHITECTURE','검색은 서버를 거치고, 기본 복기는 기기 안에서','핵심 전적·리플레이·회원/게시판 경로와 실행 위치를 구분했습니다.')
    d.arrow([(460,340),(590,340)],BLUE,double=True)
    d.text(486,290,'요청·응답',18,BLUE,True)
    d.arrow([(990,340),(1120,340)],BLUE,double=True)
    d.text(1006,290,'서버 키',18,BLUE,True)
    d.arrow([(260,470),(260,650)],TEAL)
    d.text(83,553,'JSON 파일·가상 샘플',19,TEAL,True)
    d.arrow([(420,470),(420,550),(790,550),(790,650)],BLUE)
    d.text(494,510,'Firebase SDK 직접 연결',19,BLUE,True)
    d.arrow([(1120,760),(990,760)],PURPLE,double=True)
    d.text(1005,706,'트리거·',17,PURPLE,True)
    d.text(1005,733,'서버 처리',17,PURPLE,True)
    d.card(60,250,400,220,'사용자 브라우저',['전적·VS·활동 화면','메모리·저장소 캐시','최근 검색·즐겨찾기'],BLUE,kicker='JavaScript · Web Components')
    d.card(590,250,400,220,'Cloudflare Pages',['정적 HTML·CSS·JS 제공','Functions: /api/sa-proxy','성공 응답 캐시·요청 공유'],BLUE,kicker='Pages + Pages Functions')
    d.card(1120,250,420,220,'NEXON Open API',['닉네임 → 선수 OUID','프로필·경기 목록·경기 상세','허용 경로만 프록시로 요청'],BLUE,kicker='외부 공식 경기 데이터')
    d.card(60,650,400,235,'브라우저 내부 리플레이',['JSON 검증 → 규칙 기반 계산','재생·여러 경기 비교','PNG·인쇄/PDF 생성'],TEAL,kicker='기본 파일·계산 결과: 서버 저장 없음')
    d.card(590,650,400,235,'Firebase',['Auth: 사용자 인증','Firestore: 회원·게시판·리그','Storage: 게시판 첨부 이미지'],PURPLE,kicker='Security Rules로 읽기·쓰기 검증')
    d.card(1120,650,420,235,'Firebase 서버 함수',['게시글 삭제 → 댓글 정리','구형 Discord 세션 RPC 보존','기본 리플레이의 필수 경로 아님'],PURPLE,kicker='Cloud Functions · Admin SDK')
    d.note(60,945,1480,120,'검증 후 배포','GitHub Actions 검증 → Python 빌드(public/) + Functions → Cloudflare Pages. Discord 요청은 Functions에서 별도 서명 검증합니다.')
    d.save('portfolio-architecture')

def schema():
    d=Diagram(1230,'02','FIRESTORE DATA MODEL','UID와 OUID를 나누어 읽는 데이터 구조','대표 컬렉션의 주요 필드만 표시했습니다. 점선은 논리 참조이며 관계형 FK가 아닙니다.')
    d.rect(40,232,740,860,'#EAF0FC',None,24)
    d.rect(820,232,740,860,'#E7F3F2',None,24)
    d.text(65,255,'회원 · 커뮤니티  /  Firebase Auth UID',20,BLUE,True)
    d.text(845,255,'크루 · 정산  /  NEXON 선수 OUID',20,TEAL,True)
    d.arrow([(390,450),(430,450)],BLUE,True)
    d.arrow([(230,590),(230,720)],BLUE,True)
    d.text(245,641,'authorUid',17,BLUE,True)
    d.arrow([(390,865),(430,865)],BLUE)
    d.arrow([(1170,450),(1210,450)],TEAL,True)
    d.text(1180,495,'승인',17,TEAL,True)
    d.card(70,310,320,280,'사용자 프로필',['uid · email · role','nickname · displayName','photoURL · createdAt','nicknameUpdatedAt'],BLUE,kicker='users/{uid}',body_size=20)
    d.card(430,310,320,280,'닉네임 예약',['uid · nickname','updatedAt','닉네임 키는 소문자','프로필과 함께 트랜잭션 갱신'],BLUE,kicker='nicknames/{nickname}',body_size=20)
    d.card(70,720,320,290,'게시글',['authorUid · authorName','title · content · category','attachments[] · createdAt','공개 작성자에 이메일 미포함'],BLUE,kicker='board_posts/{postId}',body_size=20)
    d.card(430,720,320,290,'댓글 · 답글',['authorUid · authorName','content · parentId','deleted · createdAt','게시글 아래 하위 컬렉션'],BLUE,kicker='board_posts/{postId}/\ncomments/{commentId}',body_size=20)
    d.card(850,310,320,280,'크루 가입 신청',['applicantUid → users.uid','ouid → 선수 식별자','characterName · status','appliedAt'],TEAL,kicker='sa_crew_applications/{uid}',body_size=20)
    d.card(1210,310,320,280,'크루 멤버',['characterName · mmr · hsr','previousNames[]','wins · loses · mmrHistory[]','crewKills · crewDeaths'],TEAL,kicker='sa_crew_members/{ouid}',body_size=20)
    d.card(850,720,320,290,'시즌 설정 · 보관',['season: startDate','season_archive_*','members: { [ouid]: … }','멤버별 이전 시즌 요약 보관'],TEAL,kicker='sa_crew_settings/{docId}',body_size=20)
    d.card(1210,720,320,290,'경기 정산 영수증',['map · matchDate · settledAt','crewCount · abandonOuids[]','matchedSessionId','같은 경기의 중복 정산 방지'],TEAL,kicker='sa_crew_history/{matchId}',body_size=20)
    d.note(60,1110,1480,65,'참고','',TEAL)
    # Compact note replaces a multi-line legend to keep the diagram readable.
    d.text(155,1132,'실선: 하위 컬렉션   ·   점선: 논리 참조 / 승인   ·   UID = 사이트 계정, OUID = 게임 선수',18,INK)
    d.save('portfolio-data-model')

def flow(name,number,title,subtitle,steps,mode):
    d=Diagram(1030,number,'USER FLOW',title,subtitle)
    positions=[60,360,660,960,1260]
    for x in positions[:-1]:d.arrow([(x+260,355),(x+300,355)],BLUE)
    for i,(x,(heading,lines)) in enumerate(zip(positions,steps),1):
        d.card(x,250,260,225,f'{i:02d}  {heading}',lines,TEAL if i==5 else BLUE,body_size=20)
    if mode=='search':
        d.text(60,535,'화면 뒤에서 지키는 세 가지 규칙',26,INK,True)
        d.card(60,595,470,260,'캐시 상태에 따라 조회',['없음: 네트워크 조회','5분 이내: 캐시만 표시','5분 경과: 캐시 우선 + 갱신'],BLUE,body_size=22)
        d.card(565,595,470,260,'실패와 빈 기록을 구분',['정상 빈 목록: 기록 없음','일부 / 전체 실패: 안내·재시도','기록이 없으면 0으로 확정하지 않음'],TEAL,body_size=22)
        d.card(1070,595,470,260,'새로고침의 완료 기준',['메모리·저장소 캐시 무효화','동일 요청은 진행 중 결과 공유','이전 응답이 최신 결과를 덮지 않음'],PURPLE,body_size=22)
        d.note(60,895,1480,85,'공개 전적 검색·기본 비교는 로그인 없이 이용','')
    else:
        d.arrow([(790,475),(790,525),(420,525),(420,585)],TEAL)
        d.arrow([(790,525),(1180,525),(1180,585)],BLUE)
        d.card(60,585,720,260,'JSON 1개  /  한 경기 복기',['공식 총계와 검증된 라운드 지표의 출처를 구분','장면·선수·시점 선택 → 재생 / PNG / 인쇄·PDF','검증할 수 없는 구간은 판단을 보류'],TEAL,body_size=23)
        d.card(820,585,720,260,'JSON 2~5개  /  같은 선수 비교',['같은 OUID의 검증된 경기 기록으로 범위를 제한','기준·이후 경기 선택 → 라운드 가중 지표 비교','분석 파일을 교체하면 이전 비동기 결과의 반영 차단'],BLUE,body_size=23)
        d.note(60,885,1480,95,'기본 분석·재생·비교는 기기 안에서 처리','추가 경기 유형·전력 조회는 별도 API 경로입니다. 기본 규칙 분석을 생성형 AI 판단으로 표시하지 않습니다.')
    d.save(name)

if __name__=='__main__':
    architecture()
    schema()
    flow('portfolio-search-flow','03','전적 검색에서 비교·공유까지','검색 결과를 확인한 뒤 비교·공유·즐겨찾기를 선택할 수 있습니다.',[
        ('닉네임 입력',['전적 검색 진입','최근 검색·즐겨찾기']),
        ('캐시·API 조회',['캐시 상태 확인','OUID·프로필·경기 조회']),
        ('결과 확인',['요약·상세·활동 탭','필요한 기록 펼치기']),
        ('선수 비교',['상대 선수 선택','같은 구간의 지표 비교']),
        ('공유·재방문',['요약 이미지·링크','즐겨찾기로 다시 검색'])], 'search')
    flow('portfolio-replay-flow','04','파일을 넣고, 근거를 따라 경기 복기','홈 또는 분석실에서 직접 고른 JSON과 가상 샘플로 시작합니다.',[
        ('분석 진입',['JSON 파일 선택','가상 샘플 체험 가능']),
        ('파일 검증',['파일·참가자·기록 확인','입력 오류는 다시 선택']),
        ('분석 모드',['1개: 한 경기 분석','2~5개: 같은 선수 비교']),
        ('장면·변화 확인',['시점 재생·선수 필터','검증 지표·보류 사유']),
        ('결과 활용',['한 경기: PNG·PDF','여러 경기: 변화 비교'])], 'replay')
