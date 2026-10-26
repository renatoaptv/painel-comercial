# Movami | Controle de Negociações

Módulo comercial independente localizado em \`consulta-movami/negociacoes/\`. O projeto principal (\`/index.html\`) e a lista de clientes ativos criptografada (\`consulta-movami/index.html\`) permanecem operacionais. Na consulta, foi incluído somente um link de acesso ao novo painel.

## Abrir

https://renatoaptv.github.io/painel-comercial/consulta-movami/negociacoes/

A página inicia automaticamente sem solicitar e-mail ou senha.
Se existir uma sessão autenticada válida do Supabase neste navegador, ela é preservada e os dados da conta seguem sincronizados.
Caso contrário, o painel usa armazenamento local do próprio navegador. Nesse modo, os dados não são sincronizados entre dispositivos, podem ser perdidos se o usuário limpar os dados do navegador e podem ser vistos por outras pessoas que usem o mesmo perfil. Use o botão de exportação de backup (↓) no menu. Nunca abra as políticas RLS das tabelas ao público.

### Visual

Efeito de expansão e elevação ao passar o mouse sobre cartões de indicadores, quadros, notas e painéis. No celular não há efeito de hover. Há suporte para preferência por movimento reduzido.

## Funções

- Criar, editar, pesquisar e excluir empresas/CNPJ (inclusive formato alfanumérico de 2026), com alerta de CNPJ repetido por usuário.
- Registrar contato, WhatsApp, e-mail, cidade, segmento, veículos, quantidade, quilometragem, proposta e prioridade.
- Controlar etapas: prospectar, conversamos, aguardando resposta, proposta enviada, negociando, visita agendada, fechado e perdido.
- Próxima ação e lembrete de data/hora; agenda e destaques de pendências vencidas ou de hoje.
- Histórico de ligações, WhatsApp, visitas, propostas e retornos, associado a cada cliente.
- Notas rápidas flutuantes dentro da página; podem ser avulsas ou vinculadas a clientes. Com sessão pré-existente, sincronizam no Supabase; sem sessão, ficam apenas neste navegador.
- Visualização em lista ou quadro e atalhos de WhatsApp.
- Acesso à consulta já existente de clientes ativos (ela continua protegida por senha independente).

## Isolamento e segurança

Somente as seguintes tabelas foram criadas no Supabase \`painel-comercial-saas\`:
- \`public.movami_crm_clientes\`
- \`public.movami_crm_interacoes\`
- \`public.movami_crm_notas_rapidas\`

Todas têm RLS e políticas de leitura, inclusão, edição e exclusão limitadas ao \`auth.uid()\` autenticado. As interações e notas associadas a clientes usam chave estrangeira composta \`(cliente_id, usuario_id)\`, para impedir o vínculo com registros de outros usuários. A chave presente no front-end é pública (\`sb_publishable_...\`) e nunca a chave secreta.

**Atenção:** um cadastro de cliente no novo painel não atualiza automaticamente a lista criptografada dos clientes ativos da Movami. Consulte essa lista separadamente para evitar abordagens duplicadas. A sincronização de sessões autenticadas depende de conexão à internet. O modo local não precisa de autenticação para iniciar.

## Observações de uso

1. Cadastre a empresa e marque a etapa atual.
2. Preencha sempre "Próxima ação" e "Data e hora" para ela entrar na sua agenda.
3. Abra a empresa para registrar cada contato no histórico.
4. Use "Nota rápida" para lembretes sem perder o contexto da página.

O painel de notas é flutuante **dentro do site**; não fica por cima de outros programas do Windows. Esse comportamento exigiria aplicativo de área de trabalho próprio.