# cv-proxy with /preferences

Deploy:

```powershell
npm install
npx wrangler deploy
```

Set secrets:

```powershell
npx wrangler secret put Claude_API_Key
npx wrangler secret put ChatGPT_API_Key
npx wrangler secret put Mistral_API_Key
npx wrangler secret put Gemini_API_Key
```

Cloud save needs a KV binding named `KV_BINDING`.

Cloudflare Dashboard:
Workers & Pages -> cv-proxy -> Settings -> Bindings -> KV namespace bindings -> Add binding

Variable name:
`KV_BINDING`

Then redeploy or save/deploy in dashboard.
