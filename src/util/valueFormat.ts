import camelCase from 'lodash-es/camelCase';
import isNil from 'lodash-es/isNil';
import kebabCase from 'lodash-es/kebabCase';
import snakeCase from 'lodash-es/snakeCase';
import toUpper from 'lodash-es/toUpper';
import upperFirst from 'lodash-es/upperFirst';

import { EnumValueFormat } from '../types';

export default function convertFn(valueFormat?: EnumValueFormat) {
  if (isNil(valueFormat)) {
    return;
  }

  switch (valueFormat) {
    case EnumValueFormat.CamelCase:
      return camelCase;
    case EnumValueFormat.PascalCase:
      return (value?: string) => upperFirst(camelCase(value));
    case EnumValueFormat.KebabCase:
      return kebabCase;
    case EnumValueFormat.SnakeCase:
      return snakeCase;
    case EnumValueFormat.ScreamingSnakeCase:
      return (value?: string) => toUpper(snakeCase(value));
    default:
      return (value?: string) => value ?? '';
  }
}
