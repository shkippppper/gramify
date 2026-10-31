import { Navigate, Route, Routes } from 'react-router';
import { PlaygroundPage } from './pages/PlaygroundPage';
import { PlaygroundViewPage } from './pages/ViewPage';

export function App() {
  return (
    <Routes>
      <Route path="/play" element={<PlaygroundPage />} />
      <Route path="/play/view" element={<PlaygroundViewPage />} />
      <Route path="*" element={<Navigate to="/play" replace />} />
    </Routes>
  );
}
