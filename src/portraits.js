// Original illustrated portraits (flat vector style). Kinds: olderWoman, olderMan, man, woman.
window.PORTRAITS = (function(){
  let n=0;
  function base(bg1, bg2, body){ const id='pg'+(n++);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">'+
      '<defs><linearGradient id="'+id+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+bg1+'"/><stop offset="1" stop-color="'+bg2+'"/></linearGradient></defs>'+
      '<rect width="200" height="200" fill="url(#'+id+')"/>'+body+'</svg>';
  }
  const skin = {light:'#f1c9a5', mid:'#e0b088', tan:'#d39c6f'};
  function face(sk, extra){
    return '<ellipse cx="100" cy="92" rx="36" ry="42" fill="'+sk+'"/>'+extra;
  }
  function shoulders(color){
    return '<path d="M30 200 C 35 150, 70 138, 100 138 C 130 138, 165 150, 170 200 Z" fill="'+color+'"/>';
  }
  function neck(sk){ return '<rect x="86" y="120" width="28" height="26" rx="8" fill="'+sk+'"/>'; }
  function smile(){ return '<path d="M86 108 Q100 120 114 108" stroke="#8a4a3a" stroke-width="3" fill="none" stroke-linecap="round"/>'; }
  function eyes(){ return '<circle cx="86" cy="88" r="3.4" fill="#2b2b2b"/><circle cx="114" cy="88" r="3.4" fill="#2b2b2b"/><path d="M78 79 q8 -5 16 0" stroke="#5a4636" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M106 79 q8 -5 16 0" stroke="#5a4636" stroke-width="2.5" fill="none" stroke-linecap="round"/>'; }
  function cheeks(){ return '<circle cx="78" cy="102" r="6" fill="#f0a08a" opacity=".45"/><circle cx="122" cy="102" r="6" fill="#f0a08a" opacity=".45"/>'; }
  function glasses(){ return '<g fill="none" stroke="#5b4b3a" stroke-width="2.5"><circle cx="86" cy="89" r="11"/><circle cx="114" cy="89" r="11"/><path d="M97 89 h6"/><path d="M75 87 l-9 -3"/><path d="M125 87 l9 -3"/></g>'; }
  function earrings(){ return '<circle cx="64" cy="104" r="3" fill="#d9b25a"/><circle cx="136" cy="104" r="3" fill="#d9b25a"/>'; }

  const olderWoman = base('#f7ecd9','#e8d3b3',
    shoulders('#7c9a8e') +
    '<path d="M70 150 C 80 140, 120 140, 130 150 L 128 200 L 72 200 Z" fill="#f4efe6"/>' +
    '<path d="M60 160 q40 22 80 0 l0 40 l-80 0 z" fill="#7c9a8e"/>' +
    neck(skin.light) + face(skin.light,'') +
    // grey hair, soft bob with volume
    '<path d="M60 92 C 56 52, 80 40, 100 40 C 122 40, 146 54, 140 94 C 138 70, 124 62, 100 62 C 78 62, 64 70, 60 92 Z" fill="#d9d4cc"/>' +
    '<path d="M60 92 C 58 104, 60 112, 66 118 C 62 104, 62 96, 66 84 Z" fill="#d9d4cc"/>' +
    '<path d="M140 94 C 142 106, 140 114, 134 120 C 138 106, 138 98, 134 86 Z" fill="#d9d4cc"/>' +
    eyes() + glasses() + cheeks() + smile() + earrings() +
    '<path d="M74 118 q6 4 12 2" stroke="#c88b78" stroke-width="1.5" fill="none" opacity=".6"/><path d="M114 120 q6 2 12 -2" stroke="#c88b78" stroke-width="1.5" fill="none" opacity=".6"/>'
  );

  const man = base('#e6eef2','#c9d7de',
    shoulders('#3f5d73') +
    '<path d="M84 140 L 100 156 L 116 140 L 112 138 L 100 148 L 88 138 Z" fill="#dfe7ec"/>' +
    neck(skin.mid) + face(skin.mid,'') +
    // short brown hair
    '<path d="M64 84 C 62 56, 78 44, 100 44 C 124 44, 138 58, 136 84 C 130 68, 118 62, 100 62 C 82 62, 70 68, 64 84 Z" fill="#5a3f2b"/>' +
    // stubble
    '<path d="M70 104 C 74 126, 90 134, 100 134 C 110 134, 126 126, 130 104 C 124 118, 112 124, 100 124 C 88 124, 76 118, 70 104 Z" fill="#8a6a55" opacity=".35"/>' +
    eyes() + smile() +
    '<path d="M94 96 q6 6 12 0" stroke="#b37a5e" stroke-width="2" fill="none"/>'
  );

  const olderMan = base('#efe9dc','#d9d0bd',
    shoulders('#6d6a8a') +
    '<path d="M78 140 L 100 152 L 122 140 L 122 200 L 78 200 Z" fill="#f2f0ea"/>' +
    '<path d="M96 150 l4 -4 l4 4 l-4 30 z" fill="#a33d3d"/>' +
    neck(skin.light) + face(skin.light,'') +
    '<path d="M62 80 C 66 58, 82 50, 100 50 C 118 50, 134 58, 138 80 C 132 70, 120 66, 100 66 C 80 66, 68 70, 62 80 Z" fill="#cfcac3"/>' +
    '<path d="M62 80 C 60 92, 62 100, 66 106 C 64 96, 64 88, 66 80 Z M138 80 C 140 92, 138 100, 134 106 C 136 96, 136 88, 134 80 Z" fill="#cfcac3"/>' +
    eyes() + glasses() + smile() +
    '<path d="M88 112 q12 8 24 0" stroke="#bfb8ae" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>'
  );

  const woman = base('#f3e7ea','#e3ccd3',
    shoulders('#9a5b6b') +
    neck(skin.tan) + face(skin.tan,'') +
    '<path d="M60 96 C 56 56, 78 40, 100 40 C 122 40, 146 56, 140 96 L 140 130 C 136 120, 134 108, 134 92 C 128 70, 116 62, 100 62 C 84 62, 72 70, 66 92 C 66 108, 64 120, 60 130 Z" fill="#3a2a22"/>' +
    eyes() + cheeks() + smile() + earrings()
  );

  return { olderWoman, olderMan, man, woman };
})();
