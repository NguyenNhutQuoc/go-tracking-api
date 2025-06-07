import { ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { GraphQLError, GraphQLFormattedError } from 'graphql';

export const graphqlConfig: ApolloDriverConfig = {
  autoSchemaFile: join(process.cwd(), 'src/presentation/graphql/schema.gql'),
  sortSchema: true,
  playground: process.env.NODE_ENV !== 'production',
  introspection: process.env.NODE_ENV !== 'production',
  context: ({ req }: { req: Request }) => ({ req }),

  // 🎯 SIMPLIFIED: Chỉ cần passthrough vì errors đã được handle ở resolver
  formatError: (error: GraphQLError): GraphQLFormattedError => {
    // Log for monitoring
    console.log('📋 GraphQL Error:', {
      message: error.message,
      code: error.extensions?.code,
      category: error.extensions?.category,
      path: error.path,
    });

    // Return formatted error with all extensions
    return {
      message: error.message,
      path: error.path,
      extensions: {
        ...error.extensions,
        // Only include stacktrace in development
        ...(process.env.NODE_ENV === 'development' &&
        error.extensions?.stacktrace
          ? { stacktrace: error.extensions.stacktrace }
          : {}),
      },
    };
  },

  includeStacktraceInErrorResponses: process.env.NODE_ENV === 'development',
  fieldResolverEnhancers: ['guards', 'interceptors', 'filters'],
};
