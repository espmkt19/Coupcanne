# Guia Rápido para Testar no Celular

## Passo 1: Implantar a Aplicação

### Opção A: Vercel (Recomendado)
```bash
# Instale o Vercel CLI
npm install -g vercel

# Faça login
vercel login

# Implante
vercel
```

### Opção B: GitHub Pages
```bash
# Instale gh-pages
npm install -D gh-pages

# Adicione homepage ao package.json
# "homepage": "https://seu-usuario.github.io/nome-do-repositorio"

# Implante
npm run deploy
```

## Passo 2: Acessar no Celular

1. Abra a URL fornecida pelo serviço de implantação
2. Conceda as permissões solicitadas:
   - 📍 Localização (GPS)
   - 📱 Movimento (Acelerômetro)
   - 🎤 Microfone (Para gravação de áudio)

## Passo 3: Testar as Funcionalidades

### 1. Rastreamento Básico
- Clique em "Iniciar" para começar o rastreamento
- Coloque o celular no bolso de frente
- Ande por uma distância conhecida
- Verifique se a distância registrada corresponde

### 2. Pontos no Mapa
- Clique em qualquer local no mapa para adicionar um ponto
- Marque pontos importantes como problemas na cana
- Verifique se os pontos aparecem na lista

### 3. Gravação de Áudio
- Clique no ícone do microfone para gravar
- Fale sua mensagem para o gerente
- Clique novamente para parar
- Reproduza para verificar a qualidade

### 4. Salvar e Exportar
- Clique em "Salvar Rota" para guardar o caminho
- Clique em "Exportar CSV" para baixar os dados
- Verifique o arquivo no Excel ou Google Sheets

## Passo 4: Verificar Precisão

1. Ande 100 metros em linha reta
2. Verifique se a distância registrada está entre 95-105 metros
3. Verifique se o número de passos está correto (aprox. 130 passos para 100m)
4. Verifique se a velocidade média é razoável (aprox. 4-5 km/h)

## Problemas Comuns e Soluções

### GPS Não Funciona
- Verifique se a localização está ativada no celular
- Certifique-se de estar em local aberto com sinal GPS forte
- Reinicie o navegador e a página

### Acelerômetro Não Funciona
- Coloque o celular no bolso de frente
- Ande com passos normais
- Verifique se a permissão de movimento foi concedida

### Mapa Não Carrega
- Verifique a conexão de internet
- Limpar cache do navegador
- Tente um navegador diferente

### Áudio Não Grava
- Verifique se a permissão de microfone foi concedida
- Certifique-se de que o microfone está funcionando
- Reinicie o navegador

## Dicas para Melhor Precisão

1. Coloque o celular no bolso de frente
2. Ande com passos normais e consistentes
3. Evite áreas com interferência GPS (edifícios, árvores)
4. Use em locais abertos com sinal GPS forte
5. Calibre o comprimento de passo se necessário

## Recursos Necessários

- Celular com GPS e acelerômetro
- Conexão de internet (para carregar o mapa)
- Navegador moderno (Chrome, Firefox, Safari)
- Permissões concedidas pelo usuário

## Suporte

Se encontrar problemas:
1. Verifique o console do navegador (F12 no desktop)
2. Veja se há erros na implantação
3. Verifique as permissões do dispositivo
4. Tente um navegador diferente
5. Reinicie o dispositivo

Boa sorte com os testes! 🎉