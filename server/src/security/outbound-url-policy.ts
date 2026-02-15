import { Injectable } from "@nestjs/common";
import * as dns from "dns/promises";
import * as net from "net";

interface AssertUrlOptions {
  allowHttpInDev?: boolean;
  allowPrivateInDev?: boolean;
  context?: string;
}

@Injectable()
export class OutboundUrlPolicy {
  private readonly allowedHosts = this.parseList(
    process.env.OUTBOUND_ALLOWED_HOSTS,
  );
  private readonly enforceHttps = this.readBoolean(
    process.env.OUTBOUND_ENFORCE_HTTPS,
    true,
  );
  private readonly blockPrivateIps = this.readBoolean(
    process.env.OUTBOUND_BLOCK_PRIVATE_IPS,
    true,
  );
  private readonly allowCleartextDev = this.readBoolean(
    process.env.AXON_ALLOW_CLEARTEXT_DEV,
    false,
  );

  async assertAllowedUrl(
    rawUrl: string,
    options?: AssertUrlOptions,
  ): Promise<URL> {
    const parsed = this.assertAllowedUrlSync(rawUrl, options);

    const isDev = process.env.NODE_ENV !== "production";
    const allowPrivateForThisCall =
      isDev && options?.allowPrivateInDev === true;

    if (!this.blockPrivateIps || allowPrivateForThisCall) {
      return parsed;
    }

    const host = parsed.hostname.toLowerCase();
    const resolved = await dns.lookup(host, { all: true, verbatim: true });
    for (const record of resolved) {
      if (this.isPrivateIp(record.address)) {
        throw new Error(
          `${this.formatContext(options?.context)}Host resolves to private IP`,
        );
      }
    }

    return parsed;
  }

  assertAllowedUrlSync(rawUrl: string, options?: AssertUrlOptions): URL {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new Error(
        `${this.formatContext(options?.context)}Invalid URL: ${rawUrl}`,
      );
    }

    const isDev = process.env.NODE_ENV !== "production";
    const allowHttpForThisCall =
      isDev && this.allowCleartextDev && options?.allowHttpInDev === true;
    const allowPrivateForThisCall =
      isDev && options?.allowPrivateInDev === true;

    if (
      this.enforceHttps &&
      parsed.protocol !== "https:" &&
      !allowHttpForThisCall
    ) {
      throw new Error(
        `${this.formatContext(options?.context)}Only https URLs are allowed`,
      );
    }

    const host = parsed.hostname.toLowerCase();
    if (this.allowedHosts.length > 0 && !this.matchesAllowedHost(host)) {
      throw new Error(
        `${this.formatContext(options?.context)}Host is not in allowlist: ${host}`,
      );
    }

    if (!this.blockPrivateIps || allowPrivateForThisCall) {
      return parsed;
    }

    if (host === "localhost" || host.endsWith(".localhost")) {
      throw new Error(
        `${this.formatContext(options?.context)}Private host is not allowed: ${host}`,
      );
    }

    if (net.isIP(host) && this.isPrivateIp(host)) {
      throw new Error(
        `${this.formatContext(options?.context)}Private IP is not allowed: ${host}`,
      );
    }
    return parsed;
  }

  private matchesAllowedHost(host: string): boolean {
    return this.allowedHosts.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`),
    );
  }

  private isPrivateIp(ip: string): boolean {
    if (net.isIPv4(ip)) {
      const [a = 0, b = 0, c = 0] = ip.split(".").map((part) => Number(part));
      if (a === 0) return true;
      if (a === 10) return true;
      if (a === 127) return true;
      if (a === 169 && b === 254) return true;
      if (a === 172 && b >= 16 && b <= 31) return true;
      if (a === 192 && b === 168) return true;
      if (a === 192 && b === 0 && c === 0) return true;
      if (a === 100 && b >= 64 && b <= 127) return true;
      if (a === 198 && (b === 18 || b === 19)) return true;
      return false;
    }

    if (net.isIPv6(ip)) {
      const normalized = ip.toLowerCase();
      if (normalized === "::1") return true;
      if (normalized.startsWith("fc") || normalized.startsWith("fd"))
        return true;
      if (normalized.startsWith("fe80")) return true;
      return false;
    }

    return true;
  }

  private parseList(rawValue?: string): string[] {
    if (!rawValue) return [];
    return rawValue
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }

  private readBoolean(
    rawValue: string | undefined,
    defaultValue: boolean,
  ): boolean {
    if (rawValue === undefined) return defaultValue;
    return rawValue.toLowerCase() === "true";
  }

  private formatContext(context?: string): string {
    if (!context) return "";
    return `${context}: `;
  }
}
