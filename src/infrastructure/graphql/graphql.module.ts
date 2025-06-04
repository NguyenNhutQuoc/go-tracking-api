import { Module } from '@nestjs/common';
import { GraphQLModule as NestGraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';

import { DataLoaderPlugin } from './plugins/dataloader.plugin';
import { DateScalar } from './scalars/date.scalar';
import { CoordinatesScalar } from './scalars/coordinates.scalar';

@Module({
  imports: [
    NestGraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(
        process.cwd(),
        'src/presentation/graphql/schema.gql',
      ),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req }: { req: import('express').Request }) => ({ req }),
      plugins: [], // We'll register the DataLoaderPlugin as a provider
    }),
  ],
  providers: [
    DataLoaderPlugin,
    DateScalar,
    CoordinatesScalar,
    {
      provide: 'APOLLO_PLUGINS',
      useFactory: (dataLoaderPlugin: DataLoaderPlugin) => [dataLoaderPlugin],
      inject: [DataLoaderPlugin],
    },
  ],
  exports: [NestGraphQLModule],
})
export class GraphQLModule {}
