import type { GraphQLSchema } from 'graphql';

export type EnumSerializeFn = (value: any) => string | null;
export type EnumValueMap = { [ClientValue: string]: string };

export interface EnumApolloLinkArgs {
  schema: GraphQLSchema;
  /* serialization options */
  serializer?: Record<string, EnumSerializeFn>;
  /* shorthand options */
  enumValueMap?: Record<string, EnumValueMap>;
}
