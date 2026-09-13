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

  const { password, products, images } = body;

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
    if (!/^[a-z0-9-]+$/.test(p.id)) {
      return { statusCode: 400, body: JSON.stringify({ error: `ID de producto inválido: ${p.id}` }) };
    }
  }

  const OWNER = process.env.GITHUB_OWNER;
  const REPO = process.env.GITHUB_REPO;
  const TOKEN = process.env.GITHUB_TOKEN;
  const BRANCH = "main";

  if (!OWNER || !REPO || !TOKEN) {
    return { statusCode: 500, body: JSON.stringify({ error: "El servidor no tiene configuradas las variables de GitHub" }) };
  }

  async function putFile(path, base64Content, message) {
    const api = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
    const getRes = await fetch(`${api}?ref=${BRANCH}`, {
      headers: { Authorization: `token ${TOKEN}`, Accept: "application/vnd.github+json" },
    });
    const getData = await getRes.json().catch(() => ({}));
    const sha = getRes.ok ? getData.sha : undefined;

    const putRes = await fetch(api, {
      method: "PUT",
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: base64Content,
        branch: BRANCH,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `No se pudo escribir ${path}`);
    }
  }

  try {
    // 1) Subir las imágenes nuevas, si hay
    if (images && typeof images === "object") {
      for (const [productId, dataUrl] of Object.entries(images)) {
        if (!/^[a-z0-9-]+$/.test(productId)) continue;
        const match = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl || "");
        if (!match) continue;
        const base64Data = match[2];
        // Límite de seguridad: ~4MB decodificados por imagen
        if (base64Data.length * 0.75 > 4 * 1024 * 1024) {
          return { statusCode: 400, body: JSON.stringify({ error: `La imagen de "${productId}" es demasiado pesada` }) };
        }
        await putFile(`img/products/${productId}.jpg`, base64Data, `Actualiza foto de ${productId} desde el panel`);
      }
    }

    // 2) Guardar el archivo de productos
    const content = Buffer.from(JSON.stringify(products, null, 2)).toString("base64");
    await putFile("products.json", content, "Actualiza productos desde el panel de administración");

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Error de servidor", detail: String(e.message || e) }) };
  }
};
