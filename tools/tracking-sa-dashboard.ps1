param(
    [string]$RepositoryPath = (Split-Path -Parent $PSScriptRoot),
    [switch]$ValidateOnly
)

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$RepositoryPath = [System.IO.Path]::GetFullPath($RepositoryPath)
if (-not (Test-Path -LiteralPath (Join-Path $RepositoryPath "package.json"))) {
    [System.Windows.MessageBox]::Show(
        "Tracking SA 저장소를 찾을 수 없습니다.`n$RepositoryPath",
        "Tracking SA Dashboard",
        "OK",
        "Error"
    ) | Out-Null
    exit 1
}

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Tracking SA 관리 대시보드"
        Width="1180" Height="780" MinWidth="980" MinHeight="680"
        WindowStartupLocation="CenterScreen"
        Background="#0B1120" Foreground="#E5E7EB"
        FontFamily="Malgun Gothic">
    <Window.Resources>
        <Style TargetType="Button">
            <Setter Property="Foreground" Value="#F8FAFC"/>
            <Setter Property="Background" Value="#1E293B"/>
            <Setter Property="BorderBrush" Value="#334155"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="Padding" Value="16,10"/>
            <Setter Property="Margin" Value="0,0,10,10"/>
            <Setter Property="Cursor" Value="Hand"/>
            <Setter Property="FontWeight" Value="SemiBold"/>
        </Style>
        <Style x:Key="PrimaryButton" TargetType="Button" BasedOn="{StaticResource {x:Type Button}}">
            <Setter Property="Background" Value="#166534"/>
            <Setter Property="BorderBrush" Value="#22C55E"/>
        </Style>
        <Style x:Key="Card" TargetType="Border">
            <Setter Property="Background" Value="#111827"/>
            <Setter Property="BorderBrush" Value="#243047"/>
            <Setter Property="BorderThickness" Value="1"/>
            <Setter Property="CornerRadius" Value="14"/>
            <Setter Property="Padding" Value="18"/>
            <Setter Property="Margin" Value="0,0,12,12"/>
        </Style>
    </Window.Resources>

    <Grid Margin="22">
        <Grid.RowDefinitions>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="Auto"/>
            <RowDefinition Height="*"/>
            <RowDefinition Height="Auto"/>
        </Grid.RowDefinitions>

        <Grid Grid.Row="0" Margin="0,0,0,18">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="Auto"/>
            </Grid.ColumnDefinitions>
            <StackPanel>
                <TextBlock Text="Tracking SA" FontSize="30" FontWeight="Bold" Foreground="#F8FAFC"/>
                <TextBlock Text="로컬 사이트 관리 대시보드 · 서버 없이 이 PC에서만 실행"
                           Foreground="#94A3B8" Margin="0,5,0,0"/>
            </StackPanel>
            <Button x:Name="RefreshButton" Grid.Column="1" Content="상태 새로고침"/>
        </Grid>

        <Grid Grid.Row="1">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="*"/>
                <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>
            <Border Grid.Column="0" Style="{StaticResource Card}">
                <StackPanel>
                    <TextBlock Text="Git 상태" Foreground="#94A3B8" FontWeight="SemiBold"/>
                    <TextBlock x:Name="BranchText" Text="확인 중..." FontSize="19" FontWeight="Bold" Margin="0,8,0,3"/>
                    <TextBlock x:Name="ChangesText" Text="" Foreground="#CBD5E1"/>
                </StackPanel>
            </Border>
            <Border Grid.Column="1" Style="{StaticResource Card}">
                <StackPanel>
                    <TextBlock Text="환경 설정" Foreground="#94A3B8" FontWeight="SemiBold"/>
                    <TextBlock x:Name="EnvText" Text="확인 중..." FontSize="19" FontWeight="Bold" Margin="0,8,0,3"/>
                    <TextBlock Text="값은 표시하지 않습니다" Foreground="#CBD5E1"/>
                </StackPanel>
            </Border>
            <Border Grid.Column="2" Style="{StaticResource Card}" Margin="0,0,0,12">
                <StackPanel>
                    <TextBlock Text="최근 커밋" Foreground="#94A3B8" FontWeight="SemiBold"/>
                    <TextBlock x:Name="CommitText" Text="확인 중..." FontSize="15" FontWeight="Bold"
                               TextWrapping="Wrap" Margin="0,8,0,3"/>
                    <TextBlock x:Name="SyncText" Text="" Foreground="#CBD5E1"/>
                </StackPanel>
            </Border>
        </Grid>

        <Grid Grid.Row="2">
            <Grid.ColumnDefinitions>
                <ColumnDefinition Width="390"/>
                <ColumnDefinition Width="*"/>
            </Grid.ColumnDefinitions>

            <ScrollViewer Grid.Column="0" VerticalScrollBarVisibility="Auto" Margin="0,0,12,0">
                <StackPanel>
                    <Border Style="{StaticResource Card}" Margin="0,0,0,12">
                        <StackPanel>
                            <TextBlock Text="품질 검사" FontSize="18" FontWeight="Bold" Margin="0,0,0,14"/>
                            <WrapPanel>
                                <Button x:Name="BuildButton" Content="사이트 빌드" Style="{StaticResource PrimaryButton}"/>
                                <Button x:Name="UnitButton" Content="단위 테스트"/>
                                <Button x:Name="TruthButton" Content="Source of Truth"/>
                                <Button x:Name="PolicyButton" Content="Public 정책"/>
                                <Button x:Name="AllChecksButton" Content="전체 검사 실행" Style="{StaticResource PrimaryButton}"/>
                            </WrapPanel>
                            <TextBlock Text="삭제·커밋·푸시·배포 명령은 포함하지 않습니다."
                                       Foreground="#94A3B8" TextWrapping="Wrap" Margin="0,4,0,0"/>
                        </StackPanel>
                    </Border>

                    <Border Style="{StaticResource Card}" Margin="0,0,0,12">
                        <StackPanel>
                            <TextBlock Text="바로가기" FontSize="18" FontWeight="Bold" Margin="0,0,0,14"/>
                            <WrapPanel>
                                <Button x:Name="SiteButton" Content="운영 사이트"/>
                                <Button x:Name="ActionsButton" Content="GitHub Actions"/>
                                <Button x:Name="RepoButton" Content="GitHub 저장소"/>
                                <Button x:Name="CodeButton" Content="VS Code"/>
                                <Button x:Name="FolderButton" Content="폴더 열기"/>
                            </WrapPanel>
                        </StackPanel>
                    </Border>

                    <Border Style="{StaticResource Card}" Margin="0,0,0,12">
                        <StackPanel>
                            <TextBlock Text="환경변수 상태" FontSize="18" FontWeight="Bold" Margin="0,0,0,12"/>
                            <TextBlock x:Name="EnvDetailsText" Text="확인 중..." TextWrapping="Wrap"
                                       FontFamily="Consolas" Foreground="#CBD5E1"/>
                        </StackPanel>
                    </Border>
                </StackPanel>
            </ScrollViewer>

            <Border Grid.Column="1" Style="{StaticResource Card}" Margin="0,0,0,12">
                <Grid>
                    <Grid.RowDefinitions>
                        <RowDefinition Height="Auto"/>
                        <RowDefinition Height="*"/>
                    </Grid.RowDefinitions>
                    <Grid Grid.Row="0" Margin="0,0,0,12">
                        <Grid.ColumnDefinitions>
                            <ColumnDefinition Width="*"/>
                            <ColumnDefinition Width="Auto"/>
                        </Grid.ColumnDefinitions>
                        <TextBlock Text="실행 로그" FontSize="18" FontWeight="Bold"/>
                        <Button x:Name="ClearLogButton" Grid.Column="1" Content="로그 지우기"
                                Padding="10,5" Margin="0"/>
                    </Grid>
                    <TextBox x:Name="LogBox" Grid.Row="1"
                             Background="#070B14" Foreground="#D1FAE5"
                             BorderBrush="#243047" BorderThickness="1"
                             FontFamily="Consolas" FontSize="13"
                             Padding="12" TextWrapping="NoWrap"
                             AcceptsReturn="True" IsReadOnly="True"
                             VerticalScrollBarVisibility="Auto"
                             HorizontalScrollBarVisibility="Auto"/>
                </Grid>
            </Border>
        </Grid>

        <Border Grid.Row="3" Background="#111827" BorderBrush="#243047" BorderThickness="1"
                CornerRadius="10" Padding="12,9">
            <TextBlock x:Name="StatusText" Text="준비됨" Foreground="#86EFAC"/>
        </Border>
    </Grid>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

$controlNames = @(
    "RefreshButton", "BranchText", "ChangesText", "EnvText", "CommitText", "SyncText",
    "BuildButton", "UnitButton", "TruthButton", "PolicyButton", "AllChecksButton",
    "SiteButton", "ActionsButton", "RepoButton", "CodeButton", "FolderButton",
    "EnvDetailsText", "LogBox", "ClearLogButton", "StatusText"
)
$controls = @{}
foreach ($name in $controlNames) {
    $controls[$name] = $window.FindName($name)
}

$script:CommandButtons = @(
    $controls.BuildButton, $controls.UnitButton, $controls.TruthButton,
    $controls.PolicyButton, $controls.AllChecksButton
)

function Append-Log {
    param([string]$Text)
    $timestamp = Get-Date -Format "HH:mm:ss"
    $controls.LogBox.AppendText("[$timestamp] $Text`r`n")
    $controls.LogBox.ScrollToEnd()
}

function Invoke-CapturedCommand {
    param(
        [string]$Label,
        [string]$Command
    )

    foreach ($button in $script:CommandButtons) { $button.IsEnabled = $false }
    $controls.StatusText.Text = "$Label 실행 중..."
    $controls.StatusText.Foreground = "#FDE68A"
    Append-Log ""
    Append-Log "▶ $Label"
    Append-Log "  $Command"
    $window.Dispatcher.Invoke([action]{}, "Background")

    try {
        $startInfo = New-Object System.Diagnostics.ProcessStartInfo
        $startInfo.FileName = "cmd.exe"
        $startInfo.Arguments = "/d /c `"$Command`""
        $startInfo.WorkingDirectory = $RepositoryPath
        $startInfo.UseShellExecute = $false
        $startInfo.RedirectStandardOutput = $true
        $startInfo.RedirectStandardError = $true
        $startInfo.CreateNoWindow = $true

        $process = New-Object System.Diagnostics.Process
        $process.StartInfo = $startInfo
        [void]$process.Start()
        $stdout = $process.StandardOutput.ReadToEnd()
        $stderr = $process.StandardError.ReadToEnd()
        $process.WaitForExit()

        if ($stdout) { Append-Log $stdout.TrimEnd() }
        if ($stderr) { Append-Log $stderr.TrimEnd() }

        if ($process.ExitCode -eq 0) {
            Append-Log "✓ $Label 성공"
            $controls.StatusText.Text = "$Label 성공"
            $controls.StatusText.Foreground = "#86EFAC"
            return $true
        }

        Append-Log "✗ $Label 실패 (exit $($process.ExitCode))"
        $controls.StatusText.Text = "$Label 실패"
        $controls.StatusText.Foreground = "#FCA5A5"
        return $false
    }
    catch {
        Append-Log "✗ 실행 오류: $($_.Exception.Message)"
        $controls.StatusText.Text = "$Label 실행 오류"
        $controls.StatusText.Foreground = "#FCA5A5"
        return $false
    }
    finally {
        foreach ($button in $script:CommandButtons) { $button.IsEnabled = $true }
    }
}

function Get-EnvState {
    $knownNames = @(
        "VITE_FIREBASE_API_KEY",
        "VITE_FIREBASE_MESSAGING_SENDER_ID",
        "VITE_FIREBASE_APP_CHECK_SITE_KEY",
        "NEXON_API_KEY",
        "DISCORD_TOKEN",
        "DISCORD_PUBLIC_KEY",
        "SA_DISCORD_WEBHOOK",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SOOP_CLIENT_ID",
        "SOOP_CATEGORY_ID"
    )
    $configured = @{}
    $envPath = Join-Path $RepositoryPath ".env"
    if (Test-Path -LiteralPath $envPath) {
        foreach ($line in [System.IO.File]::ReadAllLines($envPath)) {
            if ($line -match '^\s*([A-Z][A-Z0-9_]*)=(.*)$') {
                $configured[$matches[1]] = -not [string]::IsNullOrWhiteSpace($matches[2])
            }
        }
    }

    $details = foreach ($name in $knownNames) {
        $isSet = $configured.ContainsKey($name) -and $configured[$name]
        "{0} {1}" -f $(if ($isSet) { "[OK]" } else { "[--]" }), $name
    }

    return @{
        Exists = Test-Path -LiteralPath $envPath
        SetCount = @($knownNames | Where-Object {
            $configured.ContainsKey($_) -and $configured[$_]
        }).Count
        TotalCount = $knownNames.Count
        Details = $details -join "`r`n"
    }
}

function Invoke-GitText {
    param([string]$Arguments)
    $result = & git -C $RepositoryPath $Arguments.Split(" ") 2>$null
    return ($result -join " ").Trim()
}

function Refresh-Dashboard {
    try {
        $branch = Invoke-GitText "branch --show-current"
        $changes = @(& git -C $RepositoryPath status --porcelain 2>$null)
        $commit = Invoke-GitText "log -1 --pretty=format:%h|%s"
        $aheadBehind = Invoke-GitText "rev-list --left-right --count origin/main...HEAD"
        $envState = Get-EnvState

        $controls.BranchText.Text = if ($branch) { $branch } else { "Git 정보 없음" }
        $controls.ChangesText.Text = if ($changes.Count -eq 0) {
            "변경 파일 없음"
        } else {
            "변경 파일 $($changes.Count)개"
        }
        $controls.ChangesText.Foreground = if ($changes.Count -eq 0) { "#86EFAC" } else { "#FDE68A" }

        if ($commit -match '^([^|]+)\|(.*)$') {
            $controls.CommitText.Text = "$($matches[1])  $($matches[2])"
        } else {
            $controls.CommitText.Text = $commit
        }

        if ($aheadBehind -match '(\d+)\s+(\d+)') {
            $controls.SyncText.Text = "origin/main 기준 behind $($matches[1]) · ahead $($matches[2])"
        } else {
            $controls.SyncText.Text = "원격 동기화 상태 확인 불가"
        }

        $controls.EnvText.Text = if ($envState.Exists) {
            "$($envState.SetCount) / $($envState.TotalCount) 설정됨"
        } else {
            ".env 없음"
        }
        $controls.EnvText.Foreground = if ($envState.Exists) { "#86EFAC" } else { "#FCA5A5" }
        $controls.EnvDetailsText.Text = $envState.Details
        $controls.StatusText.Text = "상태 새로고침 완료"
        $controls.StatusText.Foreground = "#86EFAC"
    }
    catch {
        Append-Log "상태 확인 실패: $($_.Exception.Message)"
        $controls.StatusText.Text = "상태 확인 실패"
        $controls.StatusText.Foreground = "#FCA5A5"
    }
}

function Open-Target {
    param([string]$Target)
    try {
        Start-Process $Target
    }
    catch {
        Append-Log "열기 실패: $Target - $($_.Exception.Message)"
    }
}

$controls.RefreshButton.Add_Click({ Refresh-Dashboard })
$controls.BuildButton.Add_Click({
    [void](Invoke-CapturedCommand "사이트 빌드" "npm.cmd run build")
    Refresh-Dashboard
})
$controls.UnitButton.Add_Click({
    [void](Invoke-CapturedCommand "단위 테스트" "npm.cmd run test:unit")
})
$controls.TruthButton.Add_Click({
    [void](Invoke-CapturedCommand "Source of Truth 검사" "npm.cmd run check:source-of-truth")
})
$controls.PolicyButton.Add_Click({
    [void](Invoke-CapturedCommand "Public 편집 정책 검사" "npm.cmd run check:public-edit-policy")
})
$controls.AllChecksButton.Add_Click({
    $checks = @(
        @("사이트 빌드", "npm.cmd run build"),
        @("단위 테스트", "npm.cmd run test:unit"),
        @("Source of Truth 검사", "npm.cmd run check:source-of-truth"),
        @("Public 편집 정책 검사", "npm.cmd run check:public-edit-policy")
    )
    foreach ($check in $checks) {
        if (-not (Invoke-CapturedCommand $check[0] $check[1])) { break }
    }
    Refresh-Dashboard
})
$controls.SiteButton.Add_Click({ Open-Target "https://trackingsa.com/" })
$controls.ActionsButton.Add_Click({ Open-Target "https://github.com/HanBeom98/tracking-sa/actions" })
$controls.RepoButton.Add_Click({ Open-Target "https://github.com/HanBeom98/tracking-sa" })
$controls.CodeButton.Add_Click({
    try {
        Start-Process "code" -ArgumentList "`"$RepositoryPath`""
    }
    catch {
        Open-Target $RepositoryPath
    }
})
$controls.FolderButton.Add_Click({ Open-Target $RepositoryPath })
$controls.ClearLogButton.Add_Click({ $controls.LogBox.Clear() })

Append-Log "대시보드 시작: $RepositoryPath"
Refresh-Dashboard
if ($ValidateOnly) {
    Write-Output "DASHBOARD_VALID=True"
    Write-Output "REPOSITORY=$RepositoryPath"
    Write-Output "BRANCH=$($controls.BranchText.Text)"
    Write-Output "CHANGES=$($controls.ChangesText.Text)"
    Write-Output "ENV=$($controls.EnvText.Text)"
    exit 0
}
[void]$window.ShowDialog()
