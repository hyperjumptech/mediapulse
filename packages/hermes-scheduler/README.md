# @workspace/hermes-scheduler

Shared scheduler logic for Hermes: due-schedule queries, execution (expand params, invoke agents, record runs), next-run computation, and data-source string parsing.

- **Consumers:** Hermes (dashboard uses `computeNextRunAt` for schedule CRUD) and hermes-worker (uses full API for the DataQueue `check_schedules` job).
- **Dependencies:** `@workspace/database`, `cron-parser`, `zod`. No HTTP client; callers pass an `InvokeAgentHttpClient` for agent invocation.

## Exports

- `getDueSchedules`, `executeSchedule`, `expandDataSources`, `expandSingleDataSource`
- `computeNextRunAt`, `ScheduleForNextRun`
- `isDataSourceString`, `parseDataSourceString`, `isAllowlisted`, `DataSourceParsed`
- `invokeAgent`, `AgentEndpointSchema`, `AgentEndpoint`, `InvokeAgentHttpClient`
