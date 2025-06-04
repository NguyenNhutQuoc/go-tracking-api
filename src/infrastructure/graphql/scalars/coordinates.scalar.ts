import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { Coordinates } from '../../../core/domain/value-objects/coordinates.value-object';

@Scalar('Coordinates', () => Coordinates)
export class CoordinatesScalar implements CustomScalar<string, Coordinates> {
  description = 'Coordinates custom scalar type';

  parseValue(value: string): Coordinates {
    const [latStr, lngStr] = value.split(',');
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lngStr);

    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error(
        'Invalid coordinates format. Expected format: "latitude,longitude"',
      );
    }

    return new Coordinates(latitude, longitude);
  }

  serialize(value: Coordinates): string {
    if (
      !value ||
      typeof value.latitude !== 'number' ||
      typeof value.longitude !== 'number'
    ) {
      throw new Error('Invalid coordinates object');
    }

    return `${value.latitude},${value.longitude}`;
  }

  parseLiteral(ast: ValueNode): Coordinates {
    if (ast.kind === Kind.STRING) {
      const [latStr, lngStr] = ast.value.split(',');
      const latitude = parseFloat(latStr);
      const longitude = parseFloat(lngStr);

      if (isNaN(latitude) || isNaN(longitude)) {
        throw new Error(
          'Invalid coordinates format. Expected format: "latitude,longitude"',
        );
      }

      return new Coordinates(latitude, longitude);
    }
    throw new Error('Invalid AST kind for Coordinates scalar');
  }
}
