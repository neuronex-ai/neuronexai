# NeuralCast feature

Esta pasta reúne toda a interface pública da NeuralCast para facilitar sua futura extração da NeuroNex.

## O que está aqui

- `assets/`: as duas variações oficiais da marca, já otimizadas para uso web.
- `components/`: shell, cabeçalho, rodapé, formulário da newsletter, cards e showcase de reels.
- `pages/`: landing responsiva e arquivo/página dos artigos.
- `content.ts`: artigos, categorias e links dos reels.
- `index.ts`: exportações públicas da feature.

## Rotas usadas na NeuroNex

- `/neuralcast`
- `/neuralcast/newsletter`
- `/neuralcast/newsletter/:slug`

## Extração futura

1. Copie toda a pasta `src/features/neuralcast` para o novo projeto.
2. Registre as três rotas acima no roteador do projeto de destino.
3. Copie a migração `supabase/migrations/20260722023000_neuralcast_newsletter_subscribers.sql` ou substitua o envio da newsletter pelo provedor escolhido.
4. Garanta as dependências `react-router-dom`, `lucide-react`, `framer-motion` e `@supabase/supabase-js`.
5. No CSP do host, libere `https://www.instagram.com` em `frame-src` para os embeds dos reels.

A detecção mobile é isolada em `useNeuralCastMobileLanding`: celulares com viewport inferior a 768 px recebem a landing mobile-first; tablet e desktop preservam a composição ampla.
