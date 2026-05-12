import type { Context } from "hono";
import type { HttpLoggerOptions } from "hono-pino";

import { pickHermesCorrelationHeadersForAccessLog } from "./pick-correlation-headers-for-access-log.js";

/**
 * `hono-pino` HTTP options that log method, path, optional Hermes correlation headers, and response status only
 * (no full header dumps).
 */
export const slimHonoPinoHttpLoggerOptions: HttpLoggerOptions = {
  onReqBindings: (c: Context) => {
    const correlation = pickHermesCorrelationHeadersForAccessLog(
      c.req.header(),
    );
    return {
      req: {
        method: c.req.method,
        url: c.req.path,
        ...(Object.keys(correlation).length > 0
          ? { headers: correlation }
          : {}),
      },
    };
  },
  onResBindings: (c: Context) => ({
    res: { status: c.res.status },
  }),
};
