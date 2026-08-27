# Pôquer — do vocabulário à mesa final

> Um app de estudo de Texas Hold'em no-limit, em português. Não tem dinheiro, não
> tem multiplayer, não tem servidor: é treino.

Web app (PWA) para quem está aprendendo pôquer e quer parar de decidir no
sentimento. Instala na tela inicial do celular e funciona offline.

**A ideia que organiza tudo:** ninguém aprende pôquer lendo teoria. Aprende
jogando, errando e revendo o erro. Por isso as sete abas formam um ciclo, e não
um índice.

| Aba | O que faz |
| --- | --- |
| ♠ Termos | Glossário de 38 termos com busca (também pelo nome em inglês) |
| ♦ Ranking | As dez categorias de mão, com exemplo renderizado em cartas |
| ♥ Pré-flop | Abrir ou descartar por posição, pela fórmula de Chen, com a conta aberta |
| ♣ Pós-flop | Drill infinito de outs × pot odds + 10 cenários de leitura escritos à mão |
| ● Torneio | Mesa oval no layout de um cliente real, contra bots com Monte Carlo |
| ▤ Minhas | Importa o histórico do PokerStars e aponta os erros recorrentes |
| ↗ Evolução | Acerto por semana e por mês, sequência de dias e posições mais fracas |

O ciclo fecha nas duas últimas abas: o painel de **leaks** agrega os erros por
tipo e cada um tem um botão que abre o treino correspondente já configurado —
errou abertura no CO, o botão leva ao treino de pré-flop travado no CO. A
**Evolução** faz o mesmo com o desempenho ao longo do tempo.

---

## Como rodar

```bash
npm install
npm run dev        # desenvolvimento em http://localhost:5173
npm run build      # build de produção (dist/)
npm run preview    # serve o build
npm run typecheck
npm test           # autoteste do núcleo — 139 verificações
npm run icons      # regera os ícones do PWA
```

---

## Deploy

O app é estático e não tem backend, então qualquer host serve. **HTTPS é
obrigatório** para instalar como PWA e para o service worker funcionar.

O workflow em `.github/workflows/deploy.yml` publica no GitHub Pages a cada push
na `main`. Falta habilitar uma vez, no repositório:

> **Settings → Pages → Source: GitHub Actions**

Depois disso o app fica em `https://<usuário>.github.io/Poker/`.

O Pages serve em subdiretório, o que quebra três coisas se ignorado. Todas estão
tratadas: `BASE_PATH` alimenta o `base` do Vite (assets, manifest e service
worker), e `404.html` é uma cópia do `index.html`, para link direto não morrer.

---

## O núcleo

Toda a lógica de pôquer é escrita do zero, sem biblioteca de terceiros — é o
próprio objeto de estudo do projeto, e é o que precisa ser verificável.

```
src/
├── lib/            ── AS REGRAS ──
│   ├── evaluator.ts    Avaliador de 7 cartas
│   ├── equity.ts       Monte Carlo + regra de 4 e 2
│   ├── chen.ts         Força da mão inicial e limiares por posição
│   ├── tournament.ts   Motor de apostas, side pots, blinds
│   ├── bots.ts         Decisão dos adversários
│   ├── pokerstars.ts   Parser do hand history
│   ├── analysis.ts     Detecção de erros e leaks
│   ├── progress.ts     Agregação por semana e por mês
│   ├── tableLayout.ts  Geometria dos assentos no oval
│   ├── storage.ts      Persistência com recuo por cota
│   └── format.ts       Fichas ou big blinds
├── data/           Glossário, ranking, cenários, tipos de projeto
├── components/     Carta, ficha, gráfico de período
├── screens/        Uma tela por aba
└── App.tsx         As sete abas e o estado compartilhado
```

**Avaliador de 7 cartas** (`evaluator.ts`): as C(7,5)=21 combinações, cada uma
codificada como um inteiro em base 15 — categoria como dígito mais
significativo, kickers em seguida. Assim comparar duas mãos é `a > b`, sem regra
de desempate espalhada pelo código.

**Equity** (`equity.ts`): Monte Carlo e a regra de 4 e 2 convivem separadas de
propósito. Uma é a conta honesta, usada pelos bots e pela análise; a outra é o
atalho que se faz de cabeça na mesa, e é o que o treino ensina. Confundir as
duas seria ensinar que a aproximação é exata.

**Bots** (`bots.ts`): pré-flop pela mesma fórmula de Chen que o app ensina,
pós-flop por Monte Carlo contra pot odds. Decidir o pré-flop por Monte Carlo os
faria entrar com qualquer lixo — contra cinco mãos aleatórias quase tudo tem
equity parecida — e o treino de abertura por posição viraria mentira.

**Parser** (`pokerstars.ts`): lê o texto que o cliente do PokerStars grava e
**recalcula pote e valor a pagar em cada ação**, porque o arquivo não traz esses
números e sem eles não existe pot odds. Nada lança exceção: uma mão ilegível é
descartada e as outras quatrocentas continuam valendo.

---

## A mesa

O torneio é desenhado como um cliente de pôquer de verdade: oval de feltro,
assentos em volta encostando no trilho, botão do dealer girando, fichas apostadas
entre o assento e o pote.

A disposição em volta do oval é o que torna a posição legível: "quem fala depois
de mim" é uma pergunta espacial, e numa lista vertical de assentos ela não tem
resposta visual nenhuma.

A geometria mora em `lib/tableLayout.ts`, não no componente, porque **layout
absoluto quebra em silêncio**: uma placa que escapa do feltro não lança erro
nenhum, só fica errada num tamanho de mesa que ninguém abriu. Com a conta
separada, o autoteste mede a caixa de cada assento contra a área em 3, 6 e 9
lugares — foi assim que apareceu um vazamento de 2px na mesa de três.

O nome do assento é preciso por tamanho de mesa: num 9-max existem UTG, UTG+1,
MP, MP+1 e HJ, e não três assentos seguidos rotulados "MP". O balde da fórmula de
Chen é **derivado** desse nome, de forma que a mesa possa mostrar "HJ" enquanto o
treino cobra o limiar de MP sem os dois discordarem.

---

## Fichas ou big blinds

Um interruptor na mesa e na lista de mãos troca a unidade de tudo: stacks, pote,
apostas, botões de ação e o resultado de cada mão importada. A escolha fica
salva.

Jogador de torneio não pensa em fichas: "1.500" não diz nada sozinho, mas "15 BB"
diz que o stack está curto e que a próxima decisão é empurrar ou desistir.

Na lista de mãos importadas isso vai além de conveniência: **somar fichas de
sessões com blinds diferentes não significa nada.** 500 fichas ganhas no 10/20 e
500 perdidas no 100/200 não se cancelam. Em BB, cada mão é convertida pela blind
da própria mão antes de entrar na soma.

O log da mão continua em fichas de propósito: ele é um transcrito, e hand history
de verdade é sempre em fichas.

---

## O que fica salvo

Tudo mora no aparelho, em `localStorage`. Nada vai para servidor nenhum, e o app
nunca pede sua senha do PokerStars — a importação é sempre manual, por arquivo,
lido dentro do navegador.

| O quê | Por quê |
| --- | --- |
| Cada resposta dos treinos | ~80 bytes cada; é a matéria-prima de toda a evolução |
| Mãos importadas, como texto cru do PokerStars | A forma mais compacta e fiel: reparsear custa milissegundos e nenhum campo do parser precisa de migração |
| As observações da análise | Recalculá-las custa Monte Carlo por decisão — centenas de mãos levariam dezenas de segundos a cada abertura |

A cota do navegador não é anunciada: só se descobre que acabou quando a escrita
falha. Em vez de perder tudo, o registro encolhe pelas mãos mais antigas e tenta
de novo; as respostas dos treinos são as últimas a cair, porque são a memória
longa. A aba Evolução diz em texto o que aconteceu, e tem um botão para apagar o
histórico inteiro.

Onde `localStorage` não existe — modo privado do Safari — o app continua
funcionando e avisa que não vai lembrar de nada.

**Os dados não sincronizam entre aparelhos.** Sem backend, o histórico do celular
e o do computador são separados.

---

## Design

Direção: **sala de estudos de um jogador sério** — caderno de anotações, não
cassino. Fundo tinta, texto pergaminho, ouro só onde há ficha. Os naipes marcam
as abas de fundamentos porque não são enfeite: são o vocabulário do conteúdo.

**A mesa do torneio é a exceção deliberada.** Ali vale o feltro verde e a
organização de um cliente de verdade, porque é o ambiente em que o jogador vai
jogar — treinar leitura de mesa num layout que não existe em lugar nenhum custa
transferência.

Os gráficos da Evolução são de uma cor só: a série é magnitude, não identidade.
Acerto e erro nunca viram verde-e-vermelho lado a lado — essa dupla é
indistinguível para boa parte dos daltônicos, e ali seria a única informação na
tela. Período vazio não é desenhado como 0%: semana parada aparece vazada, semana
treinada com zero acerto aparece rente ao chão.

---

## Verificação

```bash
npm test
```

139 verificações executáveis, rodadas também no CI a cada push:

- **Avaliador** — categorias e desempates, a roda A-2-3-4-5 inclusive, e a
  propriedade de que a melhor de sete é o máximo das 21 combinações, sorteando
  300 mãos.
- **Chen** — scores conhecidos (AA=20, AKs=12, 72o=0) e as decisões de abertura.
- **Equity** — AA contra 1 e contra 5 adversários, contagem de outs contra mão
  conhecida.
- **Side pots** — camadas com jogador desistente, e a soma distribuída batendo
  com a apostada.
- **Torneio** — 12 torneios completos jogados de ponta a ponta, verificando que
  nenhuma ficha é criada ou perdida e que o motor nunca fica sem jogador da vez.
- **Parser e análise** — sobre um histórico de exemplo, incluindo aposta não paga
  devolvida e mão sem showdown.
- **Evolução** — semana começando na segunda, domingo caindo na semana certa,
  período vazio devolvendo `null` em vez de zero, e a sequência de dias
  sobrevivendo ao dia que ainda não teve treino.
- **Layout da mesa** — a caixa de cada assento medida contra a área em 3, 6 e 9
  lugares, com as dimensões reais tiradas do navegador.

Além disso, o app foi percorrido no navegador (Chromium, viewport de 380px): as
sete abas, um torneio jogado até o showdown, importação de histórico, o caminho
leak → treino → volta, e o ciclo treinar → recarregar → os números continuarem
lá. Sem erro de console.
