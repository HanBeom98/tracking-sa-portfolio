Add-Type -AssemblyName System.Drawing

function New-TrackingSaIcon {
    param(
        [Parameter(Mandatory = $true)][int]$Size,
        [Parameter(Mandatory = $true)][string]$OutputPath,
        [double]$Scale = 1.0
    )

    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#0052cc"))

    $unit = $Size / 100.0
    $offset = (1.0 - $Scale) * $Size / 2.0
    $transform = New-Object System.Drawing.Drawing2D.Matrix
    $transform.Translate([single]$offset, [single]$offset)
    $transform.Scale([single]$Scale, [single]$Scale)
    $graphics.Transform = $transform

    $white = [System.Drawing.Color]::White
    $blue = [System.Drawing.ColorTranslator]::FromHtml("#0052cc")
    $ringPen = New-Object System.Drawing.Pen($white, [single](4 * $unit))
    $trendPen = New-Object System.Drawing.Pen($white, [single](8 * $unit))
    $trendPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $trendPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $trendPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $nodePen = New-Object System.Drawing.Pen($white, [single](6 * $unit))
    $handlePen = New-Object System.Drawing.Pen($white, [single](6 * $unit))
    $handlePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $handlePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $graphics.DrawEllipse($ringPen, [single](2 * $unit), [single](2 * $unit), [single](96 * $unit), [single](96 * $unit))
    $points = [System.Drawing.PointF[]]@(
        (New-Object System.Drawing.PointF([single](25 * $unit), [single](70 * $unit))),
        (New-Object System.Drawing.PointF([single](40 * $unit), [single](55 * $unit))),
        (New-Object System.Drawing.PointF([single](50 * $unit), [single](65 * $unit))),
        (New-Object System.Drawing.PointF([single](75 * $unit), [single](35 * $unit)))
    )
    $graphics.DrawLines($trendPen, $points)
    $graphics.FillEllipse((New-Object System.Drawing.SolidBrush($blue)), [single](58 * $unit), [single](23 * $unit), [single](24 * $unit), [single](24 * $unit))
    $graphics.DrawEllipse($nodePen, [single](58 * $unit), [single](23 * $unit), [single](24 * $unit), [single](24 * $unit))
    $graphics.DrawLine($handlePen, [single](79 * $unit), [single](44 * $unit), [single](90 * $unit), [single](55 * $unit))

    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $ringPen.Dispose()
    $trendPen.Dispose()
    $nodePen.Dispose()
    $handlePen.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}

New-TrackingSaIcon -Size 192 -OutputPath "icon-192.png"
New-TrackingSaIcon -Size 512 -OutputPath "icon-512.png"
New-TrackingSaIcon -Size 180 -OutputPath "apple-touch-icon.png"
New-TrackingSaIcon -Size 512 -OutputPath "maskable-icon-512.png" -Scale 0.72
