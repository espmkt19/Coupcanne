# Guia de Implantação e Teste no Celular

## Opção 1: Usar Vercel (Recomendado - Grátis e Fácil)

### 1. Instale o Vercel CLI
```bash
npm install -g vercel
```

### 2. Faça login na sua conta Vercel
```bash
vercel login
```

### 3. Implante a aplicação
```bash
vercel
```

### 4. Siga as instruções:
- Selecione "Set up and deploy"
- Confirme o nome do projeto
- Selecione o diretório de implantação
- Escolha "No" para "Do you want to override the settings?"

### 5. Acesse a URL fornecida
Você receberá uma URL como: `https://seu-projeto.vercel.app`

### 6. Teste no celular
- Abra a URL no navegador do seu celular
- Conceda permissões de localização e movimento quando solicitado
- Coloque o celular no bolso e comece a andar para testar o rastreamento

## Opção 2: Usar GitHub Pages (Grátis)

### 1. Instale o gh-pages
```bash
npm install -D gh-pages
```

### 2. Adicione estas linhas ao package.json
```json
{
  "homepage": "https://seu-usuario.github.io/nome-do-repositorio",
  "scripts": {
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  }
}
```

### 3. Crie um repositório no GitHub
- Vá para https://github.com/new
- Crie um repositório com o nome desejado
- Não inicialize com README

### 4. Envie o código para o GitHub
```bash
git init
git add .
git commit -m "Primeira implantação"
git remote add origin https://github.com/seu-usuario/nome-do-repositorio.git
git branch -M main
git push -u origin main
```

### 5. Implante no GitHub Pages
```bash
npm run deploy
```

### 6. Acesse a URL
Acesse: `https://seu-usuario.github.io/nome-do-repositorio`

## Opção 3: Usar Netlify (Grátis)

### 1. Instale o Netlify CLI
```bash
npm install -g netlify-cli
```

### 2. Faça login
```bash
netlify login
```

### 3. Implante
```bash
netlify deploy --prod
```

### 4. Siga as instruções
- Selecione "Create & configure a new site"
- Confirme o nome do site
- Selecione o diretório (use `dist`)

### 5. Acesse a URL fornecida

## Testes Recomendados

### 1. Teste de GPS
- Saia para um local aberto com sinal GPS forte
- Inicie o rastreamento e caminhe uma distância conhecida
- Verifique se a distância registrada corresponde à real

### 2. Teste de Acelerômetro
- Coloque o celular no bolso (preferencialmente de frente)
- Ande com passos normais e veja se os passos são contados corretamente
- Verifique se a distância calculada corresponde à real

### 3. Teste de Pontos Personalizados
- Clique em diferentes locais no mapa
- Verifique se os marcadores são adicionados na posição correta
- Adicione descrições aos pontos

### 4. Teste de Gravação de Áudio
- Grave uma mensagem curta
- Reproduza para verificar a qualidade
- Verifique se as gravações são salvas corretamente

### 5. Teste de Salvar Rotas
- Faça um caminho completo
- Salve a rota com um nome
- Carregue a rota para verificar se os dados são mantidos

### 6. Teste de Exportação
- Exportar uma rota para CSV
- Abra o arquivo no Excel ou Google Sheets
- Verifique se todos os dados estão presentes

## Problemas Comuns e Soluções

### 1. GPS Não Funciona
- Verifique se a permissão de localização foi concedida
- Certifique-se de estar em um local com sinal GPS forte
- Reinicie o navegador e a página

### 2. Acelerômetro Não Funciona
- Verifique se a permissão de movimento foi concedida
- Certifique-se de que o celular tenha acelerômetro
- Coloque o celular no bolso corretamente

### 3. Mapa Não Carrega
- Verifique a conexão de internet
- Limpar cache do navegador
- Tente um navegador diferente

### 4. Áudio Não Grava
- Verifique se a permissão de microfone foi concedida
- Certifique-se de que o celular tenha microfone
- Reinicie o navegador

## Dicas para Melhor Precisão

1. **Coloque o celular no bolso de frente**: Melhor detecção de passos
2. **Ande com passos normais**: Não ande muito rápido ou muito devagar
3. **Mantenha o celular próximo ao corpo**: Reduz movimento desnecessário
4. **Use em locais abertos**: Melhor sinal GPS
5. **Calibre o comprimento de passo**: Ajuste na configuração se necessário
6. **Evite áreas com interferência**: Túneis, edifícios altos, árvores densas

## Compatibilidade

### Dispositivos Suportados
- Android 5.0+ com Chrome ou Firefox
- iOS 13+ com Safari ou Chrome
- Todos os navegadores modernos com suporte a GPS e acelerômetro

### Navegadores Recomendados
- Chrome (Android e iOS)
- Firefox (Android)
- Safari (iOS)

### Recursos Necessários
- GPS ativado
- Acelerômetro
- Microfone (para gravação de áudio)
- Conexão de internet (para carregar o mapa)
- Permissões concedidas pelo usuário

## Suporte

Se encontrar problemas durante o teste, verifique:
1. Console do navegador para erros (F12 no desktop)
2. Logs de implantação para erros
3. Permissões do dispositivo
4. Conexão de internet
5. Compatibilidade do navegador

## Próximos Passos

Depois de testar com sucesso, você pode:
1. Compartilhar a URL com os trabalhadores
2. Configurar domínio personalizado (opcional)
3. Adicionar autenticação de usuário (opcional)
4. Implementar backend para armazenamento de dados (opcional)
5. Adicionar notificações push (opcional)
6. Integrar com sistemas de gestão agrícola (opcional)

Boa sorte com os testes! 🎉