# Deanchor Installer for Windows PowerShell
# Installs Deanchor workflows and skills to Antigravity directories.

$ErrorActionPreference = "Stop"

Write-Host "[Deanchor] Starting Deanchor Installation..." -ForegroundColor Cyan

# Source directory for workflows and skills
$srcDirWorkflows = Join-Path $PSScriptRoot "workflows\antigravity"
$srcDirSkills = Join-Path $PSScriptRoot "skills\deanchor"

if (-not (Test-Path $srcDirWorkflows)) {
    Write-Error "Source directory not found: $srcDirWorkflows"
}
if (-not (Test-Path $srcDirSkills)) {
    Write-Error "Source directory not found: $srcDirSkills"
}

# Locate AntigravityProfiles folder
$userProfile = [System.Environment]::GetFolderPath("UserProfile")
$profilesBase = Join-Path $userProfile "AntigravityProfiles"

if (-not (Test-Path $profilesBase)) {
    Write-Host "[Warning] AntigravityProfiles directory not found at $profilesBase." -ForegroundColor Yellow
    $profilesBase = Join-Path $userProfile "AntigravityProfiles"
}

# Find all profile folders
$profileTargets = @()
if (Test-Path $profilesBase) {
    $subfolders = Get-ChildItem -Path $profilesBase -Directory
    foreach ($folder in $subfolders) {
        $gwPath = Join-Path $folder.FullName ".gemini\antigravity\global_workflows"
        $skillsPath = Join-Path $folder.FullName ".gemini\antigravity\skills"
        if (Test-Path $gwPath) {
            $profileTargets += @{
                Name = $folder.Name
                WorkflowsPath = $gwPath
                SkillsPath = $skillsPath
            }
        }
    }
}

if ($profileTargets.Count -eq 0) {
    # Try direct check on personal2
    $fallbackGw = Join-Path $profilesBase "personal2\.gemini\antigravity\global_workflows"
    $fallbackSkills = Join-Path $profilesBase "personal2\.gemini\antigravity\skills"
    if (Test-Path $fallbackGw) {
        $profileTargets += @{
            Name = "personal2"
            WorkflowsPath = $fallbackGw
            SkillsPath = $fallbackSkills
        }
    } else {
        Write-Host "[Error] Could not find any Antigravity profile global_workflows directory." -ForegroundColor Red
        Write-Host "Please make sure you have run Antigravity at least once." -ForegroundColor Red
        Exit 1
    }
}

# Copy workflow files
$workflowFiles = Get-ChildItem -Path $srcDirWorkflows -Filter "deanchor*.md"
if ($workflowFiles.Count -eq 0) {
    Write-Error "No deanchor files found in workflows source directory."
}

foreach ($target in $profileTargets) {
    # Workflows Installation
    Write-Host "Installing workflows to profile: $($target['Name']) ($($target['WorkflowsPath']))..." -ForegroundColor Green
    foreach ($file in $workflowFiles) {
        $destPath = Join-Path $target['WorkflowsPath'] $file.Name
        Copy-Item -Path $file.FullName -Destination $destPath -Force
        Write-Host "  + Installed workflow: $($file.Name)" -ForegroundColor Gray
    }

    # Skills Installation
    $destSkillsDir = Join-Path $target['SkillsPath'] "deanchor"
    Write-Host "Installing skills to profile: $($target['Name']) ($destSkillsDir)..." -ForegroundColor Green
    if (-not (Test-Path $destSkillsDir)) {
        New-Item -ItemType Directory -Path $destSkillsDir -Force | Out-Null
    }
    Copy-Item -Path (Join-Path $srcDirSkills "*") -Destination $destSkillsDir -Force -Recurse
    Write-Host "  + Installed skill: deanchor" -ForegroundColor Gray
}

Write-Host "Deanchor installation complete! Break the anchors!" -ForegroundColor Green
