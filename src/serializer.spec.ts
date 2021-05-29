import { ApolloLink, execute, gql, Observable } from '@apollo/client/core';
import { getOperationName } from '@apollo/client/utilities';
import { makeExecutableSchema } from '@graphql-tools/schema';

import EnumApolloLink from './EnumApolloLink';

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
});
