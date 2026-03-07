import { useRef, useState } from 'react';
import { TextInput, View, Pressable } from 'react-native';

type OtpInputProps = {
  length?: number;
  onComplete: (code: string) => void;
};

/**
 * Renders a customizable multi-cell OTP input that manages digit entry, paste handling, focus navigation, and automatic completion.
 *
 * @param length - Number of digits in the OTP (defaults to 6).
 * @param onComplete - Called with the full code string when all digits have been entered or pasted.
 * @returns A row of text inputs representing each OTP digit, with automatic focus movement, paste support, and backspace navigation.
 */
export default function OtpInput({ length = 6, onComplete }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    // Handle paste (multiple characters at once)
    if (text.length > 1) {
      const pasted = text.replace(/[^0-9]/g, '').slice(0, length);
      const newDigits = Array(length).fill('');
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
      }
      setDigits(newDigits);

      if (pasted.length === length) {
        inputs.current[length - 1]?.blur();
        onComplete(pasted);
      } else {
        inputs.current[pasted.length]?.focus();
      }
      return;
    }

    // Single digit entry
    const digit = text.replace(/[^0-9]/g, '');
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit only when filling the last empty slot (not on corrections)
    const hadEmpty = digits.some((d) => d === '');
    if (digit && hadEmpty && newDigits.every((d) => d !== '')) {
      onComplete(newDigits.join(''));
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace') {
      if (digits[index] === '' && index > 0) {
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
        inputs.current[index - 1]?.focus();
      } else {
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    }
  };

  return (
    <View className="flex-row justify-center gap-2">
      {digits.map((digit, index) => (
        <Pressable key={index} onPress={() => inputs.current[index]?.focus()}>
          <TextInput
            ref={(ref) => { inputs.current[index] = ref; }}
            className="w-12 h-14 border-2 border-gray-300 rounded-lg text-center text-xl font-bold focus:border-black"
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
            keyboardType="number-pad"
            maxLength={index === 0 ? length : 1}
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            selectTextOnFocus
          />
        </Pressable>
      ))}
    </View>
  );
}
