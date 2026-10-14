import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/lib/auth';

export default function ProfileScreen() {
  const { signOut } = useAuth();
  return (
    <Screen>
      <Button label="Log out" onPress={() => void signOut()} />
    </Screen>
  );
}
