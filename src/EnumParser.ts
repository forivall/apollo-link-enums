import { getNullableType, isEnumType, isListType, isNonNullType, isObjectType } from 'graphql';
import type {
  FieldNode,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLOutputType,
  OperationDefinitionNode,
  SelectionNode,
} from 'graphql';
import { fromPairs, isNil } from 'lodash';

import type { EnumParserArgs, EnumParserFn, EnumValueFormats, EnumValueMap } from './types';
import convertFn from './util/valueFormat';
import { isFieldNode } from './util/NodeTypes';

const noopParserFn: EnumParserFn = (value) => value;

export default class EnumParser {
  private readonly schema: GraphQLSchema;

  private readonly parser?: Record<string, EnumParserFn>;
  private readonly defaultParser: EnumParserFn = noopParserFn;

  private readonly enumValueMap?: Record<string, EnumValueMap>;
  private readonly valueFormat?: EnumValueFormats;

  constructor({ schema, parser, enumValueMap, valueFormat }: EnumParserArgs) {
    this.schema = schema;
    this.parser = parser;
    this.enumValueMap = enumValueMap;
    this.valueFormat = valueFormat;
  }

  public parseNode(value: any, node: OperationDefinitionNode): any {
    const rootType = this.getRootType(node);

    if (isNil(rootType)) {
      return value;
    }

    const rootSelections = node.selectionSet.selections.filter(isFieldNode);
    const fieldMap = rootType.getFields();

    rootSelections.forEach((fieldNode: FieldNode) => {
      const key = fieldNode.alias?.value ?? fieldNode.name.value;
      const field = fieldMap[fieldNode.name.value];
      value[key] = this.parseType(value[key], field.type, fieldNode);
    }, value);

    return value;
  }

  private getRootType(node: OperationDefinitionNode): GraphQLObjectType | null {
    switch (node.operation) {
      case 'query':
        return this.schema.getQueryType() ?? null;
      case 'mutation':
        return this.schema.getMutationType() ?? null;
      case 'subscription':
        return this.schema.getSubscriptionType() ?? null;
    }
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
    return (
      this.parser?.[enumName] ??
      this.getParserFromValueMap(enumName) ??
      this.getParserFromValueFormat(enumName) ??
      this.defaultParser
    );
  }

  private getParserFromValueMap(enumName: string): EnumParserFn | undefined {
    const map = this.enumValueMap?.[enumName];

    if (isNil(map)) {
      return;
    }

    const reversedMap = fromPairs(Object.keys(map).map((key) => [map[key], key]));

    return (value: any) => reversedMap[value];
  }

  private getParserFromValueFormat(enumName: string): EnumParserFn | undefined {
    const valueFormat = this.valueFormat?.clientEnums?.[enumName] ?? this.valueFormat?.client;
    return convertFn(valueFormat);
  }
}
