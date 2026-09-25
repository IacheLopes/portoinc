// ============================================================
//  Escolher a cidade de uma lista, e o estado vir junto
//
//  Pedido do dono na validação de 25/09/2026: "ao invés do usuário
//  digitar o nome da cidade, ele poderia escolher, e quando ele
//  escolher a UF ser preenchida automática".
//
//  A ideia dele resolveu um problema que eu não ia conseguir
//  resolver bem: 232 nomes de município existem em mais de um estado
//  — "Bom Jesus" em cinco. Adivinhar o estado a partir do nome erra.
//  ESCOLHENDO, não se escolhe um nome: escolhe-se um município. A
//  dúvida acaba antes de existir.
//
//  De quebra, acaba a grafia solta. Hoje dá para cadastrar "São
//  Paulo", "Sao Paulo" e "SAO PAULO" como se fossem três lugares.
//
//  A lista sugere, mas não prende: quem digitar um nome que não está
//  lá continua conseguindo salvar. Município criado depois de 2023,
//  ou distrito que não é município (Fernando de Noronha é distrito
//  de PE), existem de verdade — e quem não consegue cadastrar arruma
//  um jeito torto, que é sempre pior.
// ============================================================

import { useEffect, useId, useRef, useState } from 'react';
import {
  carregarMunicipios, procurarMunicipios, type Municipio,
} from '../servicos/municipios';

interface Props {
  cidade: string;
  aoMudarCidade: (cidade: string) => void;
  /** Chamado quando a pessoa ESCOLHE da lista, com a UF do município. */
  aoEscolherUf: (uf: string) => void;
  desabilitado?: boolean;
}

export function CampoCidade({ cidade, aoMudarCidade, aoEscolherUf, desabilitado }: Props) {
  const id = useId();
  const idLista = id + '-lista';

  const [lista, setLista] = useState<Municipio[]>([]);
  const [sugestoes, setSugestoes] = useState<Municipio[]>([]);
  const [aberto, setAberto] = useState(false);
  const [marcado, setMarcado] = useState(0);

  const caixa = useRef<HTMLDivElement>(null);

  // A lista dos 5.570 só desce quando alguém abre uma tela que a usa.
  useEffect(() => {
    let vivo = true;
    void carregarMunicipios().then((m) => { if (vivo) setLista(m); });

    return () => { vivo = false; };
  }, []);

  // Clique fora fecha. Sem isto a lista fica pendurada na tela depois
  // que a pessoa já desistiu dela.
  useEffect(() => {
    if (!aberto) return;

    function aoClicar(evento: MouseEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    }

    document.addEventListener('mousedown', aoClicar);

    return () => document.removeEventListener('mousedown', aoClicar);
  }, [aberto]);

  function digitou(texto: string) {
    aoMudarCidade(texto);

    const achados = procurarMunicipios(lista, texto);
    setSugestoes(achados);
    setMarcado(0);
    setAberto(achados.length > 0);
  }

  function escolher(m: Municipio) {
    aoMudarCidade(m.nome);
    aoEscolherUf(m.uf);
    setAberto(false);
    setSugestoes([]);
  }

  function aoTeclar(evento: React.KeyboardEvent) {
    if (!aberto || sugestoes.length === 0) return;

    if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setMarcado((i) => (i + 1) % sugestoes.length);
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setMarcado((i) => (i - 1 + sugestoes.length) % sugestoes.length);
    } else if (evento.key === 'Enter') {
      // Dentro de um formulário, Enter enviaria. Aqui ele escolhe.
      evento.preventDefault();
      escolher(sugestoes[marcado]);
    } else if (evento.key === 'Escape') {
      setAberto(false);
    }
  }

  return (
    <div className="campo campo-cidade" ref={caixa}>
      <label className="campo__rotulo" htmlFor={id}>
        Cidade
        <span className="campo__opcional"> (opcional)</span>
      </label>

      <input
        id={id}
        type="text"
        className="campo__entrada campo__entrada--media"
        value={cidade}
        onChange={(e) => digitou(e.target.value)}
        onKeyDown={aoTeclar}
        onFocus={() => { if (sugestoes.length > 0) setAberto(true); }}
        placeholder="comece a digitar"
        disabled={desabilitado}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-describedby={id + '-ajuda'}
      />

      {aberto && (
        <ul className="campo-cidade__lista" id={idLista} role="listbox">
          {sugestoes.map((m, i) => (
            <li key={m.nome + m.uf} role="option" aria-selected={i === marcado}>
              <button
                type="button"
                className={'campo-cidade__opcao' + (i === marcado ? ' campo-cidade__opcao--marcada' : '')}
                // `onMouseDown` e não `onClick`: o clique tira o foco
                // do campo antes de o clique terminar, e a lista
                // fechava antes de a escolha acontecer.
                onMouseDown={(e) => { e.preventDefault(); escolher(m); }}
                onMouseEnter={() => setMarcado(i)}
              >
                {m.nome} <span className="campo-cidade__uf">{m.uf}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="campo__ajuda" id={id + '-ajuda'}>
        Escolhendo da lista, o estado é preenchido sozinho.
      </p>
    </div>
  );
}
