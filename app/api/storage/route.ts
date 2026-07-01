import { auth } from "@/auth";
import {
  createDownloadUrl,
  createUploadUrl,
  deleteObject,
  isStorageArea,
  isStorageKey,
} from "@/lib/storage/r2";

// Documents/archives allowed for attachments. Images are allowed by the
// `image/*` prefix below so the server matches what the upload UIs accept
// (design assets, collaborator photos, and ticket attachments all pass the
// browser's raw file.type, e.g. image/heic from iPhones or office documents).
const allowedDocumentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
  "application/zip",
]);

function isAllowedContentType(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("image/") || allowedDocumentTypes.has(value))
  );
}

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
    !isAllowedContentType(body.contentType)
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
