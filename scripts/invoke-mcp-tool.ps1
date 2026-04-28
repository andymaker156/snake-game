param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath,

  [Parameter(Mandatory = $true)]
  [string]$ServerName,

  [Parameter(Mandatory = $true)]
  [string]$ToolName,

  [string]$ArgumentsJson = "{}",

  [string]$TaskDescription,

  [switch]$ShowSchema
)

$ErrorActionPreference = "Stop"

function Read-JsonResponse {
  param([string]$Content)

  $dataLine = $Content -split "`n" |
    Where-Object { $_ -match '^\s*data:\s*' } |
    Select-Object -First 1

  if ($dataLine) {
    return ($dataLine -replace '^\s*data:\s*', '') | ConvertFrom-Json
  }

  return $Content | ConvertFrom-Json
}

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "MCP config not found: $ConfigPath"
}

$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
$server = $config.servers.$ServerName

if (-not $server) {
  throw "Server '$ServerName' not found in $ConfigPath"
}

if (-not $server.url) {
  throw "Server '$ServerName' does not define a url"
}

$headers = @{
  Accept = "application/json, text/event-stream"
  "Content-Type" = "application/json"
}

$requestId = 1
$init = @{
  jsonrpc = "2.0"
  id = $requestId
  method = "initialize"
  params = @{
    protocolVersion = "2025-06-18"
    capabilities = @{}
    clientInfo = @{
      name = "snake-game-mcp-helper"
      version = "1.0.0"
    }
  }
} | ConvertTo-Json -Depth 20

$initResponse = Invoke-WebRequest -Uri $server.url -Method Post -Headers $headers -Body $init -UseBasicParsing
$sessionId = $initResponse.Headers["Mcp-Session-Id"]

if ($sessionId) {
  $headers["Mcp-Session-Id"] = $sessionId
  $initialized = @{
    jsonrpc = "2.0"
    method = "notifications/initialized"
    params = @{}
  } | ConvertTo-Json -Depth 20
  Invoke-WebRequest -Uri $server.url -Method Post -Headers $headers -Body $initialized -UseBasicParsing | Out-Null
}

$requestId += 1
$toolsRequest = @{
  jsonrpc = "2.0"
  id = $requestId
  method = "tools/list"
  params = @{}
} | ConvertTo-Json -Depth 20

$toolsResponse = Invoke-WebRequest -Uri $server.url -Method Post -Headers $headers -Body $toolsRequest -UseBasicParsing
$toolsJson = Read-JsonResponse $toolsResponse.Content
$tool = $toolsJson.result.tools | Where-Object { $_.name -eq $ToolName } | Select-Object -First 1

if (-not $tool) {
  $available = ($toolsJson.result.tools | ForEach-Object { $_.name }) -join ", "
  throw "Tool '$ToolName' not found on '$ServerName'. Available tools: $available"
}

if ($ShowSchema) {
  $tool | ConvertTo-Json -Depth 30
  exit 0
}

if ($TaskDescription) {
  $arguments = @{
    task_description = $TaskDescription
  }
} else {
  $arguments = $ArgumentsJson | ConvertFrom-Json
}
$requestId += 1
$callRequest = @{
  jsonrpc = "2.0"
  id = $requestId
  method = "tools/call"
  params = @{
    name = $ToolName
    arguments = $arguments
  }
} | ConvertTo-Json -Depth 30

$callResponse = Invoke-WebRequest -Uri $server.url -Method Post -Headers $headers -Body $callRequest -UseBasicParsing
$callJson = Read-JsonResponse $callResponse.Content
$callJson | ConvertTo-Json -Depth 50
