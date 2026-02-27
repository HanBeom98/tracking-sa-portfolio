import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

async function migrate() {
    const files = fs.readdirSync(publicDir).filter(f => f.startsWith('news-') && f.endsWith('.html'));
    console.log(`📂 Found ${files.length} news files to migrate.`);

    for (const file of files) {
        const filePath = path.join(publicDir, file);
        let content;
        try {
            content = fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            console.error(`❌ Cannot read ${file}`);
            continue;
        }

        // 1. 데이터 추출
        const dateMatch = content.match(/<span class="news-article-date">(.*?)<\/span>/);
        const titleMatch = content.match(/<h1 class="news-article-title">(.*?)<\/h1>/);
        const summaryMatch = content.match(/<div class="news-article-content">[\s\S]*?<p>(.*?)<\/p>/);

        const date = dateMatch ? dateMatch[1] : '2026-02-27';
        let originalTitle = titleMatch ? titleMatch[1] : '알 수 없는 뉴스';
        // AI 제목 패턴 제거
        originalTitle = originalTitle.replace(/🤖|AI 인사이트 폭발!|AP News로 보는|: /g, '').trim();
        const summary = summaryMatch ? summaryMatch[1].trim() : originalTitle;

        console.log(`\n🔄 Processing: [${date}] ${originalTitle}`);

        try {
            // 2. news-desk.js 호출
            const safeTitle = originalTitle.replace(/"/g, '\\"');
            const safeSummary = summary.replace(/"/g, '\\"');
            const result = execSync(`node multi-agent-system/news-desk.js "${safeTitle}" "${safeSummary}"`, { encoding: 'utf8' });
            
            const koContentMatch = result.match(/\[KO_START\]([\s\S]*?)\[KO_END\]/);
            if (!koContentMatch) throw new Error("Failed to generate KO content from news-desk.js output");
            
            let newBody = koContentMatch[1].trim();
            
            // 3. HTML 갱신 (마크다운 -> HTML 간단 변환)
            // 헤더 변환
            newBody = newBody.replace(/^### (.*$)/gim, '<h3>$1</h3>');
            newBody = newBody.replace(/^## (.*$)/gim, '<h2>$1</h2>');
            // 불릿 포인트 변환
            newBody = newBody.replace(/^- (.*$)/gim, '<li>$1</li>');
            // 해시태그 변환
            newBody = newBody.replace(/##HASHTAGS##: (.*)/g, '<div class="news-hashtags">$1</div>');
            newBody = newBody.replace(/#(\S+)/g, '<span class="news-hashtag-chip">#$1</span>');
            
            // 본문 내용을 묶기 위해 div 구조 유지
            let updatedHtml = content.replace(/<h1 class="news-article-title">.*?<\/h1>/, `<h1 class="news-article-title">${originalTitle}</h1>`);
            
            // 정규식 안전하게 처리 (content 전체가 너무 길면 replace가 오작동할 수 있으므로 분할 교체)
            const contentStart = updatedHtml.indexOf('<div class="news-article-content">');
            const contentEnd = updatedHtml.indexOf('</div>', contentStart + 30) + 6;
            
            if (contentStart !== -1 && contentEnd !== -1) {
                const headPart = updatedHtml.substring(0, contentStart);
                const tailPart = updatedHtml.substring(contentEnd);
                const finalBody = `<div class="news-article-content">\n${newBody}\n      </div>`;
                updatedHtml = headPart + finalBody + tailPart;
            }

            fs.writeFileSync(filePath, updatedHtml);
            console.log(`✅ Success: ${file} updated.`);

        } catch (err) {
            console.error(`❌ Error migrating ${file}:`, err.message);
        }
    }

    console.log("\n✨ Migration complete. Running build...");
    try {
        execSync('npm run build', { stdio: 'inherit' });
    } catch (e) {
        console.error("❌ Build failed, but files were updated.");
    }
}

migrate();
