import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["postgres"],
  // The Claude connector's consent screen and sign-in must not be shown inside another site's
  // frame (a hidden "Allow Claude" click), Putaran 62.
  async headers() {
    const noFrames = [{ key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }];
    return [{ source: "/oauth/:path*", headers: noFrames }, { source: "/sign-in", headers: noFrames }];
  },
};

export default nextConfig;
