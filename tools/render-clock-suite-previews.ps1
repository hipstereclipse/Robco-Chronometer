Add-Type -AssemblyName System.Drawing

$OutDir = Join-Path (Get-Location) "PREVIEWS"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Get-ChildItem -LiteralPath $OutDir -Filter "*.png" | Remove-Item -Force

$W = 480
$H = 320
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
  Draw-Text $G "ROBCO CHRONOMETER" $FontMono $BrushGreen 8 6 250 "Left"
  Draw-Text $G "12:34" $FontMono $BrushGreen 370 6 100 "Right"
  $G.DrawLine($PenGreen, 0, 32, $W, 32)
  Draw-Text $G $Mode $FontMono $BrushGreen 0 36 $W "Center"
}

function Draw-Footer {
  param($G, $BrushDim, $PenGrid, [string]$Left, [string]$Right)
  $Y = $H - 22
  $G.DrawLine($PenGrid, 0, $Y - 7, $W, $Y - 7)
  Draw-Text $G $Left $FontSmall $BrushDim 8 $Y 230 "Left"
  Draw-Text $G $Right $FontSmall $BrushDim 240 $Y 232 "Right"
}

function Draw-Scanlines {
  param($G, $PenGrid)
  for ($Y = 0; $Y -lt $H; $Y += 4) {
    $G.DrawLine($PenGrid, 0, $Y, $W, $Y)
  }
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

  Draw-Scanlines $G $PenGrid
  Draw-Header $G $BrushGreen $PenGreen $Mode
  & $Body $G $BrushGreen $BrushDim $PenGreen $PenDim
  Draw-Footer $G $BrushDim $PenGrid $LeftFooter $RightFooter

  $Path = Join-Path $OutDir $FileName
  $Bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $G.Dispose()
  $Bmp.Dispose()
}

function Draw-AnalogHand {
  param($G, $Pen, [float]$Cx, [float]$Cy, [float]$Angle, [float]$Len)
  $X = $Cx + [Math]::Cos($Angle) * $Len
  $Y = $Cy + [Math]::Sin($Angle) * $Len
  $G.DrawLine($Pen, $Cx, $Cy, $X, $Y)
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

Draw-Screen "01-clock-date-config.png" "CLOCK" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  Draw-Text $G "12:34:56" $FontBig $BrushGreen 32 98 270 "Center"
  Draw-Text $G "SAT 2026-06-27" $FontMono $BrushGreen 32 178 270 "Center"
  Draw-Text $G "PIP-BOY RTC  UTC-04:00" $FontSmall $BrushDim 32 210 270 "Center"
  $G.DrawRectangle($PenDim, 326, 78, 142, 154)
  Draw-Text $G "DISPLAY" $FontMono $BrushDim 326 86 142 "Center"
  Draw-Text $G "LAYOUT DATE" $FontSmall $BrushDim 336 118 120 "Left"
  Draw-Text $G "SECS ON" $FontSmall $BrushDim 336 142 120 "Left"
  Draw-Text $G "FMT 24H" $FontSmall $BrushDim 336 166 120 "Left"
  Draw-Text $G "ROBCO UI" $FontSmall $BrushDim 336 190 120 "Left"
} "K1 LAYOUT/SEC" "K2 12H/MODE"

Draw-Screen "02-clock-time-only.png" "CLOCK" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  Draw-Text $G "12:34" $FontHuge $BrushGreen 0 108 $W "Center"
  Draw-Text $G "VAULT-TEC LOCAL TIME" $FontMono $BrushDim 0 218 $W "Center"
} "K1 LAYOUT/SEC" "K2 12H/MODE"

Draw-Screen "03-world-dst-relay.png" "WORLD" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  Draw-Text $G "12:34:56" $FontMid $BrushGreen 8 100 220 "Center"
  Draw-Text $G "LOCAL VAULT CLOCK" $FontSmall $BrushGreen 8 164 220 "Center"
  Draw-Text $G "SAT 2026-06-27" $FontSmall $BrushDim 8 190 220 "Center"
  Draw-Text $G "UTC-04:00" $FontSmall $BrushDim 8 216 220 "Center"
  Draw-Text $G "NYC EDT" $FontSmall $BrushDim 8 242 220 "Center"
  Draw-Text $G "UTC-04:00 SUMMER" $FontSmall $BrushDim 8 266 220 "Center"
  $G.DrawLine($PenDim, 242, 66, 242, 282)
  Draw-Text $G "WASTELAND RELAY" $FontSmall $BrushDim 260 66 200 "Left"
  $Rows = @(
    @("NYC", "EDT", "12:34", ""),
    @("CHI", "CDT", "11:34", ""),
    @("DEN", "MDT", "10:34", ""),
    @("L.A.", "PDT", "09:34", ""),
    @("LONDON", "BST", "17:34", "")
  )
  for ($I = 0; $I -lt $Rows.Count; $I++) {
    $Y = 98 + ($I * 36)
    $Brush = if ($I -eq 0) { $BrushGreen } else { $BrushDim }
    Draw-Text $G $Rows[$I][0] $FontMono $Brush 260 ($Y - 11) 80 "Left"
    Draw-Text $G $Rows[$I][1] $FontMono $Brush 325 ($Y - 11) 70 "Center"
    Draw-Text $G $Rows[$I][2] $FontMono $Brush 386 ($Y - 11) 80 "Right"
  }
} "K1 ZONES" "K2 MODE"

Draw-Screen "04-globe-orbital-relay.png" "GLOBE" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $Cx = 150
  $Cy = 166
  $R = 104
  $CenterLat = 41
  $CenterLon = -74
  # Scene instant: 12:34 EDT (UTC-4) on 27 Jun 2026 -> 16.567 UTC, day-of-year 178.
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

  Draw-Text $G "ROBCO ORBITAL RELAY" $FontSmall $BrushGreen 270 72 170 "Center"
  $G.DrawRectangle($PenDim, 272, 96, 158, 184)
  Draw-Text $G "NYC EDT" $FontMono $BrushDim 272 112 158 "Center"
  Draw-Text $G "12:34" $FontMid $BrushGreen 272 137 158 "Center"
  Draw-Text $G "SATURDAY" $FontSmall $BrushDim 272 188 158 "Center"
  Draw-Text $G "JUNE 27, 2026" $FontSmall $BrushDim 272 212 158 "Center"
  Draw-Text $G "FIX 41N 74W" $FontSmall $BrushDim 272 236 158 "Center"
  Draw-Text $G "$Phase $ElevStr" $FontSmall $PhaseBrush 272 260 158 "Center"
} "K1 ZONES" "K2 MODE"

Draw-Screen "05-analog-clock.png" "ANALOG" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  $Cx = 150
  $Cy = 162
  $R = 100
  $G.DrawEllipse($PenGreen, $Cx - $R, $Cy - $R, $R * 2, $R * 2)
  $G.DrawEllipse($PenGreen, $Cx - $R + 6, $Cy - $R + 6, ($R - 6) * 2, ($R - 6) * 2)
  for ($I = 0; $I -lt 60; $I++) {
    $A = ($I / 60) * [Math]::PI * 2 - [Math]::PI / 2
    $Major = ($I % 5) -eq 0
    $R1 = $R - $(if ($Major) { 13 } else { 7 })
    $X1 = $Cx + [Math]::Cos($A) * $R1
    $Y1 = $Cy + [Math]::Sin($A) * $R1
    $X2 = $Cx + [Math]::Cos($A) * ($R - 2)
    $Y2 = $Cy + [Math]::Sin($A) * ($R - 2)
    $G.DrawLine($(if ($Major) { $PenGreen } else { $PenDim }), $X1, $Y1, $X2, $Y2)
  }
  Draw-Text $G "12" $FontSmall $BrushDim ($Cx - 18) ($Cy - $R + 20) 36 "Center"
  Draw-Text $G "3" $FontSmall $BrushDim ($Cx + $R - 42) ($Cy - 11) 36 "Center"
  Draw-Text $G "6" $FontSmall $BrushDim ($Cx - 18) ($Cy + $R - 42) 36 "Center"
  Draw-Text $G "9" $FontSmall $BrushDim ($Cx - $R + 8) ($Cy - 11) 36 "Center"
  Draw-AnalogHand $G $PenGreen $Cx $Cy -0.36 48
  Draw-AnalogHand $G $PenGreen $Cx $Cy 0.52 74
  Draw-AnalogHand $G $PenDim $Cx $Cy 1.9 86
  $G.DrawEllipse($PenGreen, $Cx - 4, $Cy - 4, 8, 8)
  $G.DrawRectangle($PenDim, 274, 76, 164, 174)
  $G.DrawLine($PenDim, 286, 90, 426, 90)
  $G.DrawLine($PenDim, 286, 232, 426, 232)
  Draw-Text $G "VAULT-TEC" $FontMono $BrushDim 274 98 164 "Center"
  Draw-Text $G "CERTIFIED DATE" $FontSmall $BrushDim 274 122 164 "Center"
  Draw-Text $G "SATURDAY" $FontMono $BrushGreen 274 156 164 "Center"
  Draw-Text $G "JUNE 27, 2026" $FontSmall $BrushGreen 274 184 164 "Center"
  Draw-Text $G "FACE 1  SIGNAL OK" $FontSmall $BrushDim 274 214 164 "Center"
} "K1 FACE/DATA" "K2 MODE"

Draw-Screen "06-stopwatch-running-lap.png" "STOPWATCH" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  Draw-Text $G "07:42.3" $FontHuge $BrushGreen 0 92 $W "Center"
  Draw-Text $G "FIELD TEST RUNNING" $FontMono $BrushGreen 0 190 $W "Center"
  Draw-Text $G "LAP  03:15.8" $FontMono $BrushDim 0 224 $W "Center"
} "K1 START/LAP" "K2 RESET/MODE"

Draw-Screen "07-countdown-running.png" "COUNTDOWN" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  Draw-Text $G "03:28" $FontHuge $BrushGreen 0 92 $W "Center"
  Draw-Text $G "RADSAFE COUNTDOWN ACTIVE" $FontMono $BrushGreen 0 196 $W "Center"
  Draw-Text $G "ADJUSTMENT: ONE MINUTE STEPS" $FontMono $BrushDim 0 230 $W "Center"
} "K1 START/ADJ" "K2 RESET/MODE"

Draw-Screen "08-pomodoro-work.png" "POMODORO" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  Draw-Text $G "25:00" $FontHuge $BrushGreen 0 88 $W "Center"
  Draw-Text $G "WORK RATION READY" $FontMono $BrushGreen 0 190 $W "Center"
  Draw-Text $G "CYCLES 0  WORK 25:00  BREAK 05:00" $FontMono $BrushDim 0 225 $W "Center"
} "K1 START/ADJ" "K2 RESET/MODE"

Draw-Screen "09-pomodoro-break.png" "POMODORO" {
  param($G, $BrushGreen, $BrushDim, $PenGreen, $PenDim)
  Draw-Text $G "04:12" $FontHuge $BrushGreen 0 88 $W "Center"
  Draw-Text $G "RECOVERY ACTIVE" $FontMono $BrushGreen 0 190 $W "Center"
  Draw-Text $G "CYCLES 1  WORK 25:00  BREAK 05:00" $FontMono $BrushDim 0 225 $W "Center"
} "K1 START/ADJ" "K2 RESET/MODE"

Write-Host "Rendered landscape Clock Suite previews to $OutDir"
