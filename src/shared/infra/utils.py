import re
import datetime

KST = datetime.timezone(datetime.timedelta(hours=9))

def extract_title_from_md(md_content):
    title_match = re.search(r'^#\s*(.+)', md_content, re.MULTILINE)
    return title_match.group(1).strip() if title_match else "새로운 뉴스"

def clean_filename(title):
    title = re.sub(r'[^\w\s-]', '', title).strip().lower()
    return re.sub(r'[-\s]+', '-', title)

def extract_description_from_md(md_content, lang="ko"):
    summary_keyword = "뉴스 요약" if lang == "ko" else "Deep Dive"
    # Cleaner regex to avoid newline issues in the pattern
    pattern = r'(?:##\s*' + re.escape(summary_keyword) + r'\s*\n\n|\n\n##\s*' + re.escape(summary_keyword) + r'\s*\n\n)(.*?)(?=\n\n##|\Z)'
    summary_match = re.search(pattern, md_content, re.DOTALL | re.IGNORECASE)

    if summary_match:
        description = summary_match.group(1).strip()
        description = re.sub(r'[-*]\s+', '', description)
        description = re.sub(r'\*\*(.*?)\*\*', r'\1', description)
        first_sentence = re.split(r'[.?!]', description)[0]
        return first_sentence[:150].strip() + "..." if len(first_sentence) > 150 else first_sentence.strip()

    first_paragraph_match = re.search(r'^\s*([^\n#].*?)(?=\n\n|\Z)', md_content, re.DOTALL)
    if first_paragraph_match:
        description = first_paragraph_match.group(1).strip()
        description = re.sub(r'[-*]\s+', '', description)
        description = re.sub(r'\*\*(.*?)\*\*', r'\1', description)
        first_sentence = re.split(r'[.?!]', description)[0]
        return first_sentence[:150].strip() + "..." if len(first_sentence) > 150 else first_sentence.strip()
    
    return ""

def kst_now():
    return datetime.datetime.now(tz=KST)

def kst_date_str():
    return kst_now().strftime("%Y-%m-%d")

def kst_date_from_epoch(ts):
    return datetime.datetime.fromtimestamp(ts, tz=KST).strftime("%Y-%m-%d")
