(function () {
  'use strict';
  var D=window.PERFUME_DATA||[], E=window.ScentRecommendation, $=function(id){return document.getElementById(id);};
  var initialized=false, openName=null, lastFocus=null, swap=0, choices=[], weather=null, weatherEpoch=0, toastTimer;
  var COORDS={'上海':[31.2304,121.4737],'北京':[39.9042,116.4074],'广州':[23.1291,113.2644],'深圳':[22.5431,114.0579],'杭州':[30.2741,120.1551],'成都':[30.5728,104.0668],'重庆':[29.563,106.5516],'武汉':[30.5928,114.3055],'南京':[32.0603,118.7969],'苏州':[31.2989,120.5853],'西安':[34.3416,108.9398],'长沙':[28.2282,112.9388],'青岛':[36.0671,120.3826],'厦门':[24.4798,118.0894]};
  function read(key,def){try{var v=JSON.parse(localStorage.getItem(key));return v==null?def:v;}catch(e){return def;}}
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(e){toast('无法保存，请检查浏览器存储权限');return false;}}
  function array(v){return Array.isArray(v)?v:[];}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function localDay(date){date=date||new Date();return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
  function season(){var m=new Date().getMonth()+1;return m>=3&&m<=5?'春':m>=6&&m<=8?'夏':m>=9&&m<=11?'秋':'冬';}
  function byName(n){return D.find(function(p){return p.n===n||array(p.aliases).indexOf(n)>=0;});}
  function canonicalName(n){var p=byName(n);return p?p.n:n;}
  function savedRow(r){return r&&typeof r==='object'?Object.assign({},r,{n:canonicalName(r.n)}):r;}
  function shortName(p){var n=p.n;if(n.indexOf(p.b+' ')===0)n=n.slice(p.b.length+1);return n.replace(/\s+(PARFUM|Parfum|EDP|EDT|EDC)$/,'');}
  function picture(p,cls){return p.ph?'<img class="bottle-pic '+(cls||'')+'" src="'+esc(p.ph+(p.imageVersion?'?v='+encodeURIComponent(p.imageVersion):''))+'" alt="'+esc(p.n)+'" loading="'+(cls==='primary-picture'?'eager':'lazy')+'">':'<span class="image-missing">暂无瓶图</span>';}
  function pyramid(p){var layers=[['前调','top'],['中调','heart'],['后调','base']].filter(function(a){return p[a[1]];}).map(function(a){return '<div class="note-row"><span class="note-key">'+a[0]+'</span><span>'+esc(p[a[1]])+'</span></div>';}).join('');return layers||(p.notes?'<div class="note-row"><span class="note-key">香气</span><span>'+esc(p.notes)+'</span></div>':'');}
  var favs=Array.from(new Set(array(read('chx_favs',[])).map(canonicalName))), wears=array(read('chx_wears_v1',[])).filter(function(r){return r&&r.confirmed===true;}).map(savedRow);
  var legacy=array(read('chx_history',[])).map(savedRow), plan=read('chx_plan_v1',{}), city=read('chx_city','上海');
  var locationWanted=read('chx_location_mode_v3','auto')==='auto',locationUnavailable=false,locationPoint=null,locationEpoch=0,locationTask=null;
  if(!plan||Array.isArray(plan)||typeof plan!=='object')plan={};
  Object.keys(plan).forEach(function(key){if(typeof plan[key]==='string')plan[key]=canonicalName(plan[key]);});
  var scene='', manual='', pickState={}, shelf={q:'',family:'',season:'',price:'',all:true};
  var groups=[
    {id:'pick-temp',key:'t',options:['25℃+','18-25℃','10-18℃','10℃以下']},
    {id:'pick-scene',key:'sc',options:['通勤办公','商务会议','面试','约会','姐妹下午茶','晚宴酒会','见家长','日常出街','居家独处','旅行出游']},
    {id:'pick-time',key:'d',options:['日间','夜间']},
    {id:'pick-style',key:'st',options:['甜暖','清冷','知性','御姐','中性','氛围感']},
    {id:'pick-mood',key:'m',options:['想要气场','想被拥抱','想放松','想清醒','想被记住']},
    {id:'pick-dress',key:'o',options:['米色系大衣','黑色系穿搭','毛衣针织','连衣裙','西装','卫衣休闲']}
  ];
  groups.forEach(function(g){pickState[g.id]=[];});
  function toast(msg){$('toast').textContent=msg;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){$('toast').classList.remove('show');},1800);}
  function context(extra){var c={temperature:manual?null:(weather?weather.temperature:null),temperatureBuckets:manual?[manual]:[],humidity:manual?null:(weather?weather.humidity:null),season:season(),scenes:scene?[scene]:[],date:localDay()};return Object.assign(c,extra||{});}
  function current(){return choices.length?choices[swap%choices.length].b:null;}
  function homeScenes(p){return array(p.homeScenes).length?array(p.homeScenes).slice(0,2):array(p.sc).slice(0,2);}
  function sceneLabels(p){return homeScenes(p).map(function(s){return '<span class="home-scene" data-home-scene>'+esc(s)+'</span>';}).join('');}
  function wornToday(n){return wears.some(function(r){return r.n===n&&r.d===localDay();});}
  function renderDaily(reset){
    if(reset)swap=0;
    var featured=window.SCENT_DAILY_FEATURE;
    choices=featured&&featured.mode==='locked'&&!scene&&!manual?array(featured.order).map(function(n){return byName(n);}).filter(Boolean).map(function(b){return {b:b};}):E.select(E.rank(D,context()),3);
    var p=current(), others=choices.filter(function(r){return !p||r.b.n!==p.n;});
    $('daily-card').hidden=!p;$('daily-empty').hidden=!!p;
    $('other-section').hidden=!others.length;
    if(p){
      $('daily-card').dataset.name=p.n;$('daily-name').textContent=shortName(p);$('daily-brand').textContent=p.b;
      $('daily-vis').innerHTML=picture(p,'primary-picture');$('daily-family').textContent=p.f||'';$('daily-pyramid').innerHTML=pyramid(p);$('daily-scenes').innerHTML=sceneLabels(p);
      $('btn-wear').textContent=wornToday(p.n)?'今天已穿':'今天穿它';$('btn-wear').disabled=wornToday(p.n);
      $('btn-swap').disabled=choices.length<2;
    }
    $('other-list').innerHTML=others.map(function(r){var b=r.b;return '<button class="other-card" type="button" data-open="'+esc(b.n)+'">'+picture(b)+'<span class="other-copy"><span class="other-name">'+esc(shortName(b))+'</span><span>'+esc(b.b)+'</span><span>'+esc(b.f)+'</span><span class="home-scenes" aria-label="适用场景">'+sceneLabels(b)+'</span></span></button>';}).join('');
    var notice='';
    if(p&&choices.length<3)notice='当前场合只找到 '+choices.length+' 个品牌，可以选择不限场合。';
    if(p&&choices.some(function(r){return r.temperatureMatch===false;}))notice='当前场合的适温选择较少，可调整场合或查看完整香卡。';
    $('daily-notice').textContent=notice;$('daily-notice').hidden=!notice;
  }
  function confirmWear(n){
    if(!byName(n)||wornToday(n))return;
    var r={id:localDay()+'|'+n,n:n,d:localDay(),at:new Date().toISOString(),confirmed:true,scene:scene};
    var next=[r].concat(wears);
    if(!write('chx_wears_v1',next))return;
    wears=next;renderDaily();renderMe();if(openName)updateDetailActions();toast('已记录今天穿香');
  }
  function undoWear(id){var next=wears.filter(function(r){return r.id!==id;});if(write('chx_wears_v1',next)){wears=next;renderDaily();renderMe();if(openName)updateDetailActions();toast('已撤销穿香记录');}}
  function favoriteButton(n){return '<button class="text-button favorite-button" type="button" data-fav="'+esc(n)+'" aria-pressed="'+(favs.indexOf(n)>=0)+'">'+(favs.indexOf(n)>=0?'已收藏':'收藏')+'</button>';}
  function toggleFav(n){var next=favs.indexOf(n)>=0?favs.filter(function(v){return v!==n;}):favs.concat(n);if(write('chx_favs',next)){favs=next;renderShelf();renderMe();if(openName)updateDetailActions();toast(favs.indexOf(n)>=0?'已收藏':'已取消收藏');}}
  function updateDetailActions(){$('s-fav').textContent=favs.indexOf(openName)>=0?'已收藏 · 取消收藏':'收藏这瓶香';$('s-wear').disabled=wornToday(openName);$('s-wear').textContent=wornToday(openName)?'今天已穿':'今天穿它';}
  function openDetail(n){
    var p=byName(n);if(!p)return;
    openName=n;lastFocus=document.activeElement;
    $('s-name').textContent=p.n;$('s-vis').innerHTML=picture(p);$('s-brand').textContent=[p.b,p.f,p.c].filter(Boolean).join(' · ');$('s-mem').textContent=p.mem||'';$('s-pyramid').innerHTML=pyramid(p);
    var tags=[].concat(array(p.sc),array(p.s).map(function(s){return s+'季';}),array(p.t),array(p.o),array(p.m),p.sw?['甜度 '+p.sw]:[],p.x?['扩香 '+p.x]:[],p.h?['湿度适配 '+p.h]:[],array(p.a).map(function(a){return '留意 '+a;}));
    $('s-chips').innerHTML=tags.map(function(t){return '<span class="tag">'+esc(t)+'</span>';}).join('');
    [['s-en','en'],['s-year','y'],['s-price','p'],['s-src','src'],['s-avail','avail']].forEach(function(a){$(a[0]).textContent=p[a[1]]||'—';});
    updateDetailActions();$('sheet').hidden=false;$('sheet-mask').hidden=false;$('sheet').classList.add('show');$('sheet-mask').classList.add('show');document.body.classList.add('modal-open');$('sheet-close').focus();
  }
  function closeDetail(){openName=null;$('sheet').classList.remove('show');$('sheet-mask').classList.remove('show');$('sheet').hidden=true;$('sheet-mask').hidden=true;document.body.classList.remove('modal-open');if(lastFocus&&lastFocus.isConnected)lastFocus.focus();}
  function shelfRow(p){return '<div class="shelf-item"><button class="shelf-open" type="button" data-open="'+esc(p.n)+'"><span class="bottle-vis md">'+picture(p)+'</span><span class="sf-mid"><span class="sf-name">'+esc(shortName(p))+'</span><span class="sf-brand">'+esc(p.b+' · '+p.f)+'</span></span></button>'+favoriteButton(p.n)+'</div>';}
  function unique(key){return Array.from(new Set(D.flatMap(function(p){return Array.isArray(p[key])?p[key]:[p[key]];}).filter(Boolean)));}
  function renderShelfFilters(){
    $('shelf-filters').innerHTML=unique('f').map(function(v){return '<button class="chip '+(shelf.family===v?'on':'')+'" type="button" data-filter="family" data-value="'+esc(v)+'">'+esc(v)+'</button>';}).join('');
    $('shelf-filters2').innerHTML=['season','price'].map(function(key){return unique(key==='season'?'s':'p').map(function(v){return '<button class="chip '+(shelf[key]===v?'on':'')+'" type="button" data-filter="'+key+'" data-value="'+esc(v)+'">'+esc(v)+'</button>';}).join('');}).join('');
  }
  function renderShelf(){
    var list=D.filter(function(p){return (shelf.all||p.avail==='在售')&&(!shelf.family||shelf.family===p.f)&&(!shelf.season||array(p.s).indexOf(shelf.season)>=0)&&(!shelf.price||p.p===shelf.price)&&(!shelf.q||[p.n,p.b,p.mem].join(' ').toLowerCase().indexOf(shelf.q.toLowerCase())>=0);});
    $('shelf-list').innerHTML=list.length?list.map(shelfRow).join(''):'<div class="empty-tip">没有匹配的香，可以清空搜索或调整筛选。</div>';
  }
  function renderMe(){
    $('fav-count').textContent=favs.length?'('+favs.length+')':'';
    $('fav-list').innerHTML=favs.map(byName).filter(Boolean).map(shelfRow).join('')||'<div class="empty-tip">还没有收藏，打开香卡可以收藏。</div>';
    $('hist-list').innerHTML=wears.map(function(r){return '<div class="history-row"><button class="text-button" type="button" data-open="'+esc(r.n)+'">'+esc(r.n)+'<small>'+esc(r.d+(r.scene?' · '+r.scene:''))+'</small></button><button class="text-button" type="button" data-undo-wear="'+esc(r.id)+'">撤销</button></div>';}).join('')||'<div class="empty-tip">还没有穿香记录，选定后点“今天穿它”。</div>';
    $('legacy-history').hidden=!legacy.length;
    $('legacy-list').innerHTML=legacy.map(function(r){return '<p class="legacy-row">'+esc(r.d)+' · '+esc(r.n)+'</p>';}).join('');
    $('me-meta').textContent='资料快照：'+((window.PERFUME_META||{}).snap||'未标注')+'。收藏、计划和日记保存在当前浏览器；绝版香仍可参与个人穿香。';
  }
  function renderPickChips(){groups.forEach(function(g){$(g.id).innerHTML=g.options.map(function(v){return '<button class="chip '+(pickState[g.id].indexOf(v)>=0?'on':'')+'" data-g="'+g.id+'" data-o="'+esc(v)+'" type="button">'+esc(v)+'</button>';}).join('');});}
  function runPick(){
    var selected=D.filter(function(p){return groups.filter(function(g){return ['pick-temp','pick-scene'].indexOf(g.id)<0&&pickState[g.id].length;}).every(function(g){return pickState[g.id].some(function(v){return array(p[g.key]).indexOf(v)>=0;});});});
    var c=context({scenes:pickState['pick-scene'].length?pickState['pick-scene']:(scene?[scene]:[])});
    if(pickState['pick-temp'].length){c.temperature=null;c.temperatureBuckets=pickState['pick-temp'];c.humidity=null;}
    var picks=E.select(E.rank(selected,c),3);
    $('pick-result').innerHTML=picks.length?picks.map(function(r){return '<article class="res-card"><div class="result-heading"><span class="bottle-vis md">'+picture(r.b)+'</span><div><h2 class="res-name">'+esc(shortName(r.b))+'</h2><p class="res-brand">'+esc(r.b.b+' · '+r.b.f)+'</p></div></div><div class="s-pyramid">'+pyramid(r.b)+'</div><div class="res-actions"><button class="btn btn-solid" type="button" data-open="'+esc(r.b.n)+'">完整香卡</button>'+favoriteButton(r.b.n)+'</div></article>';}).join(''):'<div class="empty-tip">没有香水同时符合这些条件，可以减少条件或改为不限场合。</div>';
  }
  function weatherText(prefix){
    if($('wx-meta'))$('wx-meta').textContent=weather?(locationUnavailable?'城市参考 · ':'')+(weather.source||'缓存')+' · '+(weather.dataTime?'数据时间 '+weather.dataTime:'获取于 '+new Date(weather.observedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}))+(weather.source==='Open-Meteo'?' · 室外气象模型参考':' · 备用天气参考'):'';
    if(manual){$('wx-info').textContent='手动 '+manual+' · '+season()+'季';return;}
    if(locationUnavailable){$('wx-info').textContent=(weather?Math.round(weather.temperature)+'℃ · ':'')+'未定位 · 湿度待获取';return;}
    $('wx-info').textContent=weather?(prefix||'')+Math.round(weather.temperature)+'℃'+(weather.humidity==null?'':' · 室外湿度 '+Math.round(weather.humidity)+'%')+' · '+season()+'季':'天气未更新，可手动设温度';
  }
  function clearWeather(){weather=null;renderDaily(true);}
  function weatherLocationKey(){return locationPoint?'geo:'+locationPoint.join(','):city;}
  function recentWeather(value,requestCity,key){return value&&value.city===requestCity&&(value.locationKey||value.city)===(key||weatherLocationKey())&&typeof value.temperature==='number'&&Number.isFinite(value.temperature)&&typeof value.observedAt==='number'&&Date.now()-value.observedAt>=0&&Date.now()-value.observedAt<2*60*60*1000;}
  async function weatherJson(url){
    var controller=typeof AbortController!=='undefined'?new AbortController():null,timer;
    try{return await Promise.race([
      (async function(){var r=await fetch(url,controller?{signal:controller.signal}:{});if(!r.ok)throw Error('weather-http');return r.json();})(),
      new Promise(function(resolve,reject){timer=setTimeout(function(){reject(Error('weather-timeout'));if(controller)controller.abort();},5000);})
    ]);}finally{clearTimeout(timer);}
  }
  async function fetchWeather(){
    var epoch=++weatherEpoch, requestPoint=locationPoint?locationPoint.slice():null,requestCity=requestPoint?'当前位置':city,key=weatherLocationKey();
    var previous=recentWeather(weather,requestCity,key)?weather:read('chx_weather_v2',null);
    if(recentWeather(previous,requestCity,key)){weather=Object.assign({},previous,{humidity:typeof previous.humidity==='number'&&Number.isFinite(previous.humidity)&&previous.humidity>=0&&previous.humidity<=100?previous.humidity:null});weatherText('刷新中 · ');}
    else{clearWeather();$('wx-info').textContent='正在读取天气…';}
    try{
      var coord=requestPoint||COORDS[requestCity];
      if(!coord){var gj=await weatherJson('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(requestCity)+'&count=1&language=zh&format=json');if(!gj.results||!gj.results.length)throw Error('city');coord=[gj.results[0].latitude,gj.results[0].longitude];}
      var temperature,humidity,dataTime='',source='Open-Meteo';
      try{
        var json=await weatherJson('https://api.open-meteo.com/v1/forecast?latitude='+coord[0]+'&longitude='+coord[1]+'&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto'),w=json.current;
        if(!w||typeof w.temperature_2m!=='number'||!Number.isFinite(w.temperature_2m)||w.temperature_2m< -90||w.temperature_2m>65)throw Error('temperature');
        temperature=w.temperature_2m;humidity=typeof w.relative_humidity_2m==='number'&&Number.isFinite(w.relative_humidity_2m)&&w.relative_humidity_2m>=0&&w.relative_humidity_2m<=100?w.relative_humidity_2m:null;
        dataTime=typeof w.time==='string'?w.time.replace('T',' '):'';
      }catch(primaryError){
        if(epoch!==weatherEpoch)return;
        var backup=await weatherJson('https://wttr.in/'+coord[0]+','+coord[1]+'?format=j1'),b=backup.current_condition&&backup.current_condition[0];
        if(!b||b.temp_C==null||String(b.temp_C).trim()==='')throw Error('temperature');
        temperature=Number(b.temp_C);if(!Number.isFinite(temperature)||temperature< -90||temperature>65)throw Error('temperature');
        humidity=b.humidity!=null&&String(b.humidity).trim()!==''?Number(b.humidity):null;if(!Number.isFinite(humidity)||humidity<0||humidity>100)humidity=null;source='wttr.in';
        dataTime=typeof b.observation_time==='string'?b.observation_time+' UTC':'';
      }
      if(epoch!==weatherEpoch)return;
      weather={temperature:temperature,humidity:humidity,city:requestCity,locationKey:key,observedAt:Date.now(),source:source,dataTime:dataTime};
      write('chx_weather_v2',weather);weatherText(source==='wttr.in'?'备用天气 · ':'');renderDaily(true);
    }catch(e){
      if(epoch!==weatherEpoch)return;
      var cache=read('chx_weather_v2',null);
      if(recentWeather(cache,requestCity,key)){weather=Object.assign({},cache,{humidity:typeof cache.humidity==='number'&&Number.isFinite(cache.humidity)&&cache.humidity>=0&&cache.humidity<=100?cache.humidity:null});weatherText('缓存天气 · ');}
      else {weather=null;weatherText();}
      renderDaily(true);
    }
  }
  function requestWeather(){return locationWanted?useLocation():fetchWeather();}
  function refreshWeatherIfNeeded(){if(locationTask)return;var label=locationPoint?'当前位置':city;if(!manual&&(!recentWeather(weather,label)||Date.now()-weather.observedAt>=15*60*1000||localDay(new Date(weather.observedAt))!==localDay()))requestWeather();}
  function useLocation(){
    if(locationTask)return locationTask;
    var epoch=++locationEpoch;++weatherEpoch;locationUnavailable=false;write('chx_location_mode_v3','auto');$('wx-locate').disabled=true;$('wx-location-status').textContent='正在获取当前位置…';$('wx-info').textContent='正在获取当前位置…';
    locationTask=Promise.resolve().then(function(){return new Promise(function(resolve){
      var settled=false,timer;
      function failed(error){if(settled)return;settled=true;clearTimeout(timer);if(epoch!==locationEpoch){resolve(false);return;}locationTask=null;locationPoint=null;locationWanted=false;locationUnavailable=true;write('chx_location_enabled',false);$('wx-locate').disabled=false;$('wx-city').textContent=city;$('wx-location-status').textContent=(error&&error.code===1?'定位未授权':'暂时无法定位')+'，温度暂用'+city+'参考；取得定位前不显示附近湿度。';toast('请允许此网站使用位置，才能获取附近湿度');fetchWeather();resolve(false);}
      if(epoch!==locationEpoch){resolve(false);return;}
      if(!navigator.geolocation||window.isSecureContext===false){failed();return;}
      timer=setTimeout(function(){failed({code:3});},10000);
      try{navigator.geolocation.getCurrentPosition(function(position){
        if(settled)return;var c=position&&position.coords;if(!c||!Number.isFinite(c.latitude)||!Number.isFinite(c.longitude)||Math.abs(c.latitude)>90||Math.abs(c.longitude)>180){failed();return;}
        settled=true;clearTimeout(timer);if(epoch!==locationEpoch){resolve(false);return;}
        locationTask=null;locationPoint=[Math.round(c.latitude*100)/100,Math.round(c.longitude*100)/100];locationWanted=true;locationUnavailable=false;write('chx_location_enabled',true);write('chx_location_mode_v3','auto');manual='';$('manual-temp').value='';$('wx-locate').disabled=false;$('wx-city').textContent='当前位置';$('wx-location-status').textContent='已使用当前位置附近的天气。';$('wx-panel').hidden=true;$('wx-city').setAttribute('aria-expanded','false');fetchWeather();resolve(true);
      },failed,{enableHighAccuracy:false,timeout:10000,maximumAge:60000});}catch(e){failed();}
    });});
    return locationTask;
  }
  function setCity(value){value=String(value||'').trim();if(!value)return;++locationEpoch;locationTask=null;locationPoint=null;locationWanted=false;locationUnavailable=false;write('chx_location_enabled',false);write('chx_location_mode_v3','city');$('wx-locate').disabled=false;$('wx-location-status').textContent='';city=value;write('chx_city',city);$('wx-city').textContent=city;$('wx-panel').hidden=true;$('wx-city').setAttribute('aria-expanded','false');manual='';$('manual-temp').value='';swap=0;fetchWeather();}
  function openPlan(){
    var options='<option value="">暂不安排</option>'+D.map(function(p){return '<option value="'+esc(p.n)+'">'+esc(p.n)+'</option>';}).join('');
    $('plan-grid').innerHTML=Array.from({length:7},function(_,i){var day=new Date();day.setHours(12,0,0,0);day.setDate(day.getDate()+i);var key=localDay(day);return '<fieldset class="plan-day"><legend>'+esc(key)+'</legend>'+[['day','日间'],['night','夜间']].map(function(a){return '<label>'+a[1]+'<select data-plan="'+key+'|'+a[0]+'">'+options+'</select></label>';}).join('')+'</fieldset>';}).join('');
    $('plan-grid').querySelectorAll('select').forEach(function(el){el.value=plan[el.dataset.plan]||'';});
    if(typeof $('plan-dialog').showModal==='function')$('plan-dialog').showModal();else $('plan-dialog').setAttribute('open','');
  }
  function closePlan(){if(typeof $('plan-dialog').close==='function')$('plan-dialog').close();else $('plan-dialog').removeAttribute('open');$('btn-plan').focus();}
  function switchView(view){document.querySelectorAll('.view').forEach(function(el){el.classList.toggle('active',el.id==='view-'+view);});document.querySelectorAll('.tab').forEach(function(el){el.classList.toggle('active',el.dataset.view===view);el.setAttribute('aria-current',el.dataset.view===view?'page':'false');});if(view==='shelf')renderShelf();if(view==='me')renderMe();}
  function click(event){
    var b=event.target.closest('button');
    if(event.target===$('sheet-mask')){closeDetail();return;}
    if(!b)return;
    if(b.dataset.fav){toggleFav(b.dataset.fav);return;}
    if(b.dataset.undoWear){undoWear(b.dataset.undoWear);return;}
    if(b.dataset.open){openDetail(b.dataset.open);return;}
    if(b.dataset.view){switchView(b.dataset.view);return;}
    if(b.dataset.city){setCity(b.dataset.city);return;}
    if(b.dataset.g){var g=b.dataset.g, v=b.dataset.o, values=pickState[g];pickState[g]=values.indexOf(v)>=0?values.filter(function(x){return x!==v;}):values.concat(v);renderPickChips();return;}
    if(b.dataset.filter){var k=b.dataset.filter;shelf[k]=shelf[k]===b.dataset.value?'':b.dataset.value;renderShelfFilters();renderShelf();return;}
    switch(b.id){
      case 'btn-swap':if(choices.length){swap=(swap+1)%choices.length;renderDaily();}break;
      case 'btn-wear':if(current())confirmWear(current().n);break;
      case 'btn-detail-daily':if(current())openDetail(current().n);break;
      case 's-wear':if(openName)confirmWear(openName);break;
      case 's-fav':if(openName)toggleFav(openName);break;
      case 'sheet-close':closeDetail();break;
      case 'btn-plan':openPlan();break;
      case 'plan-close':closePlan();break;
      case 'btn-pick':runPick();break;
      case 'wx-city':$('wx-panel').hidden=!$('wx-panel').hidden;b.setAttribute('aria-expanded',String(!$('wx-panel').hidden));break;
      case 'wx-refresh':manual='';$('manual-temp').value='';requestWeather();break;
      case 'wx-locate':useLocation();break;
      case 'wx-apply':setCity($('wx-input').value);break;
      case 'tog-all':case 'tog-sale':shelf.all=b.id==='tog-all';$('tog-all').classList.toggle('on',shelf.all);$('tog-sale').classList.toggle('on',!shelf.all);renderShelf();break;
    }
  }
  function init(){
    if(initialized)return;initialized=true;
    var scenes=unique('sc');$('daily-scene').innerHTML='<option value="">不限场合</option>'+scenes.map(function(s){return '<option>'+esc(s)+'</option>';}).join('');
    $('wx-city').textContent=city;$('wx-cities').innerHTML=Object.keys(COORDS).map(function(c){return '<button class="chip" type="button" data-city="'+esc(c)+'">'+esc(c)+'</button>';}).join('');
    renderPickChips();renderShelfFilters();renderShelf();renderMe();renderDaily(true);
    document.addEventListener('click',click);
    document.addEventListener('input',function(e){if(e.target.id==='shelf-search'){shelf.q=e.target.value.trim();renderShelf();}});
    document.addEventListener('change',function(e){var t=e.target;if(t.id==='daily-scene'){scene=t.value;renderDaily(true);}if(t.id==='manual-temp'){manual=t.value;if(manual){++weatherEpoch;weather=null;weatherText();renderDaily(true);}else fetchWeather();}if(t.dataset.plan){var next=Object.assign({},plan);if(t.value)next[t.dataset.plan]=t.value;else delete next[t.dataset.plan];if(write('chx_plan_v1',next))plan=next;}});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&openName){closeDetail();return;}if(e.key==='Enter'&&e.target.id==='wx-input'){setCity(e.target.value);return;}if(e.key==='Tab'&&openName){var focusable=Array.from($('sheet').querySelectorAll('button:not([disabled]),a[href],input,select,[tabindex="0"]'));var first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
    document.addEventListener('visibilitychange',function(){if(!document.hidden){swap=0;renderDaily(true);refreshWeatherIfNeeded();}});
    window.addEventListener('pageshow',refreshWeatherIfNeeded);
    window.addEventListener('online',refreshWeatherIfNeeded);
    setInterval(function(){if(!document.hidden)refreshWeatherIfNeeded();},60000);
    requestWeather();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
}());
