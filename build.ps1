$Red = "\e[31m"
$Green = "\e[32m"
$Yellow = "\e[33m"
$Reset = "\e[0m"

Write-Host "${Yellow}Parando e removendo containers, volumes e builds antigos...${Reset}"
docker-compose down --volumes --remove-orphans
if ($LASTEXITCODE -ne 0) {
    Write-Host "${Red}Falha ao limpar o ambiente. Abortando.${Reset}"
    exit 1
}
Write-Host "${Green}Ambiente anterior limpo com sucesso.${Reset}"
Write-Host ""

Write-Host "${Yellow}Construindo novas imagens Docker do zero...${Reset}"
docker-compose build --no-cache
if ($LASTEXITCODE -ne 0) {
    Write-Host "${Red}Falha ao construir as imagens. Abortando.${Reset}"
    exit 1
}
Write-Host "${Green}Imagens construidas com sucesso.${Reset}"
Write-Host ""

Write-Host "${Yellow}Iniciando todos os serviços em segundo plano...${Reset}"
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "${Red}Falha ao iniciar os serviços. Abortando.${Reset}"
    exit 1
}
Write-Host "${Green}Todos os serviços do SchemaAPI foram iniciados com sucesso!${Reset}"
Write-Host "API principal rodando em: http://localhost:8080"
Write-Host "RabbitMQ UI em: http://localhost:15672"