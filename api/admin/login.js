const crypto = require("node:crypto");
const { sign, safeEqual, json, requireSameOrigin } = require("../../lib/admin-auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Méthode non autorisée." });
  }
  if (!requireSameOrigin(req)) return json(res, 403, { error: "Origine non autorisée." });

  const expected = process.env.KELO_ADMIN_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || expected.length < 12 || !secret || secret.length < 32) {
    return json(res, 503, { error: "La connexion admin n’est pas encore configurée dans les variables d’environnement Vercel." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !safeEqual(password, expected)) {
    return json(res, 401, { error: "Code admin incorrect." });
  }

  const payload = Buffer.from(JSON.stringify({
    role: "admin",
    exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    nonce: crypto.randomBytes(12).toString("hex")
  })).toString("base64url");
  const token = payload + "." + sign(payload);
  res.setHeader("Set-Cookie", "kelo_admin_session=" + encodeURIComponent(token) + "; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800");
  return json(res, 200, { ok: true, expiresIn: 28800 });
};
