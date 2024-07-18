# @forivall/apollo-link-enums

This is a custom apollo link, inspired by [apollo-link-scalars](https://github.com/eturino/apollo-link-scalars).

## Why should we use this?

GraphQL enums are designed to be known both to client and server. Once we define an enum at the schema, client and server can communicate wihtout concerning the programmer what the actual value of enum is.

However, [apollo-link-rest](https://www.apollographql.com/docs/react/api/link/apollo-link-rest/) allows an Apollo Client to communicate with server which is not aware of GraphQL or the schema. The client defines the schema in this case. The server can express enums in its own convention, hence the client is required to parse and convert the enums into a form compatible with Apollo Client. By default, the serialized value of the enum should be equal to its definition. This library allows to configure how the client would parse the enums.
