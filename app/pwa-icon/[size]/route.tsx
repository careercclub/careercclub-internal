import { ImageResponse } from "next/og";

export const runtime = "nodejs";

type IconRouteProps = {
  params: Promise<{ size: string }>;
};

export async function GET(request: Request, { params }: IconRouteProps) {
  const requestedSize = Number((await params).size);
  const size = [180, 192, 512].includes(requestedSize) ? requestedSize : 192;
  const maskable = new URL(request.url).searchParams.has("maskable");
  const inset = maskable ? Math.round(size * 0.12) : 0;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: inset,
        background: "#0a3d8f",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `${Math.max(4, Math.round(size * 0.025))}px solid rgba(255,255,255,0.28)`,
          borderRadius: Math.round(size * 0.18),
          color: "white",
          fontFamily: "Arial, sans-serif",
          fontSize: Math.round(size * 0.22),
          fontWeight: 800,
          letterSpacing: 0,
        }}
      >
        CCC
      </div>
    </div>,
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
