Write-Host "Parando e removendo containers, volumes e builds antigos..." -ForegroundColor Yellow
docker-compose down --volumes --remove-orphans
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao limpar o ambiente. Abortando." -ForegroundColor Red
    exit 1
}
Write-Host "Ambiente anterior limpo com sucesso." -ForegroundColor Green
Write-Host ""

Write-Host "Limpando cache Docker, imagens nao utilizadas e volumes..." -ForegroundColor Yellow
docker system prune -af --volumes
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao limpar cache Docker. Abortando." -ForegroundColor Red
    exit 1
}
Write-Host "Cache Docker limpo com sucesso." -ForegroundColor Green
Write-Host ""

Write-Host "Construindo novas imagens Docker do zero..." -ForegroundColor Yellow
docker-compose build --no-cache --build-arg BUILDKIT_INLINE_CACHE=1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao construir as imagens. Abortando." -ForegroundColor Red
    exit 1
}
Write-Host "Imagens construidas com sucesso." -ForegroundColor Green
Write-Host ""

Write-Host "Iniciando todos os servicos em segundo plano..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha ao iniciar os servicos. Abortando." -ForegroundColor Red
    exit 1
}
Write-Host "Todos os servicos do SchemaAPI foram iniciados com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "API principal rodando em: http://localhost:8081" -ForegroundColor Cyan
Write-Host "API Python de vectorizacao em: http://localhost:8001" -ForegroundColor Cyan
Write-Host "RabbitMQ UI em: http://localhost:15672" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para monitorar logs: docker-compose logs -f" -ForegroundColor Yellow
Write-Host "Para parar todos os servicos: docker-compose down" -ForegroundColor Yellow