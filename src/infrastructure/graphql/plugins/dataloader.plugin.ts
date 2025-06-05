/* eslint-disable @typescript-eslint/require-await */
import { Plugin } from '@nestjs/apollo';
import { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import * as DataLoader from 'dataloader';

// Define your context type
interface MyContext {
  loaders?: {
    usersLoader: DataLoader<string, any>;
    locationsLoader: DataLoader<string, any>;
    trackingsLoader: DataLoader<string, any>;
  };
}

@Plugin()
export class DataLoaderPlugin implements ApolloServerPlugin<MyContext> {
  async requestDidStart(): Promise<GraphQLRequestListener<MyContext>> {
    // Create a new DataLoader for each request
    const loaders = {
      usersLoader: new DataLoader(async (keys: string[]) => {
        // Implementation would go here when actual business logic is added
        // This is a placeholder implementation
        return keys.map(() => ({}));
      }),
      locationsLoader: new DataLoader(async (keys: string[]) => {
        // Implementation would go here when actual business logic is added
        // This is a placeholder implementation
        return keys.map(() => ({}));
      }),
      trackingsLoader: new DataLoader(async (keys: string[]) => {
        // Implementation would go here when actual business logic is added
        // This is a placeholder implementation
        return keys.map(() => ({}));
      }),
    };

    return {
      didResolveOperation: async (requestContext) => {
        // Attach the DataLoader instances to the context
        requestContext.contextValue.loaders = loaders;
      },
    };
  }
}
