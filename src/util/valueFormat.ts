import { camelCase, flow, isNil, kebabCase, snakeCase, toUpper, upperFirst } from 'lodash';

import { EnumValueFormat } from '../types';

export default function convertFn(valueFormat?: EnumValueFormat) {
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
      return (value?: string) => value ?? '';
  }
}
