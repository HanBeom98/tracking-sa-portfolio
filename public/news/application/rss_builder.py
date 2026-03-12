import datetime
from src.shared.infra.config import BASE_URL

def build_rss_xml(news_items, lang="ko"):
    """
    뉴스 아이템 리스트를 받아 RSS 2.0 규격의 XML 문자열을 생성합니다.
    """
    base_url = BASE_URL.rstrip("/")
    title = "Tracking SA - 서비스 업데이트" if lang == "ko" else "Tracking SA - Service Updates"
    description = "Tracking SA의 주요 서비스와 대표 기능 안내" if lang == "ko" else "Key Tracking SA services and featured functionality"
    link = f"{base_url}/" if lang == "ko" else f"{base_url}/en/"
    
    now = datetime.datetime.utcnow().strftime("%a, %d %b %Y %H:%M:%S GMT")
    
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
        '  <channel>',
        f'    <title><![CDATA[{title}]]></title>',
        f'    <link>{link}</link>',
        f'    <description><![CDATA[{description}]]></description>',
        f'    <language>{lang}</language>',
        f'    <lastBuildDate>{now}</lastBuildDate>',
        f'    <atom:link href="{base_url}/rss.xml" rel="self" type="application/rss+xml" />' if lang == "ko" else f'    <atom:link href="{base_url}/en/rss.xml" rel="self" type="application/rss+xml" />',
    ]
    
    for item in news_items:
        item_link = f"{base_url}{item['href']}"
        item_title = item['title']
        try:
            dt = datetime.datetime.strptime(item['date'], "%Y-%m-%d")
            pub_date = dt.strftime("%a, %d %b %Y %H:%M:%S GMT")
        except:
            pub_date = now
            
        lines.append('    <item>')
        lines.append(f'      <title><![CDATA[{item_title}]]></title>')
        lines.append(f'      <link>{item_link}</link>')
        lines.append(f'      <guid isPermaLink="true">{item_link}</guid>')
        lines.append(f'      <pubDate>{pub_date}</pubDate>')
        if item.get('description'):
            lines.append(f'      <description><![CDATA[{item["description"]}]]></description>')
        lines.append('    </item>')
        
    lines.append('  </channel>')
    lines.append('</rss>')
    
    return "\n".join(lines)
