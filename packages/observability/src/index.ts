import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { Resource } from "@opentelemetry/resources";
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { logger } from "@workspace/logger";
import { env } from "@workspace/env";

/**
 * Initializes OpenTelemetry SDK for a Node.js service.
 * Should be called at the very beginning of the application entry point.
 * 
 * @param serviceName - The name of the service. Defaults to env.OTEL_SERVICE_NAME.
 * @returns The initialized NodeSDK instance.
 */
export function initNodeObservability(serviceName: string = env.OTEL_SERVICE_NAME ?? "mediapulse") {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: "0.0.1",
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // FS instrumentation is often too noisy
        "@opentelemetry/instrumentation-fs": {
          enabled: false,
        },
      }),
    ],
  });

  try {
    sdk.start();
    logger.info({ serviceName }, "OpenTelemetry SDK initialized");
  } catch (error) {
    logger.error({ error, serviceName }, "Failed to initialize OpenTelemetry SDK");
  }

  /**
   * Gracefully shuts down the OpenTelemetry SDK.
   */
  const shutdown = async () => {
    try {
      await sdk.shutdown();
      logger.info("OpenTelemetry SDK shut down successfully");
    } catch (error) {
      logger.error({ error }, "Error shutting down OpenTelemetry SDK");
    }
  };

  process.on("SIGTERM", () => {
    shutdown().finally(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    shutdown().finally(() => process.exit(0));
  });

  return sdk;
}
