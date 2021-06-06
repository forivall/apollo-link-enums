import { Kind } from 'graphql';
import type {
  DefinitionNode,
  FieldNode,
  FragmentDefinitionNode,
  InlineFragmentNode,
  ListTypeNode,
  NonNullTypeNode,
  OperationDefinitionNode,
  SelectionNode,
  TypeNode,
} from 'graphql';

export function isOperationDefinitionNode(node: DefinitionNode): node is OperationDefinitionNode {
  return node.kind === Kind.OPERATION_DEFINITION;
}

export function isFragmentDefinitionNode(node: DefinitionNode): node is FragmentDefinitionNode {
  return node.kind === Kind.FRAGMENT_DEFINITION;
}

export function isListTypeNode(node: TypeNode): node is ListTypeNode {
  return node.kind === Kind.LIST_TYPE;
}

export function isNonNullTypeNode(node: TypeNode): node is NonNullTypeNode {
  return node.kind === Kind.NON_NULL_TYPE;
}

export function isFieldNode(node: SelectionNode): node is FieldNode {
  return node.kind === Kind.FIELD;
}

export function isInlineFragmentNode(node: SelectionNode): node is InlineFragmentNode {
  return node.kind === Kind.INLINE_FRAGMENT;
}
