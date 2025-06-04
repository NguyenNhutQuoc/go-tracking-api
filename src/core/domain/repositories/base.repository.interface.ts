import {
  Pagination,
  PaginatedResult,
} from '../value-objects/pagination.value-object';

export interface BaseRepositoryInterface<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  findAllPaginated(pagination: Pagination): Promise<PaginatedResult<T>>;
  create(item: Partial<T>): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}
