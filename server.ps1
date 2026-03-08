$port = 5500
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Host "Servidor rodando! Abra seu navegador em: http://localhost:$port"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        if ($path -eq "/") { $path = "/index.html" }
        
        $fullPath = Join-Path $PWD.Path $path.Replace("/", "\")
        
        if (Test-Path $fullPath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            
            if ($path.EndsWith(".html")) { $response.ContentType = "text/html; charset=utf-8" }
            elseif ($path.EndsWith(".css")) { $response.ContentType = "text/css; charset=utf-8" }
            elseif ($path.EndsWith(".js")) { $response.ContentType = "application/javascript; charset=utf-8" }
            elseif ($path.EndsWith(".json")) { $response.ContentType = "application/json; charset=utf-8" }
            
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.OutputStream.Close()
            Write-Host "200 OK - $path"
        } else {
            $response.StatusCode = 404
            $response.OutputStream.Close()
            Write-Host "404 Not Found - $path"
        }
    }
} finally {
    $listener.Stop()
}
