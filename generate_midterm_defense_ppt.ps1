$ErrorActionPreference = "Stop"

function Get-RgbValue([int]$r, [int]$g, [int]$b) {
  return $r + (256 * $g) + (65536 * $b)
}

function Set-SlideBackground($slide, [int]$r, [int]$g, [int]$b) {
  $slide.FollowMasterBackground = 0
  $slide.Background.Fill.Visible = 1
  $slide.Background.Fill.Solid()
  $slide.Background.Fill.ForeColor.RGB = Get-RgbValue $r $g $b
}

function Add-TextBox($slide, [double]$left, [double]$top, [double]$width, [double]$height, [string]$text, [int]$fontSize, [int]$color, [bool]$bold = $false, [string]$fontName = "Microsoft YaHei", [int]$alignment = 1) {
  $shape = $slide.Shapes.AddTextbox(1, $left, $top, $width, $height)
  $shape.TextFrame.TextRange.Text = $text
  $shape.TextFrame.TextRange.Font.Name = $fontName
  $shape.TextFrame.TextRange.Font.NameFarEast = $fontName
  $shape.TextFrame.TextRange.Font.Size = $fontSize
  $shape.TextFrame.TextRange.Font.Bold = [int]$bold
  $shape.TextFrame.TextRange.Font.Color.RGB = $color
  $shape.TextFrame.TextRange.ParagraphFormat.Alignment = $alignment
  $shape.TextFrame.MarginLeft = 6
  $shape.TextFrame.MarginRight = 6
  $shape.TextFrame.MarginTop = 4
  $shape.TextFrame.MarginBottom = 4
  return $shape
}

function Add-Card($slide, [double]$left, [double]$top, [double]$width, [double]$height, [string]$title, [string]$body, [int]$fillColor, [int]$titleColor, [int]$bodyColor) {
  $card = $slide.Shapes.AddShape(1, $left, $top, $width, $height)
  $card.Fill.Visible = 1
  $card.Fill.Solid()
  $card.Fill.ForeColor.RGB = $fillColor
  $card.Line.Visible = 0

  Add-TextBox $slide ($left + 14) ($top + 12) ($width - 28) 30 $title 18 $titleColor $true | Out-Null
  Add-TextBox $slide ($left + 14) ($top + 46) ($width - 28) ($height - 58) $body 11 $bodyColor $false | Out-Null
}

function Add-Tag($slide, [double]$left, [double]$top, [double]$width, [string]$text, [int]$fillColor, [int]$fontColor) {
  $tag = $slide.Shapes.AddShape(1, $left, $top, $width, 26)
  $tag.Fill.Visible = 1
  $tag.Fill.Solid()
  $tag.Fill.ForeColor.RGB = $fillColor
  $tag.Line.Visible = 0
  Add-TextBox $slide ($left + 8) ($top + 3) ($width - 16) 20 $text 10 $fontColor $true | Out-Null
}

function Add-Footer($slide, [string]$label, [int]$slideNo, [int]$mutedColor) {
  Add-TextBox $slide 36 508 700 18 $label 9 $mutedColor $false | Out-Null
  Add-TextBox $slide 900 506 28 18 ([string]$slideNo) 10 $mutedColor $true "Microsoft YaHei" 2 | Out-Null
}

function Add-BulletsSlide($presentation, [string]$title, [string[]]$bullets, [int]$slideNo, [string]$footerText) {
  $slide = $presentation.Slides.Add($presentation.Slides.Count + 1, 12)
  $white = Get-RgbValue 248 250 255
  $muted = Get-RgbValue 176 191 224
  $accent = Get-RgbValue 45 198 255
  $cardColor = Get-RgbValue 19 31 58

  Set-SlideBackground $slide 11 18 36
  $line = $slide.Shapes.AddShape(1, 36, 34, 86, 8)
  $line.Fill.Solid()
  $line.Fill.ForeColor.RGB = $accent
  $line.Line.Visible = 0

  Add-TextBox $slide 36 48 780 40 $title 26 $white $true | Out-Null
  $body = (($bullets | ForEach-Object { "• $_" }) -join "`r`n`r`n")
  $bodyShape = Add-TextBox $slide 44 108 872 344 $body 18 $white $false
  $bodyShape.Fill.Visible = 1
  $bodyShape.Fill.Solid()
  $bodyShape.Fill.ForeColor.RGB = $cardColor
  $bodyShape.Line.Visible = 0
  $bodyShape.TextFrame.MarginLeft = 22
  $bodyShape.TextFrame.MarginRight = 22
  $bodyShape.TextFrame.MarginTop = 18
  $bodyShape.TextFrame.MarginBottom = 18

  Add-Footer $slide $footerText $slideNo $muted
  return $slide
}

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$outputPath = Join-Path $root "NFT_Midterm_Defense_PPT.pptx"

$ppt = $null
$presentation = $null

try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $ppt.Visible = -1
  $presentation = $ppt.Presentations.Add()
  $presentation.PageSetup.SlideWidth = 960
  $presentation.PageSetup.SlideHeight = 540

  $white = Get-RgbValue 248 250 255
  $muted = Get-RgbValue 170 186 219
  $accent = Get-RgbValue 45 198 255
  $accent2 = Get-RgbValue 59 225 176
  $pink = Get-RgbValue 255 99 146
  $bg = Get-RgbValue 9 14 28
  $card = Get-RgbValue 19 31 58
  $card2 = Get-RgbValue 15 24 45

  $slide = $presentation.Slides.Add(1, 12)
  Set-SlideBackground $slide 9 14 28
  $hero = $slide.Shapes.AddShape(1, 36, 46, 112, 112)
  $hero.Fill.Solid()
  $hero.Fill.ForeColor.RGB = $accent
  $hero.Line.Visible = 0
  Add-TextBox $slide 55 79 74 46 "NFT" 24 $bg $true "Microsoft YaHei" 2 | Out-Null
  Add-TextBox $slide 170 72 700 48 "基于区块链的 NFT 数字藏品市场系统" 28 $white $true | Out-Null
  Add-TextBox $slide 170 124 560 24 "中期答辩汇报 PPT" 16 $accent $true | Out-Null
  Add-TextBox $slide 170 158 670 58 "已完成前后端、智能合约、IPFS 存储与市场交易主流程，当前重点从「功能闭环」走向「工程稳定」。" 17 $white $false | Out-Null
  Add-Tag $slide 170 238 122 "钱包签名登录" $card $accent | Out-Null
  Add-Tag $slide 304 238 120 "IPFS 元数据" $card $accent2 | Out-Null
  Add-Tag $slide 436 238 148 "链上铸造与交易" $card $pink | Out-Null
  Add-TextBox $slide 36 494 400 18 "汇报人：________    时间：________" 10 $muted $false | Out-Null
  Add-TextBox $slide 824 492 100 18 "NFT Project" 10 $muted $true "Microsoft YaHei" 2 | Out-Null

  $slide = $presentation.Slides.Add(2, 12)
  Set-SlideBackground $slide 11 18 36
  Add-TextBox $slide 36 36 420 34 "1. 项目背景与研究目标" 26 $white $true | Out-Null
  Add-Card $slide 36 98 280 150 "选题背景" "数字内容易复制、难确权。`r`nNFT 通过链上 Token 实现唯一标识、所有权记录与交易追溯，适合构建数字藏品市场。" $card $white $muted
  Add-Card $slide 340 98 280 150 "项目目标" "不是只做 ERC721 Demo，而是实现一个包含前端、后端、数据库、IPFS 与合约的完整平台原型。" $card $white $muted
  Add-Card $slide 644 98 280 150 "阶段目标" "中期重点先把主流程打通：身份认证、资源上传、元数据生成、链上铸造、上架购买、订单同步。" $card $white $muted
  Add-Card $slide 36 276 888 170 "当前判断" "项目已经从「概念验证」进入「系统雏形」阶段。`r`n当前核心完成度约 70%，已具备从用户登录到 NFT 交易与个人资产管理的基本闭环。`r`n下一阶段重点是工程稳定性、链上链下一致性和自动化测试补全。" $card2 $white $muted
  Add-Footer $slide "项目背景与目标 | 中期汇报" 2 $muted

  $slide = $presentation.Slides.Add(3, 12)
  Set-SlideBackground $slide 9 15 32
  Add-TextBox $slide 36 36 430 34 "2. 系统总体架构" 26 $white $true | Out-Null
  Add-TextBox $slide 36 78 520 22 "采用「链上负责确权交易，链下负责展示与业务聚合」的协同架构" 13 $accent $true | Out-Null
  Add-Card $slide 36 126 204 160 "前端层" "Next.js + React`r`n负责市场展示、创建页、详情交易、个人中心、钱包交互与流程反馈。" $card $white $muted
  Add-Card $slide 258 126 204 160 "后端层" "Go + Mux + GORM + MySQL`r`n负责 JWT 鉴权、NFT 数据、订单、上传、IPFS 接口与资料管理。" $card $white $muted
  Add-Card $slide 480 126 204 160 "链上层" "Solidity + Hardhat`r`n实现 NFT 铸造、上架、购买、所有权转移与基础查询。" $card $white $muted
  Add-Card $slide 702 126 222 160 "存储层" "MySQL 负责链下业务数据；Pinata/IPFS 负责媒体文件与元数据持久化。" $card $white $muted
  Add-Card $slide 36 318 430 132 "链上负责" "1. NFT 唯一性确权`r`n2. Token 铸造`r`n3. 上架价格记录`r`n4. 原生代币购买与所有权转移" $card2 $white $muted
  Add-Card $slide 494 318 430 132 "链下负责" "1. 用户会话与资料`r`n2. 市场筛选与展示`r`n3. 订单记录与资产管理`r`n4. 页面响应与业务体验优化" $card2 $white $muted
  Add-Footer $slide "系统架构 | 链上 + 链下协同" 3 $muted

  $slide = $presentation.Slides.Add(4, 12)
  Set-SlideBackground $slide 11 18 36
  Add-TextBox $slide 36 36 410 34 "3. 技术栈与仓库结构" 26 $white $true | Out-Null
  Add-Card $slide 36 102 210 160 "frontend" "Next.js 14`r`nReact 18`r`nTailwind CSS`r`nAxios`r`nEthers.js" $card $white $muted
  Add-Card $slide 266 102 210 160 "backend" "Go 1.22`r`nGorilla Mux`r`nGORM`r`nMySQL`r`nJWT" $card $white $muted
  Add-Card $slide 496 102 210 160 "contracts" "Solidity 0.8.24`r`nOpenZeppelin ERC721URIStorage`r`n基础交易逻辑" $card $white $muted
  Add-Card $slide 726 102 198 160 "hardhat" "合约编译`r`n部署脚本`r`n连接 Sepolia`r`n测试网验证" $card $white $muted
  Add-Card $slide 36 292 888 160 "技术选型思路" "前端负责高交互与钱包接入，后端负责鉴权与业务聚合，链上负责可信交易，IPFS 负责资源与元数据持久化。整个仓库已经形成清晰的模块边界，便于后续继续扩展排行榜、后台管理和事件监听。" $card2 $white $muted
  Add-Footer $slide "技术栈与模块边界" 4 $muted

  $slide = $presentation.Slides.Add(5, 12)
  Set-SlideBackground $slide 9 14 28
  Add-TextBox $slide 36 36 480 34 "4. 核心业务闭环总览" 26 $white $true | Out-Null
  Add-TextBox $slide 36 80 560 24 "答辩时要反复强调「闭环」，而不是只展示单个页面。" 13 $accent $true | Out-Null
  Add-Card $slide 36 124 205 250 "登录闭环" "连接钱包`r`n→ 请求 nonce`r`n→ 钱包签名`r`n→ 后端验签`r`n→ 签发 JWT`r`n→ 进入个人中心" $card $white $muted
  Add-Card $slide 258 124 205 250 "创建闭环" "填写信息`r`n→ 上传媒体`r`n→ IPFS 生成资源与元数据`r`n→ 钱包发起铸造`r`n→ 后端写入 NFT 记录" $card $white $muted
  Add-Card $slide 480 124 205 250 "购买闭环" "详情页查看`r`n→ 钱包确认交易`r`n→ 链上 buy`r`n→ 返回 txHash`r`n→ 后端创建订单`r`n→ 更新 owner" $card $white $muted
  Add-Card $slide 702 124 222 250 "资产管理闭环" "个人中心`r`n→ 当前持有`r`n→ 历史买入`r`n→ 历史卖出`r`n→ 用户名与头像维护" $card $white $muted
  Add-Footer $slide "中期汇报关键词：业务闭环" 5 $muted

  Add-BulletsSlide $presentation "5. 身份认证与用户模块" @(
    "当前系统已收口为钱包签名登录，避免多套身份体系并行带来的复杂度。",
    "登录流程为：后端生成 nonce，前端调用 personal_sign，后端恢复地址并签发 JWT。",
    "这种方式比「只读取钱包地址就登录」更规范，也更符合 Web3 身份验证思路。",
    "个人中心支持用户名修改、头像上传和钱包地址展示，形成基础用户资料管理能力。"
  ) 6 "身份认证模块 | 钱包登录" | Out-Null

  Add-BulletsSlide $presentation "6. NFT 创建流程" @(
    "创建页支持名称、描述、分类、价格以及图片/音频/视频文件上传。",
    "音频和视频类型可额外上传封面图，提升展示完整度。",
    "后端先把资源上传到 Pinata/IPFS，并自动生成元数据 JSON。",
    "前端再调用合约执行铸造；如果设置价格，则直接走「铸造并上架」流程。",
    "链上确认完成后，前端把合约地址、TokenId、TokenURI、metadataUri 等信息同步到后端。"
  ) 7 "创建模块 | 文件 -> IPFS -> 链上 -> 后端" | Out-Null

  Add-BulletsSlide $presentation "7. 市场展示与详情交易" @(
    "首页会展示在售数量、地板价、平均价和热门分类，承担市场概览作用。",
    "市场页支持分类筛选、关键词检索、价格区间过滤与多种排序方式。",
    "详情页会根据媒体类型自适应展示图片、音频和视频内容。",
    "普通用户可直接购买，拥有者可更新价格、重新上架或下架，页面同时展示成交记录与交易哈希。"
  ) 8 "市场与详情页 | 展示 + 交易" | Out-Null

  Add-BulletsSlide $presentation "8. 订单与个人资产管理" @(
    "后端订单模块支持创建订单、查询买入记录、查询卖出记录和查看某个 NFT 的历史成交记录。",
    "个人中心对 NFT、订单和用户资料进行了统一聚合，具备基础资产管理界面。",
    "当前已经修正了「买入历史在转卖后消失」的问题，历史记录保持独立于当前 owner 状态。",
    "这部分让项目从「能发 NFT」升级为「能管理 NFT 资产」的平台原型。"
  ) 9 "个人中心与订单模块" | Out-Null

  $slide = $presentation.Slides.Add(10, 12)
  Set-SlideBackground $slide 11 18 36
  Add-TextBox $slide 36 36 430 34 "9. 项目亮点与答辩可强调点" 26 $white $true | Out-Null
  Add-Card $slide 36 104 280 152 "亮点 1" "不是单页 Demo，而是前端、后端、数据库、IPFS、合约完整联动的系统。" $card $white $muted
  Add-Card $slide 340 104 280 152 "亮点 2" "支持图片、音频、视频三类 NFT，且音视频支持封面图，不局限于图片藏品。" $card $white $muted
  Add-Card $slide 644 104 280 152 "亮点 3" "采用链上链下分层架构，兼顾可信交易与高频业务查询体验。" $card $white $muted
  Add-Card $slide 36 286 280 152 "亮点 4" "钱包登录采用 nonce + 签名 + JWT，会话逻辑更完整。" $card $white $muted
  Add-Card $slide 340 286 280 152 "亮点 5" "创建与购买过程有阶段化进度提示，区块链交互过程更直观。" $card $white $muted
  Add-Card $slide 644 286 280 152 "亮点 6" "已经具备从创建、展示、交易到资产管理的完整业务闭环。" $card $white $muted
  Add-Footer $slide "亮点页 | 适合答辩重点展开" 10 $muted

  $slide = $presentation.Slides.Add(11, 12)
  Set-SlideBackground $slide 9 14 28
  Add-TextBox $slide 36 36 420 34 "10. 当前存在的问题" 26 $white $true | Out-Null
  Add-Card $slide 36 104 420 146 "工程问题" "前端生产构建稳定性仍需继续排查和收口，当前更偏开发态可运行。" $card $white $muted
  Add-Card $slide 492 104 432 146 "一致性问题" "链上交易结果写回数据库，目前仍主要依赖前端回传，后续要补交易回执校验或事件监听。" $card $white $muted
  Add-Card $slide 36 280 420 146 "测试问题" "后端 go test 虽能通过，但基本没有实质测试用例，自动化测试仍不足。" $card $white $muted
  Add-Card $slide 492 280 432 146 "展示问题" "部分历史文案与编码细节还需要继续打磨，答辩演示层面可进一步优化。" $card $white $muted
  Add-Footer $slide "中期答辩不回避问题，重点是知道问题在哪里" 11 $muted

  $slide = $presentation.Slides.Add(12, 12)
  Set-SlideBackground $slide 11 18 36
  Add-TextBox $slide 36 36 420 34 "11. 下一阶段工作计划" 26 $white $true | Out-Null
  Add-Card $slide 36 108 204 258 "计划 1" "继续完善工程化能力`r`n- 排查前端 build 问题`r`n- 优化部署与环境配置`r`n- 提高交付稳定性" $card $white $muted
  Add-Card $slide 258 108 204 258 "计划 2" "增强链上链下同步`r`n- 校验交易回执`r`n- 监听关键事件`r`n- 降低对前端回传的依赖" $card $white $muted
  Add-Card $slide 480 108 204 258 "计划 3" "继续完善数据与安全`r`n- 补更多输入校验`r`n- 强化上传与限流`r`n- 优化金额与索引建模" $card $white $muted
  Add-Card $slide 702 108 222 258 "计划 4" "补全测试与展示质量`r`n- 登录/创建/购买路径测试`r`n- 合约测试`r`n- 打磨页面展示与汇报材料" $card $white $muted
  Add-Footer $slide "下一阶段：从可用走向稳定" 12 $muted

  $slide = $presentation.Slides.Add(13, 12)
  Set-SlideBackground $slide 9 14 28
  Add-TextBox $slide 36 36 430 34 "12. 中期阶段总结" 26 $white $true | Out-Null
  Add-Card $slide 36 98 280 174 "完成度" "核心业务闭环完成度约 70%`r`n已完成系统总体架构设计与主要模块开发。" $card $white $muted
  Add-Card $slide 340 98 280 174 "已跑通能力" "钱包登录`r`nIPFS 存储`r`nNFT 创建`r`n链上铸造`r`n市场展示`r`n链上购买`r`n订单同步`r`n个人中心" $card $white $muted
  Add-Card $slide 644 98 280 174 "当前定位" "项目已经不是概念 Demo，而是具备真实业务路径的 NFT 市场系统原型。" $card $white $muted
  Add-Card $slide 36 300 888 134 "总结陈述" "截至中期，我已经完成了 NFT 数字藏品市场系统从用户登录到 NFT 交易的基本闭环。接下来会继续围绕工程稳定性、链上链下一致性、测试完备度与展示质量做深入优化。" $card2 $white $muted
  Add-Footer $slide "中期总结" 13 $muted

  $slide = $presentation.Slides.Add(14, 12)
  Set-SlideBackground $slide 9 14 28
  Add-TextBox $slide 36 98 888 56 "谢谢各位老师" 34 $white $true "Microsoft YaHei" 2 | Out-Null
  Add-TextBox $slide 36 170 888 34 "恳请批评指正" 22 $accent $true "Microsoft YaHei" 2 | Out-Null
  Add-Card $slide 232 258 496 118 "Q & A" "可重点准备的追问方向：`r`n1. 为什么采用链上 + 链下架构`r`n2. 为什么支持多媒体 NFT`r`n3. 下一阶段如何提高一致性与稳定性" $card $white $muted
  Add-TextBox $slide 36 494 888 18 "附：本 PPT 根据 MIDTERM_DEFENSE_SCRIPT.md 并结合当前代码状态整理，认证方式已更新为钱包签名登录。" 9 $muted $false "Microsoft YaHei" 2 | Out-Null

  if (Test-Path $outputPath) {
    Remove-Item $outputPath -Force
  }
  $presentation.SaveAs($outputPath, 24)
  $presentation.Close()
  $ppt.Quit()
}
finally {
  if ($presentation -ne $null) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation)
  }
  if ($ppt -ne $null) {
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($ppt)
  }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}

