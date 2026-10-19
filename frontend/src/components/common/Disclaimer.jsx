// ─── Aviso "não é diagnóstico" ───────────────────────────────
// Usado no teste público e no painel da médica. O texto vem da API quando
// existe (`disclaimer` das respostas); senão, cai no padrão do público.
//   variant="box"    caixa com ícone (padrão)
//   variant="inline" uma linha discreta, para rodapé
import { Info } from 'lucide-react';
import clsx from 'clsx';

export const DEFAULT_DISCLAIMER =
  'Teste educativo de risco. Não é diagnóstico e não substitui uma consulta.';

export default function Disclaimer({ text, variant = 'box', className }) {
  const body = text || DEFAULT_DISCLAIMER;

  if (variant === 'inline') {
    return (
      <p className={clsx('text-xs text-surface-500 flex items-start gap-1.5', className)}>
        <Info size={13} className="shrink-0 mt-px" aria-hidden />
        <span>{body}</span>
      </p>
    );
  }

  return (
    <div
      role="note"
      className={clsx(
        'flex items-start gap-2.5 rounded-xl border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900',
        className,
      )}
    >
      <Info size={16} className="shrink-0 mt-0.5 text-brand-600" aria-hidden />
      <p>{body}</p>
    </div>
  );
}
