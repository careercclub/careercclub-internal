import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const storageAreas = [
  "uploads",
  "collaborator-photos",
  "design-assets",
  "task-attachments",
] as const;

export type StorageArea = (typeof storageAreas)[number];

type PresignUploadInput = {
  area: StorageArea;
  filename: string;
  contentType: string;
  expiresIn?: number;
};

function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or R2_BUCKET.");
  }

  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function createR2Client() {
  const config = getR2Config();

  return {
    bucket: config.bucket,
    client: new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    }),
  };
}

function sanitizeFilename(filename: string) {
  const normalized = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return normalized || "file";
}

export function isStorageArea(value: unknown): value is StorageArea {
  return typeof value === "string" && storageAreas.includes(value as StorageArea);
}

export function isStorageKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const area = value.split("/", 1)[0];
  return isStorageArea(area) && value.length <= 1024 && !value.includes("..") && !value.includes("\\");
}

export function createStorageKey(area: StorageArea, filename: string) {
  const date = new Date().toISOString().slice(0, 10);
  return `${area}/${date}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

export function getPublicObjectUrl(key: string) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/${key}` : null;
}

export async function createUploadUrl(input: PresignUploadInput) {
  const { client, bucket } = createR2Client();
  const key = createStorageKey(input.area, input.filename);
  const expiresIn = Math.min(Math.max(input.expiresIn ?? 600, 60), 3600);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
    }),
    { expiresIn },
  );

  return { key, url, publicUrl: getPublicObjectUrl(key), expiresIn };
}

export async function createDownloadUrl(key: string, expiresIn = 600) {
  const { client, bucket } = createR2Client();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: Math.min(Math.max(expiresIn, 60), 3600),
  });
}

export async function deleteObject(key: string) {
  const { client, bucket } = createR2Client();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
