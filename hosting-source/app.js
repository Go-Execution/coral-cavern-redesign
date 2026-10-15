'use strict';
const products=window.CORAL_PRODUCTS;
const $=(selector,parent=document)=>parent.querySelector(selector);
const $$=(selector,parent=document)=>Array.from(parent.querySelectorAll(selector));
const escapeHTML=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(v);
const readStored=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}};
let bag=readStored('cc-preview-bag',[]).filter(x=>products.some(p=>p.id===x.id)&&Number.isInteger(x.qty)&&x.qty>0).map(x=>({...x,qty:Math.min(x.qty,20)}));
let saved=new Set(readStored('cc-saved',[]).filter(id=>products.some(p=>p.id===id)));
const persist=()=>{try{localStorage.setItem('cc-preview-bag',JSON.stringify(bag));localStorage.setItem('cc-saved',JSON.stringify([...saved]))}catch{}};
const total=()=>bag.reduce((sum,x)=>sum+products.find(p=>p.id===x.id).price*x.qty,0);
const count=()=>bag.reduce((sum,x)=>sum+x.qty,0);
let toastTimer;
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000)}
function openDialog(id){const d=$('#'+id);d.showModal();document.body.classList.add('no-scroll')}
function closeDialog(d){d.close();if(!document.querySelector('dialog[open]'))document.body.classList.remove('no-scroll')}
$$('dialog').forEach(d=>{d.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('no-scroll')});d.addEventListener('click',e=>{if(e.target===d){let r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog(d)}})});
function imageHTML(p,cls=''){return p.image?`<img src="${p.image}" alt="${escapeHTML(p.name)}" class="${cls}" loading="lazy">`:`<div class="photo-pending ${cls}">Actual specimen photo<small>Available on request</small></div>`}
function card(p){const category=p.category.startsWith('corals')?p.category.split(' ')[1]:p.category;return `<article class="product-card"><a class="product-photo" href="/product/?id=${p.id}">${imageHTML(p)}<span class="image-tag">${category.toUpperCase()}</span><span class="photo-arrow" aria-hidden="true"><span data-icon="arrow-up-right" aria-hidden="true"></span></span></a><div class="product-meta"><span>Confirm availability</span><button data-save="${p.id}" aria-label="Save ${escapeHTML(p.name)}" aria-pressed="${saved.has(p.id)}">${saved.has(p.id)?'<span data-icon="heart-fill" aria-hidden="true"></span>':'<span data-icon="heart" aria-hidden="true"></span>'}</button></div><h3><a href="/product/?id=${p.id}">${escapeHTML(p.name)}</a></h3><div class="price-row"><span>${money(p.price)}</span><button data-add="${p.id}" aria-label="Add ${escapeHTML(p.name)} to preview cart"><span data-icon="plus" aria-hidden="true"></span> Add</button></div></article>`}
function updateSavedButtons(){$$('[data-save]').forEach(b=>{let active=saved.has(b.dataset.save);b.setAttribute('aria-pressed',String(active));b.innerHTML=active?'<span data-icon="heart-fill" aria-hidden="true"></span>':'<span data-icon="heart" aria-hidden="true"></span>'})}
function renderBag(){
 $('#cart-count').textContent=count();$('#bag-count').textContent=`(${count()})`;
 if(!bag.length){$('#cart-items').innerHTML='<div class="empty-cart"><h3>Your reef story starts here.</h3><p>Explore the collection and save a few favorites to your preview bag.</p><a class="button" href="/shop/">Explore the reef <span data-icon="arrow-up-right" aria-hidden="true"></span></a></div>';$('#cart-footer').innerHTML='';return}
 $('#cart-items').innerHTML=bag.map(x=>{const p=products.find(p=>p.id===x.id);return `<div class="cart-item">${imageHTML(p)}<div><h3>${escapeHTML(p.name)}</h3><p>${money(p.price)}</p><div class="cart-item-controls"><div class="qty-control"><button data-qty="${p.id}" data-change="-1" aria-label="Reduce ${escapeHTML(p.name)} quantity"><span data-icon="minus" aria-hidden="true"></span></button><span>${x.qty}</span><button data-qty="${p.id}" data-change="1" aria-label="Increase ${escapeHTML(p.name)} quantity"><span data-icon="plus" aria-hidden="true"></span></button></div><button class="remove-item" data-remove="${p.id}">Remove</button></div></div></div>`}).join('');
 $('#cart-footer').innerHTML=`<div class="cart-total"><span>Subtotal</span><strong>${money(total())}</strong></div><p>Shipping, taxes and live stock are confirmed separately. This is a design preview.</p><button class="button" data-checkout>Review checkout preview <span data-icon="arrow-up-right" aria-hidden="true"></span></button>`;
}
function addProduct(id){if(!products.some(p=>p.id===id))return;const item=bag.find(x=>x.id===id);if(item){if(item.qty>=20){toast('Preview limit: 20 per listing.');return}item.qty++}else bag.push({id,qty:1});persist();renderBag();toast('Added to your reef bag.')}
let currentFilter=new URLSearchParams(location.search).get('category')||'all',onlySaved=false;
function matchesFilter(p,filter){if(filter==='collectors')return p.category.startsWith('corals')&&p.price>=350;return filter==='all'||p.category.split(' ').includes(filter)}
function renderShop(){if(!$('#shop-grid'))return;const query=$('#shop-search').value.trim().toLowerCase(),sort=$('#shop-sort').value;let result=products.filter(p=>matchesFilter(p,currentFilter)&&(!onlySaved||saved.has(p.id))&&p.name.toLowerCase().includes(query));if(sort==='low')result.sort((a,b)=>a.price-b.price);if(sort==='high')result.sort((a,b)=>b.price-a.price);if(sort==='name')result.sort((a,b)=>a.name.localeCompare(b.name));$('#shop-grid').innerHTML=result.map(card).join('');$('#result-count').textContent=`${result.length} ${result.length===1?'listing':'listings'}`;$$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===currentFilter)));$('#shop-empty').hidden=!!result.length;if(!result.length){let subject=currentFilter==='fish'?'Fish availability changes.':currentFilter==='sps'?'Looking for SPS?':'Let’s find your next piece.';$('#shop-empty').innerHTML=`<h3>${subject}</h3><p>${currentFilter==='fish'||currentFilter==='sps'?'There are no verified individual listings in this preview. Call or text the team about current stock and suitable options.':'Try another search, category or saved-items filter.'}</p><a class="button" href="tel:+19713744572">Ask about current stock <span data-icon="arrow-up-right" aria-hidden="true"></span></a>`}}
function renderSearch(){let q=$('#global-search').value.trim().toLowerCase();let found=products.filter(p=>p.name.toLowerCase().includes(q)).slice(0,7);$('#search-results').innerHTML=found.length?found.map(p=>`<a class="search-result" href="/product/?id=${p.id}">${imageHTML(p)}<div><h3>${escapeHTML(p.name)}</h3><p>${money(p.price)} · Confirm availability</p></div></a>`).join(''):'<p>No matching pieces. Try another name or ask the team.</p>'}
const vitals={temperature:['Temperature','76–78','°F','Stable temperature supports metabolism and reduces stress. Avoid rapid changes.'],salinity:['Salinity','1.025–1.026','SG','Match the salt concentration your marine animals need. Check with a calibrated instrument.'],ph:['pH','8.0–8.3','','pH reflects the acid–base balance of your water. Observe the pattern and avoid abrupt corrections.'],alkalinity:['Alkalinity','8–10','dKH','Alkalinity supports skeletal growth and helps buffer pH. Consistency matters more than chasing a number.'],calcium:['Calcium','400–450','ppm','Stony corals use calcium to build their skeletons. Monitor it alongside alkalinity.'],magnesium:['Magnesium','1250–1350','ppm','Magnesium helps balance calcium and alkalinity. Test before making changes.']};
function showVital(id){let v=vitals[id];if(!v)return;$('#vital-name').textContent=v[0];$('#vital-value').innerHTML=`${v[1]}<small>${v[2]}</small>`;$('#vital-desc').textContent=v[3];$$('[data-vital]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.vital===id)))}
function renderProduct(){const el=$('#product-detail');if(!el)return;let id=new URLSearchParams(location.search).get('id'),p=products.find(p=>p.id===id);if(!p){el.innerHTML='<h1>Let’s find your next coral.</h1><p>The requested listing was not found.</p><a class="button" href="/shop/">Return to the shop <span data-icon="arrow-up-right" aria-hidden="true"></span></a>';return}document.title=p.name+' · Coral Cavern';let cat=p.category.split(' '),type=cat.includes('lps')?'LPS coral':cat.includes('soft')?'Soft coral':cat.includes('inverts')?'Invertebrate':'Aquarium supplies';let care=cat.includes('lps')?'Discuss species-specific light, flow, feeding and placement. Leave room for expanded tissue and neighboring coral interactions.':cat.includes('soft')?'Discuss suitable lighting, water flow and room for growth. Stable water and careful observation are essential.':cat.includes('inverts')?'Confirm compatibility with your fish and other invertebrates, feeding needs and a species-appropriate acclimation plan.':'Ask the team about the correct product, quantity and use for your system.';
 el.innerHTML=`<div class="breadcrumbs"><a href="/">Home</a> / <a href="/shop/">Shop</a> / ${escapeHTML(p.name)}</div><div class="product-layout"><div>${imageHTML(p,p.image?'detail-photo':'large')}<p class="fine-print">${p.image?'Product photo from the supplied Coral Cavern catalogue. Confirm the exact current specimen.':'We have omitted an unverified photograph. Request a current actual product photo.'}</p></div><div class="product-description"><p class="eyebrow">${type.toUpperCase()} / CORAL CAVERN COLLECTION</p><h1>${escapeHTML(p.name)}</h1><div class="detail-price">${money(p.price)}</div><div class="stock-status"><span data-icon="circle-fill" aria-hidden="true"></span> Availability requires confirmation</div><p>A closer look at ${escapeHTML(p.name)} from the Coral Cavern catalogue. Speak with the team to confirm the available specimen, size and fit for your setup.</p><button class="button" data-add="${p.id}">Add to preview bag <span data-icon="plus" aria-hidden="true"></span></button><a class="text-link" href="sms:+19713744572">Ask about this specimen <span data-icon="arrow-up-right" aria-hidden="true"></span></a><p class="preview-note">Catalogue price shown for this design preview. Current stock, specimen identity and final pricing must be confirmed before purchase.</p><div class="product-accordions"><details open><summary>Care & compatibility</summary><p>${care}</p></details><details><summary>Photography & specimen</summary><p>${p.image?'This is the product photograph presented in the supplied Coral Cavern reference. Lighting affects how coral color appears. Ask for current photos and specimen confirmation.':'A verified product photograph is required before commercial sale. We do not substitute a stock photo for the actual livestock.'}</p></details><details><summary>Shipping & protection</summary><p>Discuss shipping options and timing with the team. Read current written livestock terms before ordering, and document any arrival issue immediately.</p><a class="text-link" href="https://coralcavern.com/terms-conditions/" target="_blank" rel="noopener">Current written terms <span data-icon="arrow-up-right" aria-hidden="true"></span></a></details></div></div></div>`}
document.addEventListener('click',e=>{
 const b=e.target.closest('button,[data-cart],[data-search]');if(!b)return;
 if(b.matches('[data-close]'))closeDialog(b.closest('dialog'));
 if(b.matches('[data-cart]')){renderBag();openDialog('cart-dialog')}
 if(b.matches('[data-search]')){openDialog('search-dialog');renderSearch();$('#global-search').focus()}
 if(b.dataset.add)addProduct(b.dataset.add);
 if(b.dataset.save){let id=b.dataset.save;saved.has(id)?saved.delete(id):saved.add(id);persist();updateSavedButtons();if(onlySaved)renderShop();toast(saved.has(id)?'Saved for a closer look.':'Removed from saved pieces.')}
 if(b.dataset.qty){let item=bag.find(x=>x.id===b.dataset.qty);if(item)item.qty=Math.min(20,item.qty+Number(b.dataset.change));bag=bag.filter(x=>x.qty>0);persist();renderBag()}
 if(b.dataset.remove){bag=bag.filter(x=>x.id!==b.dataset.remove);persist();renderBag()}
 if(b.dataset.filter){currentFilter=b.dataset.filter;const url=new URL(location.href);url.searchParams.set('category',currentFilter);history.replaceState(null,'',url);renderShop()}
 if(b.id==='saved-only'){onlySaved=!onlySaved;b.setAttribute('aria-pressed',String(onlySaved));renderShop()}
 if(b.dataset.vital)showVital(b.dataset.vital);
 if(b.matches('[data-checkout]')){closeDialog($('#cart-dialog'));$('#checkout-summary').innerHTML=`<div class="cart-total"><span>${count()} item${count()===1?'':'s'}</span><strong>${money(total())}</strong></div><p class="fine-print">Preview subtotal. Shipping and tax are not calculated.</p>`;$('#checkout-status').textContent='';openDialog('checkout-dialog')}
 if(b.matches('.menu-toggle')){let open=$('#header').classList.toggle('menu-open');b.setAttribute('aria-expanded',String(open));b.setAttribute('aria-label',open?'Close navigation':'Open navigation')}
});
$('#global-search').addEventListener('input',renderSearch);
$('#shop-search')?.addEventListener('input',renderShop);$('#shop-sort')?.addEventListener('change',renderShop);
$('#checkout-form').addEventListener('submit',e=>{e.preventDefault();$('#checkout-status').textContent='Preview complete. No order was placed and no payment was taken. Contact Coral Cavern to confirm your chosen items.';toast('Checkout preview complete. No order placed.')});
$('#quote-form')?.addEventListener('submit',e=>{e.preventDefault();$('#quote-status').textContent='Form preview complete. This design mockup does not send inquiries.';toast('Visual form preview. Nothing was sent.')});
let page=document.body.dataset.page;$$('nav a').forEach(a=>{if(a.pathname===`/${page}/`)a.setAttribute('aria-current','page')});
const motionReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!motionReduced&&$('.water-specks')){for(let i=0;i<20;i++){let dot=document.createElement('i');dot.className='speck';dot.style.left=(37+Math.random()*60)+'%';dot.style.top=(20+Math.random()*78)+'%';dot.style.animationDelay=(-Math.random()*18)+'s';$('.water-specks').append(dot)}}
renderBag();updateSavedButtons();renderShop();renderProduct();
if('IntersectionObserver' in window&&!motionReduced){document.documentElement.classList.add('js-reveal');let observer=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}})},{threshold:.08});$$('.reveal').forEach(el=>observer.observe(el));}

// Immersive detail and motion layer. The site remains fully usable when GSAP
// cannot load or when the visitor prefers reduced motion.
const reefFacts=Object.freeze({
 'goniopora-garden':['Goniopora sp.','Moderate','Gentle'],
 'acantho-red':['Acanthophyllia deshayesiana','Low–moderate','Low'],
 'ricordea':['Ricordea yuma','Moderate','Low'],
 'banana-hammer':['Euphyllia ancora','Moderate','Gentle–moderate'],
 'skunk-shrimp':['Lysmata amboinensis','Any','Moderate'],
 'cat-eye-bubble':['Plerogyra sinuosa','Low–moderate','Low–moderate'],
 'daisy-coral':['Knopia / Clavularia','Moderate','Moderate'],
 'acanthophyllia':['Acanthophyllia deshayesiana','Low–moderate','Low'],
 'turban-snail':['Turbo sp.','Any','Moderate–strong'],
 'cynaria-ultra':['Cynarina lacrymalis','Low–moderate','Low'],
 'colorado-sunburst':['Entacmaea quadricolor','Moderate–high','Moderate'],
 'red-elegance':['Catalaphyllia jardinei','Moderate','Gentle'],
 'open-brain':['Trachyphyllia geoffroyi','Low–moderate','Low'],
 'goni-purple':['Goniopora sp.','Moderate','Gentle'],
 'electric-elegance':['Catalaphyllia jardinei','Moderate','Gentle'],
 'purple-gold':['Acanthophyllia deshayesiana','Low–moderate','Low'],
 'blasto-purple':['Blastomussa wellsi','Low–moderate','Low–moderate'],
 'flat-open-brain':['Trachyphyllia geoffroyi','Low–moderate','Low'],
 'blastomussa':['Blastomussa wellsi','Low–moderate','Low–moderate'],
 'biscuit-star':['Tosia sp.','Any','Low–moderate'],
 'carpet-anemone':['Stichodactyla sp.','Moderate–high','Moderate']
});

function fallbackFacts(product){
 const category=product?.category||'';
 if(category.includes('lps'))return['LPS coral specimen','Moderate','Gentle'];
 if(category.includes('soft'))return['Soft coral specimen','Moderate','Low–moderate'];
 if(category.includes('inverts'))return['Marine invertebrate','Species specific','Species specific'];
 return['Aquarium essential','—','—'];
}

function enhanceProductCards(root=document){
 $$('.product-card',root).forEach(productCard=>{
  if(productCard.dataset.detailed==='true')return;
  const productLink=$('a[href*="product"]',productCard);
  if(!productLink)return;
  let productId='';
  try{productId=new URL(productLink.href,location.href).searchParams.get('id')||productLink.hash.slice(1)}catch{}
  const product=products.find(item=>item.id===productId);
  if(!product)return;
  const facts=reefFacts[productId]||fallbackFacts(product);
  const title=$('h3',productCard);
  const price=$('.price-row',productCard);
  if(title&&price){
   const details=document.createElement('div');
   details.className='specimen-details';
   details.innerHTML=`<p class="scientific-name">${escapeHTML(facts[0])}</p><dl class="specimen-vitals"><div><dt>Light</dt><dd>${escapeHTML(facts[1])}</dd></div><div><dt>Flow</dt><dd>${escapeHTML(facts[2])}</dd></div></dl>`;
   price.before(details);
  }
  productCard.dataset.detailed='true';
  enableTilt(productCard);
 });
}

function buildReefDepthStory(){
 if(document.body.dataset.page!=='home'||$('.reef-depth-story'))return;
 const insertionPoint=$('.featured');
 if(!insertionPoint)return;
 const assetPrefix=location.protocol==='file:'?'assets':'/assets';
 const shopHref=location.protocol==='file:'?'shop.html':'/shop/';
 const section=document.createElement('section');
 section.className='section reef-depth-story';
 section.id='reef-depth';
 section.innerHTML=`
  <div class="reef-depth-copy">
   <p class="eyebrow">REEF PLACEMENT / AN IMMERSIVE FIELD GUIDE</p>
   <h2>Descend through <em>the living reef.</em></h2>
   <p>Light fades and water flow softens with depth. Scroll through three reef zones to see where different corals feel at home.</p>
   <div class="reef-zone-list" role="list" aria-label="Coral placement zones">
    <article class="reef-zone-card is-active" data-zone="0" role="listitem"><span>01 · TOP THIRD</span><h3>SPS ridge</h3><p>Bright light · Strong flow · Advanced care</p></article>
    <article class="reef-zone-card" data-zone="1" role="listitem"><span>02 · MIDDLE ROCK</span><h3>LPS garden</h3><p>Moderate light · Gentle flow · Room to expand</p></article>
    <article class="reef-zone-card" data-zone="2" role="listitem"><span>03 · SAND BED</span><h3>Soft & fleshy</h3><p>Lower light · Calm water · A forgiving start</p></article>
   </div>
   <a class="text-link" href="${shopHref}?category=corals">Find your coral level <span data-icon="arrow-up-right" aria-hidden="true"></span></a>
  </div>
  <div class="reef-viewport" aria-label="Layered reef placement illustration">
   <div class="reef-glow" aria-hidden="true"></div>
   <div class="reef-orbit reef-orbit-one" aria-hidden="true"></div>
   <div class="reef-orbit reef-orbit-two" aria-hidden="true"></div>
   <figure class="reef-plane reef-plane-top" data-plane="0"><img src="${assetPrefix}/reef.jpg" alt="Bright upper reef habitat"><figcaption><b>SPS ridge</b><span>High light · strong current</span></figcaption></figure>
   <figure class="reef-plane reef-plane-middle" data-plane="1"><img src="${assetPrefix}/banana-hammer.webp" alt="Branching Banana Hammer coral"><figcaption><b>LPS garden</b><span>Moderate light · gentle flow</span></figcaption></figure>
   <figure class="reef-plane reef-plane-bottom" data-plane="2"><img src="${assetPrefix}/ricordea.webp" alt="Raspberry Neon Blast Ricordea coral"><figcaption><b>Sand-bed color</b><span>Lower light · calm water</span></figcaption></figure>
   <div class="reef-depth-axis" aria-hidden="true"><span>BRIGHT</span><i></i><span>DEEP</span></div>
   <div class="reef-scroll-cue" aria-hidden="true">SCROLL TO DESCEND <span><span data-icon="arrow-down" aria-hidden="true"></span></span></div>
  </div>`;
 insertionPoint.before(section);
}

let gsapContext=null;
function setActiveReefZone(index){
 $$('.reef-zone-card').forEach((card,cardIndex)=>card.classList.toggle('is-active',cardIndex===index));
 $$('.reef-plane').forEach((plane,planeIndex)=>plane.classList.toggle('is-active',planeIndex===index));
}

function enableTilt(element){
 if(!element||element.dataset.tiltReady==='true'||motionReduced||!window.gsap||!matchMedia('(hover:hover) and (pointer:fine)').matches)return;
 element.dataset.tiltReady='true';
 element.classList.add('tilt-surface');
 const rotateX=gsap.quickTo(element,'rotationX',{duration:.45,ease:'power3.out'});
 const rotateY=gsap.quickTo(element,'rotationY',{duration:.45,ease:'power3.out'});
 element.addEventListener('pointermove',event=>{
  const bounds=element.getBoundingClientRect();
  const x=(event.clientX-bounds.left)/bounds.width-.5;
  const y=(event.clientY-bounds.top)/bounds.height-.5;
  rotateX(y*-8);rotateY(x*10);
  element.style.setProperty('--pointer-x',`${(x+.5)*100}%`);
  element.style.setProperty('--pointer-y',`${(y+.5)*100}%`);
 });
 element.addEventListener('pointerleave',()=>{rotateX(0);rotateY(0)});
}

function initGsapExperience(){
 if(motionReduced||!window.gsap||!window.ScrollTrigger){document.documentElement.classList.add('motion-fallback');return}
 gsap.registerPlugin(ScrollTrigger);
 document.documentElement.classList.add('gsap-ready');
 document.documentElement.classList.remove('js-reveal');
 $$('.reveal').forEach(element=>element.classList.add('visible'));
 gsapContext=gsap.context(()=>{
  if($('.hero')){
   gsap.timeline({defaults:{ease:'power3.out'}})
    .from('.hero-eyebrow',{opacity:0,y:18,duration:.6})
    .from('.hero-content h1',{opacity:0,y:55,rotationX:-8,duration:1},'-=.35')
    .from('.hero-content>p:not(.eyebrow)',{opacity:0,y:25,duration:.7},'-=.55')
    .from('.hero-buttons .button,.hero-proof span',{opacity:0,y:20,stagger:.08,duration:.55},'-=.45')
    .from('.hero-specimen',{opacity:0,x:65,rotation:12,duration:.9},'-=.75');
   gsap.to('.hero-media',{scale:1.16,yPercent:10,ease:'none',scrollTrigger:{trigger:'.hero',start:'top top',end:'bottom top',scrub:1}});
   gsap.to('.hero-content',{yPercent:22,opacity:.2,ease:'none',scrollTrigger:{trigger:'.hero',start:'35% top',end:'bottom top',scrub:1}});
  }

  gsap.utils.toArray('.section-head,.page-hero>*,.reef-depth-copy>*').forEach(block=>{
   gsap.from(block,{y:32,duration:.65,ease:'power3.out',immediateRender:false,scrollTrigger:{trigger:block,start:'top 92%',once:true}});
  });
  gsap.utils.toArray('.category-grid,.product-grid,.guide-grid,.work-grid,.service-grid,.service-process,.review-grid,.article-grid').forEach(grid=>{
   const children=Array.from(grid.children);
   gsap.from(children,{y:34,rotationX:-5,stagger:.045,duration:.58,ease:'power3.out',immediateRender:false,scrollTrigger:{trigger:grid,start:'top 92%',once:true}});
  });
  gsap.utils.toArray('.category-card img,.service-feature>img,.about-images>img,.article-card>img').forEach(image=>{
   gsap.fromTo(image,{yPercent:-6,scale:1.08},{yPercent:6,scale:1.02,ease:'none',scrollTrigger:{trigger:image.parentElement,start:'top bottom',end:'bottom top',scrub:.8}});
  });
  if($('.collector-art'))gsap.fromTo('.collector-art',{rotationY:-9,rotationX:4,y:60},{rotationY:6,rotationX:-2,y:-30,ease:'none',scrollTrigger:{trigger:'.collector',start:'top bottom',end:'bottom top',scrub:1}});
  if($('.vitals-console'))gsap.from('.vitals-console',{scale:.96,rotationY:-5,duration:.7,ease:'power3.out',immediateRender:false,scrollTrigger:{trigger:'.vitals-console',start:'top 92%',once:true}});

  ScrollTrigger.matchMedia({
   '(min-width: 901px)':()=>{
    if(!$('.reef-depth-story'))return;
    gsap.set('.reef-plane-top',{z:80,y:-105,rotationX:55,scale:.82});
    gsap.set('.reef-plane-middle',{z:0,y:5,rotationX:55,scale:.82});
    gsap.set('.reef-plane-bottom',{z:-80,y:115,rotationX:55,scale:.82});
    const reefTimeline=gsap.timeline({scrollTrigger:{trigger:'.reef-depth-story',start:'top 76px',end:'+=2100',pin:true,scrub:1,anticipatePin:1,onUpdate:self=>setActiveReefZone(Math.min(2,Math.floor(self.progress*3)))}});
    reefTimeline
     .to('.reef-plane-top',{z:230,y:-55,rotationX:8,scale:1.02,duration:1})
     .to('.reef-plane-top',{z:40,y:-205,opacity:.22,rotationX:68,scale:.72,duration:1})
     .to('.reef-plane-middle',{z:230,y:0,rotationX:8,scale:1.02,duration:1},'<')
     .to('.reef-plane-middle',{z:35,y:-190,opacity:.22,rotationX:68,scale:.72,duration:1})
     .to('.reef-plane-bottom',{z:230,y:45,rotationX:8,scale:1.02,duration:1},'<')
     .to('.reef-glow',{scale:1.35,opacity:.9,duration:2},0);
   },
   '(max-width: 900px)':()=>{
    gsap.utils.toArray('.reef-plane').forEach((plane,index)=>gsap.from(plane,{x:index%2?28:-28,rotationY:index%2?-6:6,duration:.62,immediateRender:false,scrollTrigger:{trigger:plane,start:'top 92%',once:true}}));
   }
  });

  $$('.category-card,.service-feature,.guide-card,.collector-art,.vitals-console').forEach(enableTilt);
  const scrollMeter=document.createElement('div');
  scrollMeter.className='scroll-meter';
  scrollMeter.setAttribute('aria-hidden','true');
  scrollMeter.innerHTML='<span></span>';
  document.body.append(scrollMeter);
  ScrollTrigger.create({start:0,end:'max',onUpdate:self=>scrollMeter.style.setProperty('--scroll-progress',self.progress)});

  if(matchMedia('(hover:hover) and (pointer:fine)').matches){
   const pointerGlow=document.createElement('i');
   pointerGlow.className='pointer-glow';
   pointerGlow.setAttribute('aria-hidden','true');
   document.body.append(pointerGlow);
   const moveX=gsap.quickTo(pointerGlow,'x',{duration:.35,ease:'power3.out'});
   const moveY=gsap.quickTo(pointerGlow,'y',{duration:.35,ease:'power3.out'});
   window.addEventListener('pointermove',event=>{moveX(event.clientX);moveY(event.clientY)} ,{passive:true});
  }
 });
 requestAnimationFrame(()=>ScrollTrigger.refresh());
}

function alignHomepageWithReference(){
 if(document.body.dataset.page!=='home'||document.body.dataset.referenceLayout==='true')return;
 document.body.dataset.referenceLayout='true';
 const categories=$('.categories');
 if(categories){
  const paths=document.createElement('section');
  paths.className='section ref-paths';
  paths.setAttribute('aria-labelledby','ref-paths-title');
  paths.innerHTML=`<div class="section-head reveal"><div><p class="eyebrow">START WHERE YOU ARE</p><h2 id="ref-paths-title">What brings you<br>to the <em>Cavern?</em></h2></div><p>Choose the path that sounds most like your tank today. Each one leads to the livestock, planning or hands-on care that fits next.</p></div><div class="ref-path-grid"><a href="/shop/"><span data-icon="bag" aria-hidden="true"></span><small>SHOPPING FOR LIVESTOCK</small><h3>Find the right animal.</h3><p>Corals, fish and cleanup crew photographed with the detail you need to choose confidently.</p><b>Browse the tanks <span data-icon="arrow-right" aria-hidden="true"></span></b></a><a href="/services/#design"><span data-icon="star" aria-hidden="true"></span><small>PLANNING A NEW TANK</small><h3>Build it around real life.</h3><p>Design, equipment and livestock planning sized to your room, routine and budget.</p><b>Plan a tank <span data-icon="arrow-right" aria-hidden="true"></span></b></a><a href="/services/#maintenance"><span data-icon="shield" aria-hidden="true"></span><small>KEEPING A TANK BEAUTIFUL</small><h3>Protect the balance.</h3><p>Scheduled cleaning, testing and equipment care for established home and business systems.</p><b>Book maintenance <span data-icon="arrow-right" aria-hidden="true"></span></b></a><a href="/services/#ponds"><span data-icon="circle-fill" aria-hidden="true"></span><small>CARING FOR A POND</small><h3>Follow the season.</h3><p>Cleanouts, filtration, water quality and koi care shaped around Oregon weather.</p><b>See pond care <span data-icon="arrow-right" aria-hidden="true"></span></b></a></div>`;
  categories.before(paths);
  const eyebrow=$('.section-head .eyebrow',categories);
  const title=$('.section-head h2',categories);
  const intro=$('.section-head>p',categories);
  if(eyebrow)eyebrow.textContent='SHOP';
  if(title)title.innerHTML='In the tanks <em>now.</em>';
  if(intro)intro.textContent='We photograph livestock under reef lighting so you can study the color, shape and character before confirming the exact animal.';
  const categoryGrid=$('.category-grid',categories);
  if(categoryGrid&&!categoryGrid.querySelector('[href*="frags"]'))categoryGrid.children[0]?.insertAdjacentHTML('afterend','<a href="/shop/?category=frags" class="category-card reveal"><img src="/assets/goni-garden.webp" alt="Aquacultured coral frags on a reef rack" loading="lazy" decoding="async"><div><small>AQUACULTURED STARTS</small><h3>Frags<span><span data-icon="arrow-up-right" aria-hidden="true"></span></span></h3><p>Tank-grown starts that bring serious color to a reef while leaving room to grow.</p></div></a>');
 }
 const featured=$('.featured');
 if(featured){
  const eyebrow=$('.section-head .eyebrow',featured);
  const title=$('.section-head h2',featured);
  const intro=$('.section-head>p',featured);
  if(eyebrow)eyebrow.textContent='AVAILABLE LIVESTOCK';
  if(title)title.innerHTML='Photographed here.<br><em>Chosen by you.</em>';
  if(intro)intro.textContent='The photograph, care profile and price stay together, so comparison feels clear instead of crowded.';
  const grid=$('.product-grid',featured);
  const extraIds=['skunk-shrimp','turban-snail','daisy-coral','cynaria-ultra'];
  if(grid)extraIds.forEach(id=>{if(!grid.querySelector(`[href*="id=${id}"]`)){const product=products.find(item=>item.id===id);if(product)grid.insertAdjacentHTML('beforeend',card(product));}});
 }
 const collector=$('.collector');
 if(collector&&!$('.collector-bento',collector)){
  $('.collector-art',collector)?.remove();
  const bento=document.createElement('div');
  bento.className='collector-bento reveal';
  const pieces=[
   ['acantho-red','Acanthophyllia · one of one','A rare tri-color mouth on a blazing red body.'],
   ['acanthophyllia','Acanthophyllia · showpiece','Swirled red and green with the presence to anchor an aquascape.'],
   ['red-elegance','Elegance coral · WYSIWYG','A vivid red mouth surrounded by long yellow-tipped movement.'],
   ['goni-purple','Goniopora · aquacultured frag','Purple polyps and a bright yellow rim that comes alive in gentle flow.']
  ];
  bento.innerHTML=pieces.map(([id,label,description],index)=>{const product=products.find(item=>item.id===id);if(!product||!product.image)return'';return `<article class="collector-piece${index===0?' is-featured':''}"><a class="collector-piece-media" href="/product/?id=${product.id}"><img src="${product.image}" alt="${escapeHTML(product.name)} collector coral" loading="lazy" decoding="async"><span>${escapeHTML(label)}</span></a><div class="collector-piece-info"><div><small>${escapeHTML(label)}</small><h3><a href="/product/?id=${product.id}">${escapeHTML(product.name)}</a></h3><p>${escapeHTML(description)}</p></div><div><strong>${money(product.price)}</strong><button data-add="${product.id}" aria-label="Add ${escapeHTML(product.name)} to preview cart"><span data-icon="plus" aria-hidden="true"></span> Add</button></div></div></article>`}).join('');
  collector.append(bento);
 }
 const about=$('.about-split');
 if(about&&!$('.pond-seasons')){
  const pond=document.createElement('section');
  pond.className='section pond-seasons';
  pond.id='ponds';
  pond.innerHTML=`<div class="pond-copy reveal"><p class="eyebrow">NEW · POND MAINTENANCE</p><h2>Ponds,<br><em>too.</em></h2><p>Koi ponds and water features need the same steady attention as a reef. We clean, balance and care for ponds around Salem, season by season.</p><a class="button" href="/services/#quote">Book pond care <span data-icon="arrow-right" aria-hidden="true"></span></a></div><div class="season-grid"><article><small>SPRING</small><h3>Open up.</h3><p>Clear winter debris, restart pumps and filters, and test the water before regular feeding resumes.</p></article><article><small>SUMMER</small><h3>Keep it clear.</h3><p>Manage algae, rinse filters and protect oxygen levels through the warmest days.</p></article><article><small>FALL</small><h3>Net and trim.</h3><p>Catch falling leaves, cut back plants and ease feeding as the water cools.</p></article><article><small>WINTER</small><h3>Rest easy.</h3><p>Check aeration and pumps while the koi slow down through the wet months.</p></article></div>`;
  about.before(pond);
 }
}

alignHomepageWithReference();
buildReefDepthStory();
enhanceProductCards();
$$('.product-grid').forEach(grid=>new MutationObserver(()=>enhanceProductCards(grid)).observe(grid,{childList:true}));
document.addEventListener('click',event=>{
 if(!event.target.closest('[data-vital]')||motionReduced||!window.gsap)return;
 gsap.fromTo('#vital-value',{opacity:0,y:14,scale:.96},{opacity:1,y:0,scale:1,duration:.55,ease:'back.out(1.8)'});
});
if(document.readyState==='complete')initGsapExperience();else window.addEventListener('load',initGsapExperience,{once:true});
