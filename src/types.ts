import type { GraphQLSchema } from 'graphql';

export type EnumSerializeFn = (value: any) => string | null;
export type EnumValueMap = { [ClientValue: string]: string };

export enum EnumValueFormat {
  CamelCase,
  PascalCase,
  SnakeCase,
  ScreamingSnakeCase,
  KebabCase,
}

export interface EnumValueFormats {
  client: EnumValueFormat;
  clientEnums?: Record<string, EnumValueFormat>;
  server: EnumValueFormat;
  serverEnums?: Record<string, EnumValueFormat>;
}

export interface EnumApolloLinkArgs {
  schema: GraphQLSchema;
  /* serialization options */
  serializer?: Record<string, EnumSerializeFn>;
  /* shorthand options */
  enumValueMap?: Record<string, EnumValueMap>;
  valueFormat?: EnumValueFormats;
}
