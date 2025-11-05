# Mudanças Implementadas - DeepSeek Desktop

## Resumo
Este documento descreve as alterações implementadas para corrigir os erros de inicialização do Electron e adaptar a interface para usar apenas API key ao invés de exigir login.

## Problemas Resolvidos

### 1. Erros de Inicialização do Electron
**Problema**: Ao executar `npm start`, apareciam vários erros:
- NSS crypto error (código -8018)
- Erros libva (inicialização de driver de vídeo)
- Erros GL surface presentation

**Solução**: Adicionadas flags de linha de comando no `index.js` para suprimir esses warnings:
```javascript
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--ignore-certificate-errors');
app.commandLine.appendSwitch('--disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('--disable-gpu');
```

### 2. Interface de Login vs API Key
**Problema**: A aplicação carregava o site oficial do DeepSeek (https://chat.deepseek.com) que exigia login convencional.

**Solução**: Criada interface customizada que:
- Solicita apenas a API key do usuário
- Armazena a API key de forma segura usando `safeStorage` do Electron
- Permite uso direto da API do DeepSeek sem necessidade de login
- Interface de chat completa que faz chamadas diretas à API

## Arquivos Criados

### 1. `apikey-config.html`
Interface de configuração da API key com:
- Campo para inserir a API key
- Botão para testar a validade da API key
- Botão para salvar e continuar
- Link para obter a API key no site da DeepSeek
- Design moderno e responsivo

### 2. `chat.html`
Interface de chat completa com:
- Design moderno inspirado em aplicativos de mensagens
- Suporte para múltiplos modelos (deepseek-chat, deepseek-reasoner)
- Histórico de conversação
- Indicador de digitação
- Formatação básica de markdown
- Zoom com Ctrl+Scroll e Ctrl+/-/0
- Botão para limpar chat
- Botão para acessar configurações

### 3. `chat-renderer.js`
Lógica do chat incluindo:
- Envio e recebimento de mensagens
- Formatação de mensagens (markdown básico)
- Gerenciamento do histórico de conversação
- Auto-resize do campo de entrada
- Suporte para Shift+Enter (nova linha) vs Enter (enviar)
- Indicador visual de carregamento

## Arquivos Modificados

### `index.js`
Principais mudanças:
1. **Imports adicionados**: `safeStorage` e `https`
2. **Flags de linha de comando**: Para suprimir erros do Electron
3. **Funções de gerenciamento de API key**:
   - `saveApiKeyToFile()`: Salva API key criptografada
   - `loadApiKeyFromFile()`: Carrega API key descriptografada
   - `hasApiKey()`: Verifica se existe API key salva
4. **Funções de API**:
   - `callDeepSeekAPI()`: Faz chamadas à API do DeepSeek
   - `testApiKey()`: Testa validade de uma API key
5. **Lógica de inicialização**: Carrega página de configuração se não houver API key, ou chat se houver
6. **Handlers IPC**:
   - `test-api-key`: Testa API key
   - `check-api-key`: Verifica se tem API key
   - `save-api-key`: Salva API key
   - `load-chat`: Carrega interface de chat
   - `open-api-key-config`: Abre configuração de API key
   - `send-chat-message`: Envia mensagem para API

## Como Usar

### Primeira Execução
1. Execute `npm install` para instalar dependências
2. Execute `npm start` para iniciar a aplicação
3. Na tela de configuração, insira sua API key do DeepSeek
   - Obtenha em: https://platform.deepseek.com/api_keys
4. Clique em "Testar API Key" (opcional) ou "Salvar e Continuar"
5. A interface de chat será carregada automaticamente

### Uso Normal
1. Digite sua mensagem no campo de entrada
2. Pressione Enter para enviar (Shift+Enter para nova linha)
3. Aguarde a resposta do assistente
4. O histórico da conversação é mantido durante a sessão

### Funcionalidades
- **Trocar modelo**: Use o seletor no cabeçalho para escolher entre:
  - DeepSeek Chat (conversação geral)
  - DeepSeek Reasoner (raciocínio avançado)
- **Limpar chat**: Botão "🗑️ Limpar Chat" no cabeçalho
- **Configurações**: Botão "⚙️ Configurações" para trocar API key
- **Zoom**:
  - Ctrl + "+" para aumentar
  - Ctrl + "-" para diminuir
  - Ctrl + "0" para resetar
  - Ctrl + Scroll do mouse

## Armazenamento Seguro
A API key é armazenada criptografada usando o módulo `safeStorage` do Electron:
- **Linux**: Usa libsecret/gnome-keyring
- **Fallback**: Se criptografia não disponível, usa base64 (menos seguro)
- **Localização**: `~/.config/DeepSeek Desktop/api_key.enc`

## Próximos Passos (Sugestões)
1. Adicionar suporte para streaming de respostas
2. Salvar histórico de conversações
3. Exportar conversações
4. Suporte para múltiplas conversações (tabs)
5. Configurações de temperatura e outros parâmetros
6. Suporte para anexar imagens (quando API suportar)
7. Contador de tokens e custo estimado

## Dependências
Não foram adicionadas novas dependências externas. Todas as funcionalidades usam módulos nativos do Node.js e Electron:
- `https`: Para chamadas à API
- `safeStorage`: Para armazenamento seguro
- `ipcMain/ipcRenderer`: Para comunicação entre processos

## Notas Técnicas
- A aplicação não carrega mais o site oficial do DeepSeek
- Todas as requisições são feitas diretamente para `https://api.deepseek.com/v1/chat/completions`
- O formato de mensagens segue o padrão OpenAI Chat Completions API
- Erros de rede e API são tratados e mostrados ao usuário
- A interface é responsiva e funciona em diferentes resoluções

## Testes
Para testar a aplicação:
1. Certifique-se de ter uma API key válida do DeepSeek
2. Execute `npm start`
3. Configure a API key
4. Envie uma mensagem de teste
5. Verifique se a resposta é exibida corretamente

## Troubleshooting
- **Erro 403 ao instalar**: Problema de rede ao baixar Electron. Tente novamente ou use VPN/proxy
- **API key inválida**: Verifique se a key começa com "sk-" e é válida no painel da DeepSeek
- **Erro de rede**: Verifique conexão com internet e firewall
- **Tela branca**: Abra DevTools (F12) para ver erros no console
