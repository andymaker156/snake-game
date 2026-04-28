param(
  [Parameter(Mandatory = $true)]
  [string]$ConfigPath
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

foreach ($serverName in $config.servers.PSObject.Properties.Name) {
  Write-Host "== $serverName =="
  $server = $config.servers.$serverName
  $headers = @{
    Accept = "application/json, text/event-stream"
    "Content-Type" = "application/json"
  }

  $init = @{
    jsonrpc = "2.0"
    id = 1
    method = "initialize"
    params = @{
      protocolVersion = "2025-06-18"
      capabilities = @{}
      clientInfo = @{
        name = "snake-game-mcp-test"
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

  $toolsRequest = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/list"
    params = @{}
  } | ConvertTo-Json -Depth 20

  $toolsResponse = Invoke-WebRequest -Uri $server.url -Method Post -Headers $headers -Body $toolsRequest -UseBasicParsing
  $json = Read-JsonResponse $toolsResponse.Content
  $json.result.tools | Select-Object name, description | Format-Table -AutoSize
}
