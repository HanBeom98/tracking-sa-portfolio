import crypto from "crypto";

function addCORSHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function signJwt(serviceAccount) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token",
    iat,
    exp,
  };

  const encoded = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(encoded);
  signer.end();
  const sig = signer.sign(serviceAccount.private_key);
  return `${encoded}.${b64url(sig)}`;
}

async function fetchAccessToken(serviceAccount) {
  const assertion = signJwt(serviceAccount);
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`oauth_http_${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("oauth_no_access_token");
  return data.access_token;
}

function parseFirestoreValue(v) {
  if (!v || typeof v !== "object") return null;
  if ("stringValue" in v) return v.stringValue;
  if ("doubleValue" in v) return Number(v.doubleValue);
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return Boolean(v.booleanValue);
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) {
    const out = {};
    const fields = v.mapValue.fields || {};
    Object.keys(fields).forEach((k) => {
      out[k] = parseFirestoreValue(fields[k]);
    });
    return out;
  }
  if ("arrayValue" in v) {
    const vals = v.arrayValue.values || [];
    return vals.map(parseFirestoreValue);
  }
  return null;
}

function parseDocument(doc) {
  const fields = doc?.fields || {};
  const out = {};
  Object.keys(fields).forEach((k) => {
    out[k] = parseFirestoreValue(fields[k]);
  });
  return out;
}

function getServiceAccount(env) {
  const raw = env?.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("missing_service_account_json");
  const parsed = JSON.parse(raw);
  if (parsed.private_key && parsed.private_key.includes("\\n")) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error("invalid_service_account_json");
  }
  return parsed;
}

export async function onRequest(context) {
  const { request, env } = context || {};
  if (!request) {
    return addCORSHeaders(
      new Response(JSON.stringify({ error: "No request object" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  if (request.method === "OPTIONS") {
    return addCORSHeaders(new Response(null, { status: 204 }));
  }
  if (request.method !== "GET") {
    return addCORSHeaders(
      new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  try {
    const sa = getServiceAccount(env);
    const token = await fetchAccessToken(sa);
    const url =
      `https://firestore.googleapis.com/v1/projects/${sa.project_id}` +
      `/databases/(default)/documents/futures_predictions?pageSize=30&orderBy=target_date%20desc`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`firestore_http_${res.status}`);
    const data = await res.json();
    const docs = Array.isArray(data.documents) ? data.documents : [];
    const rows = docs.map(parseDocument).map((d) => ({
      target_date: d.target_date || "",
      prediction_label: d.prediction_label || "-",
      actual_label: d.actual_label || "-",
      status: d.status || "predicted",
      is_hit: typeof d.is_hit === "boolean" ? d.is_hit : null,
      probability_up: typeof d.probability_up === "number" ? d.probability_up : null,
    }));

    return addCORSHeaders(
      new Response(JSON.stringify({ items: rows }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch (error) {
    return addCORSHeaders(
      new Response(JSON.stringify({ error: String(error?.message || error) }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      })
    );
  }
}

