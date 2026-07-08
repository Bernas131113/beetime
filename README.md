# BeeTime 🐝

**BeeTime** é uma alternativa moderna, premium e *offline-first* ao **TV Time**, desenvolvida especificamente para uso pessoal offline. Guarda todos os teus dados de visualização localmente no teu browser usando `IndexedDB`, garantindo total privacidade e portabilidade, sem necessidade de servidores externos ou contas de terceiros.

---

## ✨ Funcionalidades Principais

- 📊 **Painel de Estatísticas**: O clássico mostrador do TV Time com tempo acumulado em **Meses, Dias, Horas e Minutos**, além de contagens detalhadas de episódios vistos, séries ativas, filmes guardados e secção de favoritos.
- 📺 **A Seguir (Watchlist)**: Lista dinâmica das tuas séries ativas com indicação do próximo episódio a ver, barra de progresso e contagem de episódios em atraso ("3 episódios atrás").
- 📅 **Calendário**: Agenda cronológica com as datas de estreia dos próximos episódios das séries que acompanhas, permitindo planear o que ver a seguir.
- 🔍 **Descoberta Dinâmica**: Pesquisa por metadados de séries e filmes atualizados com o motor do **TMDB (The Movie Database)**. Inclui sugestões semanais de tendências para descobrires novo conteúdo.
- ⭐ **Avaliações e Reações**: Nos detalhes de cada episódio ou filme, podes dar uma classificação por estrelas e selecionar a tua reação emoji (Amei 😍, Feliz 😀, Triste 😢, etc.), tal como fazias no TV Time!
- 📤 **Portabilidade de Dados**: Exporta e importa cópias de segurança completas em formato JSON para salvaguardares os teus dados ou migrares para outro browser/computador.
- 🐝 **Migração do TV Time**: Importador integrado que lê o teu ficheiro CSV exportado oficial do TV Time (`seen_episode.csv` ou `tracking-prod-records-v2.csv`), mapeia as colunas de forma inteligente e descarrega os metadados do TMDB automaticamente em segundo plano.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
Certifica-se de que tem o **Node.js** instalado na sua máquina.

### Passos
1. Abra um terminal na pasta do projeto (`D:\BeeTime`).
2. Instale as dependências:
   ```bash
   npm install
   ```
   *(Nota: Já instalámos as dependências principais por si: `react`, `lucide-react` e `dexie`)*

3. Inicie o servidor de desenvolvimento local:
   ```bash
   npm run dev
   ```
4. Abra o endereço que aparecer no terminal (geralmente `http://localhost:5173`) no seu browser.

---

## 🔑 Configuração Inicial (TMDB)

1. Para que a pesquisa de séries, capas, poster e metadados de episódios funcione, vá à secção **Definições** no menu lateral do BeeTime.
2. Crie uma conta gratuita em [themoviedb.org](https://www.themoviedb.org/).
3. Aceda às definições da sua conta TMDB, vá à secção **API** e solicite uma chave (gratuita para uso pessoal).
4. Copie a **API Key (v3)** gerada, introduza-a no campo correspondente nas Definições do BeeTime e clique em **Validar e Guardar**.

---

## 📂 Como Importar os Dados do TV Time

1. Vá à secção **Definições** no menu lateral.
2. Clique no botão **Abrir Importador do TV Time**.
3. Selecione o seu ficheiro `seen_episode.csv` ou `tracking-prod-records-v2.csv` (obtido a partir da exportação oficial GDPR do TV Time).
4. O importador detetará automaticamente os cabeçalhos. Verifique se o mapeamento de colunas está correto (Nome da Série, Temporada, Episódio e Data).
5. Clique em **Iniciar Importação**. O BeeTime irá procurar as séries correspondentes no TMDB e descarregar todas as informações de episódios e datas, reconstruindo todo o seu histórico no browser!
