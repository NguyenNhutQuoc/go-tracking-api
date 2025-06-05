import { Type } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PaginationInput } from '../inputs/pagination.input';
import { BaseRepositoryInterface } from '../../../core/domain/repositories/base.repository.interface';
import { BaseMapper } from '../../../core/interfaces/mappers/base.mapper';
import { Pagination } from '../../../core/domain/value-objects/pagination.value-object';

export function BaseResolver<T, DTO, CreateInput, UpdateInput>(
  classRef: Type<T>,
  name: string,
): any {
  @Resolver({ isAbstract: true })
  abstract class BaseResolverHost {
    constructor(
      protected readonly repository: BaseRepositoryInterface<T>,
      protected readonly mapper: BaseMapper<T, DTO>,
    ) {}

    @Query(() => classRef, { name: `get${name}` })
    async findById(@Args('id', { type: () => ID }) id: number): Promise<T> {
      const entity = await this.repository.findById(id);
      if (!entity) {
        throw new Error(`${name} not found`);
      }
      return entity;
    }

    @Query(() => [classRef], { name: `getAll${name}s` })
    async findAll(): Promise<T[]> {
      return this.repository.findAll();
    }

    @Query(() => Object, { name: `getAllPaginated${name}s` })
    async findAllPaginated(
      @Args('pagination') paginationInput: PaginationInput,
    ): Promise<any> {
      const pagination = new Pagination(
        paginationInput.page,
        paginationInput.limit,
      );
      return this.repository.findAllPaginated(pagination);
    }

    @Mutation(() => classRef, { name: `create${name}` })
    async create(@Args('input') createInput: CreateInput): Promise<T> {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const entity = this.mapper.toDomain(createInput as any);
      return this.repository.create(entity);
    }

    @Mutation(() => classRef, { name: `update${name}` })
    async update(
      @Args('id', { type: () => ID }) id: number,
      @Args('input') updateInput: UpdateInput,
    ): Promise<T> {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const entity = this.mapper.toDomain(updateInput as any);
      return this.repository.update(id, entity);
    }

    @Mutation(() => Boolean, { name: `delete${name}` })
    async delete(@Args('id', { type: () => ID }) id: number): Promise<boolean> {
      return this.repository.delete(id);
    }
  }

  return BaseResolverHost;
}
