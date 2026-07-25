/**
 * AppAuth usage example
 *
 * AUTH_URL and AUTH_JWT_SECRET are injected automatically when your app boots
 * inside a MIOSA sandbox or deployment. Run this example locally by exporting
 * them manually:
 *
 *   export AUTH_URL=https://your-app.miosa.app
 *   export AUTH_JWT_SECRET=your-secret
 *   npx tsx examples/app-auth.ts
 */

import { AppAuth } from "../src/resources/app-auth.js";

const auth = new AppAuth({
  resourceType: "deployment",
  resourceId: process.env["RESOURCE_ID"] ?? "dep_demo",
  // authUrl and jwtSecret are read from AUTH_URL / AUTH_JWT_SECRET env vars
});

async function main(): Promise<void> {
  // 1. Sign up a new user
  const session = await auth.signup("alice@example.com", "hunter2");
  console.log("Signed up:", session.userId, "token:", session.token);

  // 2. Log in
  const loginSession = await auth.login("alice@example.com", "hunter2");
  console.log("Logged in, expires:", loginSession.expiresAt);

  // 3. Fetch the current user
  const me = await auth.me(loginSession.token);
  console.log("Me:", me.userId);

  // 4. Verify token locally (HS256, no network call)
  const payload = await auth.verifyToken(loginSession.token);
  console.log("Token sub:", payload.sub, "exp:", new Date(payload.exp * 1000));

  // 5. Password reset
  await auth.passwordReset("alice@example.com");
  console.log("Password reset email sent");

  // 6. Logout
  await auth.logout(loginSession.token);
  console.log("Logged out");
}

main().catch(console.error);
