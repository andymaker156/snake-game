param(
  [string]$ConfigPath = ".vscode/mcp.json"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "MCP config not found: $ConfigPath"
}

$config = Get-Content -Raw -LiteralPath $ConfigPath | ConvertFrom-Json
if (-not $config.servers) {
  throw "No 'servers' object found in $ConfigPath"
}

function Invoke-McpRequest {
  param(
    [string]$Url,
    [object]$Body,
    [hashtable]$ExtraHeaders = @{}
  )

  $headers = @{
    "Accept" = "application/json, text/event-stream"
    "Content-Type" = "application/json"
  }

  foreach ($key in $ExtraHeaders.Keys) {
    $headers[$key] = $ExtraHeaders[$key]
  }

  Invoke-WebRequest `
    -Uri $Url `
    -Method Post `
    -Headers $headers `
    -Body ($Body | ConvertTo-Json -Depth 10) `
    -UseBasicParsing
}

function Read-McpJson {
  param([string]$Content)

  $line = ($Content -split "`n" | Where-Object { $_ -match "^\s*data:\s*" } | Select-Object -First 1)
  if ($line) {
    return ($line -replace "^\s*data:\s*", "" | ConvertFrom-Json)
  }

  return ($Content | ConvertFrom-Json)
}

$initializeBody = @{
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
}

$initializedBody = @{
  jsonrpc = "2.0"
  method = "notifications/initialized"
  params = @{}
}

$toolsBody = @{
  jsonrpc = "2.0"
  id = 2
  method = "tools/list"
  params = @{}
}

$serverNames = $config.servers.PSObject.Properties.Name
foreach ($name in $serverNames) {
  $server = $config.servers.$name
  if ($server.type -ne "http") {
    Write-Host "$name skipped: type '$($server.type)' is not http"
    continue
  }

  try {
    $initResponse = Invoke-McpRequest -Url $server.url -Body $initializeBody
    $sessionId = $initResponse.Headers["Mcp-Session-Id"]
    $sessionHeaders = @{}

    if ($sessionId) {
      $sessionHeaders["Mcp-Session-Id"] = $sessionId
      Invoke-McpRequest -Url $server.url -Body $initializedBody -ExtraHeaders $sessionHeaders | Out-Null
    }

    $toolsResponse = Invoke-McpRequest -Url $server.url -Body $toolsBody -ExtraHeaders $sessionHeaders
    $toolsJson = Read-McpJson -Content $toolsResponse.Content
    $tools = @($toolsJson.result.tools)
    $toolNames = $tools | Select-Object -ExpandProperty name

    Write-Host "$name OK - $($tools.Count) tools"
    if ($toolNames.Count -gt 0) {
      Write-Host "  $($toolNames -join ', ')"
    }
  } catch {
    Write-Host "$name FAILED - $($_.Exception.Message)"
    if ($_.Exception.Response) {
      $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
      $body = $reader.ReadToEnd()
      if ($body) {
        Write-Host "  $body"
      }
    }
  }
}
