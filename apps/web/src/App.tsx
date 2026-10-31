import { Navigate, Route, Routes } from 'react-router';
import { RequireAuth } from './lib/auth';
import { DiagramPage } from './pages/DiagramPage';
import { DiagramViewPage } from './pages/DiagramViewPage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { PlaygroundViewPage } from './pages/ViewPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/play" element={<PlaygroundPage />} />
      <Route path="/play/view" element={<PlaygroundViewPage />} />
      <Route path="/" element={<RequireAuth><LibraryPage /></RequireAuth>} />
      <Route path="/d/:id" element={<RequireAuth><DiagramPage /></RequireAuth>} />
      <Route path="/d/:id/view" element={<RequireAuth><DiagramViewPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
