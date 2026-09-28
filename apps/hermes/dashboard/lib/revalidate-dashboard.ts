import { revalidatePath } from "next/cache";

type DashboardHandler = (
  ...handlerArguments: never[]
) => Promise<{ status: boolean }>;

export const revalidateDashboard = () => {
  revalidatePath("/dashboard", "layout");
};

export const withDashboardRevalidation = <Handler extends DashboardHandler>(
  handler: Handler,
): Handler => {
  const revalidatingHandler = async (
    ...handlerArguments: Parameters<Handler>
  ) => {
    const result = await handler(...handlerArguments);
    if (result.status === true) {
      revalidateDashboard();
    }

    return result;
  };

  return revalidatingHandler as Handler;
};
