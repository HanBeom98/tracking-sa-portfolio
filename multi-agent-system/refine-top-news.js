import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

const targetFiles = [
    'news-1771973107-0.html',
    'news-1771973127-1.html',
    'news-1772113375-2.html',
    'news-1772091785-2.html',
    'news-1771971537-0.html'
];

async function focusedMigrate() {
    for (const file of targetFiles) {
        const filePath = path.join(publicDir, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf8');
        const titleMatch = content.match(/<h1 class="news-article-title">(.*?)<\/h1>/);
        const summaryMatch = content.match(/<div class="news-article-content">[\s\S]*?<p>(.*?)<\/p>/);

        let title = titleMatch ? titleMatch[1].replace(/🤖|AI 인사이트 폭발!|AP News로 보는|: /g, '').trim() : '핵심 기술 분석';
        const summary = summaryMatch ? summaryMatch[1].trim() : title;

        console.log(`\n🔥 RE-WRITING: ${title}`);

        try {
            const safeTitle = title.replace(/"/g, '\\"');
            const safeSummary = summary.replace(/"/g, '\\"');
            const result = execSync(`node multi-agent-system/news-desk.js "${safeTitle}" "${safeSummary}"`, { encoding: 'utf8' });
            
            const koContentMatch = result.match(/\[KO_START\]([\s\S]*?)\[KO_END\]/);
            if (!koContentMatch) throw new Error("Generation failed");
            
            let newBody = koContentMatch[1].trim();
            const lines = newBody.split('\n');
            const newTitle = lines[0].replace(/<\/?[^>]+(>|$)/g, "").substring(0, 100);

            newBody = newBody
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^- (.*$)/gim, '<li>$1</li>')
                .replace(/##HASHTAGS##: (.*)/g, '<div class="news-hashtags">$1</div>')
                .replace(/#(\S+)/g, '<span class="news-hashtag-chip">#$1</span>');

            let updatedHtml = content.replace(/<h1 class="news-article-title">.*?<\/h1>/, `<h1 class="news-article-title">${newTitle}</h1>`);
            
            const contentStart = updatedHtml.indexOf('<div class="news-article-content">');
            const contentEnd = updatedHtml.indexOf('</div>', contentStart + 30) + 6;
            
            if (contentStart !== -1 && contentEnd !== -1) {
                const headPart = updatedHtml.substring(0, contentStart);
                const tailPart = updatedHtml.substring(contentEnd);
                const finalBody = `<div class="news-article-content">\n${newBody}\n      </div>`;
                updatedHtml = headPart + finalBody + tailPart;
            }

            fs.writeFileSync(filePath, updatedHtml);
            console.log(`✅ Refined: ${file}`);
        } catch (err) {
            console.error(`❌ Failed: ${file}`, err.message);
        }
    }
    console.log("\n🚀 Final build...");
    execSync('npm run build', { stdio: 'inherit' });
}
focusedMigrate();
