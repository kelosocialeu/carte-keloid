const { hasValidSession, requireSameOrigin, json } = require("../../lib/admin-auth");

const OWNER = "kelosocialeu";
const REPO = "carte-keloid";
const PATH = "countries.json";
const BRANCH = "main";
const API = "https://api.github.com";

async function github(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN_MISSING");
  const response = await fetch(API + path, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error("GITHUB_API_" + response.status);
    error.status = response.status;
    error.details = data?.message || "";
    throw error;
  }
  return data;
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

async function readConfig() {
  const data = await github("/repos/" + OWNER + "/" + REPO + "/contents/" + PATH + "?ref=" + BRANCH);
  const decoded = Buffer.from(data.content || "", "base64").toString("utf8");
  return { config: JSON.parse(decoded), sha: data.sha };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!["GET", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { error: "Méthode non autorisée." });
  }
  if (!hasValidSession(req)) return json(res, 401, { error: "Session admin expirée. Reconnectez-vous." });
  if (req.method === "POST" && !requireSameOrigin(req)) return json(res, 403, { error: "Origine non autorisée." });

  if (req.method === "GET") {
    try {
      const { config } = await readConfig();
      return json(res, 200, config);
    } catch (error) {
      if (error.message === "GITHUB_TOKEN_MISSING") return json(res, 503, { error: "Le jeton GitHub n’est pas configuré dans Vercel." });
      return json(res, 502, { error: "Impossible de lire la configuration dans le dépôt GitHub." });
    }
  }

  const body = parseBody(req);
  const submitted = body && body.countries;
  if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
    return json(res, 400, { error: "Configuration des pays invalide." });
  }
  const ids = Object.keys(submitted);
  if (ids.length > 300) return json(res, 400, { error: "Trop de pays dans la configuration." });

  const countries = {};
  for (const id of ids) {
    if (!/^\d{3}$/.test(id)) return json(res, 400, { error: "Identifiant de pays invalide." });
    const value = submitted[id];
    if (!value || !["green", "red", "gray"].includes(value.status)) {
      return json(res, 400, { error: "Chaque pays doit avoir un statut vert, rouge ou gris." });
    }
    const date = typeof value.date === "string" ? value.date : "";
    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json(res, 400, { error: "Une date doit utiliser le format AAAA-MM-JJ." });
      }
      const parsedDate = new Date(date + "T00:00:00.000Z");
      if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
        return json(res, 400, { error: "La date indiquée n’est pas valide." });
      }
    }
    const note = typeof value.note === "string" ? value.note.trim().slice(0, 300) : "";
    // Red without a date/note is represented by the global default to keep the JSON compact.
    if (value.status !== "red" || date || note) {
      countries[id] = { status: value.status, date, note };
    }
  }

  try {
    const { sha } = await readConfig();
    const config = { defaultStatus: "red", countries };
    const content = Buffer.from(JSON.stringify(config, null, 2) + "\n", "utf8").toString("base64");
    const commit = await github("/repos/" + OWNER + "/" + REPO + "/contents/" + PATH, {
      method: "PUT",
      body: JSON.stringify({
        message: "Update NFC country coverage from admin panel",
        content,
        sha,
        branch: BRANCH
      })
    });
    return json(res, 200, {
      ok: true,
      commit: commit.commit?.sha || null,
      url: commit.content?.html_url || "https://github.com/" + OWNER + "/" + REPO + "/blob/" + BRANCH + "/" + PATH
    });
  } catch (error) {
    if (error.message === "GITHUB_TOKEN_MISSING") return json(res, 503, { error: "Le jeton GitHub n’est pas configuré dans Vercel." });
    if (error.status === 409 || error.status === 422) return json(res, 409, { error: "Le fichier a changé en même temps. Rechargez la page puis réessayez." });
    return json(res, 502, { error: "Échec de l’enregistrement dans GitHub. Vérifiez les droits du jeton GitHub." });
  }
};
