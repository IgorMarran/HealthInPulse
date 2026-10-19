# Roteiro da demonstração (esqueleto)

> **TODO: conferir cliques depois do frontend.** As telas `/teste`, painel de riscos da médica e "Base da IA" ainda
> estão sendo implementadas. Este arquivo tem só a sequência planejada e os tempos; os cliques exatos, os nomes dos
> botões e o plano B de cada passo entram quando as telas existirem.

Duração total: cerca de **5 minutos** (o pitch de 3 min em `pitch.md` usa os passos 2 a 4 em versão curta).

| # | Passo | Tempo | O que mostrar | Cliques |
|---|---|---|---|---|
| 1 | **Teste rápido do visitante** (`/teste`) | 1:30 | capa com "não é diagnóstico" → perfil → 6 a 8 perguntas, uma por tela, com o "por que estamos perguntando" → resultado em categoria, "× a média" e "~N em 1.000" → exame indicado | TODO |
| 2 | **Roberto, na visão da médica** | 1:30 | login da Dra. Ana (card) → paciente Roberto → painel de riscos: colorretal **INVESTIGAR** ("≥ 20%"), o "por quê" fator a fator (FIT+, anemia, perda de peso na balança, mudança do intestino) com a fonte de cada um; pulmão em ATENÇÃO (fumo + perda de peso) e TC de pulmão de baixa dose indicada | TODO |
| 3 | **Base da IA: editar o LR do FIT** | 1:00 | menu "Base da IA" → câncer colorretal → sinal "FIT positivo" → mudar o valor → voltar ao Roberto e ver o risco mudar → histórico mostra quem mudou, quando, de → para | TODO |
| 4 | **Restaurar padrão** | 0:15 | "Restaurar padrão" na Base da IA → Roberto volta ao resultado original | TODO |
| 5 | **Marina** | 0:45 | paciente Marina → mama **ATENÇÃO** (2,2× a média, ~1 em 1.000) por causa da mãe; rastreamento de mama antecipado; DNA-HPV indicado (preventivo atrasado) | TODO |

## Plano B (preencher junto com os cliques)

- Render fora do ar ou lento: TODO
- Notebook travou no meio da demo: TODO (`Ctrl+C` e `npm run stand` de novo)
- Esqueceu de restaurar a base: TODO
- Resultado do Roberto diferente do esperado: TODO

## A conferir quando o frontend estiver pronto

- [ ] e-mail e senha do Roberto no seed e no card do login;
- [ ] texto exato das categorias e do "≥ 20%" na tela;
- [ ] nome do sinal do FIT na Base da IA e qual valor mudar para o efeito ficar visível (ex.: LR de ~13 para ~2);
- [ ] tempos reais de cada passo, cronometrados no ensaio.
