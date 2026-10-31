import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { FullPageSpinner, RequireAuth } from './lib/auth';
import { LoginPage } from './pages/LoginPage';

// Code-split by page: the editor (Monaco) only loads when you open a diagram.
const LibraryPage = lazy(() =>
  import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })),
);
const DiagramPage = lazy(() =>
  import('./pages/DiagramPage').then((m) => ({ default: m.DiagramPage })),
);
const DiagramViewPage = lazy(() =>
  import('./pages/DiagramViewPage').then((m) => ({ default: m.DiagramViewPage })),
);
const PlaygroundPage = lazy(() =>
  import('./pages/PlaygroundPage').then((m) => ({ default: m.PlaygroundPage })),
);
const PlaygroundViewPage = lazy(() =>
  import('./pages/ViewPage').then((m) => ({ default: m.PlaygroundViewPage })),
);

export function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/play" element={<PlaygroundPage />} />
        <Route path="/play/view" element={<PlaygroundViewPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <LibraryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/d/:id"
          element={
            <RequireAuth>
              <DiagramPage />
            </RequireAuth>
          }
        />
        <Route
          path="/d/:id/view"
          element={
            <RequireAuth>
              <DiagramViewPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
