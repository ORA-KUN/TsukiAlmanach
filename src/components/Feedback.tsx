import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSession } from '../lib/store.ts';

export function Feedback({ pageId }: { pageId: string }) {
  const { api } = useSession();
  const key = `almanach-vote-${pageId}`;
  const [vote, setVote] = useState<string | null>(null);
  useEffect(() => {
    try {
      setVote(localStorage.getItem(key));
    } catch {
      setVote(null);
    }
  }, [key]);
  const send = (up: boolean) => {
    if (vote) return;
    const v = up ? 'up' : 'down';
    setVote(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* rien */
    }
    api.vote(pageId, up).catch(() => {});
  };
  return (
    <div className="feedback">
      {vote ? (
        <p>{vote === 'up' ? 'Merci, ça fait plaisir !' : 'Merci, on va revoir cette page.'}</p>
      ) : (
        <>
          <p>Cette page t’a aidé ?</p>
          <button className="btn btn--ghost btn--sm" onClick={() => send(true)}>
            <ThumbsUp size={15} /> Oui
          </button>
          <button className="btn btn--ghost btn--sm" onClick={() => send(false)}>
            <ThumbsDown size={15} /> Pas vraiment
          </button>
        </>
      )}
    </div>
  );
}
