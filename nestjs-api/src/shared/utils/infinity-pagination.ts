import { InfinityPaginationResponseDto } from "../dto/infinity-pagination-response.dto.js";
import { PaginationOptions } from "../types/PaginationOptions.js";


export const infinityPagination = <T>(
  data: T[],
  options: PaginationOptions,
): InfinityPaginationResponseDto<T> => {
  return {
    data,
    hasNextPage: data.length === options.limit,
  };
};