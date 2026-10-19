# Roteiro da demonstração (cliques, tempos e plano B)

Duração total: cerca de **5 minutos** (o pitch de 3 min em `pitch.md` usa os passos 2 a 4 em versão curta). Os tempos
abaixo são o alvo; cronometre no ensaio e anote o real ao lado.

Quem clica fica no notebook; quem fala, de frente para o público. Nunca diga "a IA diagnostica": diga "estima o risco",
"indica o exame", "mostra o porquê".

## Antes de começar

`npm run stand` imprime as URLs (neste notebook, rede e Render) e os logins. Depois de subir, deixe abertas, em abas:

| Aba | Endereço | Para quê |
|---|---|---|
| 1 | `http://localhost:3000/teste?kiosk=1` | passo 1 (modo quiosque: volta à capa sozinho após 120 s parado) |
| 2 | `http://localhost:3000/login` | passos 2 a 5, já logada como médica (veja abaixo) |

Logins (todos no card da tela de login; a senha já vem preenchida ao clicar no card):

| Quem | E-mail | Senha |
|---|---|---|
| Dra. Ana (médica) | `doctor@healthinpulse.dev` | `Doctor@123` |
| Roberto (paciente) | `roberto@healthinpulse.dev` | `Roberto@123` |
| Marina (paciente) | `marina@healthinpulse.dev` | `Marina@123` |
| João (paciente) | `joao@healthinpulse.dev` | `Joao@123` |

Banco recém-zerado pelo `stand` (sem `--keep-db`): Base da IA na versão original e Roberto em 44,8% (exibido "≥20%").

## Passo a passo

### 1. Teste rápido do visitante (`/teste`) · 1:30

Abra a aba 1. Quem assiste é o visitante: fale em categoria, "× a média" e "em 1.000".

1. Capa: "Seu risco de câncer, explicado em 2 minutos", com "Nada é gravado, sem login" e "Não é diagnóstico". Mostre o QR
   ("Prefere responder no celular?").
2. Clique em **Começar o teste**. Perfil: idade, sexo, altura, peso, fumo etc. Preencha ao vivo ou use os botões
   "Demonstração da equipe" no pé da capa (preenchem tudo e vão direto ao resultado com **Ver o resultado**).
3. Perguntas, uma por tela, com **Sim / Não / Não sei** e o "por que estamos perguntando". Mostre **Voltar**.
4. Resultado: um card por câncer, sem porcentagem, com o selo (ROTINA verde, ATENÇÃO âmbar, INVESTIGAR laranja, nunca
   vermelho), "× a média", "~N em 1.000" e os pontinhos. Abra **Por quê?**. Role até o rastreamento e "O que você pode fazer".
5. **Novo teste** limpa tudo para o próximo visitante.

Qual persona para qual efeito (rápido, ~30 s cada):

| Botão | O que mostra no `/teste` |
|---|---|
| **Carlos, 67** | pulmão **INVESTIGAR** (~6 em 100), sem "× a média", com a caixa laranja "procure uma avaliação médica" |
| **Helena, 47** | mama **ATENÇÃO** (2,2× a média), colo ROTINA |
| **Roberto, 63** | colorretal e pulmão em **ATENÇÃO**. Não chega a INVESTIGAR: o teste rápido não tem exames de sangue nem balança. Quem mostra INVESTIGAR para o Roberto é o painel da médica (passo 2) |

Se alguém receber ATENÇÃO ou INVESTIGAR de verdade, pare a demo e siga o acolhimento do `checklist-stand.md`.

### 2. Roberto, na visão da médica · 1:30

1. Aba 2: no login, clique no card **Dra. Ana** (`doctor@healthinpulse.dev` / `Doctor@123`) e **Entrar**.
2. Menu **Pacientes** → **Roberto Alves Pereira**. O **painel de riscos** está logo abaixo do cabeçalho.
3. Chips de "baseado em": triagem, exames (FIT positivo, hemoglobina 10,9), **balança** (perda de 9,5% em 90 dias, 84 → 76 kg).
4. Card **Colorretal**: selo **INVESTIGAR**, risco **"≥20%"** em 2 anos (o motor calcula 44,8%; a tela corta em 20% porque
   as pistas são correlacionadas, FAQ 12) e RR "> 10×". Já vem aberto o **"por quê"**, fator a fator, com a fonte:
   FIT positivo (×13,2), hemoglobina baixa (×5,2), perda de peso na balança (×5,1), mudança do intestino (×3,9); os
   "não" para sangramento retal e dor abdominal diminuem um pouco.
5. Pulmão em **ATENÇÃO** (fumo + perda de peso) e, em rastreamento, a **TC de pulmão de baixa dose** indicada; o colorretal
   mostra a nota laranja "o próximo passo é a avaliação médica, não o rastreamento de rotina".
6. O botão **Recalcular** refaz a conta na hora.

### 3. Base da IA: editar o LR do FIT · 1:00

1. Menu **Base da IA** (aba **Câncer**, **Colorretal** já selecionado). Mostre as fontes e o selo "Versão N".
2. Na lateral, **Simular em paciente** → escolha **Roberto Alves Pereira**. Aparece "≥20% (44,8%)" em colorretal.
3. Em **Sinais, sintomas e exames**, linha **Sangue oculto nas fezes (FIT) positivo**, clique no **LR+** (13,17), digite **2** e **Enter**.
   (Opcional: preencha antes o "Motivo da edição", por exemplo "demonstração na feira".)
4. A simulação refaz sozinha: o risco do Roberto cai de **44,8% para 11,0%** (INVESTIGAR continua pelos outros sinais,
   mas o número despenca). Clique em **Histórico**: aparece quem mudou, quando, e "13,17 → 2".
   Se quiser, **Painel do paciente →** abre o Roberto com o novo valor.

### 4. Restaurar padrão · 0:15

1. **Restaurar padrão** (topo da Base da IA) → confirme. A versão sobe e o FIT volta a **13,17**; a simulação volta a
   **44,8%**. As edições continuam no histórico.
2. Fale: "o histórico guarda tudo, como o Git, mas para os dados da IA".

**Regra de ouro:** nunca deixe o notebook sem "Restaurar padrão" depois de editar.

### 5. Marina · 0:45

1. **Pacientes** → **Marina Azevedo Lima** (34 anos). Painel: mama **ATENÇÃO**, **RR 2,2×**, ~1 em 1.000, por causa da mãe
   (câncer de mama aos 41).
2. Rastreamento: mamografia de alto risco indicada (começar 10 anos antes do caso da mãe, se a médica confirmar) e
   **DNA-HPV** (preventivo atrasado).
3. Se sobrar tempo: **João** (58) em ROTINA, mesmo com risco crônico CRITICAL (diabetes). O painel de câncer não
   é tingido pelo risco crônico.

Extra do paciente (opcional, +1 min): entre como Roberto/João no card do login e faça a triagem: aparece o banner
**"Etapa 2 de 2 — câncer"**. O confete só sai sem risco. Com a médica logada em outra aba, aparece o aviso
"Câncer para investigar: colorretal. Ver paciente →".

## Plano B

| Problema | O que fazer |
|---|---|
| **Render dormindo** (plano grátis acorda em ~1 min) | O keep-warm chama `/health` a cada 10 min. Abra a URL do Render no celular 5 min antes de abrir o stand. Durante a feira, use **sempre o notebook** (`localhost:3000`), que não depende do Render. Se o visitante escaneou o QR e ficou carregando, diga "é o servidor acordando, 1 minuto" e ofereça o notebook. |
| **Sem Wi-Fi** | A demo inteira roda local: `npm run stand` não precisa de internet (fontes locais, IA simulada). Só o QR/Render ficam fora. Os visitantes fazem o teste **no notebook** (aba `/teste?kiosk=1`) e quem quiser usa o próprio celular em 4G pelo QR se o Render estiver acordado. Se o celular da equipe fizer hotspot, o `stand` imprime o IP da rede para abrir de outros celulares. |
| **Token velho no navegador** (sessão antiga de outro login, tela que não carrega ou volta ao login) | `/teste` é público e ignora token, mas o login da médica não. Abra o `/teste` num **perfil separado do navegador** (ou janela anônima) e deixe a médica em outro. Para limpar: DevTools → Application → Clear site data, ou **Sair** e entrar de novo. |
| **Alguém recebeu INVESTIGAR** | Pare a demo. Siga o roteiro de acolhimento no `checklist-stand.md` (ouvir, explicar que é estimativa, indicar o médico, não interpretar o caso). Ofereça refazer no celular, pelo QR. |
| **Notebook travou no meio** | `Ctrl+C` e `npm run stand` de novo (zera o banco e volta tudo ao normal). Com pressa: `npm run stand -- --skip-build`. |
| **Esqueceu de restaurar a base** | Base da IA → **Restaurar padrão**. Ou reinicie com `npm run stand` (sem `--keep-db`). |
| **Resultado do Roberto diferente do esperado** | Provável base editada ou banco antigo. Restaurar padrão; se persistir, `npm run stand`. Confira a versão da base no selo "Versão N". |
| **Base da IA sem edição** (aviso âmbar "só leitura") | O servidor subiu sem `KB_EDIT=true`. Só acontece fora do `npm run stand` (ex.: Render). Use o notebook com `npm run stand`. |
| **Porta ocupada** | `npm run stand -- --port=3001` (e abra `localhost:3001`). |

## Conferência feita (Parte B da tarefa 11)

- [x] e-mail e senha do Roberto no seed e no card do login (`roberto@healthinpulse.dev` / `Roberto@123`, primeiro card);
- [x] "≥20%" na tela do painel e "≥20% (44,8%)" na simulação da Base da IA;
- [x] sinal do FIT na Base da IA e valor a mudar: **LR+ 13,17 → 2** (Roberto 44,8% → 11,0%);
- [ ] tempos reais de cada passo, cronometrados no ensaio (fazer no ensaio de quinta/sexta).
