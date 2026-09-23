param([string]$OutDir = (Join-Path $PSScriptRoot '..\docs'))
# Builds the Cherry Wilkes Word files: teacher guide, observer quiz (one question per checklist point) and student hints.
# Needs Microsoft Word on this computer. Run it directly:  & .\cherry-docs.ps1
# The checklist comes from the "cherry-wilkes" scenario in scenarios.js, and the quiz questions and hints from
# cherry-quiz-hints.json (keyed by checklist point id), so the documents stay in step with the page.

$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding($false)
$OutDir = [IO.Path]::GetFullPath($OutDir)
$js = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'scenarios.js'), $enc)
$json = $js.Substring($js.IndexOf('['), $js.LastIndexOf(']') - $js.IndexOf('[') + 1)
$sc = ($json | ConvertFrom-Json) | Where-Object { $_.id -eq 'cherry-wilkes' }
if (-not $sc) { throw 'Scenario cherry-wilkes not found in scenarios.js' }
$extra = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'cherry-quiz-hints.json'), $enc) | ConvertFrom-Json
function HtmlText([string]$s) { return [Net.WebUtility]::HtmlEncode($s) }
function HowText([string]$how) { if ($how -eq 'do') { 'Do' } elseif ($how -eq 'both') { 'Say + Do' } else { 'Say' } }

$style = @'
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.3}
h1{font-size:20pt;color:#1b7f79;margin-bottom:4pt}
h2{font-size:14pt;color:#1b7f79;margin-top:14pt}
h3{font-size:12pt;margin-top:10pt}
p{margin:4pt 0}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #8a8a8a;padding:4pt 6pt;vertical-align:top;text-align:left;font-size:10.5pt}
th{background:#dff0ee}
.sub{color:#555}
.box{border:1px solid #b3541e;background:#fbe9dd;padding:6pt}
.q{margin-top:8pt;font-weight:bold}
.pt{color:#6b6b6b;font-size:9.5pt;font-weight:normal}
.opt{margin:1pt 0 0 20pt}
.do{background:#e9dcc0;color:#6b5423;font-weight:bold;padding:0 4pt}
</style>
'@

# ---------- Numbered checklist points (same order as the page) ----------
$stageName = @{ 'cherry' = 'Visit with Cherry'; 'lance' = 'Report to Lance'; 'after' = 'After the session' }
$points = New-Object System.Collections.ArrayList
foreach ($g in $sc.checklist) { foreach ($it in $g.items) { [void]$points.Add([pscustomobject]@{ n = $points.Count + 1; group = $g; item = $it }) } }
foreach ($p in $points) {
  if (-not $extra.quiz.($p.item.id)) { throw ('No quiz question for checklist point ' + $p.item.id) }
  if (-not $extra.hints.($p.item.id)) { throw ('No hints for checklist point ' + $p.item.id) }
}
function ItemHow($it) {
  if ($it.parts) { $hs = @($it.parts | ForEach-Object { HowText $_.how } | Select-Object -Unique); if ($hs.Count -eq 1) { return $hs[0] } else { return 'Say + Do' } }
  return HowText $it.how
}

# Checklist table for the guide
$rows = New-Object System.Text.StringBuilder
foreach ($g in $sc.checklist) {
  [void]$rows.Append('<tr><td colspan="4" style="background:#f3efe6"><b>' + (HtmlText $g.official) + '</b> <span class="sub">(' + $stageName[$g.stage] + ')</span></td></tr>')
  foreach ($p in ($points | Where-Object { $_.group -eq $g })) {
    $it = $p.item
    $what = if ($it.parts) { ($it.parts | ForEach-Object { '<b>' + (HtmlText $_.label) + ':</b> ' + (HtmlText $_.hint) }) -join '<br>' } else { HtmlText $it.hint }
    [void]$rows.Append('<tr><td>' + $p.n + '. ' + (HtmlText $it.official) + '</td><td>' + (HtmlText $it.label) + '</td><td>' + (ItemHow $it) + '</td><td>' + $what + '</td></tr>')
  }
}
# Points that need the Do button
$doList = ($points | Where-Object { (ItemHow $_.item) -ne 'Say' -and $_.group.stage -ne 'after' } | ForEach-Object {
  $it = $_.item
  if ($it.parts) { ($it.parts | Where-Object { $_.how } | ForEach-Object { '<li>' + (HtmlText ($it.label + ': ' + $_.label)) + ' (' + (HowText $_.how) + ')</li>' }) -join '' }
  else { '<li>' + (HtmlText $it.label) + ' (' + (HowText $it.how) + ')</li>' }
}) -join ''

# Quiz answer key
$keyRows = ($points | ForEach-Object {
  $q = $extra.quiz.($_.item.id)
  $ans = if ($q.parts) { ($q.parts | ForEach-Object { HtmlText $_.key }) -join '<br>' } else { HtmlText $q.key }
  '<tr><td style="width:6%">' + $_.n + '</td><td style="width:40%">' + (HtmlText $_.item.label) + '</td><td>' + $ans + '</td></tr>'
}) -join ''

$cherry = $sc.characters | Where-Object { $_.id -eq 'cherry' }
$lance = $sc.characters | Where-Object { $_.id -eq 'lance' }
$cues = ($sc.teacher.cues | ForEach-Object { '<li>' + (HtmlText $_) + '</li>' }) -join ''
$debrief = ($sc.teacher.debrief | ForEach-Object { '<li>' + (HtmlText $_) + '</li>' }) -join ''
$cherryFacts = ($cherry.facts | ForEach-Object { '<li>' + (HtmlText $_) + '</li>' }) -join ''
$total = $points.Count

# ---------- Teacher guide ----------
$guide = @"
<html><head><meta charset="utf-8"><title>Cherry Wilkes Teacher Guide</title>$style</head><body>
<h1>Cherry Wilkes: Support Visit. Teacher Guide</h1>
<p class="sub">An AI plays Cherry, then her supervisor Lance. The whole class takes turns as one support worker. The checklist fills in on the screen.</p>
<p>$(HtmlText $sc.unit). Assessment Task 2, Part 2 Role Play 3 (Cherry) preparation.</p>

<h2>1. What you received</h2>
<table><tr><th style="width:32%">File</th><th>What it is</th></tr>
<tr><td>The Family Meeting page</td><td>The same page and address as before: https://adriehoman.github.io/family-meeting/ (PIN 2468). Wilson and Val are unchanged. Cherry is a new scenario: open Settings and choose <b>Cherry Wilkes - Support visit</b>.</td></tr>
<tr><td>This guide</td><td>Run sheet, how the page works for Cherry, Cherry and Lance, the checklist, risk and protective factors, OPAN, debrief and the quiz answers.</td></tr>
<tr><td>Cherry_Wilkes_Observer_Quiz.docx</td><td>One per student, printed before class. One question for each of the $total checklist points: circle an answer, true or false, or write a word. Students fill it in as the visit goes, so they keep listening. You mark it afterwards (answers in section 10).</td></tr>
<tr><td>Cherry_Wilkes_Student_Hints.docx</td><td>One per student or per pair. Ideas for what to say or do for each checklist point, to use when it is their turn. It shows which points need the Do button.</td></tr>
</table>

<h2>2. Before class (10 minutes)</h2>
<ol>
<li>Open the page in Microsoft Edge. Press Ctrl+F5 so you get the newest version.</li>
<li>Settings: your API key and a Sonnet model are already saved on your laptop. Under Scenario choose <b>Cherry Wilkes - Support visit</b>.</li>
<li>Voices: Cherry = Natasha, Lance = William. The narrator gets a different voice automatically (for example Ryan). Press Test for each. Press Save and close.</li>
<li>Test the microphone once: click Speak, say "Hello Cherry", click again, check the words.</li>
<li>Print the Observer Quiz and the Student Hints, one per student.</li>
<li>If you tested the page, press <b>Reset</b> twice so the class starts with an empty checklist.</li>
</ol>

<h2>3. Class run sheet (60 to 75 minutes)</h2>
<table><tr><th style="width:14%">Time</th><th>What happens</th><th style="width:34%">You</th></tr>
<tr><td>5 min</td><td>Set the scene: "You are Cherry's support worker. You visit her three mornings a week. Today at 11am you find her crying in her bedroom. Together, the whole class is one support worker." Hand out the quiz and the hints.</td><td>Explain <b>Say</b> (something you say) and <b>Do</b> (something you do, for example "I sit down next to her"). Show the Do tags on the checklist. Typing is always fine.</td></tr>
<tr><td>35 to 45 min</td><td>Press <b>Start visit</b>. Each student has 5 turns, then presses <b>Next student</b>. The checklist on the right turns green. "Still to show" and the hints sheet help the next student choose what to do. Everyone fills in the quiz as they listen.</td><td>Watch the key moments in section 5. Use Teacher notes (press T) to whisper to Cherry if the class is stuck.</td></tr>
<tr><td>10 to 15 min</td><td>When every visit point is green, press <b>Go to Lance</b>. Students keep taking turns and report to Lance.</td><td>Listen for the risk and protective factors (section 7).</td></tr>
<tr><td>5 min</td><td>Press <b>Finish session</b>, then <b>Download session (Word)</b>.</td><td>In Teacher notes press <b>Download checklist with evidence (Word)</b> for your own records.</td></tr>
<tr><td>10 min</td><td>Debrief (section 9). Collect the quizzes.</td><td>Mark the quizzes later with section 10.</td></tr>
<tr><td>Later</td><td>Each student writes the progress note for Cherry from the session document. It has everything that was said and done, and an empty progress note table.</td><td></td></tr>
</table>
<p>18 students with 5 turns each is 90 turns. A class usually needs fewer than that to show every point. With a small group, go around again.</p>

<h2>4. How the page works for Cherry</h2>
<table><tr><th style="width:30%">On the screen</th><th>What it does</th></tr>
<tr><td>What you can see</td><td>The box under Cherry's picture. It shows the room and Cherry's body language after each answer, for example "Cherry wipes her eyes and looks at the shelf." Students should notice and respond to it.</td></tr>
<tr><td>Narrator</td><td>A different voice (for example Ryan) reads out what the back of the room cannot see: the scene at the start and in Lance's office, "What you can see" before Cherry answers, and anything typed instead of spoken. A typed Do action is read in the third person, for example "The support worker passes Cherry a tissue." Choose the voice or turn the narrator off in Settings under Spoken voices.</td></tr>
<tr><td>Speak button</td><td>Grey with "Please wait..." while the narrator, Cherry or Lance is speaking, and while the AI is thinking. When it turns back to Speak, the next student can talk.</td></tr>
<tr><td>Calm meter</td><td>Five dots next to "What you can see". Cherry starts very upset. Kind, patient words and actions calm her. Rushing, judging, or touching without asking upsets her again. She stays unsettled until she has said the Minister line, then calms slowly. That is part of the case, not a student mistake.</td></tr>
<tr><td>Say and Do</td><td>Say sends words. Do sends an action: the student says or types what they do, starting with "I", for example "I pass her a tissue", then presses <b>Do</b>. Cherry reacts to both. On the checklist a small <span class="do">Do</span> or <span class="do">Say + Do</span> tag marks the points that need an action. A line above the checklist explains this to the students.</td></tr>
<tr><td>Dots and turn summary</td><td>One dot per turn. Green means that turn showed a new checklist point. After 5 turns a green summary shows what the student showed.</td></tr>
<tr><td>Checklist</td><td>All $total points of the observation checklist in plain words, in the same groups as the form. Points turn green with a tick. Hover over a green point to see the student turn and words. Points with parts (for example social, cultural, spiritual) show each part.</td></tr>
<tr><td>Go to Lance</td><td>Works only when all 26 visit points are green. If some are missing, the page checks the whole conversation once more, then lists what is still needed. The same happens for <b>Finish session</b> with Lance's 4 points.</td></tr>
<tr><td>Coach and lifeline</td><td>The coach line names a skill or a missing area, never the words to say. Each student can use the lifeline once to see one idea.</td></tr>
<tr><td>Teacher notes (T)</td><td>Cue lines, the story facts still hidden, debrief questions, whisper, and the checklist tools: <b>Check the whole conversation again</b>, <b>Move on now (skip the checklist)</b> (press twice, for when the AI clearly missed something), and <b>Download checklist with evidence (Word)</b>.</td></tr>
<tr><td>Download session (Word)</td><td>Everything said and done with Cherry and Lance, what you could see, and an empty progress note table.</td></tr>
<tr><td>Reset</td><td>Press twice. Clears the conversation and the checklist, even while Cherry is still answering.</td></tr>
</table>
<p><b>Points that need the Do button:</b></p>
<ul>$doList</ul>
<p class="box">The checklist is a teaching tool. The AI can miss a point or tick one generously. You make every assessment decision.</p>

<h2>5. Cherry and Lance</h2>
<h3>Cherry Wilkes</h3>
<p>$(HtmlText $cherry.persona)</p>
<ul>$cherryFacts</ul>
<h3>How Cherry behaves</h3>
<ul>
<li>She starts crying and can only say a few words. She tells one thing at a time as she calms down.</li>
<li>She says she thinks Donna is selling the ornaments only if asked gently and openly. If a student accuses Donna, she defends her and gets more upset.</li>
<li>Straight after, she regrets it: "Please don't say anything. I don't want to cause trouble at home." A good answer is honest: the worker must tell the supervisor, and Cherry stays in charge of what happens. If a student promises to keep it secret, Cherry is relieved. Pick this up in the debrief (duty of care).</li>
<li>She fears full-time care if Donna gets in trouble.</li>
<li>Key line, said once: "I wanted to see the Minister tomorrow to find forgiveness, but now I just want to stay in bed. Talk to no one. Do nothing."</li>
<li>She never raises self-harm. If a student asks her about it, she says clearly: "No, love, nothing like that. I'm just so tired of it all." Praise the student for asking.</li>
<li>She wants to ring Reverend Hill herself, but her hands shake, so she needs help with the number and the buttons. If a student rings for her without asking, she is a bit put out.</li>
<li>She accepts information about any suitable service, for example OPAN, and worries it will get Donna into trouble. She relaxes when told it is free, private and her choice.</li>
<li>She does not want the police or to confront Donna today. If pushed, she goes quiet.</li>
</ul>
<h3>Lance</h3>
<p>$(HtmlText $lance.persona) Lance did not see the visit, so he only knows what the students tell him. If they leave something out, he asks an open question instead of saying it. He reassures them that he will follow up with Cherry within 24 hours, helps them find the risk and protective factors, gives short feedback on how they supported Cherry, explains the next steps from the KAMA abuse policy, asks how they are feeling, and ends with "How do you think you went?"</p>

<h2>6. The checklist on the screen</h2>
<p>The first column is the wording on the observation checklist. Then what students see on the screen, whether the point needs Say or Do, and what the AI listens for. The numbers match the quiz and the hints sheet.</p>
<table><tr><th style="width:30%">Checklist wording</th><th style="width:20%">On the screen</th><th style="width:9%">Say or Do</th><th>What counts</th></tr>
$($rows.ToString())
</table>

<h2>7. Risk and protective factors</h2>
<table><tr><th style="width:50%">Risk factors</th><th>Protective factors</th></tr>
<tr><td><ul><li>Grief after Mum's death eight months ago</li><li>Low mood, crying, wants to stay in bed and talk to no one</li><li>Not sleeping, not eating, not dressed</li><li>Pulling away from church and friends (Joan)</li><li>Guilt about being angry with Donna</li><li>Possible financial abuse by her sister</li><li>Depends on Donna for shopping, meals and transport</li><li>Fear of losing her home and going into full-time care</li><li>Physical disability: shaky hands, poor balance</li></ul></td>
<td><ul><li>Her faith, Reverend Hill and the appointment tomorrow</li><li>Church and choir friends such as Joan</li><li>Her trusting relationship with the support worker</li><li>She told someone and accepted help</li><li>Information from OPAN</li><li>Her love for Donna and her Mum's memory</li><li>Her strengths: showers, dresses, makes breakfast, knows every ornament's story</li><li>KAMA follow-up within 24 hours</li></ul></td></tr>
</table>

<h2>8. OPAN</h2>
<p>Older Persons Advocacy Network: free, independent and confidential support for older people. Phone <b>1800 700 600</b>, Monday to Friday 8am to 8pm, Saturday 10am to 4pm. Website opan.org.au. Cherry accepts any suitable service a student names.</p>

<h2>9. Cue lines and debrief</h2>
<h3>Cue lines</h3><ul>$cues</ul>
<h3>Debrief questions</h3><ul>$debrief</ul>

<h2>10. Observer Quiz answers</h2>
<p>One mark per question, $total marks. For "write" questions, accept the student's own words when the meaning is right. Some answers depend on what happened in your session (for example the service the class chose).</p>
<table><tr><th>#</th><th>Checklist point</th><th>Answer</th></tr>
$keyRows
</table>

<h2>11. Cost, privacy and problems</h2>
<ul>
<li>Cherry sends more notes to the AI than Wilson, so each turn costs a little more, roughly 3 to 4 cents with Sonnet. A full class session costs a few dollars. Keep the monthly limit in the Anthropic Console.</li>
<li>Do not say or type student names. The page calls them Student 1, Student 2 and so on.</li>
<li>If the AI misses a point the class clearly showed: Teacher notes, <b>Check the whole conversation again</b>. If it is still missing, <b>Move on now</b>.</li>
<li>If the internet or the API fails, you can play Cherry yourself from section 5 and use the printed checklist.</li>
<li>Reset (press twice) clears the session before the next class. Download the session first.</li>
</ul>
</body></html>
"@

# ---------- Observer quiz: one question per checklist point ----------
$quizBody = New-Object System.Text.StringBuilder
function StageNote($g) { if ($g.title -eq $stageName[$g.stage]) { '' } else { ' <span class="pt">(' + $stageName[$g.stage] + ')</span>' } }
foreach ($g in $sc.checklist) {
  [void]$quizBody.Append('<h2>' + (HtmlText $g.title) + (StageNote $g) + '</h2>')
  foreach ($p in ($points | Where-Object { $_.group -eq $g })) {
    $q = $extra.quiz.($p.item.id)
    $tag = switch ($q.type) { 'choice' { 'Circle a, b or c' } 'tf' { 'Circle True or False' } default { 'Write' } }
    [void]$quizBody.Append('<p class="q">' + $p.n + '. ' + (HtmlText $(if ($q.q) { $q.q } else { $p.item.label })) + '</p>')
    [void]$quizBody.Append('<p class="pt">Checklist point: ' + (HtmlText $p.item.label) + '. ' + $tag + '.</p>')
    if ($q.parts) { foreach ($part in $q.parts) { [void]$quizBody.Append('<p class="opt">' + (HtmlText $part.q) + '</p>') } }
    elseif ($q.type -eq 'choice') { $letters = 'a','b','c'; for ($i = 0; $i -lt $q.options.Count; $i++) { [void]$quizBody.Append('<p class="opt">' + $letters[$i] + ') ' + (HtmlText $q.options[$i]) + '</p>') } }
    elseif ($q.type -eq 'tf') { [void]$quizBody.Append('<p class="opt">True&nbsp;&nbsp;&nbsp;/&nbsp;&nbsp;&nbsp;False</p>') }
    elseif ($q.q -notmatch '_{4,}') { [void]$quizBody.Append('<p class="opt">______________________________________________</p>') }   # a write question with no gap gets an answer line
  }
}
$quiz = @"
<html><head><meta charset="utf-8"><title>Cherry Wilkes Observer Quiz</title>$style</head><body>
<h1>Cherry Wilkes: Observer Quiz</h1>
<p>Name: ______________________________&nbsp;&nbsp;&nbsp;&nbsp; Date: ______________</p>
<p class="box">Listen to Cherry and Lance, and watch what the support worker says and does. Answer each question when you hear or see the answer. There is one question for each point on the checklist. The numbers match the checklist on the screen and your hints sheet.</p>
$($quizBody.ToString())
<p style="margin-top:12pt"><b>Score: ______ of $total</b></p>
</body></html>
"@

# ---------- Student hints ----------
$hintRows = New-Object System.Text.StringBuilder
foreach ($g in $sc.checklist) {
  [void]$hintRows.Append('<tr><td colspan="3" style="background:#f3efe6"><b>' + (HtmlText $g.title) + '</b>' + (StageNote $g) + '</td></tr>')
  foreach ($p in ($points | Where-Object { $_.group -eq $g })) {
    $how = ItemHow $p.item
    $howCell = if ($p.group.stage -eq 'after') { 'After' } elseif ($how -eq 'Say') { 'Say' } else { '<span class="do">' + $how + '</span>' }
    $tips = ($extra.hints.($p.item.id) | ForEach-Object { '<li>' + (HtmlText $_) + '</li>' }) -join ''
    [void]$hintRows.Append('<tr><td style="width:30%">' + $p.n + '. ' + (HtmlText $p.item.label) + '</td><td style="width:10%">' + $howCell + '</td><td><ul style="margin:0;padding-left:14pt">' + $tips + '</ul></td></tr>')
  }
}
$hints = @"
<html><head><meta charset="utf-8"><title>Cherry Wilkes Student Hints</title>$style</head><body>
<h1>Cherry Wilkes: Hints for your turn</h1>
<p>Use these ideas when it is your turn. Look at the checklist on the screen first and choose a point that is not green yet. Use your own words.</p>
<p class="box"><b>Say</b> = words you say to Cherry or Lance. Speak or type, then press <b>Say</b>.<br>
<b>Do</b> = something you do with your hands or body. Say or type it starting with "I", for example "I pass her a tissue", then press <b>Do</b>.<br>
<b>Say + Do</b> = you can do both, for example ask "Would it help if I held your hand?" (Say), then "I hold her hand gently" (Do).</p>
<table><tr><th>Checklist point</th><th>Say or Do</th><th>Try this</th></tr>
$($hintRows.ToString())
</table>
</body></html>
"@

# ---------- Save as Word ----------
# The HTML is written next to the .docx: saving an HTML document into a different folder can hang Word.
# Run this script directly (& .\cherry-docs.ps1). Started as a separate "powershell -File" process, Word may not respond.
New-Item -ItemType Directory -Force $OutDir | Out-Null
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0   # no dialogs: a hidden dialog would stop the script
try {
  foreach ($d in @(@{name='Cherry_Wilkes_Teacher_Guide'; html=$guide}, @{name='Cherry_Wilkes_Observer_Quiz'; html=$quiz}, @{name='Cherry_Wilkes_Student_Hints'; html=$hints})) {
    # Paths must be plain [string]s: Word does not understand the wrapped value Join-Path returns, and waits on a hidden dialog.
    [string]$h = [IO.Path]::Combine($OutDir, $d.name + '.html')
    [IO.File]::WriteAllText($h, $d.html, (New-Object System.Text.UTF8Encoding($true)))   # with BOM, so Word does not ask about the encoding
    $doc = $word.Documents.Open($h, $false, $true, $false)
    # Do not touch PageSetup or page counts here: both ask the printer driver and can hang Word.
    [string]$out = [IO.Path]::Combine($OutDir, $d.name + '.docx')
    $doc.SaveAs2($out, 16)
    'saved ' + $out
    $doc.Close($false)
    Remove-Item $h
  }
} finally { $word.Quit() }
