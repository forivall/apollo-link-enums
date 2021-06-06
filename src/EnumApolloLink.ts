import { ApolloLink, Observable } from '@apollo/client/core';
import type { FetchResult, NextLink, Operation } from '@apollo/client/core';
import {
  getNullableType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isListType,
  isNonNullType,
} from 'graphql';
import type { GraphQLInputType, GraphQLSchema, NamedTypeNode, TypeNode } from 'graphql';
import {
  camelCase,
  flow,
  isNil,
  kebabCase,
  mapValues,
  snakeCase,
  toUpper,
  upperFirst,
} from 'lodash';
import type { Subscription } from 'zen-observable-ts';

import {
  EnumApolloLinkArgs,
  EnumSerializeFn,
  EnumValueFormat,
  EnumValueFormats,
  EnumValueMap,
} from './types';
import { isListTypeNode, isNonNullTypeNode, isOperationDefinitionNode } from './util/NodeTypes';

const noopSerializeFn: EnumSerializeFn = (value) => value;

export default class EnumApolloLink extends ApolloLink {
  private readonly schema: GraphQLSchema;

  private readonly serializer?: Record<string, EnumSerializeFn>;
  private readonly defaultSerializer: EnumSerializeFn = noopSerializeFn;

  private readonly enumValueMap?: Record<string, EnumValueMap>;
  private readonly valueFormat?: EnumValueFormats;

  constructor({ schema, serializer, enumValueMap, valueFormat }: EnumApolloLinkArgs) {
    super();

    this.schema = schema;
    this.serializer = serializer;

    this.enumValueMap = enumValueMap;
    this.valueFormat = valueFormat;
  }

  public request(givenOperation: Operation, forward: NextLink): Observable<FetchResult> | null {
    const operation = this.pipeOperation(givenOperation);

    return new Observable((observer) => {
      let sub: Subscription;

      try {
        sub = forward(operation).subscribe({
          next: (result) => {
            observer.next(result);
          },
          error: observer.error.bind(observer),
          complete: observer.complete.bind(observer),
        });
      } catch (e) {
        observer.error(e);
      }

      return () => {
        sub?.unsubscribe();
      };
    });
  }

  private pipeOperation(operation: Operation): Operation {
    const variableDefinitions =
      operation.query.definitions.find(isOperationDefinitionNode)?.variableDefinitions ?? [];

    variableDefinitions.forEach((variableDefinition) => {
      const key = variableDefinition.variable.name.value;
      operation.variables[key] = this.serializeNode(
        operation.variables[key],
        variableDefinition.type
      );
    });

    return operation;
  }

  private serializeNode(value: any, node: TypeNode): any {
    if (isNonNullTypeNode(node)) {
      return this.serializeNode(value, node.type);
    }

    if (isListTypeNode(node)) {
      if (Array.isArray(value)) {
        return value.map((item) => this.serializeNode(item, node.type));
      }

      return value;
    }

    return this.serializeNamedTypeNode(value, node);
  }

  private serializeNamedTypeNode(value: any, node: NamedTypeNode): any {
    const typeName = node.name.value;
    const schemaType = this.schema.getType(typeName);

    if (!schemaType || !isInputType(schemaType)) {
      return value;
    }

    return this.serializeType(value, schemaType);
  }

  private serializeType(value: any, type: GraphQLInputType): any {
    if (isNil(value)) {
      return value;
    }

    if (isNonNullType(type)) {
      return this.serializeType(value, getNullableType(type));
    }

    if (isEnumType(type)) {
      return this.getSerializer(type.name)(value);
    }

    if (isListType(type)) {
      if (!Array.isArray(value)) {
        return value;
      }

      return value.map((item) => this.serializeType(item, type.ofType));
    }

    if (isInputObjectType(type)) {
      const fields = type.getFields();
      return mapValues(value, (item, key) => {
        const field = fields[key];
        return field ? this.serializeType(item, field.type) : item;
      });
    }

    return value;
  }

  private getSerializer(enumName: string): EnumSerializeFn {
    return (
      this.serializer?.[enumName] ??
      this.getSerializerFromValueMap(enumName) ??
      this.getSerializerFromValueFormat(enumName) ??
      this.defaultSerializer
    );
  }

  private getSerializerFromValueMap(enumName: string): EnumSerializeFn | undefined {
    if (!this.enumValueMap?.[enumName]) {
      return;
    }

    return (value: any) => {
      return this.enumValueMap?.[enumName]?.[value] ?? value;
    };
  }

  private getSerializerFromValueFormat(enumName: string): EnumSerializeFn | undefined {
    const valueFormat = this.valueFormat?.serverEnums?.[enumName] ?? this.valueFormat?.server;

    if (isNil(valueFormat)) {
      return;
    }

    switch (valueFormat) {
      case EnumValueFormat.CamelCase:
        return camelCase;
      case EnumValueFormat.PascalCase:
        return flow(camelCase, upperFirst);
      case EnumValueFormat.KebabCase:
        return kebabCase;
      case EnumValueFormat.SnakeCase:
        return snakeCase;
      case EnumValueFormat.ScreamingSnakeCase:
        return flow(snakeCase, toUpper);
      default:
        return noopSerializeFn;
    }
  }
}
