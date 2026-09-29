import { InfinityPaginationResponseDto } from "../dto/infinity-pagination-response.dto.js";
import { PaginationOptions } from "../types/PaginationOptions.js";


export const infinityPaginationSchema = <T>(
  data: T[],
  options: PaginationOptions,
): InfinityPaginationResponseDto<T> => {
  return {
    data,
    hasNextPage: data.length === options.limit,
  };
};