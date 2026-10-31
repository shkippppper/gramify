import { useMutation } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { DiagramSession } from '../collab/session';
import { Button } from '../components/ui';
import { api } from '../lib/api';
import { useMe } from '../lib/auth';

/** Copies the playground diagram into the shared library (signed-in users only). */
export function SaveToLibraryButton({ session }: { session: DiagramSession }) {
  const me = useMe();
  const navigate = useNavigate();
  const save = useMutation({
    mutationFn: () => api.createDiagram({ title: 'Untitled diagram', code: session.code.toString(), config: session.config.toString() }),
    onSuccess: (d) => {
      toast.success('Saved to library');
      navigate(`/d/${d.id}`);
    },
    onError: (e) => toast.error((e as Error).message),
  });
  if (!me.data) return null;
  return (
    <Button size="sm" variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
      <Save size={14} /> Save to library
    </Button>
  );
}
