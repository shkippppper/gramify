import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { Toaster } from 'sonner';
import { App } from './App';
import { useTheme } from './lib/theme';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles.css';

// Monaco rejects pending work with a 'Canceled' error when an editor is disposed; it's harmless.
window.addEventListener('unhandledrejection', (e) => {
  if ((e.reason as Error | undefined)?.message === 'Canceled') e.preventDefault();
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, refetchOnWindowFocus: true, retry: 1 } },
});

function ThemedToaster() {
  const { dark } = useTheme();
  return <Toaster theme={dark ? 'dark' : 'light'} position="bottom-center" richColors closeButton />;
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
