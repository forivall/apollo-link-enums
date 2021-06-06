import { ApolloLink, execute, gql, Observable } from '@apollo/client/core';
import { getOperationName } from '@apollo/client/utilities';
import { makeExecutableSchema } from '@graphql-tools/schema';

import EnumApolloLink from './EnumApolloLink';
import { EnumValueFormat } from './types';

enum ServerFruit {
  Apple = 'APPLE',
  BlueBerry = 'BLUE_BERRY',
  Peach = 'PEACH',
  GrapeFruit = 'GRAPE_FRUIT',
}

enum ClientFruit {
  Apple = 'Apple',
  BlueBerry = 'BlueBerry',
  Peach = 'Peach',
  GrapeFruit = 'GrapeFruit',
}

enum ServerHttpStatus {
  Ok = 200,
  BadRequest = 400,
  Forbidden = 403,
  InternalServerError = 500,
}

enum ClientHttpStatus {
  Ok = 'OK',
  BadRequest = 'BAD_REQUEST',
  Forbidden = 'FORBIDDEN',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
}

const fruitParser = (value: ServerFruit): ClientFruit => {
  switch (value) {
    case ServerFruit.Apple:
      return ClientFruit.Apple;
    case ServerFruit.BlueBerry:
      return ClientFruit.BlueBerry;
    case ServerFruit.GrapeFruit:
      return ClientFruit.GrapeFruit;
    case ServerFruit.Peach:
      return ClientFruit.Peach;
  }
};

const httpStatusParser = (value: ServerHttpStatus): ClientHttpStatus => {
  switch (value) {
    case ServerHttpStatus.Ok:
      return ClientHttpStatus.Ok;
    case ServerHttpStatus.BadRequest:
      return ClientHttpStatus.BadRequest;
    case ServerHttpStatus.Forbidden:
      return ClientHttpStatus.Forbidden;
    case ServerHttpStatus.InternalServerError:
      return ClientHttpStatus.InternalServerError;
  }
};

const typeDefs = gql`
  enum Fruit {
    Apple
    BlueBerry
    Peach
    GrapeFruit
  }

  enum HttpStatus {
    Ok
    BadReqeust
    Forbidden
    InternalServerError
  }

  type ShopList {
    fruits: [Fruit!]
    status: HttpStatus!
  }

  type Query {
    fruit(fruit: Fruit): Fruit
    shop: ShopList!
  }

  type Mutation {
    status: HttpStatus!
    anotherStatus: HttpStatus
  }
`;

const resolvers = {
  Query: {
    fruit: (_root: any, { fruit }: { fruit: ClientFruit | null }) => fruit,
    shop: (_root: any) => ({ fruits: [], status: ClientHttpStatus.Ok }),
  },
  Mutation: {
    status: (_root: any) => ClientHttpStatus.Ok,
    anotherStatus: (_root: any) => null,
  },
  ShopList: {
    fruits: (_root: any) => [],
    status: (_root: any) => ClientHttpStatus.Ok,
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const query = gql`
  query TestQuery($fruit: Fruit) {
    fruit(fruit: $fruit)
  }
`;

const fragmentQuery = gql`
  fragment FruitList on ShopList {
    fruits
  }

  query TestFragmentQuery {
    shop {
      ...FruitList
    }
  }
`;

const mutation = gql`
  mutation TestMutation {
    status
    anotherStatus
  }
`;

describe('The enums in the response should be transformed using parser', () => {
  it('works for query', (done) => {
    const request = {
      query,
      variables: {
        fruit: ServerFruit.BlueBerry,
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        fruit: ServerFruit.BlueBerry,
      },
    };

    const expectedResponse = {
      data: {
        fruit: ClientFruit.BlueBerry,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        parser: {
          Fruit: fruitParser,
          HttpStatus: httpStatusParser,
        },
      }),
      new ApolloLink(() => Observable.of(response)),
    ]);

    const observable = execute(link, request);

    observable.subscribe((value) => {
      expect(value).toEqual(expectedResponse);
      done();
    });

    expect.assertions(1);
  });

  it('works for mutation', (done) => {
    const request = {
      query: mutation,
      operationName: getOperationName(mutation) ?? undefined,
    };

    const response = {
      data: {
        status: ServerHttpStatus.Forbidden,
        anotherStatus: ServerHttpStatus.InternalServerError,
      },
    };

    const expectedResponse = {
      data: {
        status: ClientHttpStatus.Forbidden,
        anotherStatus: ClientHttpStatus.InternalServerError,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        parser: {
          Fruit: fruitParser,
          HttpStatus: httpStatusParser,
        },
      }),
      new ApolloLink(() => Observable.of(response)),
    ]);

    const observable = execute(link, request);

    observable.subscribe((value) => {
      expect(value).toEqual(expectedResponse);
      done();
    });

    expect.assertions(1);
  });

  it('works for null value', (done) => {
    const request = {
      query: mutation,
      operationName: getOperationName(mutation) ?? undefined,
    };

    const response = {
      data: {
        status: ServerHttpStatus.Forbidden,
        anotherStatus: null,
      },
    };

    const expectedResponse = {
      data: {
        status: ClientHttpStatus.Forbidden,
        anotherStatus: null,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        parser: {
          Fruit: fruitParser,
          HttpStatus: httpStatusParser,
        },
      }),
      new ApolloLink(() => Observable.of(response)),
    ]);

    const observable = execute(link, request);

    observable.subscribe((value) => {
      expect(value).toEqual(expectedResponse);
      done();
    });

    expect.assertions(1);
  });

  it('works for fragment', (done) => {
    const request = {
      query: fragmentQuery,
      operationName: getOperationName(fragmentQuery) ?? undefined,
    };

    const response = {
      data: {
        shop: {
          fruits: [ServerFruit.Apple, ServerFruit.GrapeFruit, ServerFruit.Peach],
        },
      },
    };

    const expectedResponse = {
      data: {
        shop: {
          fruits: [ClientFruit.Apple, ClientFruit.GrapeFruit, ClientFruit.Peach],
        },
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        parser: {
          Fruit: fruitParser,
          HttpStatus: httpStatusParser,
        },
      }),
      new ApolloLink(() => Observable.of(response)),
    ]);

    const observable = execute(link, request);

    observable.subscribe((value) => {
      expect(value).toEqual(expectedResponse);
      done();
    });

    expect.assertions(1);
  });

  it('using enum value map works', (done) => {
    const request = {
      query: fragmentQuery,
      operationName: getOperationName(fragmentQuery) ?? undefined,
    };

    const response = {
      data: {
        shop: {
          fruits: [ServerFruit.Apple, ServerFruit.GrapeFruit, ServerFruit.Peach],
        },
      },
    };

    const expectedResponse = {
      data: {
        shop: {
          fruits: [ClientFruit.Apple, ClientFruit.GrapeFruit, ClientFruit.Peach],
        },
      },
    };

    const valueMap = {
      Fruit: {
        [ClientFruit.Apple]: ServerFruit.Apple,
        [ClientFruit.BlueBerry]: ServerFruit.BlueBerry,
        [ClientFruit.GrapeFruit]: ServerFruit.GrapeFruit,
        [ClientFruit.Peach]: ServerFruit.Peach,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        enumValueMap: valueMap,
      }),
      new ApolloLink(() => Observable.of(response)),
    ]);

    const observable = execute(link, request);

    observable.subscribe((value) => {
      expect(value).toEqual(expectedResponse);
      done();
    });

    expect.assertions(1);
  });

  it('using value format works', (done) => {
    const request = {
      query: fragmentQuery,
      operationName: getOperationName(fragmentQuery) ?? undefined,
    };

    const response = {
      data: {
        shop: {
          fruits: [ServerFruit.Apple, ServerFruit.GrapeFruit, ServerFruit.Peach],
        },
      },
    };

    const expectedResponse = {
      data: {
        shop: {
          fruits: [ClientFruit.Apple, ClientFruit.GrapeFruit, ClientFruit.Peach],
        },
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        valueFormat: {
          client: EnumValueFormat.PascalCase,
          server: EnumValueFormat.ScreamingSnakeCase,
        },
      }),
      new ApolloLink(() => Observable.of(response)),
    ]);

    const observable = execute(link, request);

    observable.subscribe((value) => {
      expect(value).toEqual(expectedResponse);
      done();
    });

    expect.assertions(1);
  });
});
