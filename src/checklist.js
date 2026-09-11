const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType, AlignmentType, BorderStyle } = require('docx');
const F='Calibri';
const W = 9638; // A4 with 0.8" margins
const run = (t,o={}) => new TextRun({text:t, font:F, size:o.size||20, bold:o.bold, color:o.color, italics:o.italics});
const para = (t,o={}) => new Paragraph({ spacing:{after:o.after??60, before:o.before??0}, children: Array.isArray(t)? t : [run(t,o)] });
const cell = (children, w, o={}) => new TableCell({ width:{size:w, type:WidthType.DXA}, shading: o.fill? {type:ShadingType.CLEAR, fill:o.fill, color:'auto'}:undefined, margins:{top:40,bottom:40,left:100,right:100}, verticalAlign:'center', children: Array.isArray(children)? children : [children] });
const box = () => new Paragraph({ alignment:AlignmentType.CENTER, children:[new TextRun({text:'☐', font:'Segoe UI Symbol', size:30})] });

function section(title, items, colour){
  const rows = [ new TableRow({ children:[ cell(para(title,{bold:true,color:'FFFFFF',size:21}), W, {fill:colour}) ] }) ];
  // convert to a nested table: each item row = box | cue | write line
  const inner = items.map(it => new TableRow({ children:[
    cell(box(), 560),
    cell(para(it,{size:20}), 3400),
    cell(para('', {size:20}), W-3960),
  ]}));
  return [ new Table({ width:{size:W,type:WidthType.DXA}, columnWidths:[W], rows }),
           new Table({ width:{size:W,type:WidthType.DXA}, columnWidths:[560,3400,W-3960], rows: inner }),
           para('',{after:80}) ];
}

const likes = ['His work, and where he kept doing it at home','The garden and the food at home','Indoors or outdoors person?','The music he likes','What he reads, and when','Travel the couple did together','His family (how many, what they are like)','Sport he watches on TV','Routines, rules and structure'];
const dislikes = ['People being late','Food he does not like','Having nothing to do','The type of people he has no time for'];
const behaviour = ['What he did in the evenings at home','Who he said he was looking for','How he reacted when Rosie tried to bring him back','The time of day it happens'];
const nothelp = ['What the family did to stop him leaving, and how he reacted','What happened when Rosie told him who she was'];
const helped = ['An outdoor evening that seemed to help','What Rosie changed about dinner'];
const concerns = ['How Rosie is coping','What Clifton thinks staff should do in the evenings'];
const opening = ['Introduced themselves and their role','Explained why we are meeting','Checked the family can hear and see us','Checked they are comfortable and have time','Checked privacy, interpreter or cultural needs'];

const children = [
  new Paragraph({ children:[run('Family Meeting: Listening Checklist',{bold:true,size:34,color:'1B7F79'})], spacing:{after:40} }),
  para([run('Wilson Blue (CHCAGE011). Tick each point when you hear it and write the detail in your own words. ',{size:20}), run('You will need these notes for the progress note (Part B) and the activity plan (Part C).',{size:20,italics:true})],{after:60}),
  para([run('Name: ______________________________     Date: ____________     My question number(s): ______',{size:20})],{after:120}),

  ...section('Opening the meeting (tick when the student covers it)', opening, '5B6A70'),
  ...section('Likes and interests', likes, '1B7F79'),
  ...section('Dislikes', dislikes, '1B7F79'),
  ...section('Changed behaviour', behaviour, '1B7F79'),
  ...section('What did not help', nothelp, '1B7F79'),
  ...section('What helped', helped, '1B7F79'),
  ...section('Concerns to report to the supervisor', concerns, 'B3541E'),

  para([run('My own questions',{bold:true,size:21})],{before:60}),
  para('1. ____________________________________________________________   Open / Closed'),
  para('2. ____________________________________________________________   Open / Closed'),
  para('3. ____________________________________________________________   Open / Closed'),
  para([run('Total ticked: ______ of 23        What I would still ask if I had one more question: ______________________________________',{size:20})],{before:80}),
];

const doc = new Document({ styles:{ default:{ document:{ run:{ font:F, size:20 } } } },
  sections:[{ properties:{ page:{ margin:{ top:900, bottom:800, left:1000, right:1000 } } }, children }] });
Packer.toBuffer(doc).then(b=>{ fs.writeFileSync('Family_Meeting_Listening_Checklist.docx', b); console.log('ok'); });
