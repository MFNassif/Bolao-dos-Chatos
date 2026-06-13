import { useEffect, useMemo, useState } from 'react';
import { isLocked } from '../utils/locks';
import { savePrediction } from '../services/predictionService';
import { scorePrediction } from '../utils/scoring';
import { useAuth } from '../routes/AuthContext';

export default function PredictionForm({ game, prediction, settings }) {
  const { user, profile } = useAuth();
  const locked = isLocked(game.startTime);
  const [home, setHome] = useState(prediction?.homePrediction ?? '');
  const [away, setAway] = useState(prediction?.awayPrediction ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    setHome(prediction?.homePrediction ?? '');
    setAway(prediction?.awayPrediction ?? '');
  }, [prediction?.homePrediction, prediction?.awayPrediction]);

  const livePts = useMemo(() => {
    if (!prediction) return null;
    if (!Number.isInteger(game.homeScore) || !Number.isInteger(game.awayScore)) return null;
    return scorePrediction(
      { home: prediction.homePrediction, away: prediction.awayPrediction },
      { home: game.homeScore, away: game.awayScore },
      settings
    );
  }, [prediction, game.homeScore, game.awayScore, settings]);

  function onlyDigits(v) { return v.replace(/\D+/g, '').slice(0, 2); }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);
    if (home === '' || away === '') {
      setMsg({ type: 'error', text: 'Informe os dois placares.' });
      return;
    }
    setSaving(true);
    try {
      await savePrediction({
        user,
        profile,
        game,
        home: Number(home),
        away: Number(away),
        existingPrediction: prediction
      });
      setMsg({ type: 'success', text: 'Salvo!' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Erro.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(null), 2500);
    }
  }

  /* Bloqueado / encerrado */
  if (locked || game.status !== 'scheduled') {
    const hasPred = prediction?.homePrediction !== undefined;
    return (
      <div className="flex flex-col items-center gap-2">
        {hasPred ? (
          <>
            {/* mesma largura fixa do centro do GameCard */}
            <div className="flex items-center justify-center gap-2" style={{ width: 120 }}>
              <span className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center font-display text-xl text-white">
                {prediction.homePrediction}
              </span>
              <span className="w-4 text-center font-display text-base text-slate">×</span>
              <span className="w-9 h-9 rounded-xl bg-white/8 border border-white/10 flex items-center justify-center font-display text-xl text-white">
                {prediction.awayPrediction}
              </span>
            </div>
            {livePts && (
              livePts.exactScoreHit
                ? <span className="chip bg-yellow-500/20 text-yellow-400 animate-pulse">🎯 +{livePts.points} pts</span>
                : livePts.resultHit
                  ? <span className="chip bg-green/20 text-green-light">✓ +{livePts.points} pt</span>
                  : game.status === 'finished'
                    ? <span className="chip bg-white/8 text-slate">0 pts</span>
                    : null
            )}
          </>
        ) : (
          <span className="text-[11px] text-slate italic">
            {game.status === 'finished' ? 'Sem palpite' : '🔒 Sem palpite'}
          </span>
        )}
      </div>
    );
  }

  /* Aberto — inputs alinhados com o GameCard:
     [input-w9] [×] [input-w9] ficam dentro da mesma largura fixa de 120px
     e o botão ✓ fica fora, à direita, simétrico às bandeiras */
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <form onSubmit={handleSubmit} className="flex items-center justify-center w-full gap-3">

        {/* Espaço esquerdo — espelha a largura da coluna da bandeira */}
        <div className="flex-1" />

        {/* Centro fixo: input | × | input — mesma width=120 do GameCard */}
        <div className="flex items-center justify-center gap-2" style={{ width: 120 }}>
          <input
            inputMode="numeric" pattern="[0-9]*"
            className="w-9 h-9 text-center text-xl font-display rounded-xl bg-white/8 border border-white/15 text-white outline-none focus:border-green transition"
            value={home} disabled={saving}
            onChange={e => setHome(onlyDigits(e.target.value))}
            aria-label={`Placar ${game.homeTeam}`}
          />
          <span className="w-4 text-center font-display text-base text-slate">×</span>
          <input
            inputMode="numeric" pattern="[0-9]*"
            className="w-9 h-9 text-center text-xl font-display rounded-xl bg-white/8 border border-white/15 text-white outline-none focus:border-green transition"
            value={away} disabled={saving}
            onChange={e => setAway(onlyDigits(e.target.value))}
            aria-label={`Placar ${game.awayTeam}`}
          />
        </div>

        {/* Botão ✓ — posicionado no espaço direito, simétrico à bandeira */}
        <div className="flex-1 flex items-center justify-center">
          <button
            type="submit" disabled={saving}
            className="w-10 h-10 rounded-xl bg-green flex items-center justify-center text-white text-lg font-bold hover:bg-green-light transition active:scale-95 disabled:opacity-40"
          >
            {saving ? '…' : '✓'}
          </button>
        </div>
      </form>

      {msg && (
        <span className={`text-xs font-bold ${msg.type === 'success' ? 'text-green-light' : 'text-red-400'}`}>
          {msg.text}
        </span>
      )}
    </div>
  );
}
