import { z } from "zod";

export const createRequestValidator = <
  TBody extends z.ZodType,
  TParams extends z.ZodType,
  THeaders extends z.ZodType,
  TSearchParams extends z.ZodType,
  TUser,
>({
  body,
  params,
  headers,
  user,
  searchParams,
}: {
  body?: TBody;
  params?: TParams;
  headers?: THeaders;
  user?: TUser;
  searchParams?: TSearchParams;
}) => {
  return {
    body,
    params,
    headers,
    user,
    searchParams,
  };
};

export type AuthFunc<TUser> = (request: Request) => Promise<TUser>;

export type SuccessResponse<TResponse extends z.ZodType> = {
  status: true;
  statusCode: number;
  data: z.infer<TResponse>;
};

export type ErrorResponse = {
  status: false;
  statusCode: number;
  message: string;
};

export type HandlerResponse<TResponse extends z.ZodType> =
  | SuccessResponse<TResponse>
  | ErrorResponse;

export const successResponse = <TResponse extends z.ZodType>(
  statusCode: number,
  data: z.infer<TResponse>
): SuccessResponse<TResponse> => {
  return {
    status: true,
    statusCode,
    data,
  };
};

export const errorResponse = (
  statusCode: number,
  message: string
): ErrorResponse => {
  return {
    status: false,
    statusCode,
    message,
  };
};

type ExtractValidatorData<TValidator> = TValidator extends {
  body?: infer TBody;
  params?: infer TParams;
  headers?: infer THeaders;
  user?: infer TUser;
  searchParams?: infer TSearchParams;
}
  ? (TBody extends z.ZodType
      ? { body: z.infer<TBody> }
      : Record<string, never>) &
      (TParams extends z.ZodType
        ? { params: z.infer<TParams> }
        : Record<string, never>) &
      (THeaders extends z.ZodType
        ? { headers: z.infer<THeaders> }
        : Record<string, never>) &
      (TUser extends AuthFunc<infer TUserType>
        ? { user: TUserType }
        : Record<string, never>) &
      (TSearchParams extends z.ZodType
        ? { searchParams: z.infer<TSearchParams> }
        : Record<string, never>)
  : never;

export type HandlerFunc<
  TValidator extends ReturnType<typeof createRequestValidator>,
  TResponse extends z.ZodType,
> = (
  data: ExtractValidatorData<TValidator>
) => Promise<HandlerResponse<TResponse>>;
