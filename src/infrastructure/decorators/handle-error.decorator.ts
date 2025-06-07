import { GraphQLErrorUtil } from '../utils/graphql-error.util';

/**
 * Decorator tự động handle errors cho GraphQL resolvers
 */
export function HandleGraphQLErrors<T = unknown>(fallbackMessage?: string) {
  return function (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => Promise<T>>,
  ) {
    const method = descriptor.value as (...args: any[]) => Promise<T>;

    descriptor.value = async function (...args: any[]): Promise<T> {
      try {
        return (await method.apply(this, args)) as T;
      } catch (error) {
        // 🎯 TẬN DỤNG UTILITY để convert error
        throw GraphQLErrorUtil.convert(error, fallbackMessage);
      }
    };

    return descriptor;
  };
}
