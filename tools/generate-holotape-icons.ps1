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
  Draw-Rect 4 5 59 58
  Draw-Rect 7 13 56 55
  Draw-Line 7 18 56 18
  Draw-Line 7 49 56 49
  for ($Y = 22; $Y -le 46; $Y += 6) {
    Set-Pixel 11 $Y
    Set-Pixel 53 $Y
  }
  for ($X = 15; $X -le 49; $X += 8) {
    Set-Pixel $X 16
    Set-Pixel $X 47
  }
  Draw-CenteredText "ROBCO" 31 7 1
  Draw-CenteredText $Label 31 50 1
}

function Draw-Symbol {
  param([string]$Name)
  switch ($Name) {
    "CLOCK" {
      Draw-Rect 13 24 50 38
      Draw-Line 15 40 48 40
      Draw-CenteredText "12:34" 31 29 1
      Draw-Line 18 22 18 20
      Draw-Line 44 22 44 20
      Draw-Line 20 20 42 20
      Draw-Line 52 25 55 23
      Draw-Line 52 30 56 30
      Draw-Line 52 35 55 37
    }
    "WORLD" {
      Draw-Circle 31 33 15
      Draw-Line 16 33 46 33
      Draw-Line 31 18 31 48
      Draw-Line 22 21 22 45
      Draw-Line 40 21 40 45
      Fill-Circle 20 25 2
      Fill-Circle 43 29 2
      Fill-Circle 36 43 2
      Draw-Line 20 25 43 29
      Draw-Line 43 29 36 43
    }
    "GLOBE" {
      Draw-Circle 31 33 16
      Draw-Circle 31 33 14
      Draw-Line 15 33 47 33
      Draw-Line 31 17 31 49
      Draw-Line 23 19 23 47
      Draw-Line 39 19 39 47
      Draw-Line 28 19 22 27
      Draw-Line 22 27 25 34
      Draw-Line 25 34 20 41
      Draw-Line 35 22 44 27
      Draw-Line 44 27 40 36
      Draw-Line 40 36 45 43
      Draw-Line 18 22 44 48
    }
    "ANALOG" {
      Draw-Circle 31 33 16
      Draw-Circle 31 33 13
      Draw-Line 31 17 31 21
      Draw-Line 31 45 31 49
      Draw-Line 15 33 19 33
      Draw-Line 43 33 47 33
      Draw-Line 31 33 31 22
      Draw-Line 31 33 42 37
      Fill-Circle 31 33 2
    }
    "STOP" {
      Draw-Rect 27 16 35 19
      Draw-Line 31 20 31 22
      Draw-Circle 31 35 15
      Draw-Circle 31 35 12
      Draw-Line 31 35 31 25
      Draw-Line 31 35 39 40
      Fill-Circle 31 35 2
      Draw-Line 20 47 42 47
    }
    "COUNT" {
      Draw-Rect 13 22 50 43
      Draw-CenteredText "00:30" 31 27 1
      Draw-Rect 17 37 46 40
      Fill-Rect 18 38 34 39
      Draw-Line 14 19 49 19
      Draw-Line 18 46 44 46
      Draw-Line 47 22 53 17
      Draw-Line 47 23 54 23
      Draw-Line 47 24 53 29
    }
    "POMO" {
      Draw-Circle 24 33 11
      Draw-Circle 39 33 11
      Draw-Line 31 22 31 44
      Draw-CenteredText "W" 24 31 1
      Draw-CenteredText "B" 39 31 1
      Draw-Line 20 20 42 20
      Draw-Line 42 20 38 17
      Draw-Line 42 20 38 23
      Draw-Line 42 46 20 46
      Draw-Line 20 46 24 43
      Draw-Line 20 46 24 49
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
