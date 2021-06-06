import { ApolloLink, Observable } from '@apollo/client/core';
import type { FetchResult, NextLink, Operation } from '@apollo/client/core';
import {
  getNullableType,
  isEnumType,
  isInputObjectType,
  isInputType,
  isListType,
  isNonNullType,
  isObjectType,
} from 'graphql';
import type {
  FieldNode,
  FragmentDefinitionNode,
  GraphQLInputType,
  GraphQLOutputType,
  GraphQLObjectType,
  GraphQLSchema,
  NamedTypeNode,
  SelectionNode,
  TypeNode,
} from 'graphql';
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

import { EnumValueFormat } from './types';
import type {
  EnumApolloLinkArgs,
  EnumSerializeFn,
  EnumParserFn,
  EnumValueFormats,
  EnumValueMap,
} from './types';
import {
  isFieldNode,
  isFragmentDefinitionNode,
  isListTypeNode,
  isNonNullTypeNode,
  isOperationDefinitionNode,
} from './util/nodeTypes';
import resolveFragments from './util/resolveFragments';

const noopSerializeFn: EnumSerializeFn = (value) => value;
const noopParserFn: EnumParserFn = (value) => value;

export default class EnumApolloLink extends ApolloLink {
  private readonly schema: GraphQLSchema;

  private readonly serializer?: Record<string, EnumSerializeFn>;
  private readonly defaultSerializer: EnumSerializeFn = noopSerializeFn;

  private readonly parser?: Record<string, EnumParserFn>;
  private readonly defaultParser: EnumParserFn = noopParserFn;

  private readonly enumValueMap?: Record<string, EnumValueMap>;
  private readonly valueFormat?: EnumValueFormats;

  constructor({ schema, serializer, parser, enumValueMap, valueFormat }: EnumApolloLinkArgs) {
    super();

    this.schema = schema;
    this.serializer = serializer;
    this.parser = parser;

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
            try {
              observer.next(this.pipeResult(operation, result));
            } catch (e) {
              observer.next({ errors: [...(result.errors ?? []), e] });
            }
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

  private pipeResult(operation: Operation, result: FetchResult): FetchResult {
    const data = result.data;

    if (isNil(data)) {
      return result;
    }

    const operationNode = operation.query.definitions.find(isOperationDefinitionNode);

    if (isNil(operationNode)) {
      return result;
    }

    const fragmentNodes = operation.query.definitions.filter(isFragmentDefinitionNode);

    const fragmentMap = fragmentNodes.reduce((acc, node) => {
      acc[node.name.value] = node;
      return acc;
    }, {} as Record<string, FragmentDefinitionNode>);

    const resolvedOperationNode = {
      ...operationNode,
      selectionSet: {
        ...operationNode.selectionSet,
        selections: resolveFragments(operationNode.selectionSet.selections, fragmentMap),
      },
    };

    const rootType = ((): GraphQLObjectType | null => {
      switch (resolvedOperationNode.operation) {
        case 'query':
          return this.schema.getQueryType() ?? null;
        case 'mutation':
          return this.schema.getMutationType() ?? null;
        case 'subscription':
          return this.schema.getSubscriptionType() ?? null;
      }
    })();

    if (isNil(rootType)) {
      return result;
    }

    const rootSelections = resolvedOperationNode.selectionSet.selections.filter(isFieldNode);
    const fieldMap = rootType.getFields();

    rootSelections.forEach((fieldNode: FieldNode) => {
      const key = fieldNode.alias?.value ?? fieldNode.name.value;
      const field = fieldMap[fieldNode.name.value];
      data[key] = this.parseType(data[key], field.type, fieldNode);
    }, data);

    return result;
  }

  private parseType(value: any, type: GraphQLOutputType, node: FieldNode): any {
    if (isNil(value)) {
      return value;
    }

    if (isNonNullType(type)) {
      return this.parseType(value, getNullableType(type), node);
    }

    if (isEnumType(type)) {
      return this.getParser(type.name)(value);
    }

    if (isListType(type)) {
      if (!Array.isArray(value)) {
        return value;
      }

      return value.map((item) => this.parseType(item, type.ofType, node));
    }

    if (isObjectType(type)) {
      node.selectionSet?.selections.forEach((selectionNode: SelectionNode) => {
        if (isFieldNode(selectionNode)) {
          const fieldMap = type.getFields();
          const key = selectionNode.alias?.value ?? selectionNode.name.value;
          const field = fieldMap[selectionNode.name.value];

          if (isNil(field)) {
            return value;
          }

          value[key] = this.parseType(value[key], field.type, selectionNode);

          return value;
        }
      });
      return value;
    }

    return value;
  }

  private getParser(enumName: string): EnumParserFn {
    return this.parser?.[enumName] ?? this.defaultParser;
  }
}
