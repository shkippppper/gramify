import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { App } from './App';
import { ApiError } from './lib/api';
import { useTheme } from './lib/theme';
import '@fontsource/nunito/800.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles.css';

// Monaco rejects pending work with a 'Canceled' error when an editor is disposed; it's harmless.
window.addEventListener('unhandledrejection', (e) => {
  if ((e.reason as Error | undefined)?.message === 'Canceled') e.preventDefault();
});

// If the session ends (signed out elsewhere, expired), any 401 marks us signed out;
// RequireAuth then redirects to /login?next=… instead of showing errors everywhere.
const onApiError = (e: unknown) => {
  if (e instanceof ApiError && e.status === 401) queryClient.setQueryData(['me'], null);
};
const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: onApiError }),
  mutationCache: new MutationCache({ onError: onApiError }),
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: true,
      retry: (count, e) => !(e instanceof ApiError && e.status < 500) && count < 1,
    },
  },
});

function ThemedToaster() {
  const { dark } = useTheme();
  return (
    <Toaster theme={dark ? 'dark' : 'light'} position="bottom-center" richColors closeButton />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <ThemedToaster />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
