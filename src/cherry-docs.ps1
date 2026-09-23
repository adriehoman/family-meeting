param([string]$OutDir = (Join-Path $PSScriptRoot '..\docs'))
# Builds the Cherry Wilkes teacher guide and observer quiz as Word files.
# Needs Microsoft Word on this computer. Run:  powershell -ExecutionPolicy Bypass -File cherry-docs.ps1
# The checklist table comes from the "cherry-wilkes" scenario in scenarios.js, so it stays in step with the page.

$ErrorActionPreference = 'Stop'
$enc = New-Object System.Text.UTF8Encoding($false)
$OutDir = [IO.Path]::GetFullPath($OutDir)
$js = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'scenarios.js'), $enc)
$json = $js.Substring($js.IndexOf('['), $js.LastIndexOf(']') - $js.IndexOf('[') + 1)
$sc = ($json | ConvertFrom-Json) | Where-Object { $_.id -eq 'cherry-wilkes' }
if (-not $sc) { throw 'Scenario cherry-wilkes not found in scenarios.js' }
function HtmlText([string]$s) { return [Net.WebUtility]::HtmlEncode($s) }

$style = @'
<style>
body{font-family:Calibri,Arial,sans-serif;font-size:11pt;line-height:1.3}
h1{font-size:20pt;color:#1b7f79;margin-bottom:4pt}
h2{font-size:14pt;color:#1b7f79;margin-top:16pt}
h3{font-size:12pt;margin-top:10pt}
p{margin:4pt 0}
table{border-collapse:collapse;width:100%;margin:6pt 0}
td,th{border:1px solid #8a8a8a;padding:4pt 6pt;vertical-align:top;text-align:left;font-size:10.5pt}
th{background:#dff0ee}
.sub{color:#555}
.box{border:1px solid #b3541e;background:#fbe9dd;padding:6pt}
.q{margin-top:9pt;font-weight:bold}
.opt{margin:1pt 0 0 18pt}
</style>
'@

# ---------- Checklist table rows (from the scenario) ----------
$stageName = @{ 'cherry' = 'Visit with Cherry'; 'lance' = 'Report to Lance'; 'after' = 'After the session' }
$rows = New-Object System.Text.StringBuilder
foreach ($g in $sc.checklist) {
  [void]$rows.Append('<tr><td colspan="3" style="background:#f3efe6"><b>' + (HtmlText $g.official) + '</b> <span class="sub">(' + $stageName[$g.stage] + ')</span></td></tr>')
  foreach ($it in $g.items) {
    $what = if ($it.parts) { ($it.parts | ForEach-Object { '<b>' + (HtmlText $_.label) + ':</b> ' + (HtmlText $_.hint) }) -join '<br>' } else { HtmlText $it.hint }
    [void]$rows.Append('<tr><td>' + (HtmlText $it.official) + '</td><td>' + (HtmlText $it.label) + '</td><td>' + $what + '</td></tr>')
  }
}
$cherry = $sc.characters | Where-Object { $_.id -eq 'cherry' }
$lance = $sc.characters | Where-Object { $_.id -eq 'lance' }
$cues = ($sc.teacher.cues | ForEach-Object { '<li>' + (HtmlText $_) + '</li>' }) -join ''
$debrief = ($sc.teacher.debrief | ForEach-Object { '<li>' + (HtmlText $_) + '</li>' }) -join ''
$cherryFacts = ($cherry.facts | ForEach-Object { '<li>' + (HtmlText $_) + '</li>' }) -join ''

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
<tr><td>Cherry_Wilkes_Observer_Quiz.docx</td><td>One per student. Part A while they watch and listen. Part B after the session.</td></tr>
</table>

<h2>2. Before class (10 minutes)</h2>
<ol>
<li>Open the page in Microsoft Edge. Press Ctrl+F5 so you get the newest version.</li>
<li>Settings: your API key and a Sonnet model are already saved on your laptop. Under Scenario choose <b>Cherry Wilkes - Support visit</b>.</li>
<li>Voices: Cherry = Natasha, Lance = William. Press Test for each. Press Save and close.</li>
<li>Test the microphone once: click Speak, say "Hello Cherry", click again, check the words.</li>
<li>Print the Observer Quiz, one per student.</li>
</ol>

<h2>3. Class run sheet (60 to 75 minutes)</h2>
<table><tr><th style="width:14%">Time</th><th>What happens</th><th style="width:34%">You</th></tr>
<tr><td>5 min</td><td>Set the scene: "You are Cherry's support worker. You visit her three mornings a week. Today at 11am you find her crying in her bedroom. Together, the whole class is one support worker." Hand out the quiz.</td><td>Explain <b>Say</b> (something you say) and <b>Do</b> (something you do, for example "I sit down next to her"). Typing is always fine.</td></tr>
<tr><td>35 to 45 min</td><td>Press <b>Start visit</b>. Each student has 5 turns, then presses <b>Next student</b>. The checklist on the right turns green. "Still to show" helps the next student choose what to do.</td><td>Watch the key moments in section 5. Use Teacher notes (press T) to whisper to Cherry if the class is stuck.</td></tr>
<tr><td>10 to 15 min</td><td>When every visit point is green, press <b>Go to Lance</b>. Students keep taking turns and report to Lance.</td><td>Listen for the risk and protective factors (section 7).</td></tr>
<tr><td>5 min</td><td>Press <b>Finish session</b>, then <b>Download session (Word)</b>.</td><td>In Teacher notes press <b>Download checklist with evidence (Word)</b> for your own records.</td></tr>
<tr><td>10 min</td><td>Debrief (section 9). Students do Part B of the quiz, then you go through the answers (section 10).</td><td>Name the skills they used.</td></tr>
<tr><td>Later</td><td>Each student writes the progress note for Cherry from the session document. It has everything that was said and done, and an empty progress note table.</td><td></td></tr>
</table>
<p>18 students with 5 turns each is 90 turns. A class usually needs fewer than that to show every point. With a small group, go around again.</p>

<h2>4. How the page works for Cherry</h2>
<table><tr><th style="width:30%">On the screen</th><th>What it does</th></tr>
<tr><td>What you can see</td><td>The box under Cherry's picture. It shows the room and Cherry's body language after each answer, for example "Cherry wipes her eyes and looks at the shelf." Students should notice and respond to it.</td></tr>
<tr><td>Calm meter</td><td>Five dots next to "What you can see". Cherry starts very upset. Kind, patient words and actions calm her. Rushing, judging, or touching without asking upsets her again. She becomes overwhelmed once in the story (the Minister line). That is part of the case, not a student mistake.</td></tr>
<tr><td>Say and Do</td><td>Say sends words. Do sends an action. Cherry reacts to both. There is no list of actions on the screen, so students must think of them: sit down, offer a tissue, fetch the church newsletter, hand over a brochure, press the phone buttons.</td></tr>
<tr><td>Dots and turn summary</td><td>One dot per turn. Green means that turn showed a new checklist point. After 5 turns a green summary shows what the student showed.</td></tr>
<tr><td>Checklist</td><td>All 31 points of the observation checklist in plain words, in the same groups as the form. Points turn green with a tick. Hover over a green point to see the student turn and words. Points with parts (for example social, cultural, spiritual) show each part.</td></tr>
<tr><td>Go to Lance</td><td>Works only when all 26 visit points are green. If some are missing, the page checks the whole conversation once more, then lists what is still needed. The same happens for <b>Finish session</b> with Lance's 4 points.</td></tr>
<tr><td>Coach and lifeline</td><td>The coach line names a skill or a missing area, never the words to say. Each student can use the lifeline once to see one idea.</td></tr>
<tr><td>Teacher notes (T)</td><td>Cue lines, the story facts still hidden, debrief questions, whisper, and the checklist tools: <b>Check the whole conversation again</b>, <b>Move on now (skip the checklist)</b> (press twice, for when the AI clearly missed something), and <b>Download checklist with evidence (Word)</b>.</td></tr>
<tr><td>Download session (Word)</td><td>Everything said and done with Cherry and Lance, what you could see, and an empty progress note table.</td></tr>
</table>
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
<li>She never raises self-harm. If a student asks her directly, she says clearly: "No, love, nothing like that. I'm just so tired of it all." Praise the student for asking.</li>
<li>She wants to ring Reverend Hill herself, but her hands shake, so she needs help with the number and the buttons. If a student rings for her without asking, she is a bit put out.</li>
<li>She accepts information about any suitable service, for example OPAN, and worries it will get Donna into trouble. She relaxes when told it is free, private and her choice.</li>
<li>She does not want the police or to confront Donna today. If pushed, she goes quiet.</li>
</ul>
<h3>Lance</h3>
<p>$(HtmlText $lance.persona) Lance did not see the visit, so he only knows what the students tell him. If they leave something out, he asks an open question instead of saying it. He reassures them that he will follow up with Cherry within 24 hours, helps them find the risk and protective factors, gives short feedback on how they supported Cherry, explains the next steps from the KAMA abuse policy, asks how they are feeling, and ends with "How do you think you went?"</p>

<h2>6. The checklist on the screen</h2>
<p>The left column is the wording on the observation checklist. The middle column is what students see on the screen. The right column is what the AI listens for.</p>
<table><tr><th style="width:36%">Checklist wording</th><th style="width:24%">On the screen</th><th>What counts</th></tr>
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
<table><tr><th style="width:50%">Part A: Listen and choose</th><th>Part B: Choose the best response</th></tr>
<tr><td>1 c, 2 a, 3 b, 4 c, 5 a, 6 b, 7 a, 8 c, 9 b, 10 b, 11 c</td><td>1 b, 2 a, 3 c, 4 b, 5 a, 6 c, 7 a, 8 c, 9 b, 10 a, 11 c, 12 a</td></tr>
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

# ---------- Observer quiz ----------
function QuizItem([int]$n, [string]$q, [string[]]$opts) {
  $letters = 'a','b','c'
  $o = for ($i = 0; $i -lt $opts.Count; $i++) { '<p class="opt">' + $letters[$i] + ') ' + (HtmlText $opts[$i]) + '</p>' }
  return '<p class="q">' + $n + '. ' + (HtmlText $q) + '</p>' + ($o -join '')
}
$partA = @(
  (QuizItem 1 "What is missing from Cherry's shelf today?" @('a crystal cat','a photo of her mother','a crystal swan')),
  (QuizItem 2 'Who did Cherry buy the crystal animals with?' @('her mother','her sister','her friend Joan')),
  (QuizItem 3 'How many crystal animals are left on the shelf?' @('12','4','8')),
  (QuizItem 4 'Who does Cherry think is selling the crystal animals?' @('a cleaner','a neighbour','her sister Donna')),
  (QuizItem 5 'What does Cherry think the money is for?' @('online shopping','paying bills','a holiday')),
  (QuizItem 6 'What is Cherry afraid will happen if Donna gets into trouble?' @('Donna will move overseas','Cherry will have to go into full-time care','Cherry will lose her job')),
  (QuizItem 7 'Who did Cherry want to see tomorrow?' @('the Minister','her doctor','the bank manager')),
  (QuizItem 8 'How does Cherry feel about tomorrow now?' @('She wants to go shopping.','She wants to call the police.','She wants to stay in bed and talk to no one.')),
  (QuizItem 9 'How does Cherry like to be comforted when she is upset?' @('a big hug','someone holding her hand, if they ask first','being left alone')),
  (QuizItem 10 'What could you see when you arrived?' @('Cherry dressed for church','Cherry in her dressing gown at 11am','Cherry cooking lunch')),
  (QuizItem 11 'Why does Cherry need help to use the phone?' @('She cannot see the numbers.','She does not own a phone.','Her hands are weak and shaky.'))
) -join ''
$partB = @(
  (QuizItem 1 'Cherry is crying and cannot talk. What is the best thing to do first?' @('Tell her to calm down so you can help.',"Sit with her quietly, offer a tissue and say: I'm here. Take your time.",'Ask her quickly what is wrong because you are busy.')),
  (QuizItem 2 'You want to comfort Cherry with touch. What should you do?' @('Ask: Would it help if I held your hand?','Give her a big hug.','Pat her on the head.')),
  (QuizItem 3 'How can you check the money worry tactfully?' @('Ask: Did Donna steal them?','Say: Your sister is a thief.','Ask: What do you think has happened to them?')),
  (QuizItem 4 "Cherry says: Please don't say anything. What is the best answer?" @("I promise I won't tell anyone.","I can hear you're worried. I need to tell my supervisor so we can support you. You stay in charge of what happens.",'This is a crime. I have to call the police now.')),
  (QuizItem 5 'Cherry says she just wants to stay in bed and talk to no one. What could this be a sign of?' @('mental ill-health, such as low mood','laziness','a late night')),
  (QuizItem 6 'Which one is a protective factor for Cherry?' @('not sleeping','losing her ornaments','her faith and her Minister')),
  (QuizItem 7 'Which one is a risk factor for Cherry?' @('She is grieving and pulling away from people.','She sang in the choir.','She makes her own breakfast.')),
  (QuizItem 8 'How do you support Cherry to make her own choices?' @('Ring the Minister for her without asking.','Tell her she must go to church.','Ask: Would you like to ring Reverend Hill? I can help with the buttons.')),
  (QuizItem 9 'Cherry does not want to call the police about Donna. What do you do?' @('Call the police anyway.','Respect her choice, give her information, and tell your supervisor.','Tell her she is making a bad choice.')),
  (QuizItem 10 'Which is a strength you could help Cherry notice?' @('She still showers and dresses herself most days.','She cries a lot.','She forgot her breakfast.')),
  (QuizItem 11 'What must you tell Lance?' @('Only that Cherry was sad.','Your opinion that Donna is a bad person.','What Cherry said, what you saw, what you did, and the signs of abuse and mental ill-health.')),
  (QuizItem 12 'What belongs in a progress note?' @("Facts, Cherry's own words, what you did and who you told.",'Your feelings about Donna.','A guess about what will happen next.'))
) -join ''
$quiz = @"
<html><head><meta charset="utf-8"><title>Cherry Wilkes Observer Quiz</title>$style</head><body>
<h1>Cherry Wilkes: Observer Quiz</h1>
<p>Name: ______________________________&nbsp;&nbsp;&nbsp;&nbsp; Date: ______________</p>
<h2>Part A: Listen and choose (during the visit)</h2>
<p>Listen to Cherry and look at the screen. Circle the best answer: a, b or c.</p>
$partA
<p style="margin-top:10pt"><b>Part A score: ______ of 11</b></p>
<h2>Part B: Choose the best response (after the visit)</h2>
<p>Think about what a good support worker says and does. Circle the best answer: a, b or c.</p>
$partB
<p style="margin-top:10pt"><b>Part B score: ______ of 12</b></p>
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
  foreach ($d in @(@{name='Cherry_Wilkes_Teacher_Guide'; html=$guide}, @{name='Cherry_Wilkes_Observer_Quiz'; html=$quiz})) {
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
