export class Pagination {
  page: number;
  limit: number;
  skip: number;

  constructor(page: number = 1, limit: number = 10) {
    this.page = page < 1 ? 1 : page;
    this.limit = limit < 1 ? 10 : limit;
    this.skip = (this.page - 1) * this.limit;
  }
}

export class PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;

  constructor(pagination: Pagination, totalItems: number) {
    this.page = pagination.page;
    this.limit = pagination.limit;
    this.totalItems = totalItems;
    this.totalPages = Math.ceil(totalItems / pagination.limit);
    this.hasNextPage = pagination.page < this.totalPages;
    this.hasPreviousPage = pagination.page > 1;
  }
}

export class PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;

  constructor(items: T[], meta: PaginationMeta) {
    this.items = items;
    this.meta = meta;
  }

  static create<T>(
    items: T[],
    pagination: Pagination,
    totalItems: number,
  ): PaginatedResult<T> {
    const meta = new PaginationMeta(pagination, totalItems);
    return new PaginatedResult<T>(items, meta);
  }
}
