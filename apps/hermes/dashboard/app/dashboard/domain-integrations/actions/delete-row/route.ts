import {
  handler,
  requestValidator,
  responseValidator,
} from "./route.post.config";
import { createHermesDashboardRoute } from "@/lib/hermes-dashboard-route-process";

export const POST = createHermesDashboardRoute(
  requestValidator,
  responseValidator,
  handler,
);
