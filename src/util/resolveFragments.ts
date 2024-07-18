import type { FragmentDefinitionNode, SelectionNode } from 'graphql';
import flatMap from 'lodash-es/flatMap';
import isNil from 'lodash-es/isNil';

import { isFieldNode, isInlineFragmentNode } from './NodeTypes';

function mapToFieldNodes(
  selections: readonly SelectionNode[],
  fragmentMap: Record<string, FragmentDefinitionNode>
): SelectionNode[] {
  return flatMap(selections, (node) => {
    if (isFieldNode(node)) {
      return [node];
    }

    if (isInlineFragmentNode(node)) {
      return node.selectionSet.selections;
    }

    const mappedFragmentNode = fragmentMap[node.name.value];
    if (isNil(mappedFragmentNode)) {
      return [];
    }

    return mappedFragmentNode.selectionSet.selections;
  });
}

export default function resolveFragments(
  selections: readonly SelectionNode[],
  fragmentMap: Record<string, FragmentDefinitionNode>
): SelectionNode[] {
  const mappedSelections = mapToFieldNodes(selections, fragmentMap);

  if (!mappedSelections.every(isFieldNode)) {
    return resolveFragments(mappedSelections, fragmentMap);
  }

  return mappedSelections.map((selectionNode) => {
    if (isNil(selectionNode.selectionSet)) {
      return selectionNode;
    }

    return {
      ...selectionNode,
      selectionSet: {
        ...selectionNode.selectionSet,
        selections: resolveFragments(selectionNode.selectionSet.selections, fragmentMap),
      },
    };
  });
}
