/* eslint-disable @typescript-eslint/require-await */
import { Plugin } from '@nestjs/apollo';
import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import * as DataLoader from 'dataloader';

// Simplified interface - no loaders pre-defined
interface MyContext {
  req?: any;
  loaders?: {
    [key: string]: DataLoader<any, any>;
  };
}

@Plugin()
export class DataLoaderPlugin implements ApolloServerPlugin<MyContext> {
  async requestDidStart(): Promise<GraphQLRequestListener<MyContext>> {
    return {
      didResolveOperation: async (requestContext) => {
        // Initialize empty loaders object
        // Actual loaders will be created by services when needed
        if (!requestContext.contextValue.loaders) {
          requestContext.contextValue.loaders = {};
        }
      },
    };
  }
}
