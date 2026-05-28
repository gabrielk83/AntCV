import type { AuthRequest, OAuthHelpers } from "@cloudflare/workers-oauth-provider";
import { Hono } from "hono";
import { Octokit } from "@octokit/rest";
import { fetchUpstreamAuthToken, getUpstreamAuthorizeUrl, type Props } from "./utils";
import {
	addApprovedClient,
	bindStateToSession,
	createOAuthState,
	generateCSRFProtection,
	isClientApproved,
	OAuthError,
	renderApprovalDialog,
	validateCSRFToken,
	validateOAuthState,
} from "./workers-oauth-utils";

const app = new Hono<{ Bindings: Env & { OAUTH_PROVIDER: OAuthHelpers } }>();

const ALLOWED_USERNAMES = new Set(["gabrielk83"].map((username) => username.toLowerCase()));

function isAllowedUsername(username: string | null | undefined) {
	return Boolean(username && ALLOWED_USERNAMES.has(username.toLowerCase()));
}

function appendCookie(headers: Headers, cookie: string | undefined) {
	if (cookie) {
		headers.append("Set-Cookie", cookie);
	}
}

app.get("/authorize", async (c) => {
	const oauthReqInfo = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
	const { clientId } = oauthReqInfo;
	if (!clientId) {
		return c.text("Invalid request", 400);
	}

	if (await isClientApproved(c.req.raw, clientId, c.env.COOKIE_ENCRYPTION_KEY)) {
		const { stateToken } = await createOAuthState(oauthReqInfo, c.env.OAUTH_KV);
		const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);

		const headers = new Headers();
		appendCookie(headers, sessionBindingCookie);

		return redirectToGithub(c.req.raw, c.env, stateToken, headers);
	}

	const { token: csrfToken, setCookie } = generateCSRFProtection();

	return renderApprovalDialog(c.req.raw, {
		client: await c.env.OAUTH_PROVIDER.lookupClient(clientId),
		csrfToken,
		server: {
			description: "This is a demo MCP Remote Server using GitHub for authentication.",
			logo: "https://avatars.githubusercontent.com/u/314135?s=200&v=4",
			name: "Cloudflare GitHub MCP Server",
		},
		setCookie,
		state: { oauthReqInfo },
	});
});

app.post("/authorize", async (c) => {
	try {
		const formData = await c.req.raw.formData();

		validateCSRFToken(formData, c.req.raw);

		const encodedState = formData.get("state");
		if (!encodedState || typeof encodedState !== "string") {
			return c.text("Missing state in form data", 400);
		}

		let state: { oauthReqInfo?: AuthRequest };
		try {
			state = JSON.parse(atob(encodedState));
		} catch (_e) {
			return c.text("Invalid state data", 400);
		}

		if (!state.oauthReqInfo || !state.oauthReqInfo.clientId) {
			return c.text("Invalid request", 400);
		}

		const approvedClientCookie = await addApprovedClient(
			c.req.raw,
			state.oauthReqInfo.clientId,
			c.env.COOKIE_ENCRYPTION_KEY,
		);

		const { stateToken } = await createOAuthState(state.oauthReqInfo, c.env.OAUTH_KV);
		const { setCookie: sessionBindingCookie } = await bindStateToSession(stateToken);

		const headers = new Headers();
		appendCookie(headers, approvedClientCookie);
		appendCookie(headers, sessionBindingCookie);

		return redirectToGithub(c.req.raw, c.env, stateToken, headers);
	} catch (error: any) {
		console.error("POST /authorize error:", error);
		if (error instanceof OAuthError) {
			return error.toResponse();
		}
		return c.text(`Internal server error: ${error.message}`, 500);
	}
});

async function redirectToGithub(
	request: Request,
	envBindings: Env,
	stateToken: string,
	headers: HeadersInit = {},
) {
	const responseHeaders = new Headers(headers);
	responseHeaders.set(
		"Location",
		getUpstreamAuthorizeUrl({
			client_id: envBindings.GITHUB_CLIENT_ID,
			redirect_uri: new URL("/callback", request.url).href,
			scope: ["read:user", "repo"].join(" "),
			state: stateToken,
			upstream_url: "https://github.com/login/oauth/authorize",
		}),
	);

	return new Response(null, {
		headers: responseHeaders,
		status: 302,
	});
}

app.get("/callback", async (c) => {
	console.log("GitHub OAuth callback received", {
		hasCode: Boolean(c.req.query("code")),
		hasState: Boolean(c.req.query("state")),
	});

	let oauthReqInfo: AuthRequest;
	let clearSessionCookie: string;

	try {
		const result = await validateOAuthState(c.req.raw, c.env.OAUTH_KV);
		oauthReqInfo = result.oauthReqInfo;
		clearSessionCookie = result.clearCookie;
	} catch (error: any) {
		console.error("OAuth state validation failed:", error);
		if (error instanceof OAuthError) {
			return error.toResponse();
		}
		return c.text("Internal server error", 500);
	}

	if (!oauthReqInfo.clientId) {
		return c.text("Invalid OAuth request data", 400);
	}

	const [accessToken, errResponse] = await fetchUpstreamAuthToken({
		client_id: c.env.GITHUB_CLIENT_ID,
		client_secret: c.env.GITHUB_CLIENT_SECRET,
		code: c.req.query("code"),
		redirect_uri: new URL("/callback", c.req.url).href,
		upstream_url: "https://github.com/login/oauth/access_token",
	});
	if (errResponse) {
		console.error("GitHub token exchange failed", { status: errResponse.status });
		return errResponse;
	}

	const user = await new Octokit({ auth: accessToken }).rest.users.getAuthenticated();
	const { login } = user.data;
	const displayName = user.data.name ?? login;
	const email = user.data.email ?? "";

	console.log("GitHub OAuth user resolved", {
		allowed: isAllowedUsername(login),
		login,
	});

	if (!isAllowedUsername(login)) {
		const headers = new Headers();
		appendCookie(headers, clearSessionCookie);

		return new Response(`Unauthorized GitHub user: ${login}`, {
			status: 403,
			headers,
		});
	}

	try {
		const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
			metadata: {
				label: displayName,
			},
			props: {
				accessToken,
				email,
				login,
				name: displayName,
			} as Props,
			request: oauthReqInfo,
			scope: oauthReqInfo.scope,
			userId: login,
		});

		const headers = new Headers({ Location: redirectTo });
		appendCookie(headers, clearSessionCookie);

		return new Response(null, {
			status: 302,
			headers,
		});
	} catch (error: any) {
		console.error("MCP authorization completion failed:", error);
		const headers = new Headers();
		appendCookie(headers, clearSessionCookie);
		return new Response(`MCP authorization completion failed: ${error.message}`, {
			status: 500,
			headers,
		});
	}
});

export { app as GitHubHandler };
