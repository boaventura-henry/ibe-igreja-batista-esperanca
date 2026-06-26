export type ApiSuccessBody<TData> = {
  success: true;
  data: TData;
} & (TData extends object ? TData : Record<string, never>);

export type ApiErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponseBody<TData> = ApiSuccessBody<TData> | ApiErrorBody;
