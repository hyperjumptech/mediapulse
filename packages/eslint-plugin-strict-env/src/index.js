import { noProcessEnv } from "./rules/no-process-env.js";

const plugin = {
  rules: {
    "no-process-env": noProcessEnv,
  },
  configs: {
    recommended: {
      plugins: ["strict-env"],
      rules: {
        "strict-env/no-process-env": "error",
      },
    },
  },
};

export default plugin;
