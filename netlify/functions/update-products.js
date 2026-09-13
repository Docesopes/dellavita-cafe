// Recibe la lista de productos actualizada desde admin.html,
// valida la clave y los datos, y la sube al repo de GitHub.
// El token de GitHub vive solo acá (variables de entorno de Netlify),
// nunca se manda al navegador.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON inválido" }) };
  }

  const { password, products } = body;

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return { statusCode: 401, body: JSON.stringify({ error: "Clave incorrecta" }) };
  }

  if (!Array.isArray(products) || products.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: "La lista de productos no puede estar vacía" }) };
  }

  for (const p of products) {
    if (!p.id || !p.name || typeof p.price !== "number" || isNaN(p.price) || p.price < 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: `Producto inválido: cada café necesita id, nombre y precio.` }),
      };
    }
  }

  const OWNER = process.env.GITHUB_OWNER;
  const REPO = process.env.GITHUB_REPO;
  const TOKEN = process.env.GITHUB_TOKEN;
  const BRANCH = "main";
  const PATH = "products.json";
  const API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;

  if (!OWNER || !REPO || !TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: "El servidor no tiene configuradas las variables de GitHub" }) };
  }

  try {
    const getRes = await fetch(`${API}?ref=${BRANCH}`, {
      headers: { Authorization: `token ${TOKEN}`, Accept: "application/vnd.github+json" },
    });
    const getData = await getRes.json();
    const sha = getRes.ok ? getData.sha : undefined;

    const content = Buffer.from(JSON.stringify(products, null, 2)).toString("base64");

    const putRes = await fetch(API, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: "Actualiza productos desde el panel de administración",
        content,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      return { statusCode: 502, body: JSON.stringify({ error: "GitHub rechazó el cambio", detail: err.message }) };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Error de servidor", detail: String(e) }) };
  }
};
