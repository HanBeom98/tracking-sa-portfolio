import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const before = process.env.BEFORE_SHA || "";
const head = process.env.HEAD_SHA || git("rev-parse", "HEAD");
const validBefore = /^[a-f0-9]{40}$/i.test(before) && !/^0+$/.test(before);
const range = validBefore ? `${before}..${head}` : `${head}^..${head}`;
const files = git("diff", "--name-only", range).split(/\r?\n/).filter(Boolean);

const categories = [
  {
    test: (file) => /replay|match|sudden|stats|ranking/i.test(file),
    summary: "서든어택 전적 검색과 경기 기록을 보는 흐름을 개선했다."
  },
  {
    test: (file) => /api|function|server|worker|firebase|supabase|prisma/i.test(file),
    summary: "사이트에서 정보를 불러오고 처리하는 방식을 개선했다."
  },
  {
    test: (file) => /workflow|\.github|deploy|wrangler|firebase\.json/i.test(file),
    summary: "운영 중인 사이트의 배포와 자동화 흐름을 정리했다."
  },
  {
    test: (file) => /public|src|app|page|component|style|css|html/i.test(file),
    summary: "운영 중인 사이트의 화면과 이용 흐름을 개선했다."
  },
  {
    test: (file) => /readme|docs|\.md$/i.test(file),
    summary: "사이트 이용 안내와 운영 기록을 정리했다."
  }
];

const matchedCategory = categories.find((category) => files.some(category.test));
const summary = [matchedCategory?.summary || "운영 중인 사이트를 조금 더 편하게 다듬었다."];
const hasTests = files.some((file) => /(^|\/)(test|tests|__tests__)(\/|$)|\.(test|spec)\./i.test(file));

const payload = {
  source: "tracking-sa",
  commit_sha: head,
  title: "Tracking SA 작업 업데이트",
  summary,
  test_status: hasTests ? "unknown" : "skipped",
  deploy_status: "unknown"
};

process.stdout.write(JSON.stringify(payload));
