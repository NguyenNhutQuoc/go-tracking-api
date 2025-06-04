export abstract class BaseMapper<Entity, Dto> {
  abstract toDto(entity: Entity): Dto;
  abstract toDomain(dto: Partial<Dto>): Entity;

  toDtoList(entities: Entity[]): Dto[] {
    return entities.map((entity) => this.toDto(entity));
  }

  toDomainList(dtos: Partial<Dto>[]): Entity[] {
    return dtos.map((dto) => this.toDomain(dto));
  }
}
