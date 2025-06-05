import {
  Pagination,
  PaginatedResult,
} from '../value-objects/pagination.value-object';

export interface BaseRepositoryInterface<T> {
  findById(id: number): Promise<T | null>;
  findAll(): Promise<T[]>;
  findAllPaginated(pagination: Pagination): Promise<PaginatedResult<T>>;
  create(item: Partial<T>): Promise<T>;
  update(id: number, item: Partial<T>): Promise<T>;
  delete(id: number): Promise<boolean>;
}
