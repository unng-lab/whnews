import{t as o,v as r,x as e,F as p,C as g,y as i,r as m,o as S,z as x,D as _}from"./CQNduw1-.js";const W={class:"lg:col-span-1 pr-2 border-r border-white/10"},D={class:"space-y-6"},A={class:"text-sm text-white/50"},F={class:"text-white/80 text-sm leading-relaxed whitespace-pre-line"},B={class:"flex justify-center mt-4 space-x-4"},G={__name:"NewsList",props:{newsList:Array},setup(c){const n=s=>new Date(s).toLocaleDateString(void 0,{year:"numeric",month:"short",day:"numeric"});return(s,t)=>(r(),o("section",W,[t[2]||(t[2]=e("h2",{class:"text-4xl font-bold mb-6 border-b border-white/10 pb-2"},"Latest News",-1)),e("div",D,[(r(!0),o(p,null,g(c.newsList,(l,b)=>(r(),o("div",{key:b,class:"rounded-xl p-4 bg-white/5 shadow-lg space-y-2"},[e("div",A,i(n(l.date)),1),e("p",F,i(l.text),1)]))),128))]),e("div",B,[e("button",{onClick:t[0]||(t[0]=l=>s.$emit("prev")),class:"px-3 py-1 bg-white/20 rounded hover:bg-white/30"},"<"),e("button",{onClick:t[1]||(t[1]=l=>s.$emit("next")),class:"px-3 py-1 bg-white/20 rounded hover:bg-white/30"},">")])]))}},H={class:"lg:col-span-2"},R={class:"grid grid-cols-1 sm:grid-cols-2 gap-6"},V=["src","alt"],z={class:"text-lg font-semibold"},E={class:"text-white/70 text-sm"},I={class:"flex justify-center mt-6 space-x-4"},M={__name:"LeadersList",props:{leaders:Array},setup(c){return(n,s)=>(r(),o("section",H,[s[2]||(s[2]=e("h2",{class:"text-4xl font-bold mb-6 border-b border-white/10 pb-2"},"Leaders",-1)),e("div",R,[(r(!0),o(p,null,g(c.leaders,t=>(r(),o("div",{key:t.name,class:"bg-white/5 p-4 rounded-xl shadow text-center"},[e("img",{src:t.image,alt:t.name,class:"rounded-xl w-full h-48 object-cover mb-4"},null,8,V),e("h3",z,i(t.name),1),e("p",E,i(t.description),1)]))),128))]),e("div",I,[e("button",{onClick:s[0]||(s[0]=t=>n.$emit("prev")),class:"px-3 py-1 bg-white/20 rounded hover:bg-white/30"},"<"),e("button",{onClick:s[1]||(s[1]=t=>n.$emit("next")),class:"px-3 py-1 bg-white/20 rounded hover:bg-white/30"},">")])]))}},O={class:"grid md:grid-cols-3 gap-6"},T={class:"font-semibold text-lg"},q={class:"text-white/70 text-sm"},J={class:"flex justify-center mt-6 space-x-4"},K={__name:"WorldsList",props:{worldList:Array},setup(c){return(n,s)=>(r(),o("section",null,[s[2]||(s[2]=e("h2",{class:"text-3xl font-bold mb-4 border-b border-white/10 pb-2"},"Worlds",-1)),e("ul",O,[(r(!0),o(p,null,g(c.worldList,t=>(r(),o("li",{key:t.name,class:"bg-white/5 p-4 rounded-xl shadow"},[e("h3",T,i(t.name),1),e("p",q,i(t.description),1)]))),128))]),e("div",J,[e("button",{onClick:s[0]||(s[0]=t=>n.$emit("prev")),class:"px-3 py-1 bg-white/20 rounded hover:bg-white/30"},"<"),e("button",{onClick:s[1]||(s[1]=t=>n.$emit("next")),class:"px-3 py-1 bg-white/20 rounded hover:bg-white/30"},">")])]))}},Q={class:"max-w-screen-xl mx-auto p-6 space-y-16"},U={class:"grid grid-cols-1 lg:grid-cols-3 gap-8"},X={class:"grid md:grid-cols-2 gap-12"},Y={class:"space-y-4"},Z={class:"font-semibold text-lg"},ee={class:"text-white/70 text-sm"},te={class:"space-y-4"},se={class:"font-semibold text-lg"},ne={class:"text-white/70 text-sm"},re={__name:"index",setup(c){const n=m(1),s=m(1),t=m(1),l=m([]),b=m([]),f=m([]),h=async u=>{const a=await fetch(`/news/page-${u}.json`);l.value=await a.json()},w=async u=>{const a=await fetch(`/leaders/page-${u}.json`);b.value=await a.json()},v=async u=>{const a=await fetch(`/worlds/page-${u}.json`);f.value=await a.json()},y=()=>{n.value>1&&(n.value--,h(n.value))},$=()=>{n.value++,h(n.value)},L=()=>{s.value>1&&(s.value--,w(s.value))},k=()=>{s.value++,w(s.value)},P=()=>{t.value>1&&(t.value--,v(t.value))},C=()=>{t.value++,v(t.value)};S(()=>{h(n.value),w(s.value),v(t.value)});const N=[{name:"Cadia",description:"Forrier fyitress world defending the Gadian Gate, now lying in ruins."},{name:"Rynn’s World",description:"Home to the Crimson Fists, known for withstanding Ork invasions."},{name:"Armageddon",description:"Desolate homeworld of Haad Angels ravaged by war and radiation."}],j=[{name:"Solar",description:"Core region of space contacting body Forca and mest important worlds."},{name:"Segmentum Temprstus",description:"Soutbesncuast segmentum. Rlouns for Cïrw Sulant and dangerous Space."},{name:"Segmentum Pacificus",description:"Western segmentum, often planred by nams fusets ald heretical Insovernents."}];return(u,a)=>(r(),o("div",Q,[e("div",U,[x(G,{newsList:_(l),onPrev:y,onNext:$},null,8,["newsList"]),x(M,{leaders:_(b),onPrev:L,onNext:k},null,8,["leaders"])]),x(K,{worldList:_(f),onPrev:P,onNext:C},null,8,["worldList"]),e("section",X,[e("div",null,[a[0]||(a[0]=e("h2",{class:"text-3xl font-bold mb-4 border-b border-white/10 pb-2"},"Systems",-1)),e("ul",Y,[(r(),o(p,null,g(N,d=>e("li",{key:d.name},[e("h3",Z,i(d.name),1),e("p",ee,i(d.description),1)])),64))])]),e("div",null,[a[1]||(a[1]=e("h2",{class:"text-3xl font-bold mb-4 border-b border-white/10 pb-2"},"Segmentums",-1)),e("ul",te,[(r(),o(p,null,g(j,d=>e("li",{key:d.name},[e("h3",se,i(d.name),1),e("p",ne,i(d.description),1)])),64))])])])]))}};export{re as default};
