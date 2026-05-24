import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import { GitHubHandler } from "./github-handler";

// Context from the auth process, encrypted & stored in the auth token
// and provided to the DurableMCP as this.props
type Props = {
	login: string;
	name: string;
	email: string;
	accessToken: string;
};


	// Add GitHub usernames of users who should have access to the image generation tool
	// For example: 'yourusername', 'coworkerusername'

const ALLOWED_USERNAMES = new Set(["gabrielk83"].map((username) => username.toLowerCase()));

function isAllowedUsername(username: string | null | undefined) {
	return Boolean(username && ALLOWED_USERNAMES.has(username.toLowerCase()));
}

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
	server = new McpServer({
		name: "Github OAuth Proxy Demo",
		version: "1.0.0",
	});

	async init() {
// ── github_read_file ─────────────────────────────────────────────
this.server.tool(
  "github_read_file",
  "Read a single file from a GitHub repository. Returns the decoded text content and the file SHA (which you'll need if you later want to update it).",
  {
    owner: z.string().describe("Repo owner, e.g. 'gabriel-something'"),
    repo: z.string().describe("Repo name, e.g. 'antcv'"),
    path: z.string().describe("Path within the repo, e.g. 'pwa/index.html'"),
    ref: z.string().optional().describe("Branch, tag, or commit SHA. Defaults to the default branch."),
  },
  async ({ owner, repo, path, ref }) => {
    const octokit = new Octokit({ auth: this.props.accessToken });
    const resp = await octokit.repos.getContent({ owner, repo, path, ref });
    const data = resp.data as any;
    if (Array.isArray(data) || data.type !== "file") {
      return { content: [{ type: "text", text: "Not a file: " + path }] };
    }
    const text = Buffer.from(data.content, "base64").toString("utf-8");
    return {
      content: [{
        type: "text",
        text: `--- sha:${data.sha} ---\n${text}`,
      }],
    };
  }
);

// ── github_list_directory ────────────────────────────────────────
this.server.tool(
  "github_list_directory",
  "List the contents of a directory in a GitHub repository.",
  {
    owner: z.string(),
    repo: z.string(),
    path: z.string().describe("Directory path within the repo. Use '' for the repo root."),
    ref: z.string().optional(),
  },
  async ({ owner, repo, path, ref }) => {
    const octokit = new Octokit({ auth: this.props.accessToken });
    const resp = await octokit.repos.getContent({ owner, repo, path, ref });
    const items = Array.isArray(resp.data) ? resp.data : [resp.data];
    const lines = items.map((i: any) => `${i.type === "dir" ? "d" : "f"} ${i.path} (${i.size ?? "-"} B)`);
    return { content: [{ type: "text", text: lines.join("\n") }] };
  }
);

// ── github_write_file ────────────────────────────────────────────
this.server.tool(
  "github_write_file",
  "Create or update a file in a GitHub repository. Commits directly to the named branch. If updating an existing file, pass the sha returned by github_read_file. Omit sha to create a new file.",
  {
    owner: z.string(),
    repo: z.string(),
    path: z.string(),
    content: z.string().describe("The full new content of the file as UTF-8 text."),
    message: z.string().describe("Commit message."),
    branch: z.string().optional().describe("Branch to commit to. Defaults to the repo's default branch."),
    sha: z.string().optional().describe("Existing file SHA when updating. Required for updates; omit for new files."),
  },
  async ({ owner, repo, path, content, message, branch, sha }) => {
    const octokit = new Octokit({ auth: this.props.accessToken });
    const resp = await octokit.repos.createOrUpdateFileContents({
      owner, repo, path, message,
      content: Buffer.from(content, "utf-8").toString("base64"),
      branch, sha,
    });
    return {
      content: [{
        type: "text",
        text: `Committed ${resp.data.commit.sha} on ${resp.data.content?.path ?? path}`,
      }],
    };
  }
);

// ── github_create_branch ─────────────────────────────────────────
this.server.tool(
  "github_create_branch",
  "Create a new branch in a GitHub repository, branching off an existing ref. Use this for hotfix branches instead of pushing straight to main.",
  {
    owner: z.string(),
    repo: z.string(),
    branch: z.string().describe("Name of the new branch, e.g. 'hotfix/docx-styles'."),
    from: z.string().optional().describe("Base branch or tag to branch from. Defaults to the repo's default branch."),
  },
  async ({ owner, repo, branch, from }) => {
    const octokit = new Octokit({ auth: this.props.accessToken });

    const baseRefName = from ?? (await octokit.repos.get({ owner, repo })).data.default_branch;
    const baseRef = await octokit.git.getRef({ owner, repo, ref: `heads/${baseRefName}` });
    const baseSha = baseRef.data.object.sha;

    const resp = await octokit.git.createRef({
      owner, repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });

    return {
      content: [{
        type: "text",
        text: `Created ${resp.data.ref} at ${baseSha.slice(0, 7)} (from ${baseRefName})`,
      }],
    };
  }
);

// ── github_search_code ───────────────────────────────────────────
this.server.tool(
  "github_search_code",
  "Search code across a GitHub repo (or all repos you can access) using GitHub's code search. Use this instead of reading every file when you only need to find where a symbol or string lives.",
  {
    query: z.string().describe("Search query. GitHub code search syntax applies (e.g. 'isPDFTextGarbled', 'path:src extension:ts useMemo')."),
    owner: z.string().optional().describe("Restrict to this repo owner."),
    repo: z.string().optional().describe("Restrict to this repo (requires owner)."),
    perPage: z.number().int().min(1).max(100).optional().describe("Results per page (default 30, max 100)."),
  },
  async ({ query, owner, repo, perPage }) => {
    const octokit = new Octokit({ auth: this.props.accessToken });

    let q = query;
    if (owner && repo) q += ` repo:${owner}/${repo}`;
    else if (owner) q += ` user:${owner}`;

    const resp = await octokit.search.code({ q, per_page: perPage ?? 30 });
    const lines = resp.data.items.map(
      (i: any) => `${i.repository.full_name} :: ${i.path} (score ${Number(i.score).toFixed(2)})`,
    );

    return {
      content: [{
        type: "text",
        text: `Total matches: ${resp.data.total_count}\n${lines.join("\n")}`,
      }],
    };
  }
);

// ── github_commit_multiple_files ─────────────────────────────────
this.server.tool(
  "github_commit_multiple_files",
  "Commit multiple file changes atomically to a branch via the Git Data API (blob → tree → commit → ref). Use this when a single hotfix touches several files and they need to land in one commit.",
  {
    owner: z.string(),
    repo: z.string(),
    branch: z.string().describe("Branch to commit to. Must already exist."),
    message: z.string().describe("Commit message."),
    files: z.array(z.object({
      path: z.string().describe("Path within the repo."),
      content: z.string().describe("Full file content as UTF-8 text."),
    })).describe("Files to add or update in this commit."),
    deletes: z.array(z.string()).optional().describe("Paths to delete in this commit."),
  },
  async ({ owner, repo, branch, message, files, deletes }) => {
    const octokit = new Octokit({ auth: this.props.accessToken });

    // 1. Tip of the branch
    const ref = await octokit.git.getRef({ owner, repo, ref: `heads/${branch}` });
    const parentSha = ref.data.object.sha;

    // 2. Parent commit's tree
    const parentCommit = await octokit.git.getCommit({ owner, repo, commit_sha: parentSha });
    const baseTreeSha = parentCommit.data.tree.sha;

    // 3. One blob per file
    const blobs = await Promise.all(files.map(async (f) => {
      const blob = await octokit.git.createBlob({
        owner, repo,
        content: Buffer.from(f.content, "utf-8").toString("base64"),
        encoding: "base64",
      });
      return { path: f.path, sha: blob.data.sha };
    }));

    // 4. New tree, layered on the parent tree
    const treeItems: any[] = blobs.map(b => ({
      path: b.path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: b.sha,
    }));
    if (deletes) {
      for (const path of deletes) {
        treeItems.push({ path, mode: "100644", type: "blob", sha: null });
      }
    }

    const newTree = await octokit.git.createTree({
      owner, repo,
      base_tree: baseTreeSha,
      tree: treeItems,
    });

    // 5. Commit pointing at the new tree, parented to the old tip
    const newCommit = await octokit.git.createCommit({
      owner, repo,
      message,
      tree: newTree.data.sha,
      parents: [parentSha],
    });

    // 6. Fast-forward the branch ref to the new commit
    await octokit.git.updateRef({
      owner, repo,
      ref: `heads/${branch}`,
      sha: newCommit.data.sha,
    });

    return {
      content: [{
        type: "text",
        text: `Committed ${newCommit.data.sha.slice(0, 7)} to ${branch}: ${files.length} file(s) added/updated${deletes?.length ? `, ${deletes.length} deleted` : ""}`,
      }],
    };
  }
);

// ── cloudflare_pages_deploy_status ───────────────────────────────
this.server.tool(
  "cloudflare_pages_deploy_status",
  "Fetch the most recent Cloudflare Pages deployment(s) for a project. Requires CF_API_TOKEN (secret) and CF_ACCOUNT_ID (var) on the worker.",
  {
    project: z.string().describe("Pages project name, e.g. 'antcv'."),
    limit: z.number().int().min(1).max(25).optional().describe("How many recent deployments to return (default 1)."),
  },
  async ({ project, limit }) => {
    const token = (this.env as any).CF_API_TOKEN as string | undefined;
    const accountId = (this.env as any).CF_ACCOUNT_ID as string | undefined;
    if (!token || !accountId) {
      return {
        content: [{
          type: "text",
          text: "CF_API_TOKEN and CF_ACCOUNT_ID are not set. Add CF_ACCOUNT_ID to wrangler.toml [vars] and `wrangler secret put CF_API_TOKEN`.",
        }],
      };
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${project}/deployments?per_page=${limit ?? 1}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json() as any;

    if (!resp.ok || !json.success) {
      return {
        content: [{
          type: "text",
          text: `CF API error (${resp.status}): ${JSON.stringify(json.errors ?? json)}`,
        }],
      };
    }

    const deployments = (json.result as any[]) ?? [];
    const lines = deployments.map(d => {
      const stage = d.latest_stage;
      return [
        d.id.slice(0, 8),
        d.environment,
        `${stage?.name ?? "?"}:${stage?.status ?? "?"}`,
        d.created_on,
        d.url ?? "(no url)",
      ].join(" | ");
    });

    return {
      content: [{
        type: "text",
        text: lines.length ? lines.join("\n") : "No deployments found.",
      }],
    };
  }
);
	}
}

export default new OAuthProvider({
	apiHandlers: {
		"/sse": MyMCP.serveSSE("/sse"),
		"/mcp": MyMCP.serve("/mcp"),
	},
	authorizeEndpoint: "/authorize",
	clientRegistrationEndpoint: "/register",
	defaultHandler: GitHubHandler as any,
	tokenEndpoint: "/token",
});
