// ============================================================
//  Leitura e validacao das variaveis de ambiente
//
//  Se faltar alguma configuracao obrigatoria, o sistema avisa
//  claramente na subida em vez de quebrar no meio do uso.
// ============================================================

import { z } from 'zod';

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL e obrigatoria'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa ter ao menos 32 caracteres'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  // --- Escolha dos adaptadores de integracao ---
  WHATSAPP_ADAPTER: z.enum(['mock', 'baileys', 'cloud-api']).default('mock'),
  FISCAL_ADAPTER: z.enum(['mock', 'sefaz']).default('mock'),
  PAGAMENTO_ADAPTER: z.enum(['mock', 'cnab', 'open-finance']).default('mock'),
  //  `desligado` e o padrao: instalacao nova nao manda e-mail
  //  nenhum ate alguem cadastrar a conta da empresa pela tela.
  //  O `mock` existe so para as provas automatizadas.
  EMAIL_ADAPTER: z.enum(['desligado', 'mock', 'resend']).default('desligado'),

  //  ASSISTENTE DE IA NO WHATSAPP
  //
  //  `IA_MODELO` em branco e o caso NORMAL, nao o excepcional: o
  //  adaptador pergunta a Groq o que a conta tem e escolhe. Catalogo
  //  de provedor muda sem avisar, e chumbar o nome aqui so adianta
  //  o dia em que o assistente emudece sem ninguem ter mexido.
  IA_ADAPTER: z.enum(['mock', 'groq']).default('mock'),
  IA_MODELO: z.string().optional(),

  //  `IA_RESPONDE_SOZINHO` SAIU DAQUI EM 15/10/2026.
  //
  //  Era a trava do modo rascunho: com 'false' o assistente lia,
  //  pensava e GUARDAVA a resposta sem mandar. A ideia era boa e o
  //  efeito foi ruim — havia DUAS chaves para o assistente falar
  //  (esta e a da tela), e com o QR lido e o grupo liberado ele
  //  continuava muda sem nada explicando por que.
  //
  //  Quem ligar pela tela liga de verdade. Nao ponha a variavel de
  //  volta sem tirar a outra chave primeiro.

  // --- Credenciais (so exigidas quando o adaptador real for ligado) ---
  WHATSAPP_SESSAO_DIR: z.string().default('/app/sessao-whatsapp'),
  /** Com 'true', so envia para numero da lista de autorizados. */
  WHATSAPP_MODO_TESTE: z.enum(['true','false']).default('true'),
  WHATSAPP_CLOUD_TOKEN: z.string().optional(),
  WHATSAPP_CLOUD_PHONE_ID: z.string().optional(),
  SEFAZ_CERTIFICADO_CAMINHO: z.string().optional(),
  SEFAZ_CERTIFICADO_SENHA: z.string().optional(),
  BANCO_CODIGO: z.string().optional(),
  /** Com 'true', so envia para endereco da lista de autorizados. */
  EMAIL_API_TOKEN: z.string().optional(),
  //  Chave da Groq. Vale dinheiro e da acesso a conta: so no .env.
  IA_API_TOKEN: z.string().optional(),
  EMAIL_REMETENTE: z.string().optional(),
  /** Onde ficam os arquivos guardados (NF em PDF, XML). */
  ARQUIVOS_DIR: z.string().default('/app/arquivos'),
});

const resultado = esquema.safeParse(process.env);

if (!resultado.success) {
  console.error('\n[ERRO] Configuracao invalida no arquivo .env:\n');
  for (const problema of resultado.error.issues) {
    console.error('  - ' + problema.path.join('.') + ': ' + problema.message);
  }
  console.error('\nCopie o .env.example para .env e preencha os valores.\n');
  process.exit(1);
}

export const ambiente = resultado.data;
export type Ambiente = typeof ambiente;
