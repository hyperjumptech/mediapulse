import { RuleTester } from "eslint";
import plugin from "../../src/index.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
});

ruleTester.run("no-process-env", plugin.rules["no-process-env"], {
  valid: [
    {
      code: "const config = getConfig();",
    },
    {
      code: "const value = myConfig.apiKey;",
    },
    {
      code: "process.exit(0);",
    },
    {
      code: "process.cwd();",
    },
    {
      code: "const proc = process;",
    },
  ],
  invalid: [
    {
      code: "const apiKey = process.env.API_KEY;",
      output:
        "import { env } from '@workspace/env';\n\nconst apiKey = env.API_KEY;",
      errors: [{ messageId: "noProcessEnv" }],
    },
    {
      code: 'if (process.env.NODE_ENV === "production") {}',
      output:
        "import { env } from '@workspace/env';\n\nif (env.NODE_ENV === \"production\") {}",
      errors: [{ messageId: "noProcessEnv" }],
    },
    {
      code: "const env = process.env;",
      errors: [{ messageId: "noProcessEnv" }],
    },
    {
      code: "console.log(process.env.PORT);",
      output: "import { env } from '@workspace/env';\n\nconsole.log(env.PORT);",
      errors: [{ messageId: "noProcessEnv" }],
    },
    {
      code: "const port = process.env.PORT;",
      output: "import { env } from '@workspace/env';\n\nconst port = env.PORT;",
      errors: [{ messageId: "noProcessEnv" }],
    },
  ],
});

console.log("✓ All no-process-env tests passed!");
