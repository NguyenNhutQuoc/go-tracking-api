import {
  Pagination,
  PaginationMeta,
} from '../../domain/value-objects/pagination.value-object';

export class PaginationDto {
  page: number;
  limit: number;

  toValueObject(): Pagination {
    return new Pagination(this.page, this.limit);
  }
}

export class PaginationMetaDto {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  constructor(meta: PaginationMeta) {
    this.page = meta.page;
    this.limit = meta.limit;
    this.totalItems = meta.totalItems;
    this.totalPages = meta.totalPages;
    this.hasNextPage = meta.hasNextPage;
    this.hasPreviousPage = meta.hasPreviousPage;
  }
}

export class PaginatedResponseDto<T> {
  items: T[];
  meta: PaginationMetaDto;

  constructor(items: T[], meta: PaginationMetaDto) {
    this.items = items;
    this.meta = meta;
  }
}
