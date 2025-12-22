import { NextResponse } from "next/server";

const BASE = process.env.ATLAS_API_BASE_URL || "http://localhost:3001";
const DEV_TOKEN = process.env.ATLAS_DEV_TOKEN || "dev";

function buildTargetUrl(pathParts: string[] = [], searchParams: URLSearchParams) {
  const path = pathParts.join("/");
  const url = new URL(`${BASE}/${path}`);
  searchParams.forEach((v, k) => url.searchParams.set(k, v));
  return url;
}

async function proxy(
  req: Request,
  ctx: { params: Promise<{ path?: string[] }> } | { params: { path?: string[] } }
) {
  // ✅ Next 16: params peut être une Promise
  const params =
    "then" in (ctx.params as any) ? await (ctx.params as Promise<any>) : (ctx.params as any);

  const pathParts: string[] = params?.path ?? [];

  const url = new URL(req.url);
  const target = buildTargetUrl(pathParts, url.searchParams);

  // On forward le body seulement si nécessaire
  const hasBody = !["GET", "HEAD"].includes(req.method.toUpperCase());

  const upstream = await fetch(target.toString(), {
    method: req.method,
    headers: {
      // forward content-type si présent
      ...(req.headers.get("content-type")
        ? { "content-type": req.headers.get("content-type") as string }
        : {}),
      // auth vers API backend ATLAS
      authorization: `Bearer ${DEV_TOKEN}`,
    },
    body: hasBody ? await req.text() : undefined,
  });

  const resHeaders = new Headers(upstream.headers);
  // évite certains soucis de streaming / encoding en dev
  resHeaders.delete("content-encoding");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: resHeaders,
  });
}

export async function GET(req: Request, ctx: any) {
  return proxy(req, ctx);
}
export async function POST(req: Request, ctx: any) {
  return proxy(req, ctx);
}
export async function PUT(req: Request, ctx: any) {
  return proxy(req, ctx);
}
export async function PATCH(req: Request, ctx: any) {
  return proxy(req, ctx);
}
export async function DELETE(req: Request, ctx: any) {
  return proxy(req, ctx);
}
