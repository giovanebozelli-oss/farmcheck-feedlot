import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useAppStore } from '../context';

interface Props {
  penId: string;
  /** Se true, é a primeira baia da lista (não pode subir) */
  isFirst?: boolean;
  /** Se true, é a última baia (não pode descer) */
  isLast?: boolean;
  /** Compacto pra usar em tabelas (menor) */
  compact?: boolean;
}

/**
 * Botões pra mover uma baia pra cima/baixo na ordem global.
 * Aparece em Ficha de Trato e Acompanhamento Zootécnico (e onde mais quiser).
 * Usa movePen do contexto, que atualiza display_order no banco.
 */
const PenReorderControls: React.FC<Props> = ({ penId, isFirst, isLast, compact }) => {
  const { movePen } = useAppStore();

  const handleMove = async (e: React.MouseEvent, direction: 'up' | 'down') => {
    e.stopPropagation();
    try {
      await movePen(penId, direction);
    } catch (err) {
      console.error('[PenReorder]', err);
    }
  };

  const btnSize = compact ? 'p-0.5' : 'p-1';
  const iconSize = compact ? 11 : 13;

  return (
    <div className="inline-flex flex-col gap-0.5 leading-none">
      <button
        onClick={(e) => handleMove(e, 'up')}
        disabled={isFirst}
        title="Mover baia pra cima"
        className={`${btnSize} rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors`}
      >
        <ChevronUp size={iconSize} strokeWidth={3} />
      </button>
      <button
        onClick={(e) => handleMove(e, 'down')}
        disabled={isLast}
        title="Mover baia pra baixo"
        className={`${btnSize} rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 disabled:opacity-20 disabled:cursor-not-allowed transition-colors`}
      >
        <ChevronDown size={iconSize} strokeWidth={3} />
      </button>
    </div>
  );
};

export default PenReorderControls;
