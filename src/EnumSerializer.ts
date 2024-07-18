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

import type { EnumSerializeFn, EnumSerializerArgs, EnumValueFormats, EnumValueMap } from './types';
import { isListTypeNode, isNonNullTypeNode } from './util/NodeTypes';
import convertFn from './util/valueFormat';

const noopSerializeFn: EnumSerializeFn = (value) => value;

export default class EnumSerializer {
  private readonly schema: GraphQLSchema;

  private readonly serializer?: Record<string, EnumSerializeFn>;
  private readonly defaultSerializer: EnumSerializeFn = noopSerializeFn;

  private readonly enumValueMap?: Record<string, EnumValueMap>;
  private readonly valueFormat?: EnumValueFormats;

  constructor({ schema, serializer, enumValueMap, valueFormat }: EnumSerializerArgs) {
    this.schema = schema;
    this.serializer = serializer;

    this.enumValueMap = enumValueMap;
    this.valueFormat = valueFormat;
  }

  public serializeNode(value: any, node: TypeNode): any {
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
    return convertFn(valueFormat);
  }
}
