param(
  [string]$OutDir = (Join-Path (Get-Location) "APPINFO")
)

$Font = @{
  "A" = @("111", "101", "111", "101", "101")
  "B" = @("110", "101", "110", "101", "110")
  "C" = @("111", "100", "100", "100", "111")
  "D" = @("110", "101", "101", "101", "110")
  "E" = @("111", "100", "110", "100", "111")
  "F" = @("111", "100", "110", "100", "100")
  "G" = @("111", "100", "101", "101", "111")
  "H" = @("101", "101", "111", "101", "101")
  "I" = @("111", "010", "010", "010", "111")
  "J" = @("001", "001", "001", "101", "111")
  "K" = @("101", "101", "110", "101", "101")
  "L" = @("100", "100", "100", "100", "111")
  "M" = @("101", "111", "111", "101", "101")
  "N" = @("101", "111", "111", "111", "101")
  "O" = @("111", "101", "101", "101", "111")
  "P" = @("111", "101", "111", "100", "100")
  "Q" = @("111", "101", "101", "111", "001")
  "R" = @("111", "101", "111", "110", "101")
  "S" = @("111", "100", "111", "001", "111")
  "T" = @("111", "010", "010", "010", "010")
  "U" = @("101", "101", "101", "101", "111")
  "V" = @("101", "101", "101", "101", "010")
  "W" = @("101", "101", "111", "111", "101")
  "X" = @("101", "101", "010", "101", "101")
  "Y" = @("101", "101", "010", "010", "010")
  "Z" = @("111", "001", "010", "100", "111")
  "0" = @("111", "101", "101", "101", "111")
  "1" = @("010", "110", "010", "010", "111")
  "2" = @("111", "001", "111", "100", "111")
  "3" = @("111", "001", "111", "001", "111")
  "4" = @("101", "101", "111", "001", "001")
  "5" = @("111", "100", "111", "001", "111")
  "6" = @("111", "100", "111", "101", "111")
  "7" = @("111", "001", "010", "010", "010")
  "8" = @("111", "101", "111", "101", "111")
  "9" = @("111", "101", "111", "001", "111")
  ":" = @("000", "010", "000", "010", "000")
  "-" = @("000", "000", "111", "000", "000")
  " " = @("000", "000", "000", "000", "000")
}

function Reset-Canvas {
  $script:Pix = New-Object byte[] (64 * 64)
}

function Set-Pixel {
  param([int]$X, [int]$Y)
  if ($X -ge 0 -and $X -lt 64 -and $Y -ge 0 -and $Y -lt 64) {
    $script:Pix[($Y * 64) + $X] = 1
  }
}

function Clear-Pixel {
  param([int]$X, [int]$Y)
  if ($X -ge 0 -and $X -lt 64 -and $Y -ge 0 -and $Y -lt 64) {
    $script:Pix[($Y * 64) + $X] = 0
  }
}

function Draw-Line {
  param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1)
  $Dx = [Math]::Abs($X1 - $X0)
  $Sx = if ($X0 -lt $X1) { 1 } else { -1 }
  $Dy = -[Math]::Abs($Y1 - $Y0)
  $Sy = if ($Y0 -lt $Y1) { 1 } else { -1 }
  $Err = $Dx + $Dy
  while ($true) {
    Set-Pixel $X0 $Y0
    if ($X0 -eq $X1 -and $Y0 -eq $Y1) { break }
    $E2 = 2 * $Err
    if ($E2 -ge $Dy) { $Err += $Dy; $X0 += $Sx }
    if ($E2 -le $Dx) { $Err += $Dx; $Y0 += $Sy }
  }
}

function Clear-Line {
  param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1)
  $Dx = [Math]::Abs($X1 - $X0)
  $Sx = if ($X0 -lt $X1) { 1 } else { -1 }
  $Dy = -[Math]::Abs($Y1 - $Y0)
  $Sy = if ($Y0 -lt $Y1) { 1 } else { -1 }
  $Err = $Dx + $Dy
  while ($true) {
    Clear-Pixel $X0 $Y0
    if ($X0 -eq $X1 -and $Y0 -eq $Y1) { break }
    $E2 = 2 * $Err
    if ($E2 -ge $Dy) { $Err += $Dy; $X0 += $Sx }
    if ($E2 -le $Dx) { $Err += $Dx; $Y0 += $Sy }
  }
}

function Draw-Rect {
  param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1)
  Draw-Line $X0 $Y0 $X1 $Y0
  Draw-Line $X1 $Y0 $X1 $Y1
  Draw-Line $X1 $Y1 $X0 $Y1
  Draw-Line $X0 $Y1 $X0 $Y0
}

function Fill-Rect {
  param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1)
  for ($Y = $Y0; $Y -le $Y1; $Y++) {
    Draw-Line $X0 $Y $X1 $Y
  }
}

function Clear-Rect {
  param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1)
  for ($Y = $Y0; $Y -le $Y1; $Y++) {
    Clear-Line $X0 $Y $X1 $Y
  }
}

function Draw-Circle {
  param([int]$Cx, [int]$Cy, [int]$R)
  $X = $R
  $Y = 0
  $Err = 0
  while ($X -ge $Y) {
    Set-Pixel ($Cx + $X) ($Cy + $Y)
    Set-Pixel ($Cx + $Y) ($Cy + $X)
    Set-Pixel ($Cx - $Y) ($Cy + $X)
    Set-Pixel ($Cx - $X) ($Cy + $Y)
    Set-Pixel ($Cx - $X) ($Cy - $Y)
    Set-Pixel ($Cx - $Y) ($Cy - $X)
    Set-Pixel ($Cx + $Y) ($Cy - $X)
    Set-Pixel ($Cx + $X) ($Cy - $Y)
    $Y++
    if ($Err -le 0) { $Err += (2 * $Y) + 1 }
    if ($Err -gt 0) { $X--; $Err -= (2 * $X) + 1 }
  }
}

function Fill-Circle {
  param([int]$Cx, [int]$Cy, [int]$R)
  for ($Y = -$R; $Y -le $R; $Y++) {
    $W = [int][Math]::Floor([Math]::Sqrt(($R * $R) - ($Y * $Y)))
    Draw-Line ($Cx - $W) ($Cy + $Y) ($Cx + $W) ($Cy + $Y)
  }
}

function Clear-Circle {
  param([int]$Cx, [int]$Cy, [int]$R)
  for ($Y = -$R; $Y -le $R; $Y++) {
    $W = [int][Math]::Floor([Math]::Sqrt(($R * $R) - ($Y * $Y)))
    Clear-Line ($Cx - $W) ($Cy + $Y) ($Cx + $W) ($Cy + $Y)
  }
}

function Fill-Ellipse {
  param([int]$Cx, [int]$Cy, [int]$Rx, [int]$Ry)
  for ($Y = -$Ry; $Y -le $Ry; $Y++) {
    $T = 1 - (($Y * $Y) / [double]($Ry * $Ry))
    if ($T -lt 0) { continue }
    $W = [int][Math]::Floor($Rx * [Math]::Sqrt($T))
    Draw-Line ($Cx - $W) ($Cy + $Y) ($Cx + $W) ($Cy + $Y)
  }
}

function Clear-Ellipse {
  param([int]$Cx, [int]$Cy, [int]$Rx, [int]$Ry)
  for ($Y = -$Ry; $Y -le $Ry; $Y++) {
    $T = 1 - (($Y * $Y) / [double]($Ry * $Ry))
    if ($T -lt 0) { continue }
    $W = [int][Math]::Floor($Rx * [Math]::Sqrt($T))
    Clear-Line ($Cx - $W) ($Cy + $Y) ($Cx + $W) ($Cy + $Y)
  }
}

function Draw-Ellipse {
  param([int]$Cx, [int]$Cy, [int]$Rx, [int]$Ry)
  for ($A = 0; $A -lt 360; $A += 3) {
    $Rad = $A * [Math]::PI / 180
    Set-Pixel ([int][Math]::Round($Cx + ([Math]::Cos($Rad) * $Rx))) ([int][Math]::Round($Cy + ([Math]::Sin($Rad) * $Ry)))
  }
}

function Draw-ThickLine {
  param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1, [int]$T = 1)
  for ($O = -$T; $O -le $T; $O++) {
    Draw-Line ($X0 + $O) $Y0 ($X1 + $O) $Y1
    Draw-Line $X0 ($Y0 + $O) $X1 ($Y1 + $O)
  }
}

function Clear-ThickLine {
  param([int]$X0, [int]$Y0, [int]$X1, [int]$Y1, [int]$T = 1)
  for ($O = -$T; $O -le $T; $O++) {
    Clear-Line ($X0 + $O) $Y0 ($X1 + $O) $Y1
    Clear-Line $X0 ($Y0 + $O) $X1 ($Y1 + $O)
  }
}

function Draw-Starburst {
  param([int]$Cx, [int]$Cy, [int]$Inner, [int]$Outer, [int]$Count = 8)
  for ($I = 0; $I -lt $Count; $I++) {
    $A = ($I / $Count) * [Math]::PI * 2
    Draw-Line `
      ([int][Math]::Round($Cx + ([Math]::Cos($A) * $Inner))) `
      ([int][Math]::Round($Cy + ([Math]::Sin($A) * $Inner))) `
      ([int][Math]::Round($Cx + ([Math]::Cos($A) * $Outer))) `
      ([int][Math]::Round($Cy + ([Math]::Sin($A) * $Outer)))
  }
}

function Draw-Atom {
  param([int]$Cx, [int]$Cy)
  Draw-Ellipse $Cx $Cy 11 5
  Draw-Ellipse $Cx $Cy 5 11
  Draw-Line ($Cx - 9) ($Cy - 7) ($Cx + 9) ($Cy + 7)
  Draw-Line ($Cx - 9) ($Cy + 7) ($Cx + 9) ($Cy - 7)
  Fill-Circle $Cx $Cy 2
}

function Draw-MascotHead {
  param([int]$Cx, [int]$Cy)
  Draw-Ellipse $Cx $Cy 8 10
  Draw-Circle ($Cx - 8) ($Cy + 1) 2
  Draw-Circle ($Cx + 8) ($Cy + 1) 2
  Draw-ThickLine ($Cx - 7) ($Cy - 9) ($Cx - 1) ($Cy - 13) 1
  Draw-ThickLine ($Cx - 1) ($Cy - 13) ($Cx + 6) ($Cy - 9) 1
  Fill-Circle ($Cx - 3) ($Cy - 2) 1
  Fill-Circle ($Cx + 4) ($Cy - 2) 1
  Draw-Line ($Cx - 4) ($Cy + 4) ($Cx - 1) ($Cy + 6)
  Draw-Line ($Cx - 1) ($Cy + 6) ($Cx + 4) ($Cy + 5)
  Draw-Line ($Cx - 5) ($Cy + 11) ($Cx - 8) ($Cy + 17)
  Draw-Line ($Cx + 5) ($Cy + 11) ($Cx + 8) ($Cy + 17)
  Draw-Line ($Cx - 11) ($Cy + 18) ($Cx + 11) ($Cy + 18)
}

function Draw-ClockFace {
  param([int]$Cx, [int]$Cy, [int]$R)
  Draw-Circle $Cx $Cy $R
  Draw-Circle $Cx $Cy ($R - 2)
  Draw-Line $Cx ($Cy - $R) $Cx ($Cy - $R + 4)
  Draw-Line $Cx ($Cy + $R) $Cx ($Cy + $R - 4)
  Draw-Line ($Cx - $R) $Cy ($Cx - $R + 4) $Cy
  Draw-Line ($Cx + $R) $Cy ($Cx + $R - 4) $Cy
  Draw-Line $Cx $Cy $Cx ($Cy - 8)
  Draw-Line $Cx $Cy ($Cx + 8) ($Cy + 4)
  Fill-Circle $Cx $Cy 2
}

function Draw-GlobeMini {
  param([int]$Cx, [int]$Cy, [int]$R)
  Draw-Circle $Cx $Cy $R
  Draw-Ellipse $Cx $Cy ([int]($R / 2)) $R
  Draw-Line ($Cx - $R) $Cy ($Cx + $R) $Cy
  Draw-Line $Cx ($Cy - $R) $Cx ($Cy + $R)
  Draw-Line ($Cx - $R + 4) ($Cy - 6) ($Cx + $R - 4) ($Cy - 6)
  Draw-Line ($Cx - $R + 4) ($Cy + 6) ($Cx + $R - 4) ($Cy + 6)
}

function Draw-Rocket {
  param([int]$Cx, [int]$Cy)
  Draw-Line $Cx ($Cy - 10) ($Cx + 6) ($Cy + 4)
  Draw-Line ($Cx + 6) ($Cy + 4) ($Cx - 5) ($Cy + 7)
  Draw-Line ($Cx - 5) ($Cy + 7) $Cx ($Cy - 10)
  Fill-Circle ($Cx + 1) ($Cy - 1) 2
  Draw-Line ($Cx - 3) ($Cy + 7) ($Cx - 8) ($Cy + 12)
  Draw-Line ($Cx + 4) ($Cy + 5) ($Cx + 7) ($Cy + 11)
  Draw-Line ($Cx - 6) ($Cy + 11) ($Cx - 11) ($Cy + 15)
  Draw-Line ($Cx - 4) ($Cy + 12) ($Cx - 5) ($Cy + 17)
}

function Draw-VaultSmile {
  param([int]$Cx, [int]$Cy)
  Fill-Ellipse $Cx $Cy 11 13
  Clear-Circle ($Cx - 4) ($Cy - 2) 1
  Clear-Circle ($Cx + 4) ($Cy - 2) 1
  Clear-ThickLine ($Cx - 5) ($Cy + 5) ($Cx - 1) ($Cy + 7) 1
  Clear-ThickLine ($Cx - 1) ($Cy + 7) ($Cx + 5) ($Cy + 5) 1
  Clear-ThickLine ($Cx - 7) ($Cy - 8) ($Cx - 1) ($Cy - 13) 1
  Clear-ThickLine ($Cx - 1) ($Cy - 13) ($Cx + 7) ($Cy - 8) 1
  Draw-ThickLine ($Cx - 9) ($Cy + 14) ($Cx - 17) ($Cy + 25) 1
  Draw-ThickLine ($Cx + 9) ($Cy + 14) ($Cx + 17) ($Cy + 25) 1
  Draw-Line ($Cx - 17) ($Cy + 25) ($Cx + 17) ($Cy + 25)
}

function Draw-HeavyClock {
  param([int]$Cx, [int]$Cy, [int]$R)
  Fill-Circle $Cx $Cy $R
  Clear-Circle $Cx $Cy ($R - 3)
  Fill-Circle $Cx $Cy 2
  Draw-ThickLine $Cx $Cy $Cx ($Cy - [int]($R * 0.55)) 1
  Draw-ThickLine $Cx $Cy ($Cx + [int]($R * 0.5)) ($Cy + [int]($R * 0.25)) 1
  Draw-Line $Cx ($Cy - $R) $Cx ($Cy - $R + 4)
  Draw-Line ($Cx + $R) $Cy ($Cx + $R - 4) $Cy
  Draw-Line $Cx ($Cy + $R) $Cx ($Cy + $R - 4)
  Draw-Line ($Cx - $R) $Cy ($Cx - $R + 4) $Cy
}

function Draw-HeavyGlobe {
  param([int]$Cx, [int]$Cy, [int]$R)
  Fill-Circle $Cx $Cy $R
  Clear-Circle $Cx $Cy ($R - 2)
  Draw-Ellipse $Cx $Cy ([int]($R * 0.48)) ($R - 1)
  Draw-Line ($Cx - $R + 2) $Cy ($Cx + $R - 2) $Cy
  Draw-Line $Cx ($Cy - $R + 2) $Cx ($Cy + $R - 2)
  Draw-Line ($Cx - $R + 5) ($Cy - 7) ($Cx + $R - 5) ($Cy - 7)
  Draw-Line ($Cx - $R + 5) ($Cy + 7) ($Cx + $R - 5) ($Cy + 7)
}

function Draw-Tomato {
  param([int]$Cx, [int]$Cy)
  Fill-Ellipse $Cx $Cy 15 14
  Clear-Circle ($Cx - 5) ($Cy - 2) 1
  Clear-Circle ($Cx + 5) ($Cy - 2) 1
  Clear-ThickLine ($Cx - 5) ($Cy + 6) $Cx ($Cy + 8) 1
  Clear-ThickLine $Cx ($Cy + 8) ($Cx + 6) ($Cy + 5) 1
  Draw-Line $Cx ($Cy - 14) ($Cx - 4) ($Cy - 21)
  Draw-Line $Cx ($Cy - 14) ($Cx + 4) ($Cy - 21)
  Draw-Line ($Cx - 8) ($Cy - 14) ($Cx - 1) ($Cy - 18)
  Draw-Line ($Cx + 8) ($Cy - 14) ($Cx + 1) ($Cy - 18)
}

function Draw-Text {
  param([string]$Text, [int]$X, [int]$Y, [int]$Scale = 1)
  $Cx = $X
  foreach ($Ch in $Text.ToUpperInvariant().ToCharArray()) {
    $Key = [string]$Ch
    $Rows = if ($Font.ContainsKey($Key)) { $Font[$Key] } else { $Font[" "] }
    for ($Ry = 0; $Ry -lt $Rows.Count; $Ry++) {
      for ($Rx = 0; $Rx -lt 3; $Rx++) {
        if ($Rows[$Ry][$Rx] -eq "1") {
          for ($Sy = 0; $Sy -lt $Scale; $Sy++) {
            for ($Sx = 0; $Sx -lt $Scale; $Sx++) {
              Set-Pixel ($Cx + ($Rx * $Scale) + $Sx) ($Y + ($Ry * $Scale) + $Sy)
            }
          }
        }
      }
    }
    $Cx += 4 * $Scale
  }
}

function Measure-Text {
  param([string]$Text, [int]$Scale = 1)
  if ($Text.Length -eq 0) { return 0 }
  return (($Text.Length * 4) - 1) * $Scale
}

function Draw-CenteredText {
  param([string]$Text, [int]$CenterX, [int]$Y, [int]$Scale = 1)
  Draw-Text $Text ([int]($CenterX - ((Measure-Text $Text $Scale) / 2))) $Y $Scale
}

function Draw-Frame {
  param([string]$Label)
}

function Draw-Symbol {
  param([string]$Name)
  switch ($Name) {
    "CLOCK" {
      Draw-VaultSmile 22 27
      Draw-HeavyClock 45 37 14
      Draw-Starburst 51 20 2 8 8
    }
    "WORLD" {
      Draw-VaultSmile 20 28
      Draw-HeavyGlobe 45 34 15
      Draw-ThickLine 30 40 35 36 1
      Draw-Line 38 22 50 45
    }
    "GLOBE" {
      Draw-HeavyGlobe 30 35 18
      Draw-Ellipse 30 35 27 11
      Draw-Rocket 49 20
      Draw-Starburst 15 21 2 7 8
    }
    "ANALOG" {
      Draw-VaultSmile 18 29
      Draw-HeavyClock 43 34 16
      Draw-Line 43 18 43 11
      Draw-Line 35 12 51 12
    }
    "STOP" {
      Draw-HeavyClock 32 34 20
      Fill-Rect 25 9 39 14
      Draw-Line 32 15 32 18
      Clear-Circle 25 31 1
      Clear-Circle 39 31 1
      Clear-ThickLine 25 42 31 45 1
      Clear-ThickLine 31 45 39 41 1
      Draw-Line 20 52 12 58
      Draw-Line 44 52 54 58
      Draw-Line 17 20 9 16
      Draw-Line 47 20 55 16
    }
    "COUNT" {
      Fill-Circle 31 34 17
      Clear-Circle 25 31 1
      Clear-Circle 37 31 1
      Clear-ThickLine 25 42 31 45 1
      Clear-ThickLine 31 45 38 41 1
      Clear-Rect 28 25 35 29
      Draw-CenteredText "03" 31 25 1
      Draw-ThickLine 42 23 52 14 1
      Draw-Starburst 54 12 2 8 8
      Draw-Line 17 24 8 18
      Draw-Line 45 42 56 47
    }
    "POMO" {
      Draw-Tomato 29 36
      Draw-HeavyClock 48 22 9
      Draw-Line 16 42 8 48
      Draw-Line 43 43 56 49
      Draw-Starburst 16 20 2 7 7
    }
  }
}

function Write-Icon {
  param([string]$FileName, [string]$Label, [string]$Symbol)
  Reset-Canvas
  Draw-Frame $Label
  Draw-Symbol $Symbol

  $Bytes = New-Object byte[] 516
  $Bytes[0] = 64
  $Bytes[1] = 64
  $Bytes[2] = 129
  $Bytes[3] = 0
  for ($Y = 0; $Y -lt 64; $Y++) {
    for ($X = 0; $X -lt 64; $X++) {
      if ($script:Pix[($Y * 64) + $X]) {
        $Index = 4 + ($Y * 8) + [int][Math]::Floor($X / 8)
        $Bytes[$Index] = $Bytes[$Index] -bor (128 -shr ($X % 8))
      }
    }
  }
  [IO.File]::WriteAllBytes((Join-Path $OutDir $FileName), $Bytes)
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Write-Icon "CLOCK.IMG" "CLOCK" "CLOCK"
Write-Icon "WORLD.IMG" "WORLD" "WORLD"
Write-Icon "GLOBE.IMG" "GLOBE" "GLOBE"
Write-Icon "ANALOG.IMG" "ANALOG" "ANALOG"
Write-Icon "STOPWATCH.IMG" "STOP" "STOP"
Write-Icon "COUNTDOWN.IMG" "COUNT" "COUNT"
Write-Icon "POMODORO.IMG" "POMO" "POMO"

Write-Host "Generated RobCo holotape icons in $OutDir"
