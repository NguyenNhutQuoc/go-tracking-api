/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ObjectLiteral, Repository } from 'typeorm';
import { BaseRepositoryInterface } from '../../../../core/domain/repositories/base.repository.interface';
import {
  Pagination,
  PaginatedResult,
} from '../../../../core/domain/value-objects/pagination.value-object';

export abstract class BaseTypeormRepository<
  TypeormEntity extends ObjectLiteral,
  DomainEntity,
> implements BaseRepositoryInterface<DomainEntity>
{
  constructor(
    protected readonly repository: Repository<TypeormEntity>,
    protected readonly toEntity: (typeormEntity: TypeormEntity) => DomainEntity,
    protected readonly toTypeorm: (
      entity: Partial<DomainEntity>,
    ) => TypeormEntity,
  ) {}

  async findById(id: number): Promise<DomainEntity | null> {
    const typeormEntity = await this.repository.findOne({
      where: { id } as unknown as Parameters<
        typeof this.repository.findOne
      >[0]['where'],
    });
    return typeormEntity ? this.toEntity(typeormEntity) : null;
  }

  async findAll(): Promise<DomainEntity[]> {
    const typeormEntities = await this.repository.find();
    return typeormEntities.map((typeormEntity) => this.toEntity(typeormEntity));
  }

  async findAllPaginated(
    pagination: Pagination,
  ): Promise<PaginatedResult<DomainEntity>> {
    const [typeormEntities, totalItems] = await this.repository.findAndCount({
      skip: pagination.skip,
      take: pagination.limit,
    });

    const items = typeormEntities.map((typeormEntity) =>
      this.toEntity(typeormEntity),
    );
    return PaginatedResult.create(items, pagination, totalItems);
  }

  async create(data: Partial<DomainEntity>): Promise<DomainEntity> {
    const typeormEntity = this.toTypeorm(data);
    const savedTypeormEntity: TypeormEntity =
      await this.repository.save(typeormEntity);
    return this.toEntity(savedTypeormEntity);
  }

  async update(id: number, data: Partial<DomainEntity>): Promise<DomainEntity> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    await this.repository.update(id, this.toTypeorm(data) as any);
    const updatedTypeormEntity = await this.repository.findOne({
      where: { id } as any,
    });

    if (!updatedTypeormEntity) {
      throw new Error(`Entity with ID ${id} not found`);
    }

    return this.toEntity(updatedTypeormEntity);
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (
      result.affected !== undefined &&
      result.affected !== null &&
      result.affected > 0
    );
  }
}
