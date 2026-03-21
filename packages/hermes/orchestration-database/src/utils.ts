import { readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export const getDatabaseParams = (
  connectionString: string,
  sslCertBase64?: string,
) => {
  const connectionStringUrl = new URL(connectionString);
  const schema = connectionStringUrl.searchParams.get("schema") || "public";

  // Parse connection details from URL
  const host = connectionStringUrl.hostname;
  const port = parseInt(connectionStringUrl.port || "5432", 10);
  const database = connectionStringUrl.pathname.slice(1);
  const user = connectionStringUrl.username;
  const password = connectionStringUrl.password;

  let sslConfig: { rejectUnauthorized: boolean; ca?: string } | undefined;
  const sslMode = connectionStringUrl.searchParams.get("sslmode");
  const sslDisabled = sslMode === "disable";

  if (sslCertBase64 && !sslDisabled) {
    const tempDir = tmpdir();
    const sslCertPath = join(tempDir, "certificate.crt");

    try {
      writeFileSync(sslCertPath, Buffer.from(sslCertBase64, "base64"));
      const certContent = readFileSync(sslCertPath, "utf-8");
      sslConfig = {
        rejectUnauthorized: true,
        ca: certContent,
      };
    } catch {
      throw new Error(
        "Failed to process SSL certificate. Please ensure sslCertBase64 contains a valid base64-encoded certificate.",
      );
    }
  } else if (!sslDisabled) {
    const isRemote =
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      !host.startsWith("192.168.") &&
      !host.startsWith("10.");

    if (isRemote) {
      console.warn(
        "Remote database connection detected but no CA certificate provided. Connection may fail with self-signed certificates. Please set sslCertBase64.",
      );
    }
  }

  return {
    host,
    port,
    database,
    user,
    password,
    ssl: sslConfig,
    schema,
  };
};
