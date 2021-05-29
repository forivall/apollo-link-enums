import { ApolloLink, Observable } from '@apollo/client/core';
import type { FetchResult, NextLink, Operation } from '@apollo/client/core';
import type { Subscription } from 'zen-observable-ts';

export default class EnumApolloLink extends ApolloLink {
  public request(givenOperation: Operation, forward: NextLink): Observable<FetchResult> | null {
    return new Observable((observer) => {
      let sub: Subscription;

      try {
        sub = forward(givenOperation).subscribe({
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
}
