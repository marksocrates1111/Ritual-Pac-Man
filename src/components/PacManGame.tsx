import { useEffect, useRef, useCallback, useState } from 'react';
import { CANVAS_W, CANVAS_H } from '../game/constants';
import { createGame, updateGame, renderGame, handleKeyDown, type GameState } from '../game/engine';

interface PacManGameProps {
  onScoreChange?: (score: number) => void;
  onGameOver?: (score: number) => void;
  onStateChange?: (state: GameState) => void;
}

export function PacManGame({ onScoreChange, onGameOver, onStateChange }: PacManGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef(createGame());
  const rafRef = useRef<number>(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [level, setLevel] = useState(1);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const resetGame = useCallback(() => {
    gameRef.current = createGame();
    setScore(0);
    setLives(3);
    setLevel(1);
    setGameState('waiting');
  }, []);

  const handleConfirm = useCallback(() => {
    const game = gameRef.current;
    if (game.state === 'gameover') {
      resetGame();
      return;
    }
    if (game.state === 'levelclear') {
      const newGame = createGame(game.level + 1);
      newGame.score = game.score;
      newGame.lives = game.lives;
      gameRef.current = newGame;
      return;
    }
    handleKeyDown(game, ' ');
  }, [resetGame]);

  // Touch controls for mobile
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let lastScore = 0;
    let lastState: GameState = 'waiting';

    const loop = () => {
      const game = gameRef.current;
      updateGame(game);
      renderGame(ctx, game);

      // Draw overlay text
      if (game.state === 'waiting') {
        drawOverlay(ctx, 'RITUAL PAC-MAN', 'PRESS SPACE TO START', game.frameCount);
      } else if (game.state === 'starting') {
        drawOverlay(ctx, 'READY!', '', game.frameCount);
      } else if (game.state === 'gameover') {
        drawOverlay(ctx, 'GAME OVER', `SCORE: ${game.score}`, game.frameCount);
      } else if (game.state === 'levelclear') {
        drawOverlay(ctx, 'LEVEL CLEAR!', `SCORE: ${game.score}`, game.frameCount);
      }

      // Sync React state
      if (game.score !== lastScore) {
        lastScore = game.score;
        setScore(game.score);
        onScoreChange?.(game.score);
      }
      if (game.state !== lastState) {
        lastState = game.state;
        setGameState(game.state);
        setLives(game.lives);
        setLevel(game.level);
        onStateChange?.(game.state);
        if (game.state === 'gameover') onGameOver?.(game.score);
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [onScoreChange, onGameOver, onStateChange]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const game = gameRef.current;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
      }
      if ([' ', 'Enter'].includes(e.key)) {
        handleConfirm();
        return;
      }
      handleKeyDown(game, e.key);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleConfirm]);

  // Touch controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };

      const game = gameRef.current;
      if (game.state === 'waiting' || game.state === 'gameover' || game.state === 'levelclear') {
        handleConfirm();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      if (!touchStartRef.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartRef.current.x;
      const dy = t.clientY - touchStartRef.current.y;
      const minSwipe = 20;
      const game = gameRef.current;

      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > minSwipe) {
        handleKeyDown(game, dx > 0 ? 'ArrowRight' : 'ArrowLeft');
      } else if (Math.abs(dy) > minSwipe) {
        handleKeyDown(game, dy > 0 ? 'ArrowDown' : 'ArrowUp');
      }
      touchStartRef.current = null;
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleConfirm]);

  const handleDpad = (key: string) => {
    setActiveKey(key);
    handleKeyDown(gameRef.current, key);
  };

  const getBtnStyle = (key: string) => ({
    width: 64, height: 64, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
    background: activeKey === key ? 'var(--neon-green)' : 'transparent',
    color: activeKey === key ? 'var(--ritual-black)' : 'var(--neon-green)',
    boxShadow: activeKey === key ? '0 0 15px var(--neon-green)' : 'none',
    transition: 'all 0.1s ease',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', maxWidth: CANVAS_W }}>
      {/* HUD */}
      <div className="game-hud" style={{ width: '100%', maxWidth: CANVAS_W, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <span>SCORE <span style={{ color: '#ffe100' }}>{score.toString().padStart(6, '0')}</span></span>
        <span>LVL <span style={{ color: '#ffe100' }}>{level}</span></span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {Array.from({ length: lives }).map((_, i) => (
            <span key={i} style={{ color: '#ffe100' }}>❤</span>
          ))}
        </span>
      </div>

      {/* Canvas */}
      <div className="pacman-canvas-container" style={{ width: '100%', maxWidth: CANVAS_W, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated', borderRadius: '4px' }}
        />
      </div>

      {/* Mobile D-pad — visible only on small screens */}
      <div className="mobile-dpad" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 64px)', gridTemplateRows: 'repeat(3, 64px)', gap: 8, justifyContent: 'center', margin: '16px 0' }}>
        <div />
        <button onClick={() => handleDpad('ArrowUp')} className="btn-neon" style={getBtnStyle('ArrowUp')}>▲</button>
        <div />
        <button onClick={() => handleDpad('ArrowLeft')} className="btn-neon" style={getBtnStyle('ArrowLeft')}>◄</button>
        <button onClick={handleConfirm} className="btn-neon-filled" style={{ width: 64, height: 64, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, borderRadius: '50%' }}>GO</button>
        <button onClick={() => handleDpad('ArrowRight')} className="btn-neon" style={getBtnStyle('ArrowRight')}>►</button>
        <div />
        <button onClick={() => handleDpad('ArrowDown')} className="btn-neon" style={getBtnStyle('ArrowDown')}>▼</button>
        <div />
      </div>

      {/* Status */}
      <p className="font-arcade" style={{ color: 'var(--text-secondary)', fontSize: 8, textAlign: 'center', marginTop: 8 }}>
        {gameState === 'waiting' && '⌨ WASD / ARROWS · SPACE / GO TO START'}
        {gameState === 'playing' && 'EAT ALL PELLETS · AVOID GHOSTS'}
        {gameState === 'gameover' && 'SPACE / GO TO RESTART'}
        {gameState === 'levelclear' && 'SPACE / GO FOR NEXT LEVEL'}
      </p>
    </div>
  );
}

function drawOverlay(ctx: CanvasRenderingContext2D, title: string, sub: string, frame: number) {
  ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const pulse = 0.7 + 0.3 * Math.sin(frame * 0.05);

  ctx.font = '16px "Press Start 2P"';
  ctx.fillStyle = `rgba(57, 255, 20, ${pulse})`;
  ctx.textAlign = 'center';
  ctx.shadowBlur = 20;
  ctx.shadowColor = 'rgba(57, 255, 20, 0.5)';
  ctx.fillText(title, CANVAS_W / 2, CANVAS_H / 2 - 20);

  ctx.font = '8px "Press Start 2P"';
  ctx.fillStyle = `rgba(255, 225, 0, ${pulse})`;
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(255, 225, 0, 0.3)';
  ctx.fillText(sub, CANVAS_W / 2, CANVAS_H / 2 + 20);

  ctx.shadowBlur = 0;
  ctx.textAlign = 'start';
}
