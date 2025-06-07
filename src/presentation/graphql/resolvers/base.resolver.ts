import { Type } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { PaginationInput } from '../inputs/pagination.input';
import { BaseRepositoryInterface } from '../../../core/domain/repositories/base.repository.interface';
import { BaseMapper } from '../../../core/interfaces/mappers/base.mapper';
import { Pagination } from '../../../core/domain/value-objects/pagination.value-object';
import { HandleGraphQLErrors } from '../../../infrastructure/decorators/handle-error.decorator';
import { GraphQLErrorUtil } from '../../../infrastructure/utils/graphql-error.util';
import { ErrorCode } from '../../../core/errors/error-codes.enum';

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
    @HandleGraphQLErrors(`Không tìm thấy ${name.toLowerCase()}`)
    async findById(@Args('id', { type: () => ID }) id: number): Promise<T> {
      const entity = await this.repository.findById(id);
      if (!entity) {
        // 🎯 TẬN DỤNG ERROR CODE ENUM
        throw GraphQLErrorUtil.fromErrorCode(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Không tìm thấy ${name.toLowerCase()}`,
          'id',
          { id, resourceType: name },
        );
      }
      return entity;
    }

    @Query(() => [classRef], { name: `getAll${name}s` })
    @HandleGraphQLErrors(`Không thể tải danh sách ${name.toLowerCase()}`)
    async findAll(): Promise<T[]> {
      return this.repository.findAll();
    }

    @Query(() => Object, { name: `getAllPaginated${name}s` })
    @HandleGraphQLErrors(`Không thể tải danh sách ${name.toLowerCase()}`)
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
    @HandleGraphQLErrors(`Không thể tạo ${name.toLowerCase()}`)
    async create(@Args('input') createInput: CreateInput): Promise<T> {
      const entity = this.mapper.toDomain(createInput as any);
      return this.repository.create(entity);
    }

    @Mutation(() => classRef, { name: `update${name}` })
    @HandleGraphQLErrors(`Không thể cập nhật ${name.toLowerCase()}`)
    async update(
      @Args('id', { type: () => ID }) id: number,
      @Args('input') updateInput: UpdateInput,
    ): Promise<T> {
      const entity = this.mapper.toDomain(updateInput as any);
      return this.repository.update(id, entity);
    }

    @Mutation(() => Boolean, { name: `delete${name}` })
    @HandleGraphQLErrors(`Không thể xóa ${name.toLowerCase()}`)
    async delete(@Args('id', { type: () => ID }) id: number): Promise<boolean> {
      return this.repository.delete(id);
    }
  }

  return BaseResolverHost;
}
