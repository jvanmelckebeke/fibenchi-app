import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/** A row of mutually exclusive choices, for the Board's and Movers' toggles. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  return (
    <View className={cn('flex-row rounded-lg bg-muted p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            className={cn('rounded-md px-2.5 py-1', active && 'bg-card')}>
            <Text
              className={cn(
                'text-xs',
                active ? 'font-semibold text-foreground' : 'text-muted-foreground'
              )}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
