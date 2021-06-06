import { ApolloLink, execute, gql, Observable } from '@apollo/client/core';
import { getOperationName } from '@apollo/client/utilities';
import { makeExecutableSchema } from '@graphql-tools/schema';

import EnumApolloLink from './EnumApolloLink';
import { EnumValueFormat } from './types';

enum ServerAnimal {
  Dog = 'dog',
  Cat = 'cat',
  FancyCat = 'fancy-cat',
}

enum ClientAnimal {
  DOG = 'DOG',
  CAT = 'CAT',
  FANCY_CAT = 'FANCY_CAT',
}

enum ServerPerson {
  User = 'user',
  AnonymousUser = 'anonymousUser',
}

enum ClientPerson {
  User = 'User',
  AnonymousUser = 'AnonymousUser',
}

const typeDefs = gql`
  enum Animal {
    DOG
    CAT
    FANCY_CAT
  }

  enum Person {
    User
    AnonymousUser
  }

  input PersonInput {
    person: Person!
  }

  type Query {
    givenAnimal(animal: Animal): Animal
    givenAnimals(animals: [Animal]!): [Animal]!
    givenPersonOfInput(input: PersonInput!): Person
  }
`;

const resolvers = {
  Query: {
    givenAnimal: (_root: any, { animal }: { animal: ClientAnimal | null }) => animal,
    givenAnimals: (_root: any, { animals }: { animals: ClientAnimal[] | null }) => animals,
    givenPersonOfInput: (
      _root: any,
      { input: { person } }: { input: { person: ClientPerson | null } }
    ) => person,
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const query = gql`
  query TestQuery($animal: Animal, $animals: [Animal]!, $personInput: PersonInput!) {
    givenAnimal(animal: $animal)
    givenAnimals(animals: $animals)
    givenPerson(input: $personInput)
  }
`;

describe('The variables in the requests should be transformed', () => {
  it('verbose configuration per enum works', (done) => {
    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [ClientAnimal.DOG, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: ServerAnimal.Cat,
        givenAnimals: [ServerAnimal.Dog, ServerAnimal.FancyCat],
        person: ServerPerson.AnonymousUser,
      },
    };

    const serializer = {
      Animal: (animal: ClientAnimal) => {
        switch (animal) {
          case ClientAnimal.CAT:
            return ServerAnimal.Cat;
          case ClientAnimal.DOG:
            return ServerAnimal.Dog;
          case ClientAnimal.FANCY_CAT:
            return ServerAnimal.FancyCat;
        }
      },
      Person: (person: ClientPerson) => {
        switch (person) {
          case ClientPerson.User:
            return ServerPerson.User;
          case ClientPerson.AnonymousUser:
            return ServerPerson.AnonymousUser;
        }
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({ schema, serializer }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: ServerAnimal.Cat,
          animals: [ServerAnimal.Dog, ServerAnimal.FancyCat],
          personInput: { person: ServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('null value works', (done) => {
    const request = {
      query,
      variables: {
        animal: null,
        animals: [null, ClientAnimal.FANCY_CAT],
        personInput: { person: null },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: null,
        givenAnimals: [null, ServerAnimal.FancyCat],
        person: null,
      },
    };

    const serializer = {
      Animal: (animal: ClientAnimal) => {
        switch (animal) {
          case ClientAnimal.CAT:
            return ServerAnimal.Cat;
          case ClientAnimal.DOG:
            return ServerAnimal.Dog;
          case ClientAnimal.FANCY_CAT:
            return ServerAnimal.FancyCat;
        }
      },
      Person: (person: ClientPerson) => {
        switch (person) {
          case ClientPerson.User:
            return ServerPerson.User;
          case ClientPerson.AnonymousUser:
            return ServerPerson.AnonymousUser;
        }
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({ schema, serializer }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: null,
          animals: [null, ServerAnimal.FancyCat],
          personInput: { person: null },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('Using enum value map works', (done) => {
    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [null, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: ServerAnimal.Cat,
        givenAnimals: [null, ServerAnimal.FancyCat],
        person: ServerPerson.AnonymousUser,
      },
    };

    const valueMap = {
      Animal: {
        [ClientAnimal.DOG]: ServerAnimal.Dog,
        [ClientAnimal.CAT]: ServerAnimal.Cat,
        [ClientAnimal.FANCY_CAT]: ServerAnimal.FancyCat,
      },
      Person: {
        [ClientPerson.User]: ServerPerson.User,
        [ClientPerson.AnonymousUser]: ServerPerson.AnonymousUser,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({ schema, enumValueMap: valueMap }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: ServerAnimal.Cat,
          animals: [null, ServerAnimal.FancyCat],
          personInput: { person: ServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('camel case server value format', (done) => {
    enum CamelCaseServerAnimal {
      Dog = 'dog',
      Cat = 'cat',
      FancyCat = 'fancyCat',
    }

    enum CamelCaseServerPerson {
      User = 'user',
      AnonymousUser = 'anonymousUser',
    }

    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [ClientAnimal.DOG, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: CamelCaseServerAnimal.Cat,
        givenAnimals: [CamelCaseServerAnimal.Dog, CamelCaseServerAnimal.FancyCat],
        person: CamelCaseServerPerson.AnonymousUser,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        valueFormat: {
          client: EnumValueFormat.CamelCase,
          server: EnumValueFormat.CamelCase,
        },
      }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: CamelCaseServerAnimal.Cat,
          animals: [CamelCaseServerAnimal.Dog, CamelCaseServerAnimal.FancyCat],
          personInput: { person: CamelCaseServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('pascal case server value format', (done) => {
    enum PascalCaseServerAnimal {
      Dog = 'Dog',
      Cat = 'Cat',
      FancyCat = 'FancyCat',
    }

    enum PascalCaseServerPerson {
      User = 'User',
      AnonymousUser = 'AnonymousUser',
    }

    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [ClientAnimal.DOG, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: PascalCaseServerAnimal.Cat,
        givenAnimals: [PascalCaseServerAnimal.Dog, PascalCaseServerAnimal.FancyCat],
        person: PascalCaseServerPerson.AnonymousUser,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        valueFormat: {
          client: EnumValueFormat.CamelCase,
          server: EnumValueFormat.PascalCase,
        },
      }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: PascalCaseServerAnimal.Cat,
          animals: [PascalCaseServerAnimal.Dog, PascalCaseServerAnimal.FancyCat],
          personInput: { person: PascalCaseServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('kebab case server value format', (done) => {
    enum KebabCaseServerAnimal {
      Dog = 'dog',
      Cat = 'cat',
      FancyCat = 'fancy-cat',
    }

    enum KebabCaseServerPerson {
      User = 'user',
      AnonymousUser = 'anonymous-user',
    }

    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [ClientAnimal.DOG, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: KebabCaseServerAnimal.Cat,
        givenAnimals: [KebabCaseServerAnimal.Dog, KebabCaseServerAnimal.FancyCat],
        person: KebabCaseServerPerson.AnonymousUser,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        valueFormat: {
          client: EnumValueFormat.CamelCase,
          server: EnumValueFormat.KebabCase,
        },
      }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: KebabCaseServerAnimal.Cat,
          animals: [KebabCaseServerAnimal.Dog, KebabCaseServerAnimal.FancyCat],
          personInput: { person: KebabCaseServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('snake case server value format', (done) => {
    enum SnakeCaseServerAnimal {
      Dog = 'dog',
      Cat = 'cat',
      FancyCat = 'fancy_cat',
    }

    enum SnakeCaseServerPerson {
      User = 'user',
      AnonymousUser = 'anonymous_user',
    }

    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [ClientAnimal.DOG, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: SnakeCaseServerAnimal.Cat,
        givenAnimals: [SnakeCaseServerAnimal.Dog, SnakeCaseServerAnimal.FancyCat],
        person: SnakeCaseServerPerson.AnonymousUser,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        valueFormat: {
          client: EnumValueFormat.CamelCase,
          server: EnumValueFormat.SnakeCase,
        },
      }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: SnakeCaseServerAnimal.Cat,
          animals: [SnakeCaseServerAnimal.Dog, SnakeCaseServerAnimal.FancyCat],
          personInput: { person: SnakeCaseServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('screaming snake case server value format', (done) => {
    enum ScreamingSnakeCaseServerAnimal {
      Dog = 'DOG',
      Cat = 'CAT',
      FancyCat = 'FANCY_CAT',
    }

    enum ScreamingSnakeCaseServerPerson {
      User = 'USER',
      AnonymousUser = 'ANONYMOUS_USER',
    }

    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [ClientAnimal.DOG, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: ScreamingSnakeCaseServerAnimal.Cat,
        givenAnimals: [ScreamingSnakeCaseServerAnimal.Dog, ScreamingSnakeCaseServerAnimal.FancyCat],
        person: ScreamingSnakeCaseServerPerson.AnonymousUser,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        valueFormat: {
          client: EnumValueFormat.CamelCase,
          server: EnumValueFormat.ScreamingSnakeCase,
        },
      }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: ScreamingSnakeCaseServerAnimal.Cat,
          animals: [ScreamingSnakeCaseServerAnimal.Dog, ScreamingSnakeCaseServerAnimal.FancyCat],
          personInput: { person: ScreamingSnakeCaseServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });

  it('server value format per enum', (done) => {
    enum PascalCaseServerAnimal {
      Dog = 'Dog',
      Cat = 'Cat',
      FancyCat = 'FancyCat',
    }

    enum SnakeCaseServerPerson {
      User = 'user',
      AnonymousUser = 'anonymous_user',
    }

    const request = {
      query,
      variables: {
        animal: ClientAnimal.CAT,
        animals: [ClientAnimal.DOG, ClientAnimal.FANCY_CAT],
        personInput: { person: ClientPerson.AnonymousUser },
      },
      operationName: getOperationName(query) ?? undefined,
    };

    const response = {
      data: {
        givenAnimal: PascalCaseServerAnimal.Cat,
        givenAnimals: [PascalCaseServerAnimal.Dog, PascalCaseServerAnimal.FancyCat],
        person: SnakeCaseServerPerson.AnonymousUser,
      },
    };

    const link = ApolloLink.from([
      new EnumApolloLink({
        schema,
        valueFormat: {
          client: EnumValueFormat.CamelCase,
          server: EnumValueFormat.SnakeCase,
          serverEnums: {
            Animal: EnumValueFormat.PascalCase,
          },
        },
      }),
      new ApolloLink((operation) => {
        expect(operation.variables).toEqual({
          animal: PascalCaseServerAnimal.Cat,
          animals: [PascalCaseServerAnimal.Dog, PascalCaseServerAnimal.FancyCat],
          personInput: { person: SnakeCaseServerPerson.AnonymousUser },
        });

        return Observable.of(response);
      }),
    ]);

    const observable = execute(link, request);

    observable.subscribe(() => {
      done();
    });

    expect.assertions(1);
  });
});
