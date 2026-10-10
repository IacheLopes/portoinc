// ============================================================
//  Estrutura da aplicação e mapa de telas
//
//  Regra de ouro das rotas: quem não está logado só enxerga a
//  tela de entrada. Quem está logado nunca vê a tela de entrada.
// ============================================================

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProvedorAutenticacao, useAutenticacao } from './contexto/Autenticacao';
import { Layout } from './componentes/Layout';
import { Carregando } from './componentes/Estado';
import { Entrar } from './paginas/Entrar';
import { Inicio } from './paginas/Inicio';
import { MinhaSenha } from './paginas/MinhaSenha';
import { Usuarios } from './paginas/admin/Usuarios';
import { StatusSistema } from './paginas/admin/StatusSistema';
import { Avisos } from './paginas/admin/Avisos';
import { Familias } from './paginas/cadastros/Familias';
import { Materiais } from './paginas/cadastros/Materiais';
import { Fornecedores } from './paginas/cadastros/Fornecedores';
import { Obras } from './paginas/cadastros/Obras';
import { ObraDetalhe } from './paginas/cadastros/ObraDetalhe';
import { Alcadas } from './paginas/cadastros/Alcadas';
import { ListaSolicitacoes } from './paginas/solicitacoes/Lista';
import { DetalheSolicitacao } from './paginas/solicitacoes/Detalhe';
import { FilaAprovacao } from './paginas/aprovacoes/Fila';
import { ListaCotacoes } from './paginas/cotacoes/Lista';
import { DetalheCotacao } from './paginas/cotacoes/Detalhe';
import { Equalizacao } from './paginas/cotacoes/Equalizacao';
import { ListaPedidos } from './paginas/pedidos/Lista';
import { DetalhePedido } from './paginas/pedidos/Detalhe';
import { PainelRecebimento } from './paginas/recebimento/Painel';
import { ConferirRecebimento } from './paginas/recebimento/Conferir';
import { PainelEstoque } from './paginas/estoque/Painel';
import { MovimentosEstoque } from './paginas/estoque/Movimentos';
import { PainelFinanceiro } from './paginas/financeiro/Painel';
import { NotasFiscais } from './paginas/financeiro/Notas';
import { Lancamentos } from './paginas/financeiro/Lancamentos';
import { PainelRelatorios } from './paginas/relatorios/Painel';
import { PainelLocacao } from './paginas/locacao/Painel';
import {
  IndiceCompras, IndiceAlmoxarifado, IndiceFinanceiro, IndiceAdministracao,
} from './paginas/Indices';
import { Portal } from './paginas/Portal';
import { CriarSenha } from './paginas/CriarSenha';
import { Icone } from './componentes/Icone';

/** Bloqueia a tela para quem não tem a permissão necessária. */
function Protegida({
  permissoes,
  children,
}: {
  permissoes: string[];
  children: React.ReactNode;
}) {
  const { pode } = useAutenticacao();

  if (permissoes.length > 0 && !pode(...permissoes)) {
    return (
      <section className="secao">
        {/* O <h1> existe para esta tela ter título como todas as
            outras. Era a única sem — e quem navega por leitor de tela
            usa o <h1> para saber onde caiu. A classe o esconde do
            olho: o aviso abaixo já diz a mesma coisa, em voz alta. */}
        <h1 className="apenas-leitor-tela">Sem acesso a esta tela</h1>
        <div className="aviso aviso--erro" role="alert">
          <Icone nome="cadeado" className="aviso__icone" />
          <div>
            <strong>Você não tem acesso a esta tela.</strong>
            <p>Se precisar dela para trabalhar, fale com o administrador do sistema.</p>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}

function Rotas() {
  const { usuario, carregando } = useAutenticacao();

  // Enquanto conferimos o cookie, não decidimos nada: mostrar a
  // tela de login aqui faria ela "piscar" para quem já estava logado.
  if (carregando) {
    return (
      <div className="tela-cheia">
        <Carregando mensagem="Abrindo o sistema..." />
      </div>
    );
  }

  if (!usuario) {
    return (
      <Routes>
        {/* O portal do fornecedor é público: quem tem o link entra
            sem login. Precisa vir antes do desvio para /entrar. */}
        <Route path="/portal/:token" element={<Portal />} />
        {/* O convite de senha, pelo mesmo motivo: quem chega aqui
            ainda não tem senha para entrar. */}
        <Route path="/senha/:token" element={<CriarSenha />} />
        <Route path="/entrar" element={<Entrar />} />
        <Route path="*" element={<Navigate to="/entrar" replace />} />
      </Routes>
    );
  }

  // ----------------------------------------------------------
  //  O ESTADO DO MEIO: entrou, mas a senha não é dela
  //
  //  Entre "sem conta" e "com conta" falta um terceiro estado, e
  //  a falta dele custava a promessa inteira: até 09/10/2026 a
  //  marca `precisaTrocarSenha` era escrita no banco, mandada no
  //  login e declarada no tipo — e nenhuma tela a lia. Quem
  //  recebia uma senha do administrador entrava com ela e seguia
  //  usando o sistema para sempre.
  //
  //  Aqui não há menu, não há barra lateral e não há endereço que
  //  escape: qualquer rota cai na troca de senha. Sair continua
  //  valendo, porque prender alguém dentro do sistema seria pior
  //  que o problema original.
  //
  //  O servidor recusa o resto por conta própria (ver o porteiro
  //  em `plugins/autenticacao.ts`). Esta tela é o conforto; a
  //  trava é lá.
  // ----------------------------------------------------------
  if (usuario.precisaTrocarSenha) {
    return (
      <Routes>
        <Route path="/portal/:token" element={<Portal />} />
        <Route path="/senha/:token" element={<CriarSenha />} />
        <Route
          path="*"
          element={
            /* Mesmo pano de fundo da tela de entrada, e de
               propósito: quem está aqui ainda não entrou de
               verdade. */
            <div className="entrada">
              {/* Sem moldura propria: quem desenha a caixa e o
                  `Cartao` do formulario, la dentro. Duas molduras
                  uma dentro da outra e o defeito que a Parte 1.11
                  do DESIGN chama de hierarquia de borda dobrada. */}
              <main className="entrada__sozinha">
                <MinhaSenha primeiroAcesso />
              </main>
            </div>
          }
        />
      </Routes>
    );
  }

  return (
    <Routes>
      {/* Também acessível para quem está logado: o comprador pode
          querer conferir como o fornecedor está vendo o pedido. */}
      <Route path="/portal/:token" element={<Portal />} />
      <Route path="/senha/:token" element={<CriarSenha />} />
      <Route path="/entrar" element={<Navigate to="/" replace />} />

      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="minha-senha" element={<MinhaSenha />} />

        <Route
          path="solicitacoes"
          element={
            <Protegida permissoes={['solicitacoes.criar', 'solicitacoes.ver_todas']}>
              <ListaSolicitacoes />
            </Protegida>
          }
        />

        <Route
          path="solicitacoes/:id"
          element={
            <Protegida permissoes={['solicitacoes.criar', 'solicitacoes.ver_todas']}>
              <DetalheSolicitacao />
            </Protegida>
          }
        />

        <Route
          path="aprovacoes"
          element={
            <Protegida permissoes={['solicitacoes.aprovar']}>
              <FilaAprovacao />
            </Protegida>
          }
        />

        <Route
          path="cotacoes"
          element={
            <Protegida permissoes={['cotacoes.gerenciar']}>
              <ListaCotacoes />
            </Protegida>
          }
        />

        <Route
          path="cotacoes/:id/equalizacao"
          element={
            <Protegida permissoes={['cotacoes.gerenciar']}>
              <Equalizacao />
            </Protegida>
          }
        />

        <Route
          path="pedidos"
          element={
            <Protegida permissoes={['pedidos.gerenciar', 'financeiro.ver']}>
              <ListaPedidos />
            </Protegida>
          }
        />

        <Route
          path="pedidos/:id"
          element={
            <Protegida permissoes={['pedidos.gerenciar', 'financeiro.ver']}>
              <DetalhePedido />
            </Protegida>
          }
        />

        <Route
          path="cotacoes/:id"
          element={
            <Protegida permissoes={['cotacoes.gerenciar']}>
              <DetalheCotacao />
            </Protegida>
          }
        />

        <Route
          path="recebimento"
          element={
            <Protegida permissoes={['recebimento.registrar']}>
              <PainelRecebimento />
            </Protegida>
          }
        />

        <Route
          path="recebimento/:numero"
          element={
            <Protegida permissoes={['recebimento.registrar']}>
              <ConferirRecebimento />
            </Protegida>
          }
        />

        <Route
          path="estoque"
          element={
            <Protegida permissoes={['estoque.ver']}>
              <PainelEstoque />
            </Protegida>
          }
        />

        <Route
          path="estoque/movimentos"
          element={
            <Protegida permissoes={['estoque.ver']}>
              <MovimentosEstoque />
            </Protegida>
          }
        />

        <Route
          path="locacao"
          element={
            <Protegida permissoes={['locacao.ver']}>
              <PainelLocacao />
            </Protegida>
          }
        />

        <Route
          path="relatorios"
          element={
            <Protegida permissoes={['relatorios.ver']}>
              <PainelRelatorios />
            </Protegida>
          }
        />

        <Route
          path="financeiro"
          element={
            <Protegida permissoes={['financeiro.ver']}>
              <IndiceFinanceiro />
            </Protegida>
          }
        />

        {/* O painel de contas a pagar MORAVA em /financeiro. Saiu de
            lá para o endereço dele deixar de ser a porta de um
            destino inteiro. */}
        <Route
          path="financeiro/contas"
          element={
            <Protegida permissoes={['financeiro.ver']}>
              <PainelFinanceiro />
            </Protegida>
          }
        />

        <Route
          path="financeiro/notas"
          element={
            <Protegida permissoes={['financeiro.ver']}>
              <NotasFiscais />
            </Protegida>
          }
        />

        <Route
          path="financeiro/lancamentos"
          element={
            <Protegida permissoes={['financeiro.ver']}>
              <Lancamentos />
            </Protegida>
          }
        />

        {/* ---------- As quatro telas índice ----------

            São as portas dos quatro destinos da barra lateral. A
            permissão de cada uma é a UNIÃO das permissões dos
            cartões que ela mostra: quem vê pelo menos um cartão
            entra; quem não vê nenhum é barrado aqui, e não numa
            tela índice vazia.
            --------------------------------------------------- */}
        <Route
          path="compras"
          element={
            <Protegida
              permissoes={[
                'solicitacoes.criar', 'solicitacoes.ver_todas', 'solicitacoes.aprovar',
                'cotacoes.gerenciar', 'pedidos.gerenciar', 'financeiro.ver',
              ]}
            >
              <IndiceCompras />
            </Protegida>
          }
        />

        <Route
          path="almoxarifado"
          element={
            <Protegida permissoes={['recebimento.registrar', 'estoque.ver', 'locacao.ver']}>
              <IndiceAlmoxarifado />
            </Protegida>
          }
        />

        <Route
          path="administracao"
          element={
            <Protegida
              permissoes={[
                'materiais.ver', 'obras.ver', 'fornecedores.ver', 'alcadas.gerenciar',
                'usuarios.ver', 'sistema.integracoes', 'sistema.status',
              ]}
            >
              <IndiceAdministracao />
            </Protegida>
          }
        />

        {/* O endereço antigo do índice de cadastros. As telas FILHAS
            continuam em /cadastros/... — só a porta mudou de nome,
            e manter o atalho custa três linhas. */}
        <Route path="cadastros" element={<Navigate to="/administracao" replace />} />

        <Route
          path="cadastros/familias"
          element={
            <Protegida permissoes={['materiais.ver']}>
              <Familias />
            </Protegida>
          }
        />

        <Route
          path="cadastros/materiais"
          element={
            <Protegida permissoes={['materiais.ver']}>
              <Materiais />
            </Protegida>
          }
        />

        <Route
          path="cadastros/fornecedores"
          element={
            <Protegida permissoes={['fornecedores.ver']}>
              <Fornecedores />
            </Protegida>
          }
        />

        <Route
          path="cadastros/obras"
          element={
            <Protegida permissoes={['obras.ver']}>
              <Obras />
            </Protegida>
          }
        />

        <Route
          path="cadastros/obras/:id"
          element={
            <Protegida permissoes={['obras.ver']}>
              <ObraDetalhe />
            </Protegida>
          }
        />

        <Route
          path="cadastros/alcadas"
          element={
            <Protegida permissoes={['alcadas.gerenciar', 'solicitacoes.aprovar']}>
              <Alcadas />
            </Protegida>
          }
        />

        <Route
          path="admin/usuarios"
          element={
            <Protegida permissoes={['usuarios.ver']}>
              <Usuarios />
            </Protegida>
          }
        />

        {/* O endereço antigo das funções, de quando elas tinham tela
            própria. Continua respondendo: link salvo, favorito e
            histórico do navegador não podem morrer numa arrumação
            de menu. */}
        <Route
          path="admin/funcoes"
          element={<Navigate to="/admin/usuarios?ver=funcoes" replace />}
        />

        <Route
          path="admin/avisos"
          element={
            <Protegida permissoes={['sistema.integracoes']}>
              <Avisos />
            </Protegida>
          }
        />

        {/* O endereço antigo continua valendo: cai na aba do WhatsApp. */}
        <Route
          path="admin/whatsapp"
          element={
            <Protegida permissoes={['sistema.integracoes']}>
              <Avisos />
            </Protegida>
          }
        />

        <Route
          path="admin/status"
          element={
            <Protegida permissoes={['sistema.status']}>
              <StatusSistema />
            </Protegida>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ProvedorAutenticacao>
        <Rotas />
      </ProvedorAutenticacao>
    </BrowserRouter>
  );
}
