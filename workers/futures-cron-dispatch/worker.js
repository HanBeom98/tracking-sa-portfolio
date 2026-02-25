/**
 * Cloudflare Worker Cron trigger for dispatching GitHub Actions workflow.
 *
 * Required secrets (Worker Settings > Variables and Secrets):
 * - GH_OWNER: e.g. HanBeom98
 * - GH_REPO: e.g. tracking-sa
 * - GH_WORKFLOW_ID: e.g. futures-estimate-sync-v2.yml
 * - GH_PAT: GitHub token with Actions write permission on the repo
 * Optional:
 * - GH_REF: branch name, default "main"
 */

function required(name, value) {
  if (!value || String(value).trim() === "") {
    throw new Error(`${name} is missing`);
  }
  return String(value).trim();
}

async function dispatchWorkflow(env) {
  const owner = required("GH_OWNER", env.GH_OWNER);
  const repo = required("GH_REPO", env.GH_REPO);
  const workflowId = required("GH_WORKFLOW_ID", env.GH_WORKFLOW_ID);
  const token = required("GH_PAT", env.GH_PAT);
  const ref = (env.GH_REF || "main").trim();

  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "tracking-sa-futures-cron-worker"
    },
    body: JSON.stringify({ ref })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub dispatch failed: ${res.status} ${body}`);
  }
}

export default {
  async scheduled(event, env, ctx) {
    // Retry a few times for transient GitHub API errors.
    const run = async () => {
      let lastErr = null;
      for (let i = 1; i <= 3; i += 1) {
        try {
          await dispatchWorkflow(env);
          return;
        } catch (err) {
          lastErr = err;
          if (i < 3) {
            await new Promise((r) => setTimeout(r, 1500 * i));
          }
        }
      }
      throw lastErr;
    };
    ctx.waitUntil(run());
  },

  async fetch(_req, env) {
    // Health/debug endpoint (manual invoke)
    try {
      await dispatchWorkflow(env);
      return new Response("ok", { status: 200 });
    } catch (e) {
      return new Response(`error: ${String(e)}`, { status: 500 });
    }
  }
};
