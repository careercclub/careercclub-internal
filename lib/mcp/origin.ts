import "server-only";
import { publicOrigin } from "./oauth-rules";

/** https://internal.ccclub.id in production (AUTH_URL), else the address the request came in on. */
export const originOf = (request: Request) => publicOrigin(request.headers, request.url, process.env.AUTH_URL || "");
