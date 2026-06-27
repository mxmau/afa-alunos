# AFA Alunos

Aplicativo web para montar uma ficha formativa do aluno sem foco em notas. Ele permite importar alunos a partir de PDFs, cadastrar manualmente, registrar ocorrências e manter um panorama comportamental, social e pedagógico para conversas com famílias.

## O que já está pronto

- Cadastro manual de alunos.
- Importação de PDFs com detecção de turmas/matrículas, revisão, correção de nomes/turmas e remoção de falsos positivos antes de salvar.
- Importação de boletins/listas aceitando apenas alunos com status `Cursando` ou `Matriculado`.
- Separação automática por unidade: São Lourenço e Igarassu.
- Remoção de duplicados por nome, turma e unidade.
- Ficha rápida por aluno com perfil, pontos positivos, pontos de atenção, social, pedagógico, manter, melhorar e apoio da família.
- Modelos rápidos e chips de frases prontas para preencher a ficha em poucos cliques.
- Complemento próprio em cada campo da AFA para inserir palavras ou frases sem digitar o relatório inteiro.
- Registros de ocorrências por aluno.
- Dashboard com totais.
- Filtros por turma, nível de atenção, fichas iniciadas, completas, incompletas ou pendentes.
- Indicador de progresso da ficha com campos essenciais restantes.
- Exportação em CSV compatível com acentos, backup JSON e restauração de backup.
- CRUD de alunos com nome, turma, matrícula, unidade, status escolar e exclusão com confirmação.
- Login/salvamento online via Supabase, quando configurado.
- Modo local para testar sem banco.

## Rodar localmente

```bash
npm install
npm run dev
```

## Verificar qualidade

```bash
npm test
npm run build
```

## Checklist de QA do MVP

- Cadastrar um aluno manualmente e confirmar que ele aparece na lista lateral.
- Preencher campos essenciais da ficha e conferir o progresso até 100%.
- Registrar uma ocorrência e confirmar que ela aparece na linha do tempo e na ficha para os pais.
- Copiar a ficha para os pais e conferir a mensagem de sucesso ou orientação de cópia manual.
- Exportar CSV e JSON, depois restaurar o JSON em modo local.
- Importar um PDF real da escola, corrigir nomes/turmas na prévia e confirmar que duplicados são ignorados.
- Filtrar por turma, nível de atenção, ficha completa, ficha incompleta e sem ficha iniciada.
- Rodar `npm test` e `npm run build` antes de publicar.

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

- Testar a importação com um PDF real e ajustar o detector de nomes se o formato do arquivo for específico.
- Adicionar integração com o NotasEdit quando houver documentação ou rota de exportação/importação disponível.
