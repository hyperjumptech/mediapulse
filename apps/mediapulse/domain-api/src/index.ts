import { createDomainApiServer } from "./http/create-hono-app";
import { registerWithHermes } from "./http/register-with-hermes";

const server = createDomainApiServer();
await registerWithHermes();

export default server;
