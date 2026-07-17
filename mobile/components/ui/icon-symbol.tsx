import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle, Platform } from 'react-native';

const MAPPING: Record<string, ComponentProps<typeof MaterialIcons>['name']> = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.down': 'expand-more',
  'chevron.up': 'expand-less',
  'book.fill': 'menu-book',
  'bubble.left.fill': 'chat-bubble',
  'bubble.left': 'chat-bubble-outline',
  'checkmark.circle.fill': 'check-circle',
  'checkmark.circle': 'check-circle-outline',
  'checkmark': 'check',
  'rectangle.stack.fill': 'collections',
  'rectangle.stack': 'collections-bookmark',
  'ellipsis.circle.fill': 'more-horiz',
  'plus': 'add',
  'doc.text': 'description',
  'doc.text.fill': 'description',
  'person.circle.fill': 'person-circle',
  'text.alignleft': 'format-align-left',
  'bell.fill': 'notifications',
  'arrow.right.square': 'exit-to-app',
  'sparkle': 'auto-awesome',
  'xmark': 'close',
  'xmark.circle.fill': 'cancel',
  'arrow.counterclockwise': 'refresh',
  'arrow.up': 'arrow-upward',
};

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: string;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  const mappedName = MAPPING[name];
  const iconName = mappedName || ('help-outline' as ComponentProps<typeof MaterialIcons>['name']);
  return <MaterialIcons color={color} size={size} name={iconName} style={style} />;
}
