import { auth } from "@/auth";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  isStorageArea,
  isStorageKey,
} from "@/lib/storage/r2";

const allowedContentTypes = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function requireSession() {
  const session = await auth();
  return session?.user ? session : null;
}

export async function POST(request: Request) {
  if (!(await requireSession())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    operation?: "upload" | "download";
    area?: unknown;
    filename?: unknown;
    contentType?: unknown;
    key?: unknown;
  };

  if (body.operation === "download") {
    if (!isStorageKey(body.key)) {
      return Response.json({ error: "A valid object key is required." }, { status: 400 });
    }

    return Response.json({ url: await createDownloadUrl(body.key) });
  }

  if (
    !isStorageArea(body.area) ||
    typeof body.filename !== "string" ||
    !body.filename.trim() ||
    body.filename.length > 255 ||
    typeof body.contentType !== "string" ||
    !allowedContentTypes.has(body.contentType)
  ) {
    return Response.json(
      { error: "A valid storage area, filename, and supported content type are required." },
      { status: 400 },
    );
  }

  return Response.json(
    await createUploadUrl({
      area: body.area,
      filename: body.filename,
      contentType: body.contentType,
    }),
  );
}

export async function DELETE(request: Request) {
  if (!(await requireSession())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = new URL(request.url).searchParams.get("key");

  if (!isStorageKey(key)) {
    return Response.json({ error: "A valid object key is required." }, { status: 400 });
  }

  await deleteObject(key);
  return Response.json({ success: true });
}
