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
  const database = connectionStringUrl.pathname.slice(1); // Remove leading /
  const user = connectionStringUrl.username;
  const password = connectionStringUrl.password;

  // Configure SSL options for self-signed certificates
  let sslConfig: { rejectUnauthorized: boolean; ca?: string } | undefined;

  // Check if SSL is explicitly disabled
  const sslMode = connectionStringUrl.searchParams.get("sslmode");
  const sslDisabled = sslMode === "disable";

  // If we have a certificate, we should use SSL (unless explicitly disabled)
  if (sslCertBase64 && !sslDisabled) {
    const tempDir = tmpdir();

    // Decode and write certificate file
    const sslCertPath = join(tempDir, "certificate.crt");
    try {
      writeFileSync(sslCertPath, Buffer.from(sslCertBase64, "base64"));

      // Read the certificate content for the SSL config
      const certContent = readFileSync(sslCertPath, "utf-8");

      // Configure SSL to verify against the provided CA certificate
      // rejectUnauthorized: true means we verify the certificate against the CA
      // ca: the CA certificate content to verify against
      sslConfig = {
        rejectUnauthorized: true,
        ca: certContent,
      };
    } catch (error) {
      console.error("Failed to process SSL certificate:", error);
      throw new Error(
        "Failed to process SSL certificate. Please ensure sslCertBase64 contains a valid base64-encoded certificate.",
      );
    }
  } else if (!sslDisabled) {
    // SSL might be required by the server but no CA certificate provided
    // Check if this is a remote connection (not localhost)
    const isRemote =
      host !== "localhost" &&
      host !== "127.0.0.1" &&
      !host.startsWith("192.168.") &&
      !host.startsWith("10.");

    if (isRemote) {
      // For remote connections, SSL is typically required
      // Without a CA cert, this will fail with self-signed certificates
      console.warn(
        "Remote database connection detected but no CA certificate provided. Connection may fail with self-signed certificates. Please set sslCertBase64.",
      );
      // Don't set sslConfig - let it fail with a clear error
      // The user should provide the CA certificate
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
