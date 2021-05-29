import { Kind, ListTypeNode, NamedTypeNode, NonNullTypeNode, TypeNode } from 'graphql';
import type { DefinitionNode, OperationDefinitionNode } from 'graphql';

export function isOperationDefinitionNode(node: DefinitionNode): node is OperationDefinitionNode {
  return node.kind === Kind.OPERATION_DEFINITION;
}

export function isListTypeNode(node: TypeNode): node is ListTypeNode {
  return node.kind === Kind.LIST_TYPE;
}

export function isNonNullTypeNode(node: TypeNode): node is NonNullTypeNode {
  return node.kind === Kind.NON_NULL_TYPE;
}
