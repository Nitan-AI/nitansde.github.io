const SITE_HOST = "nitan.ai";
const WWW_HOST = "www.nitan.ai";
const BASE_PATH = "/mcp";
const BASE_URL = `https://${SITE_HOST}${BASE_PATH}/`;

const CACHE_CONTROL_BY_EXTENSION = new Map([
  [".png", "public, max-age=86400, stale-while-revalidate=604800"],
  [".jpg", "public, max-age=86400, stale-while-revalidate=604800"],
  [".jpeg", "public, max-age=86400, stale-while-revalidate=604800"],
  [".webp", "public, max-age=86400, stale-while-revalidate=604800"],
  [".svg", "public, max-age=86400, stale-while-revalidate=604800"],
  [".css", "public, max-age=3600, stale-while-revalidate=86400"],
  [".js", "public, max-age=3600, stale-while-revalidate=86400"],
]);

function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      Location: location,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
    },
  });
}

function securityHeaders(contentType, pathname) {
  const isHtml = contentType.includes("text/html");
  const headers = new Headers({
    "Content-Security-Policy":
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy":
      "accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Origin-Agent-Cluster": "?1",
  });

  if (isHtml) {
    headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  } else {
    const matchedExtension = [...CACHE_CONTROL_BY_EXTENSION.keys()].find((ext) => pathname.endsWith(ext));
    headers.set(
      "Cache-Control",
      matchedExtension
        ? CACHE_CONTROL_BY_EXTENSION.get(matchedExtension)
        : "public, max-age=3600, stale-while-revalidate=86400",
    );
  }

  return headers;
}

async function serveAsset(request, env, assetPath) {
  const assetUrl = new URL(`https://assets.local${assetPath}`);
  const assetResponse = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));

  if (assetResponse.status === 404 && !assetPath.includes(".")) {
    return env.ASSETS.fetch("https://assets.local/index.html");
  }

  const response = new Response(assetResponse.body, assetResponse);
  const contentType = response.headers.get("content-type") || "";
  const headers = securityHeaders(contentType, assetPath);

  headers.forEach((value, key) => {
    response.headers.set(key, value);
  });

  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hostHeader = request.headers.get("Host");
    const hostname = (hostHeader ? hostHeader.split(":")[0] : url.hostname).toLowerCase();
    const { pathname } = url;

    if (hostname === WWW_HOST) {
      return redirect(BASE_URL);
    }

    if (hostname !== SITE_HOST) {
      return new Response("Unknown host", { status: 404 });
    }

    if (pathname === "/" || pathname === "") {
      return redirect(BASE_URL);
    }

    if (pathname === BASE_PATH) {
      return redirect(BASE_URL);
    }

    if (!pathname.startsWith(`${BASE_PATH}/`)) {
      return redirect(BASE_URL, 302);
    }

    const assetPath = pathname === `${BASE_PATH}/` ? "/index.html" : pathname.slice(BASE_PATH.length);
    return serveAsset(request, env, assetPath);
  },
};
