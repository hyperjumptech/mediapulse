import { describe, it } from "vitest";
import { RuleTester } from "eslint";
import plugin from "../../src/index.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
});

describe("no-process-env", () => {
  it("enforces no process.env usage via ESLint RuleTester", () => {
    ruleTester.run("no-process-env", plugin.rules["no-process-env"], {
      valid: [
        { code: "const config = getConfig();" },
        { code: "const value = myConfig.apiKey;" },
        { code: "process.exit(0);" },
        { code: "process.cwd();" },
        { code: "const proc = process;" },
        {
          code: "import { env } from '@hermes/env'; const x = env.API_KEY;",
        },
        {
          code: "import { env } from '@mediapulse/env'; const x = env.API_KEY;",
        },
      ],
      invalid: [
        {
          code: "const apiKey = process.env.API_KEY;",
          output:
            "import { env } from '@hermes/env';\n\nconst apiKey = env.API_KEY;",
          options: [{ envPaths: ["@hermes/env"] }],
          errors: [{ messageId: "noProcessEnv" }],
        },
        {
          code: 'if (process.env.NODE_ENV === "production") {}',
          output:
            "import { env } from '@hermes/env';\n\nif (env.NODE_ENV === \"production\") {}",
          options: [{ envPaths: ["@hermes/env"] }],
          errors: [{ messageId: "noProcessEnv" }],
        },
        {
          code: "const env = process.env;",
          errors: [{ messageId: "noProcessEnv" }],
        },
        {
          code: "console.log(process.env.PORT);",
          output:
            "import { env } from '@hermes/env';\n\nconsole.log(env.PORT);",
          options: [{ envPaths: ["@hermes/env"] }],
          errors: [{ messageId: "noProcessEnv" }],
        },
        {
          code: "const port = process.env.PORT;",
          output:
            "import { env } from '@hermes/env';\n\nconst port = env.PORT;",
          options: [{ envPaths: ["@hermes/env"] }],
          errors: [{ messageId: "noProcessEnv" }],
        },
      ],
    });
  });
});
