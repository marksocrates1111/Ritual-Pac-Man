import { useState, useCallback, useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { formatEther } from 'ethers';
import { PacManGame } from './PacManGame';
import type { GameState } from '../game/engine';

// Local leaderboard
const LB_KEY = 'ritual-pacman-lb-v1';
type LBEntry = { address: string; score: number; ts: number };

function loadLB(): LBEntry[] {
  try { return JSON.parse(localStorage.getItem(LB_KEY) || '[]'); } catch { return []; }
}
function saveLB(entries: LBEntry[]) { localStorage.setItem(LB_KEY, JSON.stringify(entries)); }

export function GamePage() {
  const { address, isConnected } = useAccount();
  const { data: balanceData } = useBalance({ address });
  const [highScore, setHighScore] = useState(0);
  const [lastScore, setLastScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>('waiting');
  const [leaderboard, setLeaderboard] = useState<LBEntry[]>(() => loadLB());

  const balance = balanceData ? parseFloat(formatEther(balanceData.value)).toFixed(4) : '0.0000';

  const handleGameOver = useCallback((score: number) => {
    setLastScore(score);
    if (score > highScore) setHighScore(score);
    if (address && score > 0) {
      const lb = loadLB();
      const existing = lb.find(e => e.address.toLowerCase() === address.toLowerCase());
      if (existing) {
        if (score > existing.score) { existing.score = score; existing.ts = Date.now(); }
      } else {
        lb.push({ address, score, ts: Date.now() });
      }
      lb.sort((a, b) => b.score - a.score);
      const trimmed = lb.slice(0, 20);
      saveLB(trimmed);
      setLeaderboard(trimmed);
    }
  }, [address, highScore]);

  const shareText = useMemo(() =>
    `🎮 I just scored ${lastScore} on Ritual Pac-Man!\n` +
    `🏆 High Score: ${highScore}\n` +
    `Play the cyberpunk arcade dApp on @ritualnet 👇\n` +
    window.location.href
  , [lastScore, highScore]);

  const shareOnX = useCallback(() => {
    navigator.clipboard.writeText(shareText).catch(() => {});
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
  }, [shareText]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <img src="/bg.png" className="ritual-bg-logo" alt="Ritual" />
      {/* Header */}
      <header className="ritual-header" style={{ position: 'sticky', top: 0, zIndex: 50, padding: '12px 20px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Pac-Man icon */}
            <div style={{ width: 32, height: 32, background: '#ffe100', borderRadius: '50%', clipPath: 'polygon(100% 0%, 50% 50%, 100% 100%, 0% 100%, 0% 0%)', boxShadow: '0 0 12px rgba(255,225,0,0.4)' }} />
            <div>
              <h1 className="font-cyber" style={{ fontSize: 18, fontWeight: 800, color: 'var(--neon-green)', textShadow: '0 0 10px rgba(57,255,20,0.4)', letterSpacing: '0.1em', lineHeight: 1.2 }}>
                RITUAL PAC-MAN
              </h1>
              <p style={{ fontSize: 9, color: 'var(--text-secondary)', letterSpacing: '0.2em', fontFamily: 'var(--font-cyber)' }}>
                ARCADE dAPP ON RITUAL CHAIN
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {isConnected && (
              <div className="game-hud" style={{ textAlign: 'right' }}>
                <div>BAL: <span style={{ color: '#ffe100' }}>{balance}</span> RITUAL</div>
                <div>HIGH: <span style={{ color: '#ffe100' }}>{highScore.toString().padStart(6, '0')}</span></div>
              </div>
            )}
            <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 8px', gap: 12, width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
        {/* Game */}
        <div className="animate-fade-in" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <PacManGame
            onScoreChange={() => {}}
            onGameOver={handleGameOver}
            onStateChange={setGameState}
          />
        </div>



        {/* Share button */}
        {(gameState === 'gameover' || gameState === 'levelclear') && lastScore > 0 && (
          <button onClick={shareOnX} className="btn-neon" style={{ fontSize: 11 }}>
            🏆 SHARE SCORE ON X
          </button>
        )}

        {/* Leaderboard */}
        <div style={{ maxWidth: 600, width: '100%' }}>
          <h3 className="font-cyber" style={{ fontSize: 12, color: 'var(--neon-green)', marginBottom: 12, letterSpacing: '0.15em' }}>
            ⚡ LEADERBOARD
          </h3>
          <div className="ritual-card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Header */}
            <div className="game-hud" style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px', padding: '10px 16px', borderBottom: '1px solid var(--ritual-border)', opacity: 0.7 }}>
              <span>#</span>
              <span>WALLET</span>
              <span style={{ textAlign: 'right' }}>SCORE</span>
            </div>
            {leaderboard.length === 0 ? (
              <p style={{ padding: 24, textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)' }}>
                No scores yet — be the first!
              </p>
            ) : (
              leaderboard.slice(0, 10).map((entry, i) => (
                <div key={entry.address} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 100px', padding: '10px 16px', borderBottom: '1px solid rgba(30,30,46,0.5)', fontSize: 11 }}>
                  <span style={{ color: i < 3 ? '#ffe100' : 'var(--text-secondary)', fontFamily: 'var(--font-arcade)', fontSize: 10 }}>{i + 1}</span>
                  <span style={{ fontFamily: 'monospace', color: address?.toLowerCase() === entry.address.toLowerCase() ? 'var(--neon-green)' : 'var(--text-secondary)' }}>
                    {entry.address.slice(0, 6)}…{entry.address.slice(-4)}
                    {address?.toLowerCase() === entry.address.toLowerCase() && <span style={{ color: '#ff69b4', marginLeft: 4 }}>(you)</span>}
                  </span>
                  <span style={{ textAlign: 'right', color: '#ffe100', fontFamily: 'var(--font-arcade)', fontSize: 10 }}>
                    {entry.score.toString().padStart(6, '0')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '24px 16px', borderTop: '1px solid var(--ritual-border)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <a href="https://ritual.net" target="_blank" rel="noreferrer" className="font-cyber" style={{ fontSize: 10, color: 'var(--neon-green)', letterSpacing: '0.1em', textDecoration: 'none' }}>
            RITUAL.NET
          </a>
          <span style={{ color: 'var(--ritual-border)' }}>|</span>
          <a href="https://x.com/ritualnet" target="_blank" rel="noreferrer" className="font-cyber" style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.1em', textDecoration: 'none' }}>
            @RITUALNET
          </a>
          <span style={{ color: 'var(--ritual-border)' }}>|</span>
          <a href="https://explorer.ritualfoundation.org" target="_blank" rel="noreferrer" className="font-cyber" style={{ fontSize: 10, color: 'var(--text-secondary)', letterSpacing: '0.1em', textDecoration: 'none' }}>
            EXPLORER
          </a>
        </div>
        <p style={{ marginTop: 8, fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-cyber)', letterSpacing: '0.15em' }}>
          BUILT ON RITUAL CHAIN · CHAIN ID 1979
        </p>
      </footer>
    </div>
  );
}
