import assert from "node:assert/strict";
import test from "node:test";
import { authorizationServerMetadata, bearer, hashSecret, isAllowedRedirect, newSecret, pkceChallenge, protectedResourceMetadata, publicOrigin, redirectMatches, verifyPkce } from "./oauth-rules.ts";

test("only Claude's callbacks can be registered", () => {
  assert.equal(isAllowedRedirect("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(isAllowedRedirect("http://localhost:3118/callback"), true);
  assert.equal(isAllowedRedirect("http://127.0.0.1:50000/callback"), true);
  assert.equal(isAllowedRedirect("https://evil.example/callback"), false);
  assert.equal(isAllowedRedirect("https://claude.ai.evil.example/api/mcp/auth_callback"), false);
  assert.equal(isAllowedRedirect("http://localhost.evil.example/callback"), false);
  assert.equal(isAllowedRedirect("javascript:alert(1)"), false);
});

test("loopback redirects match on any port, nothing else is loose", () => {
  assert.equal(redirectMatches(["http://localhost/callback"], "http://localhost:4444/callback"), true);
  assert.equal(redirectMatches(["http://localhost/callback"], "http://localhost:4444/other"), false);
  assert.equal(redirectMatches(["https://claude.ai/api/mcp/auth_callback"], "https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(redirectMatches(["https://claude.ai/api/mcp/auth_callback"], "https://claude.ai/api/mcp/auth_callback?x=1"), false);
});

test("PKCE S256 (RFC 7636 appendix B)", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(pkceChallenge(verifier), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  assert.equal(verifyPkce(verifier, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"), true);
  assert.equal(verifyPkce(verifier, "wrong"), false);
  assert.equal(verifyPkce("short", pkceChallenge("short")), false);
});

test("secrets are random and only their hash is kept", () => {
  const a = newSecret("ccc_at"); const b = newSecret("ccc_at");
  assert.notEqual(a, b);
  assert.match(a, /^ccc_at_[A-Za-z0-9_-]{43}$/);
  assert.equal(hashSecret(a).length, 64);
  assert.equal(bearer("Bearer abc.def"), "abc.def");
  assert.equal(bearer("Basic abc"), "");
});

test("discovery documents point at this app", () => {
  const as = authorizationServerMetadata("https://internal.ccclub.id");
  assert.equal(as.issuer, "https://internal.ccclub.id");
  assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
  assert.ok(as.token_endpoint_auth_methods_supported.includes("none"));
  const pr = protectedResourceMetadata("https://internal.ccclub.id");
  assert.equal(pr.resource, "https://internal.ccclub.id/api/mcp");
  assert.deepEqual(pr.authorization_servers, ["https://internal.ccclub.id"]);
  const headers = new Map([["x-forwarded-host", "internal.ccclub.id"], ["x-forwarded-proto", "https"]]);
  assert.equal(publicOrigin({ get: (n) => headers.get(n) ?? null }, "http://localhost:3000/api/mcp"), "https://internal.ccclub.id");
  assert.equal(publicOrigin({ get: () => null }, "http://x/api/mcp", "https://internal.ccclub.id/"), "https://internal.ccclub.id");
});
