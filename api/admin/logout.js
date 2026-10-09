const { json, requireSameOrigin } = require("../../lib/admin-auth");

module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Méthode non autorisée." });
  }
  if (!requireSameOrigin(req)) return json(res, 403, { error: "Origine non autorisée." });
  res.setHeader("Set-Cookie", "kelo_admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0");
  return json(res, 200, { ok: true });
};
