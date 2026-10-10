// ============================================================
//  Comunicação
//
//  WhatsApp e e-mail fazem o MESMO trabalho: levar o convite de
//  cotação e o pedido de compra até o fornecedor. Têm a mesma
//  trava (lista de autorizados) e o mesmo histórico.
//
//  Por isso ficam numa tela só, em duas abas. Duas telas quase
//  iguais no menu obrigariam a pessoa a lembrar em qual delas
//  estava a coisa que ela procura — e o bloco Administração já
//  tem quatro itens, que é o limite em que o olho ainda bate a
//  vista sem contar.
//
//  A aba escolhida vai para o endereço (?ver=email): recarregar
//  a página não joga a pessoa de volta para a primeira aba.
//
//  O RESUMO EM CIMA, E POR QUE ELE EXISTE
//
//  Antes, saber se o WhatsApp estava conectado exigia abrir a aba
//  do WhatsApp; saber do e-mail, abrir a outra. Quem chega aqui
//  quer exatamente isto: o convite sai ou não sai? Agora os dois
//  estados aparecem juntos, antes das abas.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfiguracaoWhatsApp } from './WhatsApp';
import { ConfiguracaoEmail } from './Email';
import { HistoricoComunicacao } from './HistoricoComunicacao';
import { CabecalhoDePagina } from '../../componentes/CabecalhoDePagina';
import { Selo, type TipoSelo } from '../../componentes/Selo';
import { buscarSituacao, type SituacaoWhatsApp } from '../../servicos/whatsapp';
import { buscarSituacaoEmail, type SituacaoEmail } from '../../servicos/email';

const ABAS = [
  {
    chave: 'whatsapp',
    rotulo: 'WhatsApp',
    intro:
      'Conectar um número para o sistema enviar convites de cotação e pedidos de compra ' +
      'sem sair da tela.',
  },
  {
    chave: 'email',
    rotulo: 'E-mail',
    intro:
      'O mesmo convite e o mesmo pedido, pelo e-mail do fornecedor. O pedido vai com o ' +
      'PDF em anexo.',
  },
  {
    //  A PROVA DE QUE SAIU.
    //
    //  Esta lista morava no pé da aba do WhatsApp e atrapalhava
    //  duas vezes: enchia uma tela que é de configurar, e mostrava
    //  um canal só. Aqui os dois ficam juntos, porque WhatsApp e
    //  e-mail levam o MESMO convite.
    chave: 'historico',
    rotulo: 'Mensagens enviadas',
    intro:
      'Tudo que o sistema tentou mandar, pelos dois canais. É aqui que se confere quando ' +
      'um fornecedor diz que não recebeu.',
  },
] as const;

type Aba = (typeof ABAS)[number]['chave'];

function ehAba(valor: string | null): valor is Aba {
  return ABAS.some((a) => a.chave === valor);
}

/** Como o estado de um canal se lê em português. */
interface Leitura {
  tipo: TipoSelo;
  texto: string;
  detalhe: string;
}

function lerWhatsApp(s: SituacaoWhatsApp | null): Leitura {
  if (!s) return { tipo: 'info', texto: 'Conferindo', detalhe: '' };
  if (s.estado === 'conectado') {
    return {
      tipo: 'sucesso',
      texto: 'Conectado',
      detalhe: s.numero
        ? 'Pelo número ' + s.numero
        : 'Pronto para enviar convite e pedido',
    };
  }
  return {
    tipo: 'atencao',
    texto: 'Não conectado',
    detalhe: 'Nenhuma mensagem sai enquanto não houver um número conectado',
  };
}

function lerEmail(s: SituacaoEmail | null): Leitura {
  if (!s) return { tipo: 'info', texto: 'Conferindo', detalhe: '' };

  //  "PRONTO" TEM DE QUERER DIZER QUE O E-MAIL CHEGA.
  //
  //  A primeira versão disto olhava só `pronto`, que quer dizer
  //  "tem remetente configurado" — e dizia PRONTO com o adaptador
  //  simulado, onde nada sai. Um resumo que mente para o lado
  //  otimista é pior do que resumo nenhum: quem lesse mandaria o
  //  pedido e iria embora achando que o fornecedor recebeu.
  if (s.simulado) {
    return {
      tipo: 'atencao',
      texto: 'Não sai ainda',
      detalhe: 'Os e-mails ficam registrados no histórico, sem chegar a ninguém',
    };
  }

  if (s.pronto) {
    return {
      tipo: 'sucesso',
      texto: 'Pronto',
      detalhe: s.remetente ? 'Sai de ' + s.remetente : 'Pronto para enviar',
    };
  }

  return {
    tipo: 'atencao',
    texto: 'Não configurado',
    detalhe: 'Nenhum e-mail sai enquanto não houver um remetente configurado',
  };
}

export function Avisos() {
  const [parametros, setParametros] = useSearchParams();
  const [whatsapp, setWhatsapp] = useState<SituacaoWhatsApp | null>(null);
  const [email, setEmail] = useState<SituacaoEmail | null>(null);

  const pedida = parametros.get('ver');
  const aba: Aba = ehAba(pedida) ? pedida : 'whatsapp';
  const atual = ABAS.find((a) => a.chave === aba)!;

  //  O resumo não pode derrubar a tela: se um dos dois não
  //  responder, o outro ainda aparece e as abas continuam
  //  funcionando, que é onde a configuração de verdade acontece.
  const conferir = useCallback(async () => {
    const [w, e] = await Promise.allSettled([buscarSituacao(), buscarSituacaoEmail()]);
    if (w.status === 'fulfilled') setWhatsapp(w.value);
    if (e.status === 'fulfilled') setEmail(e.value);
  }, []);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  return (
    <>
      <section className="secao">
        <CabecalhoDePagina
          titulo="Comunicação"
          descricao={
            <>O convite de cotação e o pedido de compra chegando até quem vai vender.</>
          }
        />

        {/* O ESTADO MORA NA ABA, NÃO NUM CARTÃO ACIMA DELA.
            Até 10/10/2026 havia dois cartões de resumo aqui em
            cima. Eles nasceram quando cada aba abria sem dizer se
            o canal estava de pé — e ficaram sendo eco no dia em
            que a aba passou a liderar com o estado em corpo
            grande. O mesmo fato, duas vezes, a 300px de distância.

            O selo na aba guarda o que os cartões traziam de útil:
            dá para ver os DOIS canais sem clicar em nenhum. */}
        <div className="abas" role="tablist" aria-label="Canais de envio">
          {ABAS.map((a) => {
            //  O selo diz se o CANAL está de pé. A aba do histórico
            //  não é um canal: ela não tem o que mostrar ali.
            const leitura =
              a.chave === 'whatsapp'
                ? lerWhatsApp(whatsapp)
                : a.chave === 'email'
                  ? lerEmail(email)
                  : null;

            return (
              <button
                key={a.chave}
                type="button"
                role="tab"
                id={'aba-' + a.chave}
                aria-selected={a.chave === aba}
                aria-controls={'painel-' + a.chave}
                className={'aba aba--com-selo' + (a.chave === aba ? ' aba--ativa' : '')}
                onClick={() => setParametros({ ver: a.chave })}
              >
                {a.rotulo}
                {leitura && <Selo tipo={leitura.tipo}>{leitura.texto}</Selo>}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={'painel-' + aba}
          aria-labelledby={'aba-' + aba}
          className="aba__conteudo"
        >
          <p className="aba__pergunta">{atual.intro}</p>
        </div>
      </section>

      {aba === 'whatsapp' && <ConfiguracaoWhatsApp />}
      {aba === 'email' && <ConfiguracaoEmail />}
      {aba === 'historico' && <HistoricoComunicacao />}
    </>
  );
}
