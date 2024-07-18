import { ApolloLink, Observable } from '@apollo/client/core';
import type { FetchResult, NextLink, Operation } from '@apollo/client/core';
import type { FragmentDefinitionNode, OperationDefinitionNode } from 'graphql';
import { fromPairs, isNil } from 'lodash';
import type { Subscription } from 'zen-observable-ts';

import EnumParser from './EnumParser';
import EnumSerializer from './EnumSerializer';
import type { EnumApolloLinkArgs } from './types';
import { isFragmentDefinitionNode, isOperationDefinitionNode } from './util/NodeTypes';
import resolveFragments from './util/resolveFragments';

export default class EnumApolloLink extends ApolloLink {
  private readonly serializer: EnumSerializer;

  private readonly parser: EnumParser;

  constructor({ schema, serializer, parser, enumValueMap, valueFormat }: EnumApolloLinkArgs) {
    super();

    this.serializer = new EnumSerializer({ schema, serializer, enumValueMap, valueFormat });
    this.parser = new EnumParser({ schema, parser, enumValueMap, valueFormat });
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
      operation.variables[key] = this.serializer.serializeNode(
        operation.variables[key],
        variableDefinition.type
      );
    });

    return operation;
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

    const resolvedOperationNode = this.resolveFragments(operationNode, fragmentNodes);

    const parsedData = this.parser.parseNode(data, resolvedOperationNode);

    return { ...result, data: parsedData };
  }

  private resolveFragments(
    definitionNode: OperationDefinitionNode,
    fragments: FragmentDefinitionNode[]
  ): OperationDefinitionNode {
    const fragmentMap = fromPairs(fragments.map((node) => [node.name.value, node]));

    const resolvedDefinitionNode = {
      ...definitionNode,
      selectionSet: {
        ...definitionNode.selectionSet,
        selections: resolveFragments(definitionNode.selectionSet.selections, fragmentMap),
      },
    };

    return resolvedDefinitionNode;
  }
}
