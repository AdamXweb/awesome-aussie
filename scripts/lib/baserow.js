/**
 * Minimal Baserow database-token client.
 *
 * This intentionally uses Baserow's table row endpoints with
 * user_field_names=true, so the rest of the repo can work with stable field
 * names such as "Name" and "URL" instead of generated field ids.
 */

const DEFAULT_BASE = "https://api.baserow.io";

function getEnv(name, { required = true } = {}) {
  const v = process.env[name];
  if (required && (!v || !v.trim())) {
    throw new Error(`Missing required env var ${name}`);
  }
  return v;
}

function buildClient({
  apiToken = getEnv("BASEROW_API_TOKEN"),
  baseUrl = process.env.BASEROW_API_BASE_URL || DEFAULT_BASE,
} = {}) {
  const root = baseUrl.replace(/\/$/, "");

  async function request(method, path, { body, query } = {}) {
    const url = new URL(`${root}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === "") continue;
        url.searchParams.set(key, String(value));
      }
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Token ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      const err = new Error(
        `Baserow API ${method} ${path} -> ${res.status}: ${
          typeof data === "string" ? data : JSON.stringify(data)
        }`
      );
      err.status = res.status;
      err.body = data;
      throw err;
    }

    return data;
  }

  async function listRows(tableId, { query = {} } = {}) {
    const rows = [];
    let page = 1;
    while (page < 1000) {
      const data = await request(
        "GET",
        `/api/database/rows/table/${encodeURIComponent(tableId)}/`,
        {
          query: {
            user_field_names: "true",
            size: 200,
            page,
            ...query,
          },
        }
      );
      const results = Array.isArray(data) ? data : data.results || [];
      rows.push(...results);
      if (!data || !data.next || results.length === 0) break;
      page += 1;
    }
    return rows;
  }

  return {
    apiToken,
    baseUrl: root,
    request,
    listRows,
    listFields: (tableId) =>
      request(
        "GET",
        `/api/database/fields/table/${encodeURIComponent(tableId)}/`
      ),
    createRow: (tableId, fields) =>
      request("POST", `/api/database/rows/table/${encodeURIComponent(tableId)}/`, {
        query: { user_field_names: "true" },
        body: fields,
      }),
    updateRow: (tableId, rowId, fields) =>
      request(
        "PATCH",
        `/api/database/rows/table/${encodeURIComponent(tableId)}/${encodeURIComponent(
          rowId
        )}/`,
        {
          query: { user_field_names: "true" },
          body: fields,
        }
      ),
  };
}

module.exports = { buildClient };
