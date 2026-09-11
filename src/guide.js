const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, LevelFormat, Table, TableRow, TableCell, WidthType, ShadingType, ExternalHyperlink, BorderStyle } = require('docx');

const F = 'Calibri';
const p = (text, opts={}) => new Paragraph({ spacing:{after:120}, ...opts, children: Array.isArray(text)? text : [new TextRun({text, font:F, size:22, ...(opts.run||{})})] });
const h1 = t => new Paragraph({ heading:HeadingLevel.HEADING_1, spacing:{before:320,after:120}, children:[new TextRun({text:t, font:F})] });
const h2 = t => new Paragraph({ heading:HeadingLevel.HEADING_2, spacing:{before:240,after:100}, children:[new TextRun({text:t, font:F})] });
const bullet = (t, ref='bul') => new Paragraph({ numbering:{reference:ref, level:0}, spacing:{after:80}, children: Array.isArray(t)? t : [new TextRun({text:t, font:F, size:22})] });
let numRef='num1'; const num = t => bullet(t, numRef); const restart = r => { numRef=r; return p(''); };
const bold = t => new TextRun({text:t, font:F, size:22, bold:true});
const run = t => new TextRun({text:t, font:F, size:22});
const link = (t, url) => new ExternalHyperlink({ link:url, children:[new TextRun({text:t, font:F, size:22, style:'Hyperlink'})] });

const W = 9026; // A4 text width in DXA with 1" margins
function table(rows, widths){
  return new Table({ width:{size:W, type:WidthType.DXA}, columnWidths:widths, rows: rows.map((r,i)=> new TableRow({ children: r.map((c,j)=> new TableCell({ width:{size:widths[j], type:WidthType.DXA}, shading: i===0? {type:ShadingType.CLEAR, fill:'DFF0EE', color:'auto'}:undefined, margins:{top:80,bottom:80,left:120,right:120}, children:[new Paragraph({children:[new TextRun({text:c, font:F, size:21, bold:i===0})]})] })) })) });
}

const doc = new Document({
  styles:{ default:{ document:{ run:{ font:F, size:22 } } },
    paragraphStyles:[
      { id:'Heading1', name:'Heading 1', basedOn:'Normal', next:'Normal', quickFormat:true, run:{ size:32, bold:true, color:'1B7F79', font:F } },
      { id:'Heading2', name:'Heading 2', basedOn:'Normal', next:'Normal', quickFormat:true, run:{ size:26, bold:true, color:'1F2A2E', font:F } },
    ] },
  numbering:{ config:[
    { reference:'bul', levels:[{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }] },
    ...['num1','num2','num3','num4'].map(r=>({ reference:r, levels:[{ level:0, format:LevelFormat.DECIMAL, text:'%1.', alignment:AlignmentType.LEFT, style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }] })),
  ]},
  sections:[{ properties:{ page:{ margin:{ top:1440, bottom:1440, left:1440, right:1440 } } }, children:[
    new Paragraph({ children:[new TextRun({text:'Family Meeting: Setup and Class Guide', font:F, size:40, bold:true, color:'1B7F79'})], spacing:{after:80} }),
    p('An AI plays the family member. Students interview them as a class. The board fills in on the screen.', {run:{color:'5B6A70', italics:true}}),
    p('CHCAGE011 Provide support to people living with dementia. Assessment Task 2, Part A preparation. Case: Wilson Blue (Rosie, his wife). Second case included: Val Theeson (Stuart, her husband).'),

    h1('1. What you received'),
    table([
      ['File','What it is'],
      ['Family_Meeting.html','The whole tool in one file. Double click it to open in Chrome or Edge. Nothing to install. Keep a copy on a USB stick as a backup.'],
      ['This guide','Setup steps, a class run sheet, how Rosie and Clifton behave, and how to add a new case.'],
    ],[2600, W-2600]),
    p(''),
    p('The page runs only on the laptop it is opened on. Your API key is stored in that browser and nowhere else. It does not touch your existing student chatbot.'),

    h1('2. One-time setup (about 15 minutes)'),
    h2('Step 1: Get an API key'),
    num([run('Go to the '), link('Anthropic Console', 'https://console.anthropic.com/'), run(' and sign in or create an account.')]),
    num('Add a small amount of credit (about 10 Australian dollars covers many class sessions; one 45 minute session costs well under a dollar).'),
    num([run('Open '), bold('Settings, then Limits'), run(' and set a low monthly spend limit, for example 10 dollars. This protects you if the key is ever misused.')]),
    num([run('Open '), bold('API Keys'), run(', create a key named "Family Meeting classroom", and copy it. You only see it once. Paste it somewhere safe.')]),
    h2('Step 2: Open the page and enter the key'), (numRef='num2', null),
    num('Copy Family_Meeting.html to your private laptop, for example to your Desktop. Double click it. If it opens in the wrong browser, right click it, choose Open with, then Google Chrome or Microsoft Edge.'),
    num([run('Press '), bold('Settings'), run('. Paste the key. Press '), bold('Load models'), run('. Choose a model with "sonnet" in the name. Sonnet is fast enough for a live class and gives natural answers.')]),
    num([run('Choose the scenario '), bold('Wilson Blue - Family Meeting'), run('.')]),
    num([run('Choose a voice for each family member and press '), bold('Test'), run('. Microsoft Edge has the best Australian voices: Natasha for Rosie and William for Clifton. In Chrome, pick any English voices you find clear, or add the Australian voices in Windows Settings under Time and language, Speech, Add voices. Set the speed a little slower than normal for ESL students.')]),
    num([run('Press '), bold('Save and close'), run('. The top right corner should now say Ready.')]),
    h2('Step 3: Test the microphone once'), (numRef='num3', null),
    num('Click the microphone button. The browser asks for permission the first time. Choose Allow.'),
    num('Say "Hello Rosie, can you tell me about Wilson?" then click the button again to stop. The words appear in the box. Fix any mistakes, then press Send.'),
    num('Rosie answers on the screen and out loud, and a point appears on the board.'),
    p([bold('If the microphone is blocked: '), run('click the small icon at the left of the address bar, set Microphone to Allow, and reload the page.')]),
    p([bold('If there is no sound: '), run('check the laptop volume and that the projector or speaker is selected as the sound output in Windows.')]),

    h1('3. Class run sheet (45 to 60 minutes)'),
    table([
      ['Time','What happens','You'],
      ['5 min','Set the scene. "Wilson moved into our memory unit yesterday. His wife Rosie and son Clifton are visiting. Our job is to learn everything we can so the evening staff can support him well." Show the six headings on the board and explain the turn rules: 3 questions each, one lifeline.','Explain that Rosie and Clifton are played by an AI. Say why: this is a tool they will meet in their working lives, and today they will see what it can and cannot do.'],
      ['5 min','Students write one question each on a card. Pairs check each other\'s question. Ask: is it open or closed?','Walk around. Help ESL students with wording. Nobody has to speak yet.'],
      ['25 min','Press Start meeting. Two or three students practise opening the meeting (introduce, purpose, can you hear me, comfortable, privacy). Press Begin questions. Then press Next student as each student comes up. Each asks 3 questions: click the microphone, ask, click again to stop, check the words, press Send. The family answers, the board fills in, and a Coach line gives a hint about technique. After the third question the student sees their turn summary.','You sit as the supervisor. Watch how students respond when Clifton suggests locking Wilson in (section 4). Press T to see which facts are still hidden, then close it again.'],
      ['5 min','Wrap up. Whisper "Start wrapping up" from the Teacher notes so Rosie ends naturally. Press Download board (Word) or Print.','Save the board file. Students will use it for the progress note (Part B) and the activity plan (Part C).'],
      ['10 min','Debrief using the questions in Teacher notes: which questions worked, what did Clifton suggest and why staff cannot do it, what is the key issue for the progress note, what evening activity would suit Wilson.','Name the skills they just used: introducing yourself, open questions, listening, validating, noticing a concern. These are the exact checklist items for Part A.'],
    ],[1200, 4600, W-5800]),
    p(''),
    p([bold('The AI literacy moment. '), run('Take two minutes at the end to ask: What did Rosie do well? Where did she sound wrong or too perfect? Could you tell she was not a real person? What would you never let an AI do in your job? This turns the session into their first honest conversation about AI at work.')]),

    h1('4. Rosie and Clifton (Wilson Blue case)'),
    p('The AI plays both Rosie and Clifton, each with their own voice. Rosie does most of the talking. Clifton speaks up about sport, TV, routines and rules, and he disagrees with Rosie about the evenings. The first time a student asks about evenings, wandering, or what the family tried at home, Clifton interrupts with "I told you to just lock the house up." When a student asks what worked or what staff should do in the evenings, Clifton gives his key line once: lock Dad in his room at 5.30 and put the football DVD on. Rosie pushes back on him.'),
    p([bold('What to watch for: '), run('how the student responds to Clifton. A good response validates his worry for his Mum, does not argue, and says the information will be passed to the supervisor. Clifton then accepts it with a grumble. If a student argues or lectures him, he becomes short and defensive, which is a useful lesson in itself.')]),
    p([bold('Your role: '), run('you are free to sit as the supervisor and watch the room. Use Teacher notes (press T) to see which facts are still hidden and to whisper instructions such as "Clifton, bring up the football now" or "Start wrapping up".')]),
    p([bold('If you prefer to play Clifton yourself: '), run('open Settings, under "Who plays each family member" set Clifton to "Me (teacher)", Save, then press Reset. Rosie will then leave Clifton\'s topics to you ("You had better ask Clifton, he is right here") and your cue lines are in Teacher notes.')]),
    p([bold('Debrief concepts to name: '), run('restrictive practice, duty of care, rights and dignity of risk, possible neglect, reporting to the supervisor, and carer stress.')]),

    h1('5. Opening the meeting, student turns, coaching and the lifeline'),
    p([bold('Opening stage: '), run('when you press Start meeting the family joins the video call and waits. Nobody speaks until a student opens the meeting. The screen shows five opening checks: introduced yourself and your role; explained why you are meeting; checked they can hear and see you; checked they are comfortable and have time; checked privacy and any needs such as an interpreter. Each one ticks off as the student covers it. If a student jumps straight into questions, Rosie asks who she is speaking to and does not answer. These checks are the first two items on the Part A observation checklist. Press Next student to let two or three students practise the opening, then press Begin questions to move on. Each opening takes about a minute.')]),
    p([bold('Brief answers: '), run('the family gives one piece of information per answer so that 18 students all have something to discover. Follow-up questions bring out the rest. Turn this off in Settings if you want fuller answers for a small group.')]),
    p('Each student gets a turn of two, three or four questions (set in Settings). Press Next student when a new student comes to the laptop. The turn bar shows "Student 5, question 2 of 3" and a dot for each question: green for open, orange for closed.'),
    p([bold('Coaching hints: '), run('after each answer a yellow Coach line gives one sentence about technique or an area not yet explored, for example "You have not asked what helped in the evenings yet." It never gives the question itself. Under it, "Still to explore" lists the headings with nothing on the board, so a student can see where to go next.')]),
    p([bold('Turn summary: '), run('after the last question of a turn a green summary appears: how many questions were open or closed, how many new facts the student uncovered, and one line of feedback. This is the "am I on the right path" signal, and the class sees it too. Keep it light and positive in the room; the point is the next student learns from it.')]),
    p([bold('Lifeline: '), run('each student can press "Lifeline: show me a question" once. A suggested question appears, based on what was just said, and the student puts it in their own words. Using it is visible, so most students try without it first. Turn it off in Settings for a strong group.')]),
    p([bold('Pictures: '), run('Rosie and Clifton have drawn portraits. The picture of whoever is speaking gets a green border, like a video call. To use your own pictures, open Settings, Pictures, and press Load picture next to a name. A square image works best. Use Use drawn portrait to go back.')]),

    h1('6. Using the page during class'),
    table([
      ['Button or key','What it does'],
      ['Microphone','Click to start listening, click again to stop. Words appear in the box. Students can fix them or type instead. Enter sends.'],
      ['Send','Sends the question to Rosie. Rosie answers in text and voice. The board updates.'],
      ['Say again','Repeats the last answer out loud.'],
      ['Start meeting','The family joins the call and waits for a student to open the meeting.'],
      ['Begin questions','Ends the opening practice and starts the question turns. Shown only during the opening stage.'],
      ['Next student','Starts the next student\'s turn: resets the question count and gives them a fresh lifeline.'],
      ['Lifeline: show me a question','Shows one suggested question. Once per student. Can be turned off in Settings.'],
      ['Teacher notes (or press T)','Opens your private panel: the list of facts still hidden, cue lines if you play a family member yourself, debrief questions, and a whisper box. Close it before students read the screen.'],
      ['Whisper','A private instruction the family follows in the next answer, for example "Start wrapping up", "Clifton, bring up the football now", "Rosie, mention how tired you are".'],
      ['Download board (Word)','Saves the board and all questions and answers as a Word file.'],
      ['Print','Prints just the board.'],
      ['Save session file','Saves everything as a file you can keep as a record.'],
      ['Reset','Clears the conversation and the board. Press twice. Use it before the next class.'],
    ],[2800, W-2800]),
    p(''),
    p([bold('If the internet or the API fails on the day: '), run('typing still works without a microphone, but Rosie needs the internet. Keep the Rosie and Clifton notes from the assessment printed. You can play Rosie yourself and still use the six headings on a whiteboard. Nothing is lost.')]),

    h1('7. Tips that make it work in a room of 18'),
    bullet('Use a small USB or Bluetooth microphone if you can. The laptop microphone picks up the room. A cheap lapel or desk microphone makes a big difference with accents and background noise.'),
    bullet('Ask the class to be quiet while a question is being spoken. Make it a game: "Rosie is a little hard of hearing."'),
    bullet('Typing is always an option. Say this at the start so nobody feels singled out. Some students will prefer to type every time and that is fine.'),
    bullet('Pairs work well: one student asks, the partner checks the words on the screen and presses Send.'),
    bullet('If a student is very anxious, let them hand their card to you or a friend to ask. They still get to hear the answer and see the board fill in.'),
    bullet('Do not say or type student names. Refer to students as "the next question" or "Question 7".'),
    bullet('Under 18 students can watch and take part. Nothing about them is entered or recorded. Check your campus guidance on generative AI in class before the first session so you can answer questions confidently.'),

    h1('8. Adding a new case later'),
    p('The page reads a scenario file. Wilson and Val are built in. To create a new person and family member for another unit:'), (numRef='num4', null),
    num([run('In Settings, press '), bold('Download this scenario as a file'), run('. You get a file such as wilson-blue.json.')]),
    num('Open it in Notepad, or better, give it to Claude with the new case study notes and ask: "Rewrite this scenario file for this new person and family member. Keep the same structure and field names. Write the facts from the family member\'s point of view."'),
    num('Check the facts, the character, the setting, the key facts list, and your cue lines. Save it as a .json file with a new id, for example george-family.json.'),
    num([run('In Settings, press '), bold('Load a scenario file'), run(' and choose it. It stays in that browser. Choose it from the scenario list whenever you need it.')]),
    p('Fields in the file: id, title, unit, person, setting, characters (a list, each with id, name, relation, voice, opening, persona, facts, notKnown), interactionRules, headings, keyFacts (id, label, heading), teacher (role, cues, debrief). One character or several, the page handles both.'),

    h1('9. Cost and privacy'),
    bullet('One class session of about 30 questions costs a few cents. The monthly limit you set in the Console is the safety net.'),
    bullet([run('Questions go to Anthropic\'s API under your key. Anthropic does not train on API data by default. See the '), link('Anthropic privacy policy', 'https://www.anthropic.com/legal/privacy'), run(' if you are asked.')]),
    bullet('The key is stored in the browser on your laptop. If you ever lend the laptop, open Settings, delete the key and Save, or delete the key in the Console.'),
    bullet('The page never records audio. The browser converts speech to words and only the words are sent.'),
    h1('10. Putting it on a free website (stops the microphone prompts)'),
    p('Browsers do not remember microphone permission for a file on your computer, so they ask every time. A real web address fixes that, and GitHub Pages hosts a page like this for free with no subscription. The page shows a PIN screen when it runs on the web (the PIN is 2468; tell Claude to change it). Your API key is never in the page: it stays in the browser you type it into, so even someone who finds the address cannot spend your credit.'),
    num([run('Go to '), link('github.com', 'https://github.com/'), run(' and create a free account (a username and an email is all it needs).')]),
    num([run('Press the '), bold('+'), run(' at the top right, then '), bold('New repository'), run('. Name it '), bold('family-meeting'), run(', leave it Public, tick '), bold('Add a README file'), run(', press Create repository.')]),
    num([run('Press '), bold('Add file'), run(', then '), bold('Upload files'), run('. Drag in the file '), bold('index.html'), run(' (this is the same page as Family_Meeting.html, renamed so the website opens it automatically). Press Commit changes.')]),
    num([run('Open the repository '), bold('Settings'), run(' tab, choose '), bold('Pages'), run(' in the left menu. Under Build and deployment set Source to "Deploy from a branch", Branch to "main", folder "/ (root)", and press Save.')]),
    num('Wait one or two minutes, then refresh the Pages screen. It shows your address, which looks like https://yourusername.github.io/family-meeting/. Open it, enter the PIN, put your API key in Settings once, and allow the microphone once. Both are remembered from then on.'),
    p([bold('Updating later: '), run('when Claude gives you a new version, upload the new index.html the same way and choose to replace the old one. The address stays the same.')]),
    p([bold('Note: '), run('the page is public in the sense that anyone with the exact address can see the PIN screen. There is nothing private in the page, and the PIN keeps casual visitors out. If the TAFE network blocks github.io, use your phone hotspot for the class, or fall back to the file on your Desktop.')]),
  ].filter(Boolean)}]
});

Packer.toBuffer(doc).then(b=>{ fs.writeFileSync('Family_Meeting_Setup_and_Class_Guide.docx', b); console.log('ok'); });
