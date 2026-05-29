import { FieldType } from '../../types';
import type { FieldRendererRegistry } from './types';
import InputRenderer from './renderers/InputRenderer';
import TextareaRenderer from './renderers/TextareaRenderer';
import RadioRenderer from './renderers/RadioRenderer';
import CheckboxRenderer from './renderers/CheckboxRenderer';
import SelectRenderer from './renderers/SelectRenderer';
import RatingRenderer from './renderers/RatingRenderer';
import SwitchRenderer from './renderers/SwitchRenderer';
import TitleRenderer from './renderers/TitleRenderer';

/** 内置字段渲染器注册表 */
const builtinRegistry: FieldRendererRegistry = {
  [FieldType.INPUT]: InputRenderer,
  [FieldType.TEXTAREA]: TextareaRenderer,
  [FieldType.RADIO]: RadioRenderer,
  [FieldType.CHECKBOX]: CheckboxRenderer,
  [FieldType.SELECT]: SelectRenderer,
  [FieldType.RATING]: RatingRenderer,
  [FieldType.SWITCH]: SwitchRenderer,
  [FieldType.TITLE]: TitleRenderer,
};

export default builtinRegistry;
