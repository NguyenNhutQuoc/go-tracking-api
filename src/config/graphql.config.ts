import { ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { DataLoaderPlugin } from '../infrastructure/graphql/plugins/dataloader.plugin';
import { DateScalar } from '../infrastructure/graphql/scalars/date.scalar';
import { CoordinatesScalar } from '../infrastructure/graphql/scalars/coordinates.scalar';

export const graphqlConfig: ApolloDriverConfig = {
  autoSchemaFile: join(process.cwd(), 'src/presentation/graphql/schema.gql'),
  sortSchema: true,
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  context: ({ req }: { req: Request }) => ({ req }),
  plugins: [new DataLoaderPlugin()],
  resolvers: {
    Date: DateScalar,
    Coordinates: CoordinatesScalar,
  },
  formatError: (error) => {
    // Custom error formatting if needed
    const graphQLFormattedError = {
      message: error.message,
      path: error.path,
      extensions: {
        code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
        stacktrace:
          process.env.NODE_ENV === 'development'
            ? error.extensions?.stacktrace
            : undefined,
      },
    };
    return graphQLFormattedError;
  },
};
