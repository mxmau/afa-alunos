# AFA Alunos

Aplicativo web para montar uma ficha formativa do aluno sem foco em notas. Ele permite importar alunos a partir de PDFs, cadastrar manualmente, registrar ocorrências e manter um panorama comportamental, social e pedagógico para conversas com famílias.

## O que já está pronto

- Cadastro manual de alunos.
- Importação de DPFs em PDF com revisão antes de salvar.
- Ficha rápida por aluno com perfil, pontos positivos, pontos de atenção, social, pedagógico, manter, melhorar e apoio da família.
- Modelos rápidos para preencher a ficha em poucos passos.
- Registros de ocorrências por aluno.
- Dashboard com totais.
- Exportação em CSV e backup JSON.
- Login/salvamento online via Supabase, quando configurado.
- Modo local para testar sem banco.

## Rodar localmente

```bash
npm install
npm run dev
```

## Configurar Supabase

1. Crie um projeto no Supabase.
2. Execute o SQL de `supabase/schema.sql` no editor SQL do Supabase.
3. Copie `.env.example` para `.env`.
4. Preencha:

```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon
```

No Supabase, habilite login por e-mail em Authentication. Depois de publicar no Netlify, adicione a URL do site nas URLs permitidas de autenticação.

## Publicar no Netlify

O projeto já inclui `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`

No Netlify, cadastre as mesmas variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

## Próximos passos recomendados

- Testar a importação com um DPF real e ajustar o detector de nomes se o formato do PDF for específico.
- Adicionar integração com o NotasEdit quando houver documentação ou rota de exportação/importação disponível.
- Criar filtros por turma, prioridade e alunos sem ficha completa.
