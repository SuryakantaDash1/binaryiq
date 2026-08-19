'use client';

import { Alert, Button, Modal, SpinWheel } from '@influencer/ui';
import { useCallback, useState } from 'react';

import { ApiError } from '@/lib/api/client';
import { gamesApi, type GameDetail, type SpinResult } from '@/lib/api/games';

interface SpinWheelIslandProps {
  game: GameDetail;
}

export function SpinWheelIsland({ game }: SpinWheelIslandProps): React.JSX.Element {
  const [spinning, setSpinning] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alreadySpun, setAlreadySpun] = useState(game.playedToday);
  const [showModal, setShowModal] = useState(false);

  const handleSpin = useCallback(async () => {
    if (spinning || animating || alreadySpun) return;
    setError(null);
    setSpinning(true);
    try {
      const res = await gamesApi.spin(game.id);
      setResult(res);
      setAnimating(true);
    } catch (err) {
      setSpinning(false);
      if (err instanceof ApiError && (err.message === 'already_spun_today' || err.status === 409)) {
        setAlreadySpun(true);
      } else {
        setError(err instanceof ApiError ? err.message : 'Spin failed. Please try again.');
      }
    }
  }, [spinning, animating, alreadySpun, game.id]);

  const handleAnimationEnd = useCallback(async () => {
    setSpinning(false);
    setAnimating(false);
    setAlreadySpun(true);
    setShowModal(true);
    if (result && result.pointsWon > 0 && typeof window !== 'undefined') {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (!mq.matches) {
        try {
          const confettiFn = (await import('canvas-confetti')).default;
          void confettiFn({ particleCount: 120, spread: 70, origin: { y: 0.5 } });
        } catch {
          // confetti not critical
        }
      }
    }
  }, [result]);

  if (alreadySpun && !spinning && !animating) {
    return (
      <div className="flex flex-col items-center gap-6">
        <SpinWheel segments={game.segments} />
        <div className="text-center">
          <p className="text-text font-semibold">Come back tomorrow to spin again!</p>
          {result && result.pointsWon > 0 && (
            <p className="text-secondary mt-1 text-sm">You won {result.pointsWon} points earlier today.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div aria-live="polite" className="sr-only">
        {result ? (result.pointsWon > 0 ? `You won ${result.pointsWon} points!` : 'Better luck tomorrow!') : ''}
      </div>

      <SpinWheel
        segments={game.segments}
        targetIndex={result?.segmentIndex}
        spinning={animating}
        onAnimationEnd={handleAnimationEnd}
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Button
        size="lg"
        loading={spinning && !animating}
        disabled={spinning || animating || alreadySpun}
        onClick={handleSpin}
      >
        {spinning && !animating ? 'Spinning...' : 'Spin the Wheel'}
      </Button>

      {result && (
        <Modal
          open={showModal}
          onOpenChange={setShowModal}
          title={result.pointsWon > 0 ? '🎉 Congratulations!' : 'Better luck tomorrow!'}
        >
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            {result.pointsWon > 0 ? (
              <>
                <p className="text-4xl font-bold text-primary">+{result.pointsWon} pts</p>
                <p className="text-secondary">Points added to your balance!</p>
              </>
            ) : (
              <p className="text-secondary">No points this time — come back tomorrow for another chance!</p>
            )}
            <Button onClick={() => setShowModal(false)}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
