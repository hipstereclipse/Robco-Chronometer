Add-Type -AssemblyName System.Drawing

$OutDir = Join-Path (Get-Location) "PREVIEWS"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Get-ChildItem -LiteralPath $OutDir -Filter "*.png" | Remove-Item -Force

$W = 480
$H = 320
# Inset for content near the rounded-corner bezel; mirrors MARGIN in the apps.
$Margin = 32
$Corner = 30
$Bg = [System.Drawing.Color]::FromArgb(8, 15, 9)
$Green = [System.Drawing.Color]::FromArgb(126, 255, 103)
$Dim = [System.Drawing.Color]::FromArgb(54, 129, 46)
$Grid = [System.Drawing.Color]::FromArgb(30, 72, 28)

$FontTiny = New-Object System.Drawing.Font("Consolas", 9, [System.Drawing.FontStyle]::Regular)
$FontSmall = New-Object System.Drawing.Font("Consolas", 11, [System.Drawing.FontStyle]::Regular)
$FontMono = New-Object System.Drawing.Font("Consolas", 14, [System.Drawing.FontStyle]::Regular)
$FontMid = New-Object System.Drawing.Font("Consolas", 22, [System.Drawing.FontStyle]::Regular)
$FontBig = New-Object System.Drawing.Font("Consolas", 36, [System.Drawing.FontStyle]::Regular)
$FontHuge = New-Object System.Drawing.Font("Consolas", 45, [System.Drawing.FontStyle]::Regular)
$FontHour = New-Object System.Drawing.Font("Consolas", 18, [System.Drawing.FontStyle]::Regular)

function Draw-Text {
  param($G, $Text, $Font, $Brush, [float]$X, [float]$Y, [float]$Width, [string]$Align = "Left")
  $Fmt = New-Object System.Drawing.StringFormat
  if ($Align -eq "Center") { $Fmt.Alignment = [System.Drawing.StringAlignment]::Center }
  elseif ($Align -eq "Right") { $Fmt.Alignment = [System.Drawing.StringAlignment]::Far }
  else { $Fmt.Alignment = [System.Drawing.StringAlignment]::Near }
  $Fmt.LineAlignment = [System.Drawing.StringAlignment]::Near
  $Rect = New-Object System.Drawing.RectangleF($X, $Y, $Width, 60)
  $G.DrawString($Text, $Font, $Brush, $Rect, $Fmt)
}

function Draw-Header {
  param($G, $BrushGreen, $PenGreen, [string]$Mode)
  Draw-Text $G "ROBCO TERMLINK" $FontMono $BrushGreen $Margin 10 220 "Left"
  Draw-Text $G "12:34" $FontMono $BrushGreen ($W - $Margin - 100) 10 100 "Right"
  Draw-Text $G ("> " + $Mode) $FontMono $BrushGreen $Margin 46 286 "Left"
}

function Draw-Footer {
  param($G, $BrushDim, $PenGrid, [string]$Left, [string]$Right)
  $Y = $H - 31
  $G.DrawLine($PenGrid, $Margin, $H - 40, $W - $Margin, $H - 40)
  Draw-Text $G $Left $FontMono $BrushDim $Margin $Y 220 "Left"
  Draw-Text $G $Right $FontMono $BrushDim ($W - $Margin - 222) $Y 222 "Right"
}

function Draw-Scanlines {
  param($G, $PenGrid)
  for ($Y = 76; $Y -lt $H - 44; $Y += 8) {
    $G.DrawLine($PenGrid, 36, $Y, $W - 37, $Y)
  }
}

function New-RoundedPath {
  param([int]$Rw, [int]$Rh, [int]$R)
  $D = $R * 2
  $P = New-Object System.Drawing.Drawing2D.GraphicsPath
  $P.AddArc(0, 0, $D, $D, 180, 90)
  $P.AddArc($Rw - $D - 1, 0, $D, $D, 270, 90)
  $P.AddArc($Rw - $D - 1, $Rh - $D - 1, $D, $D, 0, 90)
  $P.AddArc(0, $Rh - $D - 1, $D, $D, 90, 90)
  $P.CloseFigure()
  return $P
}

# Beveled HUD frame mirroring frame() in the apps: cut corners trace the bezel.
function Draw-Frame {
  param($G, $Pen, [int]$X1, [int]$Y1, [int]$X2, [int]$Y2, [int]$C)
  $G.DrawLine($Pen, $X1 + $C, $Y1, $X2 - $C, $Y1)
  $G.DrawLine($Pen, $X2 - $C, $Y1, $X2, $Y1 + $C)
  $G.DrawLine($Pen, $X2, $Y1 + $C, $X2, $Y2 - $C)
  $G.DrawLine($Pen, $X2, $Y2 - $C, $X2 - $C, $Y2)
  $G.DrawLine($Pen, $X2 - $C, $Y2, $X1 + $C, $Y2)
  $G.DrawLine($Pen, $X1 + $C, $Y2, $X1, $Y2 - $C)
  $G.DrawLine($Pen, $X1, $Y2 - $C, $X1, $Y1 + $C)
  $G.DrawLine($Pen, $X1, $Y1 + $C, $X1 + $C, $Y1)
}

function Draw-Screen {
  param(
    [string]$FileName,
    [string]$Mode,
    [scriptblock]$Body,
    [string]$LeftFooter,
    [string]$RightFooter
  )

  $Bmp = New-Object System.Drawing.Bitmap($W, $H)
  $G = [System.Drawing.Graphics]::FromImage($Bmp)
  $G.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
  $G.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::SingleBitPerPixelGridFit
  $G.Clear($Bg)

  $BrushGreen = New-Object System.Drawing.SolidBrush($Green)
  $BrushDim = New-Object System.Drawing.SolidBrush($Dim)
  $PenGreen = New-Object System.Drawing.Pen($Green, 1)
  $PenDim = New-Object System.Drawing.Pen($Dim, 1)
  $PenGrid = New-Object System.Drawing.Pen($Grid, 1)

  # Clip everything to the device's rounded screen so corner content is masked
  # exactly as the bezel would mask it on-device.
  $Bezel = New-RoundedPath $W $H $Corner
  $G.SetClip($Bezel)

  $G.DrawLine($PenDim, $Margin, 42, $W - $Margin, 42)
  $G.DrawLine($PenDim, $Margin, 66, $W - $Margin, 66)
  Draw-Header $G $BrushGreen $PenGreen $Mode
  & $Body $G $BrushGreen $BrushDim $PenGreen $PenDim
  Draw-Footer $G $BrushDim $PenGrid $LeftFooter $RightFooter

  $G.ResetClip()

  $Path = Join-Path $OutDir $FileName
  $Bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $Bezel.Dispose()
  $G.Dispose()
  $Bmp.Dispose()
}

function Draw-AnalogHand {
  param($G, $Pen, [float]$Cx, [float]$Cy, [float]$Angle, [float]$Len)
  $X = $Cx + [Math]::Cos($Angle) * $Len
  $Y = $Cy + [Math]::Sin($Angle) * $Len
  $G.DrawLine($Pen, $Cx, $Cy, $X, $Y)
}

# Weighted, tapered hand mirroring hand() in CLOCKANALOG.JS.
function Draw-Hand2 {
  param($G, $Pen, [double]$Cx, [double]$Cy, [double]$Angle, [double]$Len, [double]$Back, [double]$HalfW)
  $Ca = [Math]::Cos($Angle); $Sa = [Math]::Sin($Angle); $Nx = -$Sa; $Ny = $Ca
  $Shoulder = $Len - [Math]::Max(8.0, $HalfW * 4)
  $Tx = $Cx + $Ca * $Len; $Ty = $Cy + $Sa * $Len
  for ($O = -$HalfW; $O -le $HalfW; $O += 0.5) {
    $Bx = $Cx + $Nx * $O - $Ca * $Back; $By = $Cy + $Ny * $O - $Sa * $Back
    $Sx = $Cx + $Nx * $O + $Ca * $Shoulder; $Sy = $Cy + $Ny * $O + $Sa * $Shoulder
    $G.DrawLine($Pen, [float]$Bx, [float]$By, [float]$Sx, [float]$Sy)
    $G.DrawLine($Pen, [float]$Sx, [float]$Sy, [float]$Tx, [float]$Ty)
  }
}

function Draw-TickRing {
  param($G, $PenGreen, $PenDim, [double]$Cx, [double]$Cy, [double]$R, [bool]$MinorPips)
  for ($I = 0; $I -lt 60; $I++) {
    $A = ($I / 60.0) * [Math]::PI * 2 - [Math]::PI / 2
    $Major = ($I % 5) -eq 0
    if (-not $Major -and -not $MinorPips) { continue }
    $Ca = [Math]::Cos($A); $Sa = [Math]::Sin($A)
    $Inner = $R - $(if ($Major) { 15 } else { 6 })
    $Outer = $R - 3
    $Pen = if ($Major) { $PenGreen } else { $PenDim }
    $G.DrawLine($Pen, [float]($Cx + $Ca * $Inner), [float]($Cy + $Sa * $Inner), [float]($Cx + $Ca * $Outer), [float]($Cy + $Sa * $Outer))
    if ($Major) {
      $G.DrawLine($Pen, [float]($Cx + $Ca * $Inner - $Sa), [float]($Cy + $Sa * $Inner + $Ca), [float]($Cx + $Ca * $Outer - $Sa), [float]($Cy + $Sa * $Outer + $Ca))
    }
  }
}

function Draw-Numerals {
  param($G, $BrushGreen, $BrushDim, [double]$Cx, [double]$Cy, [double]$R, [bool]$CardinalsOnly)
  for ($I = 1; $I -le 12; $I++) {
    $Cardinal = ($I % 3) -eq 0
    if ($CardinalsOnly -and -not $Cardinal) { continue }
    $A = ($I / 12.0) * [Math]::PI * 2 - [Math]::PI / 2
    $Rn = $R - 22
    $Px = $Cx + [Math]::Cos($A) * $Rn
    $Py = $Cy + [Math]::Sin($A) * $Rn
    $Brush = if ($Cardinal) { $BrushGreen } else { $BrushDim }
    $Font = if ($Cardinal) { $FontMid } else { $FontHour }
    Draw-Text $G ("" + $I) $Font $Brush ($Px - 20) ($Py - 14) 40 "Center"
  }
}

# Low-poly coastline traces tuned for the 104 px globe. They retain the
# recognizable continental silhouettes without overloading the redraw loop.
$LandShapes = @(
  # North America, including Alaska, Canada, the U.S., Mexico, and Central America.
  @(-168,72,-158,71,-151,67,-143,69,-136,59,-130,55,-127,50,-124,49,-124,43,-121,38,-117,33,-112,29,-106,23,-98,19,-91,18,-88,21,-84,22,-81,25,-80,29,-81,31,-79,33,-76,36,-75,39,-71,42,-67,45,-61,46,-57,50,-60,54,-67,56,-76,57,-82,62,-91,63,-96,68,-109,69,-121,71,-134,70,-145,72,-158,74,-168,72),
  # Hudson Bay.
  @(-95,59,-88,58,-82,55,-78,51,-83,49,-90,52,-95,59),
  # Greenland.
  @(-53,83,-37,83,-23,79,-17,72,-23,66,-36,60,-49,59,-58,64,-63,71,-60,78,-53,83),
  # South America.
  @(-81,12,-75,11,-69,9,-63,3,-59,-4,-54,-9,-50,-18,-44,-23,-41,-33,-46,-39,-50,-50,-58,-55,-65,-54,-70,-49,-73,-42,-76,-32,-78,-20,-81,-7,-81,4,-81,12),
  # Europe.
  @(-10,36,-9,43,-5,50,0,51,4,58,12,56,18,60,25,66,32,70,40,68,33,60,39,55,31,50,23,46,17,43,12,45,5,43,0,38,-6,36,-10,36),
  # Asia.
  @(28,41,36,38,44,36,51,31,60,29,67,25,76,31,85,28,94,23,100,13,106,22,116,22,122,30,132,31,139,35,145,42,155,44,166,51,159,59,143,62,128,70,105,72,82,72,63,67,52,62,43,56,33,57,28,50,28,41),
  # Africa.
  @(-17,35,-6,36,5,36,16,33,25,31,32,25,35,19,43,12,51,4,49,-5,43,-12,40,-22,33,-31,25,-34,18,-35,11,-31,5,-22,-3,-11,-10,2,-16,14,-17,25,-17,35),
  # Arabia.
  @(34,29,43,29,51,25,58,17,55,13,47,12,42,16,38,24,34,29),
  # India.
  @(68,24,73,19,78,8,82,7,88,21,80,27,73,26,68,24),
  # Mainland Southeast Asia.
  @(93,22,101,20,108,16,109,10,105,6,99,9,96,15,93,22),
  # Indonesia and Papua.
  @(95,6,105,4,117,1,126,-3,132,-5,124,-8,112,-5,104,-6,97,0,95,6),
  @(132,-2,142,-4,153,-5,150,-10,139,-9,132,-2),
  # Australia.
  @(112,-11,116,-21,114,-29,121,-35,134,-39,146,-43,153,-37,153,-28,147,-20,138,-15,128,-13,119,-14,112,-11),
  # Madagascar.
  @(48,-12,51,-20,49,-26,44,-25,43,-18,48,-12),
  # British Isles, Iceland, Japan, New Zealand, and Tasmania.
  @(-8,58,-3,56,-2,51,-5,50,-8,52,-8,58),
  @(-25,66,-14,65,-14,63,-24,63,-25,66),
  @(130,34,135,32,141,36,145,43,140,45,133,40,130,34),
  @(166,-35,178,-38,177,-45,169,-47,166,-42,166,-35),
  @(145,-40,149,-43,146,-45,143,-43,145,-40),
  # Antarctica.
  @(-180,-68,-160,-71,-135,-70,-110,-73,-80,-71,-55,-74,-25,-71,0,-70,32,-73,62,-70,95,-72,130,-69,160,-72,180,-68)
)

function Wrap-Lon {
  param([double]$Lon)
  while ($Lon -lt -180) { $Lon += 360 }
  while ($Lon -ge 180) { $Lon -= 360 }
  return $Lon
}

function Project-Geo {
  param([double]$Cx, [double]$Cy, [double]$R, [double]$CenterLat, [double]$CenterLon, [double]$Lon, [double]$Lat)
  $Dlon = (Wrap-Lon ($Lon - $CenterLon)) * [Math]::PI / 180
  $Phi = $Lat * [Math]::PI / 180
  $P0 = $CenterLat * [Math]::PI / 180
  $CosC = [Math]::Sin($P0) * [Math]::Sin($Phi) + [Math]::Cos($P0) * [Math]::Cos($Phi) * [Math]::Cos($Dlon)
  if ($CosC -lt 0) { return $null }
  $Px = $Cx + ($R * [Math]::Cos($Phi) * [Math]::Sin($Dlon))
  $Py = $Cy - ($R * (([Math]::Cos($P0) * [Math]::Sin($Phi)) - ([Math]::Sin($P0) * [Math]::Cos($Phi) * [Math]::Cos($Dlon))))
  return ,@($Px, $Py)
}

function Draw-GeoPath {
  param($G, $Pen, [double]$Cx, [double]$Cy, [double]$R, [double]$CenterLat, [double]$CenterLon, $Pts)
  $Last = $null
  for ($I = 0; $I -lt $Pts.Count; $I += 2) {
    $P = Project-Geo $Cx $Cy $R $CenterLat $CenterLon ([double]$Pts[$I]) ([double]$Pts[$I + 1])
    if ($P -and $Last) {
      $G.DrawLine($Pen, [float]$Last[0], [float]$Last[1], [float]$P[0], [float]$P[1])
    }
    $Last = $P
  }
}

function Draw-Meridian {
  param($G, $Pen, [double]$Cx, [double]$Cy, [double]$R, [double]$CenterLat, [double]$CenterLon, [double]$Lon)
  $Last = $null
  for ($Lat = -90; $Lat -le 90; $Lat += 6) {
    $P = Project-Geo $Cx $Cy $R $CenterLat $CenterLon $Lon $Lat
    if ($P -and $Last) {
      $G.DrawLine($Pen, [float]$Last[0], [float]$Last[1], [float]$P[0], [float]$P[1])
    }
    $Last = $P
  }
}

function Draw-Parallel {
  param($G, $Pen, [double]$Cx, [double]$Cy, [double]$R, [double]$CenterLat, [double]$CenterLon, [double]$Lat)
  $Last = $null
  for ($Lon = $CenterLon - 180; $Lon -le $CenterLon + 180; $Lon += 6) {
    $P = Project-Geo $Cx $Cy $R $CenterLat $CenterLon $Lon $Lat
    if ($P -and $Last) {
      $G.DrawLine($Pen, [float]$Last[0], [float]$Last[1], [float]$P[0], [float]$P[1])
    }
    $Last = $P
  }
}

function Draw-NightShade {
  param($G, $Pen, [double]$Cx, [double]$Cy, [double]$R, [double]$Sx, [double]$Sy, [double]$Sz)
  for ($Yv = -$R + 1; $Yv -lt $R; $Yv += 2) {
    $Av = $Yv / $R
    $Bmax = [Math]::Sqrt([Math]::Max(0.0, 1 - ($Av * $Av)))
    if ($Bmax -le 0) { continue }
    $Bounds = @(-$Bmax, $Bmax)
    $A = ($Sx * $Sx) + ($Sz * $Sz)
    if ($A -gt 1e-9) {
      $K = 0 - ($Av * $Sy)
      $B = -2 * $K * $Sx
      $C = ($K * $K) - ($Sz * $Sz * (1 - ($Av * $Av)))
      $Sq = [Math]::Sqrt([Math]::Max(0.0, ($B * $B) - (4 * $A * $C)))
      $B1 = (-$B - $Sq) / (2 * $A)
      $B2 = (-$B + $Sq) / (2 * $A)
      if ($B1 -gt -$Bmax -and $B1 -lt $Bmax) { $Bounds += $B1 }
      if ($B2 -gt -$Bmax -and $B2 -lt $Bmax) { $Bounds += $B2 }
    }
    $Bounds = $Bounds | Sort-Object
    for ($I = 0; $I -lt $Bounds.Count - 1; $I++) {
      $Lo = $Bounds[$I]; $Hi = $Bounds[$I + 1]
      if ($Hi - $Lo -lt 1e-4) { continue }
      $Mid = ($Lo + $Hi) / 2
      $W = [Math]::Sqrt([Math]::Max(0.0, 1 - ($Av * $Av) - ($Mid * $Mid)))
      if ((($Av * $Sy) + ($Mid * $Sx) + ($W * $Sz)) -le 0) {
        $G.DrawLine($Pen, [float]($Cx + ($Lo * $R)), [float]($Cy - $Yv), [float]($Cx + ($Hi * $R)), [float]($Cy - $Yv))
      }
    }
  }
}

function Draw-Terminator {
  param($G, $Pen, [double]$Cx, [double]$Cy, [double]$R, [double]$Sx, [double]$Sy, [double]$Sz)
  $Ax = -$Sz; $Ay = 0.0; $Az = $Sx
  $M = [Math]::Sqrt(($Ax * $Ax) + ($Az * $Az))
  if ($M -lt 1e-6) { $Ax = 1.0; $Ay = 0.0; $Az = 0.0; $M = 1.0 }
  $Ax = $Ax / $M; $Az = $Az / $M
  $Bx = ($Sy * $Az) - ($Sz * $Ay)
  $By = ($Sz * $Ax) - ($Sx * $Az)
  $Bz = ($Sx * $Ay) - ($Sy * $Ax)
  $Last = $null
  for ($Th = 0; $Th -le 360; $Th += 6) {
    $Cc = [Math]::Cos($Th * [Math]::PI / 180); $Sn = [Math]::Sin($Th * [Math]::PI / 180)
    $Pz = ($Az * $Cc) + ($Bz * $Sn)
    if ($Pz -lt 0) { $Last = $null; continue }
    $Px = $Cx + ((($Ax * $Cc) + ($Bx * $Sn)) * $R)
    $Py = $Cy - ((($Ay * $Cc) + ($By * $Sn)) * $R)
    if ($Last) { $G.DrawLine($Pen, [float]$Last[0], [float]$Last[1], [float]$Px, [float]$Py) }
    $Last = @($Px, $Py)
  }
}

Draw-Screen "01-clock-date-config.png" "CHRONOMETER CONTROL" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $G.DrawRectangle($PenDim, 42, 78, 250, 174)
  $G.DrawLine($PenDim, 42, 102, 292, 102)
  Draw-Text $G "ADDR 0xF4F0" $FontSmall $BrushDim 54 84 100 "Left"
  Draw-Text $G "LOCAL TIMEBASE" $FontSmall $BrushDim 148 84 132 "Right"
  Draw-Text $G "12:34:56" $FontBig $BrushGreen 52 104 240 "Center"
  Draw-Text $G "SAT 2026-06-27" $FontMono $BrushGreen 52 178 240 "Center"
  Draw-Text $G "RTC BUS  UTC-04:00" $FontSmall $BrushDim 52 210 240 "Center"
  $G.DrawRectangle($PenDim, 306, 78, 148, 174)
  $G.DrawLine($PenDim, 306, 102, 454, 102)
  Draw-Text $G "CONFIG 0x7A1" $FontSmall $BrushDim 306 84 148 "Center"
  Draw-Text $G "> MODE DATE" $FontSmall $BrushDim 318 116 124 "Left"
  Draw-Text $G "> SEC ENABLED" $FontSmall $BrushDim 318 140 124 "Left"
  Draw-Text $G "> FMT 24-HOUR" $FontSmall $BrushDim 318 164 124 "Left"
  Draw-Text $G "RTC [====] OK" $FontSmall $BrushDim 318 196 124 "Left"
  Draw-Text $G "LOCK OPEN" $FontSmall $BrushDim 318 220 124 "Left"
} "K1 LAYOUT  K2 FMT" "K1 LOCK"

Draw-Screen "02-clock-time-only.png" "CHRONOMETER CONTROL" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $G.DrawRectangle($PenDim, 42, 86, $W - 85, 158)
  $G.DrawLine($PenDim, 42, 112, $W - 43, 112)
  Draw-Text $G "LOCAL TIMEBASE 0xC1A0" $FontSmall $BrushDim 42 92 ($W - 85) "Center"
  Draw-Text $G "12:34" $FontHuge $BrushGreen 0 116 $W "Center"
  Draw-Text $G "SYNC [========] VAULT RTC" $FontMono $BrushDim 0 218 $W "Center"
} "K1 LAYOUT  K2 FMT" "K1 LOCK"

Draw-Screen "03-world-dst-relay.png" "CIVIL TIME RELAY" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $G.DrawRectangle($PenDim, 36, 78, 196, 182)
  $G.DrawLine($PenDim, 36, 102, 232, 102)
  Draw-Text $G "LOCAL NODE 0x01" $FontSmall $BrushDim 36 84 196 "Center"
  Draw-Text $G "12:34" $FontMid $BrushGreen 36 112 196 "Center"
  Draw-Text $G "RTC LINK ACTIVE" $FontSmall $BrushGreen 36 164 196 "Center"
  Draw-Text $G "SAT 2026-06-27" $FontSmall $BrushDim 36 190 196 "Center"
  Draw-Text $G "UTC-04:00" $FontSmall $BrushDim 36 214 196 "Center"
  Draw-Text $G "EDT NYC" $FontSmall $BrushDim 36 238 196 "Center"
  $G.DrawRectangle($PenDim, 244, 78, $W - 274, 182)
  $G.DrawLine($PenDim, 244, 102, $W - 30, 102)
  Draw-Text $G "WASTELAND RELAY" $FontSmall $BrushDim 254 84 196 "Left"
  $Rows = @(
    @("NYC", "EDT", "12:34"),
    @("CHI", "CDT", "11:34"),
    @("DEN", "MDT", "10:34"),
    @("L.A.", "PDT", "09:34"),
    @("LONDON", "BST", "17:34")
  )
  for ($I = 0; $I -lt $Rows.Count; $I++) {
    $Y = 112 + ($I * 29)
    $Brush = if ($I -eq 0) { $BrushGreen } else { $BrushDim }
    $Node = if ($I -eq 0) { "> " + $Rows[$I][1] + " " + $Rows[$I][0] } else { "  " + $Rows[$I][1] + " " + $Rows[$I][0] }
    Draw-Text $G $Node $FontSmall $Brush 254 $Y 118 "Left"
    Draw-Text $G $Rows[$I][2] $FontSmall $Brush 388 $Y 58 "Right"
  }
} "K1/K2 ZONES" "K1 LOCK"

Draw-Screen "04-globe-orbital-relay.png" "ORBITAL DAY/NIGHT MAP" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $Cx = 150
  $Cy = 170
  $R = 96
  $CenterLat = 0
  $CenterLon = -60
  # Scene instant: 12:34 in UTC-04:00 on 27 Jun 2026 -> 16.567 UTC, day-of-year 178.
  $UtcHours = 16.0 + (34.0 / 60.0)
  $Decl = -23.44 * [Math]::PI / 180 * [Math]::Cos(2 * [Math]::PI * (178 + 10) / 365.24)
  $SsLon = Wrap-Lon ((12 - $UtcHours) * 15)
  $Dl = (Wrap-Lon ($SsLon - $CenterLon)) * [Math]::PI / 180
  $P0 = $CenterLat * [Math]::PI / 180
  $Sx = [Math]::Cos($Decl) * [Math]::Sin($Dl)
  $Sy = ([Math]::Cos($P0) * [Math]::Sin($Decl)) - ([Math]::Sin($P0) * [Math]::Cos($Decl) * [Math]::Cos($Dl))
  $Sz = ([Math]::Sin($P0) * [Math]::Sin($Decl)) + ([Math]::Cos($P0) * [Math]::Cos($Decl) * [Math]::Cos($Dl))

  Draw-NightShade $G $PenDim $Cx $Cy $R $Sx $Sy $Sz
  $G.DrawEllipse($PenGreen, $Cx - $R, $Cy - $R, $R * 2, $R * 2)
  $G.DrawEllipse($PenGreen, $Cx - $R + 2, $Cy - $R + 2, ($R - 2) * 2, ($R - 2) * 2)
  foreach ($Lat in @(-60, -30, 0, 30, 60)) {
    Draw-Parallel $G $PenDim $Cx $Cy $R $CenterLat $CenterLon $Lat
  }
  foreach ($Lon in @(-180, -150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150)) {
    Draw-Meridian $G $PenDim $Cx $Cy $R $CenterLat $CenterLon $Lon
  }
  foreach ($Shape in $LandShapes) {
    Draw-GeoPath $G $PenGreen $Cx $Cy $R $CenterLat $CenterLon $Shape
  }
  Draw-Terminator $G $PenGreen $Cx $Cy $R $Sx $Sy $Sz

  if ($Sz -gt 0) {
    $Mx = $Cx + ($Sx * $R); $My = $Cy - ($Sy * $R)
    $G.DrawEllipse($PenGreen, [float]($Mx - 2), [float]($My - 2), 4, 4)
    for ($I = 0; $I -lt 4; $I++) {
      $Aa = ($I / 4) * [Math]::PI
      $G.DrawLine($PenGreen, [float]($Mx - [Math]::Cos($Aa) * 8), [float]($My - [Math]::Sin($Aa) * 8), [float]($Mx + [Math]::Cos($Aa) * 8), [float]($My + [Math]::Sin($Aa) * 8))
    }
  }
  $G.DrawEllipse($PenGreen, $Cx - 5, $Cy - 5, 10, 10)
  $G.DrawLine($PenGreen, $Cx - 9, $Cy, $Cx - 3, $Cy)
  $G.DrawLine($PenGreen, $Cx + 3, $Cy, $Cx + 9, $Cy)
  $G.DrawLine($PenGreen, $Cx, $Cy - 9, $Cx, $Cy - 3)
  $G.DrawLine($PenGreen, $Cx, $Cy + 3, $Cx, $Cy + 9)

  $Elev = [Math]::Asin([Math]::Max(-1.0, [Math]::Min(1.0, $Sz))) * 180 / [Math]::PI
  $Phase = if ($Elev -ge 0) { "DAYLIGHT" } elseif ($Elev -ge -12) { "TWILIGHT" } else { "NIGHT" }
  $ElevStr = $(if ($Elev -ge 0) { "+" } else { "-" }) + [Math]::Round([Math]::Abs($Elev))
  $PhaseBrush = if ($Elev -ge 0) { $BrushGreen } else { $BrushDim }

  Draw-Text $G "TZ RELAY // 0xA0" $FontSmall $BrushGreen 270 76 170 "Center"
  $G.DrawRectangle($PenDim, 272, 90, 158, 180)
  $G.DrawLine($PenDim, 272, 134, 430, 134)
  Draw-Text $G "UTC-04:00" $FontMono $BrushDim 272 96 158 "Center"
  Draw-Text $G "12:34" $FontMid $BrushGreen 272 137 158 "Center"
  Draw-Text $G "JUN 27" $FontSmall $BrushDim 272 186 158 "Center"
  Draw-Text $G "MERIDIAN 60W" $FontSmall $BrushDim 272 210 158 "Center"
  Draw-Text $G "BAND 10/39" $FontSmall $BrushDim 272 234 158 "Center"
  Draw-Text $G "$Phase $ElevStr" $FontSmall $PhaseBrush 272 252 158 "Center"
} "K1/K2 BANDS" "K1 LOCK"

Draw-Screen "05-analog-clock.png" "VACUUM-TUBE DIAL MODULE" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $Cx = 158
  $Cy = 168
  $R = 96
  # CHRONO face: double ring, full 60-tick ring, all twelve numerals.
  $G.DrawEllipse($PenGreen, $Cx - $R, $Cy - $R, $R * 2, $R * 2)
  $G.DrawEllipse($PenGreen, $Cx - $R + 4, $Cy - $R + 4, ($R - 4) * 2, ($R - 4) * 2)
  Draw-TickRing $G $PenGreen $PenDim $Cx $Cy $R $true
  Draw-Numerals $G $BrushGreen $BrushDim $Cx $Cy $R $false
  # Hands at 10:08:42.
  Draw-Hand2 $G $PenGreen $Cx $Cy 3.73436 52 14 3
  Draw-Hand2 $G $PenGreen $Cx $Cy -0.65973 78 16 2
  $SecA = 2.82743
  $G.DrawLine($PenDim, [float]($Cx - [Math]::Cos($SecA) * 22), [float]($Cy - [Math]::Sin($SecA) * 22), [float]($Cx + [Math]::Cos($SecA) * 88), [float]($Cy + [Math]::Sin($SecA) * 88))
  $G.DrawEllipse($PenDim, [float]($Cx + [Math]::Cos($SecA) * 70 - 3), [float]($Cy + [Math]::Sin($SecA) * 70 - 3), 6, 6)
  $G.FillEllipse($BrushGreen, $Cx - 4, $Cy - 4, 8, 8)
  # Date panel.
  $G.DrawRectangle($PenDim, 274, 76, 172, 184)
  $G.DrawLine($PenDim, 274, 102, 446, 102)
  Draw-Text $G "DIAL PLATE 0xB4" $FontSmall $BrushDim 274 82 172 "Center"
  Draw-Text $G "10:08:42" $FontMid $BrushGreen 274 118 172 "Center"
  Draw-Text $G "SATURDAY" $FontMono $BrushGreen 274 154 172 "Center"
  Draw-Text $G "JUNE 27" $FontSmall $BrushDim 274 190 172 "Center"
  Draw-Text $G "2026" $FontSmall $BrushDim 274 216 172 "Center"
  Draw-Text $G "FACE CHRONO" $FontSmall $BrushDim 274 240 172 "Center"
} "K1 FACE  K2 DATA" "K1 LOCK"

Draw-Screen "06-stopwatch-running-lap.png" "PRECISION FIELD TIMER" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $G.DrawRectangle($PenDim, 58, 78, $W - 116, 178)
  $G.DrawLine($PenDim, 58, 176, $W - 58, 176)
  Draw-Text $G "ADDR 0xF4F0 // ELAPSED" $FontSmall $BrushDim 58 86 ($W - 116) "Center"
  Draw-Text $G "07:42.38" $FontHuge $BrushGreen 0 94 $W "Center"
  $BarX = 90
  $BarY = 168
  $BarW = 300
  $BarH = 9
  $G.DrawRectangle($PenDim, $BarX, $BarY, $BarW, $BarH)
  $G.FillRectangle($BrushGreen, $BarX + 2, $BarY + 2, [Math]::Round(($BarW - 4) * 0.38), $BarH - 3)
  Draw-Text $G "FIELD TEST RUNNING" $FontMono $BrushGreen 0 190 $W "Center"
  Draw-Text $G "LAP  03:15.82" $FontMono $BrushDim 0 224 $W "Center"
} "K1 START/LAP" "K2 RESET"

Draw-Screen "07-countdown-running.png" "RADSAFE COUNTDOWN" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $G.DrawRectangle($PenDim, 58, 78, 362, 178)
  $G.DrawLine($PenDim, 58, 178, 420, 178)
  Draw-Text $G "ADDR 0xCD00 // TIMER CORE" $FontSmall $BrushDim 58 86 362 "Center"
  Draw-Text $G "03:28" $FontHuge $BrushGreen 0 96 $W "Center"
  $G.DrawRectangle($PenDim, 94, 164, 292, 9)
  $G.FillRectangle($BrushGreen, 96, 166, 204, 6)
  Draw-Text $G "RADSAFE COUNTDOWN ACTIVE" $FontMono $BrushGreen 0 196 $W "Center"
  Draw-Text $G "ADJUSTMENT: ONE MINUTE STEPS" $FontMono $BrushDim 0 230 $W "Center"
} "K1 START/ADJ" "K2 STEP/RST"

Draw-Screen "08-pomodoro-work.png" "WORK CYCLE REGULATOR" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $G.DrawRectangle($PenDim, 58, 78, 362, 178)
  $G.DrawLine($PenDim, 58, 178, 420, 178)
  Draw-Text $G "ADDR 0xBEEF // CYCLE CORE" $FontSmall $BrushDim 58 86 362 "Center"
  Draw-Text $G "25:00" $FontHuge $BrushGreen 0 92 $W "Center"
  $G.DrawRectangle($PenDim, 94, 164, 292, 9)
  $G.FillRectangle($BrushGreen, 96, 166, 288, 6)
  Draw-Text $G "WORK RATION READY" $FontMono $BrushGreen 0 190 $W "Center"
  Draw-Text $G "CYCLES 0  WORK 25:00  BREAK 05:00" $FontMono $BrushDim 0 225 $W "Center"
} "K1 START/ADJ" "K2 STEP/RST"

Draw-Screen "09-pomodoro-break.png" "WORK CYCLE REGULATOR" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $G.DrawRectangle($PenDim, 58, 78, 362, 178)
  $G.DrawLine($PenDim, 58, 178, 420, 178)
  Draw-Text $G "ADDR 0xBEEF // CYCLE CORE" $FontSmall $BrushDim 58 86 362 "Center"
  Draw-Text $G "04:12" $FontHuge $BrushGreen 0 92 $W "Center"
  $G.DrawRectangle($PenDim, 94, 164, 292, 9)
  $G.FillRectangle($BrushGreen, 96, 166, 244, 6)
  Draw-Text $G "RECOVERY ACTIVE" $FontMono $BrushGreen 0 190 $W "Center"
  Draw-Text $G "CYCLES 1  WORK 25:00  BREAK 05:00" $FontMono $BrushDim 0 225 $W "Center"
} "K1 START/ADJ" "K2 STEP/RST"

Write-Host "Rendered landscape Clock Suite previews to $OutDir"
