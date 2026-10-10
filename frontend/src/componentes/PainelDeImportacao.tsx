// ============================================================
//  Importar de planilha
//
//  UMA PEÇA PARA AS TRÊS IMPORTAÇÕES.
//
//  Nasceu dentro de `ObraDetalhe`, para o orçamento. Em
//  09/10/2026 a simulação de entrega mostrou que catálogo e
//  fornecedores também precisavam da porta: 10 campos por
//  material e 9 por fornecedor, vezes centenas de itens, é o
//  custo de uma construtora sair da planilha.
//
//  Copiar o painel três vezes garantiria três redações
//  diferentes na primeira correção — é a mesma história dos 29
//  cartões escritos à mão que deram origem ao `Cartao`.
//
//  O que muda de uma para outra é só: o título, o modelo de
//  arquivo, a explicação e a chamada. O resto — escolher o
//  arquivo ou colar, contar as linhas, mostrar os problemas com
//  o número da linha — é idêntico, e idêntico é o ponto.
// ============================================================

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ErroApi } from '../servicos/api';
import { plural } from '../servicos/texto';
import { Cartao } from './Cartao';
import { Icone } from './Icone';
import { ErroFormulario } from './Campo';

/** O que toda importação devolve. */
export interface ResultadoDaImportacao {
  importados: number;
  ignorados: number;
  problemas: string[];
  totalDeProblemas: number;
}

interface Props {
  titulo: string;
  /** As colunas, na ordem, como exemplo de arquivo. */
  modelo: string;
  /** O que esta planilha em particular exige. */
  ajuda: ReactNode;
  /** Como se chama o que entra: "linha", "material", "fornecedor". */
  oQueEntra: { um: string; muitos: string };
  aoImportar: (csv: string) => Promise<ResultadoDaImportacao>;
  aoConcluir: (mensagem: string) => Promise<void>;
}

export function PainelDeImportacao({
  titulo, modelo, ajuda, oQueEntra, aoImportar, aoConcluir,
}: Props) {
  const [csv, setCsv] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function aoEscolherArquivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const escolhido = evento.target.files?.[0];
    if (!escolhido) return;
    setCsv(await escolhido.text());
    setErro(null);
    setProblemas([]);
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setProblemas([]);
    setEnviando(true);

    try {
      const r = await aoImportar(csv);

      const partes = [
        plural(r.importados, oQueEntra.um + ' importado', oQueEntra.muitos + ' importados'),
      ];
      if (r.ignorados > 0) partes.push(r.ignorados + ' já existiam e foram ignorados');
      if (r.totalDeProblemas > 0) {
        partes.push(plural(r.totalDeProblemas, 'linha com problema', 'linhas com problema'));
      }

      // IMPORTOU COM RESSALVA NÃO É IMPORTAR EM SILÊNCIO.
      //
      // Quando alguma linha ficou de fora, a tela não fecha: quem
      // mandou a planilha precisa ver QUAIS linhas, com o número
      // delas, para corrigir o arquivo e reimportar.
      if (r.problemas.length > 0) {
        setProblemas(r.problemas);
        setEnviando(false);
        setErro('Importado com ressalvas: ' + partes.join(', ') + '.');
        return;
      }

      await aoConcluir(partes.join(', ') + '.');
    } catch (e) {
      if (e instanceof ErroApi) {
        setErro(e.message);
        setProblemas((e.detalhes ?? []).map((d) => (typeof d === 'string' ? d : d.mensagem)));
      } else {
        setErro('Não foi possível importar.');
      }
      setEnviando(false);
    }
  }

  const linhasDetectadas = csv.split(/\r?\n/).filter((l) => l.trim()).length;

  return (
    <form onSubmit={enviar} noValidate>
      <Cartao className="formulario" titulo={titulo}>

        <div className="aviso aviso--info">
          <Icone nome="prancheta" className="aviso__icone" />
          <div>
            <strong>Como preparar o arquivo</strong>
            <p>
              No Excel, use <em>Salvar como → CSV</em>. A primeira linha deve ser o
              cabeçalho, e as colunas nesta ordem:
            </p>
            <pre className="modelo">{modelo}</pre>
            {ajuda}
            <p>
              Aceita vírgula ou ponto e vírgula como separador. O que já existe é
              ignorado, então reimportar o mesmo arquivo não duplica nada.
            </p>
          </div>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="arquivo-csv">
            Arquivo CSV
          </label>
          <input
            ref={arquivo}
            id="arquivo-csv"
            type="file"
            accept=".csv,text/csv,text/plain"
            className="campo__entrada"
            onChange={(e) => void aoEscolherArquivo(e)}
          />
          <p className="campo__ajuda">
            Ou cole o conteúdo abaixo, se preferir.
          </p>
        </div>

        <div className="campo">
          <label className="campo__rotulo" htmlFor="conteudo-csv">
            Conteúdo
          </label>
          <textarea
            id="conteudo-csv"
            className="campo__entrada campo__area"
            rows={8}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder={modelo}
          />
          {linhasDetectadas > 1 && (
            <p className="campo__ajuda">
              {plural(
                linhasDetectadas - 1,
                'linha de dados detectada',
                'linhas de dados detectadas',
              )}, além do cabeçalho.
            </p>
          )}
        </div>

        {erro && <ErroFormulario mensagem={erro} detalhes={problemas} />}

        <div className="formulario__acoes">
          <button
            type="submit"
            className="botao botao--principal"
            disabled={enviando || !csv.trim()}
          >
            {enviando ? 'Importando...' : 'Importar'}
          </button>
        </div>
      </Cartao>
    </form>
  );
}
