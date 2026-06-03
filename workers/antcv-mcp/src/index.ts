import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { McpAgent } from "agents/mcp";
import { Octokit } from "@octokit/rest";
import { z } from "zod";
import { GitHubHandler } from "./github-handler";

// ─── Auth context (from GitHub OAuth token) ──────────────────────────────────
type Props = {
  login: string;
  name: string;
  email: string;
  accessToken: string;
};

// ─── Allowed users ────────────────────────────────────────────────────────────
const ALLOWED_USERNAMES = new Set(
  ["gabrielk83"].map((u) => u.toLowerCase())
);
function isAllowedUsername(username: string | null | undefined) {
  return Boolean(username && ALLOWED_USERNAMES.has(username.toLowerCase()));
}

// ─── Cloudflare API helper ────────────────────────────────────────────────────

interface CfEnv {
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
}

async function cfFetch(
  env: CfEnv,
  path: string,
  opts: RequestInit = {}
): Promise<any> {
  if (!env.CF_API_TOKEN)
    throw new Error("CF_API_TOKEN secret not set on this Worker");
  if (!env.CF_ACCOUNT_ID)
    throw new Error("CF_ACCOUNT_ID secret not set on this Worker");

  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      ...((opts.headers as Record<string, string>) || {}),
    },
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = { success: false, errors: [{ message: text }] };
  }

  if (!res.ok || !json.success) {
    const msg =
      (json.errors || []).map((e: any) => e.message).join("; ") ||
      `HTTP ${res.status}`;
    throw new Error(`Cloudflare API error: ${msg}`);
  }
  return json;
}

// ─── DOCX text extractor ──────────────────────────────────────────────────────
// A .docx is a ZIP archive containing word/document.xml. We hand-parse the ZIP
// central directory to locate that entry, decompress it with Workers' native
// DecompressionStream("deflate-raw"), then extract <w:t> text content from the
// OOXML. No external ZIP/XML library needed.

function readUint16LE(b: Uint8Array, p: number): number {
  return b[p] | (b[p + 1] << 8);
}
function readUint32LE(b: Uint8Array, p: number): number {
  return (
    (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] * 0x1000000)) >>> 0
  );
}

function findEOCD(b: Uint8Array): number {
  // End Of Central Directory signature: 0x06054b50 (PK\x05\x06).
  // Located near end of file, within last 65557 bytes (max comment is 65535).
  const minPos = Math.max(0, b.length - 65557);
  for (let i = b.length - 22; i >= minPos; i--) {
    if (
      b[i] === 0x50 &&
      b[i + 1] === 0x4b &&
      b[i + 2] === 0x05 &&
      b[i + 3] === 0x06
    ) {
      return i;
    }
  }
  return -1;
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  const eocd = findEOCD(bytes);
  if (eocd < 0) throw new Error("Not a valid ZIP/DOCX: EOCD not found");

  const entryCount = readUint16LE(bytes, eocd + 10);
  const cdOffset = readUint32LE(bytes, eocd + 16);

  // Walk central directory looking for word/document.xml
  let pos = cdOffset;
  let entry: { method: number; compSize: number; lhOffset: number } | null =
    null;
  for (let i = 0; i < entryCount; i++) {
    if (readUint32LE(bytes, pos) !== 0x02014b50) {
      throw new Error(`Invalid central dir signature at offset ${pos}`);
    }
    const method = readUint16LE(bytes, pos + 10);
    const compSize = readUint32LE(bytes, pos + 20);
    const nameLen = readUint16LE(bytes, pos + 28);
    const extraLen = readUint16LE(bytes, pos + 30);
    const commentLen = readUint16LE(bytes, pos + 32);
    const lhOffset = readUint32LE(bytes, pos + 42);
    const name = new TextDecoder().decode(
      bytes.subarray(pos + 46, pos + 46 + nameLen)
    );
    if (name === "word/document.xml") {
      entry = { method, compSize, lhOffset };
      break;
    }
    pos += 46 + nameLen + extraLen + commentLen;
  }
  if (!entry) throw new Error("word/document.xml not found in ZIP");

  // Read local file header to find actual data offset
  if (readUint32LE(bytes, entry.lhOffset) !== 0x04034b50) {
    throw new Error("Invalid local file header signature");
  }
  const lhNameLen = readUint16LE(bytes, entry.lhOffset + 26);
  const lhExtraLen = readUint16LE(bytes, entry.lhOffset + 28);
  const dataStart = entry.lhOffset + 30 + lhNameLen + lhExtraLen;
  // .slice (not .subarray) — give DecompressionStream its own buffer
  const compressed = bytes.slice(dataStart, dataStart + entry.compSize);

  let xmlBytes: Uint8Array;
  if (entry.method === 0) {
    xmlBytes = compressed;
  } else if (entry.method === 8) {
    const stream = new Response(compressed).body!.pipeThrough(
      new DecompressionStream("deflate-raw")
    );
    xmlBytes = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    throw new Error(`Unsupported ZIP compression method: ${entry.method}`);
  }

  const xml = new TextDecoder().decode(xmlBytes);
  return ooxmlToText(xml);
}

function ooxmlToText(xml: string): string {
  // Walk each paragraph (<w:p>…</w:p>). Within each, extract <w:t>…</w:t>
  // text runs in order, plus <w:tab/> as '\t' and <w:br/> as '\n'.
  const out: string[] = [];
  const paragraphs = xml.split(/<\/w:p\s*>/);
  const re =
    /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/?>|<w:br\s*\/?>/g;
  for (const p of paragraphs) {
    let text = "";
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(p)) !== null) {
      if (m[1] !== undefined) {
        text += m[1];
      } else if (m[0].startsWith("<w:tab")) {
        text += "\t";
      } else if (m[0].startsWith("<w:br")) {
        text += "\n";
      }
    }
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'");
    if (text.length > 0) out.push(text);
  }
  // Paragraph separator: blank line between paragraphs.
  return out.join("\n\n");
}

// ─── MCP Agent ────────────────────────────────────────────────────────────────

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "AntCV MCP — GitHub + Deploy",
    version: "2.2.0",
  });

  async init() {

    // ════════════════════════════════════════════════════════════════════════
    // GITHUB TOOLS
    // ════════════════════════════════════════════════════════════════════════

    // ── github_read_file ───────────────────────────────────────────────────
    this.server.tool(
      "github_read_file",
      "Read a single file from a GitHub repository. Returns the decoded text content and the file SHA (needed for updates).",
      {
        owner: z.string().describe("Repo owner, e.g. 'gabriel-something'"),
        repo: z.string().describe("Repo name, e.g. 'antcv'"),
        path: z.string().describe("Path within the repo, e.g. 'pwa/index.html'"),
        ref: z
          .string()
          .optional()
          .describe("Branch, tag, or commit SHA. Defaults to the default branch."),
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
          content: [{ type: "text", text: `--- sha:${data.sha} ---\n${text}` }],
        };
      }
    );

    // ── github_read_docx ───────────────────────────────────────────────────
    this.server.tool(
      "github_read_docx",
      "Read a .docx file from a GitHub repository and return its extracted plain text. Use for Word documents (design specs, plan docs) stored as .docx in the repo. Output is paragraph-structured plain text — paragraphs are blank-line separated, tabs and line breaks preserved within paragraphs. Handles files up to ~100 MB via the Git Blob API. Use this instead of github_read_file when the path ends in .docx.",
      {
        owner: z.string().describe("Repo owner, e.g. 'gabrielk83'"),
        repo: z.string().describe("Repo name, e.g. 'AntCV'"),
        path: z
          .string()
          .describe("Path to the .docx within the repo, e.g. 'docs/design/spec.docx'"),
        ref: z
          .string()
          .optional()
          .describe("Branch, tag, or commit SHA. Defaults to the default branch."),
      },
      async ({ owner, repo, path, ref }) => {
        const octokit = new Octokit({ auth: this.props.accessToken });

        // Step 1: get the file's metadata (sha + size) via repos.getContent
        const meta = await octokit.repos.getContent({ owner, repo, path, ref });
        const metaData = meta.data as any;
        if (Array.isArray(metaData) || metaData.type !== "file") {
          return { content: [{ type: "text", text: "Not a file: " + path }] };
        }

        // Step 2: get raw bytes. Use the Git Blob API to bypass the 1 MB
        // getContent limit (and to avoid the "content omitted for files > 1 MB"
        // edge case for borderline-sized files).
        let bytes: Uint8Array;
        try {
          if (metaData.content && metaData.size && metaData.size <= 1_000_000) {
            bytes = Uint8Array.from(Buffer.from(metaData.content, "base64"));
          } else {
            const blob = await octokit.git.getBlob({
              owner,
              repo,
              file_sha: metaData.sha,
            });
            bytes = Uint8Array.from(
              Buffer.from(blob.data.content, "base64")
            );
          }
        } catch (e: any) {
          return {
            content: [
              { type: "text", text: `Error fetching blob: ${e.message}` },
            ],
          };
        }

        // Step 3: extract text from the docx ZIP
        try {
          const text = await extractDocxText(bytes);
          return {
            content: [
              {
                type: "text",
                text:
                  `--- sha:${metaData.sha} bytes:${bytes.length} ---\n` + text,
              },
            ],
          };
        } catch (e: any) {
          return {
            content: [
              { type: "text", text: `DOCX extraction error: ${e.message}` },
            ],
          };
        }
      }
    );

    // ── github_list_directory ──────────────────────────────────────────────
    this.server.tool(
      "github_list_directory",
      "List the contents of a directory in a GitHub repository.",
      {
        owner: z.string(),
        repo: z.string(),
        path: z
          .string()
          .describe("Directory path within the repo. Use '' for the repo root."),
        ref: z.string().optional(),
      },
      async ({ owner, repo, path, ref }) => {
        const octokit = new Octokit({ auth: this.props.accessToken });
        const resp = await octokit.repos.getContent({ owner, repo, path, ref });
        const items = Array.isArray(resp.data) ? resp.data : [resp.data];
        const lines = items.map(
          (i: any) =>
            `${i.type === "dir" ? "d" : "f"} ${i.path} (${i.size ?? "-"} B)`
        );
        return { content: [{ type: "text", text: lines.join("\n") }] };
      }
    );

    // ── github_write_file ──────────────────────────────────────────────────
    this.server.tool(
      "github_write_file",
      "Create or update a file in a GitHub repository. Commits directly to the named branch. Pass sha (from github_read_file) when updating; omit for new files.",
      {
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        content: z
          .string()
          .describe("The full new content of the file as UTF-8 text."),
        message: z.string().describe("Commit message."),
        branch: z
          .string()
          .optional()
          .describe("Branch to commit to. Defaults to the repo's default branch."),
        sha: z
          .string()
          .optional()
          .describe("Existing file SHA when updating. Required for updates; omit for new files."),
      },
      async ({ owner, repo, path, content, message, branch, sha }) => {
        const octokit = new Octokit({ auth: this.props.accessToken });
        const resp = await octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content, "utf-8").toString("base64"),
          branch,
          sha,
        });
        return {
          content: [
            {
              type: "text",
              text: `Committed ${resp.data.commit.sha} on ${
                resp.data.content?.path ?? path
              }`,
            },
          ],
        };
      }
    );

    // ── github_create_branch ───────────────────────────────────────────────
    this.server.tool(
      "github_create_branch",
      "Create a new branch in a GitHub repository, branching off an existing ref.",
      {
        owner: z.string(),
        repo: z.string(),
        branch: z
          .string()
          .describe("Name of the new branch, e.g. 'hotfix/docx-styles'."),
        from: z
          .string()
          .optional()
          .describe("Base branch or tag to branch from. Defaults to the repo's default branch."),
      },
      async ({ owner, repo, branch, from }) => {
        const octokit = new Octokit({ auth: this.props.accessToken });
        const baseRefName =
          from ??
          (await octokit.repos.get({ owner, repo })).data.default_branch;
        const baseRef = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${baseRefName}`,
        });
        const baseSha = baseRef.data.object.sha;
        const resp = await octokit.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha: baseSha,
        });
        return {
          content: [
            {
              type: "text",
              text: `Created ${resp.data.ref} at ${baseSha.slice(0, 7)} (from ${baseRefName})`,
            },
          ],
        };
      }
    );

    // ── github_open_pull_request ───────────────────────────────────────────
    this.server.tool(
      "github_open_pull_request",
      "Open a pull request in a GitHub repository. Returns the PR number and URL. " +
        "If a PR for the same head→base already exists, returns that existing PR " +
        "instead of erroring. Optionally enable auto-merge or request reviewers.",
      {
        owner: z.string(),
        repo: z.string(),
        head: z
          .string()
          .describe(
            "Name of the branch with your changes, e.g. 'feature/topbar-fab-tidy'. " +
              "For a cross-fork PR use 'forkOwner:branch'."
          ),
        base: z
          .string()
          .optional()
          .describe("Branch you want to merge into. Defaults to the repo's default branch."),
        title: z.string().describe("PR title."),
        body: z
          .string()
          .optional()
          .describe("PR description (Markdown). Optional."),
        draft: z
          .boolean()
          .optional()
          .describe("Open as a draft PR. Default false."),
        reviewers: z
          .array(z.string())
          .optional()
          .describe("GitHub usernames to request review from. Optional."),
      },
      async ({ owner, repo, head, base, title, body, draft, reviewers }) => {
        const octokit = new Octokit({ auth: this.props.accessToken });

        const baseBranch =
          base ??
          (await octokit.repos.get({ owner, repo })).data.default_branch;

        // Try to create; if a PR for this head→base already exists, GitHub
        // returns 422 — fall back to looking it up and returning that.
        try {
          const resp = await octokit.pulls.create({
            owner,
            repo,
            head,
            base: baseBranch,
            title,
            body,
            draft: draft ?? false,
          });

          // Request reviewers if asked (best-effort; don't fail the PR on this).
          if (reviewers?.length) {
            try {
              await octokit.pulls.requestReviewers({
                owner,
                repo,
                pull_number: resp.data.number,
                reviewers,
              });
            } catch (_) {
              /* ignore reviewer errors — the PR itself is created */
            }
          }

          return {
            content: [
              {
                type: "text",
                text:
                  `Opened PR #${resp.data.number}: ${resp.data.title}\n` +
                  `  ${head} → ${baseBranch}\n` +
                  `  ${resp.data.html_url}`,
              },
            ],
          };
        } catch (e: any) {
          // 422 with "A pull request already exists" → return the existing one.
          const already =
            e?.status === 422 &&
            /already exists/i.test(JSON.stringify(e?.response?.data ?? e?.message ?? ""));
          if (already) {
            // head for the list filter must be 'owner:branch'. If the caller
            // passed a bare branch, qualify it with the repo owner.
            const headFilter = head.includes(":") ? head : `${owner}:${head}`;
            const existing = await octokit.pulls.list({
              owner,
              repo,
              head: headFilter,
              base: baseBranch,
              state: "open",
            });
            const pr = existing.data[0];
            if (pr) {
              return {
                content: [
                  {
                    type: "text",
                    text:
                      `PR already open — #${pr.number}: ${pr.title}\n` +
                      `  ${head} → ${baseBranch}\n` +
                      `  ${pr.html_url}`,
                  },
                ],
              };
            }
          }
          const msg =
            e?.response?.data?.errors
              ?.map((x: any) => x.message)
              .join("; ") ||
            e?.response?.data?.message ||
            e?.message ||
            "Unknown error";
          return {
            content: [{ type: "text", text: `Failed to open PR: ${msg}` }],
          };
        }
      }
    );

    // ── github_search_code ─────────────────────────────────────────────────
    this.server.tool(
      "github_search_code",
      "Search code across a GitHub repo using GitHub's code search.",
      {
        query: z
          .string()
          .describe(
            "Search query with GitHub code search syntax (e.g. 'isPDFTextGarbled path:src extension:ts')."
          ),
        owner: z.string().optional().describe("Restrict to this repo owner."),
        repo: z
          .string()
          .optional()
          .describe("Restrict to this repo (requires owner)."),
        perPage: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe("Results per page (default 30, max 100)."),
      },
      async ({ query, owner, repo, perPage }) => {
        const octokit = new Octokit({ auth: this.props.accessToken });
        let q = query;
        if (owner && repo) q += ` repo:${owner}/${repo}`;
        else if (owner) q += ` user:${owner}`;
        const resp = await octokit.search.code({ q, per_page: perPage ?? 30 });
        const lines = resp.data.items.map(
          (i: any) =>
            `${i.repository.full_name} :: ${i.path} (score ${Number(
              i.score
            ).toFixed(2)})`
        );
        return {
          content: [
            {
              type: "text",
              text: `Total matches: ${resp.data.total_count}\n${lines.join("\n")}`,
            },
          ],
        };
      }
    );

    // ── github_commit_multiple_files ───────────────────────────────────────
    this.server.tool(
      "github_commit_multiple_files",
      "Commit multiple file changes atomically to a branch via the Git Data API (blob → tree → commit → ref).",
      {
        owner: z.string(),
        repo: z.string(),
        branch: z.string().describe("Branch to commit to. Must already exist."),
        message: z.string().describe("Commit message."),
        files: z
          .array(
            z.object({
              path: z.string().describe("Path within the repo."),
              content: z.string().describe("Full file content as UTF-8 text."),
            })
          )
          .describe("Files to add or update in this commit."),
        deletes: z
          .array(z.string())
          .optional()
          .describe("Paths to delete in this commit."),
      },
      async ({ owner, repo, branch, message, files, deletes }) => {
        const octokit = new Octokit({ auth: this.props.accessToken });

        const ref = await octokit.git.getRef({
          owner,
          repo,
          ref: `heads/${branch}`,
        });
        const parentSha = ref.data.object.sha;

        const parentCommit = await octokit.git.getCommit({
          owner,
          repo,
          commit_sha: parentSha,
        });
        const baseTreeSha = parentCommit.data.tree.sha;

        const blobs = await Promise.all(
          files.map(async (f) => {
            const blob = await octokit.git.createBlob({
              owner,
              repo,
              content: Buffer.from(f.content, "utf-8").toString("base64"),
              encoding: "base64",
            });
            return { path: f.path, sha: blob.data.sha };
          })
        );

        const treeItems: any[] = blobs.map((b) => ({
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
          owner,
          repo,
          base_tree: baseTreeSha,
          tree: treeItems,
        });

        const newCommit = await octokit.git.createCommit({
          owner,
          repo,
          message,
          tree: newTree.data.sha,
          parents: [parentSha],
        });

        await octokit.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommit.data.sha,
        });

        return {
          content: [
            {
              type: "text",
              text: `Committed ${newCommit.data.sha.slice(0, 7)} to ${branch}: ${
                files.length
              } file(s) added/updated${
                deletes?.length ? `, ${deletes.length} deleted` : ""
              }`,
            },
          ],
        };
      }
    );

    // ════════════════════════════════════════════════════════════════════════
    // CLOUDFLARE DEPLOYMENT TOOLS
    // All tools below use this.env.CF_API_TOKEN + CF_ACCOUNT_ID
    // ════════════════════════════════════════════════════════════════════════

    const env = this.env as unknown as CfEnv;

    // ── deploy_worker ──────────────────────────────────────────────────────
    this.server.tool(
      "deploy_worker",
      "Deploy (create or update) a Cloudflare Worker script. " +
        "Pass the full JavaScript source as `code`. " +
        "Use this to push updates to cv-proxy, docx-worker, antcv-mcp, etc.",
      {
        scriptName: z
          .string()
          .describe('Worker name as shown in the CF dashboard (e.g. "cv-proxy")'),
        code: z
          .string()
          .describe("Full JavaScript source code of the Worker"),
        compatibilityDate: z
          .string()
          .optional()
          .describe("Compatibility date YYYY-MM-DD (default: 2024-09-23)"),
      },
      async ({ scriptName, code, compatibilityDate }) => {
        const date = compatibilityDate ?? "2024-09-23";
        const metadata = JSON.stringify({
          main_module: "script.js",
          compatibility_date: date,
          usage_model: "standard",
        });
        const boundary = `boundary${Date.now()}`;
        const body = [
          `--${boundary}\r\n`,
          `Content-Disposition: form-data; name="metadata"\r\n`,
          `Content-Type: application/json\r\n\r\n`,
          `${metadata}\r\n`,
          `--${boundary}\r\n`,
          `Content-Disposition: form-data; name="script.js"; filename="script.js"\r\n`,
          `Content-Type: application/javascript+module\r\n\r\n`,
          `${code}\r\n`,
          `--${boundary}--\r\n`,
        ].join("");
        const result = await cfFetch(env, `/workers/scripts/${scriptName}`, {
          method: "PUT",
          headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
          body,
        });
        const text =
          `✓ Worker "${scriptName}" deployed successfully.\n` +
          `  etag: ${result.result?.etag ?? "n/a"}\n` +
          `  modified: ${result.result?.modified_on ?? "n/a"}`;
        return { content: [{ type: "text", text }] };
      }
    );

    // ── deploy_pages ───────────────────────────────────────────────────────
    this.server.tool(
      "deploy_pages",
      "Deploy files to a Cloudflare Pages project via direct upload. " +
        "Pass an object where each key is a file path (e.g. 'index.html') " +
        "and each value is the file text content. " +
        "Use this to push index.html updates to cv-generator-det.pages.dev.",
      {
        projectName: z
          .string()
          .describe('Pages project name (e.g. "cv-generator-det")'),
        files: z
          .record(z.string())
          .describe(
            'Object mapping file paths to text content. E.g. {"index.html": "<html>..."}'
          ),
        branch: z
          .string()
          .optional()
          .describe('Branch name for the deployment (default: "main")'),
      },
      async ({ projectName, files, branch }) => {
        const b = `boundary${Date.now()}`;
        const enc = new TextEncoder();
        const parts: Uint8Array[] = [];

        for (const [filePath, content] of Object.entries(files)) {
          const header =
            `--${b}\r\n` +
            `Content-Disposition: form-data; name="files"; filename="${filePath}"\r\n` +
            `Content-Type: application/octet-stream\r\n\r\n`;
          parts.push(enc.encode(header));
          parts.push(enc.encode(content as string));
          parts.push(enc.encode("\r\n"));
        }
        parts.push(enc.encode(`--${b}--\r\n`));

        const totalLen = parts.reduce((s, p) => s + p.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const p of parts) {
          merged.set(p, offset);
          offset += p.length;
        }

        const result = await cfFetch(
          env,
          `/pages/projects/${projectName}/deployments`,
          {
            method: "POST",
            headers: { "Content-Type": `multipart/form-data; boundary=${b}` },
            body: merged,
          }
        );
        const dep = result.result ?? {};
        const text =
          `✓ Pages deployment created for "${projectName}".\n` +
          `  ID: ${dep.id ?? "n/a"}\n` +
          `  URL: ${dep.url ?? "pending"}\n` +
          `  Stage: ${dep.latest_stage?.name ?? "n/a"}`;
        return { content: [{ type: "text", text }] };
      }
    );

    // ── list_workers ───────────────────────────────────────────────────────
    this.server.tool(
      "list_workers",
      "List all Cloudflare Workers in the account.",
      {},
      async () => {
        const result = await cfFetch(env, "/workers/scripts");
        const workers: string[] = (result.result ?? []).map(
          (w: any) =>
            `${w.id} (modified: ${w.modified_on?.slice(0, 10) ?? "n/a"})`
        );
        return {
          content: [
            {
              type: "text",
              text: workers.length ? workers.join("\n") : "No workers found.",
            },
          ],
        };
      }
    );

    // ── list_pages_projects ────────────────────────────────────────────────
    this.server.tool(
      "list_pages_projects",
      "List all Cloudflare Pages projects in the account.",
      {},
      async () => {
        const result = await cfFetch(env, "/pages/projects");
        const projects: string[] = (result.result ?? []).map(
          (p: any) =>
            `${p.name} — ${p.subdomain ?? "no subdomain"} (${
              p.source?.type ?? "direct"
            })`
        );
        return {
          content: [
            {
              type: "text",
              text: projects.length
                ? projects.join("\n")
                : "No Pages projects found.",
            },
          ],
        };
      }
    );

    // ── get_worker_code ────────────────────────────────────────────────────
    this.server.tool(
      "get_worker_code",
      "Retrieve the current deployed source code of a Cloudflare Worker.",
      {
        scriptName: z.string().describe('Worker name (e.g. "cv-proxy")'),
      },
      async ({ scriptName }) => {
        const url = `https://api.cloudflare.com/client/v4/accounts/${
          env.CF_ACCOUNT_ID
        }/workers/scripts/${scriptName}`;
        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${env.CF_API_TOKEN}`,
            Accept: "application/javascript",
          },
        });
        if (!res.ok)
          throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const code = await res.text();
        return {
          content: [
            {
              type: "text",
              text: `// Worker: ${scriptName}  (${code.length} chars)\n\n${code}`,
            },
          ],
        };
      }
    );

    // ── set_worker_secret ──────────────────────────────────────────────────
    this.server.tool(
      "set_worker_secret",
      "Set or update an encrypted secret on a Cloudflare Worker. " +
        "Use this to configure CLOUDCONVERT_API_KEY, ANALYTICS_SECRET, etc. " +
        "without touching the dashboard.",
      {
        scriptName: z.string().describe("Worker name"),
        secretName: z
          .string()
          .describe('Name of the secret variable (e.g. "CLOUDCONVERT_API_KEY")'),
        secretValue: z.string().describe("The secret value"),
      },
      async ({ scriptName, secretName, secretValue }) => {
        await cfFetch(env, `/workers/scripts/${scriptName}/secrets`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: secretName,
            text: secretValue,
            type: "secret_text",
          }),
        });
        return {
          content: [
            {
              type: "text",
              text: `✓ Secret "${secretName}" set on Worker "${scriptName}".`,
            },
          ],
        };
      }
    );

    // ── cloudflare_pages_deploy_status ─────────────────────────────────────
    this.server.tool(
      "cloudflare_pages_deploy_status",
      "Fetch the most recent Cloudflare Pages deployment(s) for a project.",
      {
        project: z
          .string()
          .describe("Pages project name, e.g. 'cv-generator-det'."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe("How many recent deployments to return (default 1)."),
      },
      async ({ project, limit }) => {
        const url =
          `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}` +
          `/pages/projects/${project}/deployments?per_page=${limit ?? 1}`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
        });
        const json: any = await resp.json();
        if (!resp.ok || !json.success) {
          return {
            content: [
              {
                type: "text",
                text: `CF API error (${resp.status}): ${JSON.stringify(
                  json.errors ?? json
                )}`,
              },
            ],
          };
        }
        const deployments: any[] = json.result ?? [];
        const lines = deployments.map((d) => {
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
          content: [
            {
              type: "text",
              text: lines.length ? lines.join("\n") : "No deployments found.",
            },
          ],
        };
      }
    );
  }
}

// ─── OAuth + routing entry point ──────────────────────────────────────────────
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
