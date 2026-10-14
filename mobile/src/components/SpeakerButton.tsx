import { Turtle, Volume2 } from 'lucide-react-native';

import { errorMessage } from '@/lib/api';
import { phraseKey, playPhrase, SLOW_RATE, usePlayback } from '@/lib/audio';
import { colors } from '@/theme/theme';

import { IconButton } from './IconButton';

/** Plays a phrase through POST /tts (cached on the device after the first play). */
export function SpeakerButton({
  text,
  slow = false,
  label,
  onError,
  size = 40,
}: {
  text: string;
  slow?: boolean;
  label?: string;
  onError?: (message: string) => void;
  size?: number;
}) {
  const rate = slow ? SLOW_RATE : 1;
  const key = phraseKey(text.trim(), rate);
  const { loadingKey, playingKey } = usePlayback();
  const playing = playingKey === key;

  const play = () => {
    playPhrase(text, { rate }).catch((error: unknown) => {
      onError?.(errorMessage(error, "Couldn't play that phrase."));
    });
  };

  return (
    <IconButton
      icon={slow ? Turtle : Volume2}
      accessibilityLabel={label ?? (slow ? `Play slowly: ${text}` : `Play: ${text}`)}
      onPress={play}
      loading={loadingKey === key}
      variant={playing ? 'primary' : 'tinted'}
      size={size}
      iconSize={size >= 40 ? 20 : 18}
      color={playing ? '#FFFFFF' : colors.sky700}
      active={playing}
    />
  );
}
