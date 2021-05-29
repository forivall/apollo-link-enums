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
import { isNil, mapValues } from 'lodash';
import type { Subscription } from 'zen-observable-ts';

import { isListTypeNode, isNonNullTypeNode, isOperationDefinitionNode } from './util/NodeTypes';

export type EnumSerializeFn = (value: any) => string | null;

const noopSerializeFn: EnumSerializeFn = (value) => value;

export interface EnumApolloLinkArgs {
  schema: GraphQLSchema;
  /* serialization options */
  serializer?: Record<string, EnumSerializeFn>;
}

export default class EnumApolloLink extends ApolloLink {
  private readonly schema: GraphQLSchema;
  private readonly serializer?: Record<string, EnumSerializeFn>;
  private readonly defaultSerializer: EnumSerializeFn = noopSerializeFn;

  constructor({ schema, serializer }: EnumApolloLinkArgs) {
    super();

    this.schema = schema;
    this.serializer = serializer;
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
      return (this.serializer?.[type.name] ?? this.defaultSerializer)(value);
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
}
