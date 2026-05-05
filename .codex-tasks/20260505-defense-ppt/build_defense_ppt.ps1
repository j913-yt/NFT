$ErrorActionPreference = 'Stop'

function Get-Rgb($r, $g, $b) {
    return [int]($r + ($g * 256) + ($b * 65536))
}

function Set-Font($shape, $size, $color, $bold = $false) {
    $font = $shape.TextFrame.TextRange.Font
    $font.Name = 'Microsoft YaHei'
    $font.NameFarEast = 'Microsoft YaHei'
    $font.Size = $size
    $font.Color.RGB = $color
    $font.Bold = if ($bold) { -1 } else { 0 }
}

function Add-Text($slide, $text, $x, $y, $w, $h, $size, $color, $bold = $false) {
    $shape = $slide.Shapes.AddTextbox(1, $x, $y, $w, $h)
    $shape.TextFrame.MarginLeft = 0
    $shape.TextFrame.MarginRight = 0
    $shape.TextFrame.MarginTop = 0
    $shape.TextFrame.MarginBottom = 0
    $shape.TextFrame.WordWrap = -1
    $shape.TextFrame.TextRange.Text = $text
    Set-Font $shape $size $color $bold
    return $shape
}

function Add-Title($slide, $title, $palette) {
    Add-Text $slide $title 54 34 610 48 28 $palette.Ink $true | Out-Null
    $line = $slide.Shapes.AddShape(1, 54, 88, 140, 4)
    $line.Fill.ForeColor.RGB = $palette.Black
    $line.Line.Visible = 0
}

function Add-Card($slide, $x, $y, $w, $h, $fill, $lineColor) {
    $shape = $slide.Shapes.AddShape(5, $x, $y, $w, $h)
    $shape.Fill.ForeColor.RGB = $fill
    $shape.Line.ForeColor.RGB = $lineColor
    $shape.Line.Weight = 1.2
    return $shape
}

function Add-Bullets($slide, $items, $x, $y, $w, $size, $palette) {
    $offset = 0
    foreach ($item in $items) {
        $dot = $slide.Shapes.AddShape(9, $x, $y + $offset + 8, 8, 8)
        $dot.Fill.ForeColor.RGB = $palette.Black
        $dot.Line.Visible = 0
        Add-Text $slide $item ($x + 20) ($y + $offset) $w 34 $size $palette.Ink $false | Out-Null
        $offset += 46
    }
}

function Add-Placeholder($slide, $text, $x, $y, $w, $h, $palette) {
    $box = Add-Card $slide $x $y $w $h $palette.Soft $palette.Black
    $box.Line.DashStyle = 4
    Add-Text $slide $text ($x + 26) ($y + ($h / 2) - 22) ($w - 52) 54 20 $palette.Muted $true | Out-Null
}

function Add-Picture($slide, $path, $x, $y, $w, $h) {
    if (Test-Path -LiteralPath $path) {
        $fullPath = [System.IO.Path]::GetFullPath($path)
        $picture = $slide.Shapes.AddPicture($fullPath, 0, -1, $x, $y, $w, $h)
        $picture.Line.ForeColor.RGB = 0
        $picture.Line.Weight = 1.2
        return $picture
    }
}

function Add-CompactBullets($slide, $items, $positions, $palette) {
    for ($i = 0; $i -lt $items.Count; $i++) {
        $pos = $positions[$i]
        $dot = $slide.Shapes.AddShape(9, $pos[0], $pos[1] + 6, 6, 6)
        $dot.Fill.ForeColor.RGB = $palette.Black
        $dot.Line.Visible = 0
        Add-Text $slide $items[$i] ($pos[0] + 16) $pos[1] $pos[2] 22 12 $palette.Ink $false | Out-Null
    }
}

function Set-Notes($slide, $notes) {
    try {
        $slide.NotesPage.Shapes.Placeholders(2).TextFrame.TextRange.Text = $notes
    } catch {
    }
}

function Add-StepCards($slide, $steps, $palette) {
    $x = 72
    foreach ($step in $steps) {
        Add-Card $slide $x 156 242 150 $palette.Card $palette.Black | Out-Null
        Add-Text $slide $step[0] ($x + 18) 174 38 44 30 $palette.Black $true | Out-Null
        Add-Text $slide $step[1] ($x + 64) 172 150 30 21 $palette.Ink $true | Out-Null
        Add-Text $slide $step[2] ($x + 24) 222 190 54 14 $palette.Muted $false | Out-Null
        if ($x -lt 560) {
            $line = $slide.Shapes.AddLine(($x + 242), 230, ($x + 278), 230)
            $line.Line.ForeColor.RGB = $palette.Black
            $line.Line.EndArrowheadStyle = 3
        }
        $x += 286
    }
}

function Add-SlideBackground($slide, $palette) {
    $bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
    $bg.Fill.ForeColor.RGB = $palette.Background
    $bg.Line.Visible = 0
    $bg.ZOrder(1)
}

function Add-Footer($slide, $index, $palette) {
    Add-Text $slide ($script:FooterPrefix + "  /  " + $index) 54 510 300 18 9 $palette.Muted $false | Out-Null
}

function New-Deck($configPath) {
    $json = [System.IO.File]::ReadAllText($configPath, [System.Text.Encoding]::UTF8)
    return $json | ConvertFrom-Json
}

function Add-SimpleSlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette
    Add-Text $slide $data.lead 72 126 720 40 22 $palette.Teal $true | Out-Null
    Add-Bullets $slide $data.bullets 86 202 730 19 $palette
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

function Add-ImageSlide($presentation, $index, $data, $palette, $imagePath, $imageY) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette
    Add-Picture $slide $imagePath 72 $imageY 816 260
    Add-Bullets $slide $data.bullets 92 390 760 15 $palette
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

function Add-DiagramBox($slide, $title, $subtitle, $x, $y, $w, $h, $palette) {
    Add-Card $slide $x $y $w $h $palette.Card $palette.Black | Out-Null
    Add-Text $slide $title ($x + 16) ($y + 14) ($w - 32) 24 18 $palette.Ink $true | Out-Null
    Add-Text $slide $subtitle ($x + 16) ($y + 42) ($w - 32) 20 12 $palette.Muted $false | Out-Null
}

function Add-Arrow($slide, $x1, $y1, $x2, $y2, $palette) {
    $line = $slide.Shapes.AddLine($x1, $y1, $x2, $y2)
    $line.Line.ForeColor.RGB = $palette.Black
    $line.Line.Weight = 1.6
    $line.Line.EndArrowheadStyle = 3
}

function Add-ArchitectureSlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette

    $boxes = $data.boxes
    Add-DiagramBox $slide $boxes[0][0] $boxes[0][1] 74 124 190 76 $palette
    Add-DiagramBox $slide $boxes[1][0] $boxes[1][1] 385 124 190 76 $palette
    Add-DiagramBox $slide $boxes[2][0] $boxes[2][1] 696 124 190 76 $palette
    Add-DiagramBox $slide $boxes[3][0] $boxes[3][1] 385 294 190 76 $palette
    Add-DiagramBox $slide $boxes[4][0] $boxes[4][1] 696 294 190 76 $palette

    Add-Arrow $slide 264 162 385 162 $palette
    Add-Text $slide $data.arrowLabels[0] 305 136 70 18 10 $palette.Muted $false | Out-Null
    Add-Arrow $slide 575 162 696 162 $palette
    Add-Text $slide $data.arrowLabels[1] 626 136 44 18 10 $palette.Muted $false | Out-Null
    Add-Arrow $slide 480 200 480 294 $palette
    Add-Text $slide $data.arrowLabels[2] 495 238 80 18 10 $palette.Muted $false | Out-Null
    Add-Arrow $slide 575 332 696 332 $palette
    Add-Text $slide $data.arrowLabels[3] 602 306 88 18 10 $palette.Muted $false | Out-Null

    Add-Text $slide $data.caption 290 394 380 30 22 $palette.Ink $true | Out-Null
    $positions = @(
        @(80, 448, 360),
        @(80, 478, 360),
        @(500, 448, 360),
        @(500, 478, 360)
    )
    Add-CompactBullets $slide $data.bullets $positions $palette
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

function Add-FlowSlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette

    $labels = $data.labels
    $x = 48
    foreach ($label in $labels) {
        Add-Card $slide $x 166 130 72 $palette.Card $palette.Black | Out-Null
        Add-Text $slide $label ($x + 10) 190 110 24 15 $palette.Ink $true | Out-Null
        if ($x -lt 760) {
            Add-Arrow $slide ($x + 130) 202 ($x + 152) 202 $palette
        }
        $x += 152
    }

    Add-Text $slide $data.caption 236 294 520 26 20 $palette.Ink $true | Out-Null
    Add-Bullets $slide $data.bullets 92 360 760 15 $palette
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

function Add-TitleSlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    $bg = $slide.Shapes.AddShape(1, 0, 0, 960, 540)
    $bg.Fill.ForeColor.RGB = $palette.Ink
    $bg.Line.Visible = 0
    $panel = $slide.Shapes.AddShape(1, 0, 0, 960, 150)
    $panel.Fill.ForeColor.RGB = $palette.Teal
    $panel.Line.Visible = 0
    Add-Text $slide $data.subtitle 72 120 280 28 18 $palette.Gold $true | Out-Null
    Add-Text $slide $data.title 72 164 510 132 36 $palette.White $true | Out-Null
    Add-Picture $slide $script:CoverImage 620 112 272 272 | Out-Null
    $y = 330
    foreach ($line in $data.meta) {
        Add-Text $slide $line 74 $y 400 23 15 $palette.Light $false | Out-Null
        $y += 28
    }
    Add-Text $slide $data.tagline 608 410 286 46 19 $palette.White $true | Out-Null
    Set-Notes $slide $data.notes
}

function Add-LoginSlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette
    Add-StepCards $slide $data.steps $palette
    Add-Bullets $slide $data.bullets 100 354 740 17 $palette
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

function Add-PlaceholderSlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette
    Add-Bullets $slide $data.bullets 70 138 430 16 $palette
    Add-Placeholder $slide $data.placeholder 540 150 340 250 $palette
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

function Add-TradeSlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette
    $labels = $data.labels
    $x = 80
    foreach ($label in $labels) {
        Add-Card $slide $x 154 170 94 $palette.Card $palette.Black | Out-Null
        Add-Text $slide $label ($x + 14) 186 142 28 18 $palette.Ink $true | Out-Null
        if ($x -lt 650) {
            $line = $slide.Shapes.AddLine(($x + 170), 201, ($x + 218), 201)
            $line.Line.ForeColor.RGB = $palette.Black
            $line.Line.EndArrowheadStyle = 3
        }
        $x += 220
    }
    Add-Bullets $slide $data.bullets 92 314 760 16 $palette
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

function Add-SummarySlide($presentation, $index, $data, $palette) {
    $slide = $presentation.Slides.Add($index, 12)
    Add-SlideBackground $slide $palette
    Add-Title $slide $data.title $palette
    Add-Bullets $slide $data.bullets 94 138 760 18 $palette
    Add-Text $slide $data.thanks 260 430 440 56 30 $palette.Teal $true | Out-Null
    Add-Footer $slide $index $palette
    Set-Notes $slide $data.notes
}

$configPath = Join-Path $PSScriptRoot 'raw\slides.json'
$config = New-Deck $configPath
$script:FooterPrefix = $config.footerPrefix
$script:CoverImage = $config.coverImage
$previewDir = [System.IO.Path]::GetFullPath($config.previewDir)
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

$palette = [PSCustomObject]@{
    Background = Get-Rgb 247 250 252
    Card = Get-Rgb 255 255 255
    Soft = Get-Rgb 238 244 247
    Ink = Get-Rgb 18 34 48
    Muted = Get-Rgb 87 103 118
    Line = Get-Rgb 0 0 0
    Black = Get-Rgb 0 0 0
    Teal = Get-Rgb 0 168 150
    Gold = Get-Rgb 244 185 66
    Purple = Get-Rgb 124 58 237
    White = Get-Rgb 255 255 255
    Light = Get-Rgb 228 240 245
}

$ppt = New-Object -ComObject PowerPoint.Application
$ppt.Visible = -1
$presentation = $ppt.Presentations.Add()
$presentation.PageSetup.SlideWidth = 960
$presentation.PageSetup.SlideHeight = 540

try {
    $index = 1
    foreach ($slideData in $config.slides) {
        switch ($slideData.kind) {
            'title' { Add-TitleSlide $presentation $index $slideData $palette }
            'goal' { Add-SimpleSlide $presentation $index $slideData $palette }
            'architecture' { Add-ArchitectureSlide $presentation $index $slideData $palette }
            'flow' { Add-FlowSlide $presentation $index $slideData $palette }
            'login' { Add-LoginSlide $presentation $index $slideData $palette }
            'create' { Add-PlaceholderSlide $presentation $index $slideData $palette }
            'market' { Add-PlaceholderSlide $presentation $index $slideData $palette }
            'trade' { Add-TradeSlide $presentation $index $slideData $palette }
            'profile' { Add-PlaceholderSlide $presentation $index $slideData $palette }
            'summary' { Add-SummarySlide $presentation $index $slideData $palette }
        }
        $index += 1
    }

    $outputPath = [System.IO.Path]::GetFullPath($config.output)
    $presentation.SaveAs($outputPath, 24)
    for ($i = 1; $i -le $presentation.Slides.Count; $i++) {
        $previewPath = Join-Path $previewDir ("slide-{0:D2}.png" -f $i)
        $presentation.Slides.Item($i).Export($previewPath, 'PNG', 1600, 900)
    }
}
finally {
    $presentation.Close()
    $ppt.Quit()
}

Write-Output $outputPath
