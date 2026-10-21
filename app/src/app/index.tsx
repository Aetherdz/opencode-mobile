import { Redirect } from 'expo-router';
import { useAuth } from '@/state/auth';

export default function Index() {
  const baseUrl = useAuth((state) => state.baseUrl);
  const token = useAuth((state) => state.token);
  return <Redirect href={baseUrl && token ? '/sessions' : '/connect'} />;
}
